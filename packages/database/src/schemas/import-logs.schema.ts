import { pgTable, serial, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'

/**
 * Import logs for tracking data imports from external sources
 * Tracks when imports happened, from which source, and what was imported
 */
export const importLogs = pgTable('import_logs', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(), // 'ema', 'bfarm', etc.
  sourceUrl: text('source_url').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'running', 'completed', 'failed'
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  totalFetched: integer('total_fetched').default(0),
  productsCreated: integer('products_created').default(0),
  productsUpdated: integer('products_updated').default(0),
  substancesCreated: integer('substances_created').default(0),
  companiesCreated: integer('companies_created').default(0),
  errorCount: integer('error_count').default(0),
  errors: jsonb('errors').$type<string[]>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
})

export type ImportLog = typeof importLogs.$inferSelect
export type NewImportLog = typeof importLogs.$inferInsert
