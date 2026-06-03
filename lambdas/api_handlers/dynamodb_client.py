"""
DynamoDB client — write path for manual edits (tag modify, delete).

In the CQRS design DynamoDB (aussie-ecolens-files) is the system of record and
Azure Cosmos is a read replica fed by the Replicator (via DynamoDB Streams).
So manual tag edits and deletes MUST write here, NOT directly to Cosmos:

    tag edit  -> UpdateItem on DynamoDB -> stream -> Replicator -> Cosmos
    delete    -> DeleteItem on DynamoDB -> stream (REMOVE) -> Replicator deletes Cosmos

This keeps a single source of truth and avoids DynamoDB/Cosmos divergence.
Reads still go to Cosmos (the read model) via cosmos_client.

Note: replication is asynchronous (DynamoDB Streams), so a query issued in the
~1-2s immediately after an edit/delete may briefly see the pre-change Cosmos
state — standard CQRS eventual consistency.

Record shape (matches Arsh's tagger / replicator):
    pk = "FILE#<sha>", sk = "METADATA"
    tags = {common_name: count}, user_id, file_type, s3_url, thumbnail_url, ...
"""

import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

_dynamodb = None

TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "aussie-ecolens-files")


def _get_client():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.client(
            "dynamodb", region_name=os.environ.get("AWS_REGION", "ap-southeast-2")
        )
    return _dynamodb


def _key(sha: str) -> dict:
    return {"pk": {"S": f"FILE#{sha}"}, "sk": {"S": "METADATA"}}


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def update_file_tags(sha: str, user_id: str, new_tags: dict[str, int]) -> bool:
    """Set the tags map on the file's DynamoDB record (system of record).

    The Replicator mirrors the change to Cosmos via the stream. We scope the
    write with a ConditionExpression on user_id so a user can only edit their
    own files (defence in depth on top of the JWT/authorizer).

    Returns True on success, False if the item doesn't exist or isn't owned by
    this user.
    """
    tags_av = {"M": {name: {"N": str(int(c))} for name, c in new_tags.items()}}
    try:
        _get_client().update_item(
            TableName=TABLE_NAME,
            Key=_key(sha),
            UpdateExpression="SET #tags = :tags, updated_at = :now",
            ConditionExpression="attribute_exists(pk) AND user_id = :uid",
            ExpressionAttributeNames={"#tags": "tags"},
            ExpressionAttributeValues={
                ":tags": tags_av,
                ":now": {"S": _now()},
                ":uid": {"S": user_id},
            },
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False  # not found, or not owned by this user
        raise


def delete_file_record(sha: str, user_id: str) -> bool:
    """Delete the file's DynamoDB record (system of record).

    The Replicator deletes the corresponding Cosmos document via the stream
    REMOVE event. Scoped to the owner with a ConditionExpression.

    Returns True if an owned item was deleted, False if it didn't exist / isn't
    owned by this user.
    """
    try:
        _get_client().delete_item(
            TableName=TABLE_NAME,
            Key=_key(sha),
            ConditionExpression="attribute_exists(pk) AND user_id = :uid",
            ExpressionAttributeValues={":uid": {"S": user_id}},
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise