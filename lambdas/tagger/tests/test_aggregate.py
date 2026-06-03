"""Tests for per-frame tag aggregation (video tagging, 2.1.2).

The rule is MAX count per species across frames, NOT sum - summing would
over-count an animal that lingers across seconds. The query semantics are
">= N of a species in this file", so the max single-frame count is correct.
"""

from __future__ import annotations

from aussie_ecolens_tagger.domain.aggregate import aggregate_frame_tags


class TestAggregateFrameTags:
    def test_empty(self) -> None:
        assert aggregate_frame_tags([]) == {}

    def test_all_empty_frames(self) -> None:
        assert aggregate_frame_tags([{}, {}, {}]) == {}

    def test_single_frame(self) -> None:
        assert aggregate_frame_tags([{"Cattle": 2}]) == {"Cattle": 2}

    def test_max_not_sum(self) -> None:
        # Cattle seen across 3 seconds; the answer is the MAX (3), not the
        # sum (6) - the same animals lingered, not 6 distinct cattle.
        frames = [{"Cattle": 2}, {"Cattle": 3}, {"Cattle": 2}]
        assert aggregate_frame_tags(frames) == {"Cattle": 3}

    def test_union_of_species(self) -> None:
        frames = [
            {"Cattle": 2},
            {"Cattle": 3, "Dingo": 1},
            {"Dingo": 1},
        ]
        assert aggregate_frame_tags(frames) == {"Cattle": 3, "Dingo": 1}

    def test_species_only_in_one_frame(self) -> None:
        frames = [{}, {"Koala": 1}, {}]
        assert aggregate_frame_tags(frames) == {"Koala": 1}

    def test_max_picks_higher_regardless_of_order(self) -> None:
        # Higher count comes first, then lower - max must still win.
        frames = [{"Magpie": 5}, {"Magpie": 1}]
        assert aggregate_frame_tags(frames) == {"Magpie": 5}
