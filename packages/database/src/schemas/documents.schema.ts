import { pgTable, serial, text, timestamp, integer, index, unique } from 'drizzle-orm/pg-core'
import { medicinalProductsExtended } from './medicinal-products-extended.schema.js'

/**
 * Documents Layer
 * Stores all document metadata from EPAR and Non-EPAR documents
 *
 * Design Principles:
 * - Normalized document storage with canonical URLs
 * - Document types: EPAR, SmPC, PL, Assessment, Annex, etc.
 * - Language support for multi-language documents
 * - Provenance tracking
 * - Processing status tracking for RAG pipeline
 */
export const documents = pgTable(
  'documents',
  {
    id: serial('id').primaryKey(),

    // Product relationship
    productId: integer('product_id').references(() => medicinalProductsExtended.id),

    // Document identity
    documentType: text('document_type').notNull(), // 'EPAR', 'SmPC', 'PL', 'Assessment', 'Annex', 'Press Release', etc.
    documentCategory: text('document_category'), // 'epar', 'non_epar'
    title: text('title').notNull(),

    // Language
    language: text('language').notNull().default('en'), // 'en', 'de', 'fr', etc.

    // URLs and File Info
    documentUrl: text('document_url').notNull(),
    pdfUrl: text('pdf_url'),
    fileSize: integer('file_size'), // in bytes

    // Publication Info
    publishedDate: timestamp('published_date'),
    lastModifiedDate: timestamp('last_modified_date'),

    // Document Version
    versionNumber: text('version_number'),

    // Processing Status (for RAG pipeline)
    processingStatus: text('processing_status').default('pending'), // 'pending', 'downloaded', 'extracted', 'chunked', 'embedded', 'failed'
    textExtractedAt: timestamp('text_extracted_at'),
    chunkCount: integer('chunk_count').default(0),
    extractorVersion: text('extractor_version'),
    processingError: text('processing_error'),

    // Provenance
    sourceEmaSourceId: integer('source_ema_source_id'),
    sourceJson: text('source_json'), // Original JSON from EMA for debugging

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('documents_product_idx').on(table.productId),
    index('documents_type_idx').on(table.documentType),
    index('documents_language_idx').on(table.language),
    index('documents_category_idx').on(table.documentCategory),
    index('documents_processing_status_idx').on(table.processingStatus),
    unique('documents_url_unique').on(table.documentUrl),
  ]
)

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
