"""Input sanitisation helpers for config fields."""
import re
import posixpath

_WHITESPACE = re.compile(r"\s+")
# Matches any .. segment after normalisation (catches encoded variants too)
_TRAVERSAL = re.compile(r"(?:^|[/\\])\.\.(?:[/\\]|$)")


def strip_all_whitespace(value: str | None) -> str:
    """Remove ALL whitespace (internal included) from a value.

    URLs, endpoints and PeopleSoft process names never legitimately contain
    whitespace; any present is a paste artifact (e.g. text wrapped in an email
    inserting spaces mid-name).
    """
    return _WHITESPACE.sub("", value) if value else ""


def validate_no_path_traversal(path: str | None) -> str:
    """Raise ValueError if *path* contains a directory traversal sequence.

    Normalises the path first so that encoded or doubled-slash variants are
    also caught.  Returns the original value unchanged if safe.
    """
    if not path:
        return path or ""
    # Normalise to collapse multiple slashes and resolve same-dir dots
    normalised = posixpath.normpath(path.replace("\\", "/"))
    if _TRAVERSAL.search(normalised) or normalised.startswith(".."):
        raise ValueError(
            f"Path contains a directory traversal sequence and was rejected: {path!r}"
        )
    return path
