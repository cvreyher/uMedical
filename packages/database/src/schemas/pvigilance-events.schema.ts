import {
  pgTable,
  serial,
  text,
  date,
  timestamp,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { pvigilanceFeedSources } from './pvigilance-feed-sources.schema.js'

/**
 * Pharmacovigilance Events - Multi-Source Regulatory Event Aggregation
 *
 * Aggregates safety events from multiple regulatory authorities:
 * - FDA (US): Recalls, MedWatch alerts
 * - MHRA (UK): Drug safety updates
 * - Swissmedic (CH): HPC letters
 * - BfArM (DE): Rote-Hand-Briefe
 * - EMA (EU): Safety signals, referrals
 * - WHO: International alerts
 *
 * Design Principles:
 * - EMA is the leading source (full product/document data from EMA only)
 * - Other sources provide events/incidents only (no duplicate embeddings)
 * - INN (International Nonproprietary Name) as common identifier
 * - Clear provenance: every record tracks its source authority
 */
export const pvigilanceEvents = pgTable(
  'pvigilance_events',
  {
    id: serial('id').primaryKey(),

    // Unique identifier
    slug: text('slug').notNull().unique(), // e.g., "fda-recall-2024-12345"

    // Source Authority & Region
    sourceAuthority: text('source_authority').notNull(), // 'FDA', 'MHRA', 'Swissmedic', 'BfArM', 'EMA', 'WHO'
    region: text('region').notNull(), // 'US', 'UK', 'CH', 'DE', 'EU', 'INT'

    // Event Classification
    eventType: text('event_type').notNull(), // Normalized: 'recall', 'safety_alert', 'dhpc', 'withdrawal', 'label_change'
    eventCategory: text('event_category').notNull(), // 'safety', 'quality', 'supply', 'regulatory'
    severity: text('severity').notNull().default('medium'), // 'critical', 'high', 'medium', 'low', 'info'

    // Event Content
    title: text('title').notNull(),
    description: text('description'),
    eventDate: date('event_date').notNull(),

    // Flexible JSON for source-specific data
    eventData: jsonb('event_data').$type<{
      // For recalls
      recallClass?: 'I' | 'II' | 'III'
      lotNumbers?: string[]
      reasonForRecall?: string
      distributionPattern?: string

      // For safety alerts
      affectedProducts?: string[]
      recommendedActions?: string[]

      // For DHPCs
      keyMessages?: string[]
      targetAudience?: string[]

      // For withdrawals
      withdrawalReason?: string
      withdrawalScope?: string // 'voluntary', 'regulatory'

      // For label changes
      changeType?: string
      affectedSections?: string[]

      // Generic additional data
      [key: string]: unknown
    }>(),

    // Source References
    sourceUrl: text('source_url').notNull(), // Original source link
    sourceDocumentId: text('source_document_id'), // ID from source system
    sourceFeedId: integer('source_feed_id').references(() => pvigilanceFeedSources.id),

    // Deduplication
    contentHash: text('content_hash'), // MD5/SHA hash for dedup

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('pvigilance_events_authority_idx').on(table.sourceAuthority),
    index('pvigilance_events_region_idx').on(table.region),
    index('pvigilance_events_type_idx').on(table.eventType),
    index('pvigilance_events_category_idx').on(table.eventCategory),
    index('pvigilance_events_severity_idx').on(table.severity),
    index('pvigilance_events_date_idx').on(table.eventDate),
    index('pvigilance_events_feed_idx').on(table.sourceFeedId),
    index('pvigilance_events_hash_idx').on(table.contentHash),
    // Compound indexes for common queries
    index('pvigilance_events_authority_date_idx').on(table.sourceAuthority, table.eventDate),
    index('pvigilance_events_type_severity_idx').on(table.eventType, table.severity),
  ]
)

export type PvigilanceEvent = typeof pvigilanceEvents.$inferSelect
export type NewPvigilanceEvent = typeof pvigilanceEvents.$inferInsert
