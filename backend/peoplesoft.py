import re as _re
import time
import httpx
from config import get_settings
from logger import get_logger
from sanitize import strip_all_whitespace as _strip_ws

log = get_logger("peoplesoft")


def _ps_error_body(response) -> str:
    """Extract a meaningful error string from a PS 5xx response body.
    Returns empty string when the body is absent/HTML (transient startup noise)."""
    try:
        text = response.text.strip()
    except Exception:
        return ""
    if not text or text.startswith("<"):
        return ""
    try:
        data = response.json()
        return (
            data.get("errorMessage")
            or data.get("message")
            or data.get("detail")
            or text
        )
    except Exception:
        return text


def _build_url(base_url: str, endpoint: str) -> str:
    endpoint = _strip_ws(endpoint)
    if endpoint.startswith(("http://", "https://")):
        return endpoint
    base = _strip_ws(base_url).rstrip("/")
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


def _reauth(client: httpx.Client, settings) -> None:
    """Recover from a session expiry (302 redirect) during polling.

    Clears stale cookies so the next request re-sends credentials and lets
    PeopleSoft issue a fresh session.  If a dedicated login endpoint is
    configured (ps_login_endpoint), an explicit login POST is performed first.
    """
    client.cookies.clear()
    login_ep = getattr(settings, "ps_login_endpoint", "") or ""
    if login_ep:
        login_url = _build_url(settings.ps_base_url, login_ep)
        auth, extra_headers = _build_auth(settings)
        try:
            r = client.post(login_url, auth=auth, headers=extra_headers, follow_redirects=True)
            log.info("Re-auth via login endpoint  HTTP %s", r.status_code)
        except Exception as exc:
            log.warning("Re-auth login request failed (will still retry poll): %s", exc)
    else:
        log.info(
            "Session cookies cleared — credentials will be re-sent on next poll request "
            "(set ps_login_endpoint in Settings to use an explicit login step)"
        )


def trigger_engine(
    _settings=None,
    max_retries: int = 6,
    retry_delay: int = 10,
    *,
    client: httpx.Client | None = None,
) -> dict:
    """POST to the PeopleSoft trigger endpoint and return the JSON response.

    Pass *client* to share a session (and its cookie jar) with :func:`poll_status`.
    When *client* is None a private client is created and closed automatically.
    """
    settings = _settings or get_settings()
    url = _build_url(settings.ps_base_url, settings.ps_endpoint)
    auth, headers = _build_auth(settings)
    body = {"processname": settings.ps_process_name} if settings.ps_process_name else {}

    log.info("Triggering PeopleSoft engine  POST %s  (process: %s)", url, settings.ps_process_name)

    _own_client = client is None
    if _own_client:
        client = httpx.Client(timeout=300, follow_redirects=False)
    try:
        for attempt in range(1, max_retries + 1):
            t0 = time.time()
            response = client.post(url, auth=auth, headers=headers, json=body)
            elapsed = round((time.time() - t0) * 1000)

            if response.is_redirect:
                location = response.headers.get("location", "")
                log.warning("PeopleSoft trigger returned redirect → %s (auth failure?)", location)
                raise httpx.HTTPStatusError(
                    f"Authentication failed — PeopleSoft returned a login redirect (302). "
                    f"Verify PS_USERNAME, PS_PASSWORD, and PS_AUTH_TYPE in Settings. "
                    f"Redirect location: {location}",
                    request=response.request,
                    response=response,
                )

            log.info(
                "PeopleSoft trigger  attempt=%d/%d  HTTP %s  (%d ms)",
                attempt, max_retries, response.status_code, elapsed,
            )

            if response.status_code >= 500:
                err_body = _ps_error_body(response)
                if err_body:
                    # PS returned a real error message — retrying won't help
                    log.error("Trigger HTTP %s — PS error: %s  url=%s", response.status_code, err_body, url)
                    raise httpx.HTTPStatusError(
                        f"PeopleSoft returned HTTP {response.status_code} — {err_body} (url: {url})",
                        request=response.request, response=response,
                    )
                # Empty body — likely transient startup, retry
                if attempt < max_retries:
                    log.warning(
                        "Trigger returned HTTP %s with empty body — PS may still be starting "
                        "(attempt %d/%d), retrying in %ds",
                        response.status_code, attempt, max_retries, retry_delay,
                    )
                    time.sleep(retry_delay)
                    continue
                response.raise_for_status()

            if response.status_code >= 400:
                err_body = _ps_error_body(response) or response.text.strip()
                raise httpx.HTTPStatusError(
                    f"PeopleSoft returned HTTP {response.status_code}"
                    + (f" — {err_body}" if err_body else "")
                    + f" (url: {url})",
                    request=response.request, response=response,
                )
            data = response.json()
            log.info("Trigger complete — InstanceID: %s", data.get("InstanceID", "(none)"))
            return data
    finally:
        if _own_client:
            client.close()

    raise TimeoutError(f"PeopleSoft trigger did not succeed after {max_retries} attempts")


def poll_status(
    instance_id: str,
    _settings=None,
    max_wait: int = 600,
    poll_interval: int = 5,
    *,
    client: httpx.Client | None = None,
) -> dict:
    """Poll the PeopleSoft status endpoint until the process completes.

    Pass *client* (the same one used for :func:`trigger_engine`) so that session
    cookies from the trigger response are reused here.  If the session expires
    mid-poll (PeopleSoft returns a 302 redirect), the session is renewed and the
    request retried once before raising an error.
    """
    settings = _settings or get_settings()
    status_ep = _re.sub(r"/?\{[^}]+\}$", "", (settings.ps_status_endpoint or "").rstrip("/"))
    base_url = _build_url(settings.ps_base_url, status_ep)
    url = f"{base_url.rstrip('/')}/{instance_id}" if instance_id else base_url.rstrip("/")
    auth, headers = _build_auth(settings)
    log.info("Polling status  GET %s  (max wait: %ds, interval: %ds)", url, max_wait, poll_interval)
    elapsed = 0

    _own_client = client is None
    if _own_client:
        client = httpx.Client(timeout=30, follow_redirects=False)
    try:
        while elapsed < max_wait:
            time.sleep(poll_interval)
            elapsed += poll_interval
            t0 = time.time()
            response = client.get(url, auth=auth, headers=headers, timeout=30)
            rtt = round((time.time() - t0) * 1000)

            # 302 during polling = PeopleSoft session expired.
            # Re-authenticate and retry this one poll request.
            if response.is_redirect:
                location = response.headers.get("location", "")
                log.warning(
                    "Poll [%3ds elapsed] session expired (302 → %s) — re-authenticating and retrying",
                    elapsed, location,
                )
                _reauth(client, settings)
                response = client.get(url, auth=auth, headers=headers, timeout=30)
                if response.is_redirect:
                    raise httpx.HTTPStatusError(
                        f"PeopleSoft session could not be renewed — still redirecting after re-auth "
                        f"(redirect → {response.headers.get('location', '')}). "
                        f"Check credentials in Settings.",
                        request=response.request,
                        response=response,
                    )

            # PeopleSoft returns 5xx while the process is still queued or starting up.
            # Even error bodies like "Method GET not found" are transient — PS emits them
            # before the new instance is queryable. Keep retrying until max_wait.
            if response.status_code >= 500:
                body = _ps_error_body(response)
                log.warning(
                    "Poll [%3ds elapsed]  HTTP %s — process still starting%s, will retry  (%d ms)",
                    elapsed, response.status_code,
                    f": {body}" if body else "",
                    rtt,
                )
                continue

            if response.status_code >= 400:
                body = _ps_error_body(response) or response.text.strip()
                raise httpx.HTTPStatusError(
                    f"PeopleSoft returned HTTP {response.status_code}"
                    + (f" — {body}" if body else "")
                    + f" (url: {url})",
                    request=response.request, response=response,
                )

            data = response.json()
            report_id = data.get("ReportID", "")
            status = data.get("STATUS", "")
            log.info(
                "Poll [%3ds elapsed]  HTTP %s  STATUS=%r  ReportID=%r  (%d ms)",
                elapsed, response.status_code, status, report_id, rtt,
            )
            if report_id or status.lower() == "success":
                log.info("Poll complete — ReportID: %s  STATUS: %s", report_id, status)
                return data
    finally:
        if _own_client:
            client.close()

    raise TimeoutError(
        f"Process did not complete after {max_wait}s (Instance ID: {instance_id})"
    )
