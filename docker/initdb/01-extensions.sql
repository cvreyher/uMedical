-- Runs once on first container start (empty data volume).
-- pgvector is required for embedding columns (substances, companies, chunks, …).
CREATE EXTENSION IF NOT EXISTS vector;
