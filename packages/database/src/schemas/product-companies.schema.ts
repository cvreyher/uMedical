import { pgTable, integer, text, primaryKey } from 'drizzle-orm/pg-core'
import { medicinalProductsExtended } from './medicinal-products-extended.schema.js'
import { companies } from './companies.schema.js'

/**
 * Junction table: medicinal products <-> companies (n:m with role)
 * productId references medicinal_products_extended (the authoritative product
 * table used by the API/web) - NOT the legacy phase-1 medicinal_products table.
 * Roles: 'mah' (Marketing Authorization Holder), 'manufacturer', 'distributor'
 */
export const productCompanies = pgTable(
  'product_companies',
  {
    productId: integer('product_id')
      .notNull()
      .references(() => medicinalProductsExtended.id, { onDelete: 'cascade' }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('mah'),
  },
  (table) => [primaryKey({ columns: [table.productId, table.companyId, table.role] })]
)

export type ProductCompany = typeof productCompanies.$inferSelect
export type NewProductCompany = typeof productCompanies.$inferInsert
