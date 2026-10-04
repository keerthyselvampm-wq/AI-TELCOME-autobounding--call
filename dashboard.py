from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime
from app.database import get_db
from app.models import Student, CallLog, SlotManagement, StudentStatus, CallType, BatchType

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_calls = db.query(CallLog).count()
    today_calls = db.query(CallLog).filter(
        func.date(CallLog.timestamp) == date.today()
    ).count()
    confirmed = db.query(Student).filter(Student.status == StudentStatus.CONFIRMED).count()
    pending = db.query(Student).filter(Student.status == StudentStatus.PENDING).count()
    cancelled = db.query(Student).filter(Student.status == StudentStatus.CANCELLED).count()
    total_students = db.query(Student).count()
    available_slots = db.query(SlotManagement).filter(
        SlotManagement.occupied < SlotManagement.capacity,
        SlotManagement.date >= date.today()
    ).count()

    return {
        "total_calls": total_calls,
        "today_calls": today_calls,
        "confirmed_students": confirmed,
        "pending_students": pending,
        "cancelled_students": cancelled,
        "total_students": total_students,
        "available_slots": available_slots,
    }


@router.get("/batch-occupancy")
def get_batch_occupancy(db: Session = Depends(get_db)):
    slots = db.query(SlotManagement).filter(
        SlotManagement.date >= date.today()
    ).all()
    result = {}
    for slot in slots:
        key = f"{slot.date}_{slot.batch.value}"
        result[key] = {
            "date": str(slot.date),
            "batch": slot.batch.value,
            "capacity": slot.capacity,
            "occupied": slot.occupied,
            "available": slot.capacity - slot.occupied,
        }
    return result


@router.get("/call-volume")
def get_call_volume(days: int = 7, db: Session = Depends(get_db)):
    from datetime import timedelta
    start_date = date.today() - timedelta(days=days)
    calls = db.query(
        func.date(CallLog.timestamp).label("call_date"),
        func.count(CallLog.id).label("count")
    ).filter(
        func.date(CallLog.timestamp) >= start_date
    ).group_by(func.date(CallLog.timestamp)).order_by(func.date(CallLog.timestamp)).all()

    return [{"date": str(c.call_date), "count": c.count} for c in calls]


@router.get("/recent-activities")
def get_recent_activities(limit: int = 10, db: Session = Depends(get_db)):
    calls = db.query(CallLog).order_by(CallLog.timestamp.desc()).limit(limit).all()
    activities = []
    for call in calls:
        student_name = None
        if call.student_id:
            student = db.query(Student).filter(Student.id == call.student_id).first()
            if student:
                student_name = student.name
        activities.append({
            "id": call.id,
            "type": call.call_type.value,
            "student_name": student_name,
            "outcome": call.outcome.value if call.outcome else None,
            "timestamp": str(call.timestamp),
            "duration": call.duration,
        })
    return activities
