import { Inject, Injectable, Logger } from '@nestjs/common'
import { documents, documentChunks, medicinalProductsExtended } from '@workspace/database'
import { eq, and } from 'drizzle-orm'
import * as crypto from 'crypto'

import { EpiApiClient, EPI_LANGUAGES, type EpiLanguage, type EpiDocumentContent } from '../../infrastructure/clients/epi-api.client'
import { R2StorageClient } from '../../infrastructure/clients/r2-storage.client'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface EpiDownloadResult {
  productSlug: string
  documentsDownloaded: number
  chunksCreated: number
  languagesProcessed: EpiLanguage[]
  storedInR2: boolean
  errors: string[]
}

export interface AvailableEpiLanguage {
  code: EpiLanguage
  name: string
  available: boolean
}

/**
 * Service for downloading and processing ePI content
 *
 * Handles:
 * - Downloading ePI bundles from EMA API
 * - Extracting structured content from FHIR bundles
 * - Storing raw bundles in R2
 * - Creating document records and chunks for search
 * - Supporting multiple languages (always prioritizing English for embeddings)
 */
@Injectable()
export class EpiDownloadService {
  private readonly logger = new Logger(EpiDownloadService.name)

  // Language display names
  private readonly languageNames: Record<EpiLanguage, string> = {
    en: 'English',
    bg: 'Bulgarian',
    cs: 'Czech',
    da: 'Danish',
    de: 'German',
    el: 'Greek',
    es: 'Spanish',
    et: 'Estonian',
    fi: 'Finnish',
    fr: 'French',
    ga: 'Irish',
    hr: 'Croatian',
    hu: 'Hungarian',
    is: 'Icelandic',
    it: 'Italian',
    lv: 'Latvian',
    lt: 'Lithuanian',
    mt: 'Maltese',
    nl: 'Dutch',
    no: 'Norwegian',
    pl: 'Polish',
    pt: 'Portuguese',
    ro: 'Romanian',
    sk: 'Slovak',
    sl: 'Slovenian',
    sv: 'Swedish',
  }

  constructor(
    private readonly epiClient: EpiApiClient,
    private readonly r2Storage: R2StorageClient,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
  ) {}

  /**
   * Get available languages for a product from ePI
   */
  async getAvailableLanguages(pmsId: string): Promise<AvailableEpiLanguage[]> {
    const availableLanguages = await this.epiClient.getAvailableLanguages(pmsId)

    return EPI_LANGUAGES.map((code) => ({
      code,
      name: this.languageNames[code],
      available: availableLanguages.includes(code),
    }))
  }

  /**
   * Download ePI for a product in specified languages
   * Always downloads English version for embeddings if available
   */
  async downloadEpi(
    productSlug: string,
    pmsId: string,
    languages: EpiLanguage[] = ['en']
  ): Promise<EpiDownloadResult> {
    const result: EpiDownloadResult = {
      productSlug,
      documentsDownloaded: 0,
      chunksCreated: 0,
      languagesProcessed: [],
      storedInR2: false,
      errors: [],
    }

    // Ensure English is always included for embeddings
    const languagesToProcess = new Set(languages)
    languagesToProcess.add('en')

    // Get product ID from database
    const productResult = await this.db
      .select({ id: medicinalProductsExtended.id })
      .from(medicinalProductsExtended)
      .where(eq(medicinalProductsExtended.slug, productSlug))
      .limit(1)

    const product = productResult[0]
    if (!product) {
      result.errors.push(`Product not found: ${productSlug}`)
      return result
    }

    // Process each language
    for (const language of languagesToProcess) {
      try {
        const docResult = await this.processLanguage(product.id, productSlug, pmsId, language)

        if (docResult.success) {
          result.documentsDownloaded += docResult.documentsCreated
          result.chunksCreated += docResult.chunksCreated
          result.languagesProcessed.push(language)
          result.storedInR2 = result.storedInR2 || docResult.storedInR2
        }
      } catch (error) {
        const errorMsg = `Failed to process ${language}: ${error instanceof Error ? error.message : String(error)}`
        this.logger.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }

    this.logger.log(
      `ePI download complete for ${productSlug}: ${result.documentsDownloaded} documents, ${result.chunksCreated} chunks`
    )

    return result
  }

  /**
   * Process a single language version
   */
  private async processLanguage(
    productId: number,
    productSlug: string,
    pmsId: string,
    language: EpiLanguage
  ): Promise<{
    success: boolean
    documentsCreated: number
    chunksCreated: number
    storedInR2: boolean
  }> {
    // Fetch bundle from ePI API
    const bundle = await this.epiClient.getBundleByPmsId(pmsId, language)
    if (!bundle) {
      return { success: false, documentsCreated: 0, chunksCreated: 0, storedInR2: false }
    }

    // Extract document content
    const content = this.epiClient.extractDocumentContent(bundle, language)

    // Store raw bundle in R2 (if configured)
    let storedInR2 = false
    if (this.r2Storage.isEnabled()) {
      try {
        const key = this.r2Storage.generateEpiBundleKey(`${pmsId}-${language}`)
        await this.r2Storage.uploadEpiJson(key, bundle, {
          productSlug,
          pmsId,
          language,
          documentType: content.documentType,
        })
        storedInR2 = true
      } catch (error) {
        this.logger.warn(`Failed to store bundle in R2: ${error}`)
      }
    }

    // Create or update document record
    const documentUrl = `epi://${pmsId}/${language}/${content.documentType}`

    const existingDoc = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.documentUrl, documentUrl))
      .limit(1)

    let documentId: number

    if (existingDoc[0]) {
      // Update existing document
      await this.db
        .update(documents)
        .set({
          productId,
          title: `${content.documentType.toUpperCase()} - ${content.productName}`,
          documentType: content.documentType,
          documentCategory: 'epi',
          language,
          lastModifiedDate: content.lastUpdated ? new Date(content.lastUpdated) : new Date(),
          processingStatus: 'extracted',
          textExtractedAt: new Date(),
          sourceJson: JSON.stringify({ bundleId: content.bundleId, pmsId }),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, existingDoc[0].id))

      documentId = existingDoc[0].id

      // Delete old chunks
      await this.db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))
    } else {
      // Create new document
      const newDocResult = await this.db
        .insert(documents)
        .values({
          productId,
          documentType: content.documentType,
          documentCategory: 'epi',
          title: `${content.documentType.toUpperCase()} - ${content.productName}`,
          language,
          documentUrl,
          publishedDate: content.lastUpdated ? new Date(content.lastUpdated) : new Date(),
          processingStatus: 'extracted',
          textExtractedAt: new Date(),
          sourceJson: JSON.stringify({ bundleId: content.bundleId, pmsId }),
        })
        .returning({ id: documents.id })

      const newDoc = newDocResult[0]
      if (!newDoc) {
        throw new Error('Failed to create document record')
      }
      documentId = newDoc.id
    }

    // Create chunks from sections (only for English, to be used for embeddings)
    let chunksCreated = 0
    if (language === 'en') {
      chunksCreated = await this.createChunksFromSections(documentId, productId, content)
    }

    // Update document with chunk count
    await this.db
      .update(documents)
      .set({
        processingStatus: 'chunked',
        chunkCount: chunksCreated,
        extractorVersion: '2.0-epi',
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))

    return {
      success: true,
      documentsCreated: 1,
      chunksCreated,
      storedInR2,
    }
  }

  /**
   * Create chunks from ePI sections
   */
  private async createChunksFromSections(
    documentId: number,
    productId: number,
    content: EpiDocumentContent
  ): Promise<number> {
    let chunkIndex = 0

    for (const section of content.sections) {
      // Skip very short sections
      if (section.textContent.length < 50) continue

      const contentHash = crypto.createHash('sha256').update(section.textContent).digest('hex')
      const charCount = section.textContent.length
      const tokenCount = Math.ceil(charCount / 4) // Approximate tokens

      await this.db.insert(documentChunks).values({
        documentId,
        productId,
        chunkIndex,
        sectionType: `${content.documentType}_${section.code}`,
        sectionTitle: section.title,
        content: section.textContent,
        contentHash,
        language: content.language,
        charCount,
        tokenCount,
        extractorVersion: '2.0-epi',
      })

      chunkIndex++
    }

    return chunkIndex
  }

  /**
   * Search for products available in ePI
   */
  async searchEpiProducts(query: string): Promise<Array<{
    listId: string
    title: string
    productName: string
  }>> {
    const results = await this.epiClient.listByTitle(query)

    return results.map((item) => ({
      listId: item.id,
      title: item.title,
      productName: item.productName || item.title,
    }))
  }

  /**
   * Get all EMA products available in ePI
   */
  async getAllEmaEpiProducts(): Promise<Array<{
    listId: string
    title: string
    productName: string
    lastUpdated?: string
  }>> {
    const results = await this.epiClient.listAllEma()

    return results.map((item) => ({
      listId: item.id,
      title: item.title,
      productName: item.productName || item.title,
      lastUpdated: item.lastUpdated,
    }))
  }
}
