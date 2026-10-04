from typing import Optional, List, Dict, Any
from datetime import date, datetime, time
from app.database import SessionLocal
from app.models import (
    InternshipDomain, DomainBatch, KnowledgeBase,
    PromptTemplate, FaqEntry, BusinessHours, HolidaySchedule,
    AITrainingContent
)


class KnowledgeService:

    def get_active_domains(self) -> List[InternshipDomain]:
        db = SessionLocal()
        try:
            return db.query(InternshipDomain).filter(
                InternshipDomain.is_active == True
            ).order_by(InternshipDomain.sort_order).all()
        finally:
            db.close()

    def get_domain(self, domain_id: int) -> Optional[InternshipDomain]:
        db = SessionLocal()
        try:
            return db.query(InternshipDomain).filter(
                InternshipDomain.id == domain_id,
                InternshipDomain.is_active == True
            ).first()
        finally:
            db.close()

    def get_domain_by_name(self, name: str) -> Optional[InternshipDomain]:
        db = SessionLocal()
        try:
            return db.query(InternshipDomain).filter(
                InternshipDomain.name.ilike(name),
                InternshipDomain.is_active == True
            ).first()
        finally:
            db.close()

    def get_domain_batches(self, domain_id: int) -> List[DomainBatch]:
        db = SessionLocal()
        try:
            return db.query(DomainBatch).filter(
                DomainBatch.domain_id == domain_id,
                DomainBatch.is_active == True
            ).order_by(DomainBatch.start_date).all()
        finally:
            db.close()

    def get_knowledge_by_category(self, category: str) -> List[KnowledgeBase]:
        db = SessionLocal()
        try:
            return db.query(KnowledgeBase).filter(
                KnowledgeBase.category == category,
                KnowledgeBase.is_active == True
            ).all()
        finally:
            db.close()

    def get_knowledge_by_key(self, category: str, key: str) -> Optional[KnowledgeBase]:
        db = SessionLocal()
        try:
            return db.query(KnowledgeBase).filter(
                KnowledgeBase.category == category,
                KnowledgeBase.key == key,
                KnowledgeBase.is_active == True
            ).first()
        finally:
            db.close()

    def get_faq_entries(self, category: Optional[str] = None) -> List[FaqEntry]:
        db = SessionLocal()
        try:
            query = db.query(FaqEntry).filter(FaqEntry.is_active == True)
            if category:
                query = query.filter(FaqEntry.category == category)
            return query.order_by(FaqEntry.sort_order).all()
        finally:
            db.close()

    def match_faq(self, text: str) -> Optional[str]:
        text_lower = text.lower()
        entries = self.get_faq_entries()
        for entry in entries:
            if entry.keywords:
                keywords = [k.strip().lower() for k in entry.keywords.split(",")]
                for kw in keywords:
                    if kw in text_lower:
                        return entry.answer
        return None

    def get_prompt_template(self, agent_type: str, template_key: str) -> Optional[PromptTemplate]:
        db = SessionLocal()
        try:
            return db.query(PromptTemplate).filter(
                PromptTemplate.agent_type == agent_type,
                PromptTemplate.template_key == template_key,
                PromptTemplate.is_active == True
            ).first()
        finally:
            db.close()

    def get_business_hours(self) -> List[BusinessHours]:
        db = SessionLocal()
        try:
            return db.query(BusinessHours).order_by(BusinessHours.day_of_week).all()
        finally:
            db.close()

    def get_holidays(self) -> List[HolidaySchedule]:
        db = SessionLocal()
        try:
            return db.query(HolidaySchedule).filter(
                HolidaySchedule.date >= date.today()
            ).order_by(HolidaySchedule.date).all()
        finally:
            db.close()

    def is_within_business_hours(self) -> bool:
        now = datetime.now()
        today = now.date()
        current_time = now.time()

        db = SessionLocal()
        try:
            holiday = db.query(HolidaySchedule).filter(
                HolidaySchedule.date == today
            ).first()
            if holiday:
                return False

            day_hours = db.query(BusinessHours).filter(
                BusinessHours.day_of_week == now.weekday(),
                BusinessHours.is_working_day == True
            ).first()
            if not day_hours:
                return False

            open_time = day_hours.open_time
            close_time = day_hours.close_time
            return open_time <= current_time <= close_time
        finally:
            db.close()

    def build_domain_context(self) -> str:
        domains = self.get_active_domains()
        if not domains:
            return ""
        lines = ["Available Internship Domains:"]
        for d in domains:
            lines.append(f"- {d.name}")
            if d.description:
                lines.append(f"  Description: {d.description}")
            if d.duration_options:
                lines.append(f"  Durations: {d.duration_options}")
            if d.eligibility:
                lines.append(f"  Eligibility: {d.eligibility}")
            if d.prerequisites:
                lines.append(f"  Prerequisites: {d.prerequisites}")
            if d.tools_covered:
                lines.append(f"  Tools: {d.tools_covered}")
            if d.skills_learned:
                lines.append(f"  Skills: {d.skills_learned}")
            if d.career_prospects:
                lines.append(f"  Career Prospects: {d.career_prospects}")
            if d.project_details:
                lines.append(f"  Projects: {d.project_details}")
            if d.certification_details:
                lines.append(f"  Certification: {d.certification_details}")
            if d.fee_structure:
                lines.append(f"  Fees: {d.fee_structure}")
            if d.mode:
                lines.append(f"  Mode: {d.mode}")
            batches = self.get_domain_batches(d.id)
            if batches:
                lines.append("  Available Batches:")
                for b in batches:
                    avail = b.available
                    status = f"{avail} slots available" if avail > 0 else "Full"
                    lines.append(f"    - {b.batch_name} ({b.schedule or 'TBD'}) - {status}")
        return "\n".join(lines)

    def build_knowledge_context(self, agent_type: str) -> str:
        """Build context string from knowledge base entries relevant to the agent type."""
        category_map = {
            "internship": ["internship", "general"],
        }
        categories = category_map.get(agent_type, ["general"])
        entries = []
        for cat in categories:
            entries.extend(self.get_knowledge_by_category(cat))
        if not entries:
            return ""
        lines = ["Knowledge Base Information:"]
        for e in entries:
            lines.append(f"- {e.key}: {e.content}")
        return "\n".join(lines)

    def build_faq_context(self, agent_type: str) -> str:
        category_map = {
            "internship": ["internship", "general"],
        }
        categories = category_map.get(agent_type, ["general"])
        entries = []
        for cat in categories:
            entries.extend(self.get_faq_entries(cat))
        if not entries:
            return ""
        lines = ["Frequently Asked Questions:"]
        for e in entries:
            lines.append(f"Q: {e.question}")
            lines.append(f"A: {e.answer}")
        return "\n".join(lines)

    def build_training_context(self, agent_type: str) -> str:
        """Build context from AI training content entries."""
        db = SessionLocal()
        try:
            entries = db.query(AITrainingContent).filter(
                AITrainingContent.agent_type == agent_type,
                AITrainingContent.is_active == True
            ).order_by(AITrainingContent.priority.desc(), AITrainingContent.topic).all()
            if not entries:
                return ""
            grouped: Dict[str, list] = {}
            for e in entries:
                cat = e.category or "General"
                if cat not in grouped:
                    grouped[cat] = []
                grouped[cat].append(e)
            lines = ["AI Training Reference:"]
            for category, items in grouped.items():
                lines.append(f"\n[{category}]")
                for item in items:
                    lines.append(item.content)
            return "\n".join(lines)
        finally:
            db.close()

    def build_availability_context(self) -> str:
        if self.is_within_business_hours():
            return "Current Status: Available (within business hours)"
        hours = self.get_business_hours()
        lines = ["Current Status: Outside business hours"]
        for h in hours:
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            day_name = days[h.day_of_week] if h.day_of_week < len(days) else str(h.day_of_week)
            if h.is_working_day:
                lines.append(f"  {day_name}: {h.open_time.strftime('%I:%M %p')} - {h.close_time.strftime('%I:%M %p')}")
            else:
                lines.append(f"  {day_name}: Closed")
        return "\n".join(lines)

    def build_system_prompt_extension(self, agent_type: str) -> str:
        extensions = []
        domain_context = self.build_domain_context()
        if domain_context:
            extensions.append(domain_context)
        knowledge_context = self.build_knowledge_context(agent_type)
        if knowledge_context:
            extensions.append(knowledge_context)
        faq_context = self.build_faq_context(agent_type)
        if faq_context:
            extensions.append(faq_context)
        training_context = self.build_training_context(agent_type)
        if training_context:
            extensions.append(training_context)
        availability = self.build_availability_context()
        if availability:
            extensions.append(availability)
        if extensions:
            return "\n\n### Current Information from Database:\n" + "\n\n".join(extensions)
        return ""
