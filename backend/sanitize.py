"""Input sanitisation helpers for config fields."""
import re

_WHITESPACE = re.compile(r"\s+")


def strip_all_whitespace(value: str | None) -> str:
    """Remove ALL whitespace (internal included) from a value.

    URLs, endpoints and PeopleSoft process names never legitimately contain
    whitespace; any present is a paste artifact (e.g. text wrapped in an email
    inserting spaces mid-name).
    """
    return _WHITESPACE.sub("", value) if value else ""
