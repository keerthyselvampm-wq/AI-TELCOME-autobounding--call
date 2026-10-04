import httpx
from app.config import get_settings


class ElevenLabsService:
    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.ELEVENLABS_API_KEY
        self.base_url = "https://api.elevenlabs.io/v1"

    async def text_to_speech(self, text: str, voice_id: str = "hpp4J3VqNfWAUOO0d1Us",
                             language: str = "english") -> bytes:
        if not self.api_key:
            return b""

        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key,
        }

        model_id = "eleven_multilingual_v2"
        if language == "tamil":
            model_id = "eleven_turbo_v2_5"

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.4 if language == "tamil" else 0.5,
                "similarity_boost": 0.6 if language == "tamil" else 0.5,
                "style": 0.3 if language == "tamil" else 0.0,
                "use_speaker_boost": True,
            },
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/text-to-speech/{voice_id}",
                headers=headers,
                json=payload,
                timeout=30,
            )
            if resp.status_code == 200:
                return resp.content
        return b""

    async def text_to_speech_stream(self, text: str, voice_id: str = "hpp4J3VqNfWAUOO0d1Us",
                                   language: str = "english"):
        if not self.api_key:
            raise RuntimeError("ElevenLabs API Key not configured")

        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key,
        }

        model_id = "eleven_multilingual_v2"
        if language == "tamil":
            model_id = "eleven_turbo_v2_5"

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.4 if language == "tamil" else 0.5,
                "similarity_boost": 0.6 if language == "tamil" else 0.5,
                "style": 0.3 if language == "tamil" else 0.0,
                "use_speaker_boost": True,
            },
        }

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/text-to-speech/{voice_id}/stream",
                headers=headers,
                json=payload,
                timeout=30,
            ) as response:
                if response.status_code == 200:
                    async for chunk in response.aiter_bytes():
                        yield chunk
                else:
                    raise RuntimeError(f"ElevenLabs stream failed with status {response.status_code}")

    def get_available_voices(self) -> list:
        return [
            {"id": "hpp4J3VqNfWAUOO0d1Us", "name": "Bella", "language": "english"},
            {"id": "nPczCzjI2devNBz1zQrb", "name": "Brian (Tamil)", "language": "tamil"},
            {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam", "language": "english"},
            {"id": "cgSgspJ2msm6clMCkdW9", "name": "Jessica", "language": "english"},
            {"id": "CwhRBWXzGAHq8TQ4Fs17", "name": "Roger", "language": "english"},
            {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Sarah", "language": "english"},
            {"id": "IKne3meq5aSn9XLyUdCD", "name": "Charlie", "language": "english"},
            {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "language": "english"},
            {"id": "ThT5KcBeYPX3keUQqHPh", "name": "Priya (Tamil)", "language": "tamil"},
        ]
