import uuid
import json
import logging
import os
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.llm import LLMService
from app.services.elevenlabs import ElevenLabsService
from app.services.call import CallService
from app.database import SessionLocal
from app.models import AgentConfig, CallType, Student, StudentStatus, BatchType
from app.config import get_settings
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["call-simulator"])

llm_service = LLMService()
elevenlabs_service = ElevenLabsService()
call_service = CallService()


def _get_voice_id_for_agent(agent_type: str) -> str:
    default_voice_id = "hpp4J3VqNfWAUOO0d1Us"
    try:
        db = SessionLocal()
        config = db.query(AgentConfig).filter(
            AgentConfig.agent_type == agent_type,
            AgentConfig.is_active == 1
        ).first()
        voice = config.voice if config else None
        db.close()
        if voice and voice != "default":
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
            return voice_map.get(voice.lower(), default_voice_id)
    except Exception as e:
        logger.warning(f"Failed to retrieve voice configuration: {e}")
    return default_voice_id


@router.websocket("/call")
async def websocket_call_endpoint(websocket: WebSocket):
    await websocket.accept()
    call_sid = f"sim_{uuid.uuid4().hex[:12]}"
    start_time = datetime.now()
    agent_type = "internship"
    student_id = None
    collected_data = {}
    call_ended = False
    current_lang = "english"
    action = "continue"
    dg_stream = None
    processing_lock = asyncio.Lock()

    call_service.save_call_log(
        call_sid=call_sid,
        call_type=CallType.INBOUND,
        caller_number="BROWSER_SIMULATOR",
    )

    async def on_transcript(transcript: str):
        nonlocal collected_data, call_ended, current_lang, dg_stream, action
        
        if processing_lock.locked():
            logger.info(f"Ignored transcript '{transcript}' because response generation is in progress.")
            return

        async with processing_lock:
            logger.info(f"Processing transcript for call {call_sid}: '{transcript}'")
            # Send transcript event back to the simulator frontend
            await websocket.send_text(json.dumps({
                "type": "user_transcript",
                "text": transcript
            }))

            # Process the transcript
            ai_response = await llm_service.process_conversation(
                transcript, call_sid, agent_type
            )
            message = ai_response.get("message", "")
            action = ai_response.get("action", "continue")
            collected_data = ai_response.get("collected_data", {}) or collected_data

            session_data = llm_service.get_conversation_manager(agent_type).get_or_create_session(call_sid)
            state = session_data.get("stage", "unknown")
            detected_lang = session_data.get("language", "english")

            # Notify the UI with AI text response
            await websocket.send_text(json.dumps({
                "type": "ai_response",
                "message": message,
                "action": action,
                "state": state,
                "collected_data": collected_data,
                "language": detected_lang,
            }))

            # Save to call transcripts database
            try:
                call_service.update_call_transcript(
                    call_sid, f"User: {transcript}\nAI: {message}"
                )
            except Exception as e:
                logger.warning(f"Failed to save transcript for {call_sid}: {e}")

            # Stream ElevenLabs TTS audio back
            try:
                voice_id = _get_voice_id_for_agent(agent_type)
                if detected_lang == "tamil":
                    voice_id = "nPczCzjI2devNBz1zQrb"  # Tamil Brian voice

                async for chunk in elevenlabs_service.text_to_speech_stream(
                    message, voice_id=voice_id, language=detected_lang
                ):
                    await websocket.send_bytes(chunk)
                
                # Send end marker for audio playout queue
                await websocket.send_text(json.dumps({
                    "type": "audio_end"
                }))
            except Exception as tts_err:
                logger.warning(f"Failed to stream ElevenLabs TTS: {tts_err}")
                await websocket.send_text(json.dumps({
                    "type": "audio_fallback_trigger",
                    "text": message
                }))

            # Reconnect Deepgram dynamically if language switches mid-call
            if detected_lang != current_lang and dg_stream:
                logger.info(f"Reconnecting Deepgram stream to {detected_lang} model")
                current_lang = detected_lang
                await dg_stream.close()
                try:
                    from app.services.speech import DeepgramStream
                    dg_stream = DeepgramStream(
                        api_key=get_settings().DEEPGRAM_API_KEY,
                        language=current_lang
                    )
                    await dg_stream.connect(on_transcript)
                except Exception as dg_err:
                    logger.error(f"Failed to reconnect Deepgram stream: {dg_err}")
                    dg_stream = None

            if action in ("completed", "cancelled"):
                call_ended = True

    try:
        while True:
            # Receive text or binary data dynamically
            data = await websocket.receive()
            if "text" in data:
                raw = data["text"]
                msg = json.loads(raw)
                msg_type = msg.get("type", "")

                if msg_type == "start_call":
                    agent_type = msg.get("agent_type", "internship")
                    student_id = msg.get("student_id")
                    greeting = "Welcome to VDart Academy. How may I help you today?"
                    try:
                        db = SessionLocal()
                        config = db.query(AgentConfig).filter(
                            AgentConfig.agent_type == agent_type,
                            AgentConfig.is_active == 1,
                        ).first()
                        greeting_msg = config.greeting_message if config else None
                        db.close()
                        if greeting_msg:
                            greeting = greeting_msg
                    except Exception as e:
                        logger.warning(f"Failed to retrieve custom greeting: {e}")

                    # Connect to Deepgram streaming STT
                    try:
                        from app.services.speech import DeepgramStream
                        dg_stream = DeepgramStream(
                            api_key=get_settings().DEEPGRAM_API_KEY,
                            language=current_lang
                        )
                        await dg_stream.connect(on_transcript)
                    except Exception as dg_err:
                        logger.error(f"Failed to connect to Deepgram streaming API: {dg_err}. Operating in fallback mode.")
                        dg_stream = None

                    # Initial transcripts logging
                    try:
                        call_service.update_call_transcript(call_sid, f"AI: {greeting}")
                    except Exception as e:
                        logger.warning(f"Failed to save transcript for {call_sid}: {e}")

                    # Notify frontend
                    await websocket.send_text(json.dumps({
                        "type": "ai_response",
                        "message": greeting,
                        "action": "continue",
                        "state": "greeting",
                    }))

                    # Stream initial greeting audio
                    try:
                        voice_id = _get_voice_id_for_agent(agent_type)
                        async for chunk in elevenlabs_service.text_to_speech_stream(greeting, voice_id=voice_id):
                            await websocket.send_bytes(chunk)
                        await websocket.send_text(json.dumps({"type": "audio_end"}))
                    except Exception as tts_err:
                        await websocket.send_text(json.dumps({"type": "audio_fallback_trigger", "text": greeting}))

                elif msg_type == "user_text":
                    # Fallback text override messaging
                    user_text = msg.get("text", "")
                    await on_transcript(user_text)

                elif msg_type == "end_call":
                    call_ended = True
                    break

            elif "bytes" in data:
                # Pipe raw client audio chunk (16kHz PCM mono) directly to Deepgram Stream
                audio_chunk = data["bytes"]
                if dg_stream:
                    await dg_stream.send_audio(audio_chunk)

            if call_ended:
                break

    except WebSocketDisconnect:
        call_ended = True
    except Exception as e:
        logger.error(f"WebSocket error for {call_sid}: {e}", exc_info=True)
        call_ended = True
    finally:
        # Close deepgram stream connection
        if dg_stream:
            await dg_stream.close()

        duration = int((datetime.now() - start_time).total_seconds())
        try:
            if call_ended:
                call_service.update_call_summary(
                    call_sid, f"Browser call ended. Duration: {duration}s."
                )
                
                # Determine outcome based on final AI action state
                outcome_str = "completed"
                if action in ("completed", "confirmed"):
                    outcome_str = "confirmed"
                elif action == "cancelled":
                    outcome_str = "cancelled"
                
                logger.info(f"Setting call outcome for {call_sid} to {outcome_str} (action was {action})")
                call_service.update_call_status(call_sid, outcome_str)

                if collected_data:
                    db = SessionLocal()
                    try:
                        from app.models import CallLog
                        call_log = db.query(CallLog).filter(
                            CallLog.call_sid == call_sid
                        ).first()
                        if call_log:
                            call_log.call_notes = json.dumps(
                                collected_data, ensure_ascii=False
                            )
                            call_log.agent_type = agent_type
                            call_log.duration = duration
                            db.commit()
                    except Exception as e:
                        logger.warning(f"Failed to persist collected_data on call_log {call_sid}: {e}")
                        db.rollback()
                    finally:
                        db.close()

                if (
                    collected_data
                    and agent_type == "internship"
                    and collected_data.get("name")
                    and collected_data.get("contact_number")
                ):
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
                            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%B %d", "%b %d"):
                                try:
                                    dt = datetime.strptime(str(jd_raw), fmt)
                                    if fmt in ("%B %d", "%b %d"):
                                        dt = dt.replace(year=datetime.now().year)
                                    joining_date = dt.date()
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
                        call_log = db.query(CallLog).filter(
                            CallLog.call_sid == call_sid
                        ).first()
                        if call_log:
                            call_log.student_id = student.id
                            db.commit()

                        # Book database slot reservation
                        from app.models import SlotManagement, SlotDomainAllocation, InternshipDomain
                        domain = db.query(InternshipDomain).filter(
                            InternshipDomain.name.ilike(f"%{student.domain}%")
                        ).first()

                        if student.joining_date and student.batch:
                            slot = db.query(SlotManagement).filter(
                                SlotManagement.date == student.joining_date,
                                SlotManagement.batch == student.batch
                            ).first()
                            if slot and domain:
                                allocation = db.query(SlotDomainAllocation).filter(
                                    SlotDomainAllocation.slot_id == slot.id,
                                    SlotDomainAllocation.domain_id == domain.id
                                ).first()
                                if slot.occupied < slot.capacity:
                                    slot.occupied += 1
                                    if allocation and allocation.occupied < allocation.max_capacity:
                                        allocation.occupied += 1
                                    db.commit()
                                    logger.info(f"Reserved slot {slot.id} for Student {student.id}")
                    except Exception as e:
                        logger.warning(f"Failed to create Student from collected_data: {e}")
                        db.rollback()
                    finally:
                        db.close()

                if collected_data and agent_type == "missed_joining" and student_id:
                    db = SessionLocal()
                    try:
                        student = db.query(Student).filter(Student.id == student_id).first()
                        if student:
                            if collected_data.get("reason"):
                                student.missed_joining_reason = collected_data["reason"]
                            if collected_data.get("new_joining_date"):
                                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                                    try:
                                        student.rescheduled_date = datetime.strptime(
                                            collected_data["new_joining_date"], fmt
                                        ).date()
                                        break
                                    except ValueError:
                                        continue
                            if collected_data.get("new_batch"):
                                student.rescheduled_batch = collected_data["new_batch"]
                            db.commit()

                            # Increment slots for rescheduled student
                            if student.rescheduled_date and student.rescheduled_batch:
                                from app.models import SlotManagement, SlotDomainAllocation, InternshipDomain
                                batch_map = {
                                    "morning": BatchType.MORNING,
                                    "afternoon": BatchType.AFTERNOON,
                                    "evening": BatchType.EVENING,
                                }
                                res_batch = batch_map.get(str(student.rescheduled_batch).lower().strip())
                                if res_batch:
                                    slot = db.query(SlotManagement).filter(
                                        SlotManagement.date == student.rescheduled_date,
                                        SlotManagement.batch == res_batch
                                    ).first()
                                    domain = db.query(InternshipDomain).filter(
                                        InternshipDomain.name.ilike(f"%{student.domain}%")
                                    ).first()
                                    if slot and domain:
                                        allocation = db.query(SlotDomainAllocation).filter(
                                            SlotDomainAllocation.slot_id == slot.id,
                                            SlotDomainAllocation.domain_id == domain.id
                                        ).first()
                                        if slot.occupied < slot.capacity:
                                            slot.occupied += 1
                                            if allocation and allocation.occupied < allocation.max_capacity:
                                                allocation.occupied += 1
                                            db.commit()
                                            logger.info(f"Reserved rescheduled slot {slot.id} for Student {student.id}")
                    except Exception as e:
                        logger.warning(f"Failed to update missed_joining student: {e}")
                        db.rollback()
                    finally:
                        db.close()
        except Exception as e:
            logger.warning(f"Failed to update call log: {e}")

        llm_service.get_conversation_manager(agent_type).clear_session(call_sid)

        try:
            await websocket.send_text(json.dumps({
                "type": "call_ended",
                "reason": "completed" if call_ended else "disconnected",
                "duration": duration,
            }))
        except Exception:
            pass
