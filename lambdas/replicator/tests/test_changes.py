"""Unit tests for domain.changes - DynamoDB stream -> replication op.

Pure tests: raw stream records in, typed ReplicationOp out. No AWS, no
Azure. Covers the type deserialisation (the fiddly part) and the
event-to-op mapping including deletes.
"""

from __future__ import annotations

import pytest

from aussie_ecolens_replicator.domain.changes import (
    Delete,
    Upsert,
    deserialize_image,
    deserialize_value,
    op_from_record,
)
from aussie_ecolens_replicator.exceptions import ChangeParseError


# ----------------------------------------------------------------------
# deserialize_value - the DynamoDB typed-JSON decoder
# ----------------------------------------------------------------------


def test_deserialize_string():
    assert deserialize_value({"S": "koala"}) == "koala"


def test_deserialize_integer_number():
    assert deserialize_value({"N": "3"}) == 3
    assert isinstance(deserialize_value({"N": "3"}), int)


def test_deserialize_float_number():
    assert deserialize_value({"N": "0.95"}) == 0.95
    assert isinstance(deserialize_value({"N": "0.95"}), float)


def test_deserialize_bool_and_null():
    assert deserialize_value({"BOOL": True}) is True
    assert deserialize_value({"NULL": True}) is None


def test_deserialize_nested_map():
    node = {"M": {"koala": {"N": "2"}, "wombat": {"N": "1"}}}
    assert deserialize_value(node) == {"koala": 2, "wombat": 1}


def test_deserialize_list():
    node = {"L": [{"S": "a"}, {"N": "2"}, {"BOOL": False}]}
    assert deserialize_value(node) == ["a", 2, False]


def test_deserialize_string_set():
    assert sorted(deserialize_value({"SS": ["a", "b"]})) == ["a", "b"]


def test_deserialize_rejects_multi_key_node():
    with pytest.raises(ChangeParseError):
        deserialize_value({"S": "x", "N": "1"})


def test_deserialize_rejects_unknown_type():
    with pytest.raises(ChangeParseError):
        deserialize_value({"ZZ": "x"})


def test_deserialize_image_full_item():
    image = {
        "pk": {"S": "FILE#abc"},
        "sk": {"S": "METADATA"},
        "user_id": {"S": "user-1"},
        "checksum": {"S": "abc"},
        "tags": {"M": {"koala": {"N": "2"}}},
        "uploaded_at": {"S": "2026-05-30T00:00:00Z"},
    }
    out = deserialize_image(image)
    assert out == {
        "pk": "FILE#abc",
        "sk": "METADATA",
        "user_id": "user-1",
        "checksum": "abc",
        "tags": {"koala": 2},
        "uploaded_at": "2026-05-30T00:00:00Z",
    }


# ----------------------------------------------------------------------
# op_from_record - event mapping
# ----------------------------------------------------------------------


def _image(checksum="abc123", user_id="user-1", **extra):
    img = {
        "pk": {"S": f"FILE#{checksum}"},
        "sk": {"S": "METADATA"},
        "checksum": {"S": checksum},
        "user_id": {"S": user_id},
        "tags": {"M": {"koala": {"N": "1"}}},
    }
    img.update(extra)
    return img


def test_insert_becomes_upsert():
    rec = {"eventName": "INSERT", "dynamodb": {"NewImage": _image()}}
    op = op_from_record(rec)
    assert isinstance(op, Upsert)
    assert op.doc_id == "abc123"
    assert op.partition_key == "user-1"
    assert op.document["id"] == "abc123"  # id injected for Cosmos
    assert op.document["tags"] == {"koala": 1}


def test_modify_becomes_upsert():
    rec = {"eventName": "MODIFY", "dynamodb": {"NewImage": _image()}}
    assert isinstance(op_from_record(rec), Upsert)


def test_remove_becomes_delete_from_old_image():
    rec = {"eventName": "REMOVE", "dynamodb": {"OldImage": _image()}}
    op = op_from_record(rec)
    assert isinstance(op, Delete)
    assert op.doc_id == "abc123"
    assert op.partition_key == "user-1"


def test_remove_falls_back_to_keys():
    rec = {
        "eventName": "REMOVE",
        "dynamodb": {"Keys": {"pk": {"S": "FILE#xyz"}, "sk": {"S": "METADATA"}}},
    }
    op = op_from_record(rec)
    assert isinstance(op, Delete)
    assert op.doc_id == "xyz"  # stripped FILE# prefix
    assert op.partition_key == "unknown"  # no user_id in keys


def test_doc_id_prefers_checksum_over_pk():
    # pk and checksum disagree; checksum wins.
    img = _image(checksum="realsha")
    img["pk"] = {"S": "FILE#somethingelse"}
    rec = {"eventName": "INSERT", "dynamodb": {"NewImage": img}}
    assert op_from_record(rec).doc_id == "realsha"


def test_unreplicated_event_returns_none():
    rec = {"eventName": "WEIRD", "dynamodb": {"NewImage": _image()}}
    assert op_from_record(rec) is None


def test_insert_without_newimage_raises():
    rec = {"eventName": "INSERT", "dynamodb": {}}
    with pytest.raises(ChangeParseError):
        op_from_record(rec)


def test_missing_dynamodb_raises():
    with pytest.raises(ChangeParseError):
        op_from_record({"eventName": "INSERT"})


def test_partition_falls_back_when_user_missing():
    img = _image()
    del img["user_id"]
    rec = {"eventName": "INSERT", "dynamodb": {"NewImage": img}}
    assert op_from_record(rec).partition_key == "unknown"
