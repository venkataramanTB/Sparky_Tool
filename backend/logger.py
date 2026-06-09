import json
import logging
import sys
import os


class _JsonFormatter(logging.Formatter):
    """Emit each log record as a single-line JSON object for structured log aggregators."""
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts":      self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def setup_logging() -> logging.Logger:
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    use_json = os.environ.get("LOG_FORMAT", "").lower() == "json"

    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        if use_json:
            handler.setFormatter(_JsonFormatter())
        else:
            fmt = "%(asctime)s | %(levelname)-8s | %(name)-28s | %(message)s"
            handler.setFormatter(logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S"))
        root.addHandler(handler)
    root.setLevel(level)

    # Suppress noisy third-party loggers
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "httpx", "paramiko"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return logging.getLogger("sparky")


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"sparky.{name}")
