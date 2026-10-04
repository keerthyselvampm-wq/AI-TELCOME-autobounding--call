import logging
from app.ai.language_detector import LanguageDetector
from app.ai.prompts import CONFIRMATION_TEMPLATE, TAMIL_CONFIRMATION_TEMPLATE
from app.services.knowledge import KnowledgeService
from app.database import SessionLocal
from app.models import SlotManagement, SlotDomainAllocation, InternshipDomain, BatchType
from datetime import date, datetime
from typing import Optional

logger = logging.getLogger(__name__)

TAMIL_TRANSLATIONS = {
    "May I know your full name?": "உங்கள் முழுப் பெயரை தயவுசெய்து சொல்லுங்களா?",
    "Which college are you studying in?": "நீங்கள் எந்த கல்லூரியில் படிக்கிறீர்கள்?",
    "Which domain are you interested in?": "எந்த துறையில் நீங்கள் ஆர்வமாக உள்ளீர்கள்?",
    "What is your preferred joining date?": "நீங்கள் எந்த தேதியில் சேர விரும்புகிறீர்கள்?",
    "What internship duration would you prefer? (1 month, 3 months, or 6 months)": "எவ்வளவு கால பயிற்சியை விரும்புகிறீர்கள்? (1 மாதம், 3 மாதங்கள், அல்லது 6 மாதங்கள்)",
    "Which batch would you like to join? Morning, Afternoon, or Evening?": "எந்த பேட்ச்சில் சேர விரும்புகிறீர்கள்? காலை, மதியம், அல்லது மாலை?",
    "Can I have your contact number?": "உங்கள் தொடர்பு எண்ணை தர முடியுமா?",
    "Let me check the available slots for you.": "உங்களுக்கான கிடைக்கும் நேரங்களை சரிபார்க்கிறேன்.",
    "Would you like to check another date or batch?": "வேறு தேதி அல்லது பேட்ச்சை சரிபார்க்க விரும்புகிறீர்களா?",
    "Your internship inquiry has been successfully registered. Our team will contact you shortly. Thank you for choosing VDart Academy.": "உங்கள் பயிற்சி விசாரணை வெற்றிகரமாக பதிவு செய்யப்பட்டுள்ளது. எங்கள் குழு விரைவில் உங்களை தொடர்பு கொள்ளும். VDart Academy ஐ தேர்வு செய்ததற்கு நன்றி.",
    "Your registration has been cancelled. Feel free to call us anytime. Thank you.": "உங்கள் பதிவு ரத்து செய்யப்பட்டுள்ளது. நீங்கள் எப்போது வேண்டுமானாலும் எங்களை அழைக்கலாம். நன்றி.",
    "How can I help you today? You can ask about our internship programs or register.": "இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்? எங்கள் பயிற்சி திட்டங்கள் பற்றி கேட்கலாம் அல்லது பதிவு செய்யலாம்.",
    "How can I help you?": "நான் உங்களுக்கு எப்படி உதவ முடியும்?",
    " Would you like to register for an internship?": " பயிற்சிக்கு பதிவு செய்ய விரும்புகிறீர்களா?",
}

TAMIL_AFFIRMATIVE = [
    "aama", "aamam", "aamaam", "sari", "sariya", "sari thaan",
    "venum", "venuma", "venumam", "yes", "yeah", "sure", "ok", "okay",
]
TAMIL_QUESTION_WORDS = [
    "enna", "yenna", "eppadi", "epdi", "enga", "eangaa",
    "yaaru", "yedharku", "yedhu", "ethu", "eppodhu", "eppo",
]

ENGLISH_AFFIRMATIVE = ["yes", "yeah", "sure", "ok", "okay", "confirm", "correct", "right"]
ENGLISH_QUESTION_WORDS = [
    "what", "how", "which", "when", "where", "why",
    "is", "are", "do", "does", "can", "could", "will", "would",
]


class ConversationManager:
    def __init__(self, knowledge_service: Optional[KnowledgeService] = None):
        self.language_detector = LanguageDetector()
        self.knowledge_service = knowledge_service or KnowledgeService()
        self.sessions = {}

    def get_or_create_session(self, call_sid: str):
        if call_sid not in self.sessions:
            self.sessions[call_sid] = {
                "language": "english",
                "stage": "greeting",
                "collected_data": {},
                "messages": [],
                "faq_asked": False,
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
            logger.warning(f"Field extraction failed for {field_name}: {e}")
            return text.strip()

    async def process_message(self, text: str, call_sid: str, extractor_fn: Optional[callable] = None) -> dict:
        session = self.get_or_create_session(call_sid)

        detected_lang = self.language_detector.detect(text)
        session["language"] = detected_lang

        session["messages"].append({"role": "user", "content": text})

        lang = session["language"]
        stage = session["stage"]
        data = session["collected_data"]

        if stage == "greeting":
            if self._is_affirmative(text):
                if not data:
                    session["stage"] = "collect_name"
                    return {
                        "message": self._localize("May I know your full name?", lang),
                        "action": "collect_details",
                        "collected_data": data,
                    }
            if self._is_question(text):
                answer = self._answer_faq(text)
                if answer:
                    session["faq_asked"] = True
                    return {
                        "message": answer + self._localize(" Would you like to register for an internship?", lang),
                        "action": "ask_registration",
                        "collected_data": data,
                    }
            return {
                "message": self._localize("How can I help you today? You can ask about our internship programs or register.", lang),
                "action": "continue",
                "collected_data": data,
            }

        if stage == "collect_name":
            extracted = await self._extract_field(text, "name", "The full name of the student.", extractor_fn)
            data["name"] = extracted
            session["stage"] = "collect_college"
            return self._next_prompt("Which college are you studying in?", lang, data)

        if stage == "collect_college":
            extracted = await self._extract_field(text, "college", "The name of the college or university.", extractor_fn)
            data["college"] = extracted
            session["stage"] = "collect_domain"
            return self._next_prompt("Which domain are you interested in?", lang, data)

        if stage == "collect_domain":
            extracted = await self._extract_field(text, "domain", "The internship domain (e.g. AI Engineering, Data Science, Full Stack).", extractor_fn)
            data["domain"] = extracted
            session["stage"] = "collect_joining_date"
            return self._next_prompt("What is your preferred joining date?", lang, data)

        if stage == "collect_joining_date":
            extracted = await self._extract_field(text, "joining_date", "The preferred start date. Return relative dates in YYYY-MM-DD format if possible.", extractor_fn)
            data["joining_date"] = extracted
            session["stage"] = "collect_duration"
            return self._next_prompt("What internship duration would you prefer? (1 month, 3 months, or 6 months)", lang, data)

        if stage == "collect_duration":
            extracted = await self._extract_field(text, "duration", "The duration of the internship program.", extractor_fn)
            data["duration"] = extracted
            session["stage"] = "collect_batch"
            return self._next_prompt("Which batch would you like to join? Morning, Afternoon, or Evening?", lang, data)

        if stage == "collect_batch":
            extracted = await self._extract_field(text, "batch", "The preferred batch timing ('morning', 'afternoon', or 'evening').", extractor_fn)
            data["batch"] = extracted
            session["stage"] = "collect_contact"
            return self._next_prompt("Can I have your contact number?", lang, data)

        if stage == "collect_contact":
            extracted = await self._extract_field(text, "contact_number", "The phone number digits only.", extractor_fn)
            data["contact_number"] = extracted
            session["stage"] = "check_slots"
            return {
                "message": self._localize("Let me check the available slots for you.", lang),
                "action": "check_slots",
                "collected_data": data,
            }

        if stage == "check_slots":
            # Check real slot availability in database
            available = True
            db = SessionLocal()
            try:
                domain_name = data.get("domain", "")
                domain = db.query(InternshipDomain).filter(
                    InternshipDomain.name.ilike(f"%{domain_name}%"),
                    InternshipDomain.is_active == True
                ).first()

                jd_raw = data.get("joining_date", "")
                joining_date = date.today()
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                    try:
                        joining_date = datetime.strptime(str(jd_raw), fmt).date()
                        break
                    except ValueError:
                        continue

                batch_str = str(data.get("batch", "morning")).lower().strip()
                batch_map = {
                    "morning": BatchType.MORNING,
                    "afternoon": BatchType.AFTERNOON,
                    "evening": BatchType.EVENING,
                }
                batch = batch_map.get(batch_str, BatchType.MORNING)

                slot = db.query(SlotManagement).filter(
                    SlotManagement.date == joining_date,
                    SlotManagement.batch == batch
                ).first()

                if slot:
                    if slot.occupied >= slot.capacity:
                        available = False
                    elif domain:
                        alloc = db.query(SlotDomainAllocation).filter(
                            SlotDomainAllocation.slot_id == slot.id,
                            SlotDomainAllocation.domain_id == domain.id
                        ).first()
                        if alloc and alloc.occupied >= alloc.max_capacity:
                            available = False
            except Exception as e:
                logger.warning(f"Database error during inline slot validation: {e}")
            finally:
                db.close()

            if not available:
                # Reset stage to collect batch/date if full
                session["stage"] = "collect_joining_date"
                return {
                    "message": self._localize("I am sorry, but all slots for your selected date and batch are currently full. Could we select another date?", lang),
                    "action": "check_slots",
                    "collected_data": data,
                }

            if self._is_affirmative(text):
                session["stage"] = "confirm"
                safe_data = {
                    "name": data.get("name", "Unknown"),
                    "college": data.get("college", "N/A"),
                    "domain": data.get("domain", "N/A"),
                    "joining_date": data.get("joining_date", "TBD"),
                    "duration": data.get("duration", "3 months"),
                    "batch": data.get("batch", "morning"),
                    "contact_number": data.get("contact_number", "N/A")
                }
                if lang == "tamil":
                    confirmation = TAMIL_CONFIRMATION_TEMPLATE.format(**safe_data)
                else:
                    confirmation = CONFIRMATION_TEMPLATE.format(**safe_data)
                return {
                    "message": confirmation,
                    "action": "confirm",
                    "collected_data": data,
                }
            return {
                "message": self._localize("Would you like to check another date or batch?", lang),
                "action": "check_slots",
                "collected_data": data,
            }

        if stage == "confirm":
            if self._is_affirmative(text):
                session["stage"] = "completed"
                return {
                    "message": self._localize("Your internship inquiry has been successfully registered. Our team will contact you shortly. Thank you for choosing VDart Academy.", lang),
                    "action": "completed",
                    "collected_data": data,
                }
            return {
                "message": self._localize("Your registration has been cancelled. Feel free to call us anytime. Thank you.", lang),
                "action": "cancelled",
                "collected_data": data,
            }

        return {
            "message": self._localize("How can I help you?", lang),
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

    def _is_question(self, text: str) -> bool:
        text_lower = text.lower().strip()
        words = text_lower.split()
        first_word = words[0].strip(".,!?;:") if words else ""
        if first_word in TAMIL_QUESTION_WORDS or first_word in ENGLISH_QUESTION_WORDS:
            return True
        for w in words:
            w_clean = w.strip(".,!?;:")
            if w_clean in TAMIL_QUESTION_WORDS:
                return True
        return False

    def _answer_faq(self, text: str) -> str | None:
        result = self.knowledge_service.match_faq(text)
        if result:
            return result
        text_lower = text.lower()
        patterns = ["domain", "duration", "eligible", "fee", "certificate",
                     "batch", "timing", "register", "project"]
        for pattern in patterns:
            if pattern in text_lower:
                entries = self.knowledge_service.get_knowledge_by_category("internship")
                for entry in entries:
                    if pattern in entry.key.lower():
                        return entry.content
        return None

    def _next_prompt(self, question: str, lang: str, data: dict) -> dict:
        return {
            "message": self._localize(question, lang),
            "action": "collect_details",
            "collected_data": data,
        }

    def _localize(self, text: str, lang: str) -> str:
        if lang == "tamil":
            return TAMIL_TRANSLATIONS.get(text, text)
        return text

    def get_session_data(self, call_sid: str) -> dict | None:
        return self.sessions.get(call_sid)

    def clear_session(self, call_sid: str):
        if call_sid in self.sessions:
            del self.sessions[call_sid]

