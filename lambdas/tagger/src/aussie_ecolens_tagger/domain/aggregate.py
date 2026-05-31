"""Aggregation of per-frame tags into a single video-level tag set.

A video is tagged by sampling one frame per second, tagging each frame with
the image pipeline, then combining the per-frame results into ONE tag map for
the whole video.

Aggregation rule: MAX count per species across frames (not sum). The query
semantics are ">= N of a species" meaning "this file contains at least N of
that species". Summing per-second counts would massively over-count the same
animal lingering across many seconds; the max single-frame count answers
"how many were visible at once", which is the meaningful, non-inflated figure.
"""

from __future__ import annotations

from collections.abc import Iterable


def aggregate_frame_tags(frame_tag_maps: Iterable[dict[str, int]]) -> dict[str, int]:
    """Combine per-frame {species: count} maps into one video {species: count}.

    For each species, take the maximum count seen in any single frame.

    Example:
        frame 0: {"Cattle": 2}
        frame 1: {"Cattle": 3, "Dingo": 1}
        frame 2: {"Dingo": 1}
        -> {"Cattle": 3, "Dingo": 1}
    """
    aggregated: dict[str, int] = {}
    for frame_tags in frame_tag_maps:
        for species, count in frame_tags.items():
            current = aggregated.get(species, 0)
            if count > current:
                aggregated[species] = count
    return aggregated
