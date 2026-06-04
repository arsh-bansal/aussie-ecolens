"""
POST /tags/subscribe — subscribe the authenticated user's email to alerts for
one species tag (assignment 2.3.3).

Body:     {"tag": "koala"}
Response: {"status": "pending_confirmation" | "subscribed", "tag": "koala", "email": "..."}

Mechanism: the Notifier Lambda publishes every detection to the SNS topic with a
"species" MessageAttribute. SNS subscription *filter policies* match on that
attribute. SNS allows an email endpoint only ONE subscription per topic, so we
keep ONE subscription per user and grow its filter policy's species list — e.g.
{"species": ["koala", "cassowary"]} — rather than creating a subscription per
tag (which fails with "Subscription already exists with different attributes").

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

subscribe_bp = Blueprint("subscribe", __name__)

_REGION = os.environ.get("AWS_REGION") or os.environ.get("AWS_REGION_NAME", "ap-southeast-2")
_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
_SPECIES_ATTRIBUTE = os.environ.get("SPECIES_ATTRIBUTE", "species")

_sns = boto3.client("sns", region_name=_REGION)

_PENDING = "PendingConfirmation"
_DELETED = "Deleted"


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


def _add_tag_to_filter(arn: str, tag: str) -> None:
    """Merge `tag` into the species list of an existing subscription's policy."""
    attrs = _sns.get_subscription_attributes(SubscriptionArn=arn).get("Attributes", {})
    policy_raw = attrs.get("FilterPolicy")
    policy = json.loads(policy_raw) if policy_raw else {}

    species = policy.get(_SPECIES_ATTRIBUTE, [])
    if not isinstance(species, list):
        species = [species]
    if tag not in species:
        species.append(tag)

    policy[_SPECIES_ATTRIBUTE] = species
    _sns.set_subscription_attributes(
        SubscriptionArn=arn,
        AttributeName="FilterPolicy",
        AttributeValue=json.dumps(policy),
    )


@subscribe_bp.route("/tags/subscribe", methods=["POST"])
@require_auth
def subscribe():
    if not _TOPIC_ARN:
        return jsonify({"error": "Alerts are not configured (no SNS topic)"}), 500

    body = request.get_json(silent=True) or {}
    tag = (body.get("tag") or "").strip().lower()
    if not tag:
        return jsonify({"error": "Provide 'tag' in JSON body"}), 400

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
