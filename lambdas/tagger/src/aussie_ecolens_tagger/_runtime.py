"""Shared cold-start runtime: model download + service singletons.

Both Lambda entry points - the S3-triggered tagger (handler.py) and the
synchronously-invoked query tagger (query_handler.py) - need the same
expensive setup: ensure the models are on disk, then construct the
MegaDetector + SpeciesNet services once per container. Centralising that
here keeps the two handlers thin and guarantees they initialise identically
(no drift between a "tag and store" path and a "tag only" path).

Importing this module performs the cold-start work as a side effect, so it
is imported once at the top of each handler. Within a single Lambda
container the import runs once; warm invocations reuse the singletons.
"""

from __future__ import annotations

import os

# --- Lambda CPU inference fix (must run before torch runs any conv) --------
# PyTorch's NNPACK CPU-convolution backend calls libcpuinfo on first
# inference, which reads /sys/devices/system/cpu/{possible,present}. Lambda's
# microVM does not expose those files, so cpuinfo aborts with
# "Failed to initialize cpuinfo!" and inference dies. The confirmed fix
# (pytorch/pytorch#14968) is to disable NNPACK: PyTorch then uses a conv path
# that does not probe cpuinfo. For our image sizes the speed difference is
# negligible and correctness is identical.
#
# NOTE: we deliberately do NOT call torch.set_num_threads() - on Lambda that
# call itself goes through the cpuinfo probe (see the stack trace in
# pytorch/cpuinfo#143) and triggers the same crash. Thread counts are left at
# torch's defaults, which work fine once NNPACK is disabled.
os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib")

from aussie_ecolens_tagger.config import settings
from aussie_ecolens_tagger.logging import configure_logging, get_logger
from aussie_ecolens_tagger.services.megadetector import MegaDetectorService
from aussie_ecolens_tagger.services.s3 import S3Service
from aussie_ecolens_tagger.services.speciesnet import SpeciesNetService

configure_logging()
log = get_logger(__name__)

# Disable NNPACK before any model runs. Wrapped defensively: if torch is
# stubbed (unit tests) or the attribute is absent, this must never be fatal.
try:
    import torch

    torch.backends.nnpack.enabled = False
    log.info("nnpack disabled for lambda cpu inference")
except Exception as exc:  # noqa: BLE001 - torch present in image; never fatal
    log.warning("could not disable nnpack", error=str(exc))

# S3 client is always needed (model download, and the tagger's object
# download). Cheap to construct; shared by both handlers.
s3 = S3Service(region_name=settings.aws_region)


def _ensure_models() -> None:
    """Download model files from S3 to their local paths on cold start.

    No-ops when settings.load_models_from_s3 is false (local dev, models
    already on disk) or when the file already exists (warm container reuse
    - /tmp persists across warm invocations in the same container).

    Models live in S3 rather than baked into the image so a new model can
    be rolled out by uploading to S3 and updating an env var, with no code
    change or image rebuild (assignment 4.1).
    """
    if not settings.load_models_from_s3:
        return

    wanted = [
        (settings.megadetector_s3_key, settings.megadetector_path),
        (settings.speciesnet_s3_key, settings.speciesnet_path),
    ]
    for s3_key, dest in wanted:
        if dest.exists():
            log.info("model already present, skipping download", path=str(dest))
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        log.info(
            "downloading model from s3",
            bucket=settings.models_bucket,
            key=s3_key,
            dest=str(dest),
        )
        s3.download(settings.models_bucket, s3_key, dest)


# Download models BEFORE constructing the services that load them.
_ensure_models()

detector = MegaDetectorService(
    model_path=settings.megadetector_path,
    detection_threshold=settings.detection_threshold,
)
classifier = SpeciesNetService(
    model_path=settings.speciesnet_path,
    device="cpu",
    confidence_threshold=settings.species_threshold,
)

log.info(
    "tagger runtime ready",
    aws_region=settings.aws_region,
    detection_threshold=settings.detection_threshold,
    species_threshold=settings.species_threshold,
    snip_size=settings.snip_size,
    load_models_from_s3=settings.load_models_from_s3,
)
