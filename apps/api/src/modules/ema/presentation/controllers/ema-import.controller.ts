import { Controller, Post, Get, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger'

import { ApiKeyGuard } from '@/app/guards/api-key.guard'

import { EmaImportService } from '../../application/services/ema-import.service'
import { EmaImportExtendedService } from '../../application/services/ema-import-extended.service'
import { EmaShortagesImportService } from '../../application/services/ema-shortages-import.service'

import type { ImportResult } from '../../application/services/ema-import.service'
import type { ExtendedImportResult } from '../../application/services/ema-import-extended.service'
import type { ShortagesImportResult } from '../../application/services/ema-shortages-import.service'

/**
 * Admin controller for EMA data import operations
 * Protected by ADMIN_API_KEY (x-api-key header)
 */
@ApiTags('Admin - EMA Import')
@ApiSecurity('admin-api-key')
@UseGuards(ApiKeyGuard)
@Controller('admin/ema')
export class EmaImportController {
  private readonly logger = new Logger(EmaImportController.name)
  private importInProgress = false
  private shortagesImportInProgress = false
  private lastImportResult: ImportResult | ExtendedImportResult | null = null
  private lastShortagesImportResult: ShortagesImportResult | null = null
  private lastImportTime: Date | null = null
  private lastShortagesImportTime: Date | null = null

  constructor(
    private readonly importService: EmaImportService,
    private readonly extendedImportService: EmaImportExtendedService,
    private readonly shortagesImportService: EmaShortagesImportService,
  ) {}

  /**
   * Trigger a full import of EMA medicines data (basic version)
   * Only one import can run at a time
   */
  @Post('import')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start EMA data import (basic)' })
  @ApiResponse({ status: 202, description: 'Import started' })
  @ApiResponse({ status: 409, description: 'Import already in progress' })
  async startImport(): Promise<{ message: string; status: string }> {
    if (this.importInProgress) {
      return {
        message: 'Import already in progress',
        status: 'in_progress',
      }
    }

    this.importInProgress = true
    this.logger.log('Starting EMA import (basic)...')

    this.runBasicImport().catch((error) => {
      this.logger.error('Import failed:', error)
    })

    return {
      message: 'Import started (basic)',
      status: 'started',
    }
  }

  /**
   * Trigger a full import with extended schema and timeline events
   */
  @Post('import/extended')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start EMA data import (extended with events)' })
  @ApiResponse({ status: 202, description: 'Extended import started' })
  @ApiResponse({ status: 409, description: 'Import already in progress' })
  async startExtendedImport(): Promise<{ message: string; status: string }> {
    if (this.importInProgress) {
      return {
        message: 'Import already in progress',
        status: 'in_progress',
      }
    }

    this.importInProgress = true
    this.logger.log('Starting EMA import (extended)...')

    this.runExtendedImport().catch((error) => {
      this.logger.error('Extended import failed:', error)
    })

    return {
      message: 'Extended import started (with timeline events)',
      status: 'started',
    }
  }

  /**
   * Trigger import of EMA medicine supply shortages
   */
  @Post('import/shortages')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start EMA shortages data import' })
  @ApiResponse({ status: 202, description: 'Shortages import started' })
  @ApiResponse({ status: 409, description: 'Shortages import already in progress' })
  async startShortagesImport(): Promise<{ message: string; status: string }> {
    if (this.shortagesImportInProgress) {
      return {
        message: 'Shortages import already in progress',
        status: 'in_progress',
      }
    }

    this.shortagesImportInProgress = true
    this.logger.log('Starting EMA shortages import...')

    this.runShortagesImport().catch((error) => {
      this.logger.error('Shortages import failed:', error)
    })

    return {
      message: 'Shortages import started',
      status: 'started',
    }
  }

  /**
   * Get the current import status and last result
   */
  @Get('status')
  @ApiOperation({ summary: 'Get EMA import status' })
  @ApiResponse({ status: 200, description: 'Current import status' })
  getStatus(): {
    medicines: {
      importInProgress: boolean
      lastImportTime: Date | null
      lastImportResult: ImportResult | ExtendedImportResult | null
    }
    shortages: {
      importInProgress: boolean
      lastImportTime: Date | null
      lastImportResult: ShortagesImportResult | null
    }
  } {
    return {
      medicines: {
        importInProgress: this.importInProgress,
        lastImportTime: this.lastImportTime,
        lastImportResult: this.lastImportResult,
      },
      shortages: {
        importInProgress: this.shortagesImportInProgress,
        lastImportTime: this.lastShortagesImportTime,
        lastImportResult: this.lastShortagesImportResult,
      },
    }
  }

  /**
   * Get shortages import status specifically
   */
  @Get('status/shortages')
  @ApiOperation({ summary: 'Get EMA shortages import status' })
  @ApiResponse({ status: 200, description: 'Current shortages import status' })
  getShortagesStatus(): {
    importInProgress: boolean
    lastImportTime: Date | null
    lastImportResult: ShortagesImportResult | null
  } {
    return {
      importInProgress: this.shortagesImportInProgress,
      lastImportTime: this.lastShortagesImportTime,
      lastImportResult: this.lastShortagesImportResult,
    }
  }

  private async runBasicImport(): Promise<void> {
    try {
      this.lastImportResult = await this.importService.importAll()
      this.lastImportTime = new Date()
      this.logger.log('Basic import completed successfully')
    } finally {
      this.importInProgress = false
    }
  }

  private async runExtendedImport(): Promise<void> {
    try {
      this.lastImportResult = await this.extendedImportService.importAll()
      this.lastImportTime = new Date()
      this.logger.log('Extended import completed successfully')
    } finally {
      this.importInProgress = false
    }
  }

  private async runShortagesImport(): Promise<void> {
    try {
      this.lastShortagesImportResult = await this.shortagesImportService.importAll()
      this.lastShortagesImportTime = new Date()
      this.logger.log('Shortages import completed successfully')
    } finally {
      this.shortagesImportInProgress = false
    }
  }
}
