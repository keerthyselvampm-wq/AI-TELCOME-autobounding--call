"""
Database migration script for new tables added in Phase 1 of Dynamic
Domain-Based Knowledge Management.

Run:   python -m scripts.migrate

This will create all tables defined in app.models, including:
  - internship_domains
  - domain_batches
  - knowledge_base
  - prompt_templates
  - faq_entries
  - business_hours
  - holiday_schedule
  - audit_logs

Uses SQLAlchemy's create_all which is safe to run multiple times.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import engine, Base
from app import models  # noqa: F401 – registers all models on Base

if __name__ == "__main__":
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Done.")
