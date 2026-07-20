import { Inject, Injectable, Logger } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { pvigilanceFeedSources } from '@workspace/database'
import { eq, and, lte, or, isNull, sql } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'
import { FeedProcessorService } from './feed-processor.service'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'
import type { PvigilanceFeedSource } from '@workspace/database'

/**
 * Feed Scheduler Service
 *
 * Manages scheduled polling of pharmacovigilance feeds.
 * Uses NestJS @nestjs/schedule for cron-based execution.
 *
 * Scheduling:
 * - Runs every 5 minutes to check for feeds due for polling
 * - Respects each feed's individual pollIntervalMinutes setting
 * - Implements backoff for unhealthy feeds
 */
@Injectable()
export class FeedSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(FeedSchedulerService.name)
  private isProcessing = false
  private readonly liveFetchEnabled: boolean

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
    private readonly feedProcessor: FeedProcessorService,
    configService: ConfigService,
  ) {
    this.liveFetchEnabled = configService.get<boolean>('LIVE_FETCH_ENABLED') ?? true
  }

  /**
   * Initialize: seed default feeds if needed
   * Gracefully handles missing tables (run migration first)
   */
  async onModuleInit(): Promise<void> {
    if (!this.liveFetchEnabled) {
      this.logger.warn(
        'Live feed polling is DISABLED (LIVE_FETCH_ENABLED=false) - no external APIs will be called in the background',
      )
    }

    try {
      await this.seedDefaultFeeds()
      this.logger.log('Feed scheduler initialized')
    } catch (error) {
      // Table might not exist yet - this is OK, just log and continue
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        this.logger.warn('Pvigilance tables not found - skipping feed seeding. Run migration to enable.')
      } else {
        this.logger.error('Failed to initialize feed scheduler', error)
      }
    }
  }

  /**
   * Cron job: Check and process feeds every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollFeeds(): Promise<void> {
    if (!this.liveFetchEnabled) {
      return
    }

    if (this.isProcessing) {
      this.logger.debug('Feed processing already in progress, skipping')
      return
    }

    this.isProcessing = true

    try {
      const dueFeeds = await this.findDueFeeds()

      if (dueFeeds.length === 0) {
        this.logger.debug('No feeds due for processing')
        return
      }

      this.logger.log(`Processing ${dueFeeds.length} due feeds`)

      for (const feed of dueFeeds) {
        try {
          const result = await this.feedProcessor.processFeed(feed)
          this.logger.log(
            `Processed ${feed.slug}: ${result.itemsCreated} created, ${result.itemsUpdated} updated`,
          )
        } catch (error) {
          this.logger.error(`Failed to process feed ${feed.slug}`, error)
        }
      }
    } catch (error) {
      // Table might not exist - silently skip
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('does not exist') && !errorMessage.includes('relation')) {
        this.logger.error('Feed polling error', error)
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Manually trigger a specific feed
   */
  async triggerFeed(feedSlug: string): Promise<void> {
    const [feed] = await this.db
      .select()
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.slug, feedSlug))
      .limit(1)

    if (!feed) {
      throw new Error(`Feed not found: ${feedSlug}`)
    }

    await this.feedProcessor.processFeed(feed)
  }

  /**
   * Find feeds that are due for polling
   */
  private async findDueFeeds(): Promise<PvigilanceFeedSource[]> {
    const now = new Date()

    // Find enabled feeds where:
    // - Never fetched (lastFetchedAt is null)
    // - OR last fetched more than pollIntervalMinutes ago
    const feeds = await this.db
      .select()
      .from(pvigilanceFeedSources)
      .where(
        and(
          eq(pvigilanceFeedSources.isEnabled, true),
          or(
            isNull(pvigilanceFeedSources.lastFetchedAt),
            sql`${pvigilanceFeedSources.lastFetchedAt} < NOW() - (${pvigilanceFeedSources.pollIntervalMinutes} * INTERVAL '1 minute')`
          )
        )
      )

    // Apply backoff for unhealthy feeds
    return feeds.filter(feed => {
      if (feed.isHealthy) return true

      // Backoff: double the interval for each consecutive failure
      const backoffMultiplier = Math.pow(2, feed.consecutiveFailures)
      const effectiveInterval = feed.pollIntervalMinutes * backoffMultiplier

      if (feed.lastFetchedAt) {
        const nextFetch = new Date(feed.lastFetchedAt.getTime() + effectiveInterval * 60 * 1000)
        return now >= nextFetch
      }

      return true
    })
  }

  /**
   * Seed default feed sources
   */
  private async seedDefaultFeeds(): Promise<void> {
    const defaultFeeds: Omit<PvigilanceFeedSource, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // FDA Feeds
      {
        name: 'FDA Drug Enforcement',
        slug: 'fda-enforcement',
        authority: 'FDA',
        region: 'US',
        feedType: 'api',
        feedUrl: 'https://api.fda.gov/drug/enforcement.json',
        feedConfig: {
          queryParams: {
            limit: '100',
            sort: 'report_date:desc',
          },
        },
        isEnabled: true,
        isHealthy: true,
        pollIntervalMinutes: 60,
        lastFetchedAt: null,
        lastSuccessAt: null,
        lastError: null,
        consecutiveFailures: 0,
        totalFetches: 0,
        totalItemsProcessed: 0,
      },
      {
        name: 'FDA Drug Recalls RSS',
        slug: 'fda-drug-recalls',
        authority: 'FDA',
        region: 'US',
        feedType: 'rss',
        feedUrl: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drug-recalls/rss.xml',
        feedConfig: {},
        isEnabled: true,
        isHealthy: true,
        pollIntervalMinutes: 30,
        lastFetchedAt: null,
        lastSuccessAt: null,
        lastError: null,
        consecutiveFailures: 0,
        totalFetches: 0,
        totalItemsProcessed: 0,
      },
      {
        name: 'FDA MedWatch Safety Alerts',
        slug: 'fda-medwatch',
        authority: 'FDA',
        region: 'US',
        feedType: 'rss',
        feedUrl: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch-safety-alerts-human-medical-products/rss.xml',
        feedConfig: {},
        isEnabled: true,
        isHealthy: true,
        pollIntervalMinutes: 30,
        lastFetchedAt: null,
        lastSuccessAt: null,
        lastError: null,
        consecutiveFailures: 0,
        totalFetches: 0,
        totalItemsProcessed: 0,
      },
      // MHRA Feed
      {
        name: 'MHRA Drug Safety Updates',
        slug: 'mhra-drug-safety',
        authority: 'MHRA',
        region: 'UK',
        feedType: 'api',
        feedUrl: 'https://www.gov.uk/api/content',
        feedConfig: {
          queryParams: {
            filter_organisations: 'medicines-and-healthcare-products-regulatory-agency',
            filter_content_purpose_supergroup: 'guidance_and_regulation',
          },
        },
        isEnabled: true,
        isHealthy: true,
        pollIntervalMinutes: 120,
        lastFetchedAt: null,
        lastSuccessAt: null,
        lastError: null,
        consecutiveFailures: 0,
        totalFetches: 0,
        totalItemsProcessed: 0,
      },
      // Swissmedic Feed
      {
        name: 'Swissmedic HPC Letters',
        slug: 'swissmedic-hpc',
        authority: 'Swissmedic',
        region: 'CH',
        feedType: 'rss',
        feedUrl: 'https://www.swissmedic.ch/swissmedic/de/home/humanarzneimittel/marktueberwachung/health-professional-communication--hpc-/mitteilungen.rss.xml',
        feedConfig: {},
        isEnabled: true,
        isHealthy: true,
        pollIntervalMinutes: 120,
        lastFetchedAt: null,
        lastSuccessAt: null,
        lastError: null,
        consecutiveFailures: 0,
        totalFetches: 0,
        totalItemsProcessed: 0,
      },
      // BfArM Feed
      {
        name: 'BfArM Rote-Hand-Briefe',
        slug: 'bfarm-rote-hand',
        authority: 'BfArM',
        region: 'DE',
        feedType: 'rss',
        feedUrl: 'https://www.bfarm.de/SiteGlobals/Functions/RSSFeed/DE/RoteHandBriefe.xml',
        feedConfig: {},
        isEnabled: true,
        isHealthy: true,
        pollIntervalMinutes: 120,
        lastFetchedAt: null,
        lastSuccessAt: null,
        lastError: null,
        consecutiveFailures: 0,
        totalFetches: 0,
        totalItemsProcessed: 0,
      },
      // EMA Feed
      {
        name: 'EMA Safety Signals',
        slug: 'ema-safety-signals',
        authority: 'EMA',
        region: 'EU',
        feedType: 'rss',
        feedUrl: 'https://www.ema.europa.eu/en/rss/prac-recommendations-safety-signals.xml',
        feedConfig: {},
        isEnabled: true,
        isHealthy: true,
        pollIntervalMinutes: 60,
        lastFetchedAt: null,
        lastSuccessAt: null,
        lastError: null,
        consecutiveFailures: 0,
        totalFetches: 0,
        totalItemsProcessed: 0,
      },
    ]

    for (const feed of defaultFeeds) {
      // Check if feed already exists
      const [existing] = await this.db
        .select({ id: pvigilanceFeedSources.id })
        .from(pvigilanceFeedSources)
        .where(eq(pvigilanceFeedSources.slug, feed.slug))
        .limit(1)

      if (!existing) {
        await this.db.insert(pvigilanceFeedSources).values(feed)
        this.logger.log(`Seeded feed: ${feed.slug}`)
      }
    }
  }
}
