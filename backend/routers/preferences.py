from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User, UserPreference
from logger import get_logger

log = get_logger("preferences")

router = APIRouter(prefix="/api/v2/preferences", tags=["preferences"])

# ── Defaults (mirrors Cloud Companion's DEFAULTS object) ─────────────────────

_DEFAULTS: dict = {
    "dateFormat":                "YYYY-MM-DD",
    "dateTimeFormat":            "YYYY-MM-DD HH:mm:ss",
    "numericThousandsSeparator": True,
    "numericDecimalPlaces":      2,
    "nullDisplay":               "",
    "booleanDisplay":            "true/false",
    "maxColumnWidth":            300,
    "autosizeColumns":           True,
    "hideBlankColumns":          False,
    "defaultRowLimit":           500,
    "theme":                     "onyx",
    "dashboardView":             "operational",
    "runNotifications":          True,
    "compactMode":               False,
}


def _merge(stored: dict) -> dict:
    return {**_DEFAULTS, **stored}


class PreferencesPayload(BaseModel):
    dateFormat:                str | None  = None
    dateTimeFormat:            str | None  = None
    numericThousandsSeparator: bool | None = None
    numericDecimalPlaces:      int | None  = None
    nullDisplay:               str | None  = None
    booleanDisplay:            str | None  = None
    maxColumnWidth:            int | None  = None
    autosizeColumns:           bool | None = None
    hideBlankColumns:          bool | None = None
    defaultRowLimit:           int | None  = None
    theme:                     str | None  = None
    dashboardView:             str | None  = None
    runNotifications:          bool | None = None
    compactMode:               bool | None = None


@router.get("")
def get_preferences(
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db),
):
    row = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    stored = row.preferences if row else {}
    return _merge(stored)


@router.put("")
def update_preferences(
    body: PreferencesPayload,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db),
):
    row = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    stored = dict(row.preferences) if row else {}

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    stored.update(updates)

    if row:
        row.preferences = stored
        row.updated_at  = datetime.now(timezone.utc)
    else:
        db.add(UserPreference(user_id=user.id, preferences=stored))

    db.commit()
    log.debug("preferences updated  user=%s  keys=%s", user.id[:8], list(updates.keys()))

    return _merge(stored)
