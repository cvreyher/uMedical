import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
  real,
  unique,
} from 'drizzle-orm/pg-core'
import { pvigilanceEvents } from './pvigilance-events.schema.js'
import { medicinalProducts } from './medicinal-products.schema.js'
import { substances } from './substances.schema.js'

/**
 * Pharmacovigilance Event-Product Links
 *
 * Junction table linking pharmacovigilance events to EMA medicinal products.
 * Events are linked via INN matching or explicit product name matching.
 */
export const pvigilanceEventProducts = pgTable(
  'pvigilance_event_products',
  {
    id: serial('id').primaryKey(),

    // Foreign Keys
    eventId: integer('event_id')
      .notNull()
      .references(() => pvigilanceEvents.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => medicinalProducts.id, { onDelete: 'cascade' }),

    // Match Information
    matchType: text('match_type').notNull(), // 'inn', 'product_name', 'manual', 'ema_number'
    matchConfidence: real('match_confidence').notNull().default(1.0), // 0.0 to 1.0
    matchSource: text('match_source'), // Which field was used for matching

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('pvigilance_event_products_unique').on(table.eventId, table.productId),
    index('pvigilance_event_products_event_idx').on(table.eventId),
    index('pvigilance_event_products_product_idx').on(table.productId),
    index('pvigilance_event_products_confidence_idx').on(table.matchConfidence),
  ]
)

/**
 * Pharmacovigilance Event-Substance Links
 *
 * Junction table linking pharmacovigilance events to substances via INN.
 * INN (International Nonproprietary Name) is the primary cross-source identifier.
 */
export const pvigilanceEventSubstances = pgTable(
  'pvigilance_event_substances',
  {
    id: serial('id').primaryKey(),

    // Foreign Keys
    eventId: integer('event_id')
      .notNull()
      .references(() => pvigilanceEvents.id, { onDelete: 'cascade' }),
    substanceId: integer('substance_id').references(() => substances.id, { onDelete: 'set null' }), // Nullable - may not exist in our DB

    // INN is always stored for cross-source queries
    inn: text('inn').notNull(), // International Nonproprietary Name

    // Match Information
    matchType: text('match_type').notNull(), // 'exact', 'synonym', 'extracted', 'manual'
    matchConfidence: real('match_confidence').notNull().default(1.0), // 0.0 to 1.0
    matchSource: text('match_source'), // Which field was used for matching

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('pvigilance_event_substances_unique').on(table.eventId, table.inn),
    index('pvigilance_event_substances_event_idx').on(table.eventId),
    index('pvigilance_event_substances_substance_idx').on(table.substanceId),
    index('pvigilance_event_substances_inn_idx').on(table.inn),
    index('pvigilance_event_substances_confidence_idx').on(table.matchConfidence),
  ]
)

export type PvigilanceEventProduct = typeof pvigilanceEventProducts.$inferSelect
export type NewPvigilanceEventProduct = typeof pvigilanceEventProducts.$inferInsert
export type PvigilanceEventSubstance = typeof pvigilanceEventSubstances.$inferSelect
export type NewPvigilanceEventSubstance = typeof pvigilanceEventSubstances.$inferInsert
