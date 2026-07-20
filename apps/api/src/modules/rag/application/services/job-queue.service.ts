import { Inject, Injectable, Logger } from '@nestjs/common'
import { processingJobs, JOB_TYPES, JOB_STATUS } from '@workspace/database'
import { eq, and, sql, lte, isNull, or } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { ProcessingJob, NewProcessingJob, JobType, JobStatus } from '@workspace/database'
import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface QueueJobOptions {
  priority?: number
  scheduledAt?: Date
  parentJobId?: number
  triggeredBy?: string
}

export interface JobProgress {
  progress: number
  message?: string
}

/**
 * Job Queue Service
 *
 * PostgreSQL-based job queue for async document processing.
 * Jobs are processed by JobProcessorService via NestJS scheduler.
 */
@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name)

  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  /**
   * Queue a new job
   */
  async queueJob(
    jobType: JobType,
    payload: Record<string, unknown>,
    options?: QueueJobOptions & { entityType?: string; entityId?: number }
  ): Promise<ProcessingJob> {
    const [job] = await this.db
      .insert(processingJobs)
      .values({
        jobType,
        entityType: options?.entityType,
        entityId: options?.entityId,
        status: JOB_STATUS.PENDING,
        priority: options?.priority ?? 0,
        payload,
        scheduledAt: options?.scheduledAt,
        parentJobId: options?.parentJobId,
        triggeredBy: options?.triggeredBy ?? 'api',
      })
      .returning()

    if (!job) {
      throw new Error('Failed to create job')
    }

    this.logger.log(`Queued job ${job.id}: ${jobType}`)
    return job
  }

  /**
   * Queue an ePI download job
   */
  async queueEpiDownload(
    productSlug: string,
    pmsId: string,
    languages: string[],
    options?: QueueJobOptions
  ): Promise<ProcessingJob> {
    return this.queueJob(
      JOB_TYPES.EPI_DOWNLOAD,
      { productSlug, pmsId, languages },
      { ...options, entityType: 'product' }
    )
  }

  /**
   * Queue a PDF extraction job
   */
  async queuePdfExtract(
    documentId: number,
    options?: QueueJobOptions
  ): Promise<ProcessingJob> {
    return this.queueJob(
      JOB_TYPES.PDF_EXTRACT,
      { documentId },
      { ...options, entityType: 'document', entityId: documentId }
    )
  }

  /**
   * Queue an embedding generation job
   */
  async queueEmbedding(
    scope: 'all' | 'product' | 'document',
    entityId?: number,
    options?: QueueJobOptions
  ): Promise<ProcessingJob> {
    return this.queueJob(
      JOB_TYPES.EMBEDDING,
      { scope, entityId },
      { ...options, entityType: scope !== 'all' ? scope : undefined, entityId }
    )
  }

  /**
   * Queue entity embedding generation (products/substances/companies)
   */
  async queueEntityEmbedding(
    entityType: 'product' | 'substance' | 'company' | 'all',
    entityId?: number,
    options?: QueueJobOptions
  ): Promise<ProcessingJob> {
    return this.queueJob(
      JOB_TYPES.ENTITY_EMBEDDING,
      { entityType, entityId },
      { ...options, entityType: entityType !== 'all' ? entityType : undefined, entityId }
    )
  }

  /**
   * Get pending jobs ready to process
   */
  async getPendingJobs(limit = 10): Promise<ProcessingJob[]> {
    const now = new Date()

    return this.db
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.status, JOB_STATUS.PENDING),
          or(
            isNull(processingJobs.scheduledAt),
            lte(processingJobs.scheduledAt, now)
          )
        )
      )
      .orderBy(sql`${processingJobs.priority} DESC, ${processingJobs.createdAt} ASC`)
      .limit(limit)
  }

  /**
   * Claim a job for processing (atomic operation)
   */
  async claimJob(jobId: number): Promise<ProcessingJob | null> {
    const [job] = await this.db
      .update(processingJobs)
      .set({
        status: JOB_STATUS.RUNNING,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processingJobs.id, jobId),
          eq(processingJobs.status, JOB_STATUS.PENDING)
        )
      )
      .returning()

    return job ?? null
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: number, progress: JobProgress): Promise<void> {
    await this.db
      .update(processingJobs)
      .set({
        progress: progress.progress,
        progressMessage: progress.message,
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, jobId))
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: number, result?: Record<string, unknown>): Promise<void> {
    await this.db
      .update(processingJobs)
      .set({
        status: JOB_STATUS.COMPLETED,
        progress: 100,
        result: result ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, jobId))

    this.logger.log(`Job ${jobId} completed`)
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: number, error: Error | string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    // Get current job to check retry count
    const [currentJob] = await this.db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, jobId))

    if (!currentJob) return

    const shouldRetry = currentJob.retryCount < currentJob.maxRetries

    if (shouldRetry) {
      // Schedule for retry with exponential backoff
      const backoffMs = Math.pow(2, currentJob.retryCount) * 1000 // 1s, 2s, 4s, 8s...
      const scheduledAt = new Date(Date.now() + backoffMs)

      await this.db
        .update(processingJobs)
        .set({
          status: JOB_STATUS.PENDING,
          retryCount: currentJob.retryCount + 1,
          errorMessage,
          errorStack,
          scheduledAt,
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId))

      this.logger.warn(`Job ${jobId} failed, will retry in ${backoffMs}ms (attempt ${currentJob.retryCount + 1}/${currentJob.maxRetries})`)
    } else {
      // Max retries reached, mark as failed
      await this.db
        .update(processingJobs)
        .set({
          status: JOB_STATUS.FAILED,
          errorMessage,
          errorStack,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId))

      this.logger.error(`Job ${jobId} failed permanently after ${currentJob.maxRetries} retries: ${errorMessage}`)
    }
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: number): Promise<boolean> {
    const [job] = await this.db
      .update(processingJobs)
      .set({
        status: JOB_STATUS.CANCELLED,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processingJobs.id, jobId),
          eq(processingJobs.status, JOB_STATUS.PENDING)
        )
      )
      .returning()

    return !!job
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: number): Promise<ProcessingJob | null> {
    const [job] = await this.db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, jobId))

    return job ?? null
  }

  /**
   * Get job statistics
   */
  async getStats(): Promise<{
    pending: number
    running: number
    completed: number
    failed: number
    byType: Record<string, number>
  }> {
    const statusCounts = await this.db
      .select({
        status: processingJobs.status,
        count: sql<number>`count(*)`,
      })
      .from(processingJobs)
      .groupBy(processingJobs.status)

    const typeCounts = await this.db
      .select({
        jobType: processingJobs.jobType,
        count: sql<number>`count(*)`,
      })
      .from(processingJobs)
      .where(eq(processingJobs.status, JOB_STATUS.PENDING))
      .groupBy(processingJobs.jobType)

    const stats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      byType: {} as Record<string, number>,
    }

    for (const row of statusCounts) {
      const status = row.status as keyof typeof stats
      if (status in stats && status !== 'byType') {
        stats[status] = Number(row.count)
      }
    }

    for (const row of typeCounts) {
      stats.byType[row.jobType] = Number(row.count)
    }

    return stats
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanupOldJobs(olderThanDays = 7): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)

    const result = await this.db
      .delete(processingJobs)
      .where(
        and(
          or(
            eq(processingJobs.status, JOB_STATUS.COMPLETED),
            eq(processingJobs.status, JOB_STATUS.FAILED),
            eq(processingJobs.status, JOB_STATUS.CANCELLED)
          ),
          lte(processingJobs.completedAt, cutoff)
        )
      )
      .returning({ id: processingJobs.id })

    this.logger.log(`Cleaned up ${result.length} old jobs`)
    return result.length
  }
}
