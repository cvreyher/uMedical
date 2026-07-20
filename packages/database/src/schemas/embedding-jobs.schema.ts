import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
  jsonb,
} from 'drizzle-orm/pg-core'

/**
 * Embedding Jobs Table
 *
 * Tracks background jobs for generating embeddings from document chunks.
 * Supports resumable processing with progress tracking.
 *
 * Job Types:
 * - 'full': Process all documents without embeddings
 * - 'incremental': Process only new/changed documents
 * - 'reprocess': Re-generate embeddings for specific documents
 *
 * Design Principles:
 * - Idempotent job execution
 * - Progress tracking for long-running jobs
 * - Error capture for debugging
 * - Cost tracking for budget management
 */
export const embeddingJobs = pgTable(
  'embedding_jobs',
  {
    id: serial('id').primaryKey(),

    // Job configuration
    jobType: text('job_type').notNull().default('incremental'), // 'full', 'incremental', 'reprocess'
    model: text('model').notNull().default('text-embedding-3-small'),
    batchSize: integer('batch_size').notNull().default(100),

    // Status
    status: text('status').notNull().default('pending'), // 'pending', 'running', 'completed', 'failed', 'cancelled'

    // Progress tracking
    totalChunks: integer('total_chunks').default(0),
    processedChunks: integer('processed_chunks').default(0),
    failedChunks: integer('failed_chunks').default(0),

    // Cost tracking
    totalTokens: integer('total_tokens').default(0),
    estimatedCostUsd: text('estimated_cost_usd'), // Stored as string to preserve precision

    // Timing
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),

    // Error handling
    lastError: text('last_error'),
    errorCount: integer('error_count').default(0),
    errors: jsonb('errors').$type<string[]>(), // Array of error messages

    // Job metadata
    triggeredBy: text('triggered_by'), // 'api', 'scheduler', 'manual'
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('embedding_jobs_status_idx').on(table.status),
    index('embedding_jobs_job_type_idx').on(table.jobType),
    index('embedding_jobs_created_at_idx').on(table.createdAt),
  ]
)

export type EmbeddingJob = typeof embeddingJobs.$inferSelect
export type NewEmbeddingJob = typeof embeddingJobs.$inferInsert
