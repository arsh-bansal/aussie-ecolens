# Dependency security review — 2026-10-01 UTC

The frontend, query API, notifier, replicator and thumbnailer dependency graphs are patched and audit clean. The tagger updates ONNX, Pillow, pydantic-settings, urllib3 and the paired CPU PyTorch/torchvision dependencies. Existing unit tests exercise orchestration with fake models; they do not establish trained-model prediction parity.

## Tagger release gate

The prior PyTorch 2.12 / torchvision 0.27 combination passed the 26-image ground-truth smoke test. The patched 2.13 / 0.28 combination must pass `lambdas/tagger/smoke_test.py` using the trusted `models/model.pt`, `models/mdv5a.pt`, and all 26 `models/test_images` before release. These private artifacts are absent from the audit checkout. Keep this update in draft until that check and the Linux arm64 container check pass.

## Remaining upstream packaging advisory

The current MegaDetector package requires `setuptools<82`, while [GHSA-h35f-9h28-mq5c](https://github.com/advisories/GHSA-h35f-9h28-mq5c) is fixed in setuptools 83. The advisory covers exclusion bypass when building a source distribution on macOS normalization-preserving filesystems, which can publish excluded files. The tagger runs in a Linux Lambda container and its own package is built by Hatchling with `Private :: Do Not Upload`; this path does not build or publish a setuptools source distribution. The advisory remains visible in the raw audit. Do not bypass MegaDetector’s compatibility constraint; update the upstream dependency when it supports patched setuptools, and re-evaluate before any macOS source-distribution publishing.

## Validation boundaries

The frontend’s existing `next lint` command prompts for an ESLint configuration because none is committed. Type checking and static production export are the available frontend checks. API compatibility checks use generated, ephemeral RSA keys and mocked JWKS, never live Cognito credentials. No cloud deployment or production database access is part of this review.
