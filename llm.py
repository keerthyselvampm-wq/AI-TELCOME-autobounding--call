import httpx
import asyncio
import logging
from typing import Optional, List, Dict, Any
from app.config import get_settings
from app.ai.conversation import ConversationManager
from app.ai.missed_joining import MissedJoiningConversationManager
from app.database import SessionLocal
from app.models import AgentConfig
from app.services.knowledge import KnowledgeService

logger = logging.getLogger(__name__)


class AIProvider:
    def __init__(self, name: str, api_key_attr: str, base_url: str, models: List[str],
                 auth_header: str = "Authorization", auth_prefix: str = "Bearer ",
                 headers_fn: callable = None):
        self.name = name
        self.api_key_attr = api_key_attr
        self.base_url = base_url
        self.models = models
        self.auth_header = auth_header
        self.auth_prefix = auth_prefix
        self.headers_fn = headers_fn

    def get_api_key(self, settings) -> Optional[str]:
        return getattr(settings, self.api_key_attr, None) or ""

    def is_available(self, settings) -> bool:
        return bool(self.get_api_key(settings))

    def build_headers(self, settings, api_key: str) -> dict:
        if self.headers_fn:
            return self.headers_fn(api_key)
        return {
            self.auth_header: f"{self.auth_prefix}{api_key}",
            "Content-Type": "application/json",
        }

    def build_payload(self, model: str, messages: list, system_prompt: str,
                      temperature: float, max_tokens: int) -> dict:
        if self.name == "anthropic":
            system_msg = [{"type": "text", "text": system_prompt}]
            return {
                "model": model,
                "system": system_msg,
                "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
        return {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                *messages,
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

    def extract_response(self, data: dict) -> str:
        if self.name == "anthropic":
            return data.get("content", [{}])[0].get("text", "")
        return data.get("choices", [{}])[0].get("message", {}).get("content", "")


PROVIDERS = [
    AIProvider(
        name="openrouter",
        api_key_attr="OPENROUTER_API_KEY",
        base_url="https://openrouter.ai/api/v1",
        models=[
            "deepseek/deepseek-chat-v3-0324",
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "anthropic/claude-3.5-sonnet",
            "google/gemini-2.0-flash-001",
            "meta-llama/llama-3.3-70b-instruct",
            "mistralai/mistral-7b-instruct",
        ],
    ),
    AIProvider(
        name="openai",
        api_key_attr="OPENAI_API_KEY",
        base_url="https://api.openai.com/v1",
        models=["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    ),
    AIProvider(
        name="anthropic",
        api_key_attr="ANTHROPIC_API_KEY",
        base_url="https://api.anthropic.com/v1",
        models=["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
        auth_header="x-api-key",
        auth_prefix="",
        headers_fn=lambda key: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
    ),
    AIProvider(
        name="google",
        api_key_attr="GOOGLE_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta",
        models=["gemini-2.0-flash-001", "gemini-1.5-pro", "gemini-1.5-flash"],
        auth_header="x-goog-api-key",
        auth_prefix="",
    ),
]


class LLMService:
    def __init__(self):
        self.settings = get_settings()
        self.knowledge_service = KnowledgeService()
        self.conversation_managers = {
            "internship": ConversationManager(knowledge_service=self.knowledge_service),
            "missed_joining": MissedJoiningConversationManager(knowledge_service=self.knowledge_service),
        }

    STAGE_DESCRIPTIONS = {
        "greeting": (
            "Greet the user warmly and ask how you can help. "
            "Do NOT ask for personal details yet."
        ),
        "collect_name": (
            "Ask for their full name. "
            "Example: 'May I know your full name?'"
        ),
        "collect_college": (
            "Ask which college they are studying at."
        ),
        "collect_domain": (
            "Ask which domain they are interested in (e.g., AI Engineering, Data Science, Full Stack)."
        ),
        "collect_joining_date": (
            "Ask their preferred joining date."
        ),
        "collect_duration": (
            "Ask their preferred duration: 1 month, 3 months, or 6 months."
        ),
        "collect_batch": (
            "Ask their preferred batch: Morning, Afternoon, or Evening."
        ),
        "collect_contact": (
            "Ask for their contact number."
        ),
        "check_slots": (
            "Tell them you are checking slot availability, then ask if they would like to confirm."
        ),
        "confirm": (
            "Show a summary of all collected details and ask them to confirm."
        ),
        "completed": (
            "Thank them warmly and let them know the team will contact them shortly."
        ),
        "cancelled": (
            "Acknowledge cancellation politely and let them know they can call anytime."
        ),
        "intro": (
            "Warmly greet the student and mention that you noticed they missed their scheduled joining date. "
            "Ask how they are doing and express that we are here to help."
        ),
        "collect_reason": (
            "Ask the student why they were unable to join on their scheduled date. "
            "Be empathetic and understanding. Do not sound accusatory."
        ),
        "offer_reschedule": (
            "Thank them for sharing. Mention that new batches are starting soon and ask if they would like to reschedule."
        ),
        "collect_new_date": (
            "Ask for their preferred new joining date for rescheduling."
        ),
        "collect_new_batch": (
            "Ask which batch they would prefer: Morning, Afternoon, or Evening."
        ),
    }

    STAGE_DESCRIPTIONS_TA = {
        "greeting": "பயனரை அன்புடன் வரவேற்று, எப்படி உதவ முடியும் என்று கேளுங்கள். தனிப்பட்ட விவரங்களை இப்போது கேட்க வேண்டாம்.",
        "collect_name": "அவர்களின் முழு பெயரைக் கேளுங்கள். எடுத்துக்காட்டு: 'உங்கள் முழு பெயரைத் தெரிந்து கொள்ளலாமா?'",
        "collect_college": "அவர்கள் எந்த கல்லூரியில் படிக்கிறார்கள் என்று கேளுங்கள்.",
        "collect_domain": "எந்த துறையில் அவர்கள் ஆர்வமாக உள்ளனர் என்று கேளுங்கள் (எ.கா., AI Engineering, Data Science, Full Stack).",
        "collect_joining_date": "அவர்கள் விரும்பும் சேரும் தேதியைக் கேளுங்கள்.",
        "collect_duration": "1 மாதம், 3 மாதங்கள் அல்லது 6 மாதங்கள் - எந்த காலத்தை விரும்புகிறார்கள் என்று கேளுங்கள்.",
        "collect_batch": "காலை, மதியம் அல்லது மாலை - எந்த நேரத்தை விரும்புகிறார்கள் என்று கேளுங்கள்.",
        "collect_contact": "அவர்களின் தொலைபேசி எண்ணைக் கேளுங்கள்.",
        "check_slots": "இடக் கிடைப்பைச் சரிபார்ப்பதாகக் கூறி, பின்னர் உறுதிப்படுத்த விரும்புகிறார்களா என்று கேளுங்கள்.",
        "confirm": "சேகரிக்கப்பட்ட அனைத்து விவரங்களின் சுருக்கத்தைக் காண்பித்து உறுதிப்படுத்தச் சொல்லுங்கள்.",
        "completed": "அன்புடன் நன்றி கூறி, குழு விரைவில் தொடர்பு கொள்ளும் என்று தெரிவியுங்கள்.",
        "cancelled": "ரத்து செய்ததை பணிவுடன் ஒப்புக்கொண்டு, எப்போது வேண்டுமானாலும் அழைக்கலாம் என்று தெரிவியுங்கள்.",
        "intro": "மாணவரை அன்புடன் வரவேற்று, அவர்கள் திட்டமிட்ட சேரும் தேதியை தவறவிட்டதாகக் கூறுங்கள். எப்படி இருக்கிறார்கள் என்று கேட்டு, உதவ நாங்கள் இருப்பதாகத் தெரிவியுங்கள்.",
        "collect_reason": "திட்டமிட்ட தேதியில் ஏன் சேர முடியவில்லை என்று கேளுங்கள். பச்சாதாபத்துடனும் புரிதலுடனும் இருங்கள்.",
        "offer_reschedule": "பகிர்ந்தமைக்கு நன்றி. புதிய பேட்ச்கள் விரைவில் தொடங்குகின்றன. மீண்டும் திட்டமிட விரும்புகிறீர்களா என்று கேளுங்கள்.",
        "collect_new_date": "மறு திட்டமிடலுக்கான புதிய சேரும் தேதியைக் கேளுங்கள்.",
        "collect_new_batch": "காலை, மதியம் அல்லது மாலை - எந்த நேரத்தை விரும்புகிறீர்கள் என்று கேளுங்கள்.",
    }

    def _build_stage_instruction(self, stage: str, collected_data: dict, language: str) -> str:
        is_tamil = language == "tamil"
        stage_desc = (self.STAGE_DESCRIPTIONS_TA if is_tamil else self.STAGE_DESCRIPTIONS).get(
            stage, "Continue the conversation naturally."
        )
        collected_str = "\n".join(
            f"- {k}: {v}" for k, v in collected_data.items()
        ) if collected_data else ("(இதுவரை எதுவும் சேகரிக்கப்படவில்லை)" if is_tamil else "(none collected yet)")

        if is_tamil:
            return (
                f"## தற்போதைய உரையாடல் நிலை: \"{stage}\"\n"
                f"{stage_desc}\n\n"
                f"### இதுவரை சேகரிக்கப்பட்ட தரவு:\n{collected_str}\n\n"
                f"### மொழி: தமிழ்\n"
                f"### முக்கியமான விதிகள்:\n"
                f"1. ஒரே நேரத்தில் ஒரு கேள்வி மட்டும் கேளுங்கள். பல கேள்விகளை ஒருங்கே கேட்க வேண்டாம்.\n"
                f"2. எப்போதும் தமிழில் பதிலளிக்கவும். இயற்கையான உரையாடல் தமிழைப் பயன்படுத்தவும்.\n"
                f"3. சுருக்கமான பதில்களை கொடுங்கள்.\n"
                f"4. அடுத்த நிலைக்கு தாவ வேண்டாம். முதலில் தற்போதைய கேள்விக்கு பதில் பெறுங்கள்.\n"
                f"5. VDart அகாடமியின் நட்பு உதவியாளராக இருங்கள்."
            )

        return (
            f"## Current Conversation Stage: \"{stage}\"\n"
            f"{stage_desc}\n\n"
            f"### Data Collected So Far:\n{collected_str}\n\n"
            f"### Language: English\n"
            f"### Critical Rules:\n"
            f"1. Ask only ONE question at a time. Never list or ask multiple questions in a single response.\n"
            f"2. Match the user's language. If they write in Tamil, respond in Tamil. If English, respond in English.\n"
            f"3. Use natural, conversational Tamil (not Google-translate style). Keep responses short.\n"
            f"4. Do NOT skip ahead to the next stage. Let the user answer the current question first.\n"
            f"5. Stay in character as a friendly VDart Academy assistant."
        )

    def _get_system_prompt(self, agent_type: str = "internship",
                           stage: str = None,
                           collected_data: dict = None,
                           language: str = None) -> str:
        base_prompt = ""
        try:
            db = SessionLocal()
            config = db.query(AgentConfig).filter(
                AgentConfig.agent_type == agent_type,
                AgentConfig.is_active == 1
            ).first()
            db.close()
            if config and config.system_prompt:
                base_prompt = config.system_prompt
        except Exception:
            pass

        if not base_prompt:
            if language == "tamil":
                base_prompt = (
                    "நீங்கள் VDart அகாடமியின் AI உதவியாளர். "
                    "மாணவர் பதிவு விவரங்களை படிப்படியாக சேகரிப்பது, "
                    "இன்டர்ன்ஷிப் திட்டங்கள் பற்றிய கேள்விகளுக்கு பதிலளிப்பது, "
                    "மற்றும் பதிவுகளை உறுதிப்படுத்துவது உங்கள் பணி. "
                    "தொழில்முறையாகவும், உதவியாகவும், உரையாடல் முறையிலும் இருங்கள். "
                    "எப்போதும் தமிழில் மட்டுமே பதிலளிக்கவும்."
                )
            else:
                base_prompt = """You are a VDart Academy AI internship assistant. Your role is to collect student registration details step by step, answer questions about internship programs, and confirm registrations. Be professional, helpful, and conversational."""

        if stage:
            stage_instr = self._build_stage_instruction(stage, collected_data or {}, language or "english")
            base_prompt += "\n\n" + stage_instr

        knowledge_extension = self.knowledge_service.build_system_prompt_extension(agent_type)
        if knowledge_extension:
            base_prompt += knowledge_extension
        return base_prompt

    def get_conversation_manager(self, agent_type: str = "internship"):
        if agent_type not in self.conversation_managers:
            self.conversation_managers[agent_type] = ConversationManager()
        return self.conversation_managers[agent_type]

    async def process_conversation(self, text: str, call_sid: str, agent_type: str = "internship") -> dict:
        try:
            manager = self.get_conversation_manager(agent_type)
            session = manager.get_or_create_session(call_sid)

            # Await the updated async state machine process_message
            state_response = await manager.process_message(text, call_sid, extractor_fn=self.extract_structured_data)
            session = manager.get_or_create_session(call_sid)

            # Trim session messages to avoid unbounded memory growth (e.g. keep last 6 turns / 12 messages)
            max_history_messages = 12
            if len(session["messages"]) > max_history_messages:
                session["messages"] = session["messages"][-max_history_messages:]
                logger.info(f"Trimmed session history for {call_sid} to last {max_history_messages} messages")

            system_prompt = self._get_system_prompt(
                agent_type,
                stage=session.get("stage", "greeting"),
                collected_data=session.get("collected_data", {}),
                language=session.get("language", "english"),
            )
            llm_response = await self.generate_response(
                messages=session["messages"],
                language=session["language"],
                agent_type=agent_type,
                system_prompt=system_prompt,
            )

            session["messages"].append({"role": "assistant", "content": llm_response})

            return {
                "message": llm_response,
                "action": state_response.get("action", "continue"),
                "collected_data": state_response.get("collected_data", {}),
            }
        except Exception as e:
            logger.error(f"Error in process_conversation: {e}", exc_info=True)
            fallback_msg = "மன்னிக்கவும், தற்காலிகமாக என்னால் பதிலளிக்க முடியவில்லை." if session.get("language") == "tamil" else "I apologize, but I am having trouble processing that right now."
            return {
                "message": fallback_msg,
                "action": "continue",
                "collected_data": session.get("collected_data", {}),
            }


    def _resolve_model(self, agent_type: str, requested_model: str = None) -> tuple:
        if requested_model:
            return self._find_provider_for_model(requested_model), requested_model
        try:
            db = SessionLocal()
            config = db.query(AgentConfig).filter(
                AgentConfig.agent_type == agent_type,
                AgentConfig.is_active == 1
            ).first()
            db.close()
            if config and config.ai_model:
                provider = self._find_provider_for_model(config.ai_model)
                return provider, config.ai_model
        except Exception:
            pass

        default_model = "deepseek/deepseek-chat-v3-0324"
        provider = self._find_provider_for_model(default_model)
        return provider, default_model

    def _find_provider_for_model(self, model: str) -> Optional[AIProvider]:
        for p in PROVIDERS:
            if model in p.models:
                return p
        return PROVIDERS[0]

    def _get_fallback_chain(self, primary_provider: AIProvider, model: str) -> list:
        chain = [(primary_provider, model)]
        if not self.settings.AI_FALLBACK_ENABLED:
            return chain
        fallback_models = [
            "openai/gpt-4o-mini",
            "google/gemini-2.0-flash-001",
            "anthropic/claude-3-haiku-20240307",
        ]
        for fb_model in fallback_models:
            if fb_model == model:
                continue
            for p in PROVIDERS:
                if fb_model in p.models and p.is_available(self.settings):
                    chain.append((p, fb_model))
                    break
        return chain

    async def generate_response(self, messages: list, language: str = "english",
                                agent_type: str = "internship",
                                system_prompt: str = None,
                                ai_model: str = None) -> str:
        if not system_prompt:
            system_prompt = self._get_system_prompt(agent_type, language=language)

        primary_provider, resolved_model = self._resolve_model(agent_type, ai_model)
        fallback_chain = self._get_fallback_chain(primary_provider, resolved_model)

        last_error = ""
        for provider, model in fallback_chain:
            api_key = provider.get_api_key(self.settings)
            if not api_key:
                continue
            try:
                result = await self._call_provider(provider, model, messages,
                                                    system_prompt, api_key)
                if result:
                    return result
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Provider {provider.name}/{model} failed: {e}")
                continue

        logger.error(f"All AI providers failed. Last error: {last_error}")
        if language == "tamil":
            return "மன்னிக்கவும், தற்போது என்னால் உங்கள் கோரிக்கையை செயல்படுத்த முடியவில்லை. தயவுசெய்து சிறிது நேரம் கழித்து முயற்சிக்கவும்."
        return "I apologize, but I'm unable to process your request at the moment. Please try again later."

    async def _call_provider(self, provider: AIProvider, model: str,
                             messages: list, system_prompt: str,
                             api_key: str) -> Optional[str]:
        headers = provider.build_headers(self.settings, api_key)
        payload = provider.build_payload(
            model, messages, system_prompt,
            temperature=0.7, max_tokens=300
        )

        url = f"{provider.base_url}/chat/completions"
        if provider.name == "anthropic":
            url = f"{provider.base_url}/messages"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
                timeout=30,
            )
            if response.status_code == 200:
                data = response.json()
                return provider.extract_response(data)
            logger.warning(f"{provider.name} API error {response.status_code}: {response.text[:200]}")
        return None

    async def extract_structured_data(self, text: str, schema_description: str) -> dict:
        system_prompt = (
            f"Extract structured data from the user's text according to this schema:\n"
            f"{schema_description}\n\n"
            f"Return ONLY valid JSON. No markdown fences, no explanation."
        )
        messages = [{"role": "user", "content": text}]
        result = await self.generate_response(
            messages=messages,
            system_prompt=system_prompt,
        )
        import re, json
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        return {}
