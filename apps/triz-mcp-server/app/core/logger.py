import json
import logging
import os
import sys
from datetime import datetime, timezone


ERROR_REPORTING_TYPE = (
    "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent"
)


class CloudRunJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "severity": severity(record.levelno),
            "message": record.getMessage(),
            "logger": record.name,
            "service": service_name(),
            "serviceContext": {
                "service": service_name(),
                "version": service_version(),
            },
            "time": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
        }

        if record.exc_info:
            payload["@type"] = ERROR_REPORTING_TYPE
            payload["message"] = (
                f"{record.getMessage()}\n{self.formatException(record.exc_info)}"
            )

        return json.dumps(payload, ensure_ascii=False)


def setup_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(CloudRunJsonFormatter())
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.addHandler(handler)

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "mcp"):
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.propagate = True


def service_name() -> str:
    return os.getenv("K_SERVICE", "triz-mcp-server")


def service_version() -> str:
    return (
        os.getenv("GIT_SHA")
        or os.getenv("K_REVISION")
        or os.getenv("APP_VERSION")
        or "local"
    )


def severity(levelno: int) -> str:
    if levelno >= logging.CRITICAL:
        return "CRITICAL"
    if levelno >= logging.ERROR:
        return "ERROR"
    if levelno >= logging.WARNING:
        return "WARNING"
    if levelno >= logging.DEBUG:
        return "DEBUG"
    return "INFO"
