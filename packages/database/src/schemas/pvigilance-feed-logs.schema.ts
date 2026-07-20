import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { pvigilanceFeedSources } from './pvigilance-feed-sources.schema.js'

/**
 * Pharmacovigilance Feed Logs
 *
 * Tracks every fetch operation for audit and debugging purposes.
 * Enables monitoring feed health and troubleshooting failures.
 */
export const pvigilanceFeedLogs = pgTable(
  'pvigilance_feed_logs',
  {
    id: serial('id').primaryKey(),

    // Reference to feed source
    feedSourceId: integer('feed_source_id')
      .notNull()
      .references(() => pvigilanceFeedSources.id, { onDelete: 'cascade' }),

    // Fetch Status
    status: text('status').notNull(), // 'success', 'failed', 'partial'

    // Timing
    fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
    durationMs: integer('duration_ms'), // How long the fetch took

    // Results
    itemsFetched: integer('items_fetched').notNull().default(0), // Total items in feed
    itemsCreated: integer('items_created').notNull().default(0), // New events created
    itemsUpdated: integer('items_updated').notNull().default(0), // Existing events updated
    itemsSkipped: integer('items_skipped').notNull().default(0), // Duplicates or filtered

    // HTTP Details
    httpStatus: integer('http_status'), // HTTP response code
    responseSize: integer('response_size'), // Response size in bytes

    // Error Information
    errorMessage: text('error_message'), // Error message if failed
    errorDetails: text('error_details'), // Stack trace or additional details

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('pvigilance_feed_logs_feed_idx').on(table.feedSourceId),
    index('pvigilance_feed_logs_status_idx').on(table.status),
    index('pvigilance_feed_logs_fetched_at_idx').on(table.fetchedAt),
    index('pvigilance_feed_logs_feed_fetched_idx').on(table.feedSourceId, table.fetchedAt),
  ]
)

export type PvigilanceFeedLog = typeof pvigilanceFeedLogs.$inferSelect
export type NewPvigilanceFeedLog = typeof pvigilanceFeedLogs.$inferInsert
