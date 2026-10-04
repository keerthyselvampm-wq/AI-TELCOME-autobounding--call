import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from app.database import get_db
from app.models import Student, StudentStatus, DocumentStatus, BatchType, AuditLog
from app.schemas import StudentCreate, StudentUpdate, StudentResponse, StudentFilter, PendingFollowupStudent, PendingFollowupSegment, AIAddStudentRequest, AIAddStudentResponse
from app.services.llm import LLMService

router = APIRouter(prefix="/api/students", tags=["Students"])


def _log_audit(db: Session, entity_type: str, entity_id: int, action: str, changes: dict = None):
    log = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        changes=changes,
        performed_by="admin",
    )
    db.add(log)
    db.commit()


@router.get("/", response_model=List[StudentResponse])
def list_students(
    name: Optional[str] = Query(None),
    college: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    batch: Optional[BatchType] = Query(None),
    status: Optional[StudentStatus] = Query(None),
    document_status: Optional[DocumentStatus] = Query(None),
    joining_date_from: Optional[date] = Query(None),
    joining_date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Student)
    if name:
        query = query.filter(Student.name.ilike(f"%{name}%"))
    if college:
        query = query.filter(Student.college.ilike(f"%{college}%"))
    if domain:
        query = query.filter(Student.domain.ilike(f"%{domain}%"))
    if batch:
        query = query.filter(Student.batch == batch)
    if status:
        query = query.filter(Student.status == status)
    if document_status:
        query = query.filter(Student.document_status == document_status)
    if joining_date_from:
        query = query.filter(Student.joining_date >= joining_date_from)
    if joining_date_to:
        query = query.filter(Student.joining_date <= joining_date_to)
    return query.order_by(Student.created_at.desc()).all()


PENDING_FOLLOWUP_STATUSES = [
    StudentStatus.PENDING,
    StudentStatus.CONFIRMED,
    StudentStatus.FOLLOW_UP,
]


@router.get("/pending-followup", response_model=List[PendingFollowupSegment])
def pending_followup_students(db: Session = Depends(get_db)):
    today = datetime.now().date()
    not_joined_q = db.query(Student).filter(
        Student.status.in_(PENDING_FOLLOWUP_STATUSES),
        Student.status != StudentStatus.JOINED,
        Student.joining_date < today,
    )
    doc_pending_q = db.query(Student).filter(
        Student.document_status == DocumentStatus.NOT_SUBMITTED,
        Student.status != StudentStatus.CANCELLED,
    )

    not_joined_students = not_joined_q.order_by(Student.created_at.desc()).all()
    doc_pending_students = doc_pending_q.order_by(Student.created_at.desc()).all()

    def to_followup(s: Student, reason: str) -> PendingFollowupStudent:
        return PendingFollowupStudent(
            id=s.id, name=s.name, college=s.college, domain=s.domain,
            contact_number=s.contact_number, joining_date=s.joining_date,
            duration=s.duration, batch=s.batch, status=s.status,
            document_status=s.document_status,
            missed_joining_reason=s.missed_joining_reason,
            rescheduled_date=s.rescheduled_date,
            rescheduled_batch=s.rescheduled_batch,
            reason=reason,
            created_at=s.created_at,
        )

    return [
        PendingFollowupSegment(
            segment="not_joined",
            label="Missed Joining Date",
            count=len(not_joined_students),
            students=[to_followup(s, f"Joining date ({s.joining_date}) has passed; student has not joined") for s in not_joined_students],
        ),
        PendingFollowupSegment(
            segment="document_pending",
            label="Document Pending",
            count=len(doc_pending_students),
            students=[to_followup(s, "Documents not submitted") for s in doc_pending_students],
        ),
    ]


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.post("/", response_model=StudentResponse, status_code=201)
def create_student(data: StudentCreate, db: Session = Depends(get_db)):
    student = Student(**data.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    _log_audit(db, "student", student.id, "created", {"name": student.name})
    return student


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(student_id: int, data: StudentUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    changes = {}
    for key, value in data.model_dump(exclude_unset=True).items():
        old = getattr(student, key, None)
        if old != value:
            changes[key] = {"from": str(old), "to": str(value)}
        setattr(student, key, value)
    if changes:
        _log_audit(db, "student", student.id, "updated", changes)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    _log_audit(db, "student", student.id, "deleted", {"name": student.name})
    db.delete(student)
    db.commit()
    return {"message": "Student deleted successfully"}


@router.post("/ai-add", response_model=AIAddStudentResponse)
async def ai_add_student(data: AIAddStudentRequest, db: Session = Depends(get_db)):
    llm = LLMService()
    today = date.today()

    system_prompt = (
        "You are a student data extraction assistant. Extract structured student information from natural language text. "
        "Return ONLY valid JSON with these fields (all optional except when clear from context):\n"
        "- name: str (full name)\n"
        "- college: str\n"
        "- domain: str\n"
        "- contact_number: str (phone number, digits only)\n"
        "- joining_date: str (in YYYY-MM-DD format; interpret relative dates like 'next week', 'tomorrow', 'next Monday' relative to today)\n"
        "- duration: str (e.g. '3 months', '6 months', '1 month')\n"
        "- batch: str (one of: 'morning', 'afternoon', 'evening')\n"
        "- status: str (optional, one of: 'pending', 'confirmed', 'cancelled', 'joined', 'follow_up'; default 'pending')\n"
        "- document_status: str (optional, one of: 'not_submitted', 'submitted', 'approved', 'rejected'; default 'not_submitted')\n\n"
        f"Today's date is {today.isoformat()}. Use this to calculate relative dates.\n\n"
        "Examples:\n"
        "Input: 'Add John Doe from MIT for AI Engineering, joining next Monday, morning batch, contact 9999999999'\n"
        "Output: {\"name\": \"John Doe\", \"college\": \"MIT\", \"domain\": \"AI Engineering\", \"contact_number\": \"9999999999\", \"joining_date\": \"<calculated_next_monday>\", \"duration\": \"3 months\", \"batch\": \"morning\"}\n\n"
        "Input: 'Update John's contact to 8888888888 and status to joined'\n"
        "Output: {\"contact_number\": \"8888888888\", \"status\": \"joined\"}\n\n"
        "If a required field is missing, use null for its value. If the text is completely unrecognizable, return {\"error\": \"Could not parse student information\"}."
    )

    messages = [{"role": "user", "content": data.text}]
    response_text = await llm.generate_response(
        messages=messages,
        system_prompt=system_prompt,
        ai_model="deepseek/deepseek-chat-v3-0324",
    )

    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail=f"AI returned invalid JSON: {response_text}")

    if "error" in parsed:
        raise HTTPException(status_code=400, detail=parsed["error"])

    existing_student = None
    if data.student_id:
        existing_student = db.query(Student).filter(Student.id == data.student_id).first()
        if not existing_student:
            raise HTTPException(status_code=404, detail="Student not found")

    if existing_student:
        update_data = {}
        for key in ["name", "college", "domain", "contact_number", "duration", "status", "document_status", "batch"]:
            if key in parsed and parsed[key] is not None:
                if key == "joining_date":
                    continue
                update_data[key] = parsed[key]
        for key, value in update_data.items():
            setattr(existing_student, key, value)
        db.commit()
        db.refresh(existing_student)
        student = existing_student
        action = "updated"
    else:
        student_data = {
            "name": parsed.get("name", "Unknown"),
            "college": parsed.get("college", "Unknown"),
            "domain": parsed.get("domain", "Unknown"),
            "contact_number": parsed.get("contact_number", "0000000000"),
            "joining_date": datetime.strptime(parsed["joining_date"], "%Y-%m-%d").date() if parsed.get("joining_date") else today,
            "duration": parsed.get("duration", "3 months"),
            "batch": parsed.get("batch", "morning"),
        }
        student = Student(**student_data)
        db.add(student)
        db.commit()
        db.refresh(student)
        action = "created"

    return AIAddStudentResponse(student=student, ai_parsed=parsed, action=action)


@router.get("/export/csv")
def export_students_csv(
    name: Optional[str] = Query(None),
    college: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    batch: Optional[BatchType] = Query(None),
    status: Optional[StudentStatus] = Query(None),
    db: Session = Depends(get_db),
):
    import csv, io
    query = db.query(Student)
    if name:
        query = query.filter(Student.name.ilike(f"%{name}%"))
    if college:
        query = query.filter(Student.college.ilike(f"%{college}%"))
    if domain:
        query = query.filter(Student.domain.ilike(f"%{domain}%"))
    if batch:
        query = query.filter(Student.batch == batch)
    if status:
        query = query.filter(Student.status == status)

    students = query.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Name", "College", "Domain", "Contact", "Joining Date", "Duration", "Batch", "Status", "Created At"])
    for s in students:
        writer.writerow([s.id, s.name, s.college, s.domain, s.contact_number, s.joining_date, s.duration, s.batch.value, s.status.value, s.created_at])
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=students.csv"})
