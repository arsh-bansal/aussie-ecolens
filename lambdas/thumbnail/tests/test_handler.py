"""Tests for the thumbnail handler's query-temp guard.

Search-by-image stages its transient query photo at ``query-temp/<uuid>.jpg``
in the SHARED uploads bucket and deletes it right after tagging. This Lambda
watches the whole bucket, so without a guard it would parse that key as
``user_id="query-temp"`` and write an orphan thumbnail object — a persisted
query file (assignment 4.3 forbids that). These lock the guard in.
"""

from __future__ import annotations

import aussie_ecolens_thumbnail.handler as handler


class TestQueryTempGuard:
    def test_predicate_matches_query_temp_prefix(self) -> None:
        assert handler._is_query_temp_key("query-temp/abc123.jpg") is True

    def test_predicate_rejects_normal_upload_key(self) -> None:
        # Real uploads are keyed <cognito-sub>/<sha>.<ext> — never query-temp/.
        assert handler._is_query_temp_key("user-1/abc123.jpg") is False

    def test_process_one_skips_query_temp_without_io(self) -> None:
        # Short-circuits before any S3 get/put — no network, no orphan thumbnail.
        out = handler._process_one("uploads", "query-temp/deadbeef.jpg")
        assert out == {"key": "query-temp/deadbeef.jpg", "skipped": "query-temp"}
