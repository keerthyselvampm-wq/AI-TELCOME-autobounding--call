import json
import logging
import httpx
from datetime import datetime
from app.database import SessionLocal
from app.models import CallLog, CallType, CallOutcome, Student, StudentStatus
from app.config import get_settings

logger = logging.getLogger(__name__)


EXOTEL_API_BASE = "https://api.exotel.com/v1/Accounts"


class CallService:
    def __init__(self):
        self.settings = get_settings()
        self._enabled = bool(
            self.settings.EXOTEL_API_KEY and self.settings.EXOTEL_API_TOKEN
        )

    def _exotel_post(self, path: str, data: dict) -> dict:
        url = f"{EXOTEL_API_BASE}/{self.settings.EXOTEL_ACCOUNT_SID}/{path}"
        resp = httpx.post(
            url,
            data=data,
            auth=(self.settings.EXOTEL_API_KEY, self.settings.EXOTEL_API_TOKEN),
            timeout=30,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"Exotel API error ({resp.status_code}): {resp.text}"
            )
        return resp.json()

    def save_call_log(self, call_sid: str, call_type: CallType, student_id: int = None, **kwargs):
        db = SessionLocal()
        try:
            call_log = CallLog(
                call_sid=call_sid,
                call_type=call_type,
                student_id=student_id,
                **kwargs
            )
            db.add(call_log)
            db.commit()
            db.refresh(call_log)
            return call_log
        finally:
            db.close()

    def save_recording(self, call_sid: str, recording_url: str):
        db = SessionLocal()
        try:
            call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
            if call_log:
                call_log.recording_url = recording_url
                db.commit()
        finally:
            db.close()

    def update_call_status(self, call_sid: str, status: str):
        db = SessionLocal()
        try:
            call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
            if call_log:
                outcome_map = {
                    "completed": CallOutcome.ANSWERED,
                    "busy": CallOutcome.BUSY,
                    "no-answer": CallOutcome.NOT_ANSWERED,
                    "failed": CallOutcome.NOT_ANSWERED,
                    "canceled": CallOutcome.CANCELLED,
                    "confirmed": CallOutcome.CONFIRMED,
                    "cancelled": CallOutcome.CANCELLED,
                }
                if status in outcome_map:
                    call_log.outcome = outcome_map[status]
                db.commit()
        finally:
            db.close()

    def get_call_log(self, call_sid: str) -> CallLog:
        db = SessionLocal()
        try:
            return db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
        finally:
            db.close()

    def initiate_test_call(self, to_number: str, base_url: str, agent_type: str = "internship", student_id: int = None) -> dict:
        if not self._enabled:
            raise RuntimeError("Exotel not configured. Check EXOTEL_API_KEY and EXOTEL_API_TOKEN.")

        exotelml_url = f"{base_url}/api/exotel/outbound-twiml?agent_type={agent_type}"
        status_callback = f"{base_url}/api/exotel/call-status"

        result = self._exotel_post("Calls/connect.json", {
            "From": self.settings.EXOTEL_CALLER_ID,
            "To": to_number,
            "CallerId": self.settings.EXOTEL_CALLER_ID,
            "Url": exotelml_url,
            "CallType": "trans",
            "StatusCallback": status_callback,
        })

        call_sid = result.get("Call", {}).get("Sid", "") or result.get("CallSid", "")
        self.save_call_log(call_sid=call_sid, call_type=CallType.OUTBOUND, student_id=student_id)

        return {"call_sid": call_sid, "status": result.get("Call", {}).get("Status", "queued")}

    def save_missed_joining_data(self, call_sid: str, collected_data: dict):
        db = SessionLocal()
        try:
            call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
            if not call_log or not call_log.student_id:
                return
            student = db.query(Student).filter(Student.id == call_log.student_id).first()
            if not student:
                return
            if collected_data.get("reason"):
                student.missed_joining_reason = collected_data["reason"]
            if collected_data.get("new_joining_date"):
                try:
                    student.rescheduled_date = datetime.strptime(collected_data["new_joining_date"], "%Y-%m-%d").date()
                except ValueError:
                    pass
            if collected_data.get("new_batch"):
                student.rescheduled_batch = collected_data["new_batch"]
            call_log.call_notes = json.dumps(collected_data)
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to save missed joining data: {e}")
        finally:
            db.close()

    def update_call_ivr_option(self, call_sid: str, option: str):
        from app.models import IvrOption
        db = SessionLocal()
        try:
            call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
            if call_log:
                call_log.ivr_option = IvrOption(option)
                db.commit()
        finally:
            db.close()

    def update_call_agent_type(self, call_sid: str, agent_type: str):
        db = SessionLocal()
        try:
            call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
            if call_log:
                call_log.agent_type = agent_type
                db.commit()
        finally:
            db.close()

    def update_call_transcript(self, call_sid: str, transcript: str):
        db = SessionLocal()
        try:
            call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
            if call_log:
                existing = call_log.transcript or ""
                call_log.transcript = (existing + "\n" + transcript).strip()
                db.commit()
        finally:
            db.close()

    def update_call_summary(self, call_sid: str, summary: str):
        db = SessionLocal()
        try:
            call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
            if call_log:
                call_log.ai_summary = summary
                db.commit()
        finally:
            db.close()

    def save_student_from_call(self, data: dict) -> Student:
        from app.models import BatchType
        db = SessionLocal()
        try:
            batch_map = {
                "morning": BatchType.MORNING,
                "afternoon": BatchType.AFTERNOON,
                "evening": BatchType.EVENING,
            }
            batch_str = data.get("batch", "").lower().strip()
            batch = batch_map.get(batch_str, BatchType.MORNING)

            student = Student(
                name=data.get("name", ""),
                college=data.get("college", ""),
                domain=data.get("domain", ""),
                contact_number=data.get("contact_number", ""),
                joining_date=datetime.strptime(data["joining_date"], "%B %d").replace(year=datetime.now().year).date() if data.get("joining_date") else datetime.now().date(),
                duration=data.get("duration", "3 months"),
                batch=batch,
                status=StudentStatus.PENDING,
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            return student
        finally:
            db.close()
