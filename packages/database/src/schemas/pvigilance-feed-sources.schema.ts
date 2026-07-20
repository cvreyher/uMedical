import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

/**
 * Pharmacovigilance Feed Sources
 *
 * Configuration for external data feeds from regulatory authorities.
 * Supports RSS feeds, REST APIs, and web scrapers.
 *
 * Pre-configured sources:
 * - FDA Enforcement API (api.fda.gov)
 * - FDA Drug Recalls RSS
 * - FDA MedWatch Safety Alerts RSS
 * - MHRA Drug Safety Updates API
 * - Swissmedic HPC Letters RSS
 * - BfArM Rote-Hand-Briefe RSS
 * - EMA Safety Signals RSS
 */
export const pvigilanceFeedSources = pgTable(
  'pvigilance_feed_sources',
  {
    id: serial('id').primaryKey(),

    // Identification
    name: text('name').notNull(), // Human-readable name
    slug: text('slug').notNull().unique(), // URL-safe identifier

    // Source Classification
    authority: text('authority').notNull(), // 'FDA', 'MHRA', 'Swissmedic', 'BfArM', 'EMA', 'WHO'
    region: text('region').notNull(), // 'US', 'UK', 'CH', 'DE', 'EU', 'INT'
    feedType: text('feed_type').notNull(), // 'rss', 'api', 'scraper'

    // Connection Details
    feedUrl: text('feed_url').notNull(), // Endpoint URL
    feedConfig: jsonb('feed_config').$type<{
      // API authentication
      apiKey?: string
      authHeader?: string

      // Request configuration
      method?: 'GET' | 'POST'
      headers?: Record<string, string>
      queryParams?: Record<string, string>
      body?: Record<string, unknown>

      // Parsing hints
      dateFormat?: string
      itemPath?: string // JSONPath to items array
      mappings?: Record<string, string> // Field mappings

      // Rate limiting
      rateLimit?: number // requests per minute
      timeout?: number // milliseconds
    }>(),

    // Operational State
    isEnabled: boolean('is_enabled').notNull().default(true),
    isHealthy: boolean('is_healthy').notNull().default(true),
    pollIntervalMinutes: integer('poll_interval_minutes').notNull().default(60),

    // Fetch State
    lastFetchedAt: timestamp('last_fetched_at'),
    lastSuccessAt: timestamp('last_success_at'),
    lastError: text('last_error'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),

    // Statistics
    totalFetches: integer('total_fetches').notNull().default(0),
    totalItemsProcessed: integer('total_items_processed').notNull().default(0),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('pvigilance_feed_sources_authority_idx').on(table.authority),
    index('pvigilance_feed_sources_enabled_idx').on(table.isEnabled),
    index('pvigilance_feed_sources_healthy_idx').on(table.isHealthy),
    index('pvigilance_feed_sources_next_fetch_idx').on(table.isEnabled, table.lastFetchedAt),
  ]
)

export type PvigilanceFeedSource = typeof pvigilanceFeedSources.$inferSelect
export type NewPvigilanceFeedSource = typeof pvigilanceFeedSources.$inferInsert
