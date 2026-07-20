import { Controller, Get, Post, Body, HttpCode, HttpStatus, Inject, Query, Param, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger'

import { ChunkingService } from '../../application/services/chunking.service'
import { DocumentImportService } from '../../application/services/document-import.service'
import { EmbeddingService } from '../../application/services/embedding.service'
import { EntityEmbeddingService } from '../../application/services/entity-embedding.service'
import { JobQueueService } from '../../application/services/job-queue.service'
import { JobProcessorService } from '../../application/services/job-processor.service'
import { PdfExtractionService } from '../../application/services/pdf-extraction.service'
import {
  EMBEDDING_PROVIDER_TOKEN,
  type IEmbeddingProvider,
} from '../../application/ports/embedding-provider.port'
import {
  ImportDocumentsDto,
  ProcessPdfsDto,
  GenerateEmbeddingsDto,
  GenerateEntityEmbeddingsDto,
  QueueJobDto,
  DocumentImportResultDto,
  PdfProcessingResultDto,
  EmbeddingGenerationResultDto,
  EntityEmbeddingResultDto,
  JobStatusDto,
  JobQueueStatsDto,
  RagStatusDto,
} from '../dtos/rag-admin.dto'

/**
 * RAG Admin Controller
 *
 * Administrative endpoints for managing the RAG pipeline:
 * - Document import from EMA
 * - PDF processing and chunking
 * - Embedding generation (documents + entities)
 * - Job queue management
 * - System status
 */
@Controller('admin/rag')
@ApiTags('Admin - RAG')
export class RagAdminController {
  constructor(
    private readonly documentImportService: DocumentImportService,
    private readonly pdfExtractionService: PdfExtractionService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    private readonly entityEmbeddingService: EntityEmbeddingService,
    private readonly jobQueueService: JobQueueService,
    private readonly jobProcessorService: JobProcessorService,
    @Inject(EMBEDDING_PROVIDER_TOKEN) private readonly embeddingProvider: IEmbeddingProvider,
  ) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get RAG system status',
    description: `
Returns comprehensive status of the RAG pipeline including:
- Document import statistics
- PDF processing progress
- Chunking statistics
- Embedding generation status (documents + entities)
- Job queue status
- Provider information
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'RAG system status',
    type: RagStatusDto,
  })
  async getStatus(): Promise<RagStatusDto> {
    const [documents, processing, chunks, embeddings, entityEmbeddings, jobStats] = await Promise.all([
      this.documentImportService.getImportStats(),
      this.pdfExtractionService.getProcessingStats(),
      this.chunkingService.getChunkingStats(),
      this.embeddingService.getEmbeddingStats(),
      this.entityEmbeddingService.getStats(),
      this.jobQueueService.getStats(),
    ])

    const providerInfo = this.embeddingProvider.getInfo()
    const processorStatus = this.jobProcessorService.getStatus()

    return {
      documents,
      processing,
      chunks,
      embeddings: {
        totalChunks: embeddings.totalChunks,
        chunksWithEmbeddings: embeddings.chunksWithEmbeddings,
        chunksWithoutEmbeddings: embeddings.chunksWithoutEmbeddings,
        totalCostUsd: embeddings.totalCostUsd,
        latestJob: embeddings.latestJob
          ? {
              id: embeddings.latestJob.id,
              status: embeddings.latestJob.status,
              processedChunks: embeddings.latestJob.processedChunks || 0,
              completedAt: embeddings.latestJob.completedAt,
            }
          : null,
      },
      entityEmbeddings,
      jobQueue: {
        ...jobStats,
        isProcessing: processorStatus.isProcessing,
      },
      provider: {
        name: providerInfo.name,
        model: providerInfo.model,
        dimensions: providerInfo.dimensions,
      },
    }
  }

  @Post('import-documents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import document metadata from EMA',
    description: `
Fetches document metadata from EMA's official JSON endpoints and
populates the documents table. Documents are linked to products
via EMA product number when possible.

This imports metadata only - PDF content is processed separately.

EMA sources:
- EPAR documents (scientific reports, SmPC, package leaflets)
- Non-EPAR documents (referrals, DHPCs, other regulatory docs)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Import results',
    type: DocumentImportResultDto,
  })
  async importDocuments(@Body() dto: ImportDocumentsDto): Promise<DocumentImportResultDto> {
    return this.documentImportService.importAll({
      eparOnly: dto.eparOnly ?? true,
      languages: dto.languages,
      documentTypes: dto.documentTypes,
    })
  }

  @Post('process-pdfs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process PDFs - download, extract text, and create chunks',
    description: `
Downloads PDFs from EMA servers, extracts text using pdf-parse,
and creates semantic chunks for vector search.

Processing is rate-limited to 1 request/second to respect EMA servers.

Chunking strategies:
- SmPC: Section-aware chunking (17 standard sections)
- Package Leaflet: Section-aware chunking (6 standard sections)
- Other: Fixed-size chunking with overlap
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Processing results',
    type: PdfProcessingResultDto,
  })
  async processPdfs(@Body() dto: ProcessPdfsDto): Promise<PdfProcessingResultDto> {
    return this.pdfExtractionService.processPendingDocuments({
      limit: dto.limit ?? 10,
      documentTypes: dto.documentTypes,
      languages: dto.languages,
    })
  }

  @Post('generate-embeddings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate embeddings for document chunks',
    description: `
Generates vector embeddings for chunks that don't have them yet
using OpenAI's text-embedding-3-small model.

Embedding specs:
- 1536 dimensions
- $0.02 per 1M tokens
- Batched processing (50 chunks per batch)

Progress is tracked in the embedding_jobs table for monitoring.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Embedding generation results',
    type: EmbeddingGenerationResultDto,
  })
  async generateEmbeddings(
    @Body() dto: GenerateEmbeddingsDto
  ): Promise<EmbeddingGenerationResultDto> {
    return this.embeddingService.generateEmbeddings({
      limit: dto.limit,
      jobType: dto.jobType ?? 'incremental',
    })
  }

  @Post('generate-entity-embeddings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate embeddings for products, substances, and companies',
    description: `
Generates vector embeddings for entity metadata to enable direct semantic search:

- **Products**: Name + therapeutic indication + area + ATC code + pharmacotherapeutic group
- **Substances**: INN name + synonyms
- **Companies**: Name + country

This enables searches like "diabetes medication" to directly find relevant products,
not just document chunks mentioning diabetes.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Entity embedding generation results',
    type: EntityEmbeddingResultDto,
  })
  async generateEntityEmbeddings(
    @Body() dto: GenerateEntityEmbeddingsDto
  ): Promise<EntityEmbeddingResultDto> {
    if (dto.entityType === 'all') {
      return this.entityEmbeddingService.generateAllEntityEmbeddings()
    }

    switch (dto.entityType) {
      case 'product':
        const productResult = await this.entityEmbeddingService.generateProductEmbeddings(dto.entityId)
        return { products: productResult, substances: null, companies: null, totalCostUsd: productResult.estimatedCostUsd }

      case 'substance':
        const substanceResult = await this.entityEmbeddingService.generateSubstanceEmbeddings(dto.entityId)
        return { products: null, substances: substanceResult, companies: null, totalCostUsd: substanceResult.estimatedCostUsd }

      case 'company':
        const companyResult = await this.entityEmbeddingService.generateCompanyEmbeddings(dto.entityId)
        return { products: null, substances: null, companies: companyResult, totalCostUsd: companyResult.estimatedCostUsd }

      default:
        return this.entityEmbeddingService.generateAllEntityEmbeddings()
    }
  }

  // =====================
  // Job Queue Endpoints
  // =====================

  @Get('jobs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get job queue statistics',
    description: 'Returns the current state of the job queue including counts by status and type.',
  })
  @ApiResponse({
    status: 200,
    description: 'Job queue statistics',
    type: JobQueueStatsDto,
  })
  async getJobStats(): Promise<JobQueueStatsDto> {
    const stats = await this.jobQueueService.getStats()
    const processorStatus = this.jobProcessorService.getStatus()

    return {
      ...stats,
      isProcessing: processorStatus.isProcessing,
    }
  }

  @Get('jobs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get job details',
    description: 'Returns details of a specific job by ID.',
  })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job details',
    type: JobStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getJob(@Param('id', ParseIntPipe) id: number): Promise<JobStatusDto | null> {
    const job = await this.jobQueueService.getJob(id)
    if (!job) {
      return null
    }

    return {
      id: job.id,
      jobType: job.jobType,
      entityType: job.entityType,
      entityId: job.entityId,
      status: job.status,
      priority: job.priority,
      progress: job.progress,
      progressMessage: job.progressMessage,
      errorMessage: job.errorMessage,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    }
  }

  @Post('jobs/queue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Queue a new processing job',
    description: `
Queue a job for async processing. Jobs are processed by the scheduler every 30 seconds.

Job types:
- **epi_download**: Download ePI for a product
- **pdf_extract**: Extract text from a PDF document
- **embedding**: Generate embeddings for document chunks
- **entity_embedding**: Generate embeddings for products/substances/companies

Jobs support priority (higher = more urgent), scheduling, and automatic retries.
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Job queued',
    type: JobStatusDto,
  })
  async queueJob(@Body() dto: QueueJobDto): Promise<JobStatusDto> {
    let job

    switch (dto.jobType) {
      case 'epi_download':
        job = await this.jobQueueService.queueEpiDownload(
          dto.payload.productSlug as string,
          dto.payload.pmsId as string,
          (dto.payload.languages as string[]) || ['en'],
          { priority: dto.priority, triggeredBy: 'api' }
        )
        break

      case 'pdf_extract':
        job = await this.jobQueueService.queuePdfExtract(
          dto.payload.documentId as number,
          { priority: dto.priority, triggeredBy: 'api' }
        )
        break

      case 'embedding':
        job = await this.jobQueueService.queueEmbedding(
          (dto.payload.scope as 'all' | 'product' | 'document') || 'all',
          dto.payload.entityId as number | undefined,
          { priority: dto.priority, triggeredBy: 'api' }
        )
        break

      case 'entity_embedding':
        job = await this.jobQueueService.queueEntityEmbedding(
          (dto.payload.entityType as 'product' | 'substance' | 'company' | 'all') || 'all',
          dto.payload.entityId as number | undefined,
          { priority: dto.priority, triggeredBy: 'api' }
        )
        break

      default:
        throw new Error(`Unknown job type: ${dto.jobType}`)
    }

    return {
      id: job.id,
      jobType: job.jobType,
      entityType: job.entityType,
      entityId: job.entityId,
      status: job.status,
      priority: job.priority,
      progress: job.progress,
      progressMessage: job.progressMessage,
      errorMessage: job.errorMessage,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    }
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a pending job',
    description: 'Cancels a job that is still in pending status. Running jobs cannot be cancelled.',
  })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job cancelled',
  })
  @ApiResponse({
    status: 400,
    description: 'Job cannot be cancelled (already running or completed)',
  })
  async cancelJob(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const success = await this.jobQueueService.cancelJob(id)
    return { success }
  }

  @Post('jobs/cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clean up old completed/failed jobs',
    description: 'Removes jobs older than the specified number of days that are completed, failed, or cancelled.',
  })
  @ApiQuery({ name: 'olderThanDays', description: 'Days to keep jobs (default: 7)', required: false })
  @ApiResponse({
    status: 200,
    description: 'Number of jobs cleaned up',
  })
  async cleanupJobs(@Query('olderThanDays') olderThanDays?: string): Promise<{ deleted: number }> {
    const days = olderThanDays ? parseInt(olderThanDays, 10) : 7
    const deleted = await this.jobQueueService.cleanupOldJobs(days)
    return { deleted }
  }
}
