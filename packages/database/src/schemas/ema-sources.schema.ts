import { pgTable, serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core'

/**
 * Raw Sources Layer - Change Detection
 * Tracks all EMA API endpoints and their crawl state
 *
 * Design Principles:
 * - Separate raw content from extracted structure
 * - Incremental ingestion via etag/last_modified/content_hash
 * - Idempotent upserts (re-running never duplicates)
 */
export const emaSources = pgTable(
  'ema_sources',
  {
    id: serial('id').primaryKey(),
    sourceType: text('source_type').notNull(), // 'medicines_json', 'epar_documents_json', 'non_epar_documents_json', 'referrals_json', 'news_json', 'shortages_json'
    sourceUrl: text('source_url').notNull().unique(),

    // Change detection
    etag: text('etag'),
    lastModified: text('last_modified'),
    contentHash: text('content_hash'), // SHA256 of content for change detection

    // Crawl state
    lastCrawledAt: timestamp('last_crawled_at'),
    lastSuccessAt: timestamp('last_success_at'),
    httpStatus: integer('http_status'),
    crawlError: text('crawl_error'),

    // Metadata
    itemCount: integer('item_count'), // Number of items in this source
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('ema_sources_source_type_idx').on(table.sourceType),
    index('ema_sources_last_crawled_idx').on(table.lastCrawledAt),
  ]
)

export type EmaSource = typeof emaSources.$inferSelect
export type NewEmaSource = typeof emaSources.$inferInsert
