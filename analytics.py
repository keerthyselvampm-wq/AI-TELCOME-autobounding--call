from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import Optional, List
from datetime import date, timedelta, datetime
from app.database import get_db
from app.models import CallLog, CallType, CallOutcome, IvrOption, InternshipDomain
from app.schemas import CallLogResponse

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/summary")
def get_analytics_summary(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    since = date.today() - timedelta(days=days)
    base = db.query(CallLog).filter(cast(CallLog.timestamp, Date) >= since)

    total_calls = base.count()
    inbound = base.filter(CallLog.call_type == CallType.INBOUND).count()
    outbound = base.filter(CallLog.call_type == CallType.OUTBOUND).count()

    # IVR breakdown
    ivr_options = db.query(
        CallLog.ivr_option,
        func.count(CallLog.id).label("count")
    ).filter(
        cast(CallLog.timestamp, Date) >= since,
        CallLog.ivr_option.isnot(None)
    ).group_by(CallLog.ivr_option).all()

    # Outcome breakdown
    outcomes = db.query(
        CallLog.outcome,
        func.count(CallLog.id).label("count")
    ).filter(
        cast(CallLog.timestamp, Date) >= since,
        CallLog.outcome.isnot(None)
    ).group_by(CallLog.outcome).all()

    # Call volume by day
    volume = db.query(
        cast(CallLog.timestamp, Date).label("call_date"),
        func.count(CallLog.id).label("count")
    ).filter(
        cast(CallLog.timestamp, Date) >= since
    ).group_by(
        cast(CallLog.timestamp, Date)
    ).order_by(cast(CallLog.timestamp, Date)).all()

    # Average duration
    avg_duration = db.query(func.avg(CallLog.duration)).filter(
        cast(CallLog.timestamp, Date) >= since
    ).scalar() or 0

    return {
        "total_calls": total_calls,
        "inbound_calls": inbound,
        "outbound_calls": outbound,
        "avg_duration_seconds": round(float(avg_duration), 1),
        "ivr_breakdown": {
            row.ivr_option.value if hasattr(row.ivr_option, 'value') else row.ivr_option: row.count
            for row in ivr_options
        },
        "outcome_breakdown": {
            row.outcome.value if hasattr(row.outcome, 'value') else row.outcome: row.count
            for row in outcomes
        },
        "call_volume": [
            {"date": str(row.call_date), "count": row.count}
            for row in volume
        ],
    }


@router.get("/calls")
def list_analytics_calls(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    call_type: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    ivr_option: Optional[str] = Query(None),
    agent_type: Optional[str] = Query(None),
    caller_number: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(CallLog)

    if call_type:
        query = query.filter(CallLog.call_type == call_type)
    if outcome:
        query = query.filter(CallLog.outcome == outcome)
    if ivr_option:
        query = query.filter(CallLog.ivr_option == ivr_option)
    if agent_type:
        query = query.filter(CallLog.agent_type == agent_type)
    if caller_number:
        query = query.filter(CallLog.caller_number.ilike(f"%{caller_number}%"))
    if date_from:
        query = query.filter(cast(CallLog.timestamp, Date) >= date_from)
    if date_to:
        query = query.filter(cast(CallLog.timestamp, Date) <= date_to)
    if search:
        query = query.filter(
            CallLog.transcript.ilike(f"%{search}%") |
            CallLog.ai_summary.ilike(f"%{search}%") |
            CallLog.caller_number.ilike(f"%{search}%")
        )

    total = query.count()
    items = query.order_by(CallLog.timestamp.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "items": items,
    }


@router.get("/calls/{call_id}/transcript")
def get_call_transcript(call_id: int, db: Session = Depends(get_db)):
    call_log = db.query(CallLog).filter(CallLog.id == call_id).first()
    if not call_log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Call not found")
    return {
        "id": call_log.id,
        "call_sid": call_log.call_sid,
        "timestamp": str(call_log.timestamp),
        "transcript": call_log.transcript or "",
        "ai_summary": call_log.ai_summary or "",
        "call_notes": call_log.call_notes or "",
        "duration": call_log.duration,
        "outcome": call_log.outcome.value if call_log.outcome else None,
        "ivr_option": call_log.ivr_option.value if call_log.ivr_option else None,
        "agent_type": call_log.agent_type,
    }


@router.get("/calls/{call_id}/transcript/download")
def download_call_transcript(call_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import PlainTextResponse
    call_log = db.query(CallLog).filter(CallLog.id == call_id).first()
    if not call_log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Call not found")

    lines = [
        f"Call Transcript - VDart Academy",
        f"{'=' * 40}",
        f"Call SID: {call_log.call_sid}",
        f"Timestamp: {call_log.timestamp}",
        f"Type: {call_log.call_type.value if call_log.call_type else 'N/A'}",
        f"IVR Option: {call_log.ivr_option.value if call_log.ivr_option else 'N/A'}",
        f"Agent: {call_log.agent_type or 'N/A'}",
        f"Duration: {call_log.duration}s",
        f"Outcome: {call_log.outcome.value if call_log.outcome else 'N/A'}",
        f"Caller: {call_log.caller_number or 'N/A'}",
        f"{'=' * 40}",
        f"",
        f"TRANSCRIPT:",
        f"{call_log.transcript or 'No transcript available'}",
        f"",
        f"{'=' * 40}",
        f"AI SUMMARY:",
        f"{call_log.ai_summary or 'No summary available'}",
    ]
    content = "\n".join(lines)
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f"attachment; filename=transcript_{call_id}.txt"}
    )


# ── Domain-Specific Analytics ──────────────────────────────────────

@router.get("/domains")
def get_domain_analytics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    since = date.today() - timedelta(days=days)

    total_internship_calls = db.query(func.count(CallLog.id)).filter(
        cast(CallLog.timestamp, Date) >= since,
        CallLog.ivr_option == IvrOption.INTERNSHIP
    ).scalar() or 0

    domains = db.query(InternshipDomain).filter(
        InternshipDomain.is_active == True
    ).all()

    result = []
    for domain in domains:
        domain_lower = domain.name.lower()
        call_count = db.query(func.count(CallLog.id)).filter(
            cast(CallLog.timestamp, Date) >= since,
            CallLog.ivr_option == IvrOption.INTERNSHIP,
            CallLog.transcript.ilike(f"%{domain_lower}%")
        ).scalar() or 0

        confirmed = db.query(func.count(CallLog.id)).filter(
            cast(CallLog.timestamp, Date) >= since,
            CallLog.ivr_option == IvrOption.INTERNSHIP,
            CallLog.outcome == CallOutcome.CONFIRMED,
            CallLog.transcript.ilike(f"%{domain_lower}%")
        ).scalar() or 0

        conversion_rate = round((confirmed / call_count * 100), 1) if call_count > 0 else 0
        popularity = round((call_count / total_internship_calls * 100), 1) if total_internship_calls > 0 else 0

        result.append({
            "domain_id": domain.id,
            "domain_name": domain.name,
            "mention_count": call_count,
            "confirmed_count": confirmed,
            "conversion_rate": conversion_rate,
            "popularity_percentage": popularity,
        })

    return {
        "domains": sorted(result, key=lambda x: x["mention_count"], reverse=True),
        "total_internship_calls": total_internship_calls,
    }


@router.get("/ivr-trends")
def get_ivr_trends(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    since = date.today() - timedelta(days=days)
    trends = db.query(
        cast(CallLog.timestamp, Date).label("call_date"),
        CallLog.ivr_option,
        func.count(CallLog.id).label("count")
    ).filter(
        cast(CallLog.timestamp, Date) >= since,
        CallLog.ivr_option.isnot(None)
    ).group_by(
        cast(CallLog.timestamp, Date),
        CallLog.ivr_option
    ).order_by(cast(CallLog.timestamp, Date)).all()

    return {
        "trends": [
            {
                "date": str(row.call_date),
                "ivr_option": row.ivr_option.value if hasattr(row.ivr_option, 'value') else row.ivr_option,
                "count": row.count,
            }
            for row in trends
        ],
    }


@router.get("/agent-performance")
def get_agent_performance(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    since = date.today() - timedelta(days=days)

    agents_data = db.query(
        CallLog.agent_type,
        func.count(CallLog.id).label("total_calls"),
        func.coalesce(func.sum(CallLog.duration), 0).label("total_duration"),
    ).filter(
        cast(CallLog.timestamp, Date) >= since,
        CallLog.agent_type.isnot(None)
    ).group_by(CallLog.agent_type).all()

    result = []
    for agent_type, total_calls, total_duration in agents_data:
        confirmed_count = db.query(func.count(CallLog.id)).filter(
            cast(CallLog.timestamp, Date) >= since,
            CallLog.agent_type == agent_type,
            CallLog.outcome == CallOutcome.CONFIRMED
        ).scalar() or 0

        result.append({
            "agent_type": agent_type,
            "total_calls": total_calls,
            "total_duration_seconds": int(total_duration or 0),
            "confirmed_count": int(confirmed_count),
            "conversion_rate": round(
                (int(confirmed_count) / total_calls * 100), 1
            ) if total_calls > 0 else 0,
        })

    return {"agents": result}
