import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Product Categories (Human vs Veterinary)
 * Normalized category reference table
 */
export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(), // 'human', 'veterinary'
  name: text('name').notNull(), // 'Human', 'Veterinary'
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type ProductCategory = typeof productCategories.$inferSelect
export type NewProductCategory = typeof productCategories.$inferInsert
