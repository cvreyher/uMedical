import { pgTable, integer, boolean, primaryKey } from 'drizzle-orm/pg-core'
import { medicinalProductsExtended } from './medicinal-products-extended.schema.js'
import { substances } from './substances.schema.js'

/**
 * Junction table: medicinal products <-> substances (n:m)
 * productId references medicinal_products_extended (the authoritative product
 * table used by the API/web) - NOT the legacy phase-1 medicinal_products table.
 */
export const productSubstances = pgTable(
  'product_substances',
  {
    productId: integer('product_id')
      .notNull()
      .references(() => medicinalProductsExtended.id, { onDelete: 'cascade' }),
    substanceId: integer('substance_id')
      .notNull()
      .references(() => substances.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.productId, table.substanceId] })]
)

export type ProductSubstance = typeof productSubstances.$inferSelect
export type NewProductSubstance = typeof productSubstances.$inferInsert
