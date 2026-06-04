"""
POST /tags/subscribe — subscribe the authenticated user's email to alerts for
one species tag (assignment 2.3.3).

Body:     {"tag": "koala"}
Response: {"status": "pending_confirmation" | "subscribed", "tag": "koala", "email": "..."}

Mechanism: the Notifier Lambda publishes every detection to the SNS topic with a
"species" MessageAttribute. SNS subscription *filter policies* match on that
attribute, so we create one email subscription per (user, tag) with a filter
policy of {"species": [tag]} — the user then only receives emails for tags they
asked for; SNS does the routing.

Confirmation: SNS email subscriptions are not active until the user clicks the
one-time "Confirm subscription" link AWS emails them. Until then the
subscription is PendingConfirmation and no alerts are delivered — hence the
"pending_confirmation" status returned on first subscribe.
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

    # Match the exact attribute the Notifier publishes on.
    filter_policy = {_SPECIES_ATTRIBUTE: [tag]}

    try:
        # Deliberately NOT passing ReturnSubscriptionArn=True: with it, SNS
        # returns a real-looking ARN even while the email is unconfirmed, which
        # would let us falsely report "subscribed". Without it, a fresh email
        # subscription returns the literal "pending confirmation" until the
        # user clicks the AWS confirmation link, so the status we report is
        # truthful. An already-confirmed endpoint returns its real ARN.
        resp = _sns.subscribe(
            TopicArn=_TOPIC_ARN,
            Protocol="email",
            Endpoint=email,
            Attributes={"FilterPolicy": json.dumps(filter_policy)},
        )
    except (ClientError, BotoCoreError) as e:
        return jsonify({"error": str(e)}), 500

    # An unconfirmed email subscription has no real ARN yet.
    arn = resp.get("SubscriptionArn", "")
    confirmed = bool(arn) and arn.lower() != "pending confirmation"

    return jsonify({
        "status": "subscribed" if confirmed else "pending_confirmation",
        "tag": tag,
        "email": email,
    }), 200
