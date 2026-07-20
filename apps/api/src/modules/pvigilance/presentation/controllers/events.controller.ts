import { Controller, Get, Param, Query, Inject, NotFoundException } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger'
import {
  pvigilanceEvents,
  pvigilanceEventProducts,
  pvigilanceEventSubstances,
  medicinalProducts,
  substances,
} from '@workspace/database'
import { eq, desc, and, or, ilike, gte, lte, inArray, count, sql } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

/**
 * Pharmacovigilance Events API
 *
 * Public API for querying pharmacovigilance events from multiple regulatory authorities.
 */
@ApiTags('Pharmacovigilance Events')
@Controller('pvigilance/events')
export class PvigilanceEventsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({
    summary: 'List pharmacovigilance events',
    description: 'Query events from FDA, MHRA, Swissmedic, BfArM, EMA with filtering',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'substance', required: false, type: String, description: 'Filter by INN (substance name)' })
  @ApiQuery({ name: 'productSlug', required: false, type: String, description: 'Filter by product slug' })
  @ApiQuery({ name: 'authority', required: false, type: String, description: 'Filter by source authority (FDA,EMA,MHRA)' })
  @ApiQuery({ name: 'region', required: false, type: String, description: 'Filter by region (US,EU,UK,DE,CH)' })
  @ApiQuery({ name: 'eventType', required: false, type: String, description: 'Filter by event type (recall,dhpc,safety_alert)' })
  @ApiQuery({ name: 'severity', required: false, type: String, description: 'Filter by severity (critical,high,medium,low)' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in title and description' })
  @ApiResponse({ status: 200, description: 'Paginated list of pharmacovigilance events' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('substance') substance?: string,
    @Query('productSlug') productSlug?: string,
    @Query('authority') authority?: string,
    @Query('region') region?: string,
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit)
    const effectiveLimit = Math.min(100, limit)

    // Build conditions
    const conditions = []

    // Filter by authority
    if (authority) {
      const authorities = authority.split(',').map(a => a.trim().toUpperCase())
      conditions.push(inArray(pvigilanceEvents.sourceAuthority, authorities))
    }

    // Filter by region
    if (region) {
      const regions = region.split(',').map(r => r.trim().toUpperCase())
      conditions.push(inArray(pvigilanceEvents.region, regions))
    }

    // Filter by event type
    if (eventType) {
      const types = eventType.split(',').map(t => t.trim().toLowerCase())
      conditions.push(inArray(pvigilanceEvents.eventType, types))
    }

    // Filter by severity
    if (severity) {
      const severities = severity.split(',').map(s => s.trim().toLowerCase())
      conditions.push(inArray(pvigilanceEvents.severity, severities))
    }

    // Filter by date range
    if (dateFrom) {
      conditions.push(gte(pvigilanceEvents.eventDate, dateFrom))
    }
    if (dateTo) {
      conditions.push(lte(pvigilanceEvents.eventDate, dateTo))
    }

    // Search in title and description
    if (search) {
      conditions.push(
        or(
          ilike(pvigilanceEvents.title, `%${search}%`),
          ilike(pvigilanceEvents.description, `%${search}%`),
        ),
      )
    }

    // Filter by substance (via junction table)
    let eventIdsFromSubstance: number[] | null = null
    if (substance) {
      const substanceEvents = await this.db
        .select({ eventId: pvigilanceEventSubstances.eventId })
        .from(pvigilanceEventSubstances)
        .where(ilike(pvigilanceEventSubstances.inn, `%${substance}%`))

      eventIdsFromSubstance = substanceEvents.map(e => e.eventId)
      if (eventIdsFromSubstance.length === 0) {
        // No matching events for this substance
        return {
          data: [],
          meta: { page: 1, limit: effectiveLimit, total: 0, totalPages: 0 },
        }
      }
      conditions.push(inArray(pvigilanceEvents.id, eventIdsFromSubstance))
    }

    // Filter by product (via junction table)
    if (productSlug) {
      const [product] = await this.db
        .select({ id: medicinalProducts.id })
        .from(medicinalProducts)
        .where(eq(medicinalProducts.slug, productSlug))
        .limit(1)

      if (!product) {
        return {
          data: [],
          meta: { page: 1, limit: effectiveLimit, total: 0, totalPages: 0 },
        }
      }

      const productEvents = await this.db
        .select({ eventId: pvigilanceEventProducts.eventId })
        .from(pvigilanceEventProducts)
        .where(eq(pvigilanceEventProducts.productId, product.id))

      const eventIds = productEvents.map(e => e.eventId)
      if (eventIds.length === 0) {
        return {
          data: [],
          meta: { page: 1, limit: effectiveLimit, total: 0, totalPages: 0 },
        }
      }
      conditions.push(inArray(pvigilanceEvents.id, eventIds))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Execute queries
    const [items, [countResult]] = await Promise.all([
      this.db
        .select({
          id: pvigilanceEvents.id,
          slug: pvigilanceEvents.slug,
          sourceAuthority: pvigilanceEvents.sourceAuthority,
          region: pvigilanceEvents.region,
          eventType: pvigilanceEvents.eventType,
          eventCategory: pvigilanceEvents.eventCategory,
          severity: pvigilanceEvents.severity,
          title: pvigilanceEvents.title,
          description: pvigilanceEvents.description,
          eventDate: pvigilanceEvents.eventDate,
          sourceUrl: pvigilanceEvents.sourceUrl,
          createdAt: pvigilanceEvents.createdAt,
        })
        .from(pvigilanceEvents)
        .where(whereClause)
        .orderBy(desc(pvigilanceEvents.eventDate))
        .limit(effectiveLimit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(pvigilanceEvents)
        .where(whereClause),
    ])

    // Get linked substances for each event
    const eventIds = items.map(i => i.id)
    const linkedSubstances = eventIds.length > 0
      ? await this.db
          .select({
            eventId: pvigilanceEventSubstances.eventId,
            inn: pvigilanceEventSubstances.inn,
            substanceSlug: substances.slug,
          })
          .from(pvigilanceEventSubstances)
          .leftJoin(substances, eq(pvigilanceEventSubstances.substanceId, substances.id))
          .where(inArray(pvigilanceEventSubstances.eventId, eventIds))
      : []

    // Get linked products for each event
    const linkedProducts = eventIds.length > 0
      ? await this.db
          .select({
            eventId: pvigilanceEventProducts.eventId,
            productName: medicinalProducts.name,
            productSlug: medicinalProducts.slug,
          })
          .from(pvigilanceEventProducts)
          .innerJoin(medicinalProducts, eq(pvigilanceEventProducts.productId, medicinalProducts.id))
          .where(inArray(pvigilanceEventProducts.eventId, eventIds))
      : []

    // Build response with linked entities
    const data = items.map(item => ({
      ...item,
      linkedSubstances: linkedSubstances
        .filter(s => s.eventId === item.id)
        .map(s => ({ inn: s.inn, slug: s.substanceSlug })),
      linkedProducts: linkedProducts
        .filter(p => p.eventId === item.id)
        .map(p => ({ name: p.productName, slug: p.productSlug })),
    }))

    // Get authority counts for meta
    const authorityCounts = await this.db
      .select({
        authority: pvigilanceEvents.sourceAuthority,
        count: count(),
      })
      .from(pvigilanceEvents)
      .where(whereClause)
      .groupBy(pvigilanceEvents.sourceAuthority)

    return {
      data,
      meta: {
        page: Math.max(1, page),
        limit: effectiveLimit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / effectiveLimit),
        authorities: authorityCounts.reduce(
          (acc, { authority, count }) => ({ ...acc, [authority]: count }),
          {} as Record<string, number>,
        ),
      },
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get pharmacovigilance event statistics' })
  @ApiResponse({ status: 200, description: 'Event statistics by authority, type, severity' })
  async getStats() {
    const [totalResult] = await this.db.select({ count: count() }).from(pvigilanceEvents)

    const [byAuthority, byType, bySeverity, byRegion, byCategory] = await Promise.all([
      this.db
        .select({ key: pvigilanceEvents.sourceAuthority, count: count() })
        .from(pvigilanceEvents)
        .groupBy(pvigilanceEvents.sourceAuthority),
      this.db
        .select({ key: pvigilanceEvents.eventType, count: count() })
        .from(pvigilanceEvents)
        .groupBy(pvigilanceEvents.eventType),
      this.db
        .select({ key: pvigilanceEvents.severity, count: count() })
        .from(pvigilanceEvents)
        .groupBy(pvigilanceEvents.severity),
      this.db
        .select({ key: pvigilanceEvents.region, count: count() })
        .from(pvigilanceEvents)
        .groupBy(pvigilanceEvents.region),
      this.db
        .select({ key: pvigilanceEvents.eventCategory, count: count() })
        .from(pvigilanceEvents)
        .groupBy(pvigilanceEvents.eventCategory),
    ])

    const toObject = (arr: Array<{ key: string; count: number }>) =>
      arr.reduce((acc, { key, count }) => ({ ...acc, [key]: count }), {} as Record<string, number>)

    return {
      total: totalResult?.count ?? 0,
      byAuthority: toObject(byAuthority),
      byType: toObject(byType),
      bySeverity: toObject(bySeverity),
      byRegion: toObject(byRegion),
      byCategory: toObject(byCategory),
    }
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get pharmacovigilance event by slug' })
  @ApiParam({ name: 'slug', description: 'Event slug (e.g., "fda-20240315-voluntary-recall")' })
  @ApiResponse({ status: 200, description: 'Event details with linked entities' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('slug') slug: string) {
    const [event] = await this.db
      .select()
      .from(pvigilanceEvents)
      .where(eq(pvigilanceEvents.slug, slug))
      .limit(1)

    if (!event) {
      throw new NotFoundException(`Event with slug "${slug}" not found`)
    }

    // Get linked substances
    const linkedSubstances = await this.db
      .select({
        id: pvigilanceEventSubstances.id,
        inn: pvigilanceEventSubstances.inn,
        matchType: pvigilanceEventSubstances.matchType,
        matchConfidence: pvigilanceEventSubstances.matchConfidence,
        substance: {
          id: substances.id,
          slug: substances.slug,
          innName: substances.innName,
        },
      })
      .from(pvigilanceEventSubstances)
      .leftJoin(substances, eq(pvigilanceEventSubstances.substanceId, substances.id))
      .where(eq(pvigilanceEventSubstances.eventId, event.id))

    // Get linked products
    const linkedProducts = await this.db
      .select({
        id: pvigilanceEventProducts.id,
        matchType: pvigilanceEventProducts.matchType,
        matchConfidence: pvigilanceEventProducts.matchConfidence,
        product: {
          id: medicinalProducts.id,
          slug: medicinalProducts.slug,
          name: medicinalProducts.name,
        },
      })
      .from(pvigilanceEventProducts)
      .innerJoin(medicinalProducts, eq(pvigilanceEventProducts.productId, medicinalProducts.id))
      .where(eq(pvigilanceEventProducts.eventId, event.id))

    return {
      ...event,
      linkedSubstances,
      linkedProducts,
    }
  }
}

/**
 * Product Events API - Events linked to specific products
 */
@ApiTags('Product Pharmacovigilance')
@Controller('products/:slug/pvigilance')
export class ProductPvigilanceController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('events')
  @ApiOperation({ summary: 'Get pharmacovigilance events for a product' })
  @ApiParam({ name: 'slug', description: 'Product slug' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Events linked to this product' })
  async getProductEvents(
    @Param('slug') slug: string,
    @Query('limit') limit = 50,
  ) {
    const [product] = await this.db
      .select({ id: medicinalProducts.id, name: medicinalProducts.name })
      .from(medicinalProducts)
      .where(eq(medicinalProducts.slug, slug))
      .limit(1)

    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`)
    }

    const events = await this.db
      .select({
        event: pvigilanceEvents,
        matchConfidence: pvigilanceEventProducts.matchConfidence,
        matchType: pvigilanceEventProducts.matchType,
      })
      .from(pvigilanceEvents)
      .innerJoin(
        pvigilanceEventProducts,
        eq(pvigilanceEvents.id, pvigilanceEventProducts.eventId),
      )
      .where(eq(pvigilanceEventProducts.productId, product.id))
      .orderBy(desc(pvigilanceEvents.eventDate))
      .limit(Math.min(100, limit))

    return {
      product: { slug, name: product.name },
      events: events.map(e => ({
        ...e.event,
        matchConfidence: e.matchConfidence,
        matchType: e.matchType,
      })),
    }
  }
}

/**
 * Substance Events API - Events linked to specific substances (INN)
 */
@ApiTags('Substance Pharmacovigilance')
@Controller('substances/:slug/pvigilance')
export class SubstancePvigilanceController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('events')
  @ApiOperation({ summary: 'Get pharmacovigilance events for a substance (INN)' })
  @ApiParam({ name: 'slug', description: 'Substance slug' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Events linked to this substance' })
  async getSubstanceEvents(
    @Param('slug') slug: string,
    @Query('limit') limit = 50,
  ) {
    const [substance] = await this.db
      .select({ id: substances.id, innName: substances.innName })
      .from(substances)
      .where(eq(substances.slug, slug))
      .limit(1)

    if (!substance) {
      throw new NotFoundException(`Substance with slug "${slug}" not found`)
    }

    const events = await this.db
      .select({
        event: pvigilanceEvents,
        matchConfidence: pvigilanceEventSubstances.matchConfidence,
        matchType: pvigilanceEventSubstances.matchType,
      })
      .from(pvigilanceEvents)
      .innerJoin(
        pvigilanceEventSubstances,
        eq(pvigilanceEvents.id, pvigilanceEventSubstances.eventId),
      )
      .where(eq(pvigilanceEventSubstances.substanceId, substance.id))
      .orderBy(desc(pvigilanceEvents.eventDate))
      .limit(Math.min(100, limit))

    return {
      substance: { slug, inn: substance.innName },
      events: events.map(e => ({
        ...e.event,
        matchConfidence: e.matchConfidence,
        matchType: e.matchType,
      })),
    }
  }
}
