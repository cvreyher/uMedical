import { pgTable, serial, text, date, timestamp, integer, index, jsonb } from 'drizzle-orm/pg-core'
import { medicinalProductsExtended } from './medicinal-products-extended.schema.js'
import { substances } from './substances.schema.js'

/**
 * Shortages - Medicine Supply Shortages (Multi-Source)
 * Aggregates shortage data from multiple regulatory authorities:
 * - EMA (EU): Central shortage catalogue
 * - FDA (US): Drug Shortages Database
 * - MHRA (UK): Supply disruption alerts
 * - BfArM (DE): Lieferengpässe
 *
 * Design Principles:
 * - Multi-source with clear provenance (sourceAuthority, region)
 * - INN-based linking for cross-source correlation
 * - Full metadata from each source's API/JSON
 * - Ready for future FDA, MHRA integration
 */
export const shortages = pgTable(
  'shortages',
  {
    id: serial('id').primaryKey(),

    // Unique identifier (authority-specific)
    slug: text('slug').unique(), // e.g., "ema-shortage-2024-ozempic"

    // Multi-Source Support
    sourceAuthority: text('source_authority').notNull().default('EMA'), // 'EMA', 'FDA', 'MHRA', 'BfArM'
    region: text('region').notNull().default('EU'), // 'EU', 'US', 'UK', 'DE'

    // Product/Substance relationships
    productId: integer('product_id').references(() => medicinalProductsExtended.id),
    substanceId: integer('substance_id').references(() => substances.id),
    inn: text('inn'), // International Nonproprietary Name for cross-source linking

    // EMA-specific fields (from shortages JSON)
    category: text('category'), // e.g., "Currently authorised"
    medicineAffected: text('medicine_affected'), // Original medicine name from source
    therapeuticAreaMesh: text('therapeutic_area_mesh'),
    pharmaceuticalFormsAffected: text('pharmaceutical_forms_affected'),
    strengthsAffected: text('strengths_affected'),
    availabilityOfAlternatives: text('availability_of_alternatives'),

    // Shortage Details (normalized across sources)
    title: text('title').notNull(),
    description: text('description'),
    affectedProducts: text('affected_products'), // Specific formulations/strengths
    reason: text('reason'), // Manufacturing issue, supply chain, etc.

    // Status
    status: text('status').notNull(), // 'active', 'resolved', 'monitoring'
    severity: text('severity'), // 'critical', 'high', 'medium', 'low'

    // Timeline
    startOfShortageDate: date('start_of_shortage_date'),
    expectedResolutionDate: date('expected_resolution_date'),
    actualResolutionDate: date('actual_resolution_date'),
    firstPublishedDate: date('first_published_date'),
    lastUpdatedDate: date('last_updated_date'),
    reportedDate: date('reported_date').notNull(), // Fallback for legacy data

    // Geographic scope
    affectedCountries: text('affected_countries'), // Comma-separated ISO codes

    // Mitigations
    alternativeTreatments: text('alternative_treatments'),
    actionsTaken: text('actions_taken'),

    // Flexible JSON for source-specific data
    shortageData: jsonb('shortage_data').$type<{
      // FDA-specific
      fdaShortageId?: string
      fdaReason?: string
      estimatedResupplyDate?: string
      // MHRA-specific
      mhraAlertId?: string
      // BfArM-specific
      bfarmMeldeId?: string
      // Generic additional data
      [key: string]: unknown
    }>(),

    // Provenance
    sourceUrl: text('source_url'),
    sourceDocumentId: text('source_document_id'), // Original ID from source system
    sourceEmaSourceId: integer('source_ema_source_id'),
    contentHash: text('content_hash'), // For deduplication

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('shortages_product_idx').on(table.productId),
    index('shortages_substance_idx').on(table.substanceId),
    index('shortages_inn_idx').on(table.inn),
    index('shortages_status_idx').on(table.status),
    index('shortages_reported_date_idx').on(table.reportedDate),
    index('shortages_severity_idx').on(table.severity),
    // Multi-source indexes
    index('shortages_authority_idx').on(table.sourceAuthority),
    index('shortages_region_idx').on(table.region),
    index('shortages_authority_status_idx').on(table.sourceAuthority, table.status),
    index('shortages_start_date_idx').on(table.startOfShortageDate),
    index('shortages_slug_idx').on(table.slug),
  ]
)

export type Shortage = typeof shortages.$inferSelect
export type NewShortage = typeof shortages.$inferInsert
