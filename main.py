import asyncio
import logging
import time
import os
import secrets
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
from app.database import engine, Base
from app.routes import students, calls, slots, dashboard, exotel_routes, admin, analytics, call_simulator
from app.routes import auth as auth_routes
from app.routes.auth import seed_default_admin
from app.middleware.auth import JWTAuthMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.config import get_settings
import uvicorn


settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, calls_per_minute: int = 60):
        super().__init__(app)
        self.calls_per_minute = calls_per_minute
        self.requests: dict[str, list[float]] = {}
        self._cleanup_task: asyncio.Task | None = None

    async def _cleanup_loop(self):
        while True:
            await asyncio.sleep(300)
            now = time.time()
            stale = [ip for ip, times in self.requests.items()
                     if not any(now - t < 120 for t in times)]
            for ip in stale:
                del self.requests[ip]

    async def dispatch(self, request: Request, call_next):
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60

        if client_ip not in self.requests:
            self.requests[client_ip] = []
        self.requests[client_ip] = [
            t for t in self.requests[client_ip] if now - t < window
        ]

        if len(self.requests[client_ip]) >= self.calls_per_minute:
            logger.warning(f"Rate limit exceeded for {client_ip}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
            )

        self.requests[client_ip].append(now)
        return await call_next(request)


class CSRFMiddleware(BaseHTTPMiddleware):
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}

    async def dispatch(self, request: Request, call_next):
        if settings.CSRF_ENABLED and request.method not in self.SAFE_METHODS:
            origin = request.headers.get("origin", "")
            referer = request.headers.get("referer", "")
            is_public = any(p in request.url.path for p in [
                "/api/exotel/", "/api/auth/", "/api/health", "/api/ws/", "/test-call"
            ])
            if not is_public and origin:
                public_url = (settings.BASE_URL or "").rstrip("/")
                allowed = {*allowed_origins, public_url}
                if origin not in allowed:
                    logger.warning(f"CSRF check failed for origin: {origin}")
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Origin not allowed"},
                    )
        return await call_next(request)


def _run_migrations():
    migrations = [
        "ALTER TABLE internship_domains ADD COLUMN IF NOT EXISTS prerequisites TEXT",
        "ALTER TABLE internship_domains ADD COLUMN IF NOT EXISTS tools_covered VARCHAR(500)",
        "ALTER TABLE internship_domains ADD COLUMN IF NOT EXISTS project_details TEXT",
        "ALTER TABLE internship_domains ADD COLUMN IF NOT EXISTS certification_details TEXT",
        "ALTER TABLE internship_domains ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'online'",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS document_status VARCHAR(20) DEFAULT 'not_submitted'",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS missed_joining_reason TEXT",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS rescheduled_date DATE",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS rescheduled_batch VARCHAR(50)",
        "CREATE TABLE IF NOT EXISTS users ("
        "  id SERIAL PRIMARY KEY,"
        "  username VARCHAR(100) UNIQUE NOT NULL,"
        "  password_hash VARCHAR(255) NOT NULL,"
        "  role VARCHAR(50) DEFAULT 'admin',"
        "  is_active BOOLEAN DEFAULT TRUE,"
        "  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"
        ")",
    ]
    with engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception as e:
                logger.warning(f"Migration skipped ({stmt}): {e}")
    seed_default_admin()


def _cleanup_audio_files(max_age_hours: int = 24):
    audio_dir = "audio_output"
    if not os.path.isdir(audio_dir):
        return
    now = time.time()
    removed = 0
    for fname in os.listdir(audio_dir):
        fpath = os.path.join(audio_dir, fname)
        if os.path.isfile(fpath) and fname.endswith(".mp3"):
            age_seconds = now - os.path.getmtime(fpath)
            if age_seconds > max_age_hours * 3600:
                try:
                    os.remove(fpath)
                    removed += 1
                except OSError:
                    pass
    if removed:
        logger.info(f"Cleaned {removed} stale audio files")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting VDart Academy Call Assist API...")
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    logger.info("Database tables created/verified.")
    os.makedirs("audio_output", exist_ok=True)
    _cleanup_audio_files()
    logger.info("Audio output directory created/verified.")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="VDart Academy Call Assist API",
    description="AI-powered Call Automation Platform for VDart Academy",
    version="3.0.0",
    lifespan=lifespan,
)

allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
]
if settings.BASE_URL:
    allowed_origins.append(settings.BASE_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
    max_age=600,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(RateLimitMiddleware, calls_per_minute=settings.RATE_LIMIT_PER_MINUTE)
app.add_middleware(JWTAuthMiddleware)

app.mount("/audio", StaticFiles(directory="audio_output"), name="audio")

app.include_router(auth_routes.router)
app.include_router(students.router)
app.include_router(calls.router)
app.include_router(slots.router)
app.include_router(dashboard.router)
app.include_router(admin.router)
app.include_router(analytics.router)
app.include_router(exotel_routes.router)
app.include_router(call_simulator.router)


@app.get("/test-call", response_class=HTMLResponse)
def test_call_page():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VDart Academy - Test Call</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 { font-size: 24px; color: #333; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 28px; font-size: 14px; }
    label { display: block; font-size: 14px; font-weight: 500; color: #444; margin-bottom: 6px; }
    input {
      width: 100%; padding: 12px 16px; border: 1px solid #ddd;
      border-radius: 8px; font-size: 16px; margin-bottom: 20px;
      transition: border-color 0.2s;
    }
    input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.15); }
    button {
      width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; border: none; border-radius: 8px; font-size: 16px;
      font-weight: 600; cursor: pointer; transition: transform 0.1s, opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    button:active { transform: scale(0.98); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .status { margin-top: 20px; padding: 12px 16px; border-radius: 8px; font-size: 14px; display: none; }
    .status.success { display: block; background: #e6f7ee; color: #1a7d42; border: 1px solid #b7ebc5; }
    .status.error { display: block; background: #fde8e8; color: #c0392b; border: 1px solid #f5c6c6; }
    .status.loading { display: block; background: #eef2ff; color: #4a5568; border: 1px solid #c3d2f7; }
    .note { margin-top: 16px; font-size: 12px; color: #999; text-align: center; }
    .call-sid { margin-top: 8px; font-size: 12px; color: #666; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Test Call</h1>
    <p class="subtitle">Initiate a test outbound call via Exotel</p>
    <form id="callForm">
      <label for="phone">Phone Number</label>
      <input type="tel" id="phone" placeholder="+1234567890" required />
      <button type="submit" id="callBtn">Make Test Call</button>
    </form>
    <div id="status" class="status"></div>
    <div id="callSid" class="call-sid"></div>
    <div id="diagBox"></div>
    <p class="note">Make sure your server is publicly accessible (use ngrok) for Exotel webhooks.</p>
  </div>
  <script>
    const form = document.getElementById('callForm');
    const phone = document.getElementById('phone');
    const btn = document.getElementById('callBtn');
    const status = document.getElementById('status');
    const callSid = document.getElementById('callSid');
    const diagBox = document.getElementById('diagBox');
    async function loadDiag() {
      try {
        const res = await fetch('/api/diagnostics');
        const d = await res.json();
        diagBox.innerHTML = '<div class="status success" style="display:block;margin-bottom:16px">' +
          '<strong>Public URL:</strong> ' + (d.public_url || '<span style="color:red">Not detected</span>') + '<br>' +
          '<strong>Webhook URL:</strong> ' + (d.exotel_webhook_url || 'N/A') + '<br>' +
          '<strong>Exotel Caller ID:</strong> ' + d.exotel_caller_id + '<br>' +
          '<strong>Exotel Configured:</strong> ' + d.exotel_configured +
          '</div>';
      } catch (e) {
        diagBox.innerHTML = '<div class="status error" style="display:block;margin-bottom:16px">Cannot reach backend</div>';
      }
    }
    loadDiag();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      status.className = 'status loading';
      status.textContent = 'Initiating call...';
      callSid.textContent = '';
      try {
        const res = await fetch('/api/exotel/make-test-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to_number: phone.value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed');
        status.className = 'status success';
        status.textContent = 'Call initiated!';
        callSid.textContent = 'SID: ' + data.call_sid;
      } catch (err) {
        status.className = 'status error';
        status.textContent = 'Error: ' + err.message;
      } finally { btn.disabled = false; }
    });
  </script>
</body>
</html>
"""


@app.get("/api/diagnostics")
def diagnostics():
    from app.config import get_public_url
    public_url = get_public_url()
    settings = get_settings()
    return {
        "public_url": public_url,
        "exotel_configured": bool(settings.EXOTEL_API_KEY and settings.EXOTEL_API_TOKEN),
        "exotel_caller_id": settings.EXOTEL_CALLER_ID,
        "exotel_account_sid": settings.EXOTEL_ACCOUNT_SID,
        "exotel_webhook_url": f"{public_url}/api/exotel/incoming-call" if public_url else None,
        "providers_configured": {
            "openrouter": bool(settings.OPENROUTER_API_KEY),
            "openai": bool(settings.OPENAI_API_KEY),
            "anthropic": bool(settings.ANTHROPIC_API_KEY),
            "google": bool(settings.GOOGLE_API_KEY),
        },
        "auth_configured": bool(settings.JWT_SECRET and settings.JWT_SECRET != "change-this-jwt-secret"),
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "VDart Academy Call Assist API", "version": "3.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
