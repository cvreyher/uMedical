import { pgTable, serial, text, date, timestamp, integer, index } from 'drizzle-orm/pg-core'

/**
 * Referrals - EMA Referral Procedures
 * Dedicated entity for Article 5(3), 31, 107, etc. referrals
 *
 * Design Principles:
 * - Separate from general procedures due to different structure
 * - Can affect multiple products (many-to-many via product_referrals)
 * - Full metadata from Referrals JSON
 */
export const referrals = pgTable(
  'referrals',
  {
    id: serial('id').primaryKey(),

    // Referral Identity
    referralNumber: text('referral_number').notNull().unique(), // e.g., EMEA/H/A-31/1234
    slug: text('slug').notNull().unique(),

    // Referral Details
    title: text('title').notNull(),
    legalBasis: text('legal_basis'), // 'Article 31', 'Article 107', 'Article 5(3)', etc.
    concernType: text('concern_type'), // 'Safety', 'Quality', 'Efficacy', etc.

    // Scope
    affectedSubstances: text('affected_substances'), // Comma/semicolon-separated
    affectedProductsDescription: text('affected_products_description'),

    // Process Dates
    startDate: date('start_date'),
    phtpOpinionDate: date('phtp_opinion_date'), // Pharmacovigilance
    pracOpinionDate: date('prac_opinion_date'), // Risk Assessment Committee
    chmpOpinionDate: date('chmp_opinion_date'), // Committee for Medicinal Products
    commissionDecisionDate: date('commission_decision_date'),

    // Outcome
    outcome: text('outcome'),
    summary: text('summary'),

    // Provenance
    referralUrl: text('referral_url'),
    sourceEmaSourceId: integer('source_ema_source_id'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('referrals_legal_basis_idx').on(table.legalBasis),
    index('referrals_start_date_idx').on(table.startDate),
    index('referrals_chmp_opinion_idx').on(table.chmpOpinionDate),
  ]
)

/**
 * Junction table for products affected by referrals
 */
export const productReferrals = pgTable(
  'product_referrals',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull(), // References medicinal_products_extended
    referralId: integer('referral_id').notNull().references(() => referrals.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('product_referrals_product_idx').on(table.productId),
    index('product_referrals_referral_idx').on(table.referralId),
  ]
)

export type Referral = typeof referrals.$inferSelect
export type NewReferral = typeof referrals.$inferInsert
export type ProductReferral = typeof productReferrals.$inferSelect
export type NewProductReferral = typeof productReferrals.$inferInsert
