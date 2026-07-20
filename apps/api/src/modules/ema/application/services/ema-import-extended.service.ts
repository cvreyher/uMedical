import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  medicinalProductsExtended,
  substances,
  companies,
  productSubstances,
  productCompanies,
  productCategories,
  importLogs,
  timelineEvents,
  emaSources,
} from '@workspace/database'
import { eq, and } from 'drizzle-orm'

import { EmaApiClient } from '../../infrastructure/clients/ema-api.client'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { EmaRawMedicine } from '../../infrastructure/clients/ema-api.client'
import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface ExtendedImportResult {
  importLogId: number
  totalFetched: number
  productsCreated: number
  productsUpdated: number
  substancesCreated: number
  companiesCreated: number
  eventsCreated: number
  errors: string[]
}

const EMA_SOURCE_URL =
  'https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json'

/**
 * Extended EMA Import Service
 * - Uses the full medicinal_products_extended schema
 * - Creates timeline events for all changes
 * - Tracks import sources
 */
@Injectable()
export class EmaImportExtendedService {
  private readonly logger = new Logger(EmaImportExtendedService.name)

  constructor(
    private readonly emaClient: EmaApiClient,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
  ) {}

  /**
   * Import all medicines from EMA with full event tracking
   */
  async importAll(): Promise<ExtendedImportResult> {
    // 1. Register/update EMA source
    const sourceId = await this.upsertEmaSource()

    // 2. Create import log
    const [logEntry] = await this.db
      .insert(importLogs)
      .values({
        source: 'ema',
        sourceUrl: EMA_SOURCE_URL,
        status: 'running',
      })
      .returning({ id: importLogs.id })

    const result: ExtendedImportResult = {
      importLogId: logEntry!.id,
      totalFetched: 0,
      productsCreated: 0,
      productsUpdated: 0,
      substancesCreated: 0,
      companiesCreated: 0,
      eventsCreated: 0,
      errors: [],
    }

    try {
      const rawMedicines = await this.emaClient.fetchMedicines()
      result.totalFetched = rawMedicines.length

      // Ensure categories exist
      await this.ensureCategories()

      for (const raw of rawMedicines) {
        try {
          await this.importMedicine(raw, result, sourceId)
        } catch (error) {
          const errorMsg = `Failed to import ${raw.name_of_medicine}: ${error instanceof Error ? error.message : String(error)}`
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
          productsCreated: result.productsCreated,
          productsUpdated: result.productsUpdated,
          substancesCreated: result.substancesCreated,
          companiesCreated: result.companiesCreated,
          errorCount: result.errors.length,
          errors: result.errors.length > 0 ? result.errors.slice(0, 100) : null,
          metadata: { eventsCreated: result.eventsCreated },
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

      this.logger.log(`Import completed: ${JSON.stringify(result)}`)
    } catch (error) {
      const errorMsg = `Import failed: ${error instanceof Error ? error.message : String(error)}`
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

  private async upsertEmaSource(): Promise<number> {
    const existing = await this.db
      .select({ id: emaSources.id })
      .from(emaSources)
      .where(eq(emaSources.sourceUrl, EMA_SOURCE_URL))
      .limit(1)

    if (existing[0]) {
      return existing[0].id
    }

    const [inserted] = await this.db
      .insert(emaSources)
      .values({
        sourceType: 'ema_medicines_json',
        sourceUrl: EMA_SOURCE_URL,
      })
      .returning({ id: emaSources.id })

    return inserted!.id
  }

  private async ensureCategories(): Promise<void> {
    await this.db
      .insert(productCategories)
      .values([
        { slug: 'human', name: 'Human', description: 'Human medicinal products' },
        { slug: 'veterinary', name: 'Veterinary', description: 'Veterinary medicinal products' },
      ])
      .onConflictDoNothing()
  }

  private async importMedicine(
    raw: EmaRawMedicine,
    result: ExtendedImportResult,
    sourceId: number,
  ): Promise<void> {
    const slug = this.slugify(raw.name_of_medicine)

    // Get category ID
    const categorySlug = raw.category?.toLowerCase() === 'veterinary' ? 'veterinary' : 'human'
    const [category] = await this.db
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(eq(productCategories.slug, categorySlug))
      .limit(1)

    // Check if product exists - only select columns we need (avoid embedding column)
    const [existingProduct] = await this.db
      .select({
        id: medicinalProductsExtended.id,
        slug: medicinalProductsExtended.slug,
        medicineStatus: medicinalProductsExtended.medicineStatus,
      })
      .from(medicinalProductsExtended)
      .where(eq(medicinalProductsExtended.slug, slug))
      .limit(1)

    const productData = {
      name: raw.name_of_medicine.trim(),
      emaNumber: raw.ema_product_number || null,
      categoryId: category?.id,
      category: raw.category || 'Human',
      medicineStatus: raw.medicine_status || 'Unknown',
      opinionStatus: raw.opinion_status || null,
      internationalNonProprietaryName: raw.international_non_proprietary_name_common_name || null,
      activeSubstance: raw.active_substance || null,
      therapeuticAreaMesh: raw.therapeutic_area_mesh || null,
      therapeuticIndication: raw.therapeutic_indication || null,
      atcCode: raw.atc_code_human || null,
      pharmacotherapeuticGroup: raw.pharmacotherapeutic_group_human || null,
      patientSafety: raw.patient_safety === 'Yes',
      acceleratedAssessment: raw.accelerated_assessment === 'Yes',
      additionalMonitoring: raw.additional_monitoring === 'Yes',
      advancedTherapy: raw.advanced_therapy === 'Yes',
      biosimilar: raw.biosimilar === 'Yes',
      conditionalApproval: raw.conditional_approval === 'Yes',
      exceptionalCircumstances: raw.exceptional_circumstances === 'Yes',
      genericOrHybrid: raw.generic_or_hybrid === 'Yes',
      orphanMedicine: raw.orphan_medicine === 'Yes',
      primePriorityMedicine: raw.prime_priority_medicine === 'Yes',
      marketingAuthorisationHolderDeveloperApplicant:
        raw.marketing_authorisation_developer_applicant_holder || null,
      opinionAdoptedDate: this.parseDate(raw.opinion_adopted_date),
      europeanCommissionDecisionDate: this.parseDate(raw.european_commission_decision_date),
      marketingAuthorisationDate: this.parseDate(raw.marketing_authorisation_date),
      withdrawalExpiryRevocationLapseDate: this.parseDate(
        raw.withdrawal_expiry_revocation_lapse_of_marketing_authorisation_date,
      ),
      firstPublishedDate: this.parseDate(raw.first_published_date),
      lastUpdatedDate: this.parseDate(raw.last_updated_date),
      latestProcedureAffectingProductInformation:
        raw.latest_procedure_affecting_product_information || null,
      revisionNumber: raw.revision_number ? parseInt(raw.revision_number, 10) : null,
      medicineUrl: raw.medicine_url || null,
      sourceEmaSourceId: sourceId,
      updatedAt: new Date(),
    }

    let productId: number

    if (existingProduct) {
      // Update existing product
      await this.db
        .update(medicinalProductsExtended)
        .set(productData)
        .where(eq(medicinalProductsExtended.id, existingProduct.id))

      productId = existingProduct.id
      result.productsUpdated++

      // Check for status change and create event
      if (existingProduct.medicineStatus !== productData.medicineStatus) {
        await this.createEvent({
          eventType: 'status_changed',
          eventCategory: 'regulatory',
          productId,
          title: `Status changed: ${existingProduct.medicineStatus} → ${productData.medicineStatus}`,
          eventDate: productData.lastUpdatedDate ?? new Date().toISOString().split('T')[0]!,
          eventData: {
            oldStatus: existingProduct.medicineStatus,
            newStatus: productData.medicineStatus,
          },
          sourceUrl: raw.medicine_url || EMA_SOURCE_URL,
        })
        result.eventsCreated++
      }
    } else {
      // Insert new product
      const [inserted] = await this.db
        .insert(medicinalProductsExtended)
        .values({ slug, ...productData })
        .returning({ id: medicinalProductsExtended.id })

      productId = inserted!.id
      result.productsCreated++

      // Create initial authorization event
      if (productData.marketingAuthorisationDate) {
        await this.createEvent({
          eventType: 'authorised',
          eventCategory: 'regulatory',
          productId,
          title: `${raw.name_of_medicine} authorised`,
          eventDate: productData.marketingAuthorisationDate,
          eventData: {
            status: productData.medicineStatus,
            holder: productData.marketingAuthorisationHolderDeveloperApplicant,
          },
          sourceUrl: raw.medicine_url || EMA_SOURCE_URL,
        })
        result.eventsCreated++
      }

      // Create withdrawal event if applicable
      if (
        productData.medicineStatus === 'Withdrawn' &&
        productData.withdrawalExpiryRevocationLapseDate
      ) {
        await this.createEvent({
          eventType: 'withdrawn',
          eventCategory: 'regulatory',
          productId,
          title: `${raw.name_of_medicine} withdrawn`,
          eventDate: productData.withdrawalExpiryRevocationLapseDate,
          eventData: { reason: 'See EMA documentation' },
          sourceUrl: raw.medicine_url || EMA_SOURCE_URL,
        })
        result.eventsCreated++
      }
    }

    // Upsert company
    if (raw.marketing_authorisation_developer_applicant_holder) {
      const companyId = await this.upsertCompany(
        raw.marketing_authorisation_developer_applicant_holder,
        result,
      )
      if (companyId) {
        await this.linkProductCompany(productId, companyId)
      }
    }

    // Upsert substances
    if (raw.active_substance) {
      const substanceIds = await this.upsertSubstances(raw.active_substance, result)
      for (const substanceId of substanceIds) {
        await this.linkProductSubstance(productId, substanceId)
      }
    }
  }

  private async createEvent(params: {
    eventType: string
    eventCategory: string
    productId: number
    title: string
    eventDate: string
    eventData?: Record<string, unknown>
    sourceUrl: string
  }): Promise<void> {
    await this.db.insert(timelineEvents).values({
      eventType: params.eventType,
      eventCategory: params.eventCategory,
      productId: params.productId,
      title: params.title,
      eventDate: params.eventDate,
      eventData: params.eventData,
      sourceUrl: params.sourceUrl,
      sourceType: 'ema_medicines_json',
      confidence: 'high',
      extractorVersion: '1.0.0',
    })
  }

  private async upsertCompany(name: string, result: ExtendedImportResult): Promise<number | null> {
    if (!name?.trim()) return null

    const slug = this.slugify(name)
    const [existing] = await this.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1)

    if (existing) return existing.id

    const [inserted] = await this.db
      .insert(companies)
      .values({ slug, name: name.trim() })
      .returning({ id: companies.id })

    result.companiesCreated++
    return inserted!.id
  }

  private async upsertSubstances(
    activeSubstance: string,
    result: ExtendedImportResult,
  ): Promise<number[]> {
    if (!activeSubstance?.trim()) return []

    const names = activeSubstance
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    const ids: number[] = []

    for (const name of names) {
      const slug = this.slugify(name)
      const [existing] = await this.db
        .select({ id: substances.id })
        .from(substances)
        .where(eq(substances.slug, slug))
        .limit(1)

      if (existing) {
        ids.push(existing.id)
        continue
      }

      const [inserted] = await this.db
        .insert(substances)
        .values({ slug, innName: name })
        .returning({ id: substances.id })

      result.substancesCreated++
      ids.push(inserted!.id)
    }

    return ids
  }

  private async linkProductCompany(productId: number, companyId: number): Promise<void> {
    // Check if link exists (using medicinal_products_extended ID)
    // For now, we'll use a simple insert with conflict handling
    try {
      await this.db.insert(productCompanies).values({
        productId,
        companyId,
        role: 'mah',
      }).onConflictDoNothing()
    } catch {
      // Ignore duplicate key errors
    }
  }

  private async linkProductSubstance(productId: number, substanceId: number): Promise<void> {
    try {
      await this.db.insert(productSubstances).values({
        productId,
        substanceId,
        isActive: true,
      }).onConflictDoNothing()
    } catch {
      // Ignore duplicate key errors
    }
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
