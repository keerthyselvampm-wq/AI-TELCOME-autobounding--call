from pydantic_settings import BaseSettings
from functools import lru_cache
import httpx
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/vdart_call_assist"
    SECRET_KEY: str = "change-this-secret-key"
    EXOTEL_ACCOUNT_SID: str = ""
    EXOTEL_API_KEY: str = ""
    EXOTEL_API_TOKEN: str = ""
    EXOTEL_CALLER_ID: str = ""
    OPENROUTER_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    DEEPGRAM_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""
    BASE_URL: str = ""
    RATE_LIMIT_PER_MINUTE: int = 60
    EXOTEL_WEBHOOK_SECRET: str = ""
    LOG_LEVEL: str = "INFO"
    JWT_SECRET: str = "change-this-jwt-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    DEFAULT_AI_PROVIDER: str = "openrouter"
    AI_FALLBACK_ENABLED: bool = True
    CSRF_ENABLED: bool = True
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "vdart@123"

    model_config = {"env_file": ".env", "case_sensitive": True}


@lru_cache()
def get_settings():
    return Settings()


def get_public_url():
    settings = get_settings()
    if settings.BASE_URL:
        return settings.BASE_URL.rstrip("/")
    try:
        response = httpx.get("http://127.0.0.1:4040/api/tunnels", timeout=2)
        if response.status_code == 200:
            data = response.json()
            for tunnel in data.get("tunnels", []):
                if tunnel.get("public_url", "").startswith("https://"):
                    return tunnel["public_url"].rstrip("/")
    except Exception:
        pass
    return None
