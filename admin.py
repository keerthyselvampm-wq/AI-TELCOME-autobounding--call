from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime
from app.database import get_db
from app.models import (
    AgentConfig, InternshipDomain, DomainBatch, KnowledgeBase,
    PromptTemplate, FaqEntry, BusinessHours, HolidaySchedule,
    AITrainingContent, AuditLog
)
from app.schemas import (
    AgentConfigCreate, AgentConfigUpdate, AgentConfigResponse,
    InternshipDomainCreate, InternshipDomainUpdate, InternshipDomainResponse,
    DomainBatchCreate, DomainBatchUpdate, DomainBatchResponse,
    KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse,
    PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateResponse,
    FaqEntryCreate, FaqEntryUpdate, FaqEntryResponse,
    BusinessHoursCreate, BusinessHoursUpdate, BusinessHoursResponse,
    HolidayScheduleCreate, HolidayScheduleUpdate, HolidayScheduleResponse,
    AITrainingContentCreate, AITrainingContentUpdate, AITrainingContentResponse,
    AuditLogResponse,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def _log_audit(db: Session, entity_type: str, entity_id: int, action: str, changes: dict = None):
    log = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        changes=changes,
        performed_by="admin",
    )
    db.add(log)
    db.commit()


# ── Agent Config ───────────────────────────────────────────────────

@router.get("/agents", response_model=List[AgentConfigResponse])
def list_agent_configs(db: Session = Depends(get_db)):
    return db.query(AgentConfig).order_by(AgentConfig.agent_type).all()


@router.get("/agents/{agent_type}", response_model=AgentConfigResponse)
def get_agent_config(agent_type: str, db: Session = Depends(get_db)):
    config = db.query(AgentConfig).filter(AgentConfig.agent_type == agent_type).first()
    if not config:
        raise HTTPException(status_code=404, detail="Agent config not found")
    return config


@router.post("/agents", response_model=AgentConfigResponse, status_code=201)
def create_agent_config(data: AgentConfigCreate, db: Session = Depends(get_db)):
    existing = db.query(AgentConfig).filter(AgentConfig.agent_type == data.agent_type).first()
    if existing:
        raise HTTPException(status_code=400, detail="Agent config already exists for this type")
    config = AgentConfig(
        agent_type=data.agent_type,
        system_prompt=data.system_prompt,
        greeting_message=data.greeting_message,
        voice=data.voice,
        ai_model=data.ai_model,
        temperature=data.temperature,
        max_tokens=data.max_tokens,
        is_active=1 if data.is_active else 0,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.put("/agents/{agent_type}", response_model=AgentConfigResponse)
def update_agent_config(agent_type: str, data: AgentConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(AgentConfig).filter(AgentConfig.agent_type == agent_type).first()
    if not config:
        raise HTTPException(status_code=404, detail="Agent config not found")
    update_data = data.model_dump(exclude_unset=True)
    if "is_active" in update_data:
        update_data["is_active"] = 1 if update_data["is_active"] else 0
    for key, value in update_data.items():
        setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return config


@router.delete("/agents/{agent_type}")
def delete_agent_config(agent_type: str, db: Session = Depends(get_db)):
    config = db.query(AgentConfig).filter(AgentConfig.agent_type == agent_type).first()
    if not config:
        raise HTTPException(status_code=404, detail="Agent config not found")
    db.delete(config)
    db.commit()
    return {"message": "Agent config deleted successfully"}


# ── Internship Domains CRUD ────────────────────────────────────────

@router.get("/domains", response_model=List[InternshipDomainResponse])
def list_domains(db: Session = Depends(get_db)):
    return db.query(InternshipDomain).order_by(InternshipDomain.sort_order).all()


@router.get("/domains/{domain_id}", response_model=InternshipDomainResponse)
def get_domain(domain_id: int, db: Session = Depends(get_db)):
    domain = db.query(InternshipDomain).filter(InternshipDomain.id == domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    return domain


@router.post("/domains", response_model=InternshipDomainResponse, status_code=201)
def create_domain(data: InternshipDomainCreate, db: Session = Depends(get_db)):
    existing = db.query(InternshipDomain).filter(InternshipDomain.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Domain already exists")
    domain = InternshipDomain(**data.model_dump())
    db.add(domain)
    db.commit()
    db.refresh(domain)
    _log_audit(db, "internship_domain", domain.id, "created", data.model_dump())
    return domain


@router.put("/domains/{domain_id}", response_model=InternshipDomainResponse)
def update_domain(domain_id: int, data: InternshipDomainUpdate, db: Session = Depends(get_db)):
    domain = db.query(InternshipDomain).filter(InternshipDomain.id == domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(domain, key, value)
    db.commit()
    db.refresh(domain)
    _log_audit(db, "internship_domain", domain.id, "updated", update_data)
    return domain


@router.delete("/domains/{domain_id}")
def delete_domain(domain_id: int, db: Session = Depends(get_db)):
    domain = db.query(InternshipDomain).filter(InternshipDomain.id == domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    from app.models import DomainBatch, SlotDomainAllocation
    db.query(SlotDomainAllocation).filter(SlotDomainAllocation.domain_id == domain_id).delete()
    db.query(DomainBatch).filter(DomainBatch.domain_id == domain_id).delete()
    db.delete(domain)
    db.commit()
    _log_audit(db, "internship_domain", domain_id, "deleted", None)
    return {"message": "Domain deleted successfully"}


# ── Domain Batches CRUD ────────────────────────────────────────────

@router.get("/domains/{domain_id}/batches", response_model=List[DomainBatchResponse])
def list_domain_batches(domain_id: int, db: Session = Depends(get_db)):
    return db.query(DomainBatch).filter(
        DomainBatch.domain_id == domain_id
    ).order_by(DomainBatch.start_date).all()


@router.post("/domains/{domain_id}/batches", response_model=DomainBatchResponse, status_code=201)
def create_domain_batch(domain_id: int, data: DomainBatchCreate, db: Session = Depends(get_db)):
    domain = db.query(InternshipDomain).filter(InternshipDomain.id == domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    batch = DomainBatch(domain_id=domain_id, **data.model_dump(exclude={"domain_id"}))
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.put("/batches/{batch_id}", response_model=DomainBatchResponse)
def update_domain_batch(batch_id: int, data: DomainBatchUpdate, db: Session = Depends(get_db)):
    batch = db.query(DomainBatch).filter(DomainBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(batch, key, value)
    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/batches/{batch_id}")
def delete_domain_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(DomainBatch).filter(DomainBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    db.commit()
    return {"message": "Batch deleted successfully"}


# ── Knowledge Base CRUD ────────────────────────────────────────────

@router.get("/knowledge", response_model=List[KnowledgeBaseResponse])
def list_knowledge(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(KnowledgeBase).order_by(KnowledgeBase.category, KnowledgeBase.key)
    if category:
        query = query.filter(KnowledgeBase.category == category)
    return query.all()


@router.get("/knowledge/{knowledge_id}", response_model=KnowledgeBaseResponse)
def get_knowledge(knowledge_id: int, db: Session = Depends(get_db)):
    entry = db.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    return entry


@router.post("/knowledge", response_model=KnowledgeBaseResponse, status_code=201)
def create_knowledge(data: KnowledgeBaseCreate, db: Session = Depends(get_db)):
    entry = KnowledgeBase(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    _log_audit(db, "knowledge_base", entry.id, "created", data.model_dump())
    return entry


@router.put("/knowledge/{knowledge_id}", response_model=KnowledgeBaseResponse)
def update_knowledge(knowledge_id: int, data: KnowledgeBaseUpdate, db: Session = Depends(get_db)):
    entry = db.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    _log_audit(db, "knowledge_base", entry.id, "updated", update_data)
    return entry


@router.delete("/knowledge/{knowledge_id}")
def delete_knowledge(knowledge_id: int, db: Session = Depends(get_db)):
    entry = db.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Knowledge entry deleted successfully"}


# ── Prompt Templates CRUD ──────────────────────────────────────────

@router.get("/prompts", response_model=List[PromptTemplateResponse])
def list_prompts(
    agent_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(PromptTemplate).order_by(PromptTemplate.agent_type, PromptTemplate.template_key)
    if agent_type:
        query = query.filter(PromptTemplate.agent_type == agent_type)
    return query.all()


@router.post("/prompts", response_model=PromptTemplateResponse, status_code=201)
def create_prompt(data: PromptTemplateCreate, db: Session = Depends(get_db)):
    existing = db.query(PromptTemplate).filter(
        PromptTemplate.agent_type == data.agent_type,
        PromptTemplate.template_key == data.template_key
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Prompt template already exists for this agent and key")
    prompt = PromptTemplate(**data.model_dump())
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    _log_audit(db, "prompt_template", prompt.id, "created", data.model_dump())
    return prompt


@router.put("/prompts/{prompt_id}", response_model=PromptTemplateResponse)
def update_prompt(prompt_id: int, data: PromptTemplateUpdate, db: Session = Depends(get_db)):
    prompt = db.query(PromptTemplate).filter(PromptTemplate.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prompt, key, value)
    db.commit()
    db.refresh(prompt)
    _log_audit(db, "prompt_template", prompt.id, "updated", update_data)
    return prompt


@router.delete("/prompts/{prompt_id}")
def delete_prompt(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.query(PromptTemplate).filter(PromptTemplate.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    db.delete(prompt)
    db.commit()
    return {"message": "Prompt template deleted successfully"}


# ── FAQ Entries CRUD ───────────────────────────────────────────────

@router.get("/faqs", response_model=List[FaqEntryResponse])
def list_faqs(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(FaqEntry).order_by(FaqEntry.sort_order)
    if category:
        query = query.filter(FaqEntry.category == category)
    return query.all()


@router.post("/faqs", response_model=FaqEntryResponse, status_code=201)
def create_faq(data: FaqEntryCreate, db: Session = Depends(get_db)):
    entry = FaqEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    _log_audit(db, "faq_entry", entry.id, "created", data.model_dump())
    return entry


@router.put("/faqs/{faq_id}", response_model=FaqEntryResponse)
def update_faq(faq_id: int, data: FaqEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(FaqEntry).filter(FaqEntry.id == faq_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="FAQ entry not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    _log_audit(db, "faq_entry", entry.id, "updated", update_data)
    return entry


@router.delete("/faqs/{faq_id}")
def delete_faq(faq_id: int, db: Session = Depends(get_db)):
    entry = db.query(FaqEntry).filter(FaqEntry.id == faq_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="FAQ entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "FAQ entry deleted successfully"}


# ── Business Hours CRUD ────────────────────────────────────────────

@router.get("/business-hours", response_model=List[BusinessHoursResponse])
def list_business_hours(db: Session = Depends(get_db)):
    return db.query(BusinessHours).order_by(BusinessHours.day_of_week).all()


@router.put("/business-hours/{hours_id}", response_model=BusinessHoursResponse)
def update_business_hours(hours_id: int, data: BusinessHoursUpdate, db: Session = Depends(get_db)):
    hours = db.query(BusinessHours).filter(BusinessHours.id == hours_id).first()
    if not hours:
        raise HTTPException(status_code=404, detail="Business hours not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(hours, key, value)
    db.commit()
    db.refresh(hours)
    _log_audit(db, "business_hours", hours.id, "updated", update_data)
    return hours


@router.post("/business-hours", response_model=BusinessHoursResponse, status_code=201)
def create_business_hours(data: BusinessHoursCreate, db: Session = Depends(get_db)):
    existing = db.query(BusinessHours).filter(
        BusinessHours.day_of_week == data.day_of_week
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Business hours already exist for this day")
    hours = BusinessHours(**data.model_dump())
    db.add(hours)
    db.commit()
    db.refresh(hours)
    return hours


# ── Holiday Schedule CRUD ──────────────────────────────────────────

@router.get("/holidays", response_model=List[HolidayScheduleResponse])
def list_holidays(
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(HolidaySchedule).order_by(HolidaySchedule.date)
    if year:
        query = query.filter(func.extract("year", HolidaySchedule.date) == year)
    return query.all()


@router.post("/holidays", response_model=HolidayScheduleResponse, status_code=201)
def create_holiday(data: HolidayScheduleCreate, db: Session = Depends(get_db)):
    existing = db.query(HolidaySchedule).filter(
        HolidaySchedule.date == data.date
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    holiday = HolidaySchedule(**data.model_dump())
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    _log_audit(db, "holiday_schedule", holiday.id, "created", data.model_dump())
    return holiday


@router.put("/holidays/{holiday_id}", response_model=HolidayScheduleResponse)
def update_holiday(holiday_id: int, data: HolidayScheduleUpdate, db: Session = Depends(get_db)):
    holiday = db.query(HolidaySchedule).filter(HolidaySchedule.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(holiday, key, value)
    db.commit()
    db.refresh(holiday)
    _log_audit(db, "holiday_schedule", holiday.id, "updated", update_data)
    return holiday


@router.delete("/holidays/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    holiday = db.query(HolidaySchedule).filter(HolidaySchedule.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(holiday)
    db.commit()
    return {"message": "Holiday deleted successfully"}


# ── AI Training Content ─────────────────────────────────────────────

@router.get("/training", response_model=List[AITrainingContentResponse])
def list_training_content(
    agent_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(AITrainingContent).order_by(AITrainingContent.priority.desc(), AITrainingContent.topic)
    if agent_type:
        query = query.filter(AITrainingContent.agent_type == agent_type)
    if category:
        query = query.filter(AITrainingContent.category == category)
    return query.all()


@router.get("/training/{training_id}", response_model=AITrainingContentResponse)
def get_training_content(training_id: int, db: Session = Depends(get_db)):
    item = db.query(AITrainingContent).filter(AITrainingContent.id == training_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Training content not found")
    return item


@router.post("/training", response_model=AITrainingContentResponse, status_code=201)
def create_training_content(data: AITrainingContentCreate, db: Session = Depends(get_db)):
    item = AITrainingContent(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    _log_audit(db, "ai_training_content", item.id, "created", data.model_dump())
    return item


@router.put("/training/{training_id}", response_model=AITrainingContentResponse)
def update_training_content(training_id: int, data: AITrainingContentUpdate, db: Session = Depends(get_db)):
    item = db.query(AITrainingContent).filter(AITrainingContent.id == training_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Training content not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    _log_audit(db, "ai_training_content", item.id, "updated", update_data)
    return item


@router.delete("/training/{training_id}")
def delete_training_content(training_id: int, db: Session = Depends(get_db)):
    item = db.query(AITrainingContent).filter(AITrainingContent.id == training_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Training content not found")
    db.delete(item)
    db.commit()
    return {"message": "Training content deleted successfully"}


# ── Audit Logs ─────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    return query.limit(limit).all()


# ── Knowledge Context (for frontend preview) ───────────────────────

@router.get("/context-preview")
def get_context_preview(agent_type: str = Query("internship"), db: Session = Depends(get_db)):
    from app.services.knowledge import KnowledgeService
    ks = KnowledgeService()
    return {
        "domain_context": ks.build_domain_context(),
        "knowledge_context": ks.build_knowledge_context(agent_type),
        "faq_context": ks.build_faq_context(agent_type),
        "availability_context": ks.build_availability_context(),
    }
