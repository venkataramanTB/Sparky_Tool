import os
import time
import datetime
import httpx
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from encrypt import decrypt
from models import User, UserConfig
from logger import get_logger

log = get_logger("insights")
router = APIRouter(prefix="/api/v2/insights", tags=["insights"])

# backend/routers/insights.py  →  ../Output Files
_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "Output Files")


# ── helpers ────────────────────────────────────────────────────────────────────

def _list_corehr_files() -> list[dict]:
    """Return metadata for every .csv in Output Files/, newest first."""
    if not os.path.isdir(_OUTPUT_DIR):
        return []
    files = []
    for name in os.listdir(_OUTPUT_DIR):
        if not name.lower().endswith(".csv"):
            continue
        full = os.path.join(_OUTPUT_DIR, name)
        stat = os.stat(full)
        files.append({
            "filename":    name,
            "modified_at": stat.st_mtime,
            "size_bytes":  stat.st_size,
        })
    files.sort(key=lambda f: f["modified_at"], reverse=True)
    for f in files:
        f["modified_at"] = datetime.datetime.fromtimestamp(
            f["modified_at"], tz=datetime.timezone.utc
        ).isoformat()
    return files


def _parse_corehr_file(filename: str) -> dict:
    """
    Parse a CoreHR Discovery CSV into structured sections.

    File structure:
      Header block (asterisks / run metadata)
      **Countries implemented**
        KEY : ,VALUE   (space-key-space-colon-comma-value)
      ----  (first separator)
        KEY,VALUE      (modules Y/N  or  parameters)
      ----  (second separator)
        BU header row
        BU data rows (CODE,,Description)
    """
    safe_name = os.path.basename(filename)          # prevent path traversal
    full_path = os.path.join(_OUTPUT_DIR, safe_name)
    if not os.path.isfile(full_path):
        raise HTTPException(404, f"File not found: {safe_name}")

    with open(full_path, encoding="utf-8", errors="replace") as fh:
        lines = fh.read().splitlines()

    run_date          = ""
    company           = ""
    countries:  dict  = {}
    modules:    dict  = {}
    parameters: dict  = {}
    business_units    = []

    STATE_HEADER    = "header"
    STATE_COUNTRIES = "countries"
    STATE_MOD_PARAMS= "mod_params"
    STATE_BU_HEADER = "bu_header"
    STATE_BU_DATA   = "bu_data"

    state           = STATE_HEADER
    separator_count = 0

    for raw_line in lines:
        stripped = raw_line.strip()

        # Run Date Time appears in the header block
        if "Run Date Time" in raw_line and ":" in raw_line:
            run_date = raw_line.split(":", 1)[1].strip()
            continue

        # Section marker for Countries
        if "Countries implemented" in raw_line:
            state = STATE_COUNTRIES
            continue

        # Separator lines advance the state machine
        if stripped.startswith("---"):
            separator_count += 1
            if separator_count == 1:
                state = STATE_MOD_PARAMS
            elif separator_count == 2:
                state = STATE_BU_HEADER
            continue

        # Skip blank, asterisk-only, or whitespace-only lines
        if not stripped or all(c in "*= \t" for c in stripped):
            continue

        if state == STATE_COUNTRIES:
            # Format: " COMPANY : ,SHD"  or  " USA : ,Y"
            if " : ," in raw_line:
                key, val = raw_line.split(" : ,", 1)
                key = key.strip()
                val = val.strip()
                if key == "COMPANY":
                    company = val
                elif key != "COUNTRY":          # skip the COUNTRY label row
                    countries[key] = (val.upper() == "Y")

        elif state == STATE_MOD_PARAMS:
            # Format: "Benefits Administration,Y"  or  "To Currency,USD"
            if "," in stripped:
                key, val = stripped.split(",", 1)
                key = key.strip()
                val = val.strip()
                if not key:
                    continue
                if val.upper() in ("Y", "N"):
                    modules[key] = (val.upper() == "Y")
                else:
                    parameters[key] = val

        elif state == STATE_BU_HEADER:
            # Skip the column-header row, then move to data
            state = STATE_BU_DATA

        elif state == STATE_BU_DATA:
            # Format: "SHAND,,UF Health"
            parts = [p.strip() for p in stripped.split(",")]
            if parts and parts[0]:
                business_units.append({
                    "code":        parts[0],
                    "active":      parts[1] if len(parts) > 1 else "",
                    "description": parts[2] if len(parts) > 2 else "",
                })

    return {
        "run_date":       run_date,
        "company":        company,
        "countries":      countries,
        "modules":        modules,
        "parameters":     parameters,
        "business_units": business_units,
    }


# ── endpoints ──────────────────────────────────────────────────────────────────

@router.get("/corehr/files")
def list_corehr_files(user: User = Depends(get_current_user)):
    """List all CoreHR Discovery CSV files available for viewing."""
    files = _list_corehr_files()
    log.debug("list_corehr_files  user=%s  count=%d", user.id[:8], len(files))
    return {"files": files}


@router.get("/corehr/file")
def get_corehr_file(
    filename: str = Query(..., description="Filename from /corehr/files"),
    user: User = Depends(get_current_user),
):
    """Parse and return a single CoreHR Discovery file."""
    log.debug("get_corehr_file  user=%s  file=%s", user.id[:8], filename)
    return _parse_corehr_file(filename)


@router.get("/health")
def check_health(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Live connectivity check for the calling user's most-recently-updated
    active config.  Tests PeopleSoft (HTTP GET) and Windows Server.
    """
    config: UserConfig | None = (
        db.query(UserConfig)
        .filter(UserConfig.user_id == user.id, UserConfig.is_active == True)  # noqa: E712
        .order_by(UserConfig.updated_at.desc())
        .first()
    )

    if not config:
        return {
            "peoplesoft": {"status": "no_config"},
            "windows":    {"status": "no_config"},
        }

    result = {}

    # ── PeopleSoft ────────────────────────────────────────────────────────────
    ps_url = (config.ps_base_url or "").strip()
    if ps_url:
        t0 = time.time()
        try:
            with httpx.Client(timeout=5.0) as client:
                client.get(ps_url)
            result["peoplesoft"] = {
                "status":     "ok",
                "latency_ms": round((time.time() - t0) * 1000),
            }
        except Exception as exc:
            result["peoplesoft"] = {"status": "error", "error": str(exc)[:120]}
    else:
        result["peoplesoft"] = {"status": "not_configured"}

    # ── Windows Server ────────────────────────────────────────────────────────
    win_host = (config.win_host or "").strip()
    if win_host:
        win_pass = decrypt(config.win_password_enc) if config.win_password_enc else ""
        t0 = time.time()
        try:
            ctype = config.win_connection_type or "winrm"
            if ctype == "smb":
                import smb_client
                smb_client.test_connection(
                    win_host, config.win_username, win_pass,
                    share=config.win_share or "C$",
                    domain=config.win_domain or "",
                    port=config.win_port or 445,
                )
            elif ctype == "ssh":
                import win_ssh_client
                win_ssh_client.test_connection(
                    win_host, config.win_username, win_pass,
                    port=config.win_port or 22,
                )
            else:
                import windows_client
                windows_client.test_connection(
                    win_host, config.win_username, win_pass,
                    config.win_port or 5985,
                    config.win_use_ssl or False,
                    config.win_auth_type or "ntlm",
                )
            result["windows"] = {
                "status":     "ok",
                "latency_ms": round((time.time() - t0) * 1000),
            }
        except Exception as exc:
            result["windows"] = {"status": "error", "error": str(exc)[:120]}
    else:
        result["windows"] = {"status": "not_configured"}

    log.debug(
        "check_health  user=%s  ps=%s  win=%s",
        user.id[:8], result["peoplesoft"]["status"], result["windows"]["status"],
    )
    return result
