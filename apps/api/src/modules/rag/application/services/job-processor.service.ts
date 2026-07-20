import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JOB_TYPES, type ProcessingJob } from '@workspace/database'

import { JobQueueService } from './job-queue.service'
import { EpiDownloadService } from './epi-download.service'
import { PdfExtractionService } from './pdf-extraction.service'
import { EmbeddingService } from './embedding.service'
import { EntityEmbeddingService } from './entity-embedding.service'

/**
 * Job Processor Service
 *
 * Processes queued jobs via NestJS scheduler.
 * Runs every 30 seconds to pick up pending jobs.
 */
@Injectable()
export class JobProcessorService {
  private readonly logger = new Logger(JobProcessorService.name)
  private isProcessing = false
  private readonly liveFetchEnabled: boolean

  constructor(
    private readonly jobQueue: JobQueueService,
    private readonly epiDownload: EpiDownloadService,
    private readonly pdfExtraction: PdfExtractionService,
    private readonly embeddingService: EmbeddingService,
    private readonly entityEmbedding: EntityEmbeddingService,
    configService: ConfigService,
  ) {
    this.liveFetchEnabled = configService.get<boolean>('LIVE_FETCH_ENABLED') ?? true
    if (!this.liveFetchEnabled) {
      this.logger.warn(
        'Background job processing is DISABLED (LIVE_FETCH_ENABLED=false) - queued jobs stay pending until re-enabled',
      )
    }
  }

  /**
   * Process pending jobs every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPendingJobs(): Promise<void> {
    // Jobs call external APIs (EMA downloads, OpenAI embeddings) - skip when disabled
    if (!this.liveFetchEnabled) {
      return
    }

    // Prevent concurrent processing
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true

    try {
      const pendingJobs = await this.jobQueue.getPendingJobs(5)

      if (pendingJobs.length > 0) {
        this.logger.log(`Processing ${pendingJobs.length} pending jobs`)
      }

      for (const job of pendingJobs) {
        await this.processJob(job)
      }
    } catch (error) {
      // Silently skip if tables don't exist (not yet migrated)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('does not exist') && !errorMessage.includes('relation')) {
        this.logger.error(`Job processor error: ${errorMessage}`)
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process a single job
   */
  private async processJob(pendingJob: ProcessingJob): Promise<void> {
    // Claim the job atomically
    const job = await this.jobQueue.claimJob(pendingJob.id)
    if (!job) {
      // Job was claimed by another processor
      return
    }

    this.logger.log(`Processing job ${job.id}: ${job.jobType}`)

    try {
      switch (job.jobType) {
        case JOB_TYPES.EPI_DOWNLOAD:
          await this.processEpiDownload(job)
          break

        case JOB_TYPES.PDF_EXTRACT:
          await this.processPdfExtract(job)
          break

        case JOB_TYPES.EMBEDDING:
          await this.processEmbedding(job)
          break

        case JOB_TYPES.ENTITY_EMBEDDING:
          await this.processEntityEmbedding(job)
          break

        default:
          throw new Error(`Unknown job type: ${job.jobType}`)
      }

      await this.jobQueue.completeJob(job.id, { completedAt: new Date().toISOString() })
    } catch (error) {
      await this.jobQueue.failJob(job.id, error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Process ePI download job
   */
  private async processEpiDownload(job: ProcessingJob): Promise<void> {
    const payload = job.payload as { productSlug: string; pmsId: string; languages: string[] }

    await this.jobQueue.updateProgress(job.id, { progress: 10, message: 'Starting ePI download' })

    const result = await this.epiDownload.downloadEpi(
      payload.productSlug,
      payload.pmsId,
      payload.languages as any[]
    )

    await this.jobQueue.updateProgress(job.id, { progress: 100, message: 'ePI download complete' })

    // Store result
    await this.jobQueue.completeJob(job.id, {
      documentsDownloaded: result.documentsDownloaded,
      chunksCreated: result.chunksCreated,
      languagesProcessed: result.languagesProcessed,
      errors: result.errors,
    })
  }

  /**
   * Process PDF extraction job
   */
  private async processPdfExtract(job: ProcessingJob): Promise<void> {
    const payload = job.payload as { documentId: number }

    await this.jobQueue.updateProgress(job.id, { progress: 10, message: 'Starting PDF extraction' })

    const result = await this.pdfExtraction.processDocumentById(payload.documentId)

    await this.jobQueue.updateProgress(job.id, { progress: 100, message: 'PDF extraction complete' })

    await this.jobQueue.completeJob(job.id, {
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      extractedLength: result.extractedLength,
    })
  }

  /**
   * Process embedding generation job
   */
  private async processEmbedding(job: ProcessingJob): Promise<void> {
    const payload = job.payload as { scope: string; entityId?: number }

    await this.jobQueue.updateProgress(job.id, { progress: 10, message: 'Starting embedding generation' })

    const result = await this.embeddingService.generateEmbeddings({
      limit: payload.entityId ? undefined : 500, // Process 500 at a time for full runs
    })

    await this.jobQueue.updateProgress(job.id, { progress: 100, message: 'Embedding generation complete' })

    await this.jobQueue.completeJob(job.id, {
      jobId: result.jobId,
      chunksProcessed: result.chunksProcessed,
      totalTokens: result.totalTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      errors: result.errors,
    })
  }

  /**
   * Process entity embedding job (products/substances/companies)
   */
  private async processEntityEmbedding(job: ProcessingJob): Promise<void> {
    const payload = job.payload as { entityType: string; entityId?: number }

    await this.jobQueue.updateProgress(job.id, { progress: 10, message: `Starting ${payload.entityType} embedding` })

    let result

    switch (payload.entityType) {
      case 'product':
        result = await this.entityEmbedding.generateProductEmbeddings(payload.entityId)
        break

      case 'substance':
        result = await this.entityEmbedding.generateSubstanceEmbeddings(payload.entityId)
        break

      case 'company':
        result = await this.entityEmbedding.generateCompanyEmbeddings(payload.entityId)
        break

      case 'all':
        result = await this.entityEmbedding.generateAllEntityEmbeddings()
        break

      default:
        throw new Error(`Unknown entity type: ${payload.entityType}`)
    }

    await this.jobQueue.updateProgress(job.id, { progress: 100, message: 'Entity embedding complete' })

    await this.jobQueue.completeJob(job.id, result as unknown as Record<string, unknown>)
  }

  /**
   * Clean up old jobs (runs daily at midnight)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldJobs(): Promise<void> {
    const deleted = await this.jobQueue.cleanupOldJobs(7)
    if (deleted > 0) {
      this.logger.log(`Cleaned up ${deleted} old jobs`)
    }
  }

  /**
   * Get processor status
   */
  getStatus(): { isProcessing: boolean } {
    return { isProcessing: this.isProcessing }
  }
}
