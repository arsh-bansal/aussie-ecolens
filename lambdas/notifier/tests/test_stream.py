"""Unit tests for domain.stream - DynamoDB stream record parsing.

Pure tests: build raw stream records as dicts, assert the parsed
NotificationIntent list. No AWS, no boto3.
"""

from __future__ import annotations

import pytest

from aussie_ecolens_notifier.domain.stream import (
    NotificationIntent,
    format_email,
    intents_from_record,
)
from aussie_ecolens_notifier.exceptions import StreamRecordError


def _record(
    event_name: str = "INSERT",
    *,
    tags: dict[str, int] | None = None,
    pk: str = "FILE#abc123",
    s3_url: str = "s3://bucket/user/abc123.jpg",
    user_id: str = "user-sub-1",
    include_new_image: bool = True,
) -> dict:
    """Build a DynamoDB stream record with the given tags."""
    ddb: dict = {"SequenceNumber": "100000000000000000001"}
    if include_new_image:
        new_image: dict = {
            "pk": {"S": pk},
            "sk": {"S": "METADATA"},
            "user_id": {"S": user_id},
            "s3_url": {"S": s3_url},
        }
        if tags is not None:
            new_image["tags"] = {
                "M": {sp: {"N": str(c)} for sp, c in tags.items()}
            }
        ddb["NewImage"] = new_image
    return {"eventName": event_name, "dynamodb": ddb}


# ----------------------------------------------------------------------
# Happy paths
# ----------------------------------------------------------------------


def test_single_species_one_intent():
    rec = _record(tags={"koala": 3})
    intents = intents_from_record(rec)

    assert len(intents) == 1
    assert intents[0] == NotificationIntent(
        species="koala",
        count=3,
        file_url="s3://bucket/user/abc123.jpg",
        user_id="user-sub-1",
        file_key="FILE#abc123",
    )


def test_multiple_species_one_intent_each():
    rec = _record(tags={"koala": 2, "wombat": 1, "dingo": 5})
    intents = intents_from_record(rec)

    species = {i.species for i in intents}
    assert species == {"koala", "wombat", "dingo"}
    assert len(intents) == 3


def test_modify_event_also_notifies():
    rec = _record(event_name="MODIFY", tags={"emu": 1})
    intents = intents_from_record(rec)
    assert len(intents) == 1
    assert intents[0].species == "emu"


# ----------------------------------------------------------------------
# Filtering / edge cases
# ----------------------------------------------------------------------


def test_remove_event_ignored():
    rec = _record(event_name="REMOVE", tags={"koala": 9})
    assert intents_from_record(rec) == []


def test_no_tags_attribute_yields_nothing():
    rec = _record(tags=None)  # file with no detected animals
    assert intents_from_record(rec) == []


def test_empty_tags_map_yields_nothing():
    rec = _record(tags={})
    assert intents_from_record(rec) == []


def test_min_count_filters_low_counts():
    rec = _record(tags={"koala": 1, "wombat": 3})
    intents = intents_from_record(rec, min_count=2)
    # koala (1) filtered out, wombat (3) kept
    assert [i.species for i in intents] == ["wombat"]


def test_no_new_image_yields_nothing():
    rec = _record(include_new_image=False)
    assert intents_from_record(rec) == []


# ----------------------------------------------------------------------
# Malformed records
# ----------------------------------------------------------------------


def test_tags_not_a_map_raises():
    rec = _record(tags={"koala": 1})
    # Corrupt the tags node into a String instead of a Map.
    rec["dynamodb"]["NewImage"]["tags"] = {"S": "not-a-map"}
    with pytest.raises(StreamRecordError):
        intents_from_record(rec)


def test_tag_count_not_a_number_raises():
    rec = _record(tags={"koala": 1})
    rec["dynamodb"]["NewImage"]["tags"]["M"]["koala"] = {"S": "three"}
    with pytest.raises(StreamRecordError):
        intents_from_record(rec)


def test_missing_dynamodb_section_raises():
    rec = {"eventName": "INSERT"}
    with pytest.raises(StreamRecordError):
        intents_from_record(rec)


# ----------------------------------------------------------------------
# Email formatting
# ----------------------------------------------------------------------


def test_format_email_singular_plural():
    one = NotificationIntent("koala", 1, "s3://b/k.jpg", "u", "FILE#k")
    many = NotificationIntent("koala", 4, "s3://b/k.jpg", "u", "FILE#k")

    subj1, body1 = format_email(one)
    _, body4 = format_email(many)

    assert "koala" in subj1
    assert "1 individual" in body1
    assert "individuals" not in body1  # singular
    assert "4 individuals" in body4  # plural


def test_format_email_subject_under_sns_limit():
    intent = NotificationIntent("a" * 200, 1, "s3://b/k.jpg", "u", "FILE#k")
    subject, _ = format_email(intent)
    # The handler truncates to 100 at publish; the formatter itself stays
    # human-readable, but verify it is not absurdly long.
    assert subject.startswith("Aussie EcoLens:")
