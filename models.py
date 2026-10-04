from sqlalchemy import Column, Integer, String, DateTime, Date, Text, Enum, ForeignKey, Boolean, Float, JSON, Time
from sqlalchemy.sql import func
from app.database import Base
import enum


class StudentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    JOINED = "joined"
    FOLLOW_UP = "follow_up"


class DocumentStatus(str, enum.Enum):
    NOT_SUBMITTED = "not_submitted"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class BatchType(str, enum.Enum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"


class CallType(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class IvrOption(str, enum.Enum):
    INTERNSHIP = "internship"
    HR = "hr"
    GENERAL = "general"
    NONE = "none"


class CallOutcome(str, enum.Enum):
    ANSWERED = "answered"
    NOT_ANSWERED = "not_answered"
    BUSY = "busy"
    CALL_BACK = "call_back"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    college = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=False)
    contact_number = Column(String(20), nullable=False)
    joining_date = Column(Date, nullable=False)
    duration = Column(String(50), nullable=False)
    batch = Column(Enum(BatchType), nullable=False)
    status = Column(Enum(StudentStatus), default=StudentStatus.PENDING)
    document_status = Column(Enum(DocumentStatus), default=DocumentStatus.NOT_SUBMITTED)
    missed_joining_reason = Column(Text, nullable=True)
    rescheduled_date = Column(Date, nullable=True)
    rescheduled_batch = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    call_type = Column(Enum(CallType), nullable=False)
    call_sid = Column(String(255), unique=True, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    duration = Column(Integer, default=0)
    transcript = Column(Text, nullable=True)
    recording_url = Column(Text, nullable=True)
    outcome = Column(Enum(CallOutcome), nullable=True)
    ai_summary = Column(Text, nullable=True)
    language = Column(String(10), default="english")
    caller_number = Column(String(20), nullable=True)
    ivr_option = Column(Enum(IvrOption), default=IvrOption.NONE)
    agent_type = Column(String(50), nullable=True)
    call_notes = Column(Text, nullable=True)
    business_hours = Column(String(50), nullable=True)


class AgentConfig(Base):
    __tablename__ = "agent_configs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    agent_type = Column(String(50), unique=True, nullable=False)
    system_prompt = Column(Text, nullable=False)
    greeting_message = Column(String(500), nullable=False)
    voice = Column(String(50), default="default")
    ai_model = Column(String(100), default="deepseek/deepseek-chat-v3-0324")
    temperature = Column(Integer, default=70)
    max_tokens = Column(Integer, default=300)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SlotManagement(Base):
    __tablename__ = "slot_management"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(Date, nullable=False)
    batch = Column(Enum(BatchType), nullable=False)
    capacity = Column(Integer, nullable=False)
    occupied = Column(Integer, default=0)

    @property
    def available(self):
        return self.capacity - self.occupied


class SlotDomainAllocation(Base):
    """Per-domain capacity limit within a main slot (date+batch)."""
    __tablename__ = "slot_domain_allocations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    slot_id = Column(Integer, ForeignKey("slot_management.id"), nullable=False)
    domain_id = Column(Integer, ForeignKey("internship_domains.id"), nullable=False)
    max_capacity = Column(Integer, nullable=False)
    occupied = Column(Integer, default=0)

    @property
    def available(self):
        return self.max_capacity - self.occupied


class InternshipDomain(Base):
    """Dynamic internship domains that AI agents can reference."""
    __tablename__ = "internship_domains"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    duration_options = Column(String(500), nullable=True)
    eligibility = Column(Text, nullable=True)
    skills_learned = Column(Text, nullable=True)
    career_prospects = Column(Text, nullable=True)
    fee_structure = Column(String(500), nullable=True)
    prerequisites = Column(Text, nullable=True)
    tools_covered = Column(String(500), nullable=True)
    project_details = Column(Text, nullable=True)
    certification_details = Column(Text, nullable=True)
    mode = Column(String(50), default="online")
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DomainBatch(Base):
    """Batch mappings specific to each domain."""
    __tablename__ = "domain_batches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    domain_id = Column(Integer, ForeignKey("internship_domains.id"), nullable=False)
    batch_name = Column(String(50), nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    capacity = Column(Integer, default=30)
    occupied = Column(Integer, default=0)
    schedule = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def available(self):
        return self.capacity - self.occupied


class KnowledgeBase(Base):
    """General knowledge entries dynamically loaded by AI agents."""
    __tablename__ = "knowledge_base"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    category = Column(String(100), nullable=False)
    key = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(String(500), nullable=True)
    language = Column(String(10), default="english")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PromptTemplate(Base):
    """Dynamic prompt templates for AI agents."""
    __tablename__ = "prompt_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    agent_type = Column(String(50), nullable=False)
    template_key = Column(String(100), nullable=False)
    template_text = Column(Text, nullable=False)
    variables = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class FaqEntry(Base):
    """Structured FAQ entries with keyword matching."""
    __tablename__ = "faq_entries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    question = Column(String(500), nullable=False)
    answer = Column(Text, nullable=False)
    keywords = Column(String(500), nullable=True)
    category = Column(String(100), nullable=True)
    language = Column(String(10), default="english")
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class BusinessHours(Base):
    """Business hours configuration."""
    __tablename__ = "business_hours"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    day_of_week = Column(Integer, nullable=False)
    open_time = Column(Time, nullable=False)
    close_time = Column(Time, nullable=False)
    is_working_day = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class HolidaySchedule(Base):
    """Holiday schedule for non-working days."""
    __tablename__ = "holiday_schedule"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(Date, nullable=False, unique=True)
    description = Column(String(500), nullable=True)
    is_recurring_yearly = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AITrainingContent(Base):
    """Structured training content that AI agents use for context building."""
    __tablename__ = "ai_training_content"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    agent_type = Column(String(50), default="internship")
    topic = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    priority = Column(Integer, default=0)
    config_metadata = Column("metadata", JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AuditLog(Base):
    """Audit trail for all admin configuration changes."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(Integer, nullable=True)
    action = Column(String(50), nullable=False)
    changes = Column(JSON, nullable=True)
    performed_by = Column(String(255), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
