"""Multi-image smoke test for the AussieEcoLens ML pipeline.

Modes:
  default              run all images in models/test_images/
  --single <filename>  run a single image (must exist in test_images/)

Reports per-image prediction + final accuracy summary.

Run from lambdas/tagger/:
    uv run python smoke_test.py
    uv run python smoke_test.py --single Casuarius_casuarius_1.JPG
"""

from __future__ import annotations

import argparse
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torchvision.transforms as transforms
from megadetector.detection import run_detector_batch
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = REPO_ROOT / "models"
MEGADETECTOR_PATH = MODELS_DIR / "mdv5a.pt"
SPECIESNET_PATH = MODELS_DIR / "model.pt"
TEST_IMAGES_DIR = MODELS_DIR / "test_images"

LOWER_CONF = 0.05
SNIP_SIZE = 600

CLASSES = [
    "Alectura_lathami", "Antechinus_agilis", "Bos_taurus", "Burhinus_grallarius",
    "Canis_familiaris", "Chalcophaps_longirostris", "Colluricincla_harmonica",
    "Corcorax_melanorhamphos", "Dacelo_novaeguineae", "Dama_dama",
    "Eopsaltria_australis", "Felis_catus", "Geopelia_humeralis",
    "Gymnorhina_tibicen", "Homo_sapiens", "Isoodon_macrourus", "Lepus_europaeus",
    "Macropus_giganteus", "Menura_novaehollandiae", "Mus_musculus",
    "Oryctolagus_cuniculus", "Perameles_nasuta", "Pitta_versicolor", "Rattus",
    "Rattus_fuscipes", "Rattus_rattus", "Strepera_graculina", "Sus_scrofa",
    "Tachyglossus_aculeatus", "Thylogale_stigmatica", "Trichosurus_caninus",
    "Trichosurus_cunninghami", "Trichosurus_vulpecula", "Varanus_varius",
    "Vombatus_ursinus", "Vulpes_vulpes", "Wallabia_bicolor", "Canis_dingo",
    "Capra_hircus", "Casuarius_casuarius", "Heteromyias_cinereifrons",
    "Hypsiprymnodon_moschatus", "Megapodius_reinwardt", "Notamacropus_rufogriseus",
    "Orthonyx_spaldingii", "Uromys_caudimaculatus",
]


@dataclass
class Result:
    image_name: str
    expected: str
    predicted: str | None
    confidence: float
    detection_conf: float
    n_detections: int
    error: str | None = None

    @property
    def matched(self) -> bool:
        return self.predicted == self.expected


def get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def expected_species_from_filename(filename: str) -> str:
    """Strip suffix like _1.JPG or _2.JPG to recover ground-truth label."""
    name = Path(filename).stem
    parts = name.rsplit("_", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return name


def crop_detection(image_path: Path, detection: dict) -> Image.Image:
    img = Image.open(image_path).convert("RGB")
    w_img, h_img = img.size
    x, y, w, h = detection["bbox"]
    left, top = int(x * w_img), int(y * h_img)
    right, bottom = int((x + w) * w_img), int((y + h) * h_img)
    return img.crop((left, top, right, bottom)).resize(
        (SNIP_SIZE, SNIP_SIZE), Image.BILINEAR
    )


def run_pipeline_on_image(
    image_path: Path,
    speciesnet_model: torch.nn.Module,
    transform: transforms.Compose,
    device: str,
) -> Result:
    expected = expected_species_from_filename(image_path.name)

    try:
        results = run_detector_batch.load_and_run_detector_batch(
            image_file_names=[str(image_path)],
            model_file=str(MEGADETECTOR_PATH),
            confidence_threshold=LOWER_CONF,
            quiet=True,
        )
    except Exception as e:
        return Result(image_path.name, expected, None, 0.0, 0.0, 0, f"detection: {e}")

    if not results or "detections" not in results[0]:
        return Result(image_path.name, expected, None, 0.0, 0.0, 0, "no detections")

    animals = [d for d in results[0]["detections"] if d["category"] == "1"]
    if not animals:
        return Result(image_path.name, expected, None, 0.0, 0.0, 0, "no animal class")

    best = max(animals, key=lambda d: d["conf"])

    try:
        crop = crop_detection(image_path, best)
        img_tensor = transform(crop).unsqueeze(0).permute(0, 2, 3, 1).to(device)
        with torch.no_grad():
            logits = speciesnet_model(img_tensor)
            probs = torch.softmax(logits, dim=1)[0].cpu().numpy()
    except Exception as e:
        return Result(image_path.name, expected, None, 0.0, best["conf"], len(animals), f"classify: {e}")

    best_idx = int(np.argmax(probs))
    return Result(
        image_path.name,
        expected,
        CLASSES[best_idx],
        float(probs[best_idx]),
        float(best["conf"]),
        len(animals),
    )


def load_speciesnet(device: str) -> tuple[torch.nn.Module, transforms.Compose]:
    print(f"Loading SpeciesNet on {device}...")
    t0 = time.time()
    model = torch.load(SPECIESNET_PATH, map_location=device, weights_only=False)
    model.eval()
    model.to(device)
    print(f"  loaded in {time.time() - t0:.2f}s")

    transform = transforms.Compose([
        transforms.Resize((480, 480)),
        transforms.ToTensor(),
    ])
    return model, transform


def print_summary(results: list[Result]) -> None:
    print()
    print("=" * 78)
    print(f"{'IMAGE':<40} {'EXPECTED':<26} {'PRED':<26} {'CONF':>6} {'MATCH':>6}")
    print("=" * 78)
    for r in results:
        pred = r.predicted or "(error)"
        match = "YES" if r.matched else "NO"
        print(f"{r.image_name:<40} {r.expected:<26} {pred[:26]:<26} {r.confidence:>6.3f} {match:>6}")
    print("=" * 78)

    n_total = len(results)
    n_match = sum(1 for r in results if r.matched)
    n_errors = sum(1 for r in results if r.error)

    print()
    print(f"ACCURACY:  {n_match}/{n_total} = {100 * n_match / max(n_total, 1):.1f}%")
    if n_errors:
        print(f"ERRORS:    {n_errors}")
        for r in results:
            if r.error:
                print(f"  {r.image_name}: {r.error}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--single", type=str, default=None, help="Run a single image filename")
    args = parser.parse_args()

    print("=" * 60)
    print("AussieEcoLens ML Pipeline - Multi-Image Smoke Test")
    print("=" * 60)
    print(f"Python:      {sys.version.split()[0]}")
    print(f"Torch:       {torch.__version__}")
    print(f"Device:      {get_device()}")
    print()

    if not MEGADETECTOR_PATH.exists() or not SPECIESNET_PATH.exists():
        print("x Model files missing in models/")
        sys.exit(1)

    if args.single:
        image_paths = [TEST_IMAGES_DIR / args.single]
        if not image_paths[0].exists():
            print(f"x Image not found: {image_paths[0]}")
            sys.exit(1)
    else:
        image_paths = sorted(TEST_IMAGES_DIR.glob("*.JPG"))
        if not image_paths:
            print(f"x No images found in {TEST_IMAGES_DIR}")
            sys.exit(1)

    print(f"Testing {len(image_paths)} image(s)")
    print()

    device = get_device()
    speciesnet_model, transform = load_speciesnet(device)

    results: list[Result] = []
    for i, img_path in enumerate(image_paths, 1):
        print(f"[{i}/{len(image_paths)}] {img_path.name}", end=" ", flush=True)
        t0 = time.time()
        r = run_pipeline_on_image(img_path, speciesnet_model, transform, device)
        elapsed = time.time() - t0
        status = "OK" if r.matched else ("ERR" if r.error else "MISS")
        print(f"[{status}] {elapsed:.1f}s  {r.predicted or r.error}")
        results.append(r)

    print_summary(results)


if __name__ == "__main__":
    main()
