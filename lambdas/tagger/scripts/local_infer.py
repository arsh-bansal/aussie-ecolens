"""Local inference smoke test — bypasses S3/DDB, exercises the real ML path.

Runs MegaDetector + SpeciesNet + the tag_image pipeline on a single local
image file. Used to validate that the container's CPU-only torch build still
produces correct detections after the CUDA-stack removal (fix #1).

Usage (inside the container):
    /var/task/.venv/bin/python /tmp/local_infer.py /var/task/models/test_images/<img>

Exits 0 and prints the TagResult on success; exits 1 with a traceback on failure.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

from aussie_ecolens_tagger.domain.pipeline import tag_image
from aussie_ecolens_tagger.services.megadetector import MegaDetectorService
from aussie_ecolens_tagger.services.speciesnet import SpeciesNetService

MD_PATH = Path("/var/task/models/mdv5a.pt")
SN_PATH = Path("/var/task/models/model.pt")
DETECTION_THRESHOLD = 0.4
SPECIES_THRESHOLD = 0.4
SNIP_SIZE = 600


def main(image_arg: str) -> int:
    image_path = Path(image_arg)
    if not image_path.exists():
        print(f"ERROR: image not found: {image_path}", file=sys.stderr)
        return 1

    print(f"[1/4] loading MegaDetector from {MD_PATH} ...", flush=True)
    detector = MegaDetectorService(
        model_path=MD_PATH,
        detection_threshold=DETECTION_THRESHOLD,
    )

    print(f"[2/4] loading SpeciesNet from {SN_PATH} ...", flush=True)
    classifier = SpeciesNetService(
        model_path=SN_PATH,
        device="cpu",
        confidence_threshold=SPECIES_THRESHOLD,
    )

    print(f"[3/4] decoding image {image_path.name} ...", flush=True)
    image = Image.open(image_path).convert("RGB")

    print("[4/4] running tag_image pipeline ...", flush=True)
    result = tag_image(
        image_path=image_path,
        image=image,
        detector=detector,
        classifier=classifier,
        snip_size=SNIP_SIZE,
        s3_bucket="local-test",
        s3_key=image_path.name,
    )

    print("\n=== TagResult ===")
    print(f"  image:             {image_path.name}")
    print(f"  tags:              {result.tags}")
    print(f"  n_detections:      {result.n_detections}")
    print(f"  n_classified:      {result.n_classified}")
    print(f"  n_below_threshold: {result.n_below_threshold}")
    print(f"  elapsed_ms:        {result.elapsed_ms}")

    if not result.tags:
        print(
            "\nWARNING: no tags produced. Either the image has no animals "
            "above threshold, or inference is broken.",
            file=sys.stderr,
        )
        return 2

    print("\nINFERENCE OK")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: local_infer.py <path-to-image>", file=sys.stderr)
        sys.exit(1)
    sys.exit(main(sys.argv[1]))