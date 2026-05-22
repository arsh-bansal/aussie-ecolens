# syntax=docker/dockerfile:1.7
#
# AWS Lambda containerized Tagger.
#
# Architecture:  linux/arm64 (Graviton2) for 20 percent lower cost and
#                13-24 percent faster cold starts vs x86_64.
# Base image:    public.ecr.aws/lambda/python:3.12 (Amazon Linux 2023).
# Build pattern: multi-stage. Stage 1 resolves and installs deps using
#                uv; stage 2 starts fresh and copies only the resolved
#                site-packages + our source. Build toolchain (gcc, etc.)
#                never reaches the runtime image.
#
# Models are not baked in. They live in s3://aussie-ecolens-models/...
# and are lazy-downloaded to /tmp on cold start by the handler.
#
# Build:
#     docker buildx build --platform=linux/arm64 \
#         -t aussie-ecolens-tagger:dev --load .
#
# Run locally with the Lambda Runtime Interface Emulator:
#     docker run --rm -p 9000:8080 \
#         -e DRY_RUN=true \
#         -e MEGADETECTOR_PATH=/var/task/models/mdv5a.pt \
#         -e SPECIESNET_PATH=/var/task/models/model.pt \
#         -v "$(pwd)/../../models:/var/task/models:ro" \
#         aussie-ecolens-tagger:dev

# ============================================================================
# Stage 1: builder
# ============================================================================
FROM --platform=linux/arm64 public.ecr.aws/lambda/python:3.12 AS builder

# Install build deps that some Python wheels compile from source.
# microdnf is symlinked as dnf on AL2023.
RUN dnf install -y gcc gcc-c++ make && dnf clean all

# Pull a pinned uv binary instead of installing via pip. The official
# image at ghcr.io/astral-sh/uv is a thin layer containing only the
# static binary; it does not bring its own Python or pip. Version
# pinned to match the host environment for reproducible builds.
COPY --from=ghcr.io/astral-sh/uv:0.11.15 /uv /uv

WORKDIR /build

# Copy only the dep manifests and project metadata first so changes
# to source code do not invalidate this layer (Docker layer cache).
COPY pyproject.toml uv.lock README.md ./

# Stub out the package source so uv sync succeeds during dep resolution.
# We need a real src/aussie_ecolens_tagger/ tree because the project
# itself is declared as a dep (via hatchling editable install).
RUN mkdir -p src/aussie_ecolens_tagger && \
    touch src/aussie_ecolens_tagger/__init__.py

# Resolve and install ALL production deps into a venv at /build/.venv.
# --frozen ensures we use uv.lock exactly (no resolution drift).
# --no-dev excludes pytest, ruff, mypy.
RUN /uv sync --frozen --no-dev

# Strip the GUI version of opencv that megadetector pulls in. We pin
# opencv-python-headless ourselves; the full opencv-python adds ~100MB
# of X11/Qt deps that cannot be used in Lambda anyway.
RUN /build/.venv/bin/python -m pip uninstall -y opencv-python || true

# Strip dev/visualization tooling that megadetector pulls transitively
# but we do not use at runtime. Aggressive size reduction = faster
# cold-start image pulls from ECR.
RUN /build/.venv/bin/python -m pip uninstall -y \
        seaborn matplotlib ipython jedi parso pexpect prompt-toolkit \
        ptyprocess pure-eval stack-data tensorboard tensorboard-data-server \
        wcwidth || true

# ============================================================================
# Stage 2: runtime
# ============================================================================
FROM --platform=linux/arm64 public.ecr.aws/lambda/python:3.12

# Copy ONLY the resolved venv from the builder. The build toolchain
# (gcc, make, uv) is left behind in the discarded builder stage.
COPY --from=builder /build/.venv /var/task/.venv

# Add the venv site-packages to PYTHONPATH so Lambda's Python finds
# our deps without modifying its own site-packages.
ENV PYTHONPATH=/var/task/.venv/lib/python3.12/site-packages

# Copy the actual application source last so iterative edits during
# development only invalidate this small layer, not the heavy dep
# install above.
COPY src/aussie_ecolens_tagger/ /var/task/aussie_ecolens_tagger/

# Lambda expects the handler as <module>.<function>.
CMD ["aussie_ecolens_tagger.handler.lambda_handler"]
