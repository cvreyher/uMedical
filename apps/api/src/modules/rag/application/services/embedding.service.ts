import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { documentChunks, embeddingJobs, documents } from '@workspace/database'
import { eq, isNull, and, sql } from 'drizzle-orm'

import {
  EMBEDDING_PROVIDER_TOKEN,
  type IEmbeddingProvider,
} from '../ports/embedding-provider.port'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DocumentChunk, EmbeddingJob } from '@workspace/database'
import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface EmbeddingGenerationResult {
  jobId: number
  chunksProcessed: number
  totalTokens: number
  estimatedCostUsd: number
  errors: string[]
}

/**
 * Service for generating and managing embeddings
 *
 * Handles:
 * - Batch embedding generation
 * - Job tracking and progress
 * - Cost estimation
 *
 * Development mode:
 * - Limits embedding to 5 documents max to save costs
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name)
  private readonly BATCH_SIZE = 50 // Process 50 chunks at a time
  private readonly DEV_DOCUMENT_LIMIT = 5 // Max documents to embed in development
  private readonly isDevelopment: boolean

  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN) private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
    private readonly configService: ConfigService,
  ) {
    this.isDevelopment = this.configService.get('NODE_ENV', 'development') !== 'production'
    if (this.isDevelopment) {
      this.logger.log(`Development mode: Embedding limited to ${this.DEV_DOCUMENT_LIMIT} documents`)
    }
  }

  /**
   * Generate embeddings for chunks that don't have them yet
   */
  async generateEmbeddings(options?: {
    limit?: number
    jobType?: 'full' | 'incremental'
  }): Promise<EmbeddingGenerationResult> {
    const jobType = options?.jobType || 'incremental'

    // Create job record
    const [job] = await this.db
      .insert(embeddingJobs)
      .values({
        jobType,
        model: this.embeddingProvider.getInfo().model,
        batchSize: this.BATCH_SIZE,
        status: 'running',
        startedAt: new Date(),
        triggeredBy: 'api',
      })
      .returning()

    if (!job) {
      throw new Error('Failed to create embedding job')
    }

    const result: EmbeddingGenerationResult = {
      jobId: job.id,
      chunksProcessed: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      errors: [],
    }

    try {
      // Find chunks without embeddings
      const chunksToProcess = await this.findChunksWithoutEmbeddings(options?.limit)

      // Update job with total count
      await this.db
        .update(embeddingJobs)
        .set({ totalChunks: chunksToProcess.length })
        .where(eq(embeddingJobs.id, job.id))

      this.logger.log(`Processing ${chunksToProcess.length} chunks for embeddings`)

      // Process in batches
      for (let i = 0; i < chunksToProcess.length; i += this.BATCH_SIZE) {
        const batch = chunksToProcess.slice(i, i + this.BATCH_SIZE)

        try {
          const batchResult = await this.processBatch(batch)

          result.chunksProcessed += batch.length
          result.totalTokens += batchResult.totalTokens

          // Update job progress
          await this.db
            .update(embeddingJobs)
            .set({
              processedChunks: result.chunksProcessed,
              totalTokens: result.totalTokens,
              updatedAt: new Date(),
            })
            .where(eq(embeddingJobs.id, job.id))
        } catch (error) {
          const errorMsg = `Batch ${Math.floor(i / this.BATCH_SIZE) + 1} failed: ${error instanceof Error ? error.message : String(error)}`
          this.logger.error(errorMsg)
          result.errors.push(errorMsg)

          // Update job error count
          await this.db
            .update(embeddingJobs)
            .set({
              failedChunks: sql`${embeddingJobs.failedChunks} + ${batch.length}`,
              errorCount: sql`${embeddingJobs.errorCount} + 1`,
              lastError: errorMsg,
              updatedAt: new Date(),
            })
            .where(eq(embeddingJobs.id, job.id))
        }
      }

      // Calculate cost
      result.estimatedCostUsd = this.embeddingProvider.estimateCost(result.totalTokens)

      // Mark job as completed
      await this.db
        .update(embeddingJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          processedChunks: result.chunksProcessed,
          totalTokens: result.totalTokens,
          estimatedCostUsd: result.estimatedCostUsd.toFixed(6),
          errors: result.errors.length > 0 ? result.errors : null,
          updatedAt: new Date(),
        })
        .where(eq(embeddingJobs.id, job.id))

      // Update documents status to 'embedded'
      await this.updateDocumentStatus()

      this.logger.log(
        `Embedding generation completed: ${result.chunksProcessed} chunks, ${result.totalTokens} tokens, $${result.estimatedCostUsd.toFixed(4)}`
      )
    } catch (error) {
      const errorMsg = `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`
      this.logger.error(errorMsg)
      result.errors.push(errorMsg)

      // Mark job as failed
      await this.db
        .update(embeddingJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          lastError: errorMsg,
          updatedAt: new Date(),
        })
        .where(eq(embeddingJobs.id, job.id))
    }

    return result
  }

  /**
   * Process a batch of chunks
   */
  private async processBatch(
    chunks: DocumentChunk[]
  ): Promise<{ totalTokens: number }> {
    const texts = chunks.map((c) => c.content)

    // Generate embeddings
    const response = await this.embeddingProvider.embedBatch({ texts })

    // Update chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = response.embeddings[i]
      if (!chunk || !embedding) continue

      await this.db
        .update(documentChunks)
        .set({
          embedding,
          updatedAt: new Date(),
        })
        .where(eq(documentChunks.id, chunk.id))
    }

    return { totalTokens: response.totalTokens }
  }

  /**
   * Find chunks that don't have embeddings yet
   * In development mode, limits to chunks from only DEV_DOCUMENT_LIMIT documents
   */
  private async findChunksWithoutEmbeddings(limit?: number): Promise<DocumentChunk[]> {
    // In development, limit to chunks from only 5 documents
    if (this.isDevelopment) {
      // First, find the first N document IDs that have chunks without embeddings
      const docsWithPendingChunks = await this.db
        .selectDistinct({ documentId: documentChunks.documentId })
        .from(documentChunks)
        .where(isNull(documentChunks.embedding))
        .orderBy(documentChunks.documentId)
        .limit(this.DEV_DOCUMENT_LIMIT)

      const documentIds = docsWithPendingChunks
        .map(d => d.documentId)
        .filter((id): id is number => id !== null)

      if (documentIds.length === 0) {
        return []
      }

      this.logger.log(`Development mode: Processing chunks from ${documentIds.length} documents only`)

      // Get chunks only from these documents
      return this.db
        .select()
        .from(documentChunks)
        .where(
          and(
            isNull(documentChunks.embedding),
            sql`${documentChunks.documentId} = ANY(ARRAY[${sql.raw(documentIds.join(','))}]::int[])`
          )
        )
        .orderBy(documentChunks.id)
        .limit(limit ?? 500) // Also apply a chunk limit in dev
    }

    // Production: use the full limit
    const effectiveLimit = limit ?? 10000
    return this.db
      .select()
      .from(documentChunks)
      .where(isNull(documentChunks.embedding))
      .orderBy(documentChunks.id)
      .limit(effectiveLimit)
  }

  /**
   * Update documents with all chunks embedded
   */
  private async updateDocumentStatus(): Promise<void> {
    // Find documents where all chunks have embeddings
    const docsWithAllEmbeddings = await this.db.execute(sql`
      UPDATE documents d
      SET processing_status = 'embedded', updated_at = NOW()
      WHERE d.processing_status = 'chunked'
        AND NOT EXISTS (
          SELECT 1 FROM document_chunks c
          WHERE c.document_id = d.id AND c.embedding IS NULL
        )
    `)
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    totalChunks: number
    chunksWithEmbeddings: number
    chunksWithoutEmbeddings: number
    latestJob: EmbeddingJob | null
    totalCostUsd: number
  }> {
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks)
    const total = totalResult[0]

    const withEmbeddingsResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks)
      .where(sql`embedding IS NOT NULL`)
    const withEmbeddings = withEmbeddingsResult[0]

    const latestJobResult = await this.db
      .select()
      .from(embeddingJobs)
      .orderBy(sql`created_at DESC`)
      .limit(1)
    const latestJob = latestJobResult[0]

    // Sum up all job costs
    const totalCostResult = await this.db
      .select({ total: sql<string>`COALESCE(SUM(estimated_cost_usd::numeric), 0)` })
      .from(embeddingJobs)
      .where(eq(embeddingJobs.status, 'completed'))
    const totalCost = totalCostResult[0]

    const totalCount = total?.count ?? 0
    const withEmbeddingsCount = withEmbeddings?.count ?? 0

    return {
      totalChunks: Number(totalCount),
      chunksWithEmbeddings: Number(withEmbeddingsCount),
      chunksWithoutEmbeddings: Number(totalCount) - Number(withEmbeddingsCount),
      latestJob: latestJob ?? null,
      totalCostUsd: parseFloat(totalCost?.total ?? '0') || 0,
    }
  }
}
