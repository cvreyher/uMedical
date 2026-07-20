/**
 * EMA Data Model - TypeScript Usage Examples
 * Demonstrates common patterns for working with the schema
 */

import { db } from '../src/db'
import {
  medicinalProductsExtended,
  productCategories,
  documents,
  timelineEvents,
  eventSources,
  newsItems,
  productNews,
  shortages,
  referrals,
  productReferrals,
  procedures,
  productDesignations,
  emaSources,
  type NewTimelineEvent,
  type NewEventSource,
  type NewMedicinalProductExtended,
} from '../src/schemas'
import { eq, desc, and, gte, sql } from 'drizzle-orm'

// ============================================================================
// 1. UPSERT PRODUCT FROM EMA JSON
// Idempotent insert/update based on ema_number
// ============================================================================
async function upsertProductFromEMA(emaData: any) {
  const productData: NewMedicinalProductExtended = {
    slug: createSlug(emaData.name_of_medicine),
    name: emaData.name_of_medicine,
    emaNumber: emaData.ema_product_number,
    category: emaData.category,
    medicineStatus: emaData.medicine_status,
    opinionStatus: emaData.opinion_status,
    internationalNonProprietaryName: emaData.international_non_proprietary_name_common_name,
    activeSubstance: emaData.active_substance,
    therapeuticAreaMesh: emaData.therapeutic_area_mesh,
    therapeuticIndication: emaData.therapeutic_indication,
    atcCode: emaData.atc_code_human,
    pharmacotherapeuticGroup: emaData.pharmacotherapeutic_group_human,
    // Boolean designations
    patientSafety: emaData.patient_safety === 'Yes',
    acceleratedAssessment: emaData.accelerated_assessment === 'Yes',
    additionalMonitoring: emaData.additional_monitoring === 'Yes',
    advancedTherapy: emaData.advanced_therapy === 'Yes',
    biosimilar: emaData.biosimilar === 'Yes',
    conditionalApproval: emaData.conditional_approval === 'Yes',
    exceptionalCircumstances: emaData.exceptional_circumstances === 'Yes',
    genericOrHybrid: emaData.generic_or_hybrid === 'Yes',
    orphanMedicine: emaData.orphan_medicine === 'Yes',
    primePriorityMedicine: emaData.prime_priority_medicine === 'Yes',
    // Company (denormalized)
    marketingAuthorisationHolderDeveloperApplicant:
      emaData.marketing_authorisation_developer_applicant_holder,
    // Dates
    opinionAdoptedDate: parseEMADate(emaData.opinion_adopted_date),
    europeanCommissionDecisionDate: parseEMADate(emaData.european_commission_decision_date),
    marketingAuthorisationDate: parseEMADate(emaData.marketing_authorisation_date),
    withdrawalExpiryRevocationLapseDate: parseEMADate(
      emaData.withdrawal_expiry_revocation_lapse_of_marketing_authorisation_date
    ),
    firstPublishedDate: parseEMADate(emaData.first_published_date),
    lastUpdatedDate: parseEMADate(emaData.last_updated_date),
    // Procedures
    latestProcedureAffectingProductInformation: emaData.latest_procedure_affecting_product_information,
    // Provenance
    revisionNumber: parseInt(emaData.revision_number) || null,
    medicineUrl: emaData.medicine_url,
  }

  // Upsert based on ema_number
  const [product] = await db
    .insert(medicinalProductsExtended)
    .values(productData)
    .onConflictDoUpdate({
      target: medicinalProductsExtended.emaNumber,
      set: {
        ...productData,
        updatedAt: new Date(),
      },
    })
    .returning()

  return product
}

// ============================================================================
// 2. CREATE TIMELINE EVENT WITH PROVENANCE
// Proper event creation with source tracking
// ============================================================================
async function createTimelineEvent(params: {
  productId: number
  eventType: string
  eventCategory: string
  title: string
  eventDate: Date
  eventData?: Record<string, unknown>
  sourceUrl: string
  sourceType: string
  sourceEntityType?: 'document' | 'procedure' | 'referral' | 'news' | 'shortage'
  sourceEntityId?: number
}) {
  const {
    productId,
    eventType,
    eventCategory,
    title,
    eventDate,
    eventData,
    sourceUrl,
    sourceType,
    sourceEntityType,
    sourceEntityId,
  } = params

  // Create event
  const [event] = await db
    .insert(timelineEvents)
    .values({
      eventType,
      eventCategory,
      productId,
      title,
      eventDate,
      eventData: eventData || {},
      sourceUrl,
      sourceType,
      confidence: 'high',
      extractorVersion: 'v1.0.0',
    })
    .returning()

  // Link to source entity if provided
  if (sourceEntityType && sourceEntityId) {
    await db.insert(eventSources).values({
      eventId: event.id,
      sourceType: sourceEntityType,
      sourceId: sourceEntityId,
    })
  }

  return event
}

// ============================================================================
// 3. GET PRODUCT TIMELINE (Northdata-style)
// Complete event history for a product
// ============================================================================
async function getProductTimeline(productId: number) {
  const events = await db
    .select({
      id: timelineEvents.id,
      eventDate: timelineEvents.eventDate,
      eventType: timelineEvents.eventType,
      eventCategory: timelineEvents.eventCategory,
      title: timelineEvents.title,
      description: timelineEvents.description,
      eventData: timelineEvents.eventData,
      sourceUrl: timelineEvents.sourceUrl,
      confidence: timelineEvents.confidence,
    })
    .from(timelineEvents)
    .where(eq(timelineEvents.productId, productId))
    .orderBy(desc(timelineEvents.eventDate), desc(timelineEvents.createdAt))

  return events
}

// ============================================================================
// 4. DETECT CHANGES AND CREATE EVENTS
// Compare old vs new product data and generate events
// ============================================================================
async function detectAndCreateEvents(
  oldProduct: any,
  newProduct: NewMedicinalProductExtended,
  productId: number,
  sourceUrl: string
) {
  const events: NewTimelineEvent[] = []

  // Status change
  if (oldProduct.medicineStatus !== newProduct.medicineStatus) {
    events.push({
      eventType: 'status_changed',
      eventCategory: 'regulatory',
      productId,
      title: `Status changed from ${oldProduct.medicineStatus} to ${newProduct.medicineStatus}`,
      eventDate: newProduct.lastUpdatedDate || new Date(),
      eventData: {
        oldStatus: oldProduct.medicineStatus,
        newStatus: newProduct.medicineStatus,
      },
      sourceUrl,
      sourceType: 'ema_medicines_json',
      confidence: 'high',
      extractorVersion: 'v1.0.0',
    })
  }

  // New marketing authorisation
  if (!oldProduct.marketingAuthorisationDate && newProduct.marketingAuthorisationDate) {
    events.push({
      eventType: 'authorised',
      eventCategory: 'regulatory',
      productId,
      title: 'Marketing authorisation granted',
      eventDate: newProduct.marketingAuthorisationDate,
      eventData: {
        opinionDate: newProduct.opinionAdoptedDate,
        commissionDecisionDate: newProduct.europeanCommissionDecisionDate,
      },
      sourceUrl,
      sourceType: 'ema_medicines_json',
      confidence: 'high',
      extractorVersion: 'v1.0.0',
    })
  }

  // Withdrawal
  if (!oldProduct.withdrawalExpiryRevocationLapseDate && newProduct.withdrawalExpiryRevocationLapseDate) {
    events.push({
      eventType: 'withdrawn',
      eventCategory: 'regulatory',
      productId,
      title: 'Marketing authorisation withdrawn',
      eventDate: newProduct.withdrawalExpiryRevocationLapseDate,
      eventData: {},
      sourceUrl,
      sourceType: 'ema_medicines_json',
      confidence: 'high',
      extractorVersion: 'v1.0.0',
    })
  }

  // Insert all events
  if (events.length > 0) {
    await db.insert(timelineEvents).values(events)
  }

  return events
}

// ============================================================================
// 5. QUERY PRODUCTS WITH RELATIONSHIPS
// Get products with substances and companies
// ============================================================================
async function getProductsWithRelationships() {
  const products = await db.query.medicinalProductsExtended.findMany({
    with: {
      category: true,
      productSubstances: {
        with: {
          substance: true,
        },
      },
      productCompanies: {
        with: {
          company: true,
        },
      },
      designations: {
        where: eq(productDesignations.status, 'active'),
      },
      timelineEvents: {
        orderBy: desc(timelineEvents.eventDate),
        limit: 5,
      },
    },
    limit: 50,
  })

  return products
}

// ============================================================================
// 6. FIND PRODUCTS BY THERAPEUTIC AREA
// Filter by MeSH therapeutic area
// ============================================================================
async function findProductsByTherapeuticArea(meshTerm: string) {
  const products = await db
    .select()
    .from(medicinalProductsExtended)
    .where(
      and(
        sql`${medicinalProductsExtended.therapeuticAreaMesh} ILIKE ${`%${meshTerm}%`}`,
        eq(medicinalProductsExtended.medicineStatus, 'Authorised')
      )
    )
    .orderBy(desc(medicinalProductsExtended.lastUpdatedDate))

  return products
}

// ============================================================================
// 7. GET ACTIVE SHORTAGES
// Current supply issues
// ============================================================================
async function getActiveShortages() {
  const activeShortages = await db.query.shortages.findMany({
    where: eq(shortages.status, 'active'),
    with: {
      product: {
        columns: {
          id: true,
          name: true,
          emaNumber: true,
        },
      },
    },
    orderBy: [
      sql`CASE ${shortages.severity}
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END`,
      desc(shortages.reportedDate),
    ],
  })

  return activeShortages
}

// ============================================================================
// 8. LINK NEWS TO PRODUCTS
// Auto-link news based on product mentions
// ============================================================================
async function linkNewsToProducts(newsId: number, productIds: number[], confidence: 'high' | 'medium' | 'low') {
  const links = productIds.map((productId) => ({
    newsId,
    productId,
    mentionConfidence: confidence,
  }))

  await db.insert(productNews).values(links).onConflictDoNothing()

  // Create timeline events for high-confidence mentions
  if (confidence === 'high') {
    const newsItem = await db.query.newsItems.findFirst({
      where: eq(newsItems.id, newsId),
    })

    if (newsItem) {
      const events = productIds.map((productId) => ({
        eventType: 'news_published',
        eventCategory: 'news',
        productId,
        title: newsItem.title,
        eventDate: newsItem.publishedDate,
        eventData: {
          newsId,
          newsType: newsItem.newsType,
        },
        sourceUrl: newsItem.newsUrl,
        sourceType: 'ema_news_json',
        confidence: 'high',
        extractorVersion: 'v1.0.0',
      }))

      await db.insert(timelineEvents).values(events)
    }
  }
}

// ============================================================================
// 9. CHECK SOURCE FOR UPDATES
// Incremental crawling with change detection
// ============================================================================
async function shouldCrawlSource(sourceUrl: string, currentEtag: string | null): Promise<boolean> {
  const source = await db.query.emaSources.findFirst({
    where: eq(emaSources.sourceUrl, sourceUrl),
  })

  if (!source) {
    // First crawl
    return true
  }

  if (source.etag !== currentEtag) {
    // ETag changed
    return true
  }

  // Check if last successful crawl was more than 24 hours ago
  if (source.lastSuccessAt) {
    const daysSinceSuccess = (Date.now() - source.lastSuccessAt.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceSuccess > 1
  }

  return true
}

// ============================================================================
// 10. UPDATE CRAWL SOURCE
// Record crawl result
// ============================================================================
async function updateCrawlSource(params: {
  sourceUrl: string
  sourceType: string
  etag?: string
  lastModified?: string
  contentHash?: string
  httpStatus: number
  itemCount?: number
  error?: string
}) {
  const { sourceUrl, sourceType, etag, lastModified, contentHash, httpStatus, itemCount, error } = params

  const isSuccess = httpStatus >= 200 && httpStatus < 300

  await db
    .insert(emaSources)
    .values({
      sourceType,
      sourceUrl,
      etag,
      lastModified,
      contentHash,
      lastCrawledAt: new Date(),
      lastSuccessAt: isSuccess ? new Date() : undefined,
      httpStatus,
      crawlError: error,
      itemCount,
    })
    .onConflictDoUpdate({
      target: emaSources.sourceUrl,
      set: {
        etag,
        lastModified,
        contentHash,
        lastCrawledAt: new Date(),
        lastSuccessAt: isSuccess ? new Date() : sql`${emaSources.lastSuccessAt}`, // Keep old success date if failed
        httpStatus,
        crawlError: error,
        itemCount,
        updatedAt: new Date(),
      },
    })
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseEMADate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  // EMA dates are in DD/MM/YYYY format
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  return new Date(`${year}-${month}-${day}`)
}

// ============================================================================
// EXPORT EXAMPLES
// ============================================================================

export {
  upsertProductFromEMA,
  createTimelineEvent,
  getProductTimeline,
  detectAndCreateEvents,
  getProductsWithRelationships,
  findProductsByTherapeuticArea,
  getActiveShortages,
  linkNewsToProducts,
  shouldCrawlSource,
  updateCrawlSource,
}
