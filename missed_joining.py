import logging
from app.ai.language_detector import LanguageDetector
from app.services.knowledge import KnowledgeService
from app.database import SessionLocal
from app.models import SlotManagement, BatchType
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

TAMIL_AFFIRMATIVE = [
    "aama", "aamam", "aamaam", "sari", "sariya", "sari thaan",
    "venum", "venuma", "venumam", "yes", "yeah", "sure", "ok", "okay",
]

ENGLISH_AFFIRMATIVE = ["yes", "yeah", "sure", "ok", "okay", "confirm", "correct", "right", "interested"]


class MissedJoiningConversationManager:
    def __init__(self, knowledge_service: Optional[KnowledgeService] = None):
        self.language_detector = LanguageDetector()
        self.knowledge_service = knowledge_service or KnowledgeService()
        self.sessions = {}

    def get_or_create_session(self, call_sid: str):
        if call_sid not in self.sessions:
            self.sessions[call_sid] = {
                "language": "english",
                "stage": "intro",
                "collected_data": {},
                "messages": [],
            }
        return self.sessions[call_sid]

    async def _extract_field(self, text: str, field_name: str, description: str, extractor_fn: Optional[callable]) -> str:
        if not extractor_fn:
            return text.strip()
        try:
            res = await extractor_fn(text, f"Field: '{field_name}'. Description: '{description}'. Return JSON object with only this key.")
            val = res.get(field_name, text)
            return str(val).strip() if val is not None else text.strip()
        except Exception as e:
            logger.warning(f"Field extraction failed in missed joining for {field_name}: {e}")
            return text.strip()

    async def process_message(self, text: str, call_sid: str, extractor_fn: Optional[callable] = None) -> dict:
        session = self.get_or_create_session(call_sid)

        detected_lang = self.language_detector.detect(text)
        session["language"] = detected_lang

        session["messages"].append({"role": "user", "content": text})

        lang = session["language"]
        stage = session["stage"]
        data = session["collected_data"]

        if stage == "intro":
            if self._is_affirmative(text):
                session["stage"] = "collect_reason"
                return {
                    "message": self._localize("Thank you. Could you please tell us why you were unable to join on your scheduled date?", lang),
                    "action": "collect_reason",
                    "collected_data": data,
                }
            return {
                "message": self._localize("I understand. We noticed you missed your internship joining date. We'd like to help you reschedule. Would you like to share why you couldn't join?", lang),
                "action": "collect_reason",
                "collected_data": data,
            }

        if stage == "collect_reason":
            extracted = await self._extract_field(text, "reason", "The reason the student missed their joining date.", extractor_fn)
            data["reason"] = extracted
            session["stage"] = "offer_reschedule"
            return {
                "message": self._localize("Thank you for sharing that. We have new batches starting soon. Would you like to reschedule your internship for a later date?", lang),
                "action": "offer_reschedule",
                "collected_data": data,
            }

        if stage == "offer_reschedule":
            if self._is_affirmative(text):
                session["stage"] = "collect_new_date"
                return {
                    "message": self._localize("Great! What would be your preferred new joining date?", lang),
                    "action": "collect_details",
                    "collected_data": data,
                }
            session["stage"] = "completed"
            return {
                "message": self._localize("No problem at all. If you change your mind in the future, feel free to reach out. We wish you the very best!", lang),
                "action": "completed",
                "collected_data": data,
            }

        if stage == "collect_new_date":
            extracted = await self._extract_field(text, "new_joining_date", "The preferred new joining date. Convert relative dates into YYYY-MM-DD if possible.", extractor_fn)
            data["new_joining_date"] = extracted
            session["stage"] = "collect_new_batch"
            return {
                "message": self._localize("Which batch would you prefer? Morning, Afternoon, or Evening?", lang),
                "action": "collect_details",
                "collected_data": data,
            }

        if stage == "collect_new_batch":
            extracted = await self._extract_field(text, "new_batch", "The preferred batch timing ('morning', 'afternoon', or 'evening').", extractor_fn)
            data["new_batch"] = extracted

            # Check availability
            available = True
            db = SessionLocal()
            try:
                jd_raw = data.get("new_joining_date", "")
                joining_date = None
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                    try:
                        joining_date = datetime.strptime(str(jd_raw), fmt).date()
                        break
                    except ValueError:
                        continue

                batch_str = str(data.get("new_batch", "morning")).lower().strip()
                batch_map = {
                    "morning": BatchType.MORNING,
                    "afternoon": BatchType.AFTERNOON,
                    "evening": BatchType.EVENING,
                }
                batch = batch_map.get(batch_str, BatchType.MORNING)

                if joining_date:
                    slot = db.query(SlotManagement).filter(
                        SlotManagement.date == joining_date,
                        SlotManagement.batch == batch
                    ).first()
                    if slot and slot.occupied >= slot.capacity:
                        available = False
            except Exception as e:
                logger.warning(f"Slot check in missed joining failed: {e}")
            finally:
                db.close()

            if not available:
                session["stage"] = "collect_new_date"
                return {
                    "message": self._localize("I am sorry, but all slots for your selected date and batch are currently full. Could we select another date?", lang),
                    "action": "collect_details",
                    "collected_data": data,
                }

            session["stage"] = "confirm"
            return {
                "message": self._localize(
                    f"Thank you! Let me confirm your new plan:\n- Reason: {data.get('reason', '')}\n- New Date: {data.get('new_joining_date', '')}\n- Batch: {data.get('new_batch', '')}\n\nWould you like to confirm this reschedule?",
                    lang,
                ),
                "action": "confirm",
                "collected_data": data,
            }

        if stage == "confirm":
            if self._is_affirmative(text):
                session["stage"] = "completed"
                return {
                    "message": self._localize("Your reschedule request has been noted. Our team will contact you to confirm your new slot. Thank you for choosing VDart Academy!", lang),
                    "action": "completed",
                    "collected_data": data,
                }
            session["stage"] = "cancelled"
            return {
                "message": self._localize("Understood. Your reschedule request has been cancelled. Feel free to call us anytime if you change your mind. Thank you!", lang),
                "action": "cancelled",
                "collected_data": data,
            }

        return {
            "message": self._localize("How can I help you today?", lang),
            "action": "continue",
            "collected_data": data,
        }

    def _is_affirmative(self, text: str) -> bool:
        text = text.lower().strip()
        words = text.split()
        for w in words:
            w = w.strip(".,!?;:")
            if w in TAMIL_AFFIRMATIVE or w in ENGLISH_AFFIRMATIVE:
                return True
        return False

    def _localize(self, text: str, lang: str) -> str:
        if lang == "tamil":
            tamil_map = {
                "Thank you. Could you please tell us why you were unable to join on your scheduled date?": "நன்றி. உங்கள் திட்டமிடப்பட்ட தேதியில் சேர முடியாமல் போனதற்கான காரணத்தை தயவுசெய்து சொல்ல முடியுமா?",
                "I understand. We noticed you missed your internship joining date. We'd like to help you reschedule. Would you like to share why you couldn't join?": "புரிகிறது. நீங்கள் உங்கள் பயிற்சி சேரும் தேதியை தவறவிட்டதை நாங்கள் கவனித்தோம். மீண்டும் திட்டமிட உங்களுக்கு உதவ விரும்புகிறோம். ஏன் சேர முடியவில்லை என்று பகிர விரும்புகிறீர்களா?",
                "Thank you for sharing that. We have new batches starting soon. Would you like to reschedule your internship for a later date?": "பகிர்ந்ததற்கு நன்றி. எங்களிடம் விரைவில் புதிய பேட்ச்கள் தொடங்குகின்றன. உங்கள் பயிற்சியை வேறு தேதியில் மீண்டும் திட்டமிட விரும்புகிறீர்களா?",
                "Great! What would be your preferred new joining date?": "அருமை! உங்கள் விருப்பமான புதிய சேரும் தேதி என்ன?",
                "No problem at all. If you change your mind in the future, feel free to reach out. We wish you the very best!": "எந்த பிரச்சினையும் இல்லை. எதிர்காலத்தில் உங்கள் மனதை மாற்றினால், எங்களை தொடர்பு கொள்ள தயங்க வேண்டாம். உங்களுக்கு மிகவும் நல்வாழ்த்துக்கள்!",
                "Which batch would you prefer? Morning, Afternoon, or Evening?": "நீங்கள் எந்த பேட்ச்சை விரும்புகிறீர்கள்? காலை, மதியம், அல்லது மாலை?",
                "Understood. Your reschedule request has been cancelled. Feel free to call us anytime if you change your mind. Thank you!": "புரிகிறது. உங்கள் மறுதிட்டமிடல் கோரிக்கை ரத்து செய்யப்பட்டது. உங்கள் மனதை மாற்றினால் எங்களை அழைக்கலாம். நன்றி!",
                "How can I help you today?": "இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
            }
            return tamil_map.get(text, text)
        return text

    def get_session_data(self, call_sid: str) -> dict | None:
        return self.sessions.get(call_sid)

    def clear_session(self, call_sid: str):
        if call_sid in self.sessions:
            del self.sessions[call_sid]
