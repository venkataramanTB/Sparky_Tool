from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User, RunLog

router = APIRouter(prefix="/api/v2/runs", tags=["runs"])


def _serialize(log: RunLog) -> dict:
    return {
        "id":           log.id,
        "config_id":    log.config_id,
        "config_name":  log.config_name,
        "status":       log.status,
        "instance_id":  log.instance_id,
        "report_id":    log.report_id,
        "row_count":    log.row_count,
        "error_detail": log.error_detail,
        "duration_ms":  log.duration_ms,
        "started_at":   log.started_at,
        "completed_at": log.completed_at,
    }


@router.get("/")
def list_runs(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(RunLog).filter(RunLog.user_id == user.id)
    if status:
        q = q.filter(RunLog.status == status)
    total = q.count()
    logs = q.order_by(RunLog.started_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "items": [_serialize(l) for l in logs]}


@router.get("/{run_id}")
def get_run(run_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    log = db.query(RunLog).filter(RunLog.id == run_id, RunLog.user_id == user.id).first()
    if not log:
        raise HTTPException(404, "Run not found")
    return _serialize(log)
