import { pgTable, serial, text, date, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * Central table for medicinal products from EMA
 * Phase 1: Basic product information for import workflow
 */
export const medicinalProducts = pgTable(
  'medicinal_products',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    emaNumber: text('ema_number').unique(),
    status: text('status').notNull().default('unknown'),
    authorizationDate: date('authorization_date'),
    emaUrl: text('ema_url'),
    therapeuticArea: text('therapeutic_area'),
    conditionIndication: text('condition_indication'),
    atcCode: text('atc_code'),
    orphanMedicine: text('orphan_medicine'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('medicinal_products_status_idx').on(table.status),
    index('medicinal_products_name_idx').on(table.name),
  ]
)

export type MedicinalProduct = typeof medicinalProducts.$inferSelect
export type NewMedicinalProduct = typeof medicinalProducts.$inferInsert
