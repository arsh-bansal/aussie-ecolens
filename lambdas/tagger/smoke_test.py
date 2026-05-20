"""Smoke test for the AussieEcoLens ML pipeline.

Verifies end-to-end that:
  1. MegaDetector loads and detects animals in a known wildlife image
  2. SpeciesNet loads and classifies the cropped detection
  3. The pipeline produces a sensible species prediction matching
     the ground-truth label in the filename

NOT production code — this is a one-shot verification script.

Run from lambdas/tagger/:
    uv run python smoke_test.py
"""

import sys
import time
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

TEST_IMAGE_NAME = "Casuarius_casuarius_1.JPG"
TEST_IMAGE_PATH = MODELS_DIR / "test_images" / TEST_IMAGE_NAME

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


def get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def verify_setup() -> None:
    print("=" * 60)
    print("SMOKE TEST: AussieEcoLens ML Pipeline")
    print("=" * 60)
    print(f"Python:      {sys.version.split()[0]}")
    print(f"Torch:       {torch.__version__}")
    print(f"Device:      {get_device()}")
    print(f"Test image:  {TEST_IMAGE_NAME}")
    expected = TEST_IMAGE_NAME.replace("_1.JPG", "").replace("_2.JPG", "")
    print(f"Expected:    {expected}")
    print()

    if not MEGADETECTOR_PATH.exists():
        print(f"x MegaDetector missing at {MEGADETECTOR_PATH}")
        sys.exit(1)
    print(f"ok MegaDetector: {MEGADETECTOR_PATH.stat().st_size / 1e6:.1f} MB")

    if not SPECIESNET_PATH.exists():
        print(f"x SpeciesNet missing at {SPECIESNET_PATH}")
        sys.exit(1)
    print(f"ok SpeciesNet:   {SPECIESNET_PATH.stat().st_size / 1e6:.1f} MB")

    if not TEST_IMAGE_PATH.exists():
        print(f"x Test image missing at {TEST_IMAGE_PATH}")
        sys.exit(1)
    print(f"ok Test image:   {TEST_IMAGE_PATH.stat().st_size / 1e3:.1f} KB")
    print()


def run_megadetector(image_path: Path) -> list:
    print("Step 1: Running MegaDetector...")
    t0 = time.time()
    results = run_detector_batch.load_and_run_detector_batch(
        image_file_names=[str(image_path)],
        model_file=str(MEGADETECTOR_PATH),
        confidence_threshold=LOWER_CONF,
    )
    print(f"  Done in {time.time() - t0:.2f}s")

    if not results or "detections" not in results[0]:
        print(f"  x Unexpected result shape: {results}")
        return []

    detections = results[0]["detections"]
    animals = [d for d in detections if d["category"] == "1"]
    print(f"  Found {len(detections)} total, {len(animals)} animals")
    for i, d in enumerate(animals):
        print(f"  [{i}] conf={d['conf']:.3f}  bbox={d['bbox']}")
    return animals


def crop_detection(image_path: Path, detection: dict) -> Image.Image:
    img = Image.open(image_path).convert("RGB")
    w_img, h_img = img.size
    x, y, w, h = detection["bbox"]
    left, top = int(x * w_img), int(y * h_img)
    right, bottom = int((x + w) * w_img), int((y + h) * h_img)
    return img.crop((left, top, right, bottom)).resize(
        (SNIP_SIZE, SNIP_SIZE), Image.BILINEAR
    )


def classify(crop: Image.Image, device: str) -> tuple[str, float]:
    print()
    print("Step 2: Running SpeciesNet...")
    t0 = time.time()
    model = torch.load(SPECIESNET_PATH, map_location=device, weights_only=False)
    model.eval()
    model.to(device)
    print(f"  Loaded in {time.time() - t0:.2f}s")

    transform = transforms.Compose([
        transforms.Resize((480, 480)),
        transforms.ToTensor(),
    ])

    t1 = time.time()
    img_tensor = transform(crop).unsqueeze(0).permute(0, 2, 3, 1).to(device)
    with torch.no_grad():
        logits = model(img_tensor)
        probs = torch.softmax(logits, dim=1)[0].cpu().numpy()
    print(f"  Inference in {time.time() - t1:.2f}s")

    order = np.argsort(probs)[::-1]
    print()
    print("  Top 5:")
    for idx in order[:5]:
        print(f"    {CLASSES[idx]:<30} {probs[idx]:.4f}")

    best = int(order[0])
    return CLASSES[best], float(probs[best])


def main() -> None:
    verify_setup()

    detections = run_megadetector(TEST_IMAGE_PATH)
    if not detections:
        print("x No animal detections")
        sys.exit(1)

    best = max(detections, key=lambda d: d["conf"])
    print(f"\n  Using best detection: conf={best['conf']:.3f}")

    crop = crop_detection(TEST_IMAGE_PATH, best)
    species, conf = classify(crop, get_device())

    expected = TEST_IMAGE_NAME.replace("_1.JPG", "").replace("_2.JPG", "")
    matched = species == expected

    print()
    print("=" * 60)
    print(f"PREDICTION:  {species}")
    print(f"CONFIDENCE:  {conf:.4f}")
    print(f"EXPECTED:    {expected}")
    print(f"MATCH:       {'YES' if matched else 'NO'}")
    print("=" * 60)


if __name__ == "__main__":
    main()
