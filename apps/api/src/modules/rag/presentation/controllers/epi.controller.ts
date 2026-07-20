import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus, Param } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger'

import { EpiDownloadService } from '../../application/services/epi-download.service'
import { EPI_LANGUAGES, type EpiLanguage } from '../../infrastructure/clients/epi-api.client'
import {
  DownloadEpiDto,
  SearchEpiDto,
  GetAvailableLanguagesDto,
  EpiDownloadResultDto,
  EpiSearchResultDto,
  EpiAvailableLanguagesDto,
  EpiSupportedLanguagesDto,
  EpiLanguageDto,
} from '../dtos/epi.dto'

/**
 * ePI Controller
 *
 * Frontend API for accessing EMA Electronic Product Information.
 * Allows searching, downloading, and managing ePI content.
 */
@Controller('epi')
@ApiTags('ePI')
export class EpiController {
  constructor(private readonly epiDownloadService: EpiDownloadService) {}

  @Get('languages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all supported ePI languages',
    description: 'Returns the complete list of languages supported by the EMA ePI API.',
  })
  @ApiResponse({
    status: 200,
    description: 'Supported languages',
    type: EpiSupportedLanguagesDto,
  })
  getSupportedLanguages(): EpiSupportedLanguagesDto {
    const languageNames: Record<string, string> = {
      en: 'English',
      bg: 'Bulgarian',
      cs: 'Czech',
      da: 'Danish',
      de: 'German',
      el: 'Greek',
      es: 'Spanish',
      et: 'Estonian',
      fi: 'Finnish',
      fr: 'French',
      ga: 'Irish',
      hr: 'Croatian',
      hu: 'Hungarian',
      is: 'Icelandic',
      it: 'Italian',
      lv: 'Latvian',
      lt: 'Lithuanian',
      mt: 'Maltese',
      nl: 'Dutch',
      no: 'Norwegian',
      pl: 'Polish',
      pt: 'Portuguese',
      ro: 'Romanian',
      sk: 'Slovak',
      sl: 'Slovenian',
      sv: 'Swedish',
    }

    return {
      languages: EPI_LANGUAGES.map((code) => ({
        code,
        name: languageNames[code] || code,
        available: true,
      })),
    }
  }

  @Get('languages/:pmsId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available languages for a product',
    description: 'Checks which language versions are available in ePI for a specific product.',
  })
  @ApiParam({
    name: 'pmsId',
    description: 'EMA PMS ID (URL-encoded)',
    example: 'EMEA%2FH%2FC%2F004174',
  })
  @ApiResponse({
    status: 200,
    description: 'Available languages for the product',
    type: EpiAvailableLanguagesDto,
  })
  async getAvailableLanguages(
    @Param('pmsId') pmsId: string
  ): Promise<EpiAvailableLanguagesDto> {
    const decodedPmsId = decodeURIComponent(pmsId)
    const languages = await this.epiDownloadService.getAvailableLanguages(decodedPmsId)

    return {
      pmsId: decodedPmsId,
      languages,
    }
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search for products in ePI',
    description: 'Search for products available in the EMA ePI database by name.',
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query (product name)',
    example: 'Ozempic',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: EpiSearchResultDto,
  })
  async searchProducts(@Query('q') query: string): Promise<EpiSearchResultDto> {
    const results = await this.epiDownloadService.searchEpiProducts(query)

    return {
      results,
      total: results.length,
    }
  }

  @Get('products')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all EMA products in ePI',
    description: 'Returns all products from the European Medicines Agency available in ePI.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all EMA ePI products',
    type: EpiSearchResultDto,
  })
  async listAllEmaProducts(): Promise<EpiSearchResultDto> {
    const results = await this.epiDownloadService.getAllEmaEpiProducts()

    return {
      results,
      total: results.length,
    }
  }

  @Post('download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Download ePI for a product',
    description: `
Downloads ePI content from the EMA API for a specific product.

**Important:**
- English is always downloaded for embeddings/search
- Additional languages can be specified for display purposes
- Content is stored in the database and optionally in R2 storage
- Chunks are created for the English version only

**Rate Limiting:**
The EMA API has a 3-second rate limit between requests.
Downloading multiple languages will take some time.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Download result',
    type: EpiDownloadResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found in database',
  })
  async downloadEpi(@Body() dto: DownloadEpiDto): Promise<EpiDownloadResultDto> {
    const result = await this.epiDownloadService.downloadEpi(
      dto.productSlug,
      dto.pmsId,
      dto.languages || ['en']
    )

    return result
  }

  @Post('download/:productSlug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Download ePI for a product (simple)',
    description: 'Simplified endpoint - downloads English ePI for a product using the PMS ID from query.',
  })
  @ApiParam({
    name: 'productSlug',
    description: 'Product slug from our database',
    example: 'ozempic',
  })
  @ApiQuery({
    name: 'pmsId',
    description: 'EMA PMS ID',
    example: 'EMEA/H/C/004174',
  })
  @ApiQuery({
    name: 'languages',
    description: 'Languages to download (comma-separated)',
    required: false,
    example: 'en,de',
  })
  @ApiResponse({
    status: 200,
    description: 'Download result',
    type: EpiDownloadResultDto,
  })
  async downloadEpiSimple(
    @Param('productSlug') productSlug: string,
    @Query('pmsId') pmsId: string,
    @Query('languages') languagesStr?: string
  ): Promise<EpiDownloadResultDto> {
    const languages = languagesStr
      ? (languagesStr.split(',').filter((l) => EPI_LANGUAGES.includes(l as EpiLanguage)) as EpiLanguage[])
      : ['en' as EpiLanguage]

    return this.epiDownloadService.downloadEpi(productSlug, pmsId, languages)
  }
}
