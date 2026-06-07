"""
POST /tags/subscribe — subscribe the authenticated user's email to alerts for
one species tag (assignment 2.3.3).

Body:     {"tag": "fox"}   # free-form; resolved to the canonical "Red Fox"
Response: {"status": "pending_confirmation" | "subscribed", "tag": "Red Fox", "email": "..."}

The incoming tag is resolved to the canonical species name (species_catalog)
before use. This matters because the Notifier publishes that exact canonical
name as the SNS "species" MessageAttribute, and SNS filter policies match
attributes by case-sensitive exact string — a filter on "fox" would never match
a published "Red Fox". Unknown species are rejected with 400.

Mechanism: the Notifier Lambda publishes every detection to the SNS topic with a
"species" MessageAttribute. SNS subscription *filter policies* match on that
attribute. SNS allows an email endpoint only ONE subscription per topic, so we
keep ONE subscription per user and grow its filter policy's species list — e.g.
{"species": ["Red Fox", "Southern Cassowary"]} — rather than creating a
subscription per tag (which fails with "Subscription already exists with
different attributes").

Confirmation: a new email subscription is inactive until the user clicks the
one-time "Confirm subscription" link AWS emails them. Until confirmed it has no
real ARN, so its filter policy can't be edited yet — additional tags can be
added only after confirmation.
"""

import os
import json

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from flask import Blueprint, request, jsonify

from auth import require_auth
from species_catalog import CANONICAL_SPECIES, resolve_species

subscribe_bp = Blueprint("subscribe", __name__)

_REGION = os.environ.get("AWS_REGION") or os.environ.get("AWS_REGION_NAME", "ap-southeast-2")
_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
_SPECIES_ATTRIBUTE = os.environ.get("SPECIES_ATTRIBUTE", "species")

_sns = boto3.client("sns", region_name=_REGION)

_PENDING = "PendingConfirmation"
_DELETED = "Deleted"

# Sentinel species name parked in the FilterPolicy when the user "unsubscribes
# from all". The SNS subscription itself stays confirmed — it just filters on a
# value the Notifier will never publish, so no emails arrive. This avoids
# tearing down the subscription, which would force a fresh confirmation email
# on the next subscribe and re-expose the user to email-client link-prefetchers
# that silently auto-unsubscribe.
_PAUSE_SENTINEL = "__paused__"


def _find_email_subscription(email: str) -> tuple[str | None, bool]:
    """Locate this email's subscription on the topic.

    Returns (subscription_arn, pending):
      - (arn, False)  a confirmed subscription with an editable ARN
      - (None, True)  an unconfirmed subscription exists (no editable ARN yet)
      - (None, False) no subscription exists
    """
    pending = False
    token: str | None = None
    while True:
        kwargs: dict = {"TopicArn": _TOPIC_ARN}
        if token:
            kwargs["NextToken"] = token
        resp = _sns.list_subscriptions_by_topic(**kwargs)
        for sub in resp.get("Subscriptions", []):
            if sub.get("Protocol") != "email" or sub.get("Endpoint") != email:
                continue
            arn = sub.get("SubscriptionArn", "")
            if arn and arn not in (_PENDING, _DELETED):
                return arn, False
            if arn == _PENDING:
                pending = True
        token = resp.get("NextToken")
        if not token:
            return None, pending


def _tags_from_filter_policy(arn: str) -> list[str]:
    """Read the species list from a confirmed subscription's filter policy.

    Excludes the pause sentinel so the UI shows a clean list.
    """
    attrs = _sns.get_subscription_attributes(SubscriptionArn=arn).get("Attributes", {})
    policy_raw = attrs.get("FilterPolicy")
    policy = json.loads(policy_raw) if policy_raw else {}
    species = policy.get(_SPECIES_ATTRIBUTE, [])
    if not isinstance(species, list):
        species = [species] if species else []
    return [s for s in species if s != _PAUSE_SENTINEL]


def _remove_tag_from_filter(arn: str, tag: str) -> bool:
    """Remove `tag` from the species filter. Returns True if last species removed.

    When the last real species is removed we park the FilterPolicy on a
    sentinel rather than tearing the SNS subscription down — same reasoning as
    the "unsubscribe from all" path: keep the confirmed subscription alive so
    a resubscribe later doesn't re-trigger a confirmation email that email
    clients can auto-click.
    """
    attrs = _sns.get_subscription_attributes(SubscriptionArn=arn).get("Attributes", {})
    policy_raw = attrs.get("FilterPolicy")
    policy = json.loads(policy_raw) if policy_raw else {}

    species = policy.get(_SPECIES_ATTRIBUTE, [])
    if not isinstance(species, list):
        species = [species] if species else []

    species = [s for s in species if s != tag and s != _PAUSE_SENTINEL]
    if not species:
        species = [_PAUSE_SENTINEL]
        policy[_SPECIES_ATTRIBUTE] = species
        _sns.set_subscription_attributes(
            SubscriptionArn=arn,
            AttributeName="FilterPolicy",
            AttributeValue=json.dumps(policy),
        )
        return True

    policy[_SPECIES_ATTRIBUTE] = species
    _sns.set_subscription_attributes(
        SubscriptionArn=arn,
        AttributeName="FilterPolicy",
        AttributeValue=json.dumps(policy),
    )
    return False


def _add_tag_to_filter(arn: str, tag: str) -> None:
    """Merge `tag` into the species list of an existing subscription's policy.

    Drops the pause sentinel if present (subscription was paused via
    "unsubscribe from all"; adding any real species reactivates it).
    """
    attrs = _sns.get_subscription_attributes(SubscriptionArn=arn).get("Attributes", {})
    policy_raw = attrs.get("FilterPolicy")
    policy = json.loads(policy_raw) if policy_raw else {}

    species = policy.get(_SPECIES_ATTRIBUTE, [])
    if not isinstance(species, list):
        species = [species]
    species = [s for s in species if s != _PAUSE_SENTINEL]
    if tag not in species:
        species.append(tag)

    policy[_SPECIES_ATTRIBUTE] = species
    _sns.set_subscription_attributes(
        SubscriptionArn=arn,
        AttributeName="FilterPolicy",
        AttributeValue=json.dumps(policy),
    )


@subscribe_bp.route("/tags/subscribe", methods=["GET"])
@require_auth
def list_subscriptions():
    """Return species tags this user's SNS email subscription is filtered on."""
    if not _TOPIC_ARN:
        return jsonify({"tags": [], "status": "none", "email": None}), 200

    email = getattr(request, "user_email", None)
    if not email:
        return jsonify({"error": "No email on your account"}), 400

    try:
        arn, pending = _find_email_subscription(email)
        if arn:
            tags = _tags_from_filter_policy(arn)
            return jsonify({
                "tags": tags,
                "status": "subscribed",
                "email": email,
            }), 200
        if pending:
            return jsonify({
                "tags": [],
                "status": "pending_confirmation",
                "email": email,
                "message": "Confirm the AWS SNS email before alerts are active.",
            }), 200
        return jsonify({"tags": [], "status": "none", "email": email}), 200
    except (ClientError, BotoCoreError) as e:
        return jsonify({"error": str(e)}), 500


@subscribe_bp.route("/tags/subscribe", methods=["POST"])
@require_auth
def subscribe():
    if not _TOPIC_ARN:
        return jsonify({"error": "Alerts are not configured (no SNS topic)"}), 500

    body = request.get_json(silent=True) or {}
    raw_tag = (body.get("tag") or "").strip()
    if not raw_tag:
        return jsonify({"error": "Provide 'tag' in JSON body"}), 400

    # Resolve to the exact canonical species name. SNS filter policies match
    # message attributes by case-sensitive exact string, and the Notifier
    # publishes the canonical name the Tagger stored, so the filter value MUST
    # be that canonical name — not the user's casing or a synonym. Reject
    # unknown species rather than create a subscription that can never fire.
    tag = resolve_species(raw_tag)
    if not tag:
        return jsonify({
            "error": f"Unknown species '{raw_tag}'. Use a recognised species name.",
            "valid_species": list(CANONICAL_SPECIES),
        }), 400

    email = getattr(request, "user_email", None)
    if not email:
        return jsonify({"error": "No email on your account; cannot create an alert"}), 400

    try:
        arn, pending = _find_email_subscription(email)

        # Already subscribed (confirmed): just widen the filter policy.
        if arn:
            _add_tag_to_filter(arn, tag)
            return jsonify({"status": "subscribed", "tag": tag, "email": email}), 200

        # Unconfirmed subscription exists: a second Subscribe with different
        # attributes would be rejected by SNS, so ask the user to confirm first.
        if pending:
            return jsonify({
                "status": "pending_confirmation",
                "tag": tag,
                "email": email,
                "message": "Confirm the subscription email we already sent, "
                           "then add more species.",
            }), 200

        # No subscription yet: create one seeded with this tag.
        _sns.subscribe(
            TopicArn=_TOPIC_ARN,
            Protocol="email",
            Endpoint=email,
            Attributes={"FilterPolicy": json.dumps({_SPECIES_ATTRIBUTE: [tag]})},
        )
        return jsonify({"status": "pending_confirmation", "tag": tag, "email": email}), 200

    except (ClientError, BotoCoreError) as e:
        return jsonify({"error": str(e)}), 500


@subscribe_bp.route("/tags/unsubscribe", methods=["POST"])
@require_auth
def unsubscribe():
    """Remove one species from the user's SNS filter, or unsubscribe entirely.

    Body: {"tag": "Red Fox"}  — stop alerts for that species only
      or  {"all": true}       — cancel the SNS email subscription (same as the
                                link in AWS notification emails)
    """
    if not _TOPIC_ARN:
        return jsonify({"error": "Alerts are not configured (no SNS topic)"}), 500

    body = request.get_json(silent=True) or {}
    email = getattr(request, "user_email", None)
    if not email:
        return jsonify({"error": "No email on your account"}), 400

    try:
        arn, pending = _find_email_subscription(email)
        if pending:
            return jsonify({
                "error": "Confirm the SNS subscription email before managing alerts.",
            }), 400
        if not arn:
            return jsonify({"status": "none", "email": email}), 200

        if body.get("all"):
            # Park the FilterPolicy on a sentinel value the Notifier never
            # publishes — the SNS subscription itself stays confirmed, so a
            # later resubscribe doesn't trigger a fresh confirmation email
            # (which some email clients auto-click while scanning links,
            # silently killing the subscription).
            _sns.set_subscription_attributes(
                SubscriptionArn=arn,
                AttributeName="FilterPolicy",
                AttributeValue=json.dumps({_SPECIES_ATTRIBUTE: [_PAUSE_SENTINEL]}),
            )
            return jsonify({
                "status": "unsubscribed_all",
                "email": email,
                "message": "All species alerts cancelled.",
            }), 200

        raw_tag = (body.get("tag") or "").strip()
        if not raw_tag:
            return jsonify({"error": "Provide 'tag' or {\"all\": true}"}), 400

        tag = resolve_species(raw_tag)
        if not tag:
            return jsonify({
                "error": f"Unknown species '{raw_tag}'.",
                "valid_species": list(CANONICAL_SPECIES),
            }), 400

        current = _tags_from_filter_policy(arn)
        if tag not in current:
            return jsonify({
                "status": "not_subscribed",
                "tag": tag,
                "email": email,
            }), 200

        removed_all = _remove_tag_from_filter(arn, tag)
        if removed_all:
            return jsonify({
                "status": "unsubscribed_all",
                "tag": tag,
                "email": email,
                "message": "Last alert removed — SNS email subscription cancelled.",
            }), 200

        return jsonify({"status": "unsubscribed", "tag": tag, "email": email}), 200

    except (ClientError, BotoCoreError) as e:
        return jsonify({"error": str(e)}), 500
