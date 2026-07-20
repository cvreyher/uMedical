import { Controller, Get, Query, Inject } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger'
import {
  medicinalProductsExtended,
  substances,
  companies,
  productSubstances,
  productCompanies,
  timelineEvents,
  procedures,
  referrals,
  shortages,
  newsItems,
  productNews,
} from '@workspace/database'
import { eq, desc, count, and, gte, lte, sql, isNull, isNotNull, ne, asc } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

// ============================================================================
// PRODUCT STATISTICS
// ============================================================================

/**
 * Product Overview Statistics
 * - Total products by status, category, designation
 * - Trends over time
 * - Approval timeline analysis
 */
@ApiTags('Statistics - Products')
@Controller('statistics/products')
export class ProductStatisticsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('overview')
  @ApiOperation({ summary: 'Complete product overview statistics' })
  @ApiResponse({ status: 200, description: 'Product overview with status, category, and designation counts' })
  async getOverview() {
    const [
      [totalResult],
      statusCounts,
      categoryCounts,
      designationCounts,
    ] = await Promise.all([
      this.db.select({ count: count() }).from(medicinalProductsExtended),
      this.db
        .select({ status: medicinalProductsExtended.medicineStatus, count: count() })
        .from(medicinalProductsExtended)
        .groupBy(medicinalProductsExtended.medicineStatus),
      this.db
        .select({ category: medicinalProductsExtended.category, count: count() })
        .from(medicinalProductsExtended)
        .groupBy(medicinalProductsExtended.category),
      Promise.all([
        this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.orphanMedicine, true)),
        this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.biosimilar, true)),
        this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.advancedTherapy, true)),
        this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.additionalMonitoring, true)),
        this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.genericOrHybrid, true)),
        this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.conditionalApproval, true)),
        this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.exceptionalCircumstances, true)),
        this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.acceleratedAssessment, true)),
        this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.primePriorityMedicine, true)),
      ]),
    ])

    return {
      total: totalResult?.count ?? 0,
      byStatus: Object.fromEntries(statusCounts.map(({ status, count }) => [status, count])),
      byCategory: Object.fromEntries(categoryCounts.map(({ category, count }) => [category, count])),
      designations: {
        orphanMedicine: designationCounts[0][0]?.count ?? 0,
        biosimilar: designationCounts[1][0]?.count ?? 0,
        advancedTherapy: designationCounts[2][0]?.count ?? 0,
        additionalMonitoring: designationCounts[3][0]?.count ?? 0,
        genericOrHybrid: designationCounts[4][0]?.count ?? 0,
        conditionalApproval: designationCounts[5][0]?.count ?? 0,
        exceptionalCircumstances: designationCounts[6][0]?.count ?? 0,
        acceleratedAssessment: designationCounts[7][0]?.count ?? 0,
        primePriorityMedicine: designationCounts[8][0]?.count ?? 0,
      },
    }
  }

  @Get('by-status')
  @ApiOperation({ summary: 'Total products by authorization status' })
  @ApiResponse({ status: 200, description: 'Product counts grouped by status (Authorised, Withdrawn, etc.)' })
  async getByStatus() {
    const results = await this.db
      .select({
        status: medicinalProductsExtended.medicineStatus,
        count: count(),
      })
      .from(medicinalProductsExtended)
      .groupBy(medicinalProductsExtended.medicineStatus)
      .orderBy(desc(count()))

    const [totalResult] = await this.db.select({ count: count() }).from(medicinalProductsExtended)

    return {
      total: totalResult?.count ?? 0,
      breakdown: results,
      percentages: results.map(r => ({
        status: r.status,
        count: r.count,
        percentage: totalResult?.count ? ((r.count / totalResult.count) * 100).toFixed(2) : '0',
      })),
    }
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Products by category (Human vs Veterinary)' })
  @ApiResponse({ status: 200, description: 'Distribution between human and veterinary medicines' })
  async getByCategory() {
    const results = await this.db
      .select({
        category: medicinalProductsExtended.category,
        count: count(),
      })
      .from(medicinalProductsExtended)
      .groupBy(medicinalProductsExtended.category)

    // Also get status breakdown per category
    const categoryStatus = await this.db
      .select({
        category: medicinalProductsExtended.category,
        status: medicinalProductsExtended.medicineStatus,
        count: count(),
      })
      .from(medicinalProductsExtended)
      .groupBy(medicinalProductsExtended.category, medicinalProductsExtended.medicineStatus)

    return {
      totals: Object.fromEntries(results.map(({ category, count }) => [category, count])),
      breakdown: categoryStatus,
    }
  }

  @Get('designations')
  @ApiOperation({ summary: 'Products by special designations' })
  @ApiResponse({ status: 200, description: 'Counts for orphan, biosimilar, advanced therapy, etc.' })
  async getDesignations() {
    const [
      orphan,
      biosimilar,
      advancedTherapy,
      additionalMonitoring,
      genericOrHybrid,
      conditionalApproval,
      exceptionalCircumstances,
      acceleratedAssessment,
      primePriority,
      patientSafety,
    ] = await Promise.all([
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.orphanMedicine, true)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.biosimilar, true)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.advancedTherapy, true)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.additionalMonitoring, true)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.genericOrHybrid, true)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.conditionalApproval, true)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.exceptionalCircumstances, true)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.acceleratedAssessment, true)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.primePriorityMedicine, true)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(eq(medicinalProductsExtended.patientSafety, true)),
    ])

    return {
      orphanMedicine: orphan[0]?.count ?? 0,
      biosimilar: biosimilar[0]?.count ?? 0,
      advancedTherapy: advancedTherapy[0]?.count ?? 0,
      additionalMonitoring: additionalMonitoring[0]?.count ?? 0,
      genericOrHybrid: genericOrHybrid[0]?.count ?? 0,
      conditionalApproval: conditionalApproval[0]?.count ?? 0,
      exceptionalCircumstances: exceptionalCircumstances[0]?.count ?? 0,
      acceleratedAssessment: acceleratedAssessment[0]?.count ?? 0,
      primePriorityMedicine: primePriority[0]?.count ?? 0,
      patientSafety: patientSafety[0]?.count ?? 0,
    }
  }

  @Get('approvals-per-year')
  @ApiOperation({ summary: 'Products authorized per year' })
  @ApiQuery({ name: 'startYear', required: false, type: Number, description: 'Start year filter (default: 1995)' })
  @ApiQuery({ name: 'endYear', required: false, type: Number, description: 'End year filter (default: current year)' })
  @ApiResponse({ status: 200, description: 'Authorization counts by year' })
  async getApprovalsPerYear(
    @Query('startYear') startYear = 1995,
    @Query('endYear') endYear?: number,
  ) {
    const currentYear = new Date().getFullYear()
    const effectiveEndYear = endYear ?? currentYear

    const results = await this.db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${medicinalProductsExtended.marketingAuthorisationDate})`.as('year'),
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.marketingAuthorisationDate),
          gte(medicinalProductsExtended.marketingAuthorisationDate, `${startYear}-01-01`),
          lte(medicinalProductsExtended.marketingAuthorisationDate, `${effectiveEndYear}-12-31`),
        ),
      )
      .groupBy(sql`EXTRACT(YEAR FROM ${medicinalProductsExtended.marketingAuthorisationDate})`)
      .orderBy(asc(sql`EXTRACT(YEAR FROM ${medicinalProductsExtended.marketingAuthorisationDate})`))

    return {
      period: { startYear, endYear: effectiveEndYear },
      data: results,
      total: results.reduce((sum, r) => sum + r.count, 0),
    }
  }

  @Get('approvals-per-month')
  @ApiOperation({ summary: 'Products authorized per month (last 24 months)' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of months to show (default: 24)' })
  @ApiResponse({ status: 200, description: 'Authorization counts by month' })
  async getApprovalsPerMonth(@Query('months') months = 24) {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - Math.min(120, months))
    const startDateStr = startDate.toISOString().slice(0, 10)

    const results = await this.db
      .select({
        yearMonth: sql<string>`TO_CHAR(${medicinalProductsExtended.marketingAuthorisationDate}, 'YYYY-MM')`.as('year_month'),
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.marketingAuthorisationDate),
          gte(medicinalProductsExtended.marketingAuthorisationDate, startDateStr),
        ),
      )
      .groupBy(sql`TO_CHAR(${medicinalProductsExtended.marketingAuthorisationDate}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${medicinalProductsExtended.marketingAuthorisationDate}, 'YYYY-MM')`))

    return { data: results }
  }

  @Get('withdrawals-per-year')
  @ApiOperation({ summary: 'Product withdrawals per year' })
  @ApiResponse({ status: 200, description: 'Withdrawal counts by year' })
  async getWithdrawalsPerYear() {
    const results = await this.db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${medicinalProductsExtended.withdrawalExpiryRevocationLapseDate})`.as('year'),
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.withdrawalExpiryRevocationLapseDate),
          eq(medicinalProductsExtended.medicineStatus, 'Withdrawn'),
        ),
      )
      .groupBy(sql`EXTRACT(YEAR FROM ${medicinalProductsExtended.withdrawalExpiryRevocationLapseDate})`)
      .orderBy(asc(sql`EXTRACT(YEAR FROM ${medicinalProductsExtended.withdrawalExpiryRevocationLapseDate})`))

    return { data: results }
  }

  @Get('withdrawal-rate')
  @ApiOperation({ summary: 'Withdrawal rate analysis over time' })
  @ApiResponse({ status: 200, description: 'Authorization vs withdrawal trends' })
  async getWithdrawalRate() {
    const [authorized, withdrawn] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(medicinalProductsExtended)
        .where(eq(medicinalProductsExtended.medicineStatus, 'Authorised')),
      this.db
        .select({ count: count() })
        .from(medicinalProductsExtended)
        .where(eq(medicinalProductsExtended.medicineStatus, 'Withdrawn')),
    ])

    const total = (authorized[0]?.count ?? 0) + (withdrawn[0]?.count ?? 0)

    return {
      authorized: authorized[0]?.count ?? 0,
      withdrawn: withdrawn[0]?.count ?? 0,
      total,
      withdrawalRate: total > 0 ? (((withdrawn[0]?.count ?? 0) / total) * 100).toFixed(2) : '0',
    }
  }

  @Get('lifecycle')
  @ApiOperation({ summary: 'Product lifecycle metrics' })
  @ApiResponse({ status: 200, description: 'Average age, oldest products, etc.' })
  async getLifecycleMetrics() {
    // Average product age
    const avgAge = await this.db
      .select({
        avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (CURRENT_DATE - ${medicinalProductsExtended.marketingAuthorisationDate})) / 86400)`.as('avg_days'),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.marketingAuthorisationDate),
          eq(medicinalProductsExtended.medicineStatus, 'Authorised'),
        ),
      )

    // Products by age group
    const ageGroups = await this.db
      .select({
        ageGroup: sql<string>`
          CASE
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${medicinalProductsExtended.marketingAuthorisationDate})) < 5 THEN '0-5 years'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${medicinalProductsExtended.marketingAuthorisationDate})) < 10 THEN '5-10 years'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${medicinalProductsExtended.marketingAuthorisationDate})) < 15 THEN '10-15 years'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${medicinalProductsExtended.marketingAuthorisationDate})) < 20 THEN '15-20 years'
            ELSE '20+ years'
          END
        `.as('age_group'),
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.marketingAuthorisationDate),
          eq(medicinalProductsExtended.medicineStatus, 'Authorised'),
        ),
      )
      .groupBy(sql`
        CASE
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${medicinalProductsExtended.marketingAuthorisationDate})) < 5 THEN '0-5 years'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${medicinalProductsExtended.marketingAuthorisationDate})) < 10 THEN '5-10 years'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${medicinalProductsExtended.marketingAuthorisationDate})) < 15 THEN '10-15 years'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, ${medicinalProductsExtended.marketingAuthorisationDate})) < 20 THEN '15-20 years'
          ELSE '20+ years'
        END
      `)

    // Oldest authorized products
    const oldest = await this.db
      .select({
        name: medicinalProductsExtended.name,
        slug: medicinalProductsExtended.slug,
        authorisationDate: medicinalProductsExtended.marketingAuthorisationDate,
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.marketingAuthorisationDate),
          eq(medicinalProductsExtended.medicineStatus, 'Authorised'),
        ),
      )
      .orderBy(asc(medicinalProductsExtended.marketingAuthorisationDate))
      .limit(10)

    return {
      averageAgeDays: Math.round(avgAge[0]?.avgDays ?? 0),
      averageAgeYears: ((avgAge[0]?.avgDays ?? 0) / 365).toFixed(1),
      byAgeGroup: ageGroups,
      oldestProducts: oldest,
    }
  }

  @Get('opinion-to-authorization')
  @ApiOperation({ summary: 'Average time from opinion to authorization' })
  @ApiResponse({ status: 200, description: 'Analysis of approval timeline durations' })
  async getOpinionToAuthorization() {
    const results = await this.db
      .select({
        avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (${medicinalProductsExtended.marketingAuthorisationDate}::timestamp - ${medicinalProductsExtended.opinionAdoptedDate}::timestamp)) / 86400)`.as('avg_days'),
        minDays: sql<number>`MIN(EXTRACT(EPOCH FROM (${medicinalProductsExtended.marketingAuthorisationDate}::timestamp - ${medicinalProductsExtended.opinionAdoptedDate}::timestamp)) / 86400)`.as('min_days'),
        maxDays: sql<number>`MAX(EXTRACT(EPOCH FROM (${medicinalProductsExtended.marketingAuthorisationDate}::timestamp - ${medicinalProductsExtended.opinionAdoptedDate}::timestamp)) / 86400)`.as('max_days'),
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.opinionAdoptedDate),
          isNotNull(medicinalProductsExtended.marketingAuthorisationDate),
        ),
      )

    return {
      averageDays: Math.round(results[0]?.avgDays ?? 0),
      minDays: Math.round(results[0]?.minDays ?? 0),
      maxDays: Math.round(results[0]?.maxDays ?? 0),
      productsWithBothDates: results[0]?.count ?? 0,
    }
  }
}

// ============================================================================
// THERAPEUTIC AREA STATISTICS
// ============================================================================

/**
 * Therapeutic Area Statistics
 * - ATC code distribution
 * - Therapeutic indications analysis
 * - MeSH term analysis
 */
@ApiTags('Statistics - Therapeutic Areas')
@Controller('statistics/therapeutic')
export class TherapeuticStatisticsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('atc-distribution')
  @ApiOperation({ summary: 'ATC code distribution' })
  @ApiQuery({ name: 'level', required: false, type: Number, description: 'ATC level (1-5, default: 1 = anatomical main group)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit results (default: 50)' })
  @ApiResponse({ status: 200, description: 'Products grouped by ATC code' })
  async getAtcDistribution(
    @Query('level') level = 1,
    @Query('limit') limit = 50,
  ) {
    // ATC levels: 1=1char, 2=3chars, 3=4chars, 4=5chars, 5=7chars
    const levelLengths: Record<number, number> = { 1: 1, 2: 3, 3: 4, 4: 5, 5: 7 }
    const charCount = levelLengths[Math.min(5, Math.max(1, level))] ?? 1

    // Use sql.raw() for the integer to avoid parameterization issues with LEFT()
    const results = await this.db
      .select({
        atcCode: sql<string>`LEFT(${medicinalProductsExtended.atcCode}, ${sql.raw(String(charCount))})`.as('atc_prefix'),
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(isNotNull(medicinalProductsExtended.atcCode))
      .groupBy(sql`LEFT(${medicinalProductsExtended.atcCode}, ${sql.raw(String(charCount))})`)
      .orderBy(desc(count()))
      .limit(Math.min(200, limit))

    // ATC level 1 descriptions
    const atcLevel1Names: Record<string, string> = {
      'A': 'Alimentary tract and metabolism',
      'B': 'Blood and blood forming organs',
      'C': 'Cardiovascular system',
      'D': 'Dermatologicals',
      'G': 'Genito-urinary system and sex hormones',
      'H': 'Systemic hormonal preparations',
      'J': 'Antiinfectives for systemic use',
      'L': 'Antineoplastic and immunomodulating agents',
      'M': 'Musculo-skeletal system',
      'N': 'Nervous system',
      'P': 'Antiparasitic products, insecticides and repellents',
      'R': 'Respiratory system',
      'S': 'Sensory organs',
      'V': 'Various',
    }

    return {
      level,
      data: results.map(r => ({
        ...r,
        description: level === 1 ? atcLevel1Names[r.atcCode] : undefined,
      })),
    }
  }

  @Get('top-atc-codes')
  @ApiOperation({ summary: 'Most common full ATC codes' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Top ATC codes by product count' })
  async getTopAtcCodes(@Query('limit') limit = 20) {
    const results = await this.db
      .select({
        atcCode: medicinalProductsExtended.atcCode,
        pharmacotherapeuticGroup: medicinalProductsExtended.pharmacotherapeuticGroup,
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(isNotNull(medicinalProductsExtended.atcCode))
      .groupBy(medicinalProductsExtended.atcCode, medicinalProductsExtended.pharmacotherapeuticGroup)
      .orderBy(desc(count()))
      .limit(Math.min(100, limit))

    return { data: results }
  }

  @Get('therapeutic-areas-mesh')
  @ApiOperation({ summary: 'Therapeutic areas by MeSH terms' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Most common therapeutic areas (MeSH)' })
  async getTherapeuticAreasMesh(@Query('limit') limit = 30) {
    // MeSH terms are often semicolon-separated, we'll get unique first terms
    const results = await this.db
      .select({
        meshTerm: sql<string>`TRIM(SPLIT_PART(${medicinalProductsExtended.therapeuticAreaMesh}, ';', 1))`.as('mesh_term'),
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.therapeuticAreaMesh),
          ne(medicinalProductsExtended.therapeuticAreaMesh, ''),
        ),
      )
      .groupBy(sql`TRIM(SPLIT_PART(${medicinalProductsExtended.therapeuticAreaMesh}, ';', 1))`)
      .orderBy(desc(count()))
      .limit(Math.min(100, limit))

    return { data: results }
  }

  @Get('orphan-disease-coverage')
  @ApiOperation({ summary: 'Rare disease coverage (orphan medicines)' })
  @ApiResponse({ status: 200, description: 'Analysis of orphan medicine therapeutic areas' })
  async getOrphanDiseaseCoverage() {
    const orphanByArea = await this.db
      .select({
        meshTerm: sql<string>`TRIM(SPLIT_PART(${medicinalProductsExtended.therapeuticAreaMesh}, ';', 1))`.as('mesh_term'),
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          eq(medicinalProductsExtended.orphanMedicine, true),
          isNotNull(medicinalProductsExtended.therapeuticAreaMesh),
        ),
      )
      .groupBy(sql`TRIM(SPLIT_PART(${medicinalProductsExtended.therapeuticAreaMesh}, ';', 1))`)
      .orderBy(desc(count()))
      .limit(20)

    const [totalOrphan] = await this.db
      .select({ count: count() })
      .from(medicinalProductsExtended)
      .where(eq(medicinalProductsExtended.orphanMedicine, true))

    return {
      totalOrphanMedicines: totalOrphan?.count ?? 0,
      byTherapeuticArea: orphanByArea,
    }
  }

  @Get('pharmacotherapeutic-groups')
  @ApiOperation({ summary: 'Top pharmacotherapeutic groups' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Most common pharmacotherapeutic groups' })
  async getPharmacotherapeuticGroups(@Query('limit') limit = 30) {
    const results = await this.db
      .select({
        group: medicinalProductsExtended.pharmacotherapeuticGroup,
        count: count(),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.pharmacotherapeuticGroup),
          ne(medicinalProductsExtended.pharmacotherapeuticGroup, ''),
        ),
      )
      .groupBy(medicinalProductsExtended.pharmacotherapeuticGroup)
      .orderBy(desc(count()))
      .limit(Math.min(100, limit))

    return { data: results }
  }
}

// ============================================================================
// COMPANY & MARKET STATISTICS
// ============================================================================

/**
 * Company & Market Statistics
 * - Top MAH by product count
 * - Companies by country
 * - Market concentration
 */
@ApiTags('Statistics - Companies & Market')
@Controller('statistics/companies')
export class CompanyStatisticsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('overview')
  @ApiOperation({ summary: 'Company statistics overview' })
  @ApiResponse({ status: 200, description: 'Total companies, top MAH, etc.' })
  async getOverview() {
    const [[totalCompanies], topByProducts] = await Promise.all([
      this.db.select({ count: count() }).from(companies),
      this.db
        .select({
          id: companies.id,
          name: companies.name,
          slug: companies.slug,
          country: companies.country,
          productCount: count(productCompanies.productId),
        })
        .from(companies)
        .leftJoin(productCompanies, eq(companies.id, productCompanies.companyId))
        .groupBy(companies.id, companies.name, companies.slug, companies.country)
        .orderBy(desc(count(productCompanies.productId)))
        .limit(10),
    ])

    return {
      totalCompanies: totalCompanies?.count ?? 0,
      topByProductCount: topByProducts,
    }
  }

  @Get('top-mah')
  @ApiOperation({ summary: 'Top Marketing Authorization Holders by product count' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by product status (e.g., Authorised)' })
  @ApiResponse({ status: 200, description: 'Companies ranked by number of products' })
  async getTopMah(
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    let query = this.db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        country: companies.country,
        productCount: count(productCompanies.productId),
      })
      .from(companies)
      .innerJoin(productCompanies, eq(companies.id, productCompanies.companyId))

    if (status) {
      query = query.innerJoin(
        medicinalProductsExtended,
        and(
          eq(productCompanies.productId, medicinalProductsExtended.id),
          eq(medicinalProductsExtended.medicineStatus, status),
        ),
      ) as typeof query
    }

    const results = await query
      .groupBy(companies.id, companies.name, companies.slug, companies.country)
      .orderBy(desc(count(productCompanies.productId)))
      .limit(Math.min(100, limit))

    return { data: results }
  }

  @Get('by-country')
  @ApiOperation({ summary: 'Companies grouped by country' })
  @ApiResponse({ status: 200, description: 'Company distribution by country' })
  async getByCountry() {
    const results = await this.db
      .select({
        country: companies.country,
        companyCount: count(),
      })
      .from(companies)
      .where(isNotNull(companies.country))
      .groupBy(companies.country)
      .orderBy(desc(count()))

    return { data: results }
  }

  @Get('market-concentration')
  @ApiOperation({ summary: 'Market concentration analysis' })
  @ApiResponse({ status: 200, description: 'Market share analysis (top companies % of total products)' })
  async getMarketConcentration() {
    // Get all companies with product counts
    const allCompanies = await this.db
      .select({
        name: companies.name,
        productCount: count(productCompanies.productId),
      })
      .from(companies)
      .innerJoin(productCompanies, eq(companies.id, productCompanies.companyId))
      .groupBy(companies.name)
      .orderBy(desc(count(productCompanies.productId)))

    const [totalProducts] = await this.db.select({ count: count() }).from(medicinalProductsExtended)
    const total = totalProducts?.count ?? 1

    // Calculate market share for top companies
    let cumulativeShare = 0
    const top20 = allCompanies.slice(0, 20).map((c, idx) => {
      const share = (c.productCount / total) * 100
      cumulativeShare += share
      return {
        rank: idx + 1,
        name: c.name,
        productCount: c.productCount,
        marketShare: share.toFixed(2),
        cumulativeShare: cumulativeShare.toFixed(2),
      }
    })

    // Herfindahl-Hirschman Index (HHI) - simplified
    const hhi = allCompanies.reduce((sum, c) => {
      const share = (c.productCount / total) * 100
      return sum + (share * share)
    }, 0)

    return {
      totalProducts: total,
      totalCompanies: allCompanies.length,
      top20Companies: top20,
      herfindahlIndex: Math.round(hhi),
      top5Share: top20.slice(0, 5).reduce((sum, c) => sum + parseFloat(c.marketShare), 0).toFixed(2),
      top10Share: top20.slice(0, 10).reduce((sum, c) => sum + parseFloat(c.marketShare), 0).toFixed(2),
    }
  }

  @Get('products-per-company')
  @ApiOperation({ summary: 'Distribution of products per company' })
  @ApiResponse({ status: 200, description: 'Histogram of company sizes' })
  async getProductsPerCompany() {
    const companyCounts = await this.db
      .select({
        productCount: count(productCompanies.productId),
      })
      .from(companies)
      .innerJoin(productCompanies, eq(companies.id, productCompanies.companyId))
      .groupBy(companies.id)

    // Create distribution buckets
    const buckets = {
      '1': 0,
      '2-5': 0,
      '6-10': 0,
      '11-20': 0,
      '21-50': 0,
      '51-100': 0,
      '100+': 0,
    }

    companyCounts.forEach(({ productCount }) => {
      if (productCount === 1) buckets['1']++
      else if (productCount <= 5) buckets['2-5']++
      else if (productCount <= 10) buckets['6-10']++
      else if (productCount <= 20) buckets['11-20']++
      else if (productCount <= 50) buckets['21-50']++
      else if (productCount <= 100) buckets['51-100']++
      else buckets['100+']++
    })

    return {
      distribution: buckets,
      totalCompaniesWithProducts: companyCounts.length,
    }
  }

  @Get('most-active')
  @ApiOperation({ summary: 'Most active companies (recent approvals)' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Look back period in months (default: 12)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Companies with most new approvals in period' })
  async getMostActive(
    @Query('months') months = 12,
    @Query('limit') limit = 20,
  ) {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    const startDateStr = startDate.toISOString().slice(0, 10)

    const results = await this.db
      .select({
        name: companies.name,
        slug: companies.slug,
        country: companies.country,
        newApprovals: count(),
      })
      .from(companies)
      .innerJoin(productCompanies, eq(companies.id, productCompanies.companyId))
      .innerJoin(medicinalProductsExtended, eq(productCompanies.productId, medicinalProductsExtended.id))
      .where(gte(medicinalProductsExtended.marketingAuthorisationDate, startDateStr))
      .groupBy(companies.name, companies.slug, companies.country)
      .orderBy(desc(count()))
      .limit(Math.min(50, limit))

    return {
      period: { months, startDate: startDateStr },
      data: results,
    }
  }
}

// ============================================================================
// SUBSTANCE STATISTICS
// ============================================================================

/**
 * Substance Statistics
 * - Most common active substances
 * - Substances in multiple products
 * - Monotherapy vs combination
 */
@ApiTags('Statistics - Substances')
@Controller('statistics/substances')
export class SubstanceStatisticsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('overview')
  @ApiOperation({ summary: 'Substance statistics overview' })
  @ApiResponse({ status: 200, description: 'Total substances, averages, etc.' })
  async getOverview() {
    const [[totalSubstances], [totalProducts]] = await Promise.all([
      this.db.select({ count: count() }).from(substances),
      this.db.select({ count: count() }).from(medicinalProductsExtended),
    ])

    // Products with substance links
    const linkedProducts = await this.db
      .select({ productId: productSubstances.productId })
      .from(productSubstances)
      .groupBy(productSubstances.productId)

    return {
      totalSubstances: totalSubstances?.count ?? 0,
      totalProducts: totalProducts?.count ?? 0,
      productsWithSubstanceLinks: linkedProducts.length,
    }
  }

  @Get('most-common')
  @ApiOperation({ summary: 'Most common active substances' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Substances ranked by product count' })
  async getMostCommon(@Query('limit') limit = 30) {
    const results = await this.db
      .select({
        id: substances.id,
        slug: substances.slug,
        innName: substances.innName,
        productCount: count(productSubstances.productId),
      })
      .from(substances)
      .innerJoin(productSubstances, eq(substances.id, productSubstances.substanceId))
      .groupBy(substances.id, substances.slug, substances.innName)
      .orderBy(desc(count(productSubstances.productId)))
      .limit(Math.min(100, limit))

    return { data: results }
  }

  @Get('multi-product')
  @ApiOperation({ summary: 'Substances used in multiple products' })
  @ApiQuery({ name: 'minProducts', required: false, type: Number, description: 'Minimum product count (default: 2)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Versatile substances' })
  async getMultiProduct(
    @Query('minProducts') minProducts = 2,
    @Query('limit') limit = 50,
  ) {
    const results = await this.db
      .select({
        slug: substances.slug,
        innName: substances.innName,
        productCount: count(productSubstances.productId),
      })
      .from(substances)
      .innerJoin(productSubstances, eq(substances.id, productSubstances.substanceId))
      .groupBy(substances.slug, substances.innName)
      .having(gte(count(productSubstances.productId), minProducts))
      .orderBy(desc(count(productSubstances.productId)))
      .limit(Math.min(200, limit))

    return {
      minProductThreshold: minProducts,
      data: results,
    }
  }

  @Get('substances-per-product')
  @ApiOperation({ summary: 'Average substances per product (mono vs combination)' })
  @ApiResponse({ status: 200, description: 'Analysis of mono-therapy vs combination products' })
  async getSubstancesPerProduct() {
    // Count substances per product
    const substanceCounts = await this.db
      .select({
        productId: productSubstances.productId,
        substanceCount: count(),
      })
      .from(productSubstances)
      .groupBy(productSubstances.productId)

    // Create distribution
    const distribution: Record<string, number> = {
      '1 (monotherapy)': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5+': 0,
    }

    let totalSubstances = 0
    substanceCounts.forEach(({ substanceCount }) => {
      totalSubstances += substanceCount
      if (substanceCount === 1) distribution['1 (monotherapy)'] = (distribution['1 (monotherapy)'] ?? 0) + 1
      else if (substanceCount === 2) distribution['2'] = (distribution['2'] ?? 0) + 1
      else if (substanceCount === 3) distribution['3'] = (distribution['3'] ?? 0) + 1
      else if (substanceCount === 4) distribution['4'] = (distribution['4'] ?? 0) + 1
      else distribution['5+'] = (distribution['5+'] ?? 0) + 1
    })

    return {
      averageSubstancesPerProduct: substanceCounts.length > 0
        ? (totalSubstances / substanceCounts.length).toFixed(2)
        : '0',
      distribution,
      totalProductsWithSubstances: substanceCounts.length,
    }
  }

  @Get('most-versatile')
  @ApiOperation({ summary: 'Most versatile substances (across therapeutic areas)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Substances used across different therapeutic areas' })
  async getMostVersatile(@Query('limit') limit = 20) {
    const results = await this.db
      .select({
        innName: substances.innName,
        slug: substances.slug,
        productCount: count(productSubstances.productId),
        uniqueAtcCodes: sql<number>`COUNT(DISTINCT LEFT(${medicinalProductsExtended.atcCode}, 1))`.as('unique_atc'),
      })
      .from(substances)
      .innerJoin(productSubstances, eq(substances.id, productSubstances.substanceId))
      .innerJoin(medicinalProductsExtended, eq(productSubstances.productId, medicinalProductsExtended.id))
      .where(isNotNull(medicinalProductsExtended.atcCode))
      .groupBy(substances.innName, substances.slug)
      .orderBy(desc(sql`COUNT(DISTINCT LEFT(${medicinalProductsExtended.atcCode}, 1))`), desc(count()))
      .limit(Math.min(50, limit))

    return { data: results }
  }
}

// ============================================================================
// REGULATORY ACTIVITY STATISTICS
// ============================================================================

/**
 * Regulatory Activity Statistics
 * - Procedures by type
 * - Referral statistics
 * - Timeline event analysis
 */
@ApiTags('Statistics - Regulatory Activity')
@Controller('statistics/regulatory')
export class RegulatoryStatisticsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('procedures/overview')
  @ApiOperation({ summary: 'Procedure statistics overview' })
  @ApiResponse({ status: 200, description: 'Total procedures, by type, etc.' })
  async getProceduresOverview() {
    const [[total], byType] = await Promise.all([
      this.db.select({ count: count() }).from(procedures),
      this.db
        .select({
          type: procedures.procedureType,
          count: count(),
        })
        .from(procedures)
        .where(isNotNull(procedures.procedureType))
        .groupBy(procedures.procedureType)
        .orderBy(desc(count())),
    ])

    return {
      total: total?.count ?? 0,
      byType,
    }
  }

  @Get('procedures/by-type')
  @ApiOperation({ summary: 'Procedures grouped by type' })
  @ApiResponse({ status: 200, description: 'Initial, Type IA, Type IB, Type II, etc.' })
  async getProceduresByType() {
    const results = await this.db
      .select({
        type: procedures.procedureType,
        count: count(),
      })
      .from(procedures)
      .groupBy(procedures.procedureType)
      .orderBy(desc(count()))

    return { data: results }
  }

  @Get('procedures/per-product')
  @ApiOperation({ summary: 'Average procedures per product' })
  @ApiResponse({ status: 200, description: 'Products ranked by procedure activity' })
  async getProceduresPerProduct() {
    const productCounts = await this.db
      .select({
        productId: procedures.productId,
        procedureCount: count(),
      })
      .from(procedures)
      .where(isNotNull(procedures.productId))
      .groupBy(procedures.productId)

    const totalProcedures = productCounts.reduce((sum, p) => sum + p.procedureCount, 0)
    const avg = productCounts.length > 0 ? totalProcedures / productCounts.length : 0

    // Most active products
    const mostActive = await this.db
      .select({
        name: medicinalProductsExtended.name,
        slug: medicinalProductsExtended.slug,
        procedureCount: count(),
      })
      .from(procedures)
      .innerJoin(medicinalProductsExtended, eq(procedures.productId, medicinalProductsExtended.id))
      .groupBy(medicinalProductsExtended.name, medicinalProductsExtended.slug)
      .orderBy(desc(count()))
      .limit(15)

    return {
      averageProceduresPerProduct: avg.toFixed(2),
      productsWithProcedures: productCounts.length,
      mostActiveProducts: mostActive,
    }
  }

  @Get('referrals/overview')
  @ApiOperation({ summary: 'Referral statistics overview' })
  @ApiResponse({ status: 200, description: 'Total referrals, by legal basis and concern type' })
  async getReferralsOverview() {
    const [[total], byLegalBasis, byConcernType, byOutcome] = await Promise.all([
      this.db.select({ count: count() }).from(referrals),
      this.db
        .select({ legalBasis: referrals.legalBasis, count: count() })
        .from(referrals)
        .where(isNotNull(referrals.legalBasis))
        .groupBy(referrals.legalBasis)
        .orderBy(desc(count())),
      this.db
        .select({ concernType: referrals.concernType, count: count() })
        .from(referrals)
        .where(isNotNull(referrals.concernType))
        .groupBy(referrals.concernType)
        .orderBy(desc(count())),
      this.db
        .select({ outcome: referrals.outcome, count: count() })
        .from(referrals)
        .where(isNotNull(referrals.outcome))
        .groupBy(referrals.outcome)
        .orderBy(desc(count())),
    ])

    return {
      total: total?.count ?? 0,
      byLegalBasis,
      byConcernType,
      byOutcome,
    }
  }

  @Get('referrals/by-legal-basis')
  @ApiOperation({ summary: 'Referrals by legal basis' })
  @ApiResponse({ status: 200, description: 'Article 31, 107, 5(3), etc.' })
  async getReferralsByLegalBasis() {
    const results = await this.db
      .select({
        legalBasis: referrals.legalBasis,
        count: count(),
      })
      .from(referrals)
      .groupBy(referrals.legalBasis)
      .orderBy(desc(count()))

    return { data: results }
  }

  @Get('referrals/duration')
  @ApiOperation({ summary: 'Average referral duration' })
  @ApiResponse({ status: 200, description: 'Time from start to commission decision' })
  async getReferralDuration() {
    const avgDuration = await this.db
      .select({
        avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (${referrals.commissionDecisionDate}::timestamp - ${referrals.startDate}::timestamp)) / 86400)`.as('avg_days'),
        count: count(),
      })
      .from(referrals)
      .where(
        and(
          isNotNull(referrals.startDate),
          isNotNull(referrals.commissionDecisionDate),
        ),
      )

    return {
      averageDays: Math.round(avgDuration[0]?.avgDays ?? 0),
      referralsWithBothDates: avgDuration[0]?.count ?? 0,
    }
  }

  @Get('events/overview')
  @ApiOperation({ summary: 'Timeline events overview' })
  @ApiResponse({ status: 200, description: 'Events by category and type' })
  async getEventsOverview() {
    const [[total], byCategory, byType] = await Promise.all([
      this.db.select({ count: count() }).from(timelineEvents),
      this.db
        .select({ category: timelineEvents.eventCategory, count: count() })
        .from(timelineEvents)
        .groupBy(timelineEvents.eventCategory)
        .orderBy(desc(count())),
      this.db
        .select({ type: timelineEvents.eventType, count: count() })
        .from(timelineEvents)
        .groupBy(timelineEvents.eventType)
        .orderBy(desc(count()))
        .limit(20),
    ])

    return {
      total: total?.count ?? 0,
      byCategory,
      byType,
    }
  }

  @Get('events/by-category')
  @ApiOperation({ summary: 'Events by category' })
  @ApiResponse({ status: 200, description: 'Regulatory, documents, procedures, safety, news, supply' })
  async getEventsByCategory() {
    const results = await this.db
      .select({
        category: timelineEvents.eventCategory,
        count: count(),
      })
      .from(timelineEvents)
      .groupBy(timelineEvents.eventCategory)
      .orderBy(desc(count()))

    return { data: results }
  }

  @Get('events/most-eventful-products')
  @ApiOperation({ summary: 'Products with most timeline events' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Most eventful products' })
  async getMostEventfulProducts(@Query('limit') limit = 20) {
    const results = await this.db
      .select({
        name: medicinalProductsExtended.name,
        slug: medicinalProductsExtended.slug,
        eventCount: count(),
      })
      .from(timelineEvents)
      .innerJoin(medicinalProductsExtended, eq(timelineEvents.productId, medicinalProductsExtended.id))
      .groupBy(medicinalProductsExtended.name, medicinalProductsExtended.slug)
      .orderBy(desc(count()))
      .limit(Math.min(50, limit))

    return { data: results }
  }

  @Get('events/frequency')
  @ApiOperation({ summary: 'Event frequency over time' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of months (default: 24)' })
  @ApiResponse({ status: 200, description: 'Events per month' })
  async getEventFrequency(@Query('months') months = 24) {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - Math.min(120, months))
    const startDateStr = startDate.toISOString().slice(0, 10)

    const results = await this.db
      .select({
        yearMonth: sql<string>`TO_CHAR(${timelineEvents.eventDate}, 'YYYY-MM')`.as('year_month'),
        count: count(),
      })
      .from(timelineEvents)
      .where(gte(timelineEvents.eventDate, startDateStr))
      .groupBy(sql`TO_CHAR(${timelineEvents.eventDate}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${timelineEvents.eventDate}, 'YYYY-MM')`))

    return { data: results }
  }
}

// ============================================================================
// SAFETY & SUPPLY STATISTICS
// ============================================================================

/**
 * Safety & Supply Statistics
 * - Multi-source shortages analysis (EMA, FDA, MHRA, BfArM)
 * - Safety monitoring
 */
@ApiTags('Statistics - Safety & Supply')
@Controller('statistics/safety')
export class SafetyStatisticsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('shortages/overview')
  @ApiOperation({ summary: 'Shortage statistics overview (multi-source)' })
  @ApiQuery({ name: 'authority', required: false, type: String, description: 'Filter by authority (EMA, FDA, MHRA, BfArM)' })
  @ApiResponse({ status: 200, description: 'Active shortages by status, authority, region' })
  async getShortagesOverview(@Query('authority') authority?: string) {
    // Build base condition for authority filtering
    const authorityCondition = authority ? eq(shortages.sourceAuthority, authority) : undefined

    // Core queries that work with existing schema
    const [[total], byStatus, bySeverity] = await Promise.all([
      this.db.select({ count: count() }).from(shortages).where(authorityCondition),
      this.db
        .select({ status: shortages.status, count: count() })
        .from(shortages)
        .where(authorityCondition)
        .groupBy(shortages.status)
        .orderBy(desc(count())),
      this.db
        .select({ severity: shortages.severity, count: count() })
        .from(shortages)
        .where(authorityCondition ? and(isNotNull(shortages.severity), authorityCondition) : isNotNull(shortages.severity))
        .groupBy(shortages.severity)
        .orderBy(desc(count())),
    ])

    // Multi-source queries - gracefully handle if columns don't exist yet
    let byAuthority: Array<{ authority: string; count: number }> = []
    let byRegion: Array<{ region: string; count: number }> = []

    try {
      byAuthority = await this.db
        .select({ authority: shortages.sourceAuthority, count: count() })
        .from(shortages)
        .groupBy(shortages.sourceAuthority)
        .orderBy(desc(count()))
    } catch {
      // Column doesn't exist yet - run migration
    }

    try {
      byRegion = await this.db
        .select({ region: shortages.region, count: count() })
        .from(shortages)
        .groupBy(shortages.region)
        .orderBy(desc(count()))
    } catch {
      // Column doesn't exist yet - run migration
    }

    const activeCount = byStatus.find(s => s.status === 'active')?.count ?? 0

    return {
      total: total?.count ?? 0,
      activeShortages: activeCount,
      byStatus,
      bySeverity,
      byAuthority,
      byRegion,
      meta: {
        authority,
        availableAuthorities: ['EMA', 'FDA', 'MHRA', 'BfArM'],
      },
    }
  }

  @Get('shortages/by-authority')
  @ApiOperation({ summary: 'Shortages grouped by source authority' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status (active, resolved)' })
  @ApiResponse({ status: 200, description: 'Shortages from EMA, FDA, MHRA, BfArM' })
  async getShortagesByAuthority(@Query('status') status?: string) {
    try {
      const conditions = []
      if (status) {
        conditions.push(eq(shortages.status, status))
      }

      const results = await this.db
        .select({
          authority: shortages.sourceAuthority,
          region: shortages.region,
          count: count(),
        })
        .from(shortages)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(shortages.sourceAuthority, shortages.region)
        .orderBy(desc(count()))
      return {
        data: results,
        meta: {
          filter: { status },
          availableAuthorities: ['EMA', 'FDA', 'MHRA', 'BfArM'],
        },
      }
    } catch {
      return { data: [], message: 'Run migration to enable multi-source support' }
    }
  }

  @Get('shortages/by-region')
  @ApiOperation({ summary: 'Shortages grouped by region' })
  @ApiResponse({ status: 200, description: 'Geographic distribution of shortages' })
  async getShortagesByRegion() {
    try {
      const results = await this.db
        .select({
          region: shortages.region,
          authority: shortages.sourceAuthority,
          total: count(),
        })
        .from(shortages)
        .groupBy(shortages.region, shortages.sourceAuthority)
        .orderBy(desc(count()))
      return { data: results }
    } catch {
      return { data: [], message: 'Run migration to enable multi-source support' }
    }
  }

  @Get('shortages/by-inn')
  @ApiOperation({ summary: 'Shortages grouped by INN (substance)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Most affected substances across all sources' })
  async getShortagesByInn(@Query('limit') limit = 20) {
    try {
      const results = await this.db
        .select({
          inn: shortages.inn,
          total: count(),
        })
        .from(shortages)
        .where(isNotNull(shortages.inn))
        .groupBy(shortages.inn)
        .orderBy(desc(count()))
        .limit(Math.min(100, limit))
      return { data: results }
    } catch {
      return { data: [], message: 'Run migration to enable multi-source support' }
    }
  }

  @Get('shortages/active')
  @ApiOperation({ summary: 'Currently active shortages (multi-source)' })
  @ApiQuery({ name: 'authority', required: false, type: String, description: 'Filter by authority (EMA, FDA, MHRA, BfArM)' })
  @ApiQuery({ name: 'region', required: false, type: String, description: 'Filter by region (EU, US, UK, DE)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of active shortages' })
  async getActiveShortages(
    @Query('authority') authority?: string,
    @Query('region') region?: string,
    @Query('limit') limit = 50,
  ) {
    try {
      // Build conditions array
      const conditions = [eq(shortages.status, 'active')]
      if (authority) {
        conditions.push(eq(shortages.sourceAuthority, authority))
      }
      if (region) {
        conditions.push(eq(shortages.region, region))
      }

      // Try full multi-source query first
      const results = await this.db
        .select({
          id: shortages.id,
          slug: shortages.slug,
          title: shortages.title,
          medicineAffected: shortages.medicineAffected,
          inn: shortages.inn,
          sourceAuthority: shortages.sourceAuthority,
          region: shortages.region,
          severity: shortages.severity,
          category: shortages.category,
          therapeuticAreaMesh: shortages.therapeuticAreaMesh,
          pharmaceuticalFormsAffected: shortages.pharmaceuticalFormsAffected,
          strengthsAffected: shortages.strengthsAffected,
          availabilityOfAlternatives: shortages.availabilityOfAlternatives,
          startOfShortageDate: shortages.startOfShortageDate,
          expectedResolutionDate: shortages.expectedResolutionDate,
          lastUpdatedDate: shortages.lastUpdatedDate,
          sourceUrl: shortages.sourceUrl,
          product: {
            name: medicinalProductsExtended.name,
            slug: medicinalProductsExtended.slug,
          },
        })
        .from(shortages)
        .leftJoin(medicinalProductsExtended, eq(shortages.productId, medicinalProductsExtended.id))
        .where(and(...conditions))
        .orderBy(desc(shortages.reportedDate))
        .limit(Math.min(200, limit))

      return {
        count: results.length,
        data: results,
        meta: {
          authority,
          region,
          availableAuthorities: ['EMA', 'FDA', 'MHRA', 'BfArM'],
          availableRegions: ['EU', 'US', 'UK', 'DE'],
        },
      }
    } catch {
      // Fallback: use only existing columns (without authority/region filtering)
      const results = await this.db
        .select({
          id: shortages.id,
          title: shortages.title,
          severity: shortages.severity,
          status: shortages.status,
          expectedResolutionDate: shortages.expectedResolutionDate,
          sourceUrl: shortages.sourceUrl,
          reportedDate: shortages.reportedDate,
          product: {
            name: medicinalProductsExtended.name,
            slug: medicinalProductsExtended.slug,
          },
        })
        .from(shortages)
        .leftJoin(medicinalProductsExtended, eq(shortages.productId, medicinalProductsExtended.id))
        .where(eq(shortages.status, 'active'))
        .orderBy(desc(shortages.reportedDate))
        .limit(Math.min(200, limit))

      return { count: results.length, data: results, message: 'Run migration to enable multi-source fields' }
    }
  }

  @Get('shortages/duration')
  @ApiOperation({ summary: 'Average shortage duration by authority' })
  @ApiResponse({ status: 200, description: 'Statistics on shortage durations' })
  async getShortagesDuration() {
    // Core query that works with base schema
    const overall = await this.db
      .select({
        avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (${shortages.actualResolutionDate}::timestamp - ${shortages.reportedDate}::timestamp)) / 86400)`.as('avg_days'),
        count: count(),
      })
      .from(shortages)
      .where(
        and(
          isNotNull(shortages.actualResolutionDate),
          eq(shortages.status, 'resolved'),
        ),
      )

    // Try multi-source query with graceful fallback
    let byAuthority: Array<{ authority: string | null; avgDays: number; count: number }> = []
    try {
      byAuthority = await this.db
        .select({
          authority: shortages.sourceAuthority,
          avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (${shortages.actualResolutionDate}::timestamp - ${shortages.reportedDate}::timestamp)) / 86400)`.as('avg_days'),
          count: count(),
        })
        .from(shortages)
        .where(
          and(
            isNotNull(shortages.actualResolutionDate),
            eq(shortages.status, 'resolved'),
          ),
        )
        .groupBy(shortages.sourceAuthority)
    } catch {
      // Column doesn't exist yet - run migration
    }

    return {
      overall: {
        averageDaysToResolution: Math.round(overall[0]?.avgDays ?? 0),
        resolvedShortagesWithData: overall[0]?.count ?? 0,
      },
      byAuthority: byAuthority.map(a => ({
        authority: a.authority,
        averageDays: Math.round(a.avgDays ?? 0),
        count: a.count,
      })),
    }
  }

  @Get('shortages/affected-products')
  @ApiOperation({ summary: 'Most affected products by shortages' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Products with most shortage reports' })
  async getMostAffectedProducts(@Query('limit') limit = 20) {
    const results = await this.db
      .select({
        name: medicinalProductsExtended.name,
        slug: medicinalProductsExtended.slug,
        shortageCount: count(),
      })
      .from(shortages)
      .innerJoin(medicinalProductsExtended, eq(shortages.productId, medicinalProductsExtended.id))
      .groupBy(medicinalProductsExtended.name, medicinalProductsExtended.slug)
      .orderBy(desc(count()))
      .limit(Math.min(50, limit))

    return { data: results }
  }

  @Get('shortages/by-country')
  @ApiOperation({ summary: 'Shortages by affected country' })
  @ApiResponse({ status: 200, description: 'Geographic distribution of shortages' })
  async getShortagesByCountry() {
    // affectedCountries is comma-separated, need to parse
    const all = await this.db
      .select({ affectedCountries: shortages.affectedCountries })
      .from(shortages)
      .where(isNotNull(shortages.affectedCountries))

    const countryCount: Record<string, number> = {}
    all.forEach(({ affectedCountries }) => {
      if (affectedCountries) {
        affectedCountries.split(',').forEach((c: string) => {
          const country = c.trim()
          if (country) {
            countryCount[country] = (countryCount[country] ?? 0) + 1
          }
        })
      }
    })

    const sorted = Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }))

    return { data: sorted }
  }

  @Get('shortages/over-time')
  @ApiOperation({ summary: 'Shortage reports over time by authority' })
  @ApiQuery({ name: 'months', required: false, type: Number })
  @ApiQuery({ name: 'authority', required: false, type: String, description: 'Filter by authority (EMA, FDA, MHRA, BfArM)' })
  @ApiResponse({ status: 200, description: 'Monthly shortage reporting trend' })
  async getShortagesOverTime(
    @Query('months') months = 24,
    @Query('authority') authority?: string,
  ) {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - Math.min(120, months))
    const startDateStr = startDate.toISOString().slice(0, 10)

    // Try multi-source query first
    try {
      const dateField = sql`COALESCE(${shortages.startOfShortageDate}, ${shortages.reportedDate})`

      // Build conditions
      const conditions = [gte(dateField, startDateStr)]
      if (authority) {
        conditions.push(eq(shortages.sourceAuthority, authority))
      }

      const results = await this.db
        .select({
          yearMonth: sql<string>`TO_CHAR(${dateField}, 'YYYY-MM')`.as('year_month'),
          authority: shortages.sourceAuthority,
          count: count(),
        })
        .from(shortages)
        .where(and(...conditions))
        .groupBy(sql`TO_CHAR(${dateField}, 'YYYY-MM')`, shortages.sourceAuthority)
        .orderBy(asc(sql`TO_CHAR(${dateField}, 'YYYY-MM')`))

      return {
        data: results,
        meta: {
          authority,
          months,
          availableAuthorities: ['EMA', 'FDA', 'MHRA', 'BfArM'],
        },
      }
    } catch {
      // Fallback: use only reportedDate (without authority filtering)
      const results = await this.db
        .select({
          yearMonth: sql<string>`TO_CHAR(${shortages.reportedDate}, 'YYYY-MM')`.as('year_month'),
          count: count(),
        })
        .from(shortages)
        .where(gte(shortages.reportedDate, startDateStr))
        .groupBy(sql`TO_CHAR(${shortages.reportedDate}, 'YYYY-MM')`)
        .orderBy(asc(sql`TO_CHAR(${shortages.reportedDate}, 'YYYY-MM')`))

      return { data: results.map(r => ({ ...r, authority: 'EMA' })) }
    }
  }

  @Get('monitoring/additional')
  @ApiOperation({ summary: 'Products under additional monitoring' })
  @ApiResponse({ status: 200, description: 'Count and list of additionally monitored products' })
  async getAdditionalMonitoring() {
    const [[countResult], products] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(medicinalProductsExtended)
        .where(eq(medicinalProductsExtended.additionalMonitoring, true)),
      this.db
        .select({
          name: medicinalProductsExtended.name,
          slug: medicinalProductsExtended.slug,
          status: medicinalProductsExtended.medicineStatus,
        })
        .from(medicinalProductsExtended)
        .where(eq(medicinalProductsExtended.additionalMonitoring, true))
        .orderBy(medicinalProductsExtended.name)
        .limit(100),
    ])

    return {
      total: countResult?.count ?? 0,
      products,
    }
  }
}

// ============================================================================
// DATA QUALITY STATISTICS
// ============================================================================

/**
 * Data Quality & Coverage Statistics
 * - Completeness indicators
 * - Update frequency
 */
@ApiTags('Statistics - Data Quality')
@Controller('statistics/data-quality')
export class DataQualityStatisticsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('completeness')
  @ApiOperation({ summary: 'Data completeness indicators' })
  @ApiResponse({ status: 200, description: 'Fields with missing data' })
  async getCompleteness() {
    const [total] = await this.db.select({ count: count() }).from(medicinalProductsExtended)
    const totalCount = total?.count ?? 1

    const [
      missingAtc,
      missingMah,
      missingDate,
      missingInn,
      missingTherapeutic,
    ] = await Promise.all([
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(isNull(medicinalProductsExtended.atcCode)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(isNull(medicinalProductsExtended.marketingAuthorisationHolderDeveloperApplicant)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(isNull(medicinalProductsExtended.marketingAuthorisationDate)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(isNull(medicinalProductsExtended.internationalNonProprietaryName)),
      this.db.select({ count: count() }).from(medicinalProductsExtended).where(isNull(medicinalProductsExtended.therapeuticAreaMesh)),
    ])

    const calcPct = (missing: number) => ((totalCount - missing) / totalCount * 100).toFixed(1)

    return {
      totalProducts: totalCount,
      completeness: {
        atcCode: {
          complete: totalCount - (missingAtc[0]?.count ?? 0),
          missing: missingAtc[0]?.count ?? 0,
          percentComplete: calcPct(missingAtc[0]?.count ?? 0),
        },
        marketingAuthorisationHolder: {
          complete: totalCount - (missingMah[0]?.count ?? 0),
          missing: missingMah[0]?.count ?? 0,
          percentComplete: calcPct(missingMah[0]?.count ?? 0),
        },
        marketingAuthorisationDate: {
          complete: totalCount - (missingDate[0]?.count ?? 0),
          missing: missingDate[0]?.count ?? 0,
          percentComplete: calcPct(missingDate[0]?.count ?? 0),
        },
        internationalNonProprietaryName: {
          complete: totalCount - (missingInn[0]?.count ?? 0),
          missing: missingInn[0]?.count ?? 0,
          percentComplete: calcPct(missingInn[0]?.count ?? 0),
        },
        therapeuticAreaMesh: {
          complete: totalCount - (missingTherapeutic[0]?.count ?? 0),
          missing: missingTherapeutic[0]?.count ?? 0,
          percentComplete: calcPct(missingTherapeutic[0]?.count ?? 0),
        },
      },
    }
  }

  @Get('coverage')
  @ApiOperation({ summary: 'Data coverage by source' })
  @ApiResponse({ status: 200, description: 'Products per data source' })
  async getCoverage() {
    // Products with various linked data
    const [
      totalProductsResult,
      productsWithSubstancesResult,
      productsWithCompaniesResult,
      productsWithEventsResult,
      productsWithProceduresResult,
    ] = await Promise.all([
      this.db.select({ count: count() }).from(medicinalProductsExtended),
      this.db.select({ count: sql<number>`COUNT(DISTINCT ${productSubstances.productId})` }).from(productSubstances),
      this.db.select({ count: sql<number>`COUNT(DISTINCT ${productCompanies.productId})` }).from(productCompanies),
      this.db.select({ count: sql<number>`COUNT(DISTINCT ${timelineEvents.productId})` }).from(timelineEvents).where(isNotNull(timelineEvents.productId)),
      this.db.select({ count: sql<number>`COUNT(DISTINCT ${procedures.productId})` }).from(procedures).where(isNotNull(procedures.productId)),
    ])

    const totalProducts = totalProductsResult[0]
    const productsWithSubstances = productsWithSubstancesResult[0]
    const productsWithCompanies = productsWithCompaniesResult[0]
    const productsWithEvents = productsWithEventsResult[0]
    const productsWithProcedures = productsWithProceduresResult[0]

    return {
      totalProducts: totalProducts?.count ?? 0,
      coverage: {
        substances: productsWithSubstances?.count ?? 0,
        companies: productsWithCompanies?.count ?? 0,
        timelineEvents: productsWithEvents?.count ?? 0,
        procedures: productsWithProcedures?.count ?? 0,
      },
    }
  }

  @Get('recently-updated')
  @ApiOperation({ summary: 'Most recently updated products' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Products sorted by last update' })
  async getRecentlyUpdated(@Query('limit') limit = 20) {
    const results = await this.db
      .select({
        name: medicinalProductsExtended.name,
        slug: medicinalProductsExtended.slug,
        lastUpdatedDate: medicinalProductsExtended.lastUpdatedDate,
        updatedAt: medicinalProductsExtended.updatedAt,
      })
      .from(medicinalProductsExtended)
      .orderBy(desc(medicinalProductsExtended.lastUpdatedDate))
      .limit(Math.min(100, limit))

    return { data: results }
  }

  @Get('staleness')
  @ApiOperation({ summary: 'Data staleness indicators' })
  @ApiResponse({ status: 200, description: 'Products not updated recently' })
  async getStaleness() {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10)

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10)

    const [stale1Year, stale6Months, recent] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(medicinalProductsExtended)
        .where(
          and(
            isNotNull(medicinalProductsExtended.lastUpdatedDate),
            lte(medicinalProductsExtended.lastUpdatedDate, oneYearAgoStr),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(medicinalProductsExtended)
        .where(
          and(
            isNotNull(medicinalProductsExtended.lastUpdatedDate),
            lte(medicinalProductsExtended.lastUpdatedDate, sixMonthsAgoStr),
            gte(medicinalProductsExtended.lastUpdatedDate, oneYearAgoStr),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(medicinalProductsExtended)
        .where(
          and(
            isNotNull(medicinalProductsExtended.lastUpdatedDate),
            gte(medicinalProductsExtended.lastUpdatedDate, sixMonthsAgoStr),
          ),
        ),
    ])

    return {
      updatedWithin6Months: recent[0]?.count ?? 0,
      updatedBetween6And12Months: stale6Months[0]?.count ?? 0,
      notUpdatedInOver1Year: stale1Year[0]?.count ?? 0,
    }
  }
}

// ============================================================================
// NEWS STATISTICS
// ============================================================================

/**
 * News & Communication Statistics
 */
@ApiTags('Statistics - News')
@Controller('statistics/news')
export class NewsStatisticsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('overview')
  @ApiOperation({ summary: 'News statistics overview' })
  @ApiResponse({ status: 200, description: 'Total news items, by type' })
  async getOverview() {
    const [[total], byType] = await Promise.all([
      this.db.select({ count: count() }).from(newsItems),
      this.db
        .select({ type: newsItems.newsType, count: count() })
        .from(newsItems)
        .where(isNotNull(newsItems.newsType))
        .groupBy(newsItems.newsType)
        .orderBy(desc(count())),
    ])

    return {
      total: total?.count ?? 0,
      byType,
    }
  }

  @Get('by-type')
  @ApiOperation({ summary: 'News items by type' })
  @ApiResponse({ status: 200, description: 'Press releases, news, safety updates' })
  async getByType() {
    const results = await this.db
      .select({
        type: newsItems.newsType,
        count: count(),
      })
      .from(newsItems)
      .groupBy(newsItems.newsType)
      .orderBy(desc(count()))

    return { data: results }
  }

  @Get('most-covered-products')
  @ApiOperation({ summary: 'Products with most news coverage' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Products ranked by news mentions' })
  async getMostCoveredProducts(@Query('limit') limit = 20) {
    const results = await this.db
      .select({
        name: medicinalProductsExtended.name,
        slug: medicinalProductsExtended.slug,
        newsCount: count(),
      })
      .from(productNews)
      .innerJoin(medicinalProductsExtended, eq(productNews.productId, medicinalProductsExtended.id))
      .groupBy(medicinalProductsExtended.name, medicinalProductsExtended.slug)
      .orderBy(desc(count()))
      .limit(Math.min(50, limit))

    return { data: results }
  }

  @Get('frequency')
  @ApiOperation({ summary: 'News publication frequency over time' })
  @ApiQuery({ name: 'months', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'News items per month' })
  async getFrequency(@Query('months') months = 24) {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - Math.min(120, months))
    const startDateStr = startDate.toISOString().slice(0, 10)

    const results = await this.db
      .select({
        yearMonth: sql<string>`TO_CHAR(${newsItems.publishedDate}, 'YYYY-MM')`.as('year_month'),
        count: count(),
      })
      .from(newsItems)
      .where(gte(newsItems.publishedDate, startDateStr))
      .groupBy(sql`TO_CHAR(${newsItems.publishedDate}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${newsItems.publishedDate}, 'YYYY-MM')`))

    return { data: results }
  }
}

// ============================================================================
// ADVANCED ANALYTICS
// ============================================================================

/**
 * Advanced Analytics
 * - Correlation analysis
 * - Geographic insights
 */
@ApiTags('Statistics - Advanced Analytics')
@Controller('statistics/analytics')
export class AdvancedAnalyticsController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get('orphan-withdrawal-correlation')
  @ApiOperation({ summary: 'Orphan status vs withdrawal rate correlation' })
  @ApiResponse({ status: 200, description: 'Withdrawal rates for orphan vs non-orphan medicines' })
  async getOrphanWithdrawalCorrelation() {
    const [orphanStats, nonOrphanStats] = await Promise.all([
      this.db
        .select({
          status: medicinalProductsExtended.medicineStatus,
          count: count(),
        })
        .from(medicinalProductsExtended)
        .where(eq(medicinalProductsExtended.orphanMedicine, true))
        .groupBy(medicinalProductsExtended.medicineStatus),
      this.db
        .select({
          status: medicinalProductsExtended.medicineStatus,
          count: count(),
        })
        .from(medicinalProductsExtended)
        .where(
          sql`${medicinalProductsExtended.orphanMedicine} IS NULL OR ${medicinalProductsExtended.orphanMedicine} = false`,
        )
        .groupBy(medicinalProductsExtended.medicineStatus),
    ])

    const calcRate = (stats: { status: string; count: number }[]) => {
      const total = stats.reduce((sum, s) => sum + s.count, 0)
      const withdrawn = stats.find(s => s.status === 'Withdrawn')?.count ?? 0
      return { total, withdrawn, rate: total > 0 ? ((withdrawn / total) * 100).toFixed(2) : '0' }
    }

    return {
      orphanMedicines: calcRate(orphanStats),
      nonOrphanMedicines: calcRate(nonOrphanStats),
    }
  }

  @Get('designation-combinations')
  @ApiOperation({ summary: 'Common designation combinations' })
  @ApiResponse({ status: 200, description: 'Products with multiple special designations' })
  async getDesignationCombinations() {
    // Products with 2+ designations
    const multiDesignation = await this.db
      .select({
        name: medicinalProductsExtended.name,
        slug: medicinalProductsExtended.slug,
        orphan: medicinalProductsExtended.orphanMedicine,
        biosimilar: medicinalProductsExtended.biosimilar,
        advancedTherapy: medicinalProductsExtended.advancedTherapy,
        conditionalApproval: medicinalProductsExtended.conditionalApproval,
        acceleratedAssessment: medicinalProductsExtended.acceleratedAssessment,
        exceptionalCircumstances: medicinalProductsExtended.exceptionalCircumstances,
        primePriority: medicinalProductsExtended.primePriorityMedicine,
      })
      .from(medicinalProductsExtended)
      .where(
        sql`(
          COALESCE(${medicinalProductsExtended.orphanMedicine}::int, 0) +
          COALESCE(${medicinalProductsExtended.biosimilar}::int, 0) +
          COALESCE(${medicinalProductsExtended.advancedTherapy}::int, 0) +
          COALESCE(${medicinalProductsExtended.conditionalApproval}::int, 0) +
          COALESCE(${medicinalProductsExtended.acceleratedAssessment}::int, 0) +
          COALESCE(${medicinalProductsExtended.exceptionalCircumstances}::int, 0) +
          COALESCE(${medicinalProductsExtended.primePriorityMedicine}::int, 0)
        ) >= 2`,
      )
      .limit(100)

    return {
      productsWithMultipleDesignations: multiDesignation.length,
      examples: multiDesignation.slice(0, 20),
    }
  }

  @Get('company-portfolio-diversity')
  @ApiOperation({ summary: 'Company portfolio diversity analysis' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Companies with most diverse therapeutic portfolios' })
  async getCompanyPortfolioDiversity(@Query('limit') limit = 20) {
    const results = await this.db
      .select({
        name: companies.name,
        slug: companies.slug,
        productCount: count(productCompanies.productId),
        uniqueAtcAreas: sql<number>`COUNT(DISTINCT LEFT(${medicinalProductsExtended.atcCode}, 1))`.as('atc_areas'),
      })
      .from(companies)
      .innerJoin(productCompanies, eq(companies.id, productCompanies.companyId))
      .innerJoin(medicinalProductsExtended, eq(productCompanies.productId, medicinalProductsExtended.id))
      .where(isNotNull(medicinalProductsExtended.atcCode))
      .groupBy(companies.name, companies.slug)
      .having(gte(count(productCompanies.productId), 5)) // At least 5 products
      .orderBy(
        desc(sql`COUNT(DISTINCT LEFT(${medicinalProductsExtended.atcCode}, 1))`),
        desc(count(productCompanies.productId)),
      )
      .limit(Math.min(50, limit))

    return { data: results }
  }

  @Get('approval-trends-by-designation')
  @ApiOperation({ summary: 'Approval trends segmented by designation' })
  @ApiQuery({ name: 'years', required: false, type: Number, description: 'Number of years to analyze (default: 10)' })
  @ApiResponse({ status: 200, description: 'Year-over-year approval trends for each designation' })
  async getApprovalTrendsByDesignation(@Query('years') years = 10) {
    const startYear = new Date().getFullYear() - years

    const results = await this.db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${medicinalProductsExtended.marketingAuthorisationDate})`.as('year'),
        total: count(),
        orphan: sql<number>`SUM(CASE WHEN ${medicinalProductsExtended.orphanMedicine} THEN 1 ELSE 0 END)`.as('orphan'),
        biosimilar: sql<number>`SUM(CASE WHEN ${medicinalProductsExtended.biosimilar} THEN 1 ELSE 0 END)`.as('biosimilar'),
        advancedTherapy: sql<number>`SUM(CASE WHEN ${medicinalProductsExtended.advancedTherapy} THEN 1 ELSE 0 END)`.as('advanced'),
        genericOrHybrid: sql<number>`SUM(CASE WHEN ${medicinalProductsExtended.genericOrHybrid} THEN 1 ELSE 0 END)`.as('generic'),
      })
      .from(medicinalProductsExtended)
      .where(
        and(
          isNotNull(medicinalProductsExtended.marketingAuthorisationDate),
          gte(medicinalProductsExtended.marketingAuthorisationDate, `${startYear}-01-01`),
        ),
      )
      .groupBy(sql`EXTRACT(YEAR FROM ${medicinalProductsExtended.marketingAuthorisationDate})`)
      .orderBy(asc(sql`EXTRACT(YEAR FROM ${medicinalProductsExtended.marketingAuthorisationDate})`))

    return { data: results }
  }
}
