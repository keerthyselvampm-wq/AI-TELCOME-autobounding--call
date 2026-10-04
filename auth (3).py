import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from jose import jwt
import bcrypt as _bcrypt
from app.config import get_settings
from app.database import SessionLocal, engine, Base
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    return _bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=255)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=255)
    secret_key: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


def init_auth_db():
    Base.metadata.create_all(bind=engine)


def seed_default_admin():
    settings = get_settings()
    if not settings.DEFAULT_ADMIN_USERNAME or not settings.DEFAULT_ADMIN_PASSWORD:
        return
    init_auth_db()
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == settings.DEFAULT_ADMIN_USERNAME).first()
        if existing:
            return
        user = User(
            username=settings.DEFAULT_ADMIN_USERNAME,
            password_hash=_hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            role="admin",
        )
        db.add(user)
        db.commit()
        logger.info(f"Default admin user '{settings.DEFAULT_ADMIN_USERNAME}' created")
    except Exception as e:
        logger.warning(f"Could not seed default admin: {e}")
    finally:
        db.close()


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest):
    settings = get_settings()
    if req.secret_key != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid registration key")

    init_auth_db()
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == req.username).first()
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")

        user = User(
            username=req.username,
            password_hash=_hash_password(req.password),
            role="admin",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = jwt.encode(
            {
                "sub": user.username,
                "role": user.role,
                "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRY_HOURS),
            },
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        )
        return TokenResponse(access_token=token, username=user.username, role=user.role)
    finally:
        db.close()


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    settings = get_settings()
    init_auth_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == req.username).first()
        if not user or not _verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account deactivated")

        token = jwt.encode(
            {
                "sub": user.username,
                "role": user.role,
                "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRY_HOURS),
            },
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        )
        return TokenResponse(access_token=token, username=user.username, role=user.role)
    finally:
        db.close()
