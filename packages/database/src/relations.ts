import { relations } from 'drizzle-orm'
import {
  medicinalProducts,
  substances,
  companies,
  productSubstances,
  productCompanies,
  documents,
  documentChunks,
  pvigilanceFeedSources,
  pvigilanceFeedLogs,
  pvigilanceEvents,
  pvigilanceEventProducts,
  pvigilanceEventSubstances,
  regionalAuthorizations,
  regionalAuthorizationHistory,
} from './schemas/index.js'

// Medicinal Products relations
export const medicinalProductsRelations = relations(medicinalProducts, ({ many }) => ({
  productSubstances: many(productSubstances),
  productCompanies: many(productCompanies),
}))

// Substances relations
export const substancesRelations = relations(substances, ({ many }) => ({
  productSubstances: many(productSubstances),
}))

// Companies relations
export const companiesRelations = relations(companies, ({ many }) => ({
  productCompanies: many(productCompanies),
}))

// Product-Substances junction relations
export const productSubstancesRelations = relations(productSubstances, ({ one }) => ({
  product: one(medicinalProducts, {
    fields: [productSubstances.productId],
    references: [medicinalProducts.id],
  }),
  substance: one(substances, {
    fields: [productSubstances.substanceId],
    references: [substances.id],
  }),
}))

// Product-Companies junction relations
export const productCompaniesRelations = relations(productCompanies, ({ one }) => ({
  product: one(medicinalProducts, {
    fields: [productCompanies.productId],
    references: [medicinalProducts.id],
  }),
  company: one(companies, {
    fields: [productCompanies.companyId],
    references: [companies.id],
  }),
}))

// Documents relations
export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(documentChunks),
}))

// Document chunks relations
export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}))

// ==========================================
// Pharmacovigilance Relations
// ==========================================

// Feed Sources relations
export const pvigilanceFeedSourcesRelations = relations(pvigilanceFeedSources, ({ many }) => ({
  logs: many(pvigilanceFeedLogs),
  events: many(pvigilanceEvents),
}))

// Feed Logs relations
export const pvigilanceFeedLogsRelations = relations(pvigilanceFeedLogs, ({ one }) => ({
  feedSource: one(pvigilanceFeedSources, {
    fields: [pvigilanceFeedLogs.feedSourceId],
    references: [pvigilanceFeedSources.id],
  }),
}))

// Pharmacovigilance Events relations
export const pvigilanceEventsRelations = relations(pvigilanceEvents, ({ one, many }) => ({
  feedSource: one(pvigilanceFeedSources, {
    fields: [pvigilanceEvents.sourceFeedId],
    references: [pvigilanceFeedSources.id],
  }),
  linkedProducts: many(pvigilanceEventProducts),
  linkedSubstances: many(pvigilanceEventSubstances),
}))

// Event-Product junction relations
export const pvigilanceEventProductsRelations = relations(pvigilanceEventProducts, ({ one }) => ({
  event: one(pvigilanceEvents, {
    fields: [pvigilanceEventProducts.eventId],
    references: [pvigilanceEvents.id],
  }),
  product: one(medicinalProducts, {
    fields: [pvigilanceEventProducts.productId],
    references: [medicinalProducts.id],
  }),
}))

// Event-Substance junction relations
export const pvigilanceEventSubstancesRelations = relations(pvigilanceEventSubstances, ({ one }) => ({
  event: one(pvigilanceEvents, {
    fields: [pvigilanceEventSubstances.eventId],
    references: [pvigilanceEvents.id],
  }),
  substance: one(substances, {
    fields: [pvigilanceEventSubstances.substanceId],
    references: [substances.id],
  }),
}))

// ==========================================
// Regional Authorization Relations
// ==========================================

// Regional Authorizations relations
export const regionalAuthorizationsRelations = relations(regionalAuthorizations, ({ one, many }) => ({
  product: one(medicinalProducts, {
    fields: [regionalAuthorizations.productId],
    references: [medicinalProducts.id],
  }),
  substance: one(substances, {
    fields: [regionalAuthorizations.substanceId],
    references: [substances.id],
  }),
  history: many(regionalAuthorizationHistory),
}))

// Regional Authorization History relations
export const regionalAuthorizationHistoryRelations = relations(regionalAuthorizationHistory, ({ one }) => ({
  authorization: one(regionalAuthorizations, {
    fields: [regionalAuthorizationHistory.authorizationId],
    references: [regionalAuthorizations.id],
  }),
}))
