"""
Seed script to populate default data for dynamic knowledge management.

Run:   python -m scripts.seed
"""
import sys
import os
from datetime import date, time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models import (
    InternshipDomain, DomainBatch, KnowledgeBase, FaqEntry,
    BusinessHours, PromptTemplate, AgentConfig
)


def seed_domains(db):
    domains = [
        InternshipDomain(
            name="AI/ML",
            description="Artificial Intelligence and Machine Learning internship covering neural networks, NLP, computer vision, and predictive modeling.",
            duration_options="1 month, 3 months, 6 months",
            eligibility="Students in 3rd/4th year B.E/B.Tech (CSE, IT, ECE) or MCA/M.Sc with programming background",
            skills_learned="Python, TensorFlow, PyTorch, Scikit-learn, NLP, Computer Vision, Model Deployment",
            career_prospects="AI Engineer, ML Engineer, Data Scientist, NLP Engineer",
            fee_structure="1 month: INR 5,000 | 3 months: INR 12,000 | 6 months: INR 20,000",
            sort_order=1,
        ),
        InternshipDomain(
            name="Data Science",
            description="Data Science internship covering statistics, data visualization, data pipelines, and business analytics.",
            duration_options="1 month, 3 months, 6 months",
            eligibility="Students in 3rd/4th year B.E/B.Tech or M.Sc/PG in Statistics, Mathematics, or related fields",
            skills_learned="Python, R, SQL, Tableau, Power BI, Statistics, Big Data tools",
            career_prospects="Data Scientist, Data Analyst, Business Analyst, BI Developer",
            fee_structure="1 month: INR 5,000 | 3 months: INR 12,000 | 6 months: INR 20,000",
            sort_order=2,
        ),
        InternshipDomain(
            name="Full Stack Development",
            description="Full Stack Web Development internship covering frontend and backend technologies.",
            duration_options="1 month, 3 months, 6 months",
            eligibility="Students in 2nd/3rd/4th year B.E/B.Tech or MCA with basic programming knowledge",
            skills_learned="React, Node.js, Python/Django, MongoDB, PostgreSQL, AWS, Docker",
            career_prospects="Full Stack Developer, Frontend Developer, Backend Developer, DevOps Engineer",
            fee_structure="1 month: INR 5,000 | 3 months: INR 12,000 | 6 months: INR 20,000",
            sort_order=3,
        ),
        InternshipDomain(
            name="Cybersecurity",
            description="Cybersecurity internship covering network security, ethical hacking, cryptography, and compliance.",
            duration_options="1 month, 3 months, 6 months",
            eligibility="Students in 3rd/4th year B.E/B.Tech (CSE, IT) or MCA with networking fundamentals",
            skills_learned="Network Security, Ethical Hacking, Kali Linux, Cryptography, SIEM Tools, Compliance",
            career_prospects="Security Analyst, Ethical Hacker, Security Engineer, SOC Analyst",
            fee_structure="1 month: INR 6,000 | 3 months: INR 15,000 | 6 months: INR 25,000",
            sort_order=4,
        ),
        InternshipDomain(
            name="Cloud Computing",
            description="Cloud Computing internship covering AWS, Azure, GCP, and cloud-native architecture.",
            duration_options="1 month, 3 months, 6 months",
            eligibility="Students in 3rd/4th year B.E/B.Tech or MCA with basic networking and OS knowledge",
            skills_learned="AWS, Azure, GCP, Docker, Kubernetes, Terraform, CI/CD",
            career_prospects="Cloud Engineer, DevOps Engineer, Cloud Architect, SRE",
            fee_structure="1 month: INR 6,000 | 3 months: INR 15,000 | 6 months: INR 25,000",
            sort_order=5,
        ),
        InternshipDomain(
            name="Digital Marketing",
            description="Digital Marketing internship covering SEO, SEM, social media marketing, and analytics.",
            duration_options="1 month, 3 months, 6 months",
            eligibility="Students in any degree program with good communication skills",
            skills_learned="SEO, Google Ads, Social Media Marketing, Content Marketing, Google Analytics",
            career_prospects="Digital Marketing Specialist, SEO Analyst, Social Media Manager, Content Strategist",
            fee_structure="1 month: INR 4,000 | 3 months: INR 10,000 | 6 months: INR 18,000",
            sort_order=6,
        ),
    ]
    for d in domains:
        existing = db.query(InternshipDomain).filter(InternshipDomain.name == d.name).first()
        if not existing:
            db.add(d)
            print(f"  Created domain: {d.name}")
    db.commit()


def seed_batches(db):
    domain = db.query(InternshipDomain).filter(InternshipDomain.name == "AI/ML").first()
    if domain:
        batches = [
            DomainBatch(domain_id=domain.id, batch_name="Morning", schedule="9:00 AM - 12:00 PM", capacity=30),
            DomainBatch(domain_id=domain.id, batch_name="Afternoon", schedule="1:00 PM - 4:00 PM", capacity=25),
            DomainBatch(domain_id=domain.id, batch_name="Evening", schedule="5:00 PM - 8:00 PM", capacity=20),
        ]
        for b in batches:
            existing = db.query(DomainBatch).filter(
                DomainBatch.domain_id == b.domain_id,
                DomainBatch.batch_name == b.batch_name
            ).first()
            if not existing:
                db.add(b)
                print(f"  Created batch: {b.batch_name} for AI/ML")

    for domain in db.query(InternshipDomain).all():
        existing_batches = db.query(DomainBatch).filter(DomainBatch.domain_id == domain.id).count()
        if existing_batches == 0 and domain.name != "AI/ML":
            batches = [
                DomainBatch(domain_id=domain.id, batch_name="Morning", schedule="9:00 AM - 12:00 PM", capacity=30),
                DomainBatch(domain_id=domain.id, batch_name="Afternoon", schedule="1:00 PM - 4:00 PM", capacity=25),
                DomainBatch(domain_id=domain.id, batch_name="Evening", schedule="5:00 PM - 8:00 PM", capacity=20),
            ]
            for b in batches:
                db.add(b)
            print(f"  Created batches for {domain.name}")
    db.commit()


def seed_knowledge(db):
    entries = [
        KnowledgeBase(category="internship", key="internship_overview",
                      content="VDart Academy offers industry-focused internship programs across multiple domains including AI/ML, Data Science, Full Stack Development, Cybersecurity, Cloud Computing, and Digital Marketing. Our programs are designed to bridge the gap between academic learning and industry requirements.",
                      tags="overview, about"),
        KnowledgeBase(category="internship", key="certification",
                      content="All interns receive a course completion certificate from VDart Academy upon successful completion of the program. Interns who perform exceptionally well also receive letter of recommendation and placement assistance.",
                      tags="certificate, certification, completion"),
        KnowledgeBase(category="internship", key="projects",
                      content="Interns work on real-world projects during their program. For AI/ML, projects include building chatbots, image classifiers, and recommendation systems. For Full Stack, interns build complete web applications. All projects are industry-relevant and portfolio-ready.",
                      tags="project, hands-on, practical"),
        KnowledgeBase(category="internship", key="placement_assistance",
                      content="VDart Academy provides 100% placement assistance to all interns. Our placement cell works with 200+ partner companies. We provide resume building, mock interviews, and direct referrals to our hiring partners.",
                      tags="placement, job, career, placement assistance"),
        KnowledgeBase(category="hr", key="hiring_process",
                      content="Our hiring process includes: 1) Application review, 2) Technical assessment, 3) HR interview, 4) Offer letter. The entire process typically takes 1-2 weeks.",
                      tags="hiring, recruitment, process"),
        KnowledgeBase(category="hr", key="benefits",
                      content="VDart employees enjoy: competitive salary, health insurance, annual bonus, learning & development budget, flexible work hours, hybrid work model, and 24 paid leaves per year.",
                      tags="benefits, perks, salary"),
        KnowledgeBase(category="general", key="about_vdart",
                      content="VDart Academy is a leading edtech company specializing in industry-aligned internship and training programs. We have trained 10,000+ students and partner with 200+ companies for placements. Our mission is to make quality tech education accessible to all.",
                      tags="about, company, vdart"),
        KnowledgeBase(category="general", key="contact_info",
                      content="You can reach VDart Academy at: Phone: +91-XXXXXXXXXX, Email: info@vdartacademy.com, Website: www.vdartacademy.com. Our office is located in Chennai, Tamil Nadu.",
                      tags="contact, phone, email, address"),
    ]
    for e in entries:
        existing = db.query(KnowledgeBase).filter(
            KnowledgeBase.category == e.category,
            KnowledgeBase.key == e.key
        ).first()
        if not existing:
            db.add(e)
            print(f"  Created knowledge: {e.category}/{e.key}")
    db.commit()


def seed_faqs(db):
    faqs = [
        FaqEntry(question="What internship domains are available?", category="internship",
                 answer="We offer internships in AI/ML, Data Science, Full Stack Development, Cybersecurity, Cloud Computing, and Digital Marketing. Each program includes hands-on projects, mentorship, and placement assistance.",
                 keywords="domain, domains, available, options, which", sort_order=1),
        FaqEntry(question="How long is the internship program?", category="internship",
                 answer="Internship durations are flexible: 1 month (fast-track), 3 months (standard), or 6 months (deep-dive). You can choose based on your schedule and learning goals.",
                 keywords="duration, long, months, weeks, time, period", sort_order=2),
        FaqEntry(question="What is the fee structure?", category="internship",
                 answer="Fees vary by domain. Generally: 1 month INR 4,000-6,000, 3 months INR 10,000-15,000, 6 months INR 18,000-25,000. Specific domain fees can be shared during registration.",
                 keywords="fee, fees, cost, price, payment, amount, rupees", sort_order=3),
        FaqEntry(question="What are the eligibility criteria?", category="internship",
                 answer="Students in 2nd/3rd/4th year of B.E/B.Tech, MCA, M.Sc, or any related degree program are eligible. Basic programming knowledge is required for technical domains.",
                 keywords="eligible, eligibility, criteria, qualification, require", sort_order=4),
        FaqEntry(question="Do I get a certificate?", category="internship",
                 answer="Yes! All interns receive a completion certificate. Top performers also receive a letter of recommendation and placement assistance.",
                 keywords="certificate, certification, document, proof", sort_order=5),
        FaqEntry(question="What are the batch timings?", category="internship",
                 answer="We offer three batches: Morning (9 AM - 12 PM), Afternoon (1 PM - 4 PM), and Evening (5 PM - 8 PM). You can choose the batch that suits your schedule.",
                 keywords="batch, timing, time, schedule, shift, session", sort_order=6),
        FaqEntry(question="How do I register?", category="internship",
                 answer="You can register by calling us or using our online platform. An AI assistant will guide you through the registration process by collecting your details.",
                 keywords="register, registration, enroll, admission, sign up, apply", sort_order=7),
        FaqEntry(question="Do you offer placement assistance?", category="internship",
                 answer="Yes! We provide 100% placement assistance with resume building, mock interviews, and direct referrals to 200+ partner companies.",
                 keywords="placement, job, career, placement assistance, recruit", sort_order=8),
        FaqEntry(question="What is the mode of internship?", category="internship",
                 answer="We offer both online and hybrid modes. Online interns can attend sessions remotely. Hybrid interns can visit our Chennai campus for selected sessions.",
                 keywords="mode, online, offline, hybrid, remote, in-person, location", sort_order=9),
    ]
    for f in faqs:
        existing = db.query(FaqEntry).filter(FaqEntry.question == f.question).first()
        if not existing:
            db.add(f)
            print(f"  Created FAQ: {f.question[:50]}...")
    db.commit()


def seed_business_hours(db):
    days = [
        (0, "09:00", "18:00", True),   # Monday
        (1, "09:00", "18:00", True),   # Tuesday
        (2, "09:00", "18:00", True),   # Wednesday
        (3, "09:00", "18:00", True),   # Thursday
        (4, "09:00", "18:00", True),   # Friday
        (5, "10:00", "14:00", True),   # Saturday
        (6, "09:00", "17:00", False),  # Sunday
    ]
    for day, open_t, close_t, working in days:
        existing = db.query(BusinessHours).filter(
            BusinessHours.day_of_week == day
        ).first()
        if not existing:
            bh = BusinessHours(
                day_of_week=day,
                open_time=time.fromisoformat(open_t),
                close_time=time.fromisoformat(close_t),
                is_working_day=working,
            )
            db.add(bh)
            import calendar
            print(f"  Created business hours: {calendar.day_name[day]}")
    db.commit()


def seed_agent_configs(db):
    defaults = [
        AgentConfig(
            agent_type="internship",
            system_prompt="""You are a VDart Academy AI internship assistant. Your role is to:
- Answer questions about internship programs, domains, fees, eligibility, and batches
- Collect student registration details (name, college, domain, joining date, duration, batch, contact)
- Check slot availability and confirm registrations
- Use the dynamic domain information provided below to give accurate answers
Be professional, helpful, and conversational. Keep responses concise and friendly.""",
            greeting_message="You have reached the VDart Academy Internship Enquiry desk. I can help you with domain information, registration, and answers to your questions about our internship programs.",
            voice="default",
            ai_model="deepseek/deepseek-chat-v3-0324",
            temperature=70,
            max_tokens=300,
            is_active=True,
        ),
        AgentConfig(
            agent_type="hr",
            system_prompt="""You are a VDart Academy HR support assistant. Your role is to:
- Answer questions about job openings, positions, and hiring process
- Collect candidate details (name, email, position interested in, experience)
- Provide information about employee benefits and company culture
- Schedule interview inquiries
Be professional, helpful, and conversational. Keep responses concise.""",
            greeting_message="You have reached the VDart Academy HR Support desk. I can help you with career opportunities, hiring information, and general HR inquiries.",
            voice="default",
            ai_model="deepseek/deepseek-chat-v3-0324",
            temperature=70,
            max_tokens=300,
            is_active=True,
        ),
        AgentConfig(
            agent_type="missed_joining",
            system_prompt="""You are a VDart Academy follow-up assistant. Your role is to:
- Reach out to students who missed their scheduled internship joining date
- Understand their reason for not joining with empathy and without sounding accusatory
- Offer rescheduling options (new dates, new batches)
- Help them re-register if they are interested
- Be warm, supportive, and encouraging throughout the conversation
Keep responses concise and friendly. Never pressure the student.""",
            greeting_message="Hello, this is a follow-up call from VDart Academy. I see you missed your scheduled internship joining date. I'm here to help — can you tell me how you're doing?",
            voice="default",
            ai_model="deepseek/deepseek-chat-v3-0324",
            temperature=70,
            max_tokens=300,
            is_active=True,
        ),
        AgentConfig(
            agent_type="general",
            system_prompt="""You are a VDart Academy general information assistant. Your role is to:
- Answer general questions about VDart Academy
- Provide information about courses, programs, and services
- Help with general inquiries, contact details, and directions
- Connect callers to the right department
Use the dynamic knowledge base below to provide accurate information.
Be professional, helpful, and conversational. Keep responses concise.""",
            greeting_message="You have reached the VDart Academy General Information desk. How may I assist you today?",
            voice="default",
            ai_model="deepseek/deepseek-chat-v3-0324",
            temperature=70,
            max_tokens=300,
            is_active=True,
        ),
    ]
    for ac in defaults:
        existing = db.query(AgentConfig).filter(AgentConfig.agent_type == ac.agent_type).first()
        if not existing:
            db.add(ac)
            print(f"  Created agent config: {ac.agent_type}")
    db.commit()


def main():
    print("Seeding default data...")
    db = SessionLocal()
    try:
        seed_domains(db)
        seed_batches(db)
        seed_knowledge(db)
        seed_faqs(db)
        seed_business_hours(db)
        seed_agent_configs(db)
        print("\nSeeding complete!")
    except Exception as e:
        print(f"Error during seeding: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
