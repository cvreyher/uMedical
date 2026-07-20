import { pgTable, serial, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

/**
 * Processing Jobs Queue
 *
 * PostgreSQL-based job queue for async document processing.
 * Processed by NestJS scheduled tasks.
 *
 * Job Types:
 * - epi_download: Download ePI from EMA API
 * - pdf_download: Download PDF from EMA
 * - pdf_extract: Extract text from PDF
 * - chunking: Create chunks from document
 * - embedding: Generate embeddings for chunks
 * - entity_embedding: Generate embeddings for products/substances/companies
 */
export const processingJobs = pgTable(
  'processing_jobs',
  {
    id: serial('id').primaryKey(),

    // Job identification
    jobType: text('job_type').notNull(), // epi_download, pdf_extract, embedding, entity_embedding
    entityType: text('entity_type'), // product, substance, company, document
    entityId: integer('entity_id'), // ID of the entity being processed

    // Status tracking
    status: text('status').notNull().default('pending'), // pending, running, completed, failed, cancelled
    priority: integer('priority').notNull().default(0), // Higher = more urgent

    // Progress
    progress: integer('progress').default(0), // 0-100
    progressMessage: text('progress_message'),

    // Payload and results
    payload: jsonb('payload'), // Job-specific input data
    result: jsonb('result'), // Job-specific output data

    // Error handling
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),

    // Timing
    scheduledAt: timestamp('scheduled_at'), // For delayed jobs
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),

    // Metadata
    triggeredBy: text('triggered_by'), // api, scheduler, manual
    parentJobId: integer('parent_job_id'), // For job chains
  },
  (table) => [
    index('processing_jobs_status_idx').on(table.status),
    index('processing_jobs_type_status_idx').on(table.jobType, table.status),
    index('processing_jobs_priority_idx').on(table.priority),
    index('processing_jobs_scheduled_idx').on(table.scheduledAt),
    index('processing_jobs_entity_idx').on(table.entityType, table.entityId),
  ]
)

export type ProcessingJob = typeof processingJobs.$inferSelect
export type NewProcessingJob = typeof processingJobs.$inferInsert

// Job type constants
export const JOB_TYPES = {
  EPI_DOWNLOAD: 'epi_download',
  PDF_DOWNLOAD: 'pdf_download',
  PDF_EXTRACT: 'pdf_extract',
  CHUNKING: 'chunking',
  EMBEDDING: 'embedding',
  ENTITY_EMBEDDING: 'entity_embedding',
} as const

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES]

// Job status constants
export const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS]
