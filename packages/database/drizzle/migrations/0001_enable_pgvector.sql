-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES medicinal_products_extended(id),
  chunk_index INTEGER NOT NULL,
  section_type TEXT,
  section_title TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding vector(1536),
  content_tsv tsvector,
  language TEXT NOT NULL DEFAULT 'en',
  char_count INTEGER NOT NULL,
  token_count INTEGER,
  extractor_version TEXT NOT NULL DEFAULT '1.0',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, content_hash)
);

-- Create embedding_jobs table
CREATE TABLE IF NOT EXISTS embedding_jobs (
  id SERIAL PRIMARY KEY,
  job_type TEXT NOT NULL DEFAULT 'incremental',
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  batch_size INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending',
  total_chunks INTEGER DEFAULT 0,
  processed_chunks INTEGER DEFAULT 0,
  failed_chunks INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  errors JSONB,
  triggered_by TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add processing fields to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS text_extracted_at TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extractor_version TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Create indexes for document_chunks
CREATE INDEX IF NOT EXISTS document_chunks_document_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_chunks_product_idx ON document_chunks(product_id);
CREATE INDEX IF NOT EXISTS document_chunks_section_type_idx ON document_chunks(section_type);
CREATE INDEX IF NOT EXISTS document_chunks_language_idx ON document_chunks(language);

-- Create indexes for embedding_jobs
CREATE INDEX IF NOT EXISTS embedding_jobs_status_idx ON embedding_jobs(status);
CREATE INDEX IF NOT EXISTS embedding_jobs_job_type_idx ON embedding_jobs(job_type);
CREATE INDEX IF NOT EXISTS embedding_jobs_created_at_idx ON embedding_jobs(created_at);

-- Create index for documents processing status
CREATE INDEX IF NOT EXISTS documents_processing_status_idx ON documents(processing_status);

-- HNSW index for fast approximate nearest neighbor search (vector similarity)
-- vector_cosine_ops for cosine similarity (best for normalized embeddings like OpenAI)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS document_chunks_content_tsv_gin_idx
  ON document_chunks
  USING GIN (content_tsv);

-- Function to auto-update tsvector on insert/update
CREATE OR REPLACE FUNCTION document_chunks_update_tsv() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv := to_tsvector(
    CASE NEW.language
      WHEN 'de' THEN 'german'::regconfig
      WHEN 'en' THEN 'english'::regconfig
      ELSE 'simple'::regconfig
    END,
    coalesce(NEW.content, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update tsvector
DROP TRIGGER IF EXISTS document_chunks_tsv_update ON document_chunks;
CREATE TRIGGER document_chunks_tsv_update
  BEFORE INSERT OR UPDATE OF content, language ON document_chunks
  FOR EACH ROW EXECUTE FUNCTION document_chunks_update_tsv();
