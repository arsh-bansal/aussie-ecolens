"""SpeciesNet species classification service.

Wraps the fine-tuned SpeciesNet model (supplied as model.pt) behind a
stateful class. Like MegaDetectorService, the model is loaded once
per Lambda container and reused across warm invocations.

Input contract: a cropped image of one detected animal (typically
600x600 produced by upstream MegaDetector + crop step). The crop is
resized to 480x480 and run through SpeciesNet to produce a 46-class
softmax distribution. The argmax index maps to species.SPECIES.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torchvision.transforms as transforms
from PIL import Image

from aussie_ecolens_tagger.exceptions import ClassificationError, ModelLoadError
from aussie_ecolens_tagger.logging import get_logger
from aussie_ecolens_tagger.species import SPECIES, common_name

log = get_logger(__name__)


# SpeciesNet expects 480x480 input per the supplied config.yaml.
_INPUT_SIZE = 480


@dataclass(frozen=True, slots=True)
class Classification:
    """One species classification result.

    Attributes:
        species: Latin identifier from species.SPECIES (canonical).
        common_name: Human-friendly name for display.
        confidence: Softmax probability in (0, 1].
        top_k: Sorted alternative predictions for debugging,
               highest confidence first, excluding the winner.
               Limited to 4 entries to keep log payloads small.
    """

    species: str
    common_name: str
    confidence: float
    top_k: tuple[tuple[str, float], ...]


class SpeciesNetService:
    """Stateful wrapper around fine-tuned SpeciesNet inference.

    Loads the .pt model once on construction; subsequent calls
    to classify() reuse the in-memory model.

    Args:
        model_path: Local filesystem path to SpeciesNet model.pt.
        device: PyTorch device string ("cpu", "cuda", "mps").
        confidence_threshold: Minimum confidence for the returned
                              winner to be considered a valid tag.
                              If the model is less confident than
                              this, classify() raises ClassificationError.

    Raises:
        ModelLoadError: if model_path is missing or torch.load fails.
    """

    def __init__(
        self,
        model_path: Path,
        device: str = "cpu",
        confidence_threshold: float = 0.4,
    ) -> None:
        if not model_path.exists():
            raise ModelLoadError(f"SpeciesNet model not found: {model_path}")

        self._device = device
        self._threshold = confidence_threshold

        t0 = time.monotonic()
        try:
            # weights_only=False because the supplied model.pt is a full
            # pickled torch graph (not just a state_dict) that references
            # onnx2torch classes from its original ONNX -> torch conversion.
            model = torch.load(model_path, map_location=device, weights_only=False)
        except Exception as e:  # noqa: BLE001 -- rewrap as typed error
            raise ModelLoadError(f"failed to torch.load {model_path}: {e}") from e

        model.eval()
        model.to(device)
        self._model = model

        self._transform = transforms.Compose([
            transforms.Resize((_INPUT_SIZE, _INPUT_SIZE)),
            transforms.ToTensor(),
        ])

        log.info(
            "speciesnet loaded",
            path=str(model_path),
            device=device,
            threshold=confidence_threshold,
            load_ms=round((time.monotonic() - t0) * 1000.0, 1),
        )

    def classify(self, crop: Image.Image) -> Classification:
        """Classify a cropped animal image.

        Args:
            crop: PIL RGB Image of a single animal, ideally tight to
                  the bounding box from MegaDetector. Any size accepted
                  (resized internally to 480x480).

        Returns:
            Classification with the winning species, confidence, and
            top-K runners-up for debugging.

        Raises:
            ClassificationError: if inference fails, or if the top
                                 confidence falls below the configured
                                 threshold (caller should treat as
                                 "unknown species" not a tag).
        """
        t0 = time.monotonic()
        try:
            tensor = self._transform(crop).unsqueeze(0).permute(0, 2, 3, 1).to(self._device)
            with torch.no_grad():
                logits = self._model(tensor)
                probs = torch.softmax(logits, dim=1)[0].cpu().numpy()
        except Exception as e:  # noqa: BLE001 -- rewrap as typed error
            raise ClassificationError(f"speciesnet inference failed: {e}") from e

        order = np.argsort(probs)[::-1]
        best_idx = int(order[0])
        best_conf = float(probs[best_idx])
        best_species = SPECIES[best_idx]

        top_k: tuple[tuple[str, float], ...] = tuple(
            (SPECIES[int(i)], float(probs[int(i)])) for i in order[1:5]
        )

        elapsed_ms = round((time.monotonic() - t0) * 1000.0, 1)

        if best_conf < self._threshold:
            log.warning(
                "speciesnet low confidence",
                species=best_species,
                confidence=best_conf,
                threshold=self._threshold,
                elapsed_ms=elapsed_ms,
            )
            raise ClassificationError(
                f"top prediction {best_species} at {best_conf:.3f} below "
                f"threshold {self._threshold}"
            )

        log.info(
            "speciesnet classify complete",
            species=best_species,
            confidence=round(best_conf, 4),
            elapsed_ms=elapsed_ms,
        )

        return Classification(
            species=best_species,
            common_name=common_name(best_species),
            confidence=best_conf,
            top_k=top_k,
        )
