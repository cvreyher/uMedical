import { Inject, Injectable, Logger } from '@nestjs/common'
import { documents } from '@workspace/database'
import { eq, and, inArray } from 'drizzle-orm'
import * as crypto from 'crypto'

import { ChunkingService } from './chunking.service'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { Document } from '@workspace/database'
import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface ExtractionResult {
  documentsProcessed: number
  chunksCreated: number
  errors: string[]
}

interface PdfParseResult {
  numpages: number
  numrender: number
  info: Record<string, unknown>
  metadata: Record<string, unknown>
  text: string
}

/**
 * Service for downloading and extracting text from PDFs
 *
 * Uses pdf-parse (free, Node.js native) for text extraction.
 * Rate-limited to 1 request/second to respect EMA servers.
 */
@Injectable()
export class PdfExtractionService {
  private readonly logger = new Logger(PdfExtractionService.name)
  private readonly USER_AGENT = 'uMedical/1.0 (+https://umedical.store; info@umedical.store)'
  private readonly RATE_LIMIT_MS = 1000 // 1 second between requests

  constructor(
    private readonly chunkingService: ChunkingService,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
  ) {}

  /**
   * Process pending documents - download PDFs, extract text, and create chunks
   */
  async processPendingDocuments(options?: {
    limit?: number
    documentTypes?: string[]
    languages?: string[]
  }): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      documentsProcessed: 0,
      chunksCreated: 0,
      errors: [],
    }

    // Find documents pending processing
    const pendingDocs = await this.findPendingDocuments(options)
    this.logger.log(`Found ${pendingDocs.length} documents pending processing`)

    for (const doc of pendingDocs) {
      try {
        const chunksCreated = await this.processDocument(doc)
        result.documentsProcessed++
        result.chunksCreated += chunksCreated

        // Rate limiting
        await this.sleep(this.RATE_LIMIT_MS)
      } catch (error) {
        const errorMsg = `Failed to process document ${doc.id} "${doc.title}": ${error instanceof Error ? error.message : String(error)}`
        this.logger.error(errorMsg)
        result.errors.push(errorMsg)

        // Mark document as failed
        await this.db
          .update(documents)
          .set({
            processingStatus: 'failed',
            processingError: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(documents.id, doc.id))
      }
    }

    this.logger.log(
      `Processing completed: ${result.documentsProcessed} documents, ${result.chunksCreated} chunks created`
    )

    return result
  }

  /**
   * Process a single document by ID
   * Returns result with document ID, chunk count, and extracted text length
   */
  async processDocumentById(documentId: number): Promise<{
    documentId: number
    chunkCount: number
    extractedLength: number
  }> {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))

    if (!doc) {
      throw new Error(`Document ${documentId} not found`)
    }

    const chunkCount = await this.processDocument(doc)

    return {
      documentId: doc.id,
      chunkCount,
      extractedLength: 0, // We don't track this currently
    }
  }

  /**
   * Process a single document
   */
  private async processDocument(doc: Document): Promise<number> {
    if (!doc.pdfUrl) {
      this.logger.warn(`Document ${doc.id} has no PDF URL, skipping`)
      return 0
    }

    this.logger.log(`Processing document ${doc.id}: ${doc.title}`)

    // Download PDF
    const pdfBuffer = await this.downloadPdf(doc.pdfUrl)

    // Update status to downloaded
    await this.db
      .update(documents)
      .set({
        processingStatus: 'downloaded',
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id))

    // Extract text using pdf-parse
    const text = await this.extractText(pdfBuffer)

    // Update status to extracted
    await this.db
      .update(documents)
      .set({
        processingStatus: 'extracted',
        textExtractedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id))

    // Create chunks
    const chunks = await this.chunkingService.chunkDocument(doc, text)

    // Update document with chunk count
    await this.db
      .update(documents)
      .set({
        processingStatus: 'chunked',
        chunkCount: chunks.length,
        extractorVersion: '1.0',
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id))

    return chunks.length
  }

  /**
   * Download PDF from URL
   */
  private async downloadPdf(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.USER_AGENT,
        Accept: 'application/pdf',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  private async extractText(pdfBuffer: Buffer): Promise<string> {
    // Dynamic import of pdf-parse (CommonJS module)
    const pdfParse = (await import('pdf-parse')).default

    const result = (await pdfParse(pdfBuffer)) as PdfParseResult

    return result.text
  }

  /**
   * Find documents pending processing
   */
  private async findPendingDocuments(options?: {
    limit?: number
    documentTypes?: string[]
    languages?: string[]
  }): Promise<Document[]> {
    // Build the query with limit
    const limit = options?.limit ?? 100
    const results = await this.db
      .select()
      .from(documents)
      .where(eq(documents.processingStatus, 'pending'))
      .limit(limit)

    // Filter by document type if specified
    let filtered = results
    if (options?.documentTypes?.length) {
      filtered = filtered.filter((doc) => options.documentTypes!.includes(doc.documentType))
    }
    if (options?.languages?.length) {
      filtered = filtered.filter((doc) => options.languages!.includes(doc.language))
    }

    return filtered
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    pending: number
    downloaded: number
    extracted: number
    chunked: number
    embedded: number
    failed: number
  }> {
    const allDocs = await this.db
      .select({
        processingStatus: documents.processingStatus,
      })
      .from(documents)

    const stats = {
      pending: 0,
      downloaded: 0,
      extracted: 0,
      chunked: 0,
      embedded: 0,
      failed: 0,
    }

    for (const doc of allDocs) {
      const status = doc.processingStatus as keyof typeof stats
      if (status in stats) {
        stats[status]++
      }
    }

    return stats
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
