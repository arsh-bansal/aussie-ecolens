# Tagger Lambda development and deployment Makefile.
#
# Run from this directory:
#     make help            list available targets
#     make build           build the linux/arm64 container image locally
#     make run             run the image locally with the Lambda RIE
#     make test            POST a synthetic S3 event to the running RIE
#     make stop            stop and remove the local RIE container
#     make clean           remove built image
#     make ecr-login       authenticate Docker with our ECR registry
#     make push            tag and push to ECR (requires ECR_REPO env var)

# ---- Configuration --------------------------------------------------------

IMAGE_NAME       := aussie-ecolens-tagger
IMAGE_TAG        := dev
PLATFORM         := linux/arm64
CONTAINER_NAME   := tagger-rie-local
RIE_PORT         := 9000

# Path to repo-level models directory; mounted into the container at runtime
# so local invocations find the .pt files. Production reads from S3 instead.
MODELS_DIR       := $(realpath ../../models)

# AWS configuration (override via environment for push targets)
AWS_REGION       ?= ap-southeast-2
AWS_ACCOUNT_ID   ?=
ECR_REPO         ?= aussie-ecolens-tagger

.DEFAULT_GOAL := help

# ---- Help -----------------------------------------------------------------

.PHONY: help
help:
	@echo "Tagger Lambda — available targets:"
	@echo ""
	@grep -E "^[a-zA-Z0-9_-]+:.*?## .*" $(MAKEFILE_LIST) | \
		sort | awk "BEGIN {FS = \":.*?## \"}; {printf \"  %-15s %s\\n\", \$$1, \$$2}"

# ---- Build ----------------------------------------------------------------

.PHONY: build
build: ## Build the Lambda container image for linux/arm64
	docker buildx build \
		--platform=$(PLATFORM) \
		--provenance=false \
		--tag $(IMAGE_NAME):$(IMAGE_TAG) \
		--load \
		.

.PHONY: build-nocache
build-nocache: ## Rebuild without any cached layers (slow, for debugging)
	docker buildx build \
		--platform=$(PLATFORM) \
		--provenance=false \
		--no-cache \
		--tag $(IMAGE_NAME):$(IMAGE_TAG) \
		--load \
		.

# ---- Local runtime --------------------------------------------------------

.PHONY: run
run: ## Run the image locally via the Lambda Runtime Interface Emulator
	@if [ ! -d "$(MODELS_DIR)" ]; then \
		echo "ERROR: $(MODELS_DIR) does not exist; cannot mount models"; \
		exit 1; \
	fi
	docker run --rm -d \
		--name $(CONTAINER_NAME) \
		-p $(RIE_PORT):8080 \
		-e DRY_RUN=true \
		-e MEGADETECTOR_PATH=/var/task/models/mdv5a.pt \
		-e SPECIESNET_PATH=/var/task/models/model.pt \
		-e AWS_REGION=$(AWS_REGION) \
		-v "$(MODELS_DIR):/var/task/models:ro" \
		$(IMAGE_NAME):$(IMAGE_TAG)
	@echo "RIE listening on http://localhost:$(RIE_PORT)"
	@echo "Run 'make test' to invoke the handler."
	@echo "Run 'make logs' to follow container output."
	@echo "Run 'make stop' when done."

.PHONY: logs
logs: ## Follow logs from the running RIE container
	docker logs -f $(CONTAINER_NAME)

.PHONY: stop
stop: ## Stop and remove the local RIE container
	-docker stop $(CONTAINER_NAME) 2>/dev/null || true

.PHONY: shell
shell: ## Open an interactive shell inside the built image
	docker run --rm -it \
		--entrypoint /bin/bash \
		$(IMAGE_NAME):$(IMAGE_TAG)

# ---- Local test invocation ------------------------------------------------

.PHONY: test
test: ## POST a synthetic S3 event to the local RIE
	@if [ ! -f scripts/lambda_event.json ]; then \
		echo "ERROR: scripts/lambda_event.json missing"; \
		exit 1; \
	fi
	curl -s -X POST \
		"http://localhost:$(RIE_PORT)/2015-03-31/functions/function/invocations" \
		-H "Content-Type: application/json" \
		-d @scripts/lambda_event.json | python3 -m json.tool

# ---- Cleanup --------------------------------------------------------------

.PHONY: clean
clean: stop ## Remove the built image
	-docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true

# ---- ECR (deferred until AWS infra is wired) ------------------------------

.PHONY: ecr-login
ecr-login: ## Authenticate Docker with ECR (requires AWS_ACCOUNT_ID)
	@if [ -z "$(AWS_ACCOUNT_ID)" ]; then \
		echo "ERROR: AWS_ACCOUNT_ID environment variable not set"; \
		exit 1; \
	fi
	aws ecr get-login-password --region $(AWS_REGION) | \
		docker login --username AWS --password-stdin \
		$(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com

.PHONY: push
push: build ecr-login ## Tag and push the image to ECR
	@if [ -z "$(AWS_ACCOUNT_ID)" ]; then \
		echo "ERROR: AWS_ACCOUNT_ID environment variable not set"; \
		exit 1; \
	fi
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) \
		$(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(ECR_REPO):$(IMAGE_TAG)
	docker push $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(ECR_REPO):$(IMAGE_TAG)
	