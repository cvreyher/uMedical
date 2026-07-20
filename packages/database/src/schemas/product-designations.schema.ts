import { pgTable, serial, text, date, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { medicinalProductsExtended } from './medicinal-products-extended.schema.js'

/**
 * Product Designations - Special regulatory designations with metadata
 * Normalized storage for Orphan, Prime, Conditional Approval, etc. with full details
 *
 * Design Principles:
 * - Complement boolean flags in medicinal_products_extended with detailed metadata
 * - Track designation history (granted, maintained, removed)
 * - Link to supporting documents
 */
export const productDesignations = pgTable(
  'product_designations',
  {
    id: serial('id').primaryKey(),

    // Product relationship
    productId: integer('product_id').references(() => medicinalProductsExtended.id),

    // Designation Type
    designationType: text('designation_type').notNull(), // 'orphan', 'prime', 'conditional_approval', 'exceptional_circumstances', 'accelerated_assessment'

    // Designation Details
    designationNumber: text('designation_number'), // EU/3/XX/XXXX for orphan
    condition: text('condition'), // The condition for which it was designated

    // Status
    status: text('status').notNull(), // 'active', 'removed', 'transferred'

    // Dates
    grantedDate: date('granted_date'),
    removedDate: date('removed_date'),

    // Orphan-specific
    prevalence: text('prevalence'), // For orphan medicines
    significantBenefit: text('significant_benefit'),

    // Prime-specific
    primeEligibilityDate: date('prime_eligibility_date'),

    // Conditional Approval-specific
    specificObligations: text('specific_obligations'),
    annualReassessmentDue: date('annual_reassessment_due'),

    // Supporting Documents
    supportingDocumentUrl: text('supporting_document_url'),

    // Provenance
    sourceUrl: text('source_url'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('product_designations_product_idx').on(table.productId),
    index('product_designations_type_idx').on(table.designationType),
    index('product_designations_status_idx').on(table.status),
  ]
)

export type ProductDesignation = typeof productDesignations.$inferSelect
export type NewProductDesignation = typeof productDesignations.$inferInsert
