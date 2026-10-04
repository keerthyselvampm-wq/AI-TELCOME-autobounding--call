-- Migration: Domain-based slot allocations
-- Run: psql -d vdart_call_assist -f scripts/migrate_manual.sql

-- 1. Drop domain_id column from slot_management if it was added previously
ALTER TABLE slot_management DROP COLUMN IF EXISTS domain_id;

-- 2. Create domain_batches table if not exists (from knowledge management models)
CREATE TABLE IF NOT EXISTS domain_batches (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER NOT NULL REFERENCES internship_domains(id),
    batch_name VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    capacity INTEGER DEFAULT 30,
    occupied INTEGER DEFAULT 0,
    schedule VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create knowledge_base table if not exists
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    key VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags VARCHAR(500),
    language VARCHAR(10) DEFAULT 'english',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create prompt_templates table if not exists
CREATE TABLE IF NOT EXISTS prompt_templates (
    id SERIAL PRIMARY KEY,
    agent_type VARCHAR(50) NOT NULL,
    template_key VARCHAR(100) NOT NULL,
    template_text TEXT NOT NULL,
    variables JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create faq_entries table if not exists
CREATE TABLE IF NOT EXISTS faq_entries (
    id SERIAL PRIMARY KEY,
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    keywords VARCHAR(500),
    category VARCHAR(100),
    language VARCHAR(10) DEFAULT 'english',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create business_hours table if not exists
CREATE TABLE IF NOT EXISTS business_hours (
    id SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_working_day BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create holiday_schedule table if not exists
CREATE TABLE IF NOT EXISTS holiday_schedule (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    description VARCHAR(500),
    is_recurring_yearly BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create audit_logs table if not exists
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    action VARCHAR(50) NOT NULL,
    changes JSONB,
    performed_by VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create slot_domain_allocations table
CREATE TABLE IF NOT EXISTS slot_domain_allocations (
    id SERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slot_management(id),
    domain_id INTEGER NOT NULL REFERENCES internship_domains(id),
    max_capacity INTEGER NOT NULL,
    occupied INTEGER DEFAULT 0
);
