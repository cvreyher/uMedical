import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsArray, IsIn } from 'class-validator'
import { Transform } from 'class-transformer'
import { EPI_LANGUAGES, type EpiLanguage } from '../../infrastructure/clients/epi-api.client'

// Request DTOs

export class DownloadEpiDto {
  @ApiProperty({
    description: 'Product slug from our database',
    example: 'ozempic',
  })
  @IsString()
  productSlug!: string

  @ApiProperty({
    description: 'EMA PMS ID (Product Management System ID)',
    example: 'EMEA/H/C/004174',
  })
  @IsString()
  pmsId!: string

  @ApiPropertyOptional({
    description: 'Languages to download (English always included for embeddings)',
    example: ['en', 'de', 'fr'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  languages?: EpiLanguage[]
}

export class SearchEpiDto {
  @ApiProperty({
    description: 'Search query (product name)',
    example: 'Ozempic',
  })
  @IsString()
  query!: string
}

export class GetAvailableLanguagesDto {
  @ApiProperty({
    description: 'EMA PMS ID',
    example: 'EMEA/H/C/004174',
  })
  @IsString()
  pmsId!: string
}

// Response DTOs

export class EpiLanguageDto {
  @ApiProperty({ description: 'ISO 639-1 language code', example: 'en' })
  code!: string

  @ApiProperty({ description: 'Language name', example: 'English' })
  name!: string

  @ApiProperty({ description: 'Whether this language is available for the product' })
  available!: boolean
}

export class EpiProductDto {
  @ApiProperty({ description: 'ePI List ID' })
  listId!: string

  @ApiProperty({ description: 'Document title' })
  title!: string

  @ApiProperty({ description: 'Product name' })
  productName!: string

  @ApiPropertyOptional({ description: 'Last updated date' })
  lastUpdated?: string
}

export class EpiDownloadResultDto {
  @ApiProperty({ description: 'Product slug' })
  productSlug!: string

  @ApiProperty({ description: 'Number of documents downloaded' })
  documentsDownloaded!: number

  @ApiProperty({ description: 'Number of chunks created' })
  chunksCreated!: number

  @ApiProperty({ description: 'Languages successfully processed', type: [String] })
  languagesProcessed!: string[]

  @ApiProperty({ description: 'Whether content was stored in R2' })
  storedInR2!: boolean

  @ApiProperty({ description: 'Error messages', type: [String] })
  errors!: string[]
}

export class EpiSearchResultDto {
  @ApiProperty({ type: [EpiProductDto], description: 'Matching products' })
  results!: EpiProductDto[]

  @ApiProperty({ description: 'Total number of results' })
  total!: number
}

export class EpiAvailableLanguagesDto {
  @ApiProperty({ description: 'EMA PMS ID' })
  pmsId!: string

  @ApiProperty({ type: [EpiLanguageDto], description: 'Available languages' })
  languages!: EpiLanguageDto[]
}

export class EpiSupportedLanguagesDto {
  @ApiProperty({ type: [EpiLanguageDto], description: 'All supported ePI languages' })
  languages!: EpiLanguageDto[]
}
