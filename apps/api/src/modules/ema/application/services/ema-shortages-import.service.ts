import { Inject, Injectable, Logger } from '@nestjs/common'
import { shortages, substances, importLogs, emaSources } from '@workspace/database'
import { eq, and } from 'drizzle-orm'
import { createHash } from 'crypto'

import { EmaApiClient } from '../../infrastructure/clients/ema-api.client'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { EmaRawShortage } from '../../infrastructure/clients/ema-api.client'
import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface ShortagesImportResult {
  importLogId: number
  totalFetched: number
  shortagesCreated: number
  shortagesUpdated: number
  shortagesSkipped: number
  substancesLinked: number
  errors: string[]
}

const EMA_SHORTAGES_SOURCE_URL =
  'https://www.ema.europa.eu/en/documents/report/shortages-output-json-report_en.json'

/**
 * EMA Shortages Import Service
 *
 * Imports medicine supply shortages from EMA's official JSON endpoint.
 * Creates/updates shortage records with full provenance tracking.
 */
@Injectable()
export class EmaShortagesImportService {
  private readonly logger = new Logger(EmaShortagesImportService.name)

  constructor(
    private readonly emaClient: EmaApiClient,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
  ) {}

  /**
   * Import all shortages from EMA
   */
  async importAll(): Promise<ShortagesImportResult> {
    // 1. Register/update EMA shortages source
    const sourceId = await this.upsertEmaShortagesSource()

    // 2. Create import log
    const [logEntry] = await this.db
      .insert(importLogs)
      .values({
        source: 'ema_shortages',
        sourceUrl: EMA_SHORTAGES_SOURCE_URL,
        status: 'running',
      })
      .returning({ id: importLogs.id })

    const result: ShortagesImportResult = {
      importLogId: logEntry!.id,
      totalFetched: 0,
      shortagesCreated: 0,
      shortagesUpdated: 0,
      shortagesSkipped: 0,
      substancesLinked: 0,
      errors: [],
    }

    try {
      const rawShortages = await this.emaClient.fetchShortages()
      result.totalFetched = rawShortages.length

      this.logger.log(`Processing ${rawShortages.length} shortages from EMA`)

      for (const raw of rawShortages) {
        try {
          await this.importShortage(raw, result, sourceId)
        } catch (error) {
          const errorMsg = `Failed to import shortage ${raw.medicine_affected}: ${error instanceof Error ? error.message : String(error)}`
          this.logger.error(errorMsg)
          result.errors.push(errorMsg)
        }
      }

      // Update import log
      await this.db
        .update(importLogs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          totalFetched: result.totalFetched,
          productsCreated: result.shortagesCreated,
          productsUpdated: result.shortagesUpdated,
          errorCount: result.errors.length,
          errors: result.errors.length > 0 ? result.errors.slice(0, 100) : null,
          metadata: {
            shortagesSkipped: result.shortagesSkipped,
            substancesLinked: result.substancesLinked,
          },
        })
        .where(eq(importLogs.id, logEntry!.id))

      // Update EMA source crawl time
      await this.db
        .update(emaSources)
        .set({
          lastCrawledAt: new Date(),
          lastSuccessAt: new Date(),
          itemCount: result.totalFetched,
        })
        .where(eq(emaSources.id, sourceId))

      this.logger.log(`Shortages import completed: ${JSON.stringify(result)}`)
    } catch (error) {
      const errorMsg = `Shortages import failed: ${error instanceof Error ? error.message : String(error)}`
      this.logger.error(errorMsg)
      result.errors.push(errorMsg)

      await this.db
        .update(importLogs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorCount: 1,
          errors: [errorMsg],
        })
        .where(eq(importLogs.id, logEntry!.id))
    }

    return result
  }

  private async upsertEmaShortagesSource(): Promise<number> {
    const existing = await this.db
      .select({ id: emaSources.id })
      .from(emaSources)
      .where(eq(emaSources.sourceUrl, EMA_SHORTAGES_SOURCE_URL))
      .limit(1)

    if (existing[0]) {
      return existing[0].id
    }

    const [inserted] = await this.db
      .insert(emaSources)
      .values({
        sourceType: 'ema_shortages_json',
        sourceUrl: EMA_SHORTAGES_SOURCE_URL,
      })
      .returning({ id: emaSources.id })

    return inserted!.id
  }

  private async importShortage(
    raw: EmaRawShortage,
    result: ShortagesImportResult,
    sourceId: number,
  ): Promise<void> {
    // Generate unique slug from medicine name and INN
    const slug = this.generateSlug(raw)

    // Generate content hash for deduplication
    const contentHash = this.generateContentHash(raw)

    // Parse dates
    const startDate = this.parseDate(raw.start_of_shortage_date)
    const expectedResolution = this.parseDate(raw.expected_resolution_date)
    const firstPublished = this.parseDate(raw.first_published_date)
    const lastUpdated = this.parseDate(raw.last_updated_date)

    // Map status
    const status = this.mapStatus(raw.supply_shortage_status)

    // Try to find matching substance by INN
    let substanceId: number | null = null
    const inn = raw.international_non_proprietary_name_inn_or_common_name?.trim()
    if (inn) {
      const substanceSlug = this.slugify(inn)
      const [matchedSubstance] = await this.db
        .select({ id: substances.id })
        .from(substances)
        .where(eq(substances.slug, substanceSlug))
        .limit(1)

      if (matchedSubstance) {
        substanceId = matchedSubstance.id
        result.substancesLinked++
      }
    }

    // Check for existing shortage
    const [existingShortage] = await this.db
      .select({
        id: shortages.id,
        contentHash: shortages.contentHash,
      })
      .from(shortages)
      .where(eq(shortages.slug, slug))
      .limit(1)

    const shortageData = {
      slug,
      sourceAuthority: 'EMA',
      region: 'EU',
      substanceId,
      inn: inn || null,
      category: raw.category || null,
      medicineAffected: raw.medicine_affected || null,
      therapeuticAreaMesh: raw.therapeutic_area_mesh || null,
      pharmaceuticalFormsAffected: raw.pharmaceutical_forms_affected || null,
      strengthsAffected: raw.strengths_affected || null,
      availabilityOfAlternatives: raw.availability_of_alternatives || null,
      title: raw.medicine_affected || 'Unknown shortage',
      description: this.buildDescription(raw),
      status,
      startOfShortageDate: startDate,
      expectedResolutionDate: expectedResolution,
      firstPublishedDate: firstPublished,
      lastUpdatedDate: lastUpdated,
      reportedDate: startDate || firstPublished || new Date().toISOString().slice(0, 10),
      actualResolutionDate: status === 'resolved' ? lastUpdated : null,
      sourceUrl: raw.shortage_url || EMA_SHORTAGES_SOURCE_URL,
      sourceEmaSourceId: sourceId,
      contentHash,
      updatedAt: new Date(),
    }

    if (existingShortage) {
      // Check if content changed
      if (existingShortage.contentHash !== contentHash) {
        await this.db
          .update(shortages)
          .set(shortageData)
          .where(eq(shortages.id, existingShortage.id))
        result.shortagesUpdated++
      } else {
        result.shortagesSkipped++
      }
    } else {
      // Create new shortage
      await this.db.insert(shortages).values(shortageData)
      result.shortagesCreated++
    }
  }

  private generateSlug(raw: EmaRawShortage): string {
    const medicineName = raw.medicine_affected || 'unknown'
    const inn = raw.international_non_proprietary_name_inn_or_common_name || ''
    const combined = `ema-shortage-${medicineName}-${inn}`
    return this.slugify(combined)
  }

  private generateContentHash(raw: EmaRawShortage): string {
    const content = JSON.stringify({
      medicine: raw.medicine_affected,
      status: raw.supply_shortage_status,
      inn: raw.international_non_proprietary_name_inn_or_common_name,
      forms: raw.pharmaceutical_forms_affected,
      strengths: raw.strengths_affected,
      alternatives: raw.availability_of_alternatives,
      startDate: raw.start_of_shortage_date,
      expectedResolution: raw.expected_resolution_date,
      lastUpdated: raw.last_updated_date,
    })
    return createHash('md5').update(content).digest('hex')
  }

  private mapStatus(emaStatus: string): string {
    const statusLower = (emaStatus || '').toLowerCase()
    if (statusLower.includes('resolved') || statusLower.includes('closed')) {
      return 'resolved'
    }
    if (statusLower.includes('not resolved') || statusLower.includes('ongoing')) {
      return 'active'
    }
    if (statusLower.includes('monitoring')) {
      return 'monitoring'
    }
    return 'active' // Default to active
  }

  private buildDescription(raw: EmaRawShortage): string {
    const parts: string[] = []

    if (raw.therapeutic_area_mesh) {
      parts.push(`Therapeutic area: ${raw.therapeutic_area_mesh}`)
    }
    if (raw.pharmaceutical_forms_affected) {
      parts.push(`Forms affected: ${raw.pharmaceutical_forms_affected}`)
    }
    if (raw.strengths_affected) {
      parts.push(`Strengths affected: ${raw.strengths_affected}`)
    }
    if (raw.availability_of_alternatives) {
      parts.push(`Alternatives: ${raw.availability_of_alternatives}`)
    }

    return parts.join('. ') || null as unknown as string
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 200)
  }

  private parseDate(dateStr: string | undefined): string | null {
    if (!dateStr?.trim()) return null
    // EMA uses DD/MM/YYYY format
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`
    }
    return null
  }
}
