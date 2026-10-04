import logging
import os
import time
import uuid
import asyncio
import json
from datetime import datetime, date
from typing import List
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel
from app.services.call import CallService
from app.services.speech import SpeechService
from app.services.llm import LLMService
from app.services.elevenlabs import ElevenLabsService
from app.services.session_store import SessionStore
from app.database import SessionLocal
from app.models import CallType, CallOutcome, AgentConfig, Student, StudentStatus, BatchType
from app.config import get_public_url, get_settings
from app.schemas import BulkCallRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exotel", tags=["exotel"])

call_service = CallService()
speech_service = SpeechService()
llm_service = LLMService()
elevenlabs_service = ElevenLabsService()


class MakeCallRequest(BaseModel):
    to_number: str


# ── ExotelML helpers ──────────────────────────────────────────────

def _exotelml_say(text: str) -> str:
    return f"<Say>{_escape_xml(text)}</Say>"


def _exotelml_gather(action: str, num_digits: int = 1, timeout: int = 10, finish_on_key: str = "") -> str:
    attrs = f'action="{action}" method="GET" numDigits="{num_digits}" timeout="{timeout}"'
    if finish_on_key:
        attrs += f' finishOnKey="{_escape_xml(finish_on_key)}"'
    return f"<Gather {attrs}></Gather>"


def _exotelml_record(action: str) -> str:
    return f'<Record action="{action}" method="GET" maxDuration="10" playBeep="false"/>'


def _exotelml_hangup() -> str:
    return "<Hangup/>"


def _exotelml_response(*elements: str) -> str:
    return f"<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>{''.join(elements)}</Response>"


def _escape_xml(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;")


def _get_base_url(request: Request) -> str:
    return get_public_url() or str(request.base_url).rstrip("/")


async def _generate_tts_audio(text: str, call_sid: str, agent_type: str, base_url: str) -> str | None:
    if not text:
        return None
    try:
        voice_id = "hpp4J3VqNfWAUOO0d1Us"
        db = None
        try:
            db = SessionLocal()
            config = db.query(AgentConfig).filter(
                AgentConfig.agent_type == agent_type,
                AgentConfig.is_active == 1
            ).first()
            if config and config.voice and config.voice != "default":
                voice_map = {
                    "bella": "hpp4J3VqNfWAUOO0d1Us",
                    "adam": "pNInz6obpgDQGcFmaJgB",
                    "jessica": "cgSgspJ2msm6clMCkdW9",
                    "roger": "CwhRBWXzGAHq8TQ4Fs17",
                    "sarah": "EXAVITQu4vr4xnSDxMaL",
                    "charlie": "IKne3meq5aSn9XLyUdCD",
                    "brian": "nPczCjzI2devNBz1zQrb",
                    "lily": "pFZP5JQG7iQjIQuC4Bku",
                }
                voice_id = voice_map.get(config.voice.lower(), voice_id)
        except Exception:
            pass
        finally:
            if db:
                db.close()

        audio_bytes = await elevenlabs_service.text_to_speech(text, voice_id)
        if not audio_bytes:
            return None

        filename = f"{call_sid}_{uuid.uuid4().hex[:8]}.mp3"
        filepath = os.path.join("audio_output", filename)
        with open(filepath, "wb") as f:
            f.write(audio_bytes)

        return f"{base_url}/audio/{filename}"
    except Exception as e:
        logger.warning(f"TTS generation failed: {e}")
        return None


# ── Incoming Call with IVR Menu ───────────────────────────────────

@router.api_route("/incoming-call", methods=["GET", "POST"])
async def incoming_call(request: Request):
    if request.method == "POST":
        form = await request.form()
        call_sid = form.get("CallSid", "")
        caller_number = form.get("From", "") or form.get("CallFrom", "")
    else:
        call_sid = request.query_params.get("CallSid", "")
        caller_number = request.query_params.get("From", "") or request.query_params.get("CallFrom", "")

    try:
        if call_sid:
            call_service.save_call_log(
                call_sid=call_sid,
                call_type=CallType.INBOUND,
                caller_number=caller_number,
            )
    except Exception as e:
        logger.warning(f"Failed to save call log: {e}")

    base_url = _get_base_url(request)
    gather_url = f"{base_url}/api/exotel/ivr-route"

    xml = _exotelml_response(
        _exotelml_say("Welcome to VDart AI Assistant. For Internship Enquiries, press 1."),
        _exotelml_gather(gather_url, num_digits=1, timeout=10),
    )
    return Response(content=xml, media_type="text/xml")


# ── IVR Route Handler ─────────────────────────────────────────────

@router.api_route("/ivr-route", methods=["GET", "POST"])
async def ivr_route(request: Request):
    if request.method == "POST":
        form = await request.form()
        digits = form.get("Digits", "")
        call_sid = form.get("CallSid", "")
    else:
        digits = request.query_params.get("Digits", "")
        call_sid = request.query_params.get("CallSid", "")

    base_url = _get_base_url(request)
    agent_urls = {
        "1": f"{base_url}/api/exotel/internship",
    }

    # Update call log with selected option
    ivr_map = {"1": "internship"}
    if digits in ivr_map:
        try:
            call_service.update_call_ivr_option(call_sid, ivr_map[digits])
        except Exception as e:
            logger.warning(f"Failed to update IVR option: {e}")

    agent_url = agent_urls.get(digits)
    if agent_url:
        xml = _exotelml_response(
            _exotelml_say("Please wait while I connect you to the right department."),
            _exotelml_record(agent_url),
        )
    else:
        # Invalid input - repeat menu
        gather_url = f"{base_url}/api/exotel/ivr-route"
        xml = _exotelml_response(
            _exotelml_say("Sorry, I didn't understand that selection."),
            _exotelml_say("Welcome to VDart AI Assistant. For Internship Enquiries, press 1."),
            _exotelml_gather(gather_url, num_digits=1, timeout=10),
        )
    return Response(content=xml, media_type="text/xml")


# ── AI Agent Endpoints ────────────────────────────────────────────

@router.api_route("/internship", methods=["GET", "POST"])
async def internship_agent(request: Request):
    return await _handle_agent_call(request, "internship")


async def _handle_agent_call(request: Request, agent_type: str):
    if request.method == "POST":
        form = await request.form()
        call_sid = form.get("CallSid", "")
        recording_url = form.get("RecordingUrl", "")
    else:
        call_sid = request.query_params.get("CallSid", "")
        recording_url = request.query_params.get("RecordingUrl", "")

    # Update agent type in call log
    try:
        call_service.update_call_agent_type(call_sid, agent_type)
    except Exception as e:
        logger.warning(f"Failed to update agent type: {e}")

    base_url = _get_base_url(request)
    agent_url = f"{base_url}/api/exotel/{agent_type}"

    if not recording_url:
        # First time - greet and start recording
        SessionStore.save_session(call_sid, {"retry_count": 0})
        if agent_type == "missed_joining":
            greeting = "Hello, this is a follow-up call from VDart Academy. I see you missed your scheduled internship joining date. I'm here to help. Please tell me how you're doing."
        else:
            greeting = "You have reached the Internship Enquiry desk. Please tell me how I can help you with your internship."
        xml = _exotelml_response(
            _exotelml_say(greeting),
            _exotelml_record(agent_url),
        )
        return Response(content=xml, media_type="text/xml")

    # Resolve active language from session
    session_data = llm_service.get_conversation_manager(agent_type).get_or_create_session(call_sid)
    active_lang = session_data.get("language", "english")

    # Process recording
    try:
        call_service.save_recording(call_sid, recording_url)
        # Pass active session language to transcribe_audio to avoid hardcoding "en"
        transcript = await speech_service.transcribe_audio(recording_url, language=active_lang)
    except Exception as e:
        logger.warning(f"Recording/transcription failed for {call_sid}: {e}")
        transcript = ""

    if not transcript:
        session_state = SessionStore.get_session(call_sid) or {}
        retry_count = session_state.get("retry_count", 0) + 1
        session_state["retry_count"] = retry_count
        SessionStore.save_session(call_sid, session_state)
        
        if retry_count >= 3:
            logger.warning(f"Transcription failed after {retry_count} attempts for {call_sid}")
            SessionStore.clear_session(call_sid)
            xml = _exotelml_response(
                _exotelml_say("I'm having trouble hearing you. Please call back later or try again. Thank you."),
                _exotelml_hangup(),
            )
            return Response(content=xml, media_type="text/xml")
        xml = _exotelml_response(
            _exotelml_say("I didn't catch that. Could you please repeat?"),
            _exotelml_record(agent_url),
        )
        return Response(content=xml, media_type="text/xml")

    # Reset retry count on successful transcript
    session_state = SessionStore.get_session(call_sid) or {}
    session_state["retry_count"] = 0
    SessionStore.save_session(call_sid, session_state)

    # Update transcript in call log
    try:
        call_service.update_call_transcript(call_sid, transcript)
    except Exception as e:
        logger.warning(f"Failed to update transcript: {e}")

    # Process with AI
    action = "continue"
    message = ""
    collected_data = {}
    try:
        ai_response = await llm_service.process_conversation(transcript, call_sid, agent_type)
        action = ai_response.get("action", "continue")
        message = ai_response.get("message", "")
        collected_data = ai_response.get("collected_data", {})
    except Exception as e:
        logger.error(f"AI processing failed for {call_sid}: {e}", exc_info=True)
        message = "I apologize, but I encountered a technical issue. Please try again later."

    # Update summary if completed
    if action in ("completed", "confirmed", "cancelled"):
        try:
            call_service.update_call_summary(call_sid, message)
            outcome = CallOutcome.CONFIRMED if action in ("completed", "confirmed") else CallOutcome.CANCELLED
            call_service.update_call_status(call_sid, outcome.value)
            
            # Save student registration for Exotel calls
            if agent_type == "internship" and action in ("completed", "confirmed") and collected_data:
                db = SessionLocal()
                try:
                    batch_map = {
                        "morning": BatchType.MORNING,
                        "afternoon": BatchType.AFTERNOON,
                        "evening": BatchType.EVENING,
                    }
                    batch_str = str(collected_data.get("batch", "")).lower().strip()
                    batch = batch_map.get(batch_str, BatchType.MORNING)

                    jd_raw = collected_data.get("joining_date")
                    joining_date = datetime.now().date()
                    if jd_raw:
                        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                            try:
                                joining_date = datetime.strptime(str(jd_raw), fmt).date()
                                break
                            except ValueError:
                                continue

                    student = Student(
                        name=str(collected_data.get("name", "")).strip()[:255],
                        college=str(collected_data.get("college", "")).strip()[:255] or "N/A",
                        domain=str(collected_data.get("domain", "")).strip()[:255] or "N/A",
                        contact_number=str(collected_data.get("contact_number", "")).strip()[:20],
                        joining_date=joining_date,
                        duration=str(collected_data.get("duration", "3 months"))[:50],
                        batch=batch,
                        status=StudentStatus.PENDING,
                    )
                    db.add(student)
                    db.commit()
                    db.refresh(student)

                    # Link new student to call log
                    from app.models import CallLog
                    call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
                    if call_log:
                        call_log.student_id = student.id
                        call_log.call_notes = json.dumps(collected_data, ensure_ascii=False)
                        db.commit()

                    # Reserve slot
                    from app.models import SlotManagement, SlotDomainAllocation, InternshipDomain
                    domain = db.query(InternshipDomain).filter(
                        InternshipDomain.name.ilike(f"%{student.domain}%")
                    ).first()
                    if student.joining_date and student.batch and domain:
                        slot = db.query(SlotManagement).filter(
                            SlotManagement.date == student.joining_date,
                            SlotManagement.batch == student.batch
                        ).first()
                        if slot:
                            allocation = db.query(SlotDomainAllocation).filter(
                                SlotDomainAllocation.slot_id == slot.id,
                                SlotDomainAllocation.domain_id == domain.id
                            ).first()
                            if slot.occupied < slot.capacity:
                                slot.occupied += 1
                                if allocation and allocation.occupied < allocation.max_capacity:
                                    allocation.occupied += 1
                                db.commit()
                except Exception as ex:
                    logger.warning(f"Exotel registration student save failed: {ex}")
                    db.rollback()
                finally:
                    db.close()

            if agent_type == "missed_joining" and collected_data:
                call_service.save_missed_joining_data(call_sid, collected_data)
                # Reserve rescheduled slot
                db = SessionLocal()
                try:
                    jd_raw = collected_data.get("new_joining_date")
                    new_date = None
                    if jd_raw:
                        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                            try:
                                new_date = datetime.strptime(str(jd_raw), fmt).date()
                                break
                            except ValueError:
                                continue
                    batch_str = str(collected_data.get("new_batch", "")).lower().strip()
                    batch_map = {
                        "morning": BatchType.MORNING,
                        "afternoon": BatchType.AFTERNOON,
                        "evening": BatchType.EVENING,
                    }
                    batch = batch_map.get(batch_str)
                    
                    if new_date and batch:
                        from app.models import SlotManagement, SlotDomainAllocation, InternshipDomain
                        slot = db.query(SlotManagement).filter(
                            SlotManagement.date == new_date,
                            SlotManagement.batch == batch
                        ).first()
                        if slot:
                            slot.occupied += 1
                            db.commit()
                            logger.info(f"Reserved slot {slot.id} for rescheduled exotel caller {call_sid}")
                except Exception as ex:
                    logger.warning(f"Exotel missed joining slot reservation failed: {ex}")
                    db.rollback()
                finally:
                    db.close()

            # Clean up active session persistence
            SessionStore.clear_session(call_sid)
        except Exception as e:
            logger.warning(f"Failed to update call outcome: {e}")

    if not message:
        message = "Thank you for reaching VDart Academy. How may I assist you today?"

    audio_url = await _generate_tts_audio(message, call_sid, agent_type, base_url)

    say_tag = _exotelml_say(message)
    if audio_url:
        play_tag = f'<Play>{_escape_xml(audio_url)}</Play>'
        response_elements = [play_tag, say_tag]
    else:
        response_elements = [say_tag]

    if action in ("completed", "cancelled"):
        response_elements.append(_exotelml_hangup())
    else:
        response_elements.append(_exotelml_record(agent_url))

    xml = _exotelml_response(*response_elements)
    return Response(content=xml, media_type="text/xml")


# ── Call Status & Recording ────────────────────────────────────────

@router.api_route("/call-status", methods=["GET", "POST"])
async def call_status(request: Request):
    if request.method == "POST":
        form = await request.form()
        call_sid = form.get("CallSid", "")
        call_status = form.get("CallStatus", "")
    else:
        call_sid = request.query_params.get("CallSid", "")
        call_status = request.query_params.get("CallStatus", "")
    call_service.update_call_status(call_sid, call_status)
    return Response(content="OK", media_type="text/plain")


@router.post("/make-test-call")
async def make_test_call(req: MakeCallRequest, request: Request):
    base_url = _get_base_url(request)
    try:
        result = call_service.initiate_test_call(req.to_number, base_url)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Call failed: {str(e)}")


@router.get("/outbound-twiml")
async def outbound_twiml(request: Request):
    base_url = _get_base_url(request)
    agent_type = request.query_params.get("agent_type", "internship")

    if agent_type == "missed_joining":
        xml = _exotelml_response(
            _exotelml_say("Hello, this is a follow-up call from VDart Academy regarding your internship registration."),
            _exotelml_say("Please wait while we connect you to our support team."),
            _exotelml_record(f"{base_url}/api/exotel/missed-joining"),
        )
    else:
        gather_url = f"{base_url}/api/exotel/ivr-route"
        xml = _exotelml_response(
            _exotelml_say("Hello, this is a call from VDart Academy."),
            _exotelml_say("Welcome to VDart AI Assistant. For Internship Enquiries, press 1."),
            _exotelml_gather(gather_url, num_digits=1, timeout=10),
        )
    return Response(content=xml, media_type="text/xml")


@router.api_route("/missed-joining", methods=["GET", "POST"])
async def missed_joining_agent(request: Request):
    return await _handle_agent_call(request, "missed_joining")


@router.post("/bulk-call")
async def bulk_call(req: BulkCallRequest, request: Request):
    base_url = _get_base_url(request)
    results = []
    db = SessionLocal()
    try:
        students = db.query(Student).filter(Student.id.in_(req.student_ids)).all()
    finally:
        db.close()

    for i, student in enumerate(students):
        if i > 0 and req.delay_seconds > 0:
            await asyncio.sleep(req.delay_seconds)
        try:
            result = call_service.initiate_test_call(student.contact_number, base_url, agent_type=req.agent_type, student_id=student.id)
            results.append({
                "student_id": student.id,
                "student_name": student.name,
                "contact_number": student.contact_number,
                "call_sid": result.get("call_sid"),
                "status": "queued",
            })
        except Exception as e:
            results.append({
                "student_id": student.id,
                "student_name": student.name,
                "contact_number": student.contact_number,
                "call_sid": None,
                "status": f"failed: {str(e)}",
            })

    return {"total": len(students), "queued": sum(1 for r in results if r["status"] == "queued"), "results": results}
