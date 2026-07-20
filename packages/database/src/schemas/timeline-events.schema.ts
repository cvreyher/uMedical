import { pgTable, serial, text, date, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { medicinalProductsExtended } from './medicinal-products-extended.schema.js'

/**
 * Timeline Events - Northdata-style Event System
 * Central event table for ALL product lifecycle changes
 *
 * Design Principles:
 * - Every change is an immutable event
 * - Full provenance (source, confidence, timestamp)
 * - Event types cover: regulatory, documents, safety, news
 * - Queryable timeline for product history
 *
 * Event Categories:
 * - regulatory: authorised, withdrawn, status_changed, opinion_adopted
 * - documents: epar_published, epar_updated, smpc_updated, pl_updated
 * - procedures: procedure_started, procedure_completed, variation_approved
 * - safety: referral_started, referral_completed, safety_alert
 * - news: press_release, ema_news
 * - supply: shortage_reported, shortage_resolved
 */
export const timelineEvents = pgTable(
  'timeline_events',
  {
    id: serial('id').primaryKey(),

    // Event Identity
    eventType: text('event_type').notNull(), // 'authorised', 'withdrawn', 'status_changed', 'epar_published', etc.
    eventCategory: text('event_category').notNull(), // 'regulatory', 'documents', 'procedures', 'safety', 'news', 'supply'

    // Relationships
    productId: integer('product_id').references(() => medicinalProductsExtended.id),

    // Event Content
    title: text('title').notNull(), // Human-readable event title
    description: text('description'), // Optional detailed description
    eventDate: date('event_date').notNull(), // The date the event occurred

    // Event-specific data (flexible JSON for different event types)
    eventData: jsonb('event_data').$type<{
      // For status changes
      oldStatus?: string
      newStatus?: string

      // For documents
      documentType?: string
      documentUrl?: string
      versionNumber?: string

      // For procedures
      procedureNumber?: string
      procedureType?: string

      // For referrals
      referralNumber?: string
      legalBasis?: string

      // For news/shortages
      newsId?: number
      shortageId?: number

      // Generic additional data
      [key: string]: unknown
    }>(),

    // Provenance - CRITICAL for data quality
    sourceUrl: text('source_url').notNull(), // Where this event came from
    sourceType: text('source_type').notNull(), // 'ema_medicines_json', 'ema_documents_json', 'ema_news_json', etc.
    confidence: text('confidence').default('high'), // 'high', 'medium', 'low' - for extracted events
    extractorVersion: text('extractor_version'), // Which pipeline version created this event

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('timeline_events_product_idx').on(table.productId),
    index('timeline_events_type_idx').on(table.eventType),
    index('timeline_events_category_idx').on(table.eventCategory),
    index('timeline_events_date_idx').on(table.eventDate),
    index('timeline_events_product_date_idx').on(table.productId, table.eventDate), // Compound index for product timeline queries
  ]
)

/**
 * Event Sources - Links events to their source entities
 * Allows tracking which document, procedure, or news item generated an event
 */
export const eventSources = pgTable(
  'event_sources',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id').notNull().references(() => timelineEvents.id),

    // Polymorphic source reference
    sourceType: text('source_type').notNull(), // 'document', 'procedure', 'referral', 'news', 'shortage'
    sourceId: integer('source_id').notNull(), // ID in the respective table

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('event_sources_event_idx').on(table.eventId),
    index('event_sources_source_idx').on(table.sourceType, table.sourceId),
  ]
)

export type TimelineEvent = typeof timelineEvents.$inferSelect
export type NewTimelineEvent = typeof timelineEvents.$inferInsert
export type EventSource = typeof eventSources.$inferSelect
export type NewEventSource = typeof eventSources.$inferInsert
