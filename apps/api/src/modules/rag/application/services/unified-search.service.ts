import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  documentChunks,
  documents,
  medicinalProductsExtended,
  substances,
  companies,
  productSubstances,
  productCompanies,
} from '@workspace/database'
import { eq, sql, inArray } from 'drizzle-orm'

import {
  EMBEDDING_PROVIDER_TOKEN,
  type IEmbeddingProvider,
} from '../ports/embedding-provider.port'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

// Result types
export interface ProductSearchResult {
  id: number
  slug: string
  name: string
  therapeuticIndication: string | null
  therapeuticAreaMesh: string | null
  internationalNonProprietaryName: string | null
  medicineStatus: string
  score: number
  vectorScore: number | null
  textScore: number | null
}

export interface SubstanceSearchResult {
  id: number
  slug: string
  innName: string
  synonyms: string[] | null
  productCount: number
  score: number
  vectorScore: number | null
  textScore: number | null
}

export interface CompanySearchResult {
  id: number
  slug: string
  name: string
  country: string | null
  productCount: number
  score: number
  vectorScore: number | null
  textScore: number | null
}

export interface DocumentSearchResult {
  chunkId: number
  documentId: number
  productId: number | null
  content: string
  sectionType: string | null
  sectionTitle: string | null
  language: string
  documentTitle: string
  documentType: string
  documentUrl: string
  productName: string | null
  productSlug: string | null
  score: number
  vectorScore: number | null
  textScore: number | null
}

export interface UnifiedSearchQuery {
  query: string
  limit?: number
  includeProducts?: boolean
  includeSubstances?: boolean
  includeCompanies?: boolean
  includeDocuments?: boolean
  language?: string[]
  documentType?: string[]
}

export interface UnifiedSearchResponse {
  products: ProductSearchResult[]
  substances: SubstanceSearchResult[]
  companies: CompanySearchResult[]
  documents: DocumentSearchResult[]
  query: string
  took: number
}

/**
 * Unified Search Service
 *
 * Searches across all entity types:
 * - Products (by name, indication, therapeutic area)
 * - Substances (by INN name, synonyms)
 * - Companies (by name, country)
 * - Documents (by content chunks)
 *
 * Uses hybrid search (vector + full-text) with RRF fusion.
 */
@Injectable()
export class UnifiedSearchService {
  private readonly logger = new Logger(UnifiedSearchService.name)
  private readonly RRF_K = 60

  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN) private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
  ) {}

  /**
   * Perform unified search across all entity types
   */
  async search(query: UnifiedSearchQuery): Promise<UnifiedSearchResponse> {
    const startTime = Date.now()
    const limit = query.limit || 10

    // Generate query embedding
    const embeddingResult = await this.embeddingProvider.embed({ text: query.query })
    const queryEmbedding = embeddingResult.embedding
    const embeddingStr = `[${queryEmbedding.join(',')}]`

    // Run searches in parallel
    const [products, substancesResult, companiesResult, documentsResult] = await Promise.all([
      query.includeProducts !== false ? this.searchProducts(query.query, embeddingStr, limit) : [],
      query.includeSubstances !== false ? this.searchSubstances(query.query, embeddingStr, limit) : [],
      query.includeCompanies !== false ? this.searchCompanies(query.query, embeddingStr, limit) : [],
      query.includeDocuments !== false ? this.searchDocuments(query.query, embeddingStr, limit, query) : [],
    ])

    const took = Date.now() - startTime

    return {
      products,
      substances: substancesResult,
      companies: companiesResult,
      documents: documentsResult,
      query: query.query,
      took,
    }
  }

  /**
   * Search products with hybrid approach
   */
  private async searchProducts(
    queryText: string,
    embeddingStr: string,
    limit: number
  ): Promise<ProductSearchResult[]> {
    // Vector search
    const vectorResults = await this.db.execute(sql`
      SELECT
        id,
        1 - (embedding <=> ${embeddingStr}::vector) AS score
      FROM medicinal_products_extended
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit * 2}
    `)

    // Full-text search
    const textResults = await this.db.execute(sql`
      SELECT
        id,
        ts_rank_cd(search_tsv, plainto_tsquery('english', ${queryText})) AS score
      FROM medicinal_products_extended
      WHERE search_tsv @@ plainto_tsquery('english', ${queryText})
      ORDER BY score DESC
      LIMIT ${limit * 2}
    `)

    // Merge with RRF
    const merged = this.mergeResults(
      (vectorResults.rows as Array<{ id: number; score: number }>).map((r) => ({
        id: Number(r.id),
        score: Number(r.score),
      })),
      (textResults.rows as Array<{ id: number; score: number }>).map((r) => ({
        id: Number(r.id),
        score: Number(r.score),
      }))
    )

    // Get top results
    const topIds = merged.slice(0, limit).map((r) => r.id)
    if (topIds.length === 0) return []

    // Fetch full product data
    const products = await this.db
      .select({
        id: medicinalProductsExtended.id,
        slug: medicinalProductsExtended.slug,
        name: medicinalProductsExtended.name,
        therapeuticIndication: medicinalProductsExtended.therapeuticIndication,
        therapeuticAreaMesh: medicinalProductsExtended.therapeuticAreaMesh,
        internationalNonProprietaryName: medicinalProductsExtended.internationalNonProprietaryName,
        medicineStatus: medicinalProductsExtended.medicineStatus,
      })
      .from(medicinalProductsExtended)
      .where(inArray(medicinalProductsExtended.id, topIds))

    // Map scores to products
    const scoreMap = new Map(merged.map((r) => [r.id, r]))
    return products
      .map((p) => {
        const scores = scoreMap.get(p.id)
        return {
          ...p,
          score: scores?.rrfScore ?? 0,
          vectorScore: scores?.vectorScore ?? null,
          textScore: scores?.textScore ?? null,
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Search substances with hybrid approach
   */
  private async searchSubstances(
    queryText: string,
    embeddingStr: string,
    limit: number
  ): Promise<SubstanceSearchResult[]> {
    // Vector search
    const vectorResults = await this.db.execute(sql`
      SELECT
        id,
        1 - (embedding <=> ${embeddingStr}::vector) AS score
      FROM substances
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit * 2}
    `)

    // Full-text search
    const textResults = await this.db.execute(sql`
      SELECT
        id,
        ts_rank_cd(search_tsv, plainto_tsquery('english', ${queryText})) AS score
      FROM substances
      WHERE search_tsv @@ plainto_tsquery('english', ${queryText})
      ORDER BY score DESC
      LIMIT ${limit * 2}
    `)

    // Merge with RRF
    const merged = this.mergeResults(
      (vectorResults.rows as Array<{ id: number; score: number }>).map((r) => ({
        id: Number(r.id),
        score: Number(r.score),
      })),
      (textResults.rows as Array<{ id: number; score: number }>).map((r) => ({
        id: Number(r.id),
        score: Number(r.score),
      }))
    )

    const topIds = merged.slice(0, limit).map((r) => r.id)
    if (topIds.length === 0) return []

    // Fetch substances with product count
    const substancesWithCount = await this.db.execute(sql`
      SELECT
        s.id, s.slug, s.inn_name, s.synonyms,
        COUNT(ps.product_id) AS product_count
      FROM substances s
      LEFT JOIN product_substances ps ON ps.substance_id = s.id
      WHERE s.id = ANY(${topIds})
      GROUP BY s.id
    `)

    const scoreMap = new Map(merged.map((r) => [r.id, r]))
    return (substancesWithCount.rows as Array<{
      id: number
      slug: string
      inn_name: string
      synonyms: string[] | null
      product_count: string
    }>)
      .map((s) => {
        const scores = scoreMap.get(Number(s.id))
        return {
          id: Number(s.id),
          slug: s.slug,
          innName: s.inn_name,
          synonyms: s.synonyms,
          productCount: Number(s.product_count),
          score: scores?.rrfScore ?? 0,
          vectorScore: scores?.vectorScore ?? null,
          textScore: scores?.textScore ?? null,
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Search companies with hybrid approach
   */
  private async searchCompanies(
    queryText: string,
    embeddingStr: string,
    limit: number
  ): Promise<CompanySearchResult[]> {
    // Vector search
    const vectorResults = await this.db.execute(sql`
      SELECT
        id,
        1 - (embedding <=> ${embeddingStr}::vector) AS score
      FROM companies
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit * 2}
    `)

    // Full-text search
    const textResults = await this.db.execute(sql`
      SELECT
        id,
        ts_rank_cd(search_tsv, plainto_tsquery('english', ${queryText})) AS score
      FROM companies
      WHERE search_tsv @@ plainto_tsquery('english', ${queryText})
      ORDER BY score DESC
      LIMIT ${limit * 2}
    `)

    // Merge with RRF
    const merged = this.mergeResults(
      (vectorResults.rows as Array<{ id: number; score: number }>).map((r) => ({
        id: Number(r.id),
        score: Number(r.score),
      })),
      (textResults.rows as Array<{ id: number; score: number }>).map((r) => ({
        id: Number(r.id),
        score: Number(r.score),
      }))
    )

    const topIds = merged.slice(0, limit).map((r) => r.id)
    if (topIds.length === 0) return []

    // Fetch companies with product count
    const companiesWithCount = await this.db.execute(sql`
      SELECT
        c.id, c.slug, c.name, c.country,
        COUNT(pc.product_id) AS product_count
      FROM companies c
      LEFT JOIN product_companies pc ON pc.company_id = c.id
      WHERE c.id = ANY(${topIds})
      GROUP BY c.id
    `)

    const scoreMap = new Map(merged.map((r) => [r.id, r]))
    return (companiesWithCount.rows as Array<{
      id: number
      slug: string
      name: string
      country: string | null
      product_count: string
    }>)
      .map((c) => {
        const scores = scoreMap.get(Number(c.id))
        return {
          id: Number(c.id),
          slug: c.slug,
          name: c.name,
          country: c.country,
          productCount: Number(c.product_count),
          score: scores?.rrfScore ?? 0,
          vectorScore: scores?.vectorScore ?? null,
          textScore: scores?.textScore ?? null,
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Search document chunks with hybrid approach
   */
  private async searchDocuments(
    queryText: string,
    embeddingStr: string,
    limit: number,
    query: UnifiedSearchQuery
  ): Promise<DocumentSearchResult[]> {
    // Build where conditions
    const conditions: string[] = ['embedding IS NOT NULL']

    if (query.language?.length) {
      conditions.push(`language IN (${query.language.map((l) => `'${l}'`).join(',')})`)
    }

    const whereClause = conditions.join(' AND ')

    // Vector search
    const vectorResults = await this.db.execute(sql`
      SELECT
        id,
        1 - (embedding <=> ${embeddingStr}::vector) AS score
      FROM document_chunks
      WHERE ${sql.raw(whereClause)}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit * 2}
    `)

    // Full-text search
    const textWhereClause = whereClause + ` AND content_tsv @@ plainto_tsquery('english', '${queryText.replace(/'/g, "''")}')`
    const textResults = await this.db.execute(sql`
      SELECT
        id,
        ts_rank_cd(content_tsv, plainto_tsquery('english', ${queryText})) AS score
      FROM document_chunks
      WHERE ${sql.raw(textWhereClause)}
      ORDER BY score DESC
      LIMIT ${limit * 2}
    `)

    // Merge with RRF
    const merged = this.mergeResults(
      (vectorResults.rows as Array<{ id: number; score: number }>).map((r) => ({
        id: Number(r.id),
        score: Number(r.score),
      })),
      (textResults.rows as Array<{ id: number; score: number }>).map((r) => ({
        id: Number(r.id),
        score: Number(r.score),
      }))
    )

    const topIds = merged.slice(0, limit).map((r) => r.id)
    if (topIds.length === 0) return []

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
      .where(inArray(documentChunks.id, topIds))

    const scoreMap = new Map(merged.map((r) => [r.id, r]))
    return chunks
      .map((c) => {
        const scores = scoreMap.get(c.chunkId)
        return {
          ...c,
          score: scores?.rrfScore ?? 0,
          vectorScore: scores?.vectorScore ?? null,
          textScore: scores?.textScore ?? null,
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Merge vector and text results using RRF
   */
  private mergeResults(
    vectorResults: Array<{ id: number; score: number }>,
    textResults: Array<{ id: number; score: number }>
  ): Array<{
    id: number
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
      const existing = scores.get(r.id) || {
        rrfScore: 0,
        vectorScore: null,
        textScore: null,
      }
      existing.vectorScore = r.score
      existing.rrfScore += 1 / (this.RRF_K + rank + 1)
      scores.set(r.id, existing)
    })

    // Add text results
    textResults.forEach((r, rank) => {
      const existing = scores.get(r.id) || {
        rrfScore: 0,
        vectorScore: null,
        textScore: null,
      }
      existing.textScore = r.score
      existing.rrfScore += 1 / (this.RRF_K + rank + 1)
      scores.set(r.id, existing)
    })

    return Array.from(scores.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.rrfScore - a.rrfScore)
  }
}
