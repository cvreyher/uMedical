import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsInt, IsArray, Min, Max, IsBoolean } from 'class-validator'
import { Transform, Type } from 'class-transformer'

export class SearchQueryDto {
  @ApiProperty({
    description: 'Search query text',
    example: 'diabetes treatment dosage',
  })
  @IsString()
  q!: string

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({
    description: 'Number of results to skip (for pagination)',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number

  @ApiPropertyOptional({
    description: 'Filter by product slug',
    example: 'ozempic',
  })
  @IsOptional()
  @IsString()
  productSlug?: string

  @ApiPropertyOptional({
    description: 'Filter by document types',
    example: ['smpc', 'pl'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  documentType?: string[]

  @ApiPropertyOptional({
    description: 'Filter by languages (ISO codes)',
    example: ['en', 'de'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  language?: string[]

  @ApiPropertyOptional({
    description: 'Filter by section types',
    example: ['smpc_4.1', 'smpc_4.2'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  sectionType?: string[]
}

export class SearchResultDto {
  @ApiProperty({ description: 'Chunk ID' })
  chunkId!: number

  @ApiProperty({ description: 'Document ID' })
  documentId!: number

  @ApiProperty({ description: 'Product ID', nullable: true })
  productId!: number | null

  @ApiProperty({ description: 'Chunk content (text)' })
  content!: string

  @ApiProperty({ description: 'Section type', nullable: true })
  sectionType!: string | null

  @ApiProperty({ description: 'Section title', nullable: true })
  sectionTitle!: string | null

  @ApiProperty({ description: 'Language code' })
  language!: string

  @ApiProperty({ description: 'Combined relevance score (RRF)' })
  score!: number

  @ApiProperty({ description: 'Vector similarity score', nullable: true })
  vectorScore!: number | null

  @ApiProperty({ description: 'Full-text search score', nullable: true })
  textScore!: number | null

  @ApiProperty({ description: 'Document title' })
  documentTitle!: string

  @ApiProperty({ description: 'Document type' })
  documentType!: string

  @ApiProperty({ description: 'Document URL' })
  documentUrl!: string

  @ApiProperty({ description: 'Product name', nullable: true })
  productName!: string | null

  @ApiProperty({ description: 'Product slug', nullable: true })
  productSlug!: string | null
}

export class SearchResponseDto {
  @ApiProperty({ type: [SearchResultDto], description: 'Search results' })
  results!: SearchResultDto[]

  @ApiProperty({ description: 'Total number of matching results' })
  total!: number

  @ApiProperty({ description: 'Original query' })
  query!: string

  @ApiProperty({ description: 'Search execution time in milliseconds' })
  took!: number
}

// =====================
// Unified Search DTOs
// =====================

export class UnifiedSearchQueryDto {
  @ApiProperty({
    description: 'Search query text',
    example: 'diabetes GLP-1',
  })
  @IsString()
  q!: string

  @ApiPropertyOptional({
    description: 'Maximum number of results per entity type',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number

  @ApiPropertyOptional({
    description: 'Include products in results',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeProducts?: boolean

  @ApiPropertyOptional({
    description: 'Include substances in results',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeSubstances?: boolean

  @ApiPropertyOptional({
    description: 'Include companies in results',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeCompanies?: boolean

  @ApiPropertyOptional({
    description: 'Include document chunks in results',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDocuments?: boolean

  @ApiPropertyOptional({
    description: 'Filter documents by languages (ISO codes)',
    example: ['en', 'de'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  language?: string[]

  @ApiPropertyOptional({
    description: 'Filter documents by document types',
    example: ['smpc', 'pl'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  documentType?: string[]
}

export class ProductSearchResultDto {
  @ApiProperty({ description: 'Product ID' })
  id!: number

  @ApiProperty({ description: 'Product slug' })
  slug!: string

  @ApiProperty({ description: 'Product name' })
  name!: string

  @ApiPropertyOptional({ description: 'Therapeutic indication' })
  therapeuticIndication?: string | null

  @ApiPropertyOptional({ description: 'Therapeutic area (MeSH terms)' })
  therapeuticAreaMesh?: string | null

  @ApiPropertyOptional({ description: 'Active substance (INN)' })
  internationalNonProprietaryName?: string | null

  @ApiProperty({ description: 'Medicine status' })
  medicineStatus!: string

  @ApiProperty({ description: 'Combined relevance score (RRF)' })
  score!: number

  @ApiPropertyOptional({ description: 'Vector similarity score' })
  vectorScore?: number | null

  @ApiPropertyOptional({ description: 'Full-text search score' })
  textScore?: number | null
}

export class SubstanceSearchResultDto {
  @ApiProperty({ description: 'Substance ID' })
  id!: number

  @ApiProperty({ description: 'Substance slug' })
  slug!: string

  @ApiProperty({ description: 'INN name (International Nonproprietary Name)' })
  innName!: string

  @ApiPropertyOptional({ description: 'Synonyms', type: [String] })
  synonyms?: string[] | null

  @ApiProperty({ description: 'Number of products with this substance' })
  productCount!: number

  @ApiProperty({ description: 'Combined relevance score (RRF)' })
  score!: number

  @ApiPropertyOptional({ description: 'Vector similarity score' })
  vectorScore?: number | null

  @ApiPropertyOptional({ description: 'Full-text search score' })
  textScore?: number | null
}

export class CompanySearchResultDto {
  @ApiProperty({ description: 'Company ID' })
  id!: number

  @ApiProperty({ description: 'Company slug' })
  slug!: string

  @ApiProperty({ description: 'Company name' })
  name!: string

  @ApiPropertyOptional({ description: 'Country' })
  country?: string | null

  @ApiProperty({ description: 'Number of products by this company' })
  productCount!: number

  @ApiProperty({ description: 'Combined relevance score (RRF)' })
  score!: number

  @ApiPropertyOptional({ description: 'Vector similarity score' })
  vectorScore?: number | null

  @ApiPropertyOptional({ description: 'Full-text search score' })
  textScore?: number | null
}

export class UnifiedSearchResponseDto {
  @ApiProperty({ type: [ProductSearchResultDto], description: 'Matching products' })
  products!: ProductSearchResultDto[]

  @ApiProperty({ type: [SubstanceSearchResultDto], description: 'Matching substances' })
  substances!: SubstanceSearchResultDto[]

  @ApiProperty({ type: [CompanySearchResultDto], description: 'Matching companies' })
  companies!: CompanySearchResultDto[]

  @ApiProperty({ type: [SearchResultDto], description: 'Matching document chunks' })
  documents!: SearchResultDto[]

  @ApiProperty({ description: 'Original query' })
  query!: string

  @ApiProperty({ description: 'Search execution time in milliseconds' })
  took!: number
}
