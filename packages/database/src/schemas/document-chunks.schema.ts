import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
  unique,
  customType,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { documents } from './documents.schema.js'
import { medicinalProductsExtended } from './medicinal-products-extended.schema.js'

/**
 * Custom type for pgvector
 * Stores 1536-dimensional embeddings (OpenAI text-embedding-3-small)
 */
const vector = customType<{
  data: number[]
  driverData: string
  config: { dimensions: number }
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`
  },
  fromDriver(value: string): number[] {
    // Parse "[0.1,0.2,...]" format from postgres
    return value
      .slice(1, -1)
      .split(',')
      .map((n) => parseFloat(n))
  },
})

/**
 * Custom type for tsvector (full-text search)
 */
const tsvector = customType<{
  data: string
  driverData: string
}>({
  dataType() {
    return 'tsvector'
  },
})

/**
 * Document Chunks Table
 *
 * Stores text chunks extracted from pharmaceutical documents (EPAR, SmPC, PL)
 * with both vector embeddings (for semantic search) and tsvector (for full-text search).
 *
 * Design Principles:
 * - Hybrid search via RRF (Reciprocal Rank Fusion)
 * - HNSW index for fast vector similarity search
 * - GIN index for full-text search
 * - Content hash for deduplication
 * - Provenance tracking to source document
 */
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: serial('id').primaryKey(),

    // Parent relationships
    documentId: integer('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => medicinalProductsExtended.id),

    // Chunk position and structure
    chunkIndex: integer('chunk_index').notNull(), // Order within document
    sectionType: text('section_type'), // 'smpc_section_4.1', 'pl_section_3', 'epar_summary', etc.
    sectionTitle: text('section_title'), // Human-readable section name

    // Content
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(), // SHA-256 for deduplication

    // Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
    embedding: vector('embedding', { dimensions: 1536 }),

    // Full-text search vector
    contentTsv: tsvector('content_tsv'),

    // Metadata
    language: text('language').notNull().default('en'),
    charCount: integer('char_count').notNull(),
    tokenCount: integer('token_count'), // Estimated tokens (chars/4)

    // Versioning
    extractorVersion: text('extractor_version').notNull().default('1.0'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    // Foreign key indexes
    index('document_chunks_document_idx').on(table.documentId),
    index('document_chunks_product_idx').on(table.productId),

    // Section filtering
    index('document_chunks_section_type_idx').on(table.sectionType),

    // Language filtering
    index('document_chunks_language_idx').on(table.language),

    // Deduplication
    unique('document_chunks_hash_unique').on(table.documentId, table.contentHash),

    // GIN index for full-text search (created via SQL, defined here for documentation)
    // Will be created by migration: CREATE INDEX document_chunks_content_tsv_idx ON document_chunks USING GIN (content_tsv)

    // HNSW index for vector similarity (created via SQL, defined here for documentation)
    // Will be created by migration: CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops)
  ]
)

/**
 * SQL statements for creating indexes that require special syntax
 * These should be run via migration after table creation
 */
export const documentChunksIndexSql = {
  // Enable pgvector extension
  enableVector: sql`CREATE EXTENSION IF NOT EXISTS vector`,

  // HNSW index for fast approximate nearest neighbor search
  // vector_cosine_ops for cosine similarity (best for normalized embeddings)
  hnswIndex: sql`CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)`,

  // GIN index for full-text search
  ginIndex: sql`CREATE INDEX IF NOT EXISTS document_chunks_content_tsv_gin_idx
    ON document_chunks
    USING GIN (content_tsv)`,

  // Trigger to auto-update tsvector on insert/update
  tsvectorTrigger: sql`
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

    DROP TRIGGER IF EXISTS document_chunks_tsv_update ON document_chunks;
    CREATE TRIGGER document_chunks_tsv_update
      BEFORE INSERT OR UPDATE OF content, language ON document_chunks
      FOR EACH ROW EXECUTE FUNCTION document_chunks_update_tsv();
  `,
}

export type DocumentChunk = typeof documentChunks.$inferSelect
export type NewDocumentChunk = typeof documentChunks.$inferInsert
