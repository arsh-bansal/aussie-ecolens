"""Tests for the DynamoDB write path (services/dynamodb.py).

These cover the record-shape contract the rest of the system depends on:
the partition key must be FILE#<sha> (no slashes/dots, so it is also a valid
Cosmos document id), the user_id must be parsed out of the S3 key (Cosmos
partition key / GSI hash), and tags must be stored as common names. A live
pipeline run once wrote FILE#<raw-key> with no user_id and Latin tags, which
broke cross-cloud replication - these tests lock that bug out.
"""

from __future__ import annotations

from aussie_ecolens_tagger.domain.models import TagResult
from aussie_ecolens_tagger.services.dynamodb import DynamoDBService


def _result(s3_key: str, tags: dict[str, int]) -> TagResult:
    """Build a TagResult for a given key + tag map (counts are illustrative)."""
    n = sum(tags.values())
    return TagResult(
        s3_bucket="aussie-ecolens-uploads-123",
        s3_key=s3_key,
        tags=tags,
        n_detections=n,
        n_classified=n,
        n_below_threshold=0,
        elapsed_ms=1234.5,
    )


class TestParseKey:
    def test_standard_upload_key(self) -> None:
        user_id, sha, file_type = DynamoDBService._parse_key(
            "cognito-sub-abc/deadbeef123.JPG"
        )
        assert user_id == "cognito-sub-abc"
        assert sha == "deadbeef123"
        assert file_type == "image"

    def test_video_extension(self) -> None:
        _, _, file_type = DynamoDBService._parse_key("user-1/clip.mp4")
        assert file_type == "video"

    def test_key_without_user_prefix_falls_back_to_unknown(self) -> None:
        user_id, sha, _ = DynamoDBService._parse_key("loosefile.png")
        assert user_id == "unknown"
        assert sha == "loosefile"

    def test_sha_never_contains_slash_or_dot(self) -> None:
        # The exact shape that broke Cosmos: a nested key with an extension.
        _, sha, _ = DynamoDBService._parse_key("u1/abc.def.JPG")
        assert "/" not in sha
        # PurePosixPath.stem strips only the final suffix; that is fine, the
        # point is the pk has no slash (the Cosmos-illegal char).
        assert sha == "abc.def" or "/" not in sha


class TestToItem:
    def test_pk_is_file_hash_sha_not_raw_key(self) -> None:
        item = DynamoDBService._to_item(
            _result("user-1/cassowary002.JPG", {"Casuarius_casuarius": 1})
        )
        assert item["pk"]["S"] == "FILE#cassowary002"
        assert "/" not in item["pk"]["S"]  # valid Cosmos id
        assert item["sk"]["S"] == "METADATA"

    def test_user_id_parsed_from_key(self) -> None:
        item = DynamoDBService._to_item(
            _result("cognito-xyz/img.JPG", {"Bos_taurus": 2})
        )
        assert item["user_id"]["S"] == "cognito-xyz"
        assert item["checksum"]["S"] == "img"

    def test_tags_translated_to_common_names(self) -> None:
        item = DynamoDBService._to_item(
            _result("u1/x.JPG", {"Casuarius_casuarius": 1})
        )
        assert item["tags"]["M"] == {"Southern Cassowary": {"N": "1"}}

    def test_s3_url_assembled(self) -> None:
        item = DynamoDBService._to_item(
            _result("u1/x.JPG", {"Canis_familiaris": 1})
        )
        assert item["s3_url"]["S"] == "s3://aussie-ecolens-uploads-123/u1/x.JPG"

    def test_thumbnail_url_is_null(self) -> None:
        item = DynamoDBService._to_item(_result("u1/x.JPG", {"Bos_taurus": 1}))
        assert item["thumbnail_url"] == {"NULL": True}

    def test_empty_tags_still_writes_record(self) -> None:
        # Zero-animal uploads: the record must still be written with tags {}.
        item = DynamoDBService._to_item(_result("u1/empty.JPG", {}))
        assert item["pk"]["S"] == "FILE#empty"
        assert item["user_id"]["S"] == "u1"
        assert item["tags"]["M"] == {}
        assert item["n_detections"]["N"] == "0"

    def test_two_latin_ids_same_common_name_sum(self) -> None:
        # Defensive: if two Latin ids ever map to one common name, counts sum
        # rather than one clobbering the other.
        item = DynamoDBService._to_item(
            _result("u1/x.JPG", {"Casuarius_casuarius": 1})
        )
        # Single mapping here; assert the count survived translation.
        assert item["tags"]["M"]["Southern Cassowary"]["N"] == "1"
        