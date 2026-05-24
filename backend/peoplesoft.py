import time
import httpx
from config import get_settings


def _build_url(base_url: str, endpoint: str) -> str:
    endpoint = endpoint.strip()
    if endpoint.startswith(("http://", "https://")):
        return endpoint
    base = base_url.strip().rstrip("/")
    if endpoint and not endpoint.startswith("/"):
        endpoint = "/" + endpoint
    url = base + endpoint
    if not url.startswith(("http://", "https://")):
        raise ValueError(
            f"Invalid URL '{url}' — Base URL must start with http:// or https://. "
            "Check the Base URL field in Settings."
        )
    return url


def _build_auth(settings):
    if settings.ps_auth_type == "basic":
        return httpx.BasicAuth(settings.ps_username, settings.ps_password), {}
    if settings.ps_auth_type == "bearer":
        return None, {"Authorization": f"Bearer {settings.ps_password}"}
    return None, {}


def trigger_engine(_settings=None) -> dict:
    """POST to endpoint 1. Returns the raw response dict (contains InstanceID)."""
    settings = _settings or get_settings()
    url = _build_url(settings.ps_base_url, settings.ps_endpoint)
    auth, headers = _build_auth(settings)
    body = {"processname": settings.ps_process_name} if settings.ps_process_name else {}

    with httpx.Client(timeout=300, follow_redirects=False) as client:
        response = client.post(url, auth=auth, headers=headers, json=body)

        if response.is_redirect:
            location = response.headers.get("location", "")
            raise httpx.HTTPStatusError(
                f"Authentication failed — PeopleSoft returned a login redirect (302). "
                f"Verify PS_USERNAME, PS_PASSWORD, and PS_AUTH_TYPE in Settings. "
                f"Redirect location: {location}",
                request=response.request,
                response=response,
            )

        response.raise_for_status()
        return response.json()


def poll_status(instance_id: str, _settings=None, max_wait: int = 600, poll_interval: int = 5) -> dict:
    """GET endpoint 2 until STATUS == 'Success' or ReportID present. Returns final response dict."""
    settings = _settings or get_settings()
    base_url = _build_url(settings.ps_base_url, settings.ps_status_endpoint)
    url = f"{base_url.rstrip('/')}/{instance_id}"
    auth, headers = _build_auth(settings)

    elapsed = 0
    with httpx.Client(timeout=30, follow_redirects=False) as client:
        while elapsed < max_wait:
            time.sleep(poll_interval)
            elapsed += poll_interval
            response = client.get(url, auth=auth, headers=headers)
            response.raise_for_status()
            data = response.json()
            report_id = data.get("ReportID", "")
            status = data.get("STATUS", "").lower()
            if report_id or status == "success":
                return data

    raise TimeoutError(
        f"Process did not complete after {max_wait}s (Instance ID: {instance_id})"
    )
