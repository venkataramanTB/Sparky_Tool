import httpx
from config import get_settings


def trigger_engine() -> dict:
    settings = get_settings()
    url = settings.ps_base_url + settings.ps_endpoint

    auth = None
    headers = {}
    if settings.ps_auth_type == "basic":
        auth = httpx.BasicAuth(settings.ps_username, settings.ps_password)
    elif settings.ps_auth_type == "bearer":
        headers = {"Authorization": f"Bearer {settings.ps_password}"}

    with httpx.Client(timeout=300) as client:
        response = client.post(url, auth=auth, headers=headers)
        response.raise_for_status()
        return response.json()
