from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import AnalysisResult, User
from logger import get_logger

log = get_logger("analysis_results")
router = APIRouter(prefix="/api/v2/analysis-results", tags=["analysis-results"])


@router.get("/")
def list_analysis_results(
    limit:  int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user:   User    = Depends(get_current_user),
    db:     Session = Depends(get_db),
):
    """List the calling user's AI analysis results, newest first."""
    q     = db.query(AnalysisResult).filter(AnalysisResult.user_id == user.id)
    total = q.count()
    items = q.order_by(AnalysisResult.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "total":  total,
        "limit":  limit,
        "offset": offset,
        "items": [
            {
                "id":              r.id,
                "run_output_id":   r.run_output_id,
                "conversation_id": r.conversation_id,
                "filename":        r.filename,
                "provider":        r.provider,
                "model_id_str":    r.model_id_str,
                "chart_count":     r.chart_count,
                "sheet_count":     r.sheet_count,
                "total_rows":      r.total_rows,
                "total_columns":   r.total_columns,
                "review_status":   r.review_status,
                "created_at":      r.created_at.isoformat() if r.created_at else None,
                "summary":         (r.response_json or {}).get("summary", ""),
            }
            for r in items
        ],
    }


@router.get("/{result_id}")
def get_analysis_result(
    result_id: int,
    user:      User    = Depends(get_current_user),
    db:        Session = Depends(get_db),
):
    """Return a single analysis result with its full response_json."""
    r = db.query(AnalysisResult).filter(
        AnalysisResult.id      == result_id,
        AnalysisResult.user_id == user.id,
    ).first()
    if not r:
        raise HTTPException(404, "Analysis result not found")

    log.debug("get_analysis_result  id=%d  user=%s", result_id, user.id[:8])
    return {
        "id":              r.id,
        "run_output_id":   r.run_output_id,
        "conversation_id": r.conversation_id,
        "filename":        r.filename,
        "provider":        r.provider,
        "model_id_str":    r.model_id_str,
        "chart_count":     r.chart_count,
        "sheet_count":     r.sheet_count,
        "total_rows":      r.total_rows,
        "total_columns":   r.total_columns,
        "review_status":   r.review_status,
        "review_comment":  r.review_comment,
        "created_at":      r.created_at.isoformat() if r.created_at else None,
        "response_json":   r.response_json,
    }
