import { pgTable, serial, text, date, timestamp, integer, index, unique } from 'drizzle-orm/pg-core'

/**
 * News Items - EMA News and Press Releases
 *
 * Design Principles:
 * - Separate from official regulatory data
 * - Links to products via product_news junction
 * - Full metadata from News JSON
 * - Generates timeline events when linked to products
 */
export const newsItems = pgTable(
  'news_items',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),

    // News Content
    title: text('title').notNull(),
    summary: text('summary'),
    bodyText: text('body_text'), // Full article text if available

    // Classification
    newsType: text('news_type'), // 'Press Release', 'News', 'Safety Update', etc.
    category: text('category'), // Category from EMA

    // Publication
    publishedDate: date('published_date').notNull(),

    // URLs
    newsUrl: text('news_url').notNull(),

    // Language
    language: text('language').default('en'),

    // Provenance
    sourceEmaSourceId: integer('source_ema_source_id'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('news_items_published_idx').on(table.publishedDate),
    index('news_items_type_idx').on(table.newsType),
    unique('news_items_url_unique').on(table.newsUrl),
  ]
)

/**
 * Product-News Junction Table
 * Links news items to the products they mention
 *
 * Design Principles:
 * - Many-to-many relationship
 * - Confidence scoring for automatic extraction
 * - Creates timeline events when news affects a product
 */
export const productNews = pgTable(
  'product_news',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull(), // References medicinal_products_extended
    newsId: integer('news_id').notNull().references(() => newsItems.id),

    // Mention metadata
    mentionConfidence: text('mention_confidence').default('high'), // 'high', 'medium', 'low' for auto-extracted
    mentionContext: text('mention_context'), // Where in the article was it mentioned?

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('product_news_product_idx').on(table.productId),
    index('product_news_news_idx').on(table.newsId),
  ]
)

export type NewsItem = typeof newsItems.$inferSelect
export type NewNewsItem = typeof newsItems.$inferInsert
export type ProductNews = typeof productNews.$inferSelect
export type NewProductNews = typeof productNews.$inferInsert
