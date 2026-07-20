import { Controller, Get, Param, Inject, NotFoundException } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'
import {
  regionalAuthorizations,
  regionalAuthorizationHistory,
  medicinalProducts,
  substances,
  productSubstances,
} from '@workspace/database'
import { eq, desc, and } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

/**
 * Regional region information for map display
 */
interface RegionInfo {
  region: string
  authority: string
  status: string
  brandName?: string | null
  authorizationDate?: string | null
  localProductCode?: string | null
  lastVerifiedAt?: Date | null
}

/**
 * Product Regional Status API
 *
 * Provides regional authorization status for map visualization.
 */
@ApiTags('Regional Status')
@Controller('products/:slug/regional-status')
export class ProductRegionalStatusController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({
    summary: 'Get regional authorization status for a product',
    description: 'Returns authorization status across different regulatory regions for map visualization',
  })
  @ApiParam({ name: 'slug', description: 'Product slug' })
  @ApiResponse({
    status: 200,
    description: 'Regional authorization status',
    schema: {
      type: 'object',
      properties: {
        product: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            name: { type: 'string' },
          },
        },
        regions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              region: { type: 'string' },
              authority: { type: 'string' },
              status: { type: 'string' },
              brandName: { type: 'string' },
              authorizationDate: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductRegionalStatus(@Param('slug') slug: string) {
    // Find the product
    const [product] = await this.db
      .select({
        id: medicinalProducts.id,
        slug: medicinalProducts.slug,
        name: medicinalProducts.name,
      })
      .from(medicinalProducts)
      .where(eq(medicinalProducts.slug, slug))
      .limit(1)

    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`)
    }

    // Get regional authorizations for this product
    const authorizations = await this.db
      .select()
      .from(regionalAuthorizations)
      .where(eq(regionalAuthorizations.productId, product.id))
      .orderBy(regionalAuthorizations.region)

    // Build region info with all standard regions
    const standardRegions = ['EU', 'US', 'UK', 'CH', 'DE', 'JP', 'CA', 'AU']
    const regionMap = new Map<string, RegionInfo>()

    // Initialize all regions as unknown
    for (const region of standardRegions) {
      regionMap.set(region, {
        region,
        authority: this.getAuthorityForRegion(region),
        status: 'unknown',
      })
    }

    // Update with actual authorization data
    for (const auth of authorizations) {
      regionMap.set(auth.region, {
        region: auth.region,
        authority: auth.authority,
        status: auth.status,
        brandName: auth.brandName,
        authorizationDate: auth.authorizationDate,
        localProductCode: auth.localProductCode,
        lastVerifiedAt: auth.lastVerifiedAt,
      })
    }

    return {
      product: {
        slug: product.slug,
        name: product.name,
      },
      regions: Array.from(regionMap.values()),
    }
  }

  @Get('history')
  @ApiOperation({ summary: 'Get authorization history for a product' })
  @ApiParam({ name: 'slug', description: 'Product slug' })
  @ApiResponse({ status: 200, description: 'Authorization history by region' })
  async getProductRegionalHistory(@Param('slug') slug: string) {
    const [product] = await this.db
      .select({ id: medicinalProducts.id })
      .from(medicinalProducts)
      .where(eq(medicinalProducts.slug, slug))
      .limit(1)

    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`)
    }

    // Get authorizations with history
    const authorizations = await this.db
      .select()
      .from(regionalAuthorizations)
      .where(eq(regionalAuthorizations.productId, product.id))

    const history = []
    for (const auth of authorizations) {
      const authHistory = await this.db
        .select()
        .from(regionalAuthorizationHistory)
        .where(eq(regionalAuthorizationHistory.authorizationId, auth.id))
        .orderBy(desc(regionalAuthorizationHistory.changedAt))

      history.push({
        region: auth.region,
        authority: auth.authority,
        currentStatus: auth.status,
        history: authHistory,
      })
    }

    return { data: history }
  }

  private getAuthorityForRegion(region: string): string {
    const regionAuthorities: Record<string, string> = {
      EU: 'EMA',
      US: 'FDA',
      UK: 'MHRA',
      CH: 'Swissmedic',
      DE: 'BfArM',
      JP: 'PMDA',
      CA: 'Health Canada',
      AU: 'TGA',
    }
    return regionAuthorities[region] || 'Unknown'
  }
}

/**
 * Substance Regional Status API
 *
 * Provides regional authorization status for substances (by INN).
 */
@ApiTags('Regional Status')
@Controller('substances/:slug/regional-status')
export class SubstanceRegionalStatusController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({
    summary: 'Get regional authorization status for a substance (INN)',
    description: 'Returns aggregated authorization status across regions for products containing this substance',
  })
  @ApiParam({ name: 'slug', description: 'Substance slug' })
  @ApiResponse({
    status: 200,
    description: 'Regional authorization status for the substance',
    schema: {
      type: 'object',
      properties: {
        substance: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            inn: { type: 'string' },
          },
        },
        regions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              region: { type: 'string' },
              status: { type: 'string' },
              brandNames: {
                type: 'array',
                items: { type: 'string' },
              },
              productCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Substance not found' })
  async getSubstanceRegionalStatus(@Param('slug') slug: string) {
    // Find the substance
    const [substance] = await this.db
      .select({
        id: substances.id,
        slug: substances.slug,
        innName: substances.innName,
      })
      .from(substances)
      .where(eq(substances.slug, slug))
      .limit(1)

    if (!substance) {
      throw new NotFoundException(`Substance with slug "${slug}" not found`)
    }

    // Get authorizations for this substance (direct or via INN)
    const directAuthorizations = await this.db
      .select()
      .from(regionalAuthorizations)
      .where(eq(regionalAuthorizations.substanceId, substance.id))

    // Also get authorizations via INN match
    const innAuthorizations = await this.db
      .select()
      .from(regionalAuthorizations)
      .where(eq(regionalAuthorizations.inn, substance.innName.toLowerCase()))

    // Merge authorizations (prefer direct matches)
    const allAuthorizations = [...directAuthorizations]
    for (const auth of innAuthorizations) {
      const exists = allAuthorizations.some(
        a => a.region === auth.region && a.productId === auth.productId
      )
      if (!exists) {
        allAuthorizations.push(auth)
      }
    }

    // Aggregate by region
    const regionData = new Map<string, {
      status: string
      brandNames: Set<string>
      productCount: number
      authority: string
    }>()

    for (const auth of allAuthorizations) {
      const existing = regionData.get(auth.region)
      if (existing) {
        if (auth.brandName) existing.brandNames.add(auth.brandName)
        existing.productCount++
        // Upgrade status if authorized
        if (auth.status === 'authorized') existing.status = 'authorized'
      } else {
        regionData.set(auth.region, {
          status: auth.status,
          brandNames: auth.brandName ? new Set([auth.brandName]) : new Set(),
          productCount: 1,
          authority: auth.authority,
        })
      }
    }

    // Convert to response format
    const regions = Array.from(regionData.entries()).map(([region, data]) => ({
      region,
      authority: data.authority,
      status: data.status,
      brandNames: Array.from(data.brandNames),
      productCount: data.productCount,
    }))

    return {
      substance: {
        slug: substance.slug,
        inn: substance.innName,
      },
      regions,
    }
  }
}

/**
 * INN Regional Status API
 *
 * Alternative endpoint using INN directly instead of substance slug.
 */
@ApiTags('Regional Status')
@Controller('inn/:inn/regional-status')
export class InnRegionalStatusController {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  @ApiOperation({
    summary: 'Get regional authorization status by INN',
    description: 'Query regional status directly by International Nonproprietary Name',
  })
  @ApiParam({ name: 'inn', description: 'International Nonproprietary Name' })
  @ApiResponse({ status: 200, description: 'Regional authorization status' })
  async getInnRegionalStatus(@Param('inn') inn: string) {
    const normalizedInn = inn.toLowerCase().trim()

    // Get all authorizations matching this INN
    const authorizations = await this.db
      .select()
      .from(regionalAuthorizations)
      .where(eq(regionalAuthorizations.inn, normalizedInn))

    if (authorizations.length === 0) {
      // Check if INN exists in substances table
      const [substance] = await this.db
        .select({ innName: substances.innName })
        .from(substances)
        .where(eq(substances.innName, inn))
        .limit(1)

      return {
        inn: substance?.innName || inn,
        regions: [],
        message: 'No regional authorization data available for this INN',
      }
    }

    // Aggregate by region
    const regionData = new Map<string, {
      status: string
      brandNames: Set<string>
      productCount: number
      authority: string
      authorizationDates: string[]
    }>()

    for (const auth of authorizations) {
      const existing = regionData.get(auth.region)
      if (existing) {
        if (auth.brandName) existing.brandNames.add(auth.brandName)
        if (auth.authorizationDate) existing.authorizationDates.push(auth.authorizationDate)
        existing.productCount++
        if (auth.status === 'authorized') existing.status = 'authorized'
      } else {
        regionData.set(auth.region, {
          status: auth.status,
          brandNames: auth.brandName ? new Set([auth.brandName]) : new Set(),
          productCount: 1,
          authority: auth.authority,
          authorizationDates: auth.authorizationDate ? [auth.authorizationDate] : [],
        })
      }
    }

    const regions = Array.from(regionData.entries()).map(([region, data]) => ({
      region,
      authority: data.authority,
      status: data.status,
      brandNames: Array.from(data.brandNames),
      productCount: data.productCount,
      earliestAuthorization: data.authorizationDates.length > 0
        ? data.authorizationDates.sort()[0]
        : null,
    }))

    return {
      inn: authorizations[0]?.inn || inn,
      regions,
    }
  }
}
