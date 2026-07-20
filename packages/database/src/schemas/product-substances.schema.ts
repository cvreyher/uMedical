import { pgTable, integer, boolean, primaryKey } from 'drizzle-orm/pg-core'
import { medicinalProducts } from './medicinal-products.schema.js'
import { substances } from './substances.schema.js'

/**
 * Junction table: medicinal products <-> substances (n:m)
 * Phase 1: Links products to their active substances
 */
export const productSubstances = pgTable(
  'product_substances',
  {
    productId: integer('product_id')
      .notNull()
      .references(() => medicinalProducts.id, { onDelete: 'cascade' }),
    substanceId: integer('substance_id')
      .notNull()
      .references(() => substances.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.productId, table.substanceId] })]
)

export type ProductSubstance = typeof productSubstances.$inferSelect
export type NewProductSubstance = typeof productSubstances.$inferInsert
