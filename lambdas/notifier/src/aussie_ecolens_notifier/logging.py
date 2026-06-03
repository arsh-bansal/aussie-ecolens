"""Structured logging for the Notifier Lambda (structlog).

Mirrors the tagger's logging setup so log output is consistent across the
project's Lambdas: JSON one-record-per-line in production (CloudWatch Logs
Insights queries the fields natively), pretty colored output on a local
TTY. Configure once at cold start; get_logger() is safe to call from any
module afterwards.
"""

from __future__ import annotations

import logging
import sys

import structlog

from aussie_ecolens_notifier.config import settings

_configured = False


def configure_logging() -> None:
    """Configure structlog + stdlib logging once at process startup.

    Idempotent. JSON output off a TTY (production/Lambda), colored console
    output on a TTY (local dev). Detection is automatic via isatty().
    """
    global _configured
    if _configured:
        return

    is_tty = sys.stdout.isatty()
    level = getattr(logging, settings.log_level, logging.INFO)

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
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer(colors=True)
    else:
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
    """Return a configured BoundLogger (configures logging on first use)."""
    if not _configured:
        configure_logging()
    return structlog.get_logger(name) if name else structlog.get_logger()
