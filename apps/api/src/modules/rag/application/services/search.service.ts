import { Inject, Injectable, Logger } from '@nestjs/common'
import { documentChunks, documents, medicinalProductsExtended } from '@workspace/database'
import { eq, sql, and, inArray } from 'drizzle-orm'

import {
  EMBEDDING_PROVIDER_TOKEN,
  type IEmbeddingProvider,
} from '../ports/embedding-provider.port'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface SearchQuery {
  query: string
  limit?: number
  offset?: number
  productSlug?: string
  documentType?: string[]
  language?: string[]
  sectionType?: string[]
}

export interface SearchResult {
  chunkId: number
  documentId: number
  productId: number | null
  content: string
  sectionType: string | null
  sectionTitle: string | null
  language: string
  score: number
  vectorScore: number | null
  textScore: number | null
  // Joined data
  documentTitle: string
  documentType: string
  documentUrl: string
  productName: string | null
  productSlug: string | null
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
  took: number // milliseconds
}

/**
 * Hybrid Search Service
 *
 * Combines vector similarity search (pgvector HNSW) with full-text search (tsvector)
 * using Reciprocal Rank Fusion (RRF) to merge results.
 *
 * RRF Score Formula: score = sum(1 / (k + rank))
 * where k = 60 (constant to prevent high-ranked items from dominating)
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)
  private readonly RRF_K = 60 // RRF constant

  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN) private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
  ) {}

  /**
   * Perform hybrid search
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now()
    const limit = query.limit || 10
    const offset = query.offset || 0

    // Generate query embedding
    const embeddingResult = await this.embeddingProvider.embed({ text: query.query })
    const queryEmbedding = embeddingResult.embedding

    // Perform both searches in parallel
    const [vectorResults, textResults] = await Promise.all([
      this.vectorSearch(queryEmbedding, query, limit * 2), // Get more for RRF
      this.textSearch(query.query, query, limit * 2),
    ])

    // Merge results using RRF
    const mergedResults = this.mergeWithRrf(vectorResults, textResults)

    // Apply pagination
    const paginatedResults = mergedResults.slice(offset, offset + limit)

    // Enrich with document and product data
    const enrichedResults = await this.enrichResults(paginatedResults)

    const took = Date.now() - startTime

    return {
      results: enrichedResults,
      total: mergedResults.length,
      query: query.query,
      took,
    }
  }

  /**
   * Vector similarity search using pgvector
   */
  private async vectorSearch(
    queryEmbedding: number[],
    query: SearchQuery,
    limit: number
  ): Promise<Array<{ chunkId: number; score: number }>> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`

    // Build conditions
    const conditions: string[] = ['embedding IS NOT NULL']

    if (query.language?.length) {
      conditions.push(`language IN (${query.language.map((l) => `'${l}'`).join(',')})`)
    }
    if (query.sectionType?.length) {
      conditions.push(`section_type IN (${query.sectionType.map((s) => `'${s}'`).join(',')})`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Use cosine distance for similarity (1 - distance = similarity)
    const results = await this.db.execute(sql`
      SELECT
        id AS chunk_id,
        1 - (embedding <=> ${embeddingStr}::vector) AS score
      FROM document_chunks
      ${sql.raw(whereClause)}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `)

    return (results.rows as Array<{ chunk_id: number; score: number }>).map((row) => ({
      chunkId: Number(row.chunk_id),
      score: Number(row.score),
    }))
  }

  /**
   * Full-text search using tsvector
   */
  private async textSearch(
    queryText: string,
    query: SearchQuery,
    limit: number
  ): Promise<Array<{ chunkId: number; score: number }>> {
    // Build conditions
    const conditions: string[] = ['content_tsv IS NOT NULL']

    if (query.language?.length) {
      conditions.push(`language IN (${query.language.map((l) => `'${l}'`).join(',')})`)
    }
    if (query.sectionType?.length) {
      conditions.push(`section_type IN (${query.sectionType.map((s) => `'${s}'`).join(',')})`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Convert query to tsquery and search
    const results = await this.db.execute(sql`
      SELECT
        id AS chunk_id,
        ts_rank_cd(content_tsv, plainto_tsquery('english', ${queryText})) AS score
      FROM document_chunks
      ${sql.raw(whereClause)}
        AND content_tsv @@ plainto_tsquery('english', ${queryText})
      ORDER BY score DESC
      LIMIT ${limit}
    `)

    return (results.rows as Array<{ chunk_id: number; score: number }>).map((row) => ({
      chunkId: Number(row.chunk_id),
      score: Number(row.score),
    }))
  }

  /**
   * Merge results using Reciprocal Rank Fusion
   */
  private mergeWithRrf(
    vectorResults: Array<{ chunkId: number; score: number }>,
    textResults: Array<{ chunkId: number; score: number }>
  ): Array<{
    chunkId: number
    rrfScore: number
    vectorScore: number | null
    textScore: number | null
  }> {
    const scores = new Map<
      number,
      { rrfScore: number; vectorScore: number | null; textScore: number | null }
    >()

    // Add vector results
    vectorResults.forEach((r, rank) => {
      const existing = scores.get(r.chunkId) || {
        rrfScore: 0,
        vectorScore: null,
        textScore: null,
      }
      existing.vectorScore = r.score
      existing.rrfScore += 1 / (this.RRF_K + rank + 1)
      scores.set(r.chunkId, existing)
    })

    // Add text results
    textResults.forEach((r, rank) => {
      const existing = scores.get(r.chunkId) || {
        rrfScore: 0,
        vectorScore: null,
        textScore: null,
      }
      existing.textScore = r.score
      existing.rrfScore += 1 / (this.RRF_K + rank + 1)
      scores.set(r.chunkId, existing)
    })

    // Sort by RRF score
    return Array.from(scores.entries())
      .map(([chunkId, data]) => ({
        chunkId,
        ...data,
      }))
      .sort((a, b) => b.rrfScore - a.rrfScore)
  }

  /**
   * Enrich results with document and product data
   */
  private async enrichResults(
    results: Array<{
      chunkId: number
      rrfScore: number
      vectorScore: number | null
      textScore: number | null
    }>
  ): Promise<SearchResult[]> {
    if (results.length === 0) return []

    const chunkIds = results.map((r) => r.chunkId)

    // Fetch chunks with document and product data
    const chunks = await this.db
      .select({
        chunkId: documentChunks.id,
        documentId: documentChunks.documentId,
        productId: documentChunks.productId,
        content: documentChunks.content,
        sectionType: documentChunks.sectionType,
        sectionTitle: documentChunks.sectionTitle,
        language: documentChunks.language,
        documentTitle: documents.title,
        documentType: documents.documentType,
        documentUrl: documents.documentUrl,
        productName: medicinalProductsExtended.name,
        productSlug: medicinalProductsExtended.slug,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .leftJoin(medicinalProductsExtended, eq(documentChunks.productId, medicinalProductsExtended.id))
      .where(inArray(documentChunks.id, chunkIds))

    // Create a map for quick lookup
    const chunkMap = new Map(chunks.map((c) => [c.chunkId, c]))

    // Combine with scores, maintaining order
    return results
      .map((r) => {
        const chunk = chunkMap.get(r.chunkId)
        if (!chunk) return null

        return {
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          productId: chunk.productId,
          content: chunk.content,
          sectionType: chunk.sectionType,
          sectionTitle: chunk.sectionTitle,
          language: chunk.language,
          score: r.rrfScore,
          vectorScore: r.vectorScore,
          textScore: r.textScore,
          documentTitle: chunk.documentTitle,
          documentType: chunk.documentType,
          documentUrl: chunk.documentUrl,
          productName: chunk.productName,
          productSlug: chunk.productSlug,
        }
      })
      .filter((r): r is SearchResult => r !== null)
  }

  /**
   * Search for chunks by product
   */
  async searchByProduct(productSlug: string, options?: {
    documentType?: string[]
    sectionType?: string[]
    limit?: number
  }): Promise<SearchResult[]> {
    const conditions = [eq(medicinalProductsExtended.slug, productSlug)]

    const results = await this.db
      .select({
        chunkId: documentChunks.id,
        documentId: documentChunks.documentId,
        productId: documentChunks.productId,
        content: documentChunks.content,
        sectionType: documentChunks.sectionType,
        sectionTitle: documentChunks.sectionTitle,
        language: documentChunks.language,
        documentTitle: documents.title,
        documentType: documents.documentType,
        documentUrl: documents.documentUrl,
        productName: medicinalProductsExtended.name,
        productSlug: medicinalProductsExtended.slug,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .innerJoin(medicinalProductsExtended, eq(documentChunks.productId, medicinalProductsExtended.id))
      .where(eq(medicinalProductsExtended.slug, productSlug))
      .orderBy(documentChunks.chunkIndex)
      .limit(options?.limit || 100)

    return results.map((r) => ({
      ...r,
      score: 1,
      vectorScore: null,
      textScore: null,
    }))
  }
}
