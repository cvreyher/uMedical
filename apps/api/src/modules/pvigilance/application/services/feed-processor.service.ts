import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  pvigilanceFeedSources,
  pvigilanceFeedLogs,
  pvigilanceEvents,
} from '@workspace/database'
import { eq, sql } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'
import { EventNormalizerService, type NormalizedEvent, type RawFeedEvent } from './event-normalizer.service'
import { EntityLinkerService } from './entity-linker.service'
import { RssParser } from '../../infrastructure/parsers/rss-parser'
import { FdaApiParser } from '../../infrastructure/parsers/fda-api-parser'
import { MhraApiParser } from '../../infrastructure/parsers/mhra-api-parser'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'
import type { PvigilanceFeedSource } from '@workspace/database'

/**
 * Result of processing a feed
 */
export interface FeedProcessResult {
  feedSourceId: number
  feedSlug: string
  status: 'success' | 'failed' | 'partial'
  durationMs: number
  itemsFetched: number
  itemsCreated: number
  itemsUpdated: number
  itemsSkipped: number
  errorMessage?: string
}

/**
 * Feed Processor Service
 *
 * Orchestrates the fetching, parsing, normalizing, and storing of
 * pharmacovigilance events from external feeds.
 */
@Injectable()
export class FeedProcessorService {
  private readonly logger = new Logger(FeedProcessorService.name)

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
    private readonly eventNormalizer: EventNormalizerService,
    private readonly entityLinker: EntityLinkerService,
    private readonly rssParser: RssParser,
    private readonly fdaApiParser: FdaApiParser,
    private readonly mhraApiParser: MhraApiParser,
  ) {}

  /**
   * Process a single feed source
   */
  async processFeed(feedSource: PvigilanceFeedSource): Promise<FeedProcessResult> {
    const startTime = Date.now()
    const result: FeedProcessResult = {
      feedSourceId: feedSource.id,
      feedSlug: feedSource.slug,
      status: 'success',
      durationMs: 0,
      itemsFetched: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
    }

    try {
      this.logger.log(`Processing feed: ${feedSource.slug}`)

      // 1. Fetch raw events from source
      const rawEvents = await this.fetchRawEvents(feedSource)
      result.itemsFetched = rawEvents.length

      this.logger.log(`Fetched ${rawEvents.length} events from ${feedSource.slug}`)

      // 2. Process each event
      for (const raw of rawEvents) {
        try {
          const processed = await this.processEvent(raw, feedSource)
          if (processed.created) {
            result.itemsCreated++
          } else if (processed.updated) {
            result.itemsUpdated++
          } else {
            result.itemsSkipped++
          }
        } catch (error) {
          this.logger.warn(`Failed to process event: ${error}`)
          result.itemsSkipped++
        }
      }

      // 3. Update feed source status
      await this.updateFeedSourceSuccess(feedSource.id)

    } catch (error) {
      result.status = 'failed'
      result.errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Feed processing failed: ${feedSource.slug}`, error)

      await this.updateFeedSourceError(feedSource.id, result.errorMessage)
    }

    result.durationMs = Date.now() - startTime

    // Log the fetch result
    await this.logFetchResult(result)

    return result
  }

  /**
   * Fetch raw events from the feed source
   */
  private async fetchRawEvents(feedSource: PvigilanceFeedSource): Promise<RawFeedEvent[]> {
    const config = feedSource.feedConfig ?? undefined

    switch (feedSource.feedType) {
      case 'rss':
        return this.rssParser.parse(feedSource.feedUrl, config)

      case 'api':
        if (feedSource.authority === 'FDA') {
          return this.fdaApiParser.parse(feedSource.feedUrl, config)
        }
        if (feedSource.authority === 'MHRA') {
          return this.mhraApiParser.parse(feedSource.feedUrl, config)
        }
        throw new Error(`Unknown API authority: ${feedSource.authority}`)

      case 'scraper':
        // Scraper implementation would go here
        throw new Error('Scraper feed type not yet implemented')

      default:
        throw new Error(`Unknown feed type: ${feedSource.feedType}`)
    }
  }

  /**
   * Process a single raw event
   */
  private async processEvent(
    raw: RawFeedEvent,
    feedSource: PvigilanceFeedSource,
  ): Promise<{ created: boolean; updated: boolean; eventId?: number }> {
    // 1. Normalize the event
    const normalized = this.normalizeEvent(raw, feedSource)

    // 2. Check for existing event by slug or content hash
    const existing = await this.findExistingEvent(normalized)

    let eventId: number
    let created = false
    let updated = false

    if (existing) {
      // Update existing event if content changed
      if (existing.contentHash !== normalized.contentHash) {
        await this.db
          .update(pvigilanceEvents)
          .set({
            title: normalized.title,
            description: normalized.description,
            eventData: normalized.eventData,
            contentHash: normalized.contentHash,
            updatedAt: new Date(),
          })
          .where(eq(pvigilanceEvents.id, existing.id))

        eventId = existing.id
        updated = true
      } else {
        // No changes, skip
        return { created: false, updated: false, eventId: existing.id }
      }
    } else {
      // Create new event
      const [inserted] = await this.db
        .insert(pvigilanceEvents)
        .values({
          ...normalized,
          sourceFeedId: feedSource.id,
        })
        .returning({ id: pvigilanceEvents.id })

      eventId = inserted!.id
      created = true
    }

    // 3. Link to entities (only for new or updated events)
    if (created || updated) {
      await this.linkToEntities(eventId, normalized)
    }

    return { created, updated, eventId }
  }

  /**
   * Normalize event based on source authority
   */
  private normalizeEvent(raw: RawFeedEvent, feedSource: PvigilanceFeedSource): NormalizedEvent {
    switch (feedSource.authority) {
      case 'FDA':
        return this.eventNormalizer.normalizeFdaEvent(raw, feedSource.slug)
      case 'MHRA':
        return this.eventNormalizer.normalizeMhraEvent(raw, feedSource.slug)
      case 'Swissmedic':
        return this.eventNormalizer.normalizeSwissmedicEvent(raw, feedSource.slug)
      case 'BfArM':
        return this.eventNormalizer.normalizeBfarmEvent(raw, feedSource.slug)
      case 'EMA':
        return this.eventNormalizer.normalizeEmaEvent(raw, feedSource.slug)
      default:
        return this.eventNormalizer.normalizeGenericEvent(
          raw,
          feedSource.authority,
          feedSource.region,
        )
    }
  }

  /**
   * Find existing event by slug or content hash
   */
  private async findExistingEvent(normalized: NormalizedEvent) {
    const [existing] = await this.db
      .select({
        id: pvigilanceEvents.id,
        contentHash: pvigilanceEvents.contentHash,
      })
      .from(pvigilanceEvents)
      .where(eq(pvigilanceEvents.slug, normalized.slug))
      .limit(1)

    return existing
  }

  /**
   * Link event to entities (products and substances)
   */
  private async linkToEntities(eventId: number, normalized: NormalizedEvent): Promise<void> {
    try {
      // Extract drug names from event content
      const drugNames = this.entityLinker.extractDrugNames(
        normalized.title,
        normalized.description,
      )

      if (drugNames.length === 0) {
        return
      }

      // Find matching substances
      const matchedSubstances = await this.entityLinker.findMatchingSubstances(drugNames)

      // Find matching products
      const matchedProducts = await this.entityLinker.findMatchingProducts(
        matchedSubstances,
        drugNames,
      )

      // Create links
      const { substanceLinks, productLinks } = await this.entityLinker.linkEventToEntities(
        eventId,
        matchedSubstances,
        matchedProducts,
        drugNames,
      )

      this.logger.debug(
        `Linked event ${eventId}: ${substanceLinks} substances, ${productLinks} products`,
      )
    } catch (error) {
      this.logger.warn(`Failed to link event ${eventId} to entities: ${error}`)
    }
  }

  /**
   * Update feed source on successful fetch
   */
  private async updateFeedSourceSuccess(feedSourceId: number): Promise<void> {
    await this.db
      .update(pvigilanceFeedSources)
      .set({
        lastFetchedAt: new Date(),
        lastSuccessAt: new Date(),
        isHealthy: true,
        consecutiveFailures: 0,
        lastError: null,
        totalFetches: sql`${pvigilanceFeedSources.totalFetches} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(pvigilanceFeedSources.id, feedSourceId))
  }

  /**
   * Update feed source on error
   */
  private async updateFeedSourceError(feedSourceId: number, errorMessage: string): Promise<void> {
    // First get current consecutive failures
    const [current] = await this.db
      .select({ consecutiveFailures: pvigilanceFeedSources.consecutiveFailures })
      .from(pvigilanceFeedSources)
      .where(eq(pvigilanceFeedSources.id, feedSourceId))
      .limit(1)

    const newFailures = (current?.consecutiveFailures || 0) + 1

    await this.db
      .update(pvigilanceFeedSources)
      .set({
        lastFetchedAt: new Date(),
        lastError: errorMessage,
        consecutiveFailures: newFailures,
        isHealthy: newFailures < 3, // Mark unhealthy after 3 consecutive failures
        totalFetches: sql`${pvigilanceFeedSources.totalFetches} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(pvigilanceFeedSources.id, feedSourceId))
  }

  /**
   * Log the fetch result
   */
  private async logFetchResult(result: FeedProcessResult): Promise<void> {
    await this.db.insert(pvigilanceFeedLogs).values({
      feedSourceId: result.feedSourceId,
      status: result.status,
      durationMs: result.durationMs,
      itemsFetched: result.itemsFetched,
      itemsCreated: result.itemsCreated,
      itemsUpdated: result.itemsUpdated,
      itemsSkipped: result.itemsSkipped,
      errorMessage: result.errorMessage,
    })
  }
}
