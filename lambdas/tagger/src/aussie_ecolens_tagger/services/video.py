"""Video frame extraction for the video tagging path.

Extracts ONE frame per second of video (per the spec: "extract 1 image per
second; do not try to extract all frames"). Uses OpenCV (cv2.VideoCapture):
the spec explicitly suggests OpenCV for media handling, and it is the right
tool for decoding arbitrary container/codec combinations on Lambda. We use
the headless wheel (opencv-python-headless) so there is no libGL dependency
in the Lambda image.

The extractor yields PIL Images so downstream code reuses the exact same
tag_image pipeline as the single-image tagger - frames are just images.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from PIL import Image

from aussie_ecolens_tagger.exceptions import DetectionError
from aussie_ecolens_tagger.logging import get_logger

log = get_logger(__name__)


def extract_frames_one_per_second(video_path: Path) -> Iterator[tuple[int, Image.Image]]:
    """Yield (second_index, frame_image) at one frame per second.

    Reads the video's FPS and samples one frame at the start of each second.
    Falls back to a sensible default FPS if the container does not report it.
    Frames are converted from OpenCV BGR to RGB PIL Images so they feed the
    image pipeline unchanged.

    Args:
        video_path: Local path to the downloaded video file.

    Yields:
        (second, image) tuples, second starting at 0.

    Raises:
        DetectionError: if the video cannot be opened or has no readable frames.
    """
    # Imported lazily so unit tests that monkeypatch this function do not need
    # the (heavy) cv2 wheel installed, and module import never requires libGL.
    import cv2  # noqa: PLC0415

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise DetectionError(f"could not open video: {video_path.name}")

    try:
        fps = capture.get(cv2.CAP_PROP_FPS)
        # Guard against missing/zero/NaN fps metadata.
        if not fps or fps != fps or fps <= 0:  # fps != fps catches NaN
            fps = 25.0
            log.warning("video fps missing; defaulting", default_fps=fps)

        step = max(1, round(fps))  # frames to skip to advance ~1 second
        frame_idx = 0
        second = 0
        yielded = 0

        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_idx % step == 0:
                # cv2 frames are BGR ndarrays; convert to RGB for PIL.
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                yield second, Image.fromarray(rgb)
                second += 1
                yielded += 1
            frame_idx += 1

        if yielded == 0:
            raise DetectionError(f"no frames decoded from video: {video_path.name}")
        log.info("frame extraction complete", frames=yielded, fps=fps, step=step)
    finally:
        capture.release()
