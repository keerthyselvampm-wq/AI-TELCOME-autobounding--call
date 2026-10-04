import json
import logging
from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base, SessionLocal

logger = logging.getLogger(__name__)

class CallSession(Base):
    __tablename__ = "call_sessions"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    call_sid = Column(String(255), unique=True, index=True, nullable=False)
    state_json = Column(JSON, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SessionStore:
    @staticmethod
    def get_session(call_sid: str) -> dict | None:
        db = SessionLocal()
        try:
            session_row = db.query(CallSession).filter(CallSession.call_sid == call_sid).first()
            if session_row:
                return session_row.state_json
            return None
        except Exception as e:
            logger.warning(f"Failed to fetch session for {call_sid}: {e}")
            return None
        finally:
            db.close()

    @staticmethod
    def save_session(call_sid: str, state: dict):
        db = SessionLocal()
        try:
            session_row = db.query(CallSession).filter(CallSession.call_sid == call_sid).first()
            if session_row:
                session_row.state_json = state
            else:
                session_row = CallSession(call_sid=call_sid, state_json=state)
                db.add(session_row)
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to save session for {call_sid}: {e}")
            db.rollback()
        finally:
            db.close()

    @staticmethod
    def clear_session(call_sid: str):
        db = SessionLocal()
        try:
            db.query(CallSession).filter(CallSession.call_sid == call_sid).delete()
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to clear session for {call_sid}: {e}")
            db.rollback()
        finally:
            db.close()
