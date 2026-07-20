import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  medicinalProducts,
  medicinalProductsExtended,
  substances,
  companies,
  productSubstances,
  productCompanies,
  importLogs,
} from '@workspace/database'
import { eq } from 'drizzle-orm'

import { EmaApiClient } from '../../infrastructure/clients/ema-api.client'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { EmaRawMedicine } from '../../infrastructure/clients/ema-api.client'
import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface ImportResult {
  importLogId: number
  totalFetched: number
  productsCreated: number
  productsUpdated: number
  substancesCreated: number
  companiesCreated: number
  errors: string[]
}

const EMA_SOURCE_URL =
  'https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json'

/**
 * Service for importing EMA medicine data
 * Handles transformation from EMA format to our schema
 */
@Injectable()
export class EmaImportService {
  private readonly logger = new Logger(EmaImportService.name)

  constructor(
    private readonly emaClient: EmaApiClient,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
  ) {}

  /**
   * Import all medicines from EMA
   * Performs upsert operations for idempotent imports
   */
  async importAll(): Promise<ImportResult> {
    // Create import log entry
    const [logEntry] = await this.db
      .insert(importLogs)
      .values({
        source: 'ema',
        sourceUrl: EMA_SOURCE_URL,
        status: 'running',
      })
      .returning({ id: importLogs.id })

    const result: ImportResult = {
      importLogId: logEntry!.id,
      totalFetched: 0,
      productsCreated: 0,
      productsUpdated: 0,
      substancesCreated: 0,
      companiesCreated: 0,
      errors: [],
    }

    try {
      const rawMedicines = await this.emaClient.fetchMedicines()
      result.totalFetched = rawMedicines.length

      for (const raw of rawMedicines) {
        try {
          await this.importMedicine(raw, result)
        } catch (error) {
          const errorMsg = `Failed to import ${raw.name_of_medicine}: ${error instanceof Error ? error.message : String(error)}`
          this.logger.error(errorMsg)
          result.errors.push(errorMsg)
        }
      }

      // Update import log with success
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
          errors: result.errors.length > 0 ? result.errors.slice(0, 100) : null, // Limit stored errors
        })
        .where(eq(importLogs.id, logEntry!.id))

      this.logger.log(`Import completed: ${JSON.stringify(result)}`)
    } catch (error) {
      const errorMsg = `Import failed: ${error instanceof Error ? error.message : String(error)}`
      this.logger.error(errorMsg)
      result.errors.push(errorMsg)

      // Update import log with failure
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

  /**
   * Import a single medicine with all related entities
   */
  private async importMedicine(raw: EmaRawMedicine, result: ImportResult): Promise<void> {
    // 1. Upsert company (MAH)
    const companyId = await this.upsertCompany(raw.marketing_authorisation_developer_applicant_holder, result)

    // 2. Upsert substance(s)
    const substanceIds = await this.upsertSubstances(raw.active_substance, result)

    // 3. Upsert product (legacy phase-1 table)
    await this.upsertProduct(raw, result)

    // 4./5. Link company/substances via the EXTENDED product table -
    // product_companies/product_substances reference medicinal_products_extended,
    // which is the authoritative table used by the API. If the extended product
    // does not exist yet (extended import not run), skip linking.
    const extendedProductId = await this.resolveExtendedProductId(this.slugify(raw.name_of_medicine))
    if (!extendedProductId) {
      this.logger.debug(
        `Skipping links for "${raw.name_of_medicine}": no extended product found (run import/extended first)`,
      )
      return
    }

    if (companyId) {
      await this.linkProductCompany(extendedProductId, companyId)
    }

    for (const substanceId of substanceIds) {
      await this.linkProductSubstance(extendedProductId, substanceId)
    }
  }

  private async resolveExtendedProductId(slug: string): Promise<number | null> {
    const [row] = await this.db
      .select({ id: medicinalProductsExtended.id })
      .from(medicinalProductsExtended)
      .where(eq(medicinalProductsExtended.slug, slug))
      .limit(1)
    return row?.id ?? null
  }

  private async upsertCompany(name: string, result: ImportResult): Promise<number | null> {
    if (!name?.trim()) return null

    const slug = this.slugify(name)
    const existing = await this.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1)

    const existingCompany = existing[0]
    if (existingCompany) {
      return existingCompany.id
    }

    const [inserted] = await this.db
      .insert(companies)
      .values({
        slug,
        name: name.trim(),
      })
      .returning({ id: companies.id })

    result.companiesCreated++
    return inserted!.id
  }

  private async upsertSubstances(activeSubstance: string, result: ImportResult): Promise<number[]> {
    if (!activeSubstance?.trim()) return []

    // EMA uses semicolon-separated substances
    const names = activeSubstance
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    const ids: number[] = []

    for (const name of names) {
      const slug = this.slugify(name)
      const existing = await this.db
        .select({ id: substances.id })
        .from(substances)
        .where(eq(substances.slug, slug))
        .limit(1)

      const existingSubstance = existing[0]
      if (existingSubstance) {
        ids.push(existingSubstance.id)
        continue
      }

      const [inserted] = await this.db
        .insert(substances)
        .values({
          slug,
          innName: name,
        })
        .returning({ id: substances.id })

      result.substancesCreated++
      ids.push(inserted!.id)
    }

    return ids
  }

  private async upsertProduct(raw: EmaRawMedicine, result: ImportResult): Promise<number> {
    const slug = this.slugify(raw.name_of_medicine)

    const existing = await this.db
      .select({ id: medicinalProducts.id })
      .from(medicinalProducts)
      .where(eq(medicinalProducts.slug, slug))
      .limit(1)

    const productData = {
      name: raw.name_of_medicine.trim(),
      emaNumber: raw.ema_product_number || null,
      status: this.normalizeStatus(raw.medicine_status),
      authorizationDate: this.parseDate(raw.marketing_authorisation_date),
      emaUrl: raw.medicine_url || null,
      therapeuticArea: raw.therapeutic_area_mesh || null,
      conditionIndication: raw.therapeutic_indication || null,
      atcCode: raw.atc_code_human || null,
      orphanMedicine: raw.orphan_medicine === 'Yes' ? 'yes' : 'no',
      updatedAt: new Date(),
    }

    const existingProduct = existing[0]
    if (existingProduct) {
      await this.db
        .update(medicinalProducts)
        .set(productData)
        .where(eq(medicinalProducts.id, existingProduct.id))

      result.productsUpdated++
      return existingProduct.id
    }

    const [inserted] = await this.db
      .insert(medicinalProducts)
      .values({
        slug,
        ...productData,
      })
      .returning({ id: medicinalProducts.id })

    result.productsCreated++
    return inserted!.id
  }

  private async linkProductCompany(productId: number, companyId: number): Promise<void> {
    await this.db
      .insert(productCompanies)
      .values({
        productId,
        companyId,
        role: 'mah',
      })
      .onConflictDoNothing()
  }

  private async linkProductSubstance(productId: number, substanceId: number): Promise<void> {
    await this.db
      .insert(productSubstances)
      .values({
        productId,
        substanceId,
        isActive: true,
      })
      .onConflictDoNothing()
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

  private normalizeStatus(status: string): string {
    if (!status) return 'unknown'
    const lower = status.toLowerCase()
    if (lower.includes('authorised')) return 'authorised'
    if (lower.includes('withdrawn')) return 'withdrawn'
    if (lower.includes('suspended')) return 'suspended'
    if (lower.includes('refused')) return 'refused'
    return 'unknown'
  }

  private parseDate(dateStr: string): string | null {
    if (!dateStr?.trim()) return null
    // EMA uses DD/MM/YYYY format
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`
    }
    return null
  }
}
