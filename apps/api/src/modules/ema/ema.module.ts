import { Module } from '@nestjs/common'

import { EmaImportService } from './application/services/ema-import.service'
import { EmaImportExtendedService } from './application/services/ema-import-extended.service'
import { EmaShortagesImportService } from './application/services/ema-shortages-import.service'
import { EmaApiClient } from './infrastructure/clients/ema-api.client'
import { EmaImportController } from './presentation/controllers/ema-import.controller'
import {
  MedicinesController,
  TimelineEventsController,
  SubstancesController,
  CompaniesController,
  ImportLogsController,
  EmaSourcesController,
} from './presentation/controllers/medicines.controller'
import {
  ProductStatisticsController,
  TherapeuticStatisticsController,
  CompanyStatisticsController,
  SubstanceStatisticsController,
  RegulatoryStatisticsController,
  SafetyStatisticsController,
  DataQualityStatisticsController,
  NewsStatisticsController,
  AdvancedAnalyticsController,
} from './presentation/controllers/statistics.controller'

/**
 * EMA Module - European Medicines Agency data integration
 *
 * Features:
 * - Full EMA data import with all 50+ fields
 * - Timeline events (Northdata-style) for regulatory changes
 * - Companies, substances, categories tracking
 * - Source provenance and change detection
 * - Comprehensive statistics & analytics API
 *
 * Data Sources:
 * - EMA Medicines JSON
 * - EMA Shortages JSON ✓
 * - EMA Documents (EPAR/Non-EPAR) - planned
 * - EMA Referrals - planned
 * - EMA News - planned
 *
 * API Routes:
 *
 * Frontend (Public):
 * - GET /api/medicines - List medicines with filtering
 * - GET /api/medicines/stats - Medicine statistics
 * - GET /api/medicines/:slug - Medicine details with timeline
 * - GET /api/medicines/:slug/timeline - Medicine timeline events
 * - GET /api/events - List all timeline events
 * - GET /api/events/recent - Recent events with medicine info
 * - GET /api/events/stats - Event statistics
 * - GET /api/events/:id - Event details
 * - GET /api/substances - List substances
 * - GET /api/substances/:slug - Substance with medicines
 * - GET /api/companies - List companies
 * - GET /api/companies/:slug - Company with medicines
 *
 * Statistics API:
 * - GET /api/statistics/products/* - Product overview, status, designations, approvals
 * - GET /api/statistics/therapeutic/* - ATC codes, MeSH terms, therapeutic areas
 * - GET /api/statistics/companies/* - MAH rankings, market concentration, activity
 * - GET /api/statistics/substances/* - Common substances, combinations, versatility
 * - GET /api/statistics/regulatory/* - Procedures, referrals, timeline events
 * - GET /api/statistics/safety/* - Shortages, additional monitoring
 * - GET /api/statistics/data-quality/* - Completeness, staleness indicators
 * - GET /api/statistics/news/* - News coverage, publication frequency
 * - GET /api/statistics/analytics/* - Correlations, trends, diversity analysis
 *
 * Admin:
 * - POST /api/admin/ema/import - Basic import
 * - POST /api/admin/ema/import/extended - Full import with events
 * - GET /api/admin/ema/status - Import status
 * - GET /api/admin/imports - Import logs
 * - GET /api/admin/imports/latest - Latest import
 * - GET /api/admin/imports/:id - Import details
 * - GET /api/admin/sources - Data sources
 * - GET /api/admin/sources/:id - Source details
 */
@Module({
  controllers: [
    // Admin - Import
    EmaImportController,
    // Admin - Logs & Sources
    ImportLogsController,
    EmaSourcesController,
    // Frontend - Core entities
    MedicinesController,
    TimelineEventsController,
    SubstancesController,
    CompaniesController,
    // Statistics API
    ProductStatisticsController,
    TherapeuticStatisticsController,
    CompanyStatisticsController,
    SubstanceStatisticsController,
    RegulatoryStatisticsController,
    SafetyStatisticsController,
    DataQualityStatisticsController,
    NewsStatisticsController,
    AdvancedAnalyticsController,
  ],
  providers: [EmaApiClient, EmaImportService, EmaImportExtendedService, EmaShortagesImportService],
  exports: [EmaImportService, EmaImportExtendedService, EmaShortagesImportService],
})
export class EmaModule {}
