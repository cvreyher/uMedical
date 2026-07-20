import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'

import { EMBEDDING_PROVIDER_TOKEN } from './application/ports/embedding-provider.port'
import { ChunkingService } from './application/services/chunking.service'
import { DocumentImportService } from './application/services/document-import.service'
import { EmbeddingService } from './application/services/embedding.service'
import { EntityEmbeddingService } from './application/services/entity-embedding.service'
import { EpiDownloadService } from './application/services/epi-download.service'
import { JobProcessorService } from './application/services/job-processor.service'
import { JobQueueService } from './application/services/job-queue.service'
import { PdfExtractionService } from './application/services/pdf-extraction.service'
import { SearchService } from './application/services/search.service'
import { UnifiedSearchService } from './application/services/unified-search.service'
import { EmaDocumentsApiClient } from './infrastructure/clients/ema-documents-api.client'
import { EpiApiClient } from './infrastructure/clients/epi-api.client'
import { OpenAIEmbeddingClient } from './infrastructure/clients/openai-embedding.client'
import { R2StorageClient } from './infrastructure/clients/r2-storage.client'
import { EpiController } from './presentation/controllers/epi.controller'
import { RagAdminController } from './presentation/controllers/rag-admin.controller'
import { SearchController } from './presentation/controllers/search.controller'

/**
 * RAG Module - Retrieval Augmented Generation for pharmaceutical documents
 *
 * Features:
 * - ePI API integration (structured FHIR data) - primary source
 * - PDF fallback for products not in ePI pilot
 * - Cloudflare R2 storage for documents
 * - Vector embedding generation (OpenAI)
 * - Hybrid search (vector + full-text with RRF)
 * - Unified search across products, substances, companies, documents
 * - PostgreSQL-based job queue for async processing
 *
 * API Routes:
 *
 * Public:
 * - GET /api/search - Hybrid search across documents
 * - GET /api/search/unified - Unified search across all entities
 * - GET /api/epi/search - Search products in ePI
 * - GET /api/epi/languages - Get supported languages
 * - GET /api/epi/languages/:pmsId - Get available languages for a product
 * - POST /api/epi/download - Download ePI for a product
 *
 * Admin:
 * - GET /api/admin/rag/status - RAG system status
 * - POST /api/admin/rag/import-documents - Import document metadata from EMA
 * - POST /api/admin/rag/process-pdfs - Download and extract text from PDFs
 * - POST /api/admin/rag/generate-embeddings - Generate embeddings for chunks
 * - POST /api/admin/rag/generate-entity-embeddings - Generate embeddings for products/substances/companies
 * - GET /api/admin/rag/jobs - Get job queue status
 * - POST /api/admin/rag/jobs/queue - Queue a new job
 */
@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  controllers: [SearchController, EpiController, RagAdminController],
  providers: [
    // Infrastructure - Clients
    EmaDocumentsApiClient,
    EpiApiClient,
    R2StorageClient,
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useClass: OpenAIEmbeddingClient,
    },
    // Application - Services
    DocumentImportService,
    EpiDownloadService,
    PdfExtractionService,
    ChunkingService,
    EmbeddingService,
    EntityEmbeddingService,
    SearchService,
    UnifiedSearchService,
    // Job Queue
    JobQueueService,
    JobProcessorService,
  ],
  exports: [
    SearchService,
    UnifiedSearchService,
    DocumentImportService,
    EpiDownloadService,
    EmbeddingService,
    EntityEmbeddingService,
    JobQueueService,
  ],
})
export class RagModule {}
