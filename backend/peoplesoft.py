import httpx
from config import get_settings

settings = get_settings()


def _auth() -> httpx.BasicAuth | None:
    if settings.ps_auth_type == "basic":
        return httpx.BasicAuth(settings.ps_username, settings.ps_password)
    return None


def _headers() -> dict:
    if settings.ps_auth_type == "bearer":
        return {"Authorization": f"Bearer {settings.ps_password}"}
    return {}


def trigger_engine() -> dict:
    url = settings.ps_base_url + settings.ps_endpoint
    with httpx.Client(timeout=300) as client:
        response = client.post(url, auth=_auth(), headers=_headers())
        response.raise_for_status()
        return response.json()
