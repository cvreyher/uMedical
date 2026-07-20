import { Inject, Injectable, Logger } from '@nestjs/common'
import { documents, medicinalProductsExtended } from '@workspace/database'
import { eq } from 'drizzle-orm'

import { EmaDocumentsApiClient } from '../../infrastructure/clients/ema-documents-api.client'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { EmaRawDocument } from '../../infrastructure/clients/ema-documents-api.client'
import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface DocumentImportResult {
  totalFetched: number
  documentsCreated: number
  documentsUpdated: number
  documentsSkipped: number
  errors: string[]
}

/**
 * Service for importing document metadata from EMA (PDF-based)
 *
 * This is the PDF fallback for products NOT in the ePI pilot.
 * For products with ePI available, use EpiDownloadService instead.
 *
 * Pipeline:
 * 1. Check if product has ePI → use EpiDownloadService (structured data)
 * 2. No ePI → use this service + PdfExtractionService (PDF parsing)
 *
 * Fetches document metadata from EMA JSON endpoints and populates
 * the documents table. Links documents to products via EMA product number.
 */
@Injectable()
export class DocumentImportService {
  private readonly logger = new Logger(DocumentImportService.name)

  constructor(
    private readonly emaDocumentsClient: EmaDocumentsApiClient,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
  ) {}

  /**
   * Import all document metadata from EMA
   * Performs upsert operations for idempotent imports
   */
  async importAll(options?: {
    eparOnly?: boolean
    languages?: string[]
    documentTypes?: string[]
  }): Promise<DocumentImportResult> {
    const result: DocumentImportResult = {
      totalFetched: 0,
      documentsCreated: 0,
      documentsUpdated: 0,
      documentsSkipped: 0,
      errors: [],
    }

    try {
      // Fetch documents based on options
      let rawDocuments: EmaRawDocument[]
      if (options?.eparOnly) {
        rawDocuments = await this.emaDocumentsClient.fetchEparDocuments()
      } else {
        rawDocuments = await this.emaDocumentsClient.fetchAllDocuments()
      }

      result.totalFetched = rawDocuments.length
      this.logger.log(`Fetched ${result.totalFetched} documents from EMA`)

      // Filter by language if specified
      if (options?.languages?.length) {
        rawDocuments = rawDocuments.filter((doc) =>
          options.languages!.includes(doc.document_language?.toLowerCase())
        )
        this.logger.log(`Filtered to ${rawDocuments.length} documents by language`)
      }

      // Filter by document type if specified
      if (options?.documentTypes?.length) {
        rawDocuments = rawDocuments.filter((doc) => {
          const classified = this.emaDocumentsClient.classifyDocumentType(doc.document_type)
          return options.documentTypes!.includes(classified)
        })
        this.logger.log(`Filtered to ${rawDocuments.length} documents by type`)
      }

      // Build product lookup map by EMA number
      const productMap = await this.buildProductMap()
      this.logger.log(`Built product map with ${productMap.size} products`)

      // Import each document
      for (const raw of rawDocuments) {
        try {
          await this.importDocument(raw, productMap, result)
        } catch (error) {
          const errorMsg = `Failed to import document "${raw.document_title}": ${error instanceof Error ? error.message : String(error)}`
          this.logger.error(errorMsg)
          result.errors.push(errorMsg)
        }
      }

      this.logger.log(
        `Import completed: ${result.documentsCreated} created, ${result.documentsUpdated} updated, ${result.documentsSkipped} skipped`
      )
    } catch (error) {
      const errorMsg = `Document import failed: ${error instanceof Error ? error.message : String(error)}`
      this.logger.error(errorMsg)
      result.errors.push(errorMsg)
    }

    return result
  }

  /**
   * Import a single document
   */
  private async importDocument(
    raw: EmaRawDocument,
    productMap: Map<string, number>,
    result: DocumentImportResult
  ): Promise<void> {
    // Skip documents without URL
    if (!raw.document_url) {
      result.documentsSkipped++
      return
    }

    // Try to link to product via EMA number
    const productId = raw.ema_number ? productMap.get(raw.ema_number) : undefined

    // Classify document type
    const classifiedType = this.emaDocumentsClient.classifyDocumentType(raw.document_type)

    // Prepare document data
    const documentData = {
      productId: productId ?? null,
      documentType: classifiedType,
      documentCategory: raw.document_category || 'epar',
      title: raw.document_title,
      language: raw.document_language?.toLowerCase() || 'en',
      documentUrl: raw.document_url,
      pdfUrl: raw.pdf_url || null,
      fileSize: this.emaDocumentsClient.parseFileSize(raw.file_size),
      publishedDate: this.emaDocumentsClient.parseEmaDate(raw.document_date),
      lastModifiedDate: this.emaDocumentsClient.parseEmaDate(raw.last_updated),
      sourceJson: JSON.stringify(raw),
      updatedAt: new Date(),
    }

    // Check if document exists
    const existing = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.documentUrl, raw.document_url))
      .limit(1)

    const existingDoc = existing[0]
    if (existingDoc) {
      // Update existing document
      await this.db.update(documents).set(documentData).where(eq(documents.id, existingDoc.id))

      result.documentsUpdated++
    } else {
      // Insert new document
      await this.db.insert(documents).values({
        ...documentData,
        processingStatus: 'pending',
      })

      result.documentsCreated++
    }
  }

  /**
   * Build a map of EMA product numbers to product IDs
   */
  private async buildProductMap(): Promise<Map<string, number>> {
    const products = await this.db
      .select({
        id: medicinalProductsExtended.id,
        emaNumber: medicinalProductsExtended.emaNumber,
      })
      .from(medicinalProductsExtended)

    const map = new Map<string, number>()
    for (const product of products) {
      if (product.emaNumber) {
        map.set(product.emaNumber, product.id)
      }
    }

    return map
  }

  /**
   * Get document import statistics
   */
  async getImportStats(): Promise<{
    totalDocuments: number
    byType: Record<string, number>
    byLanguage: Record<string, number>
    byProcessingStatus: Record<string, number>
    linkedToProducts: number
    unlinked: number
  }> {
    const allDocs = await this.db
      .select({
        documentType: documents.documentType,
        language: documents.language,
        processingStatus: documents.processingStatus,
        productId: documents.productId,
      })
      .from(documents)

    const byType: Record<string, number> = {}
    const byLanguage: Record<string, number> = {}
    const byProcessingStatus: Record<string, number> = {}
    let linkedToProducts = 0
    let unlinked = 0

    for (const doc of allDocs) {
      byType[doc.documentType] = (byType[doc.documentType] || 0) + 1
      byLanguage[doc.language] = (byLanguage[doc.language] || 0) + 1
      byProcessingStatus[doc.processingStatus || 'pending'] =
        (byProcessingStatus[doc.processingStatus || 'pending'] || 0) + 1

      if (doc.productId) {
        linkedToProducts++
      } else {
        unlinked++
      }
    }

    return {
      totalDocuments: allDocs.length,
      byType,
      byLanguage,
      byProcessingStatus,
      linkedToProducts,
      unlinked,
    }
  }
}
