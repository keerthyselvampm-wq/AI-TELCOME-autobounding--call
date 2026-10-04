import logging
import httpx
import json
import asyncio
import websockets
from app.config import get_settings

logger = logging.getLogger(__name__)


class DeepgramStream:
    def __init__(self, api_key: str, language: str = "en", sample_rate: int = 16000):
        self.api_key = api_key
        self.language = language
        self.sample_rate = sample_rate
        self.websocket = None
        self._receive_task = None
        self._keepalive_task = None
        self.on_transcript = None
        self._lock = asyncio.Lock()
        self._is_closed = False

    async def connect(self, on_transcript: callable):
        self.on_transcript = on_transcript
        await self._connect_internal()

    async def _connect_internal(self):
        headers = {
            "Authorization": f"Token {self.api_key}"
        }
        lang_code = "ta" if self.language == "tamil" else "en"
        url = f"wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate={self.sample_rate}&channels=1&language={lang_code}&interim_results=false"
        
        try:
            logger.info(f"Connecting to Deepgram streaming API (lang: {lang_code})...")
            self.websocket = await websockets.connect(url, extra_headers=headers)
            self._is_closed = False
            logger.info("Connected to Deepgram streaming API successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Deepgram streaming API: {e}")
            self._is_closed = True
            raise e
        
        self._receive_task = asyncio.create_task(self._receive_loop())
        self._keepalive_task = asyncio.create_task(self._keepalive_loop())

    async def _receive_loop(self):
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    transcript = data.get("channel", {}).get("alternatives", [{}])[0].get("transcript", "")
                    is_final = data.get("is_final", False)
                    if transcript and is_final:
                        logger.info(f"Deepgram transcript received: {transcript}")
                        if self.on_transcript:
                            # Run the transcript handler as a background task to keep the receive loop non-blocking
                            asyncio.create_task(self.on_transcript(transcript))
                except Exception as parse_err:
                    logger.warning(f"Error parsing Deepgram message: {parse_err}")
        except websockets.exceptions.ConnectionClosed as ecc:
            logger.info(f"Deepgram connection closed in receive loop: {ecc}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in Deepgram receive loop: {e}")
        finally:
            self._is_closed = True

    async def _keepalive_loop(self):
        try:
            while not self._is_closed:
                await asyncio.sleep(5)
                if self.websocket and self.websocket.open:
                    try:
                        await self.websocket.send(json.dumps({"type": "KeepAlive"}))
                        logger.debug("Sent KeepAlive to Deepgram")
                    except Exception as e:
                        logger.warning(f"Failed to send KeepAlive to Deepgram: {e}")
                        break
        except asyncio.CancelledError:
            pass

    async def send_audio(self, chunk: bytes):
        async with self._lock:
            # If the socket is closed or not open, trigger reconnect
            if self._is_closed or not self.websocket or not self.websocket.open:
                logger.info("Deepgram connection is closed or dead. Automatically reconnecting...")
                try:
                    await self.close()
                    await self._connect_internal()
                except Exception as e:
                    logger.error(f"Failed to reconnect to Deepgram: {e}")
                    return
            
            if self.websocket and self.websocket.open:
                try:
                    await self.websocket.send(chunk)
                except Exception as e:
                    logger.warning(f"Error sending audio chunk to Deepgram: {e}")
                    self._is_closed = True

    async def close(self):
        self._is_closed = True
        
        # Clean up loops
        if self._keepalive_task:
            self._keepalive_task.cancel()
            self._keepalive_task = None
        if self._receive_task:
            self._receive_task.cancel()
            self._receive_task = None

        if self.websocket:
            try:
                if self.websocket.open:
                    await self.websocket.send(json.dumps({"type": "CloseStream"}))
            except Exception:
                pass
            try:
                await self.websocket.close()
            except Exception:
                pass
            self.websocket = None
        logger.info("DeepgramStream connection closed and tasks cleaned up")


class SpeechService:
    def __init__(self):
        self.settings = get_settings()
        self.deepgram_api_key = self.settings.DEEPGRAM_API_KEY

    LANG_MAP = {
        "english": "en",
        "tamil": "ta",
        "en": "en",
        "ta": "ta",
    }

    def _resolve_language(self, language: str) -> str:
        return self.LANG_MAP.get(language.lower(), "en")

    async def _download_audio(self, url: str) -> bytes | None:
        settings = get_settings()
        if settings.EXOTEL_API_KEY and settings.EXOTEL_API_TOKEN:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(
                        url,
                        auth=(settings.EXOTEL_API_KEY, settings.EXOTEL_API_TOKEN),
                        timeout=30,
                    )
                    if resp.status_code == 200:
                        return resp.content
                    logger.warning(f"Exotel audio download failed: {resp.status_code}")
            except Exception as e:
                logger.warning(f"Exotel audio download error: {e}")
        return None

    async def transcribe_audio(self, audio_url: str, language: str = "en") -> str:
        if not self.deepgram_api_key:
            return ""

        audio_data = await self._download_audio(audio_url)
        if not audio_data:
            return ""

        dg_lang = self._resolve_language(language)

        headers = {
            "Authorization": f"Token {self.deepgram_api_key}",
            "Content-Type": "audio/wav",
        }
        params = {
            "model": "nova-2",
            "language": dg_lang,
            "smart_format": "true",
            "diarize": "false",
            "punctuate": "true",
        }

        if dg_lang == "ta":
            params["model"] = "nova-2"
            params["language"] = "ta"
            params["tier"] = "nova"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.deepgram.com/v1/listen",
                headers=headers,
                params=params,
                content=audio_data,
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")
            logger.warning(f"Deepgram transcription failed: {response.status_code} - {response.text[:200]}")
        return ""


class WhisperService:
    async def transcribe(self, audio_path: str) -> str:
        return ""

