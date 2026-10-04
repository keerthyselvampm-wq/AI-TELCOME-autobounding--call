import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import date, datetime, time
from app.models import StudentStatus, DocumentStatus, BatchType, CallType, CallOutcome, IvrOption


PHONE_REGEX = re.compile(r"^\+?\d{7,15}$")


class StudentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    college: str = Field(..., min_length=1, max_length=255)
    domain: str = Field(..., min_length=1, max_length=255)
    contact_number: str = Field(..., min_length=7, max_length=20)
    joining_date: date
    duration: str = Field(..., min_length=1, max_length=50)
    batch: BatchType

    @field_validator("contact_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not PHONE_REGEX.match(v.strip()):
            raise ValueError("contact_number must be 7-15 digits, optionally starting with +")
        return v.strip()


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    college: Optional[str] = None
    domain: Optional[str] = None
    contact_number: Optional[str] = None
    joining_date: Optional[date] = None
    duration: Optional[str] = None
    batch: Optional[BatchType] = None
    status: Optional[StudentStatus] = None
    document_status: Optional[DocumentStatus] = None
    missed_joining_reason: Optional[str] = None
    rescheduled_date: Optional[date] = None
    rescheduled_batch: Optional[str] = None


class StudentResponse(BaseModel):
    id: int
    name: str
    college: str
    domain: str
    contact_number: str
    joining_date: date
    duration: str
    batch: BatchType
    status: StudentStatus
    document_status: DocumentStatus
    missed_joining_reason: Optional[str] = None
    rescheduled_date: Optional[date] = None
    rescheduled_batch: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PendingFollowupStudent(BaseModel):
    id: int
    name: str
    college: str
    domain: str
    contact_number: str
    joining_date: date
    duration: str
    batch: BatchType
    status: StudentStatus
    document_status: DocumentStatus
    missed_joining_reason: Optional[str] = None
    rescheduled_date: Optional[date] = None
    rescheduled_batch: Optional[str] = None
    reason: str
    created_at: datetime


class PendingFollowupSegment(BaseModel):
    segment: str
    label: str
    count: int
    students: List[PendingFollowupStudent]


class BulkCallRequest(BaseModel):
    student_ids: List[int]
    agent_type: str = "missed_joining"
    delay_seconds: int = 5


class AIAddStudentRequest(BaseModel):
    text: str
    student_id: Optional[int] = None


class AIAddStudentResponse(BaseModel):
    student: StudentResponse
    ai_parsed: dict
    action: str


class CallLogCreate(BaseModel):
    student_id: Optional[int] = None
    call_type: CallType
    call_sid: Optional[str] = None
    duration: Optional[int] = 0
    transcript: Optional[str] = None
    recording_url: Optional[str] = None
    outcome: Optional[CallOutcome] = None
    ai_summary: Optional[str] = None
    language: Optional[str] = "english"


class CallLogUpdate(BaseModel):
    student_id: Optional[int] = None
    call_type: Optional[CallType] = None
    call_sid: Optional[str] = None
    duration: Optional[int] = None
    transcript: Optional[str] = None
    recording_url: Optional[str] = None
    outcome: Optional[CallOutcome] = None
    ai_summary: Optional[str] = None
    language: Optional[str] = None
    caller_number: Optional[str] = None
    ivr_option: Optional[IvrOption] = None
    agent_type: Optional[str] = None
    call_notes: Optional[str] = None
    business_hours: Optional[str] = None


class CallLogResponse(BaseModel):
    id: int
    student_id: Optional[int]
    call_type: CallType
    call_sid: Optional[str]
    timestamp: datetime
    duration: int
    transcript: Optional[str]
    recording_url: Optional[str]
    outcome: Optional[CallOutcome]
    ai_summary: Optional[str]
    language: str
    caller_number: Optional[str] = None
    ivr_option: Optional[str] = None
    agent_type: Optional[str] = None
    call_notes: Optional[str] = None

    model_config = {"from_attributes": True}


class AgentConfigCreate(BaseModel):
    agent_type: str
    system_prompt: str
    greeting_message: str = ""
    voice: str = "default"
    ai_model: str = "deepseek/deepseek-chat-v3-0324"
    temperature: int = 70
    max_tokens: int = 300
    is_active: bool = True


class AgentConfigUpdate(BaseModel):
    system_prompt: Optional[str] = None
    greeting_message: Optional[str] = None
    voice: Optional[str] = None
    ai_model: Optional[str] = None
    temperature: Optional[int] = None
    max_tokens: Optional[int] = None
    is_active: Optional[bool] = None


class AgentConfigResponse(BaseModel):
    id: int
    agent_type: str
    system_prompt: str
    greeting_message: str
    voice: str
    ai_model: str
    temperature: int
    max_tokens: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CallAnalyticsFilter(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    call_type: Optional[CallType] = None
    outcome: Optional[CallOutcome] = None
    ivr_option: Optional[IvrOption] = None
    agent_type: Optional[str] = None
    caller_number: Optional[str] = None


class SlotCreate(BaseModel):
    date: date
    batch: BatchType
    capacity: int


class SlotUpdate(BaseModel):
    capacity: Optional[int] = None
    occupied: Optional[int] = None


class SlotResponse(BaseModel):
    id: int
    date: date
    batch: BatchType
    capacity: int
    occupied: int
    available: int

    model_config = {"from_attributes": True}


class SlotDomainAllocationCreate(BaseModel):
    domain_id: int
    max_capacity: int


class SlotDomainAllocationUpdate(BaseModel):
    max_capacity: Optional[int] = None


class SlotDomainAllocationResponse(BaseModel):
    id: int
    slot_id: int
    domain_id: int
    domain_name: Optional[str] = None
    max_capacity: int
    occupied: int
    available: int

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_calls: int
    today_calls: int
    confirmed_students: int
    pending_students: int
    cancelled_students: int
    total_students: int
    available_slots: int


class StudentFilter(BaseModel):
    name: Optional[str] = None
    college: Optional[str] = None
    domain: Optional[str] = None
    batch: Optional[BatchType] = None
    status: Optional[StudentStatus] = None
    joining_date_from: Optional[date] = None
    joining_date_to: Optional[date] = None


class ConversationTurn(BaseModel):
    role: str
    content: str


class AIResponse(BaseModel):
    message: str
    action: str
    collected_data: Optional[dict] = None


# ── Domain & Batch ────────────────────────────────────────────────

class InternshipDomainCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_options: Optional[str] = None
    eligibility: Optional[str] = None
    skills_learned: Optional[str] = None
    career_prospects: Optional[str] = None
    fee_structure: Optional[str] = None
    prerequisites: Optional[str] = None
    tools_covered: Optional[str] = None
    project_details: Optional[str] = None
    certification_details: Optional[str] = None
    mode: Optional[str] = "online"
    is_active: bool = True
    sort_order: int = 0


class InternshipDomainUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_options: Optional[str] = None
    eligibility: Optional[str] = None
    skills_learned: Optional[str] = None
    career_prospects: Optional[str] = None
    fee_structure: Optional[str] = None
    prerequisites: Optional[str] = None
    tools_covered: Optional[str] = None
    project_details: Optional[str] = None
    certification_details: Optional[str] = None
    mode: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class InternshipDomainResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    duration_options: Optional[str] = None
    eligibility: Optional[str] = None
    skills_learned: Optional[str] = None
    career_prospects: Optional[str] = None
    fee_structure: Optional[str] = None
    prerequisites: Optional[str] = None
    tools_covered: Optional[str] = None
    project_details: Optional[str] = None
    certification_details: Optional[str] = None
    mode: Optional[str] = "online"
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DomainBatchCreate(BaseModel):
    domain_id: Optional[int] = None
    batch_name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    capacity: int = 30
    schedule: Optional[str] = None
    is_active: bool = True


class DomainBatchUpdate(BaseModel):
    batch_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    capacity: Optional[int] = None
    schedule: Optional[str] = None
    is_active: Optional[bool] = None


class DomainBatchResponse(BaseModel):
    id: int
    domain_id: int
    batch_name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    capacity: int
    occupied: int
    available: int
    schedule: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Knowledge Base ─────────────────────────────────────────────────

class KnowledgeBaseCreate(BaseModel):
    category: str
    key: str
    content: str
    tags: Optional[str] = None
    language: str = "english"
    is_active: bool = True


class KnowledgeBaseUpdate(BaseModel):
    category: Optional[str] = None
    key: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None
    language: Optional[str] = None
    is_active: Optional[bool] = None


class KnowledgeBaseResponse(BaseModel):
    id: int
    category: str
    key: str
    content: str
    tags: Optional[str] = None
    language: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Prompt Templates ───────────────────────────────────────────────

class PromptTemplateCreate(BaseModel):
    agent_type: str
    template_key: str
    template_text: str
    variables: Optional[Any] = None
    is_active: bool = True


class PromptTemplateUpdate(BaseModel):
    template_text: Optional[str] = None
    variables: Optional[Any] = None
    is_active: Optional[bool] = None


class PromptTemplateResponse(BaseModel):
    id: int
    agent_type: str
    template_key: str
    template_text: str
    variables: Optional[Any] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── FAQ Entries ────────────────────────────────────────────────────

class FaqEntryCreate(BaseModel):
    question: str
    answer: str
    keywords: Optional[str] = None
    category: Optional[str] = None
    language: str = "english"
    is_active: bool = True
    sort_order: int = 0


class FaqEntryUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    keywords: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class FaqEntryResponse(BaseModel):
    id: int
    question: str
    answer: str
    keywords: Optional[str] = None
    category: Optional[str] = None
    language: str
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Business Hours & Holidays ──────────────────────────────────────

class BusinessHoursCreate(BaseModel):
    day_of_week: int
    open_time: str
    close_time: str
    is_working_day: bool = True


class BusinessHoursUpdate(BaseModel):
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    is_working_day: Optional[bool] = None


class BusinessHoursResponse(BaseModel):
    id: int
    day_of_week: int
    open_time: str
    close_time: str
    is_working_day: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class HolidayScheduleCreate(BaseModel):
    date: date
    description: Optional[str] = None
    is_recurring_yearly: bool = False


class HolidayScheduleUpdate(BaseModel):
    description: Optional[str] = None
    is_recurring_yearly: Optional[bool] = None


class HolidayScheduleResponse(BaseModel):
    id: int
    date: date
    description: Optional[str] = None
    is_recurring_yearly: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── AI Training Content ─────────────────────────────────────────────

class AITrainingContentCreate(BaseModel):
    agent_type: str = "internship"
    topic: str
    content: str
    category: Optional[str] = None
    priority: int = 0
    config_metadata: Optional[Any] = None
    is_active: bool = True


class AITrainingContentUpdate(BaseModel):
    topic: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[int] = None
    config_metadata: Optional[Any] = None
    is_active: Optional[bool] = None


class AITrainingContentResponse(BaseModel):
    id: int
    agent_type: str
    topic: str
    content: str
    category: Optional[str] = None
    priority: int
    config_metadata: Optional[Any] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Audit Log ──────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: Optional[int] = None
    action: str
    changes: Optional[Any] = None
    performed_by: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}
