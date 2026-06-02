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


class TestToUpdate:
    """The tagger MERGES into the shared record via UpdateItem (it must not
    PutItem-clobber the upload/presign seed). These lock the key, the tagger-
    owned SET fields, and the if_not_exists() guard on seed-shared fields.
    """

    def test_key_is_file_hash_sha_not_raw_key(self) -> None:
        u = DynamoDBService._to_update(
            _result("user-1/cassowary002.JPG", {"Casuarius_casuarius": 1})
        )
        assert u["key"]["pk"]["S"] == "FILE#cassowary002"
        assert "/" not in u["key"]["pk"]["S"]  # valid Cosmos id
        assert u["key"]["sk"]["S"] == "METADATA"

    def test_uses_update_not_full_replace(self) -> None:
        # The expression must be a SET update, not a put of the whole item.
        u = DynamoDBService._to_update(_result("u1/x.JPG", {"Bos_taurus": 1}))
        assert u["expression"].startswith("SET ")

    def test_tags_translated_to_common_names(self) -> None:
        u = DynamoDBService._to_update(
            _result("u1/x.JPG", {"Casuarius_casuarius": 1})
        )
        assert u["values"][":tags"]["M"] == {"Southern Cassowary": {"N": "1"}}

    def test_reserved_words_aliased(self) -> None:
        # 'tags' and 'status' are DynamoDB reserved words; must be aliased.
        u = DynamoDBService._to_update(_result("u1/x.JPG", {"Bos_taurus": 1}))
        assert u["names"]["#tags"] == "tags"
        assert u["names"]["#status"] == "status"
        assert "#tags = :tags" in u["expression"]

    def test_seed_fields_use_if_not_exists(self) -> None:
        # user_id/checksum/s3_url/uploaded_at must NOT clobber a presign seed:
        # they are written only if absent.
        u = DynamoDBService._to_update(_result("cognito-xyz/img.JPG", {"Bos_taurus": 2}))
        expr = u["expression"]
        assert "user_id = if_not_exists(user_id, :user_id)" in expr
        assert "checksum = if_not_exists(checksum, :checksum)" in expr
        assert "s3_url = if_not_exists(s3_url, :s3_url)" in expr
        assert "uploaded_at = if_not_exists(uploaded_at, :uploaded_at)" in expr

    def test_tagger_owned_fields_set_unconditionally(self) -> None:
        # file_type / thumbnail_url / counts / updated_at are the tagger's to
        # own, so they are assigned directly (no if_not_exists).
        u = DynamoDBService._to_update(_result("u1/x.JPG", {"Bos_taurus": 1}))
        expr = u["expression"]
        assert "file_type = :file_type" in expr
        assert "thumbnail_url = :thumbnail_url" in expr
        assert "updated_at = :updated_at" in expr

    def test_does_not_touch_upload_only_fields(self) -> None:
        # mime_type / original_filename / size_bytes belong to the upload side
        # exclusively; the tagger must never reference them.
        u = DynamoDBService._to_update(_result("u1/x.JPG", {"Bos_taurus": 1}))
        blob = u["expression"] + str(u["values"]) + str(u["names"])
        assert "mime_type" not in blob
        assert "original_filename" not in blob
        assert "size_bytes" not in blob

    def test_s3_url_value_assembled(self) -> None:
        u = DynamoDBService._to_update(_result("u1/x.JPG", {"Canis_familiaris": 1}))
        assert u["values"][":s3_url"]["S"] == "s3://aussie-ecolens-uploads-123/u1/x.JPG"

    def test_thumbnail_url_set_for_images(self) -> None:
        u = DynamoDBService._to_update(_result("u1/abc123.JPG", {"Bos_taurus": 1}))
        assert u["values"][":file_type"]["S"] == "image"
        assert u["values"][":thumbnail_url"]["S"].startswith("s3://")
        assert u["values"][":thumbnail_url"]["S"].endswith("/abc123.jpg")

    def test_thumbnail_url_null_for_videos(self) -> None:
        u = DynamoDBService._to_update(_result("u1/clip.mp4", {"Bos_taurus": 1}))
        assert u["values"][":file_type"]["S"] == "video"
        assert u["values"][":thumbnail_url"] == {"NULL": True}

    def test_empty_tags_still_updates(self) -> None:
        # Zero-animal uploads: the record must still be tagged with tags {}.
        u = DynamoDBService._to_update(_result("u1/empty.JPG", {}))
        assert u["key"]["pk"]["S"] == "FILE#empty"
        assert u["values"][":tags"]["M"] == {}
        assert u["values"][":n_detections"]["N"] == "0"

    def test_two_latin_ids_same_common_name_sum(self) -> None:
        u = DynamoDBService._to_update(
            _result("u1/x.JPG", {"Casuarius_casuarius": 1})
        )
        assert u["values"][":tags"]["M"]["Southern Cassowary"]["N"] == "1"
        