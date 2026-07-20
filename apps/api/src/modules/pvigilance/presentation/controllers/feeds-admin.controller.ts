import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Inject,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger'
import { pvigilanceFeedSources, pvigilanceFeedLogs } from '@workspace/database'
import { eq, desc, count, and, gte, sql } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'
import { FeedSchedulerService } from '../../application/services/feed-scheduler.service'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

/**
 * Pharmacovigilance Feeds Admin API
 *
 * Administrative endpoints for managing feed sources.
 */
@ApiTags('Admin - Pvigilance Feeds')
@Controller('admin/pvigilance/feeds')
export class PvigilanceFeedsAdminController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
    private readonly feedScheduler: FeedSchedulerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all feed sources' })
  @ApiResponse({ status: 200, description: 'List of all configured feed sources' })
  async findAll() {
    const feeds = await this.db
      .select()
      .from(pvigilanceFeedSources)
      .orderBy(pvigilanceFeedSources.authority, pvigilanceFeedSources.name)

    return { data: feeds }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get feed health summary' })
  @ApiResponse({ status: 200, description: 'Summary of feed health and statistics' })
  async getStats() {
    const [totalResult] = await this.db.select({ count: count() }).from(pvigilanceFeedSources)

    const [enabledResult] = await this.db
      .select({ count: count() })
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.isEnabled, true))

    const [healthyResult] = await this.db
      .select({ count: count() })
      .from(pvigilanceFeedSources)
      .where(and(eq(pvigilanceFeedSources.isEnabled, true), eq(pvigilanceFeedSources.isHealthy, true)))

    // Get feeds with recent failures
    const unhealthyFeeds = await this.db
      .select({
        slug: pvigilanceFeedSources.slug,
        name: pvigilanceFeedSources.name,
        consecutiveFailures: pvigilanceFeedSources.consecutiveFailures,
        lastError: pvigilanceFeedSources.lastError,
      })
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.isHealthy, false))

    // Get recent fetch activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentLogs = await this.db
      .select({
        status: pvigilanceFeedLogs.status,
        count: count(),
      })
      .from(pvigilanceFeedLogs)
      .where(gte(pvigilanceFeedLogs.fetchedAt, yesterday))
      .groupBy(pvigilanceFeedLogs.status)

    // By authority
    const byAuthority = await this.db
      .select({
        authority: pvigilanceFeedSources.authority,
        count: count(),
      })
      .from(pvigilanceFeedSources)
      .groupBy(pvigilanceFeedSources.authority)

    return {
      total: totalResult?.count ?? 0,
      enabled: enabledResult?.count ?? 0,
      healthy: healthyResult?.count ?? 0,
      unhealthy: unhealthyFeeds,
      byAuthority: byAuthority.reduce(
        (acc, { authority, count }) => ({ ...acc, [authority]: count }),
        {} as Record<string, number>,
      ),
      recentActivity: {
        last24Hours: recentLogs.reduce(
          (acc, { status, count }) => ({ ...acc, [status]: count }),
          {} as Record<string, number>,
        ),
      },
    }
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get feed source details' })
  @ApiParam({ name: 'slug', description: 'Feed source slug' })
  @ApiResponse({ status: 200, description: 'Feed source details with recent logs' })
  @ApiResponse({ status: 404, description: 'Feed source not found' })
  async findOne(@Param('slug') slug: string) {
    const [feed] = await this.db
      .select()
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.slug, slug))
      .limit(1)

    if (!feed) {
      throw new NotFoundException(`Feed source with slug "${slug}" not found`)
    }

    // Get recent logs
    const recentLogs = await this.db
      .select()
      .from(pvigilanceFeedLogs)
      .where(eq(pvigilanceFeedLogs.feedSourceId, feed.id))
      .orderBy(desc(pvigilanceFeedLogs.fetchedAt))
      .limit(20)

    // Calculate success rate
    const [successCount] = await this.db
      .select({ count: count() })
      .from(pvigilanceFeedLogs)
      .where(
        and(
          eq(pvigilanceFeedLogs.feedSourceId, feed.id),
          eq(pvigilanceFeedLogs.status, 'success'),
        ),
      )

    const [totalLogs] = await this.db
      .select({ count: count() })
      .from(pvigilanceFeedLogs)
      .where(eq(pvigilanceFeedLogs.feedSourceId, feed.id))

    const successRate = (totalLogs?.count ?? 0) > 0
      ? ((successCount?.count ?? 0) / (totalLogs?.count ?? 1)) * 100
      : 0

    return {
      ...feed,
      recentLogs,
      statistics: {
        totalFetches: totalLogs?.count ?? 0,
        successRate: Math.round(successRate * 100) / 100,
      },
    }
  }

  @Get(':slug/logs')
  @ApiOperation({ summary: 'Get feed fetch logs' })
  @ApiParam({ name: 'slug', description: 'Feed source slug' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated fetch logs' })
  async getLogs(
    @Param('slug') slug: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const [feed] = await this.db
      .select({ id: pvigilanceFeedSources.id })
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.slug, slug))
      .limit(1)

    if (!feed) {
      throw new NotFoundException(`Feed source with slug "${slug}" not found`)
    }

    const offset = (Math.max(1, page) - 1) * Math.min(100, limit)
    const effectiveLimit = Math.min(100, limit)

    const [logs, [countResult]] = await Promise.all([
      this.db
        .select()
        .from(pvigilanceFeedLogs)
        .where(eq(pvigilanceFeedLogs.feedSourceId, feed.id))
        .orderBy(desc(pvigilanceFeedLogs.fetchedAt))
        .limit(effectiveLimit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(pvigilanceFeedLogs)
        .where(eq(pvigilanceFeedLogs.feedSourceId, feed.id)),
    ])

    return {
      data: logs,
      meta: {
        page: Math.max(1, page),
        limit: effectiveLimit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / effectiveLimit),
      },
    }
  }

  @Post(':slug/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable a feed source' })
  @ApiParam({ name: 'slug', description: 'Feed source slug' })
  @ApiResponse({ status: 200, description: 'Feed source enabled' })
  @ApiResponse({ status: 404, description: 'Feed source not found' })
  async enableFeed(@Param('slug') slug: string) {
    const [feed] = await this.db
      .select({ id: pvigilanceFeedSources.id })
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.slug, slug))
      .limit(1)

    if (!feed) {
      throw new NotFoundException(`Feed source with slug "${slug}" not found`)
    }

    await this.db
      .update(pvigilanceFeedSources)
      .set({ isEnabled: true, updatedAt: new Date() })
      .where(eq(pvigilanceFeedSources.id, feed.id))

    return { message: `Feed "${slug}" has been enabled` }
  }

  @Post(':slug/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a feed source' })
  @ApiParam({ name: 'slug', description: 'Feed source slug' })
  @ApiResponse({ status: 200, description: 'Feed source disabled' })
  @ApiResponse({ status: 404, description: 'Feed source not found' })
  async disableFeed(@Param('slug') slug: string) {
    const [feed] = await this.db
      .select({ id: pvigilanceFeedSources.id })
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.slug, slug))
      .limit(1)

    if (!feed) {
      throw new NotFoundException(`Feed source with slug "${slug}" not found`)
    }

    await this.db
      .update(pvigilanceFeedSources)
      .set({ isEnabled: false, updatedAt: new Date() })
      .where(eq(pvigilanceFeedSources.id, feed.id))

    return { message: `Feed "${slug}" has been disabled` }
  }

  @Post(':slug/fetch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger immediate fetch for a feed' })
  @ApiParam({ name: 'slug', description: 'Feed source slug' })
  @ApiResponse({ status: 200, description: 'Fetch triggered successfully' })
  @ApiResponse({ status: 404, description: 'Feed source not found' })
  async triggerFetch(@Param('slug') slug: string) {
    const [feed] = await this.db
      .select()
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.slug, slug))
      .limit(1)

    if (!feed) {
      throw new NotFoundException(`Feed source with slug "${slug}" not found`)
    }

    // Trigger the feed processing
    await this.feedScheduler.triggerFeed(slug)

    // Get the latest log
    const [latestLog] = await this.db
      .select()
      .from(pvigilanceFeedLogs)
      .where(eq(pvigilanceFeedLogs.feedSourceId, feed.id))
      .orderBy(desc(pvigilanceFeedLogs.fetchedAt))
      .limit(1)

    return {
      message: `Fetch triggered for feed "${slug}"`,
      result: latestLog,
    }
  }

  @Post(':slug/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset feed health status' })
  @ApiParam({ name: 'slug', description: 'Feed source slug' })
  @ApiResponse({ status: 200, description: 'Feed health reset' })
  @ApiResponse({ status: 404, description: 'Feed source not found' })
  async resetFeedHealth(@Param('slug') slug: string) {
    const [feed] = await this.db
      .select({ id: pvigilanceFeedSources.id })
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.slug, slug))
      .limit(1)

    if (!feed) {
      throw new NotFoundException(`Feed source with slug "${slug}" not found`)
    }

    await this.db
      .update(pvigilanceFeedSources)
      .set({
        isHealthy: true,
        consecutiveFailures: 0,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(pvigilanceFeedSources.id, feed.id))

    return { message: `Feed "${slug}" health has been reset` }
  }
}
