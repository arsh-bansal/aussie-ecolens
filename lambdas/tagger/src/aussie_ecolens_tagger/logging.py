"""Structured logging setup for the Tagger Lambda.

We use structlog rather than the stdlib logging module because:

1. CloudWatch Logs Insights queries JSON fields natively (field-based
   queries, not regex on plain text), and structlog emits JSON by default
   in production.
2. Per-request context (file key, image id, user sub) attaches to every
   log line within a request without manually threading the values
   through every function call (via ContextVars binding).
3. Local development gets pretty colored output without changing
   application code -- only the rendering processor differs by env.

Usage:
    from aussie_ecolens_tagger.logging import configure_logging, get_logger

    configure_logging()  # call once, at cold start, before any get_logger()
    log = get_logger(__name__)
    log.info("file received", s3_key=key, size_bytes=size)

After configure_logging() has run, every get_logger() returns a
preconfigured BoundLogger. Inside the handler, bind request-scoped
context once and every subsequent log line in the same task carries it:

    structlog.contextvars.bind_contextvars(request_id=event["request_id"])
"""

from __future__ import annotations

import logging
import sys

import structlog

from aussie_ecolens_tagger.config import settings

_configured = False


def configure_logging() -> None:
    """Configure structlog and stdlib logging once at process startup.

    Idempotent: calling more than once is a no-op. The Lambda container
    may invoke the handler many times; we only want to configure once
    (at cold start), so the function guards itself with a module-level
    flag.

    Output format:
    - Lambda / production / any non-TTY stdout: JSON, one record per line.
    - Local TTY: human-readable colored format via ConsoleRenderer.

    The detection happens automatically based on sys.stdout.isatty().
    """
    global _configured
    if _configured:
        return

    is_tty = sys.stdout.isatty()
    level = getattr(logging, settings.log_level, logging.INFO)

    # Configure stdlib logging so any third-party library
    # (boto3, urllib3, megadetector) also emits at the right level
    # and through the same handler.
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
        force=True,
    )

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if is_tty:
        # Local dev: pretty, colored, human readable.
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer(colors=True)
    else:
        # Production: structured JSON per line; CloudWatch parses these
        # natively and Logs Insights can query the fields by name.
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    _configured = True


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a configured BoundLogger.

    If configure_logging() has not yet been called, calls it first.
    This makes get_logger() safe to call from any module-level code
    without worrying about import order.

    Args:
        name: Optional logger name, conventionally __name__ of the caller.
              Surfaces as the "logger" field on every emitted record.

    Returns:
        A structlog BoundLogger ready for .info(), .warning(), .error().
    """
    if not _configured:
        configure_logging()
    return structlog.get_logger(name) if name else structlog.get_logger()
