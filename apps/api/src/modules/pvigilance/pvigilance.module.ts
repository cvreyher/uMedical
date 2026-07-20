import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'

// Application Services
import { EventNormalizerService } from './application/services/event-normalizer.service'
import { EntityLinkerService } from './application/services/entity-linker.service'
import { FeedProcessorService } from './application/services/feed-processor.service'
import { FeedSchedulerService } from './application/services/feed-scheduler.service'

// Infrastructure - Parsers
import { RssParser } from './infrastructure/parsers/rss-parser'
import { FdaApiParser } from './infrastructure/parsers/fda-api-parser'
import { MhraApiParser } from './infrastructure/parsers/mhra-api-parser'

// Presentation - Controllers
import {
  PvigilanceEventsController,
  ProductPvigilanceController,
  SubstancePvigilanceController,
} from './presentation/controllers/events.controller'
import { PvigilanceFeedsAdminController } from './presentation/controllers/feeds-admin.controller'
import {
  ProductRegionalStatusController,
  SubstanceRegionalStatusController,
  InnRegionalStatusController,
} from './presentation/controllers/regional-status.controller'

/**
 * Pharmacovigilance Module
 *
 * Multi-source pharmacovigilance event aggregation system.
 * Collects safety events from FDA, MHRA, Swissmedic, BfArM, EMA, and WHO.
 *
 * Features:
 * - RSS and API feed parsing
 * - Event normalization and deduplication
 * - Entity linking (products and substances via INN)
 * - Scheduled feed polling with backoff
 * - Regional authorization tracking
 *
 * API Routes:
 *
 * Public Events API:
 * - GET /api/pvigilance/events - List events with filtering
 * - GET /api/pvigilance/events/stats - Event statistics
 * - GET /api/pvigilance/events/:slug - Event details
 * - GET /api/products/:slug/pvigilance/events - Events for a product
 * - GET /api/substances/:slug/pvigilance/events - Events for a substance
 *
 * Regional Status API:
 * - GET /api/products/:slug/regional-status - Product authorization map
 * - GET /api/products/:slug/regional-status/history - Authorization history
 * - GET /api/substances/:slug/regional-status - Substance authorization map
 * - GET /api/inn/:inn/regional-status - Query by INN directly
 *
 * Admin API:
 * - GET /api/admin/pvigilance/feeds - List all feed sources
 * - GET /api/admin/pvigilance/feeds/stats - Feed health summary
 * - GET /api/admin/pvigilance/feeds/:slug - Feed details with logs
 * - GET /api/admin/pvigilance/feeds/:slug/logs - Paginated fetch logs
 * - POST /api/admin/pvigilance/feeds/:slug/enable - Enable a feed
 * - POST /api/admin/pvigilance/feeds/:slug/disable - Disable a feed
 * - POST /api/admin/pvigilance/feeds/:slug/fetch - Trigger immediate fetch
 * - POST /api/admin/pvigilance/feeds/:slug/reset - Reset feed health
 *
 * Data Sources:
 * - FDA Enforcement API (drug recalls)
 * - FDA Drug Recalls RSS
 * - FDA MedWatch Safety Alerts RSS
 * - MHRA Drug Safety Updates API
 * - Swissmedic HPC Letters RSS
 * - BfArM Rote-Hand-Briefe RSS
 * - EMA Safety Signals RSS
 */
@Module({
  imports: [
    // Required for @Cron decorator in FeedSchedulerService
    ScheduleModule.forRoot(),
  ],
  controllers: [
    // Public Events API
    PvigilanceEventsController,
    ProductPvigilanceController,
    SubstancePvigilanceController,
    // Regional Status API
    ProductRegionalStatusController,
    SubstanceRegionalStatusController,
    InnRegionalStatusController,
    // Admin API
    PvigilanceFeedsAdminController,
  ],
  providers: [
    // Application Services
    EventNormalizerService,
    EntityLinkerService,
    FeedProcessorService,
    FeedSchedulerService,
    // Infrastructure - Parsers
    RssParser,
    FdaApiParser,
    MhraApiParser,
  ],
  exports: [
    // Export services for use by other modules
    EventNormalizerService,
    EntityLinkerService,
    FeedProcessorService,
    FeedSchedulerService,
  ],
})
export class PvigilanceModule {}
