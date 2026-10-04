from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.models import CallLog, CallType, CallOutcome
from app.schemas import CallLogCreate, CallLogUpdate, CallLogResponse

router = APIRouter(prefix="/api/calls", tags=["Call Logs"])


@router.get("/", response_model=List[CallLogResponse])
def list_calls(
    call_type: Optional[CallType] = Query(None),
    outcome: Optional[CallOutcome] = Query(None),
    student_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(CallLog)
    if call_type:
        query = query.filter(CallLog.call_type == call_type)
    if outcome:
        query = query.filter(CallLog.outcome == outcome)
    if student_id:
        query = query.filter(CallLog.student_id == student_id)
    return query.order_by(CallLog.timestamp.desc()).all()


@router.get("/{call_id}", response_model=CallLogResponse)
def get_call(call_id: int, db: Session = Depends(get_db)):
    call = db.query(CallLog).filter(CallLog.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call log not found")
    return call


@router.post("/", response_model=CallLogResponse, status_code=201)
def create_call_log(data: CallLogCreate, db: Session = Depends(get_db)):
    call_log = CallLog(**data.model_dump())
    db.add(call_log)
    db.commit()
    db.refresh(call_log)
    return call_log


@router.put("/{call_id}", response_model=CallLogResponse)
def update_call_log(call_id: int, data: CallLogUpdate, db: Session = Depends(get_db)):
    call_log = db.query(CallLog).filter(CallLog.id == call_id).first()
    if not call_log:
        raise HTTPException(status_code=404, detail="Call log not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(call_log, key, value)
    db.commit()
    db.refresh(call_log)
    return call_log
