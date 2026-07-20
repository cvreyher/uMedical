import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsArray, IsString, IsInt, Min, Max, IsIn, IsObject } from 'class-validator'
import { Transform, Type } from 'class-transformer'

// Request DTOs

export class ImportDocumentsDto {
  @ApiPropertyOptional({
    description: 'Import only EPAR documents (skip non-EPAR)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  eparOnly?: boolean

  @ApiPropertyOptional({
    description: 'Filter by languages',
    example: ['en', 'de'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  languages?: string[]

  @ApiPropertyOptional({
    description: 'Filter by document types',
    example: ['smpc', 'pl'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  documentTypes?: string[]
}

export class ProcessPdfsDto {
  @ApiPropertyOptional({
    description: 'Maximum number of PDFs to process',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number

  @ApiPropertyOptional({
    description: 'Filter by document types',
    example: ['smpc', 'pl'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  documentTypes?: string[]

  @ApiPropertyOptional({
    description: 'Filter by languages',
    example: ['en'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  languages?: string[]
}

export class GenerateEmbeddingsDto {
  @ApiPropertyOptional({
    description: 'Maximum number of chunks to process',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number

  @ApiPropertyOptional({
    description: 'Job type: full (all) or incremental (new only)',
    default: 'incremental',
  })
  @IsOptional()
  @IsString()
  jobType?: 'full' | 'incremental'
}

export class GenerateEntityEmbeddingsDto {
  @ApiProperty({
    description: 'Entity type to generate embeddings for',
    enum: ['all', 'product', 'substance', 'company'],
    default: 'all',
  })
  @IsString()
  @IsIn(['all', 'product', 'substance', 'company'])
  entityType!: 'all' | 'product' | 'substance' | 'company'

  @ApiPropertyOptional({
    description: 'Specific entity ID (only for single entity processing)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  entityId?: number
}

export class QueueJobDto {
  @ApiProperty({
    description: 'Job type',
    enum: ['epi_download', 'pdf_extract', 'embedding', 'entity_embedding'],
  })
  @IsString()
  @IsIn(['epi_download', 'pdf_extract', 'embedding', 'entity_embedding'])
  jobType!: 'epi_download' | 'pdf_extract' | 'embedding' | 'entity_embedding'

  @ApiProperty({
    description: 'Job payload (varies by job type)',
    example: { productSlug: 'ozempic', pmsId: 'EMEA/H/C/004174', languages: ['en', 'de'] },
  })
  @IsObject()
  payload!: Record<string, unknown>

  @ApiPropertyOptional({
    description: 'Job priority (higher = more urgent)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number
}

// Response DTOs

export class DocumentImportResultDto {
  @ApiProperty()
  totalFetched!: number

  @ApiProperty()
  documentsCreated!: number

  @ApiProperty()
  documentsUpdated!: number

  @ApiProperty()
  documentsSkipped!: number

  @ApiProperty({ type: [String] })
  errors!: string[]
}

export class PdfProcessingResultDto {
  @ApiProperty()
  documentsProcessed!: number

  @ApiProperty()
  chunksCreated!: number

  @ApiProperty({ type: [String] })
  errors!: string[]
}

export class EmbeddingGenerationResultDto {
  @ApiProperty()
  jobId!: number

  @ApiProperty()
  chunksProcessed!: number

  @ApiProperty()
  totalTokens!: number

  @ApiProperty()
  estimatedCostUsd!: number

  @ApiProperty({ type: [String] })
  errors!: string[]
}

export class SingleEntityEmbeddingResultDto {
  @ApiProperty()
  entityType!: 'product' | 'substance' | 'company'

  @ApiProperty()
  processed!: number

  @ApiProperty()
  totalTokens!: number

  @ApiProperty()
  estimatedCostUsd!: number

  @ApiProperty({ type: [String] })
  errors!: string[]
}

export class EntityEmbeddingResultDto {
  @ApiPropertyOptional({ type: SingleEntityEmbeddingResultDto })
  products?: SingleEntityEmbeddingResultDto | null

  @ApiPropertyOptional({ type: SingleEntityEmbeddingResultDto })
  substances?: SingleEntityEmbeddingResultDto | null

  @ApiPropertyOptional({ type: SingleEntityEmbeddingResultDto })
  companies?: SingleEntityEmbeddingResultDto | null

  @ApiProperty()
  totalCostUsd!: number
}

export class JobStatusDto {
  @ApiProperty()
  id!: number

  @ApiProperty()
  jobType!: string

  @ApiPropertyOptional()
  entityType?: string | null

  @ApiPropertyOptional()
  entityId?: number | null

  @ApiProperty()
  status!: string

  @ApiProperty()
  priority!: number

  @ApiPropertyOptional()
  progress?: number | null

  @ApiPropertyOptional()
  progressMessage?: string | null

  @ApiPropertyOptional()
  errorMessage?: string | null

  @ApiProperty()
  retryCount!: number

  @ApiProperty()
  maxRetries!: number

  @ApiProperty()
  createdAt!: Date

  @ApiPropertyOptional()
  startedAt?: Date | null

  @ApiPropertyOptional()
  completedAt?: Date | null
}

export class JobQueueStatsDto {
  @ApiProperty()
  pending!: number

  @ApiProperty()
  running!: number

  @ApiProperty()
  completed!: number

  @ApiProperty()
  failed!: number

  @ApiProperty({ description: 'Pending jobs by type' })
  byType!: Record<string, number>

  @ApiProperty({ description: 'Whether the processor is currently running' })
  isProcessing!: boolean
}

export class EntityEmbeddingStatsDto {
  @ApiProperty()
  products!: { total: number; withEmbeddings: number }

  @ApiProperty()
  substances!: { total: number; withEmbeddings: number }

  @ApiProperty()
  companies!: { total: number; withEmbeddings: number }
}

export class RagStatusDto {
  @ApiProperty({ description: 'Document statistics' })
  documents!: {
    totalDocuments: number
    byType: Record<string, number>
    byLanguage: Record<string, number>
    byProcessingStatus: Record<string, number>
    linkedToProducts: number
    unlinked: number
  }

  @ApiProperty({ description: 'PDF processing statistics' })
  processing!: {
    pending: number
    downloaded: number
    extracted: number
    chunked: number
    embedded: number
    failed: number
  }

  @ApiProperty({ description: 'Chunking statistics' })
  chunks!: {
    totalChunks: number
    bySection: Record<string, number>
    avgChunkSize: number
    minChunkSize: number
    maxChunkSize: number
  }

  @ApiProperty({ description: 'Document chunk embedding statistics' })
  embeddings!: {
    totalChunks: number
    chunksWithEmbeddings: number
    chunksWithoutEmbeddings: number
    totalCostUsd: number
    latestJob: {
      id: number
      status: string
      processedChunks: number
      completedAt: Date | null
    } | null
  }

  @ApiProperty({ description: 'Entity embedding statistics', type: EntityEmbeddingStatsDto })
  entityEmbeddings!: {
    products: { total: number; withEmbeddings: number }
    substances: { total: number; withEmbeddings: number }
    companies: { total: number; withEmbeddings: number }
  }

  @ApiProperty({ description: 'Job queue statistics', type: JobQueueStatsDto })
  jobQueue!: {
    pending: number
    running: number
    completed: number
    failed: number
    byType: Record<string, number>
    isProcessing: boolean
  }

  @ApiProperty({ description: 'Embedding provider information' })
  provider!: {
    name: string
    model: string
    dimensions: number
  }
}
