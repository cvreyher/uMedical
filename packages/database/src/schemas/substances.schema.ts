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
 * Active substances (INN names) for medicinal products
 * Phase 1: Basic substance information
 */
export const substances = pgTable(
  'substances',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    innName: text('inn_name').notNull(),
    synonyms: text('synonyms').array(),

    // Search & Embeddings
    embedding: vector('embedding'),
    searchText: text('search_text'),
    embeddingUpdatedAt: timestamp('embedding_updated_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('substances_inn_name_idx').on(table.innName)]
)

export type Substance = typeof substances.$inferSelect
export type NewSubstance = typeof substances.$inferInsert
