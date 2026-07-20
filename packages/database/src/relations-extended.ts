import { relations } from 'drizzle-orm'
import {
  // Core entities
  productCategories,
  medicinalProductsExtended,
  substances,
  companies,
  productSubstances,
  productCompanies,
  productDesignations,
  // Documents
  documents,
  // Regulatory
  procedures,
  referrals,
  productReferrals,
  // Timeline
  timelineEvents,
  eventSources,
  // News & Shortages
  newsItems,
  productNews,
  shortages,
} from './schemas/index.js'

// ============================================================================
// CORE ENTITIES
// ============================================================================

/**
 * Product Categories relations
 */
export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(medicinalProductsExtended),
}))

/**
 * Medicinal Products Extended relations
 */
export const medicinalProductsExtendedRelations = relations(
  medicinalProductsExtended,
  ({ one, many }) => ({
    // Category
    category: one(productCategories, {
      fields: [medicinalProductsExtended.categoryId],
      references: [productCategories.id],
    }),

    // Substances (many-to-many)
    productSubstances: many(productSubstances),

    // Companies (many-to-many)
    productCompanies: many(productCompanies),

    // Designations
    designations: many(productDesignations),

    // Documents
    documents: many(documents),

    // Procedures
    procedures: many(procedures),

    // Referrals (many-to-many)
    productReferrals: many(productReferrals),

    // Timeline Events
    timelineEvents: many(timelineEvents),

    // News (many-to-many)
    productNews: many(productNews),

    // Shortages
    shortages: many(shortages),
  })
)

/**
 * Substances relations (unchanged from Phase 1)
 */
export const substancesRelations = relations(substances, ({ many }) => ({
  productSubstances: many(productSubstances),
}))

/**
 * Companies relations (unchanged from Phase 1)
 */
export const companiesRelations = relations(companies, ({ many }) => ({
  productCompanies: many(productCompanies),
}))

/**
 * Product-Substances junction relations
 */
export const productSubstancesRelations = relations(productSubstances, ({ one }) => ({
  product: one(medicinalProductsExtended, {
    fields: [productSubstances.productId],
    references: [medicinalProductsExtended.id],
  }),
  substance: one(substances, {
    fields: [productSubstances.substanceId],
    references: [substances.id],
  }),
}))

/**
 * Product-Companies junction relations
 */
export const productCompaniesRelations = relations(productCompanies, ({ one }) => ({
  product: one(medicinalProductsExtended, {
    fields: [productCompanies.productId],
    references: [medicinalProductsExtended.id],
  }),
  company: one(companies, {
    fields: [productCompanies.companyId],
    references: [companies.id],
  }),
}))

/**
 * Product Designations relations
 */
export const productDesignationsRelations = relations(productDesignations, ({ one }) => ({
  product: one(medicinalProductsExtended, {
    fields: [productDesignations.productId],
    references: [medicinalProductsExtended.id],
  }),
}))

// ============================================================================
// DOCUMENTS
// ============================================================================

/**
 * Documents relations
 */
export const documentsRelations = relations(documents, ({ one, many }) => ({
  product: one(medicinalProductsExtended, {
    fields: [documents.productId],
    references: [medicinalProductsExtended.id],
  }),
  // Events generated from this document
  eventSources: many(eventSources),
}))

// ============================================================================
// REGULATORY ENTITIES
// ============================================================================

/**
 * Procedures relations
 */
export const proceduresRelations = relations(procedures, ({ one, many }) => ({
  product: one(medicinalProductsExtended, {
    fields: [procedures.productId],
    references: [medicinalProductsExtended.id],
  }),
  // Events generated from this procedure
  eventSources: many(eventSources),
}))

/**
 * Referrals relations
 */
export const referralsRelations = relations(referrals, ({ many }) => ({
  // Products affected by this referral (many-to-many)
  productReferrals: many(productReferrals),
  // Events generated from this referral
  eventSources: many(eventSources),
}))

/**
 * Product-Referrals junction relations
 */
export const productReferralsRelations = relations(productReferrals, ({ one }) => ({
  product: one(medicinalProductsExtended, {
    fields: [productReferrals.productId],
    references: [medicinalProductsExtended.id],
  }),
  referral: one(referrals, {
    fields: [productReferrals.referralId],
    references: [referrals.id],
  }),
}))

// ============================================================================
// TIMELINE & EVENTS
// ============================================================================

/**
 * Timeline Events relations
 */
export const timelineEventsRelations = relations(timelineEvents, ({ one, many }) => ({
  product: one(medicinalProductsExtended, {
    fields: [timelineEvents.productId],
    references: [medicinalProductsExtended.id],
  }),
  // Source entities that generated this event
  eventSources: many(eventSources),
}))

/**
 * Event Sources relations
 * Links events back to their originating entities
 */
export const eventSourcesRelations = relations(eventSources, ({ one }) => ({
  event: one(timelineEvents, {
    fields: [eventSources.eventId],
    references: [timelineEvents.id],
  }),
  // Polymorphic relations would be handled in application code
  // based on sourceType and sourceId
}))

// ============================================================================
// NEWS & SHORTAGES
// ============================================================================

/**
 * News Items relations
 */
export const newsItemsRelations = relations(newsItems, ({ many }) => ({
  // Products mentioned in this news (many-to-many)
  productNews: many(productNews),
  // Events generated from this news
  eventSources: many(eventSources),
}))

/**
 * Product-News junction relations
 */
export const productNewsRelations = relations(productNews, ({ one }) => ({
  product: one(medicinalProductsExtended, {
    fields: [productNews.productId],
    references: [medicinalProductsExtended.id],
  }),
  news: one(newsItems, {
    fields: [productNews.newsId],
    references: [newsItems.id],
  }),
}))

/**
 * Shortages relations
 */
export const shortagesRelations = relations(shortages, ({ one, many }) => ({
  product: one(medicinalProductsExtended, {
    fields: [shortages.productId],
    references: [medicinalProductsExtended.id],
  }),
  // Events generated from this shortage
  eventSources: many(eventSources),
}))
