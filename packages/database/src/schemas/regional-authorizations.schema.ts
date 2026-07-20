import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { medicinalProducts } from './medicinal-products.schema.js'
import { substances } from './substances.schema.js'

/**
 * Regional Authorizations
 *
 * Tracks authorization status of substances/products across different regulatory regions.
 * Enables map visualization of global approval status.
 *
 * Regions:
 * - EU: European Medicines Agency (EMA)
 * - US: Food and Drug Administration (FDA)
 * - UK: Medicines and Healthcare products Regulatory Agency (MHRA)
 * - CH: Swiss Agency for Therapeutic Products (Swissmedic)
 * - DE: Federal Institute for Drugs and Medical Devices (BfArM)
 * - JP: Pharmaceuticals and Medical Devices Agency (PMDA)
 * - CA: Health Canada
 * - AU: Therapeutic Goods Administration (TGA)
 */
export const regionalAuthorizations = pgTable(
  'regional_authorizations',
  {
    id: serial('id').primaryKey(),

    // Entity References (at least one should be set)
    productId: integer('product_id').references(() => medicinalProducts.id, { onDelete: 'cascade' }),
    substanceId: integer('substance_id').references(() => substances.id, { onDelete: 'cascade' }),

    // INN is always stored for cross-source queries
    inn: text('inn').notNull(),

    // Regional Information
    region: text('region').notNull(), // ISO 3166-1 alpha-2: 'EU', 'US', 'UK', 'CH', 'DE', 'JP', 'CA', 'AU'
    authority: text('authority').notNull(), // 'EMA', 'FDA', 'MHRA', 'Swissmedic', 'BfArM', 'PMDA', 'Health Canada', 'TGA'

    // Authorization Status
    status: text('status').notNull(), // 'authorized', 'withdrawn', 'suspended', 'pending', 'refused', 'not_submitted'
    brandName: text('brand_name'), // May differ by region
    localProductCode: text('local_product_code'), // NDA number, MA number, etc.

    // Authorization Details
    authorizationDate: date('authorization_date'),
    authorizationHolder: text('authorization_holder'),
    therapeuticIndication: text('therapeutic_indication'), // May differ by region

    // Source
    sourceUrl: text('source_url'),
    lastVerifiedAt: timestamp('last_verified_at'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('regional_authorizations_product_region').on(table.productId, table.region),
    unique('regional_authorizations_substance_region').on(table.substanceId, table.region).nullsNotDistinct(),
    index('regional_authorizations_product_idx').on(table.productId),
    index('regional_authorizations_substance_idx').on(table.substanceId),
    index('regional_authorizations_inn_idx').on(table.inn),
    index('regional_authorizations_region_idx').on(table.region),
    index('regional_authorizations_status_idx').on(table.status),
    index('regional_authorizations_inn_region_idx').on(table.inn, table.region),
  ]
)

/**
 * Regional Authorization History
 *
 * Tracks status changes over time for audit and timeline purposes.
 */
export const regionalAuthorizationHistory = pgTable(
  'regional_authorization_history',
  {
    id: serial('id').primaryKey(),

    // Reference to authorization
    authorizationId: integer('authorization_id')
      .notNull()
      .references(() => regionalAuthorizations.id, { onDelete: 'cascade' }),

    // Status Change
    previousStatus: text('previous_status'),
    newStatus: text('new_status').notNull(),
    changeReason: text('change_reason'),

    // When the change occurred
    changedAt: date('changed_at').notNull(),

    // Source
    sourceUrl: text('source_url'),
    sourceEventId: integer('source_event_id'), // Optional link to pvigilance_events

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('regional_auth_history_auth_idx').on(table.authorizationId),
    index('regional_auth_history_changed_at_idx').on(table.changedAt),
  ]
)

export type RegionalAuthorization = typeof regionalAuthorizations.$inferSelect
export type NewRegionalAuthorization = typeof regionalAuthorizations.$inferInsert
export type RegionalAuthorizationHistory = typeof regionalAuthorizationHistory.$inferSelect
export type NewRegionalAuthorizationHistory = typeof regionalAuthorizationHistory.$inferInsert
