-- Migration: Add entity embeddings and processing jobs queue
-- Enables semantic search on products, substances, and companies

-- ============================================
-- 1. Add embedding columns to existing tables
-- ============================================

-- Products: embedding for semantic search
ALTER TABLE medicinal_products_extended
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS search_text text,
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp;

-- Substances: embedding for semantic search
ALTER TABLE substances
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS search_text text,
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp;

-- Companies: embedding for semantic search
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS search_text text,
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp;

-- ============================================
-- 2. Create HNSW indexes for vector search
-- ============================================

-- Product embeddings index
CREATE INDEX IF NOT EXISTS medicinal_products_ext_embedding_idx
ON medicinal_products_extended
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Substance embeddings index
CREATE INDEX IF NOT EXISTS substances_embedding_idx
ON substances
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Company embeddings index
CREATE INDEX IF NOT EXISTS companies_embedding_idx
ON companies
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================
-- 3. Create tsvector columns for full-text search
-- ============================================

-- Products full-text search
ALTER TABLE medicinal_products_extended
ADD COLUMN IF NOT EXISTS search_tsv tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(international_non_proprietary_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(therapeutic_indication, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(therapeutic_area_mesh, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(pharmacotherapeutic_group, '')), 'C')
) STORED;

-- Substances full-text search
ALTER TABLE substances
ADD COLUMN IF NOT EXISTS search_tsv tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(inn_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(array_to_string(synonyms, ' '), '')), 'B')
) STORED;

-- Companies full-text search
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS search_tsv tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(country, '')), 'B')
) STORED;

-- GIN indexes for full-text search
CREATE INDEX IF NOT EXISTS medicinal_products_ext_search_tsv_idx
ON medicinal_products_extended USING GIN (search_tsv);

CREATE INDEX IF NOT EXISTS substances_search_tsv_idx
ON substances USING GIN (search_tsv);

CREATE INDEX IF NOT EXISTS companies_search_tsv_idx
ON companies USING GIN (search_tsv);

-- ============================================
-- 4. Create processing jobs table
-- ============================================

CREATE TABLE IF NOT EXISTS processing_jobs (
  id SERIAL PRIMARY KEY,

  -- Job identification
  job_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,

  -- Progress
  progress INTEGER DEFAULT 0,
  progress_message TEXT,

  -- Payload and results
  payload JSONB,
  result JSONB,

  -- Error handling
  error_message TEXT,
  error_stack TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,

  -- Timing
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Metadata
  triggered_by TEXT,
  parent_job_id INTEGER REFERENCES processing_jobs(id)
);

-- Processing jobs indexes
CREATE INDEX IF NOT EXISTS processing_jobs_status_idx ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS processing_jobs_type_status_idx ON processing_jobs(job_type, status);
CREATE INDEX IF NOT EXISTS processing_jobs_priority_idx ON processing_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS processing_jobs_scheduled_idx ON processing_jobs(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS processing_jobs_entity_idx ON processing_jobs(entity_type, entity_id);

-- ============================================
-- 5. Helper function to update search_text
-- ============================================

-- Function to generate product search text
CREATE OR REPLACE FUNCTION update_product_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := COALESCE(NEW.name, '') || ' ' ||
                     COALESCE(NEW.international_non_proprietary_name, '') || ' ' ||
                     COALESCE(NEW.therapeutic_indication, '') || ' ' ||
                     COALESCE(NEW.therapeutic_area_mesh, '') || ' ' ||
                     COALESCE(NEW.atc_code, '') || ' ' ||
                     COALESCE(NEW.pharmacotherapeutic_group, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for product search text
DROP TRIGGER IF EXISTS trg_product_search_text ON medicinal_products_extended;
CREATE TRIGGER trg_product_search_text
BEFORE INSERT OR UPDATE ON medicinal_products_extended
FOR EACH ROW EXECUTE FUNCTION update_product_search_text();

-- Function to generate substance search text
CREATE OR REPLACE FUNCTION update_substance_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := COALESCE(NEW.inn_name, '') || ' ' ||
                     COALESCE(array_to_string(NEW.synonyms, ' '), '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for substance search text
DROP TRIGGER IF EXISTS trg_substance_search_text ON substances;
CREATE TRIGGER trg_substance_search_text
BEFORE INSERT OR UPDATE ON substances
FOR EACH ROW EXECUTE FUNCTION update_substance_search_text();

-- Function to generate company search text
CREATE OR REPLACE FUNCTION update_company_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := COALESCE(NEW.name, '') || ' ' ||
                     COALESCE(NEW.country, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for company search text
DROP TRIGGER IF EXISTS trg_company_search_text ON companies;
CREATE TRIGGER trg_company_search_text
BEFORE INSERT OR UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION update_company_search_text();

-- ============================================
-- 6. Populate search_text for existing rows
-- ============================================

UPDATE medicinal_products_extended SET updated_at = NOW() WHERE search_text IS NULL;
UPDATE substances SET updated_at = NOW() WHERE search_text IS NULL;
UPDATE companies SET updated_at = NOW() WHERE search_text IS NULL;
