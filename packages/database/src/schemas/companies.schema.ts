import { pgTable, serial, text, timestamp, index, customType } from 'drizzle-orm/pg-core'

// Custom type for pgvector
const vector = customType<{ data: number[] | null; driverData: string | null }>({
  dataType() {
    return 'vector(1536)'
  },
  toDriver(value: number[] | null): string | null {
    if (value === null || value === undefined) return null
    return `[${value.join(',')}]`
  },
  fromDriver(value: string | null): number[] | null {
    if (value === null || value === undefined) return null
    return JSON.parse(value.replace(/^\[/, '[').replace(/\]$/, ']'))
  },
})

/**
 * Companies (Marketing Authorization Holders, manufacturers, etc.)
 * Phase 1: Basic company information
 */
export const companies = pgTable(
  'companies',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    country: text('country'),

    // Search & Embeddings
    embedding: vector('embedding'),
    searchText: text('search_text'),
    embeddingUpdatedAt: timestamp('embedding_updated_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('companies_name_idx').on(table.name)]
)

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
