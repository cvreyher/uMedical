// MedikamentenProfil schemas - Comprehensive EMA Data Model

// Layer 1: Raw Sources (Change Detection)
export * from './ema-sources.schema.js'

// Layer 2: Core Entities
export * from './product-categories.schema.js'
export * from './medicinal-products.schema.js' // Phase 1 - kept for backwards compatibility
export * from './medicinal-products-extended.schema.js' // Complete EMA fields
export * from './substances.schema.js'
export * from './companies.schema.js'
export * from './product-substances.schema.js'
export * from './product-companies.schema.js'
export * from './product-designations.schema.js'

// Layer 3: Documents
export * from './documents.schema.js'
export * from './document-chunks.schema.js'

// Layer 3.5: RAG Infrastructure
export * from './embedding-jobs.schema.js'
export * from './processing-jobs.schema.js'

// Layer 4: Regulatory Entities
export * from './procedures.schema.js'
export * from './referrals.schema.js'

// Layer 5: Timeline & Events
export * from './timeline-events.schema.js'

// Layer 6: News & Shortages
export * from './news.schema.js'
export * from './shortages.schema.js'

// System
export * from './import-logs.schema.js'

// Layer 7: Pharmacovigilance (Multi-Source Event Aggregation)
export * from './pvigilance-feed-sources.schema.js'
export * from './pvigilance-feed-logs.schema.js'
export * from './pvigilance-events.schema.js'
export * from './pvigilance-event-links.schema.js'

// Layer 8: Regional Data
export * from './regional-authorizations.schema.js'
