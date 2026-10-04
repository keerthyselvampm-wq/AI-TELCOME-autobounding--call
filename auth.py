import logging
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError
from app.config import get_settings

logger = logging.getLogger(__name__)

PUBLIC_PATHS = {
    "/api/health",
    "/api/diagnostics",
    "/api/auth/login",
    "/api/auth/register",
    "/api/exotel/incoming-call",
    "/api/exotel/ivr-route",
    "/api/exotel/internship",
    "/api/exotel/missed-joining",
    "/api/exotel/outbound-twiml",
    "/api/exotel/call-status",
    "/api/ws/call",
    "/test-call",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/audio",
}


class JWTAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.settings = get_settings()

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        if any(path == p or path.startswith(p.rstrip("/") + "/") or
               path.startswith(p) for p in PUBLIC_PATHS):
            return await call_next(request)

        if path.startswith("/audio/"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"},
            )

        token = auth_header[7:]
        try:
            payload = jwt.decode(
                token,
                self.settings.JWT_SECRET,
                algorithms=[self.settings.JWT_ALGORITHM],
            )
            request.state.user = payload.get("sub", "unknown")
            request.state.user_role = payload.get("role", "admin")
        except JWTError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"},
            )

        return await call_next(request)
