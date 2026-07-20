import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger'

import { SearchService } from '../../application/services/search.service'
import { UnifiedSearchService } from '../../application/services/unified-search.service'
import { SearchQueryDto, SearchResponseDto, UnifiedSearchQueryDto, UnifiedSearchResponseDto } from '../dtos/search.dto'

/**
 * Search Controller
 *
 * Provides hybrid semantic + full-text search across pharmaceutical documents.
 */
@Controller('search')
@ApiTags('Search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly unifiedSearchService: UnifiedSearchService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search pharmaceutical documents',
    description: `
Performs hybrid search combining semantic (vector) and full-text search
using Reciprocal Rank Fusion (RRF) to merge results.

Search across:
- EPAR documents (European Public Assessment Reports)
- SmPC (Summary of Product Characteristics)
- Package Leaflets (Patient Information)

Results include relevance scores from both vector similarity and
full-text matching, plus the combined RRF score used for ranking.
    `,
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query',
    example: 'diabetes treatment dosage',
    required: true,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Max results (default: 10, max: 100)',
    required: false,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Pagination offset',
    required: false,
  })
  @ApiQuery({
    name: 'documentType',
    description: 'Filter by document types (comma-separated: smpc,pl,epar)',
    required: false,
  })
  @ApiQuery({
    name: 'language',
    description: 'Filter by languages (comma-separated: en,de)',
    required: false,
  })
  @ApiQuery({
    name: 'sectionType',
    description: 'Filter by section types (comma-separated: smpc_4.1,smpc_4.2)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: SearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async search(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    return this.searchService.search({
      query: query.q,
      limit: query.limit,
      offset: query.offset,
      productSlug: query.productSlug,
      documentType: query.documentType,
      language: query.language,
      sectionType: query.sectionType,
    })
  }

  @Get('product/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get document chunks for a product',
    description: 'Retrieve all indexed document chunks for a specific medicine by slug.',
  })
  @ApiResponse({
    status: 200,
    description: 'Document chunks for the product',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async getProductChunks(
    @Query('slug') slug: string,
    @Query('documentType') documentType?: string,
    @Query('sectionType') sectionType?: string,
    @Query('limit') limit?: string
  ) {
    return this.searchService.searchByProduct(slug, {
      documentType: documentType ? documentType.split(',') : undefined,
      sectionType: sectionType ? sectionType.split(',') : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Get('unified')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unified search across all entities',
    description: `
Searches across all entity types in one request:
- **Products**: Find medicines by name, indication, therapeutic area
- **Substances**: Find active ingredients by INN name or synonyms
- **Companies**: Find pharmaceutical companies by name or country
- **Documents**: Find document chunks by content

Uses hybrid search (vector + full-text) with RRF fusion for ranking.
    `,
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query',
    example: 'diabetes GLP-1',
    required: true,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Max results per entity type (default: 10)',
    required: false,
  })
  @ApiQuery({
    name: 'includeProducts',
    description: 'Include products in results (default: true)',
    required: false,
  })
  @ApiQuery({
    name: 'includeSubstances',
    description: 'Include substances in results (default: true)',
    required: false,
  })
  @ApiQuery({
    name: 'includeCompanies',
    description: 'Include companies in results (default: true)',
    required: false,
  })
  @ApiQuery({
    name: 'includeDocuments',
    description: 'Include document chunks in results (default: true)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Unified search results',
    type: UnifiedSearchResponseDto,
  })
  async unifiedSearch(@Query() query: UnifiedSearchQueryDto): Promise<UnifiedSearchResponseDto> {
    return this.unifiedSearchService.search({
      query: query.q,
      limit: query.limit,
      includeProducts: query.includeProducts,
      includeSubstances: query.includeSubstances,
      includeCompanies: query.includeCompanies,
      includeDocuments: query.includeDocuments,
      language: query.language,
      documentType: query.documentType,
    })
  }
}
