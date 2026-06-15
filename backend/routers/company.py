import ipaddress
import json
import os
import re
import socket

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from google import genai as _genai
from google.genai import types as _genai_types

from auth import get_current_user
from logger import get_logger

log = get_logger("company")
router = APIRouter(prefix="/api/v2/company", tags=["company"])

_CACHE_MAX    = 500                        # evict oldest when exceeded
_logo_cache:  dict[str, bytes | None] = {} # None means confirmed-missing (404)
_info_cache:  dict[str, dict]         = {}

_PERSONAL_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "outlook.com",
    "hotmail.com", "live.com", "icloud.com", "me.com", "protonmail.com",
    "aol.com", "msn.com", "ymail.com",
}

_VALID_DOMAIN_RE = re.compile(
    r'^(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'
)

_INFO_PROMPT = (
    "You are a factual business data assistant. "
    "Return public information about the company or organisation that owns the domain '{domain}'. "
    "Respond with a single JSON object containing exactly these fields "
    "(use null for any field you cannot confirm publicly): "
    '"name" (full official company name string), '
    '"tagline" (short descriptor of ≤8 words or null), '
    '"industry" (primary industry string, e.g. Technology, Healthcare, or null), '
    '"headquarters" (City, Country string or null), '
    '"founded" (year as integer or null), '
    '"employees" (rough headcount range string like "500–1,000" or null), '
    '"description" (1–2 sentence factual public description string or null). '
    "Return only the JSON object — no markdown, no fences, no extra keys."
)


def _evict(cache: dict, max_size: int) -> None:
    """Remove oldest entries when cache exceeds max_size."""
    if len(cache) >= max_size:
        for key in list(cache.keys())[: max(1, max_size // 4)]:
            cache.pop(key, None)


def _validate_domain(domain: str) -> str:
    """Normalise and validate; raise 422 for invalid/internal domains."""
    domain = domain.lower().strip()
    if not _VALID_DOMAIN_RE.match(domain):
        raise HTTPException(422, "Invalid domain format")
    # Block private / link-local / loopback ranges (SSRF guard)
    try:
        addr = ipaddress.ip_address(socket.gethostbyname(domain))
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            raise HTTPException(422, "Domain resolves to a private or reserved address")
    except (socket.gaierror, ValueError):
        # Domain doesn't resolve yet — allow the request; Clearbit/Gemini will 404/error cleanly
        pass
    return domain


@router.get("/logo")
async def proxy_logo(
    domain: str = Query(..., min_length=1, max_length=253),
    _user=Depends(get_current_user),
):
    """Auth-protected proxy of Clearbit logo — keeps user domains off third-party logs."""
    domain = _validate_domain(domain)

    if domain in _logo_cache:
        cached = _logo_cache[domain]
        if cached is None:
            raise HTTPException(404, "No logo available")
        return Response(content=cached, media_type="image/png",
                        headers={"Cache-Control": "public, max-age=86400"})

    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(
                f"https://logo.clearbit.com/{domain}",
                headers={"User-Agent": "Sparky-Tool/1.0"},
                follow_redirects=True,
            )
        if r.status_code == 200:
            _evict(_logo_cache, _CACHE_MAX)
            _logo_cache[domain] = r.content
            return Response(content=r.content,
                            media_type=r.headers.get("content-type", "image/png"),
                            headers={"Cache-Control": "public, max-age=86400"})
        if r.status_code == 404:
            # Only permanently cache confirmed absences, not network errors
            _evict(_logo_cache, _CACHE_MAX)
            _logo_cache[domain] = None
        raise HTTPException(404, "No logo available")
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("Logo proxy failed for %s: %s", domain, exc)
        # Do NOT cache — let next request retry after a transient failure
        raise HTTPException(502, "Logo fetch failed")


@router.get("/info")
async def get_company_info(
    domain: str = Query(..., min_length=1, max_length=253),
    _user=Depends(get_current_user),
):
    """Return AI-generated public company info for an email domain."""
    domain = _validate_domain(domain)

    if domain in _PERSONAL_DOMAINS:
        raise HTTPException(404, "Personal email domain — no company info")

    if domain in _info_cache:
        return _info_cache[domain]

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(503, "GEMINI_API_KEY not configured")

    try:
        gc = _genai.Client(api_key=api_key, http_options={"timeout": 15_000})
        response = gc.models.generate_content(
            model="gemini-2.0-flash",
            contents=_INFO_PROMPT.format(domain=domain),
            config=_genai_types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
        raw   = (response.text or "").strip()
        clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE)
        data  = json.loads(clean)
        _evict(_info_cache, _CACHE_MAX)
        _info_cache[domain] = data
        log.info("Company info cached for %s", domain)
        return data
    except json.JSONDecodeError as exc:
        log.warning("Company info JSON parse failed for %s: %s", domain, exc)
        raise HTTPException(502, "Failed to parse company info from AI response")
    except Exception as exc:
        log.warning("Company info fetch failed for %s: %s", domain, exc)
        raise HTTPException(502, "Company info fetch failed")
