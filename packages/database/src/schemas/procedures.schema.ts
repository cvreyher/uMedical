import { pgTable, serial, text, date, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { medicinalProductsExtended } from './medicinal-products-extended.schema.js'

/**
 * Procedures - Regulatory procedures affecting products
 * Captures all procedure references (VR/XXXX, EMEA/H/C/XXXX/II/XXXX, etc.)
 *
 * Design Principles:
 * - Normalized procedure storage
 * - Links to products and timeline events
 * - Procedure types: Initial, Variation, Referral, etc.
 */
export const procedures = pgTable(
  'procedures',
  {
    id: serial('id').primaryKey(),

    // Procedure Identity
    procedureNumber: text('procedure_number').notNull().unique(), // e.g., VR/0000254621, EMEA/H/C/005814/II/0042
    procedureType: text('procedure_type'), // 'Initial', 'Type IA', 'Type IB', 'Type II', 'Referral', 'Annual Re-assessment', etc.

    // Relationships
    productId: integer('product_id').references(() => medicinalProductsExtended.id),

    // Procedure Details
    title: text('title'),
    description: text('description'),
    scope: text('scope'), // What was changed/assessed

    // Dates
    startDate: date('start_date'),
    opinionDate: date('opinion_date'),
    commissionDecisionDate: date('commission_decision_date'),

    // Outcome
    outcome: text('outcome'), // 'Approved', 'Withdrawn', 'Refused', etc.

    // Provenance
    sourceUrl: text('source_url'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('procedures_product_idx').on(table.productId),
    index('procedures_type_idx').on(table.procedureType),
    index('procedures_opinion_date_idx').on(table.opinionDate),
  ]
)

export type Procedure = typeof procedures.$inferSelect
export type NewProcedure = typeof procedures.$inferInsert
