from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from database import get_db
from models import User, AiConversation, AiMessage, AiModel
from logger import get_logger

log = get_logger("conversations")

router = APIRouter(prefix="/api/v2/conversations", tags=["conversations"])

# ── Cost estimation per million tokens (conservative mid-tier rates) ──────────

_COST_PER_M: dict[str, dict[str, float]] = {
    "gemini":    {"prompt": 0.075, "completion": 0.30},
    "openai":    {"prompt": 5.0,   "completion": 15.0},
    "anthropic": {"prompt": 3.0,   "completion": 15.0},
    "grok":      {"prompt": 5.0,   "completion": 15.0},
    "generic":   {"prompt": 1.0,   "completion": 1.0},
}


def estimate_cost(provider: str, prompt_tokens: int, completion_tokens: int) -> float:
    rates = _COST_PER_M.get(provider, _COST_PER_M["generic"])
    return (prompt_tokens * rates["prompt"] + completion_tokens * rates["completion"]) / 1_000_000


# ── Serializers ───────────────────────────────────────────────────────────────

def _serialize_conv(c: AiConversation, message_count: int = 0) -> dict:
    return {
        "id":                      c.id,
        "title":                   c.title,
        "provider":                c.provider,
        "model_id_str":            c.model_id_str,
        "total_prompt_tokens":     c.total_prompt_tokens or 0,
        "total_completion_tokens": c.total_completion_tokens or 0,
        "total_reasoning_tokens":  c.total_reasoning_tokens or 0,
        "total_cached_tokens":     c.total_cached_tokens or 0,
        "total_tokens":            c.total_tokens or 0,
        "estimated_cost_usd":      float(c.estimated_cost_usd) if c.estimated_cost_usd else 0.0,
        "message_count":           message_count,
        "created_at":              c.created_at,
        "updated_at":              c.updated_at,
    }


def _serialize_message(m: AiMessage) -> dict:
    return {
        "id":                m.id,
        "conversation_id":   m.conversation_id,
        "role":              m.role,
        "content":           m.content,
        "prompt_tokens":     m.prompt_tokens or 0,
        "completion_tokens": m.completion_tokens or 0,
        "reasoning_tokens":  m.reasoning_tokens or 0,
        "cached_tokens":     m.cached_tokens or 0,
        "total_tokens":      m.total_tokens or 0,
        "ttft_ms":           m.ttft_ms,
        "created_at":        m.created_at,
    }


# ── List user's conversations ─────────────────────────────────────────────────

@router.get("")
def list_conversations(
    limit:  int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db),
):
    q = db.query(AiConversation).filter(AiConversation.user_id == user.id)
    total = q.count()
    convs = q.order_by(AiConversation.updated_at.desc()).offset(offset).limit(limit).all()

    # Batch message counts
    conv_ids = [c.id for c in convs]
    counts_raw = (
        db.query(AiMessage.conversation_id, func.count(AiMessage.id))
        .filter(AiMessage.conversation_id.in_(conv_ids))
        .group_by(AiMessage.conversation_id)
        .all()
    ) if conv_ids else []
    counts = {cid: cnt for cid, cnt in counts_raw}

    return {
        "total": total,
        "items": [_serialize_conv(c, counts.get(c.id, 0)) for c in convs],
    }


# ── Get conversation with messages ────────────────────────────────────────────

@router.get("/{conv_id}")
def get_conversation(
    conv_id: int,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db),
):
    c = db.query(AiConversation).filter(
        AiConversation.id == conv_id, AiConversation.user_id == user.id
    ).first()
    if not c:
        raise HTTPException(404, "Conversation not found")

    messages = (
        db.query(AiMessage)
        .filter(AiMessage.conversation_id == conv_id)
        .order_by(AiMessage.created_at.asc())
        .all()
    )
    return {
        **_serialize_conv(c, len(messages)),
        "messages": [_serialize_message(m) for m in messages],
    }


# ── Delete conversation ───────────────────────────────────────────────────────

@router.delete("/{conv_id}", status_code=204)
def delete_conversation(
    conv_id: int,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db),
):
    c = db.query(AiConversation).filter(
        AiConversation.id == conv_id, AiConversation.user_id == user.id
    ).first()
    if not c:
        raise HTTPException(404, "Conversation not found")
    db.delete(c)
    db.commit()
    log.info("conversation deleted  id=%d  user=%s", conv_id, user.id[:8])


# ── Admin: all conversations ──────────────────────────────────────────────────

@router.get("/admin/all")
def admin_list_conversations(
    limit:  int = Query(200, le=500),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    total = db.query(func.count(AiConversation.id)).scalar()
    convs = (
        db.query(AiConversation)
        .order_by(AiConversation.updated_at.desc())
        .offset(offset).limit(limit).all()
    )
    user_ids = {c.user_id for c in convs}
    user_map = {
        u.id: u.email
        for u in db.query(User.id, User.email).filter(User.id.in_(user_ids)).all()
    }
    return {
        "total": total,
        "items": [
            {**_serialize_conv(c), "user_email": user_map.get(c.user_id, "")}
            for c in convs
        ],
    }


# ── Admin: aggregate token / cost stats ──────────────────────────────────────

@router.get("/admin/stats")
def admin_token_stats(
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    row = db.query(
        func.sum(AiConversation.total_prompt_tokens).label("prompt"),
        func.sum(AiConversation.total_completion_tokens).label("completion"),
        func.sum(AiConversation.total_tokens).label("total"),
        func.sum(AiConversation.estimated_cost_usd).label("cost_usd"),
        func.count(AiConversation.id).label("conversations"),
    ).one()

    by_provider = db.execute(
        text("""
            SELECT provider,
                   COUNT(*) AS conversations,
                   SUM(total_prompt_tokens) AS prompt_tokens,
                   SUM(total_completion_tokens) AS completion_tokens,
                   SUM(total_tokens) AS total_tokens,
                   SUM(estimated_cost_usd) AS cost_usd
            FROM ai_conversations
            WHERE provider IS NOT NULL
            GROUP BY provider
            ORDER BY total_tokens DESC NULLS LAST
        """)
    ).fetchall()

    return {
        "total_prompt_tokens":     int(row.prompt or 0),
        "total_completion_tokens": int(row.completion or 0),
        "total_tokens":            int(row.total or 0),
        "total_cost_usd":          float(row.cost_usd or 0),
        "total_conversations":     int(row.conversations or 0),
        "by_provider": [
            {
                "provider":          r.provider,
                "conversations":     int(r.conversations),
                "prompt_tokens":     int(r.prompt_tokens or 0),
                "completion_tokens": int(r.completion_tokens or 0),
                "total_tokens":      int(r.total_tokens or 0),
                "cost_usd":          float(r.cost_usd or 0),
            }
            for r in by_provider
        ],
    }


# ── Internal helper: record an analyze-file call as a conversation ────────────

def record_analysis_conversation(
    db: Session,
    *,
    user_id: str,
    filename: str,
    provider: str,
    model_id_str: str,
    ai_model_db_id: int | None,
    prompt: str,
    response_text: str,
    prompt_tokens: int,
    completion_tokens: int,
    reasoning_tokens: int = 0,
    cached_tokens: int = 0,
) -> AiConversation:
    total_tokens = prompt_tokens + completion_tokens
    cost = estimate_cost(provider, prompt_tokens, completion_tokens)
    now  = datetime.now(timezone.utc)

    conv = AiConversation(
        user_id=user_id,
        title=f"Analysis: {filename}",
        ai_model_db_id=ai_model_db_id,
        provider=provider,
        model_id_str=model_id_str,
        total_prompt_tokens=prompt_tokens,
        total_completion_tokens=completion_tokens,
        total_reasoning_tokens=reasoning_tokens,
        total_cached_tokens=cached_tokens,
        total_tokens=total_tokens,
        estimated_cost_usd=Decimal(str(round(cost, 6))),
        created_at=now,
        updated_at=now,
    )
    db.add(conv)
    db.flush()  # get conv.id before adding messages

    # User "message" = the profile/prompt we sent
    db.add(AiMessage(
        conversation_id=conv.id,
        user_id=user_id,
        role="user",
        content=f"[Analyze file: {filename}]",
        prompt_tokens=prompt_tokens,
        completion_tokens=0,
        total_tokens=prompt_tokens,
        created_at=now,
    ))

    # Assistant reply = chart spec summary
    db.add(AiMessage(
        conversation_id=conv.id,
        user_id=user_id,
        role="assistant",
        content=response_text[:2000] if response_text else "",
        prompt_tokens=0,
        completion_tokens=completion_tokens,
        reasoning_tokens=reasoning_tokens,
        cached_tokens=cached_tokens,
        total_tokens=completion_tokens,
        created_at=now,
    ))

    db.commit()
    log.info(
        "conversation recorded  id=%d  user=%s  provider=%s  tokens=%d  cost=$%.6f",
        conv.id, user_id[:8], provider, total_tokens, cost,
    )
    return conv
