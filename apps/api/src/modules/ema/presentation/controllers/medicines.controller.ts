import { Controller, Get, Param, Query, Inject, NotFoundException, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiSecurity } from '@nestjs/swagger'
import {
  medicinalProductsExtended,
  substances,
  companies,
  productSubstances,
  productCompanies,
  timelineEvents,
  importLogs,
  emaSources,
} from '@workspace/database'
import { eq, desc, ilike, or, count, and, gte, lte, sql } from 'drizzle-orm'

import { ApiKeyGuard } from '@/app/guards/api-key.guard'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

/**
 * Frontend API: Medicines (using extended schema)
 */
@ApiTags('Medicines')
@Controller('medicines')
export class MedicinesController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({ summary: 'List all medicines with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or EMA number' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status (Authorised, Withdrawn, etc.)' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category (Human, Veterinary)' })
  @ApiQuery({ name: 'orphan', required: false, type: Boolean, description: 'Filter orphan medicines only' })
  @ApiQuery({ name: 'atcCode', required: false, type: String, description: 'Filter by ATC code prefix' })
  @ApiResponse({ status: 200, description: 'Paginated list of medicines' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('orphan') orphan?: string,
    @Query('atcCode') atcCode?: string,
  ) {
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit)
    const effectiveLimit = Math.min(100, limit)

    const conditions = []
    if (search) {
      conditions.push(
        or(
          ilike(medicinalProductsExtended.name, `%${search}%`),
          ilike(medicinalProductsExtended.emaNumber, `%${search}%`),
          ilike(medicinalProductsExtended.activeSubstance, `%${search}%`),
        ),
      )
    }
    if (status) {
      conditions.push(eq(medicinalProductsExtended.medicineStatus, status))
    }
    if (category) {
      conditions.push(eq(medicinalProductsExtended.category, category))
    }
    if (orphan === 'true') {
      conditions.push(eq(medicinalProductsExtended.orphanMedicine, true))
    }
    if (atcCode) {
      conditions.push(ilike(medicinalProductsExtended.atcCode, `${atcCode}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [items, [countResult]] = await Promise.all([
      this.db
        .select({
          id: medicinalProductsExtended.id,
          slug: medicinalProductsExtended.slug,
          name: medicinalProductsExtended.name,
          emaNumber: medicinalProductsExtended.emaNumber,
          category: medicinalProductsExtended.category,
          medicineStatus: medicinalProductsExtended.medicineStatus,
          activeSubstance: medicinalProductsExtended.activeSubstance,
          atcCode: medicinalProductsExtended.atcCode,
          orphanMedicine: medicinalProductsExtended.orphanMedicine,
          marketingAuthorisationDate: medicinalProductsExtended.marketingAuthorisationDate,
          lastUpdatedDate: medicinalProductsExtended.lastUpdatedDate,
          medicineUrl: medicinalProductsExtended.medicineUrl,
        })
        .from(medicinalProductsExtended)
        .where(whereClause)
        .orderBy(desc(medicinalProductsExtended.lastUpdatedDate))
        .limit(effectiveLimit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(medicinalProductsExtended)
        .where(whereClause),
    ])

    return {
      data: items,
      meta: {
        page: Math.max(1, page),
        limit: effectiveLimit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / effectiveLimit),
      },
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get medicines statistics' })
  @ApiResponse({ status: 200, description: 'Statistics about medicines in database' })
  async getStats() {
    const [totalResult] = await this.db.select({ count: count() }).from(medicinalProductsExtended)

    const statusCounts = await this.db
      .select({
        status: medicinalProductsExtended.medicineStatus,
        count: count(),
      })
      .from(medicinalProductsExtended)
      .groupBy(medicinalProductsExtended.medicineStatus)

    const categoryCounts = await this.db
      .select({
        category: medicinalProductsExtended.category,
        count: count(),
      })
      .from(medicinalProductsExtended)
      .groupBy(medicinalProductsExtended.category)

    const orphanCount = await this.db
      .select({ count: count() })
      .from(medicinalProductsExtended)
      .where(eq(medicinalProductsExtended.orphanMedicine, true))

    return {
      total: totalResult?.count ?? 0,
      byStatus: statusCounts.reduce((acc, { status, count }) => ({ ...acc, [status]: count }), {}),
      byCategory: categoryCounts.reduce((acc, { category, count }) => ({ ...acc, [category]: count }), {}),
      orphanMedicines: orphanCount[0]?.count ?? 0,
    }
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get medicine details by slug' })
  @ApiParam({ name: 'slug', description: 'Medicine slug (e.g., "ronapreve")' })
  @ApiResponse({ status: 200, description: 'Full medicine details with related data' })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  async findOne(@Param('slug') slug: string) {
    const [medicine] = await this.db
      .select()
      .from(medicinalProductsExtended)
      .where(eq(medicinalProductsExtended.slug, slug))
      .limit(1)

    if (!medicine) {
      throw new NotFoundException(`Medicine with slug "${slug}" not found`)
    }

    // Get related substances
    const relatedSubstances = await this.db
      .select({
        id: substances.id,
        slug: substances.slug,
        innName: substances.innName,
      })
      .from(substances)
      .innerJoin(productSubstances, eq(substances.id, productSubstances.substanceId))
      .where(eq(productSubstances.productId, medicine.id))

    // Get related companies
    const relatedCompanies = await this.db
      .select({
        id: companies.id,
        slug: companies.slug,
        name: companies.name,
        role: productCompanies.role,
      })
      .from(companies)
      .innerJoin(productCompanies, eq(companies.id, productCompanies.companyId))
      .where(eq(productCompanies.productId, medicine.id))

    // Get timeline events
    const events = await this.db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.productId, medicine.id))
      .orderBy(desc(timelineEvents.eventDate))
      .limit(50)

    return {
      ...medicine,
      substances: relatedSubstances,
      companies: relatedCompanies,
      timeline: events,
    }
  }

  @Get(':slug/timeline')
  @ApiOperation({ summary: 'Get timeline events for a medicine' })
  @ApiParam({ name: 'slug', description: 'Medicine slug' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Timeline events for the medicine' })
  async getTimeline(
    @Param('slug') slug: string,
    @Query('limit') limit = 100,
  ) {
    const [medicine] = await this.db
      .select({ id: medicinalProductsExtended.id })
      .from(medicinalProductsExtended)
      .where(eq(medicinalProductsExtended.slug, slug))
      .limit(1)

    if (!medicine) {
      throw new NotFoundException(`Medicine with slug "${slug}" not found`)
    }

    const events = await this.db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.productId, medicine.id))
      .orderBy(desc(timelineEvents.eventDate))
      .limit(Math.min(500, limit))

    return { data: events }
  }
}

/**
 * Frontend API: Timeline Events
 */
@ApiTags('Timeline Events')
@Controller('events')
export class TimelineEventsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({ summary: 'List timeline events with filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'eventType', required: false, type: String, description: 'Filter by event type (authorised, withdrawn, status_changed)' })
  @ApiQuery({ name: 'eventCategory', required: false, type: String, description: 'Filter by category (regulatory, safety, etc.)' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Paginated timeline events' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('eventType') eventType?: string,
    @Query('eventCategory') eventCategory?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit)
    const effectiveLimit = Math.min(100, limit)

    const conditions = []
    if (eventType) {
      conditions.push(eq(timelineEvents.eventType, eventType))
    }
    if (eventCategory) {
      conditions.push(eq(timelineEvents.eventCategory, eventCategory))
    }
    if (from) {
      conditions.push(gte(timelineEvents.eventDate, from))
    }
    if (to) {
      conditions.push(lte(timelineEvents.eventDate, to))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [items, [countResult]] = await Promise.all([
      this.db
        .select({
          id: timelineEvents.id,
          eventType: timelineEvents.eventType,
          eventCategory: timelineEvents.eventCategory,
          productId: timelineEvents.productId,
          title: timelineEvents.title,
          description: timelineEvents.description,
          eventDate: timelineEvents.eventDate,
          eventData: timelineEvents.eventData,
          sourceUrl: timelineEvents.sourceUrl,
          confidence: timelineEvents.confidence,
          createdAt: timelineEvents.createdAt,
        })
        .from(timelineEvents)
        .where(whereClause)
        .orderBy(desc(timelineEvents.eventDate))
        .limit(effectiveLimit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(timelineEvents)
        .where(whereClause),
    ])

    return {
      data: items,
      meta: {
        page: Math.max(1, page),
        limit: effectiveLimit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / effectiveLimit),
      },
    }
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get most recent events across all medicines' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of events (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Recent timeline events with medicine info' })
  async getRecent(@Query('limit') limit = 20) {
    const events = await this.db
      .select({
        id: timelineEvents.id,
        eventType: timelineEvents.eventType,
        eventCategory: timelineEvents.eventCategory,
        title: timelineEvents.title,
        eventDate: timelineEvents.eventDate,
        eventData: timelineEvents.eventData,
        sourceUrl: timelineEvents.sourceUrl,
        medicine: {
          id: medicinalProductsExtended.id,
          slug: medicinalProductsExtended.slug,
          name: medicinalProductsExtended.name,
        },
      })
      .from(timelineEvents)
      .leftJoin(medicinalProductsExtended, eq(timelineEvents.productId, medicinalProductsExtended.id))
      .orderBy(desc(timelineEvents.eventDate))
      .limit(Math.min(100, limit))

    return { data: events }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get event statistics' })
  @ApiResponse({ status: 200, description: 'Event type and category counts' })
  async getStats() {
    const [totalResult] = await this.db.select({ count: count() }).from(timelineEvents)

    const byType = await this.db
      .select({
        type: timelineEvents.eventType,
        count: count(),
      })
      .from(timelineEvents)
      .groupBy(timelineEvents.eventType)

    const byCategory = await this.db
      .select({
        category: timelineEvents.eventCategory,
        count: count(),
      })
      .from(timelineEvents)
      .groupBy(timelineEvents.eventCategory)

    return {
      total: totalResult?.count ?? 0,
      byType: byType.reduce((acc, { type, count }) => ({ ...acc, [type]: count }), {}),
      byCategory: byCategory.reduce((acc, { category, count }) => ({ ...acc, [category]: count }), {}),
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Event details' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    const [event] = await this.db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.id, parseInt(id, 10)))
      .limit(1)

    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`)
    }

    // Get related medicine
    let medicine = null
    if (event.productId) {
      const [med] = await this.db
        .select({
          id: medicinalProductsExtended.id,
          slug: medicinalProductsExtended.slug,
          name: medicinalProductsExtended.name,
          emaNumber: medicinalProductsExtended.emaNumber,
        })
        .from(medicinalProductsExtended)
        .where(eq(medicinalProductsExtended.id, event.productId))
        .limit(1)
      medicine = med
    }

    return { ...event, medicine }
  }
}

/**
 * Frontend API: Substances
 */
@ApiTags('Substances')
@Controller('substances')
export class SubstancesController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({ summary: 'List all substances' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of substances' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit)
    const effectiveLimit = Math.min(100, limit)

    const whereClause = search ? ilike(substances.innName, `%${search}%`) : undefined

    const [items, [countResult]] = await Promise.all([
      this.db
        .select()
        .from(substances)
        .where(whereClause)
        .orderBy(substances.innName)
        .limit(effectiveLimit)
        .offset(offset),
      this.db.select({ count: count() }).from(substances).where(whereClause),
    ])

    return {
      data: items,
      meta: {
        page: Math.max(1, page),
        limit: effectiveLimit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / effectiveLimit),
      },
    }
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get substance by slug with related medicines' })
  @ApiParam({ name: 'slug', description: 'Substance slug' })
  @ApiResponse({ status: 200, description: 'Substance details with medicines' })
  @ApiResponse({ status: 404, description: 'Substance not found' })
  async findOne(@Param('slug') slug: string) {
    const [substance] = await this.db
      .select()
      .from(substances)
      .where(eq(substances.slug, slug))
      .limit(1)

    if (!substance) {
      throw new NotFoundException(`Substance with slug "${slug}" not found`)
    }

    const medicines = await this.db
      .select({
        id: medicinalProductsExtended.id,
        slug: medicinalProductsExtended.slug,
        name: medicinalProductsExtended.name,
        medicineStatus: medicinalProductsExtended.medicineStatus,
        category: medicinalProductsExtended.category,
      })
      .from(medicinalProductsExtended)
      .innerJoin(productSubstances, eq(medicinalProductsExtended.id, productSubstances.productId))
      .where(eq(productSubstances.substanceId, substance.id))

    return { ...substance, medicines }
  }
}

/**
 * Frontend API: Companies
 */
@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({ summary: 'List all companies (Marketing Authorisation Holders)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of companies' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit)
    const effectiveLimit = Math.min(100, limit)

    const whereClause = search ? ilike(companies.name, `%${search}%`) : undefined

    const [items, [countResult]] = await Promise.all([
      this.db
        .select()
        .from(companies)
        .where(whereClause)
        .orderBy(companies.name)
        .limit(effectiveLimit)
        .offset(offset),
      this.db.select({ count: count() }).from(companies).where(whereClause),
    ])

    return {
      data: items,
      meta: {
        page: Math.max(1, page),
        limit: effectiveLimit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / effectiveLimit),
      },
    }
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get company by slug with their medicines' })
  @ApiParam({ name: 'slug', description: 'Company slug' })
  @ApiResponse({ status: 200, description: 'Company details with medicines' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findOne(@Param('slug') slug: string) {
    const [company] = await this.db
      .select()
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1)

    if (!company) {
      throw new NotFoundException(`Company with slug "${slug}" not found`)
    }

    const medicines = await this.db
      .select({
        id: medicinalProductsExtended.id,
        slug: medicinalProductsExtended.slug,
        name: medicinalProductsExtended.name,
        medicineStatus: medicinalProductsExtended.medicineStatus,
        category: medicinalProductsExtended.category,
        role: productCompanies.role,
      })
      .from(medicinalProductsExtended)
      .innerJoin(productCompanies, eq(medicinalProductsExtended.id, productCompanies.productId))
      .where(eq(productCompanies.companyId, company.id))

    return { ...company, medicines }
  }
}

/**
 * Admin API: Import Management
 */
@ApiTags('Admin - Import Logs')
@ApiSecurity('admin-api-key')
@UseGuards(ApiKeyGuard)
@Controller('admin/imports')
export class ImportLogsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({ summary: 'List all import logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status (running, completed, failed)' })
  @ApiResponse({ status: 200, description: 'Paginated import logs' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    const offset = (Math.max(1, page) - 1) * Math.min(100, limit)
    const effectiveLimit = Math.min(100, limit)

    const whereClause = status ? eq(importLogs.status, status) : undefined

    const [items, [countResult]] = await Promise.all([
      this.db
        .select()
        .from(importLogs)
        .where(whereClause)
        .orderBy(desc(importLogs.startedAt))
        .limit(effectiveLimit)
        .offset(offset),
      this.db.select({ count: count() }).from(importLogs).where(whereClause),
    ])

    return {
      data: items,
      meta: {
        page: Math.max(1, page),
        limit: effectiveLimit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / effectiveLimit),
      },
    }
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get the most recent import log' })
  @ApiResponse({ status: 200, description: 'Latest import log' })
  async getLatest() {
    const [latest] = await this.db
      .select()
      .from(importLogs)
      .orderBy(desc(importLogs.startedAt))
      .limit(1)

    return latest ?? null
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get import log by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Import log details' })
  @ApiResponse({ status: 404, description: 'Import log not found' })
  async findOne(@Param('id') id: string) {
    const [log] = await this.db
      .select()
      .from(importLogs)
      .where(eq(importLogs.id, parseInt(id, 10)))
      .limit(1)

    if (!log) {
      throw new NotFoundException(`Import log with ID "${id}" not found`)
    }

    return log
  }
}

/**
 * Admin API: Data Sources
 */
@ApiTags('Admin - Data Sources')
@ApiSecurity('admin-api-key')
@UseGuards(ApiKeyGuard)
@Controller('admin/sources')
export class EmaSourcesController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({ summary: 'List all EMA data sources' })
  @ApiResponse({ status: 200, description: 'List of data sources with crawl status' })
  async findAll() {
    const items = await this.db
      .select()
      .from(emaSources)
      .orderBy(desc(emaSources.lastCrawledAt))

    return { data: items }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get data source by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Data source details' })
  @ApiResponse({ status: 404, description: 'Source not found' })
  async findOne(@Param('id') id: string) {
    const [source] = await this.db
      .select()
      .from(emaSources)
      .where(eq(emaSources.id, parseInt(id, 10)))
      .limit(1)

    if (!source) {
      throw new NotFoundException(`Source with ID "${id}" not found`)
    }

    return source
  }
}
