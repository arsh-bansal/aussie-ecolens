"""Service-layer modules for the Tagger Lambda.

Each service wraps one external dependency (a model, a cloud SDK, etc.)
and exposes a narrow, typed interface that the orchestration layer
composes.
"""
