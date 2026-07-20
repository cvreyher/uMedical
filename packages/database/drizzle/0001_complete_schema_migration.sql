-- Complete Schema Migration for MedikamentenProfil
-- Generated: 2024-01-24
-- This migration adds multi-source pharmacovigilance support

-- ============================================================================
-- 1. UPDATE SHORTAGES TABLE (Add multi-source fields)
-- ============================================================================

-- Add new columns to shortages table (skip if they already exist)
DO $$
BEGIN
    -- Slug
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'slug') THEN
        ALTER TABLE shortages ADD COLUMN slug TEXT UNIQUE;
    END IF;

    -- Multi-source support
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'source_authority') THEN
        ALTER TABLE shortages ADD COLUMN source_authority TEXT NOT NULL DEFAULT 'EMA';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'region') THEN
        ALTER TABLE shortages ADD COLUMN region TEXT NOT NULL DEFAULT 'EU';
    END IF;

    -- Substance linking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'substance_id') THEN
        ALTER TABLE shortages ADD COLUMN substance_id INTEGER REFERENCES substances(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'inn') THEN
        ALTER TABLE shortages ADD COLUMN inn TEXT;
    END IF;

    -- EMA-specific fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'category') THEN
        ALTER TABLE shortages ADD COLUMN category TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'medicine_affected') THEN
        ALTER TABLE shortages ADD COLUMN medicine_affected TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'therapeutic_area_mesh') THEN
        ALTER TABLE shortages ADD COLUMN therapeutic_area_mesh TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'pharmaceutical_forms_affected') THEN
        ALTER TABLE shortages ADD COLUMN pharmaceutical_forms_affected TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'strengths_affected') THEN
        ALTER TABLE shortages ADD COLUMN strengths_affected TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'availability_of_alternatives') THEN
        ALTER TABLE shortages ADD COLUMN availability_of_alternatives TEXT;
    END IF;

    -- Timeline fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'start_of_shortage_date') THEN
        ALTER TABLE shortages ADD COLUMN start_of_shortage_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'first_published_date') THEN
        ALTER TABLE shortages ADD COLUMN first_published_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'last_updated_date') THEN
        ALTER TABLE shortages ADD COLUMN last_updated_date DATE;
    END IF;

    -- Flexible JSON data
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'shortage_data') THEN
        ALTER TABLE shortages ADD COLUMN shortage_data JSONB;
    END IF;

    -- Deduplication
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'content_hash') THEN
        ALTER TABLE shortages ADD COLUMN content_hash TEXT;
    END IF;

    -- Source document ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shortages' AND column_name = 'source_document_id') THEN
        ALTER TABLE shortages ADD COLUMN source_document_id TEXT;
    END IF;
END $$;

-- Create indexes for new shortage columns
CREATE INDEX IF NOT EXISTS shortages_authority_idx ON shortages(source_authority);
CREATE INDEX IF NOT EXISTS shortages_region_idx ON shortages(region);
CREATE INDEX IF NOT EXISTS shortages_inn_idx ON shortages(inn);
CREATE INDEX IF NOT EXISTS shortages_substance_idx ON shortages(substance_id);
CREATE INDEX IF NOT EXISTS shortages_start_date_idx ON shortages(start_of_shortage_date);
CREATE INDEX IF NOT EXISTS shortages_slug_idx ON shortages(slug);
CREATE INDEX IF NOT EXISTS shortages_authority_status_idx ON shortages(source_authority, status);

-- ============================================================================
-- 2. CREATE PHARMACOVIGILANCE FEED SOURCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pvigilance_feed_sources (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    authority TEXT NOT NULL,
    region TEXT NOT NULL,
    feed_type TEXT NOT NULL,
    feed_url TEXT NOT NULL,
    feed_config JSONB,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_healthy BOOLEAN NOT NULL DEFAULT TRUE,
    poll_interval_minutes INTEGER NOT NULL DEFAULT 60,
    last_fetched_at TIMESTAMP,
    last_success_at TIMESTAMP,
    last_error TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    total_fetches INTEGER NOT NULL DEFAULT 0,
    total_items_processed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pvigilance_feed_sources_authority_idx ON pvigilance_feed_sources(authority);
CREATE INDEX IF NOT EXISTS pvigilance_feed_sources_enabled_idx ON pvigilance_feed_sources(is_enabled);
CREATE INDEX IF NOT EXISTS pvigilance_feed_sources_healthy_idx ON pvigilance_feed_sources(is_healthy);
CREATE INDEX IF NOT EXISTS pvigilance_feed_sources_next_fetch_idx ON pvigilance_feed_sources(is_enabled, last_fetched_at);

-- ============================================================================
-- 3. CREATE PHARMACOVIGILANCE EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pvigilance_events (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    source_authority TEXT NOT NULL,
    region TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_category TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_data JSONB,
    source_url TEXT NOT NULL,
    source_document_id TEXT,
    source_feed_id INTEGER REFERENCES pvigilance_feed_sources(id),
    content_hash TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pvigilance_events_authority_idx ON pvigilance_events(source_authority);
CREATE INDEX IF NOT EXISTS pvigilance_events_region_idx ON pvigilance_events(region);
CREATE INDEX IF NOT EXISTS pvigilance_events_type_idx ON pvigilance_events(event_type);
CREATE INDEX IF NOT EXISTS pvigilance_events_category_idx ON pvigilance_events(event_category);
CREATE INDEX IF NOT EXISTS pvigilance_events_severity_idx ON pvigilance_events(severity);
CREATE INDEX IF NOT EXISTS pvigilance_events_date_idx ON pvigilance_events(event_date);
CREATE INDEX IF NOT EXISTS pvigilance_events_feed_idx ON pvigilance_events(source_feed_id);
CREATE INDEX IF NOT EXISTS pvigilance_events_hash_idx ON pvigilance_events(content_hash);
CREATE INDEX IF NOT EXISTS pvigilance_events_authority_date_idx ON pvigilance_events(source_authority, event_date);
CREATE INDEX IF NOT EXISTS pvigilance_events_type_severity_idx ON pvigilance_events(event_type, severity);

-- ============================================================================
-- 4. CREATE PHARMACOVIGILANCE EVENT-PRODUCT LINKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pvigilance_event_products (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES pvigilance_events(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES medicinal_products(id) ON DELETE CASCADE,
    match_type TEXT NOT NULL,
    match_confidence REAL NOT NULL DEFAULT 1.0,
    match_source TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, product_id)
);

CREATE INDEX IF NOT EXISTS pvigilance_event_products_event_idx ON pvigilance_event_products(event_id);
CREATE INDEX IF NOT EXISTS pvigilance_event_products_product_idx ON pvigilance_event_products(product_id);
CREATE INDEX IF NOT EXISTS pvigilance_event_products_confidence_idx ON pvigilance_event_products(match_confidence);

-- ============================================================================
-- 5. CREATE PHARMACOVIGILANCE EVENT-SUBSTANCE LINKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pvigilance_event_substances (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES pvigilance_events(id) ON DELETE CASCADE,
    substance_id INTEGER REFERENCES substances(id) ON DELETE SET NULL,
    inn TEXT NOT NULL,
    match_type TEXT NOT NULL,
    match_confidence REAL NOT NULL DEFAULT 1.0,
    match_source TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, inn)
);

CREATE INDEX IF NOT EXISTS pvigilance_event_substances_event_idx ON pvigilance_event_substances(event_id);
CREATE INDEX IF NOT EXISTS pvigilance_event_substances_substance_idx ON pvigilance_event_substances(substance_id);
CREATE INDEX IF NOT EXISTS pvigilance_event_substances_inn_idx ON pvigilance_event_substances(inn);
CREATE INDEX IF NOT EXISTS pvigilance_event_substances_confidence_idx ON pvigilance_event_substances(match_confidence);

-- ============================================================================
-- 6. CREATE PHARMACOVIGILANCE FEED LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pvigilance_feed_logs (
    id SERIAL PRIMARY KEY,
    feed_source_id INTEGER NOT NULL REFERENCES pvigilance_feed_sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    items_fetched INTEGER NOT NULL DEFAULT 0,
    items_created INTEGER NOT NULL DEFAULT 0,
    items_updated INTEGER NOT NULL DEFAULT 0,
    items_skipped INTEGER NOT NULL DEFAULT 0,
    http_status INTEGER,
    response_size INTEGER,
    error_message TEXT,
    error_details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pvigilance_feed_logs_feed_idx ON pvigilance_feed_logs(feed_source_id);
CREATE INDEX IF NOT EXISTS pvigilance_feed_logs_status_idx ON pvigilance_feed_logs(status);
CREATE INDEX IF NOT EXISTS pvigilance_feed_logs_fetched_at_idx ON pvigilance_feed_logs(fetched_at);
CREATE INDEX IF NOT EXISTS pvigilance_feed_logs_feed_fetched_idx ON pvigilance_feed_logs(feed_source_id, fetched_at);

-- ============================================================================
-- 7. CREATE REGIONAL AUTHORIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS regional_authorizations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES medicinal_products(id) ON DELETE CASCADE,
    substance_id INTEGER REFERENCES substances(id) ON DELETE CASCADE,
    inn TEXT NOT NULL,
    region TEXT NOT NULL,
    authority TEXT NOT NULL,
    status TEXT NOT NULL,
    brand_name TEXT,
    local_product_code TEXT,
    authorization_date DATE,
    authorization_holder TEXT,
    therapeutic_indication TEXT,
    source_url TEXT,
    last_verified_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, region),
    UNIQUE NULLS NOT DISTINCT (substance_id, region)
);

CREATE INDEX IF NOT EXISTS regional_authorizations_product_idx ON regional_authorizations(product_id);
CREATE INDEX IF NOT EXISTS regional_authorizations_substance_idx ON regional_authorizations(substance_id);
CREATE INDEX IF NOT EXISTS regional_authorizations_inn_idx ON regional_authorizations(inn);
CREATE INDEX IF NOT EXISTS regional_authorizations_region_idx ON regional_authorizations(region);
CREATE INDEX IF NOT EXISTS regional_authorizations_status_idx ON regional_authorizations(status);
CREATE INDEX IF NOT EXISTS regional_authorizations_inn_region_idx ON regional_authorizations(inn, region);

-- ============================================================================
-- 8. CREATE REGIONAL AUTHORIZATION HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS regional_authorization_history (
    id SERIAL PRIMARY KEY,
    authorization_id INTEGER NOT NULL REFERENCES regional_authorizations(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    change_reason TEXT,
    changed_at DATE NOT NULL,
    source_url TEXT,
    source_event_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS regional_auth_history_auth_idx ON regional_authorization_history(authorization_id);
CREATE INDEX IF NOT EXISTS regional_auth_history_changed_at_idx ON regional_authorization_history(changed_at);

-- ============================================================================
-- DONE
-- ============================================================================
