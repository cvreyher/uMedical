import { Inject, Injectable, Logger } from '@nestjs/common'
import { medicinalProductsExtended, substances, companies } from '@workspace/database'
import { eq, isNull, sql } from 'drizzle-orm'

import {
  EMBEDDING_PROVIDER_TOKEN,
  type IEmbeddingProvider,
} from '../ports/embedding-provider.port'
import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

export interface EntityEmbeddingResult {
  entityType: 'product' | 'substance' | 'company'
  processed: number
  totalTokens: number
  estimatedCostUsd: number
  errors: string[]
}

/**
 * Entity Embedding Service
 *
 * Generates embeddings for products, substances, and companies
 * to enable direct semantic search on these entities.
 *
 * Uses the searchText field which is auto-populated by database triggers.
 */
@Injectable()
export class EntityEmbeddingService {
  private readonly logger = new Logger(EntityEmbeddingService.name)
  private readonly BATCH_SIZE = 50

  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN) private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(DB_TOKEN) private readonly db: DrizzleDb,
  ) {}

  /**
   * Generate embeddings for all entity types
   */
  async generateAllEntityEmbeddings(): Promise<{
    products: EntityEmbeddingResult
    substances: EntityEmbeddingResult
    companies: EntityEmbeddingResult
    totalCostUsd: number
  }> {
    const products = await this.generateProductEmbeddings()
    const substancesResult = await this.generateSubstanceEmbeddings()
    const companiesResult = await this.generateCompanyEmbeddings()

    return {
      products,
      substances: substancesResult,
      companies: companiesResult,
      totalCostUsd: products.estimatedCostUsd + substancesResult.estimatedCostUsd + companiesResult.estimatedCostUsd,
    }
  }

  /**
   * Generate embeddings for products
   */
  async generateProductEmbeddings(productId?: number): Promise<EntityEmbeddingResult> {
    const result: EntityEmbeddingResult = {
      entityType: 'product',
      processed: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      errors: [],
    }

    try {
      // Find products without embeddings (or specific product)
      const productsToProcess = await this.db
        .select({
          id: medicinalProductsExtended.id,
          searchText: medicinalProductsExtended.searchText,
          name: medicinalProductsExtended.name,
          internationalNonProprietaryName: medicinalProductsExtended.internationalNonProprietaryName,
          therapeuticIndication: medicinalProductsExtended.therapeuticIndication,
          therapeuticAreaMesh: medicinalProductsExtended.therapeuticAreaMesh,
          atcCode: medicinalProductsExtended.atcCode,
          pharmacotherapeuticGroup: medicinalProductsExtended.pharmacotherapeuticGroup,
        })
        .from(medicinalProductsExtended)
        .where(
          productId
            ? eq(medicinalProductsExtended.id, productId)
            : isNull(medicinalProductsExtended.embedding)
        )
        .limit(1000)

      this.logger.log(`Processing ${productsToProcess.length} products for embeddings`)

      // Process in batches
      for (let i = 0; i < productsToProcess.length; i += this.BATCH_SIZE) {
        const batch = productsToProcess.slice(i, i + this.BATCH_SIZE)

        try {
          // Build search text for each product
          const texts = batch.map((p) =>
            this.buildProductSearchText(p)
          )

          // Generate embeddings
          const response = await this.embeddingProvider.embedBatch({ texts })

          // Update products with embeddings
          for (let j = 0; j < batch.length; j++) {
            const product = batch[j]
            const embedding = response.embeddings[j]
            if (!product || !embedding) continue

            await this.db
              .update(medicinalProductsExtended)
              .set({
                embedding,
                embeddingUpdatedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(medicinalProductsExtended.id, product.id))
          }

          result.processed += batch.length
          result.totalTokens += response.totalTokens
        } catch (error) {
          const errorMsg = `Product batch ${Math.floor(i / this.BATCH_SIZE) + 1} failed: ${error instanceof Error ? error.message : String(error)}`
          this.logger.error(errorMsg)
          result.errors.push(errorMsg)
        }
      }

      result.estimatedCostUsd = this.embeddingProvider.estimateCost(result.totalTokens)
      this.logger.log(`Product embeddings: ${result.processed} processed, ${result.totalTokens} tokens, $${result.estimatedCostUsd.toFixed(4)}`)
    } catch (error) {
      const errorMsg = `Product embeddings failed: ${error instanceof Error ? error.message : String(error)}`
      this.logger.error(errorMsg)
      result.errors.push(errorMsg)
    }

    return result
  }

  /**
   * Generate embeddings for substances
   */
  async generateSubstanceEmbeddings(substanceId?: number): Promise<EntityEmbeddingResult> {
    const result: EntityEmbeddingResult = {
      entityType: 'substance',
      processed: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      errors: [],
    }

    try {
      const substancesToProcess = await this.db
        .select({
          id: substances.id,
          innName: substances.innName,
          synonyms: substances.synonyms,
        })
        .from(substances)
        .where(
          substanceId
            ? eq(substances.id, substanceId)
            : isNull(substances.embedding)
        )
        .limit(1000)

      this.logger.log(`Processing ${substancesToProcess.length} substances for embeddings`)

      for (let i = 0; i < substancesToProcess.length; i += this.BATCH_SIZE) {
        const batch = substancesToProcess.slice(i, i + this.BATCH_SIZE)

        try {
          const texts = batch.map((s) =>
            `${s.innName} ${(s.synonyms || []).join(' ')}`.trim()
          )

          const response = await this.embeddingProvider.embedBatch({ texts })

          for (let j = 0; j < batch.length; j++) {
            const substance = batch[j]
            const embedding = response.embeddings[j]
            if (!substance || !embedding) continue

            await this.db
              .update(substances)
              .set({
                embedding,
                embeddingUpdatedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(substances.id, substance.id))
          }

          result.processed += batch.length
          result.totalTokens += response.totalTokens
        } catch (error) {
          const errorMsg = `Substance batch ${Math.floor(i / this.BATCH_SIZE) + 1} failed: ${error instanceof Error ? error.message : String(error)}`
          this.logger.error(errorMsg)
          result.errors.push(errorMsg)
        }
      }

      result.estimatedCostUsd = this.embeddingProvider.estimateCost(result.totalTokens)
      this.logger.log(`Substance embeddings: ${result.processed} processed, ${result.totalTokens} tokens, $${result.estimatedCostUsd.toFixed(4)}`)
    } catch (error) {
      const errorMsg = `Substance embeddings failed: ${error instanceof Error ? error.message : String(error)}`
      this.logger.error(errorMsg)
      result.errors.push(errorMsg)
    }

    return result
  }

  /**
   * Generate embeddings for companies
   */
  async generateCompanyEmbeddings(companyId?: number): Promise<EntityEmbeddingResult> {
    const result: EntityEmbeddingResult = {
      entityType: 'company',
      processed: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      errors: [],
    }

    try {
      const companiesToProcess = await this.db
        .select({
          id: companies.id,
          name: companies.name,
          country: companies.country,
        })
        .from(companies)
        .where(
          companyId
            ? eq(companies.id, companyId)
            : isNull(companies.embedding)
        )
        .limit(1000)

      this.logger.log(`Processing ${companiesToProcess.length} companies for embeddings`)

      for (let i = 0; i < companiesToProcess.length; i += this.BATCH_SIZE) {
        const batch = companiesToProcess.slice(i, i + this.BATCH_SIZE)

        try {
          const texts = batch.map((c) =>
            `${c.name} ${c.country || ''}`.trim()
          )

          const response = await this.embeddingProvider.embedBatch({ texts })

          for (let j = 0; j < batch.length; j++) {
            const company = batch[j]
            const embedding = response.embeddings[j]
            if (!company || !embedding) continue

            await this.db
              .update(companies)
              .set({
                embedding,
                embeddingUpdatedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(companies.id, company.id))
          }

          result.processed += batch.length
          result.totalTokens += response.totalTokens
        } catch (error) {
          const errorMsg = `Company batch ${Math.floor(i / this.BATCH_SIZE) + 1} failed: ${error instanceof Error ? error.message : String(error)}`
          this.logger.error(errorMsg)
          result.errors.push(errorMsg)
        }
      }

      result.estimatedCostUsd = this.embeddingProvider.estimateCost(result.totalTokens)
      this.logger.log(`Company embeddings: ${result.processed} processed, ${result.totalTokens} tokens, $${result.estimatedCostUsd.toFixed(4)}`)
    } catch (error) {
      const errorMsg = `Company embeddings failed: ${error instanceof Error ? error.message : String(error)}`
      this.logger.error(errorMsg)
      result.errors.push(errorMsg)
    }

    return result
  }

  /**
   * Build search text for a product
   */
  private buildProductSearchText(product: {
    name: string
    internationalNonProprietaryName: string | null
    therapeuticIndication: string | null
    therapeuticAreaMesh: string | null
    atcCode: string | null
    pharmacotherapeuticGroup: string | null
  }): string {
    return [
      product.name,
      product.internationalNonProprietaryName,
      product.therapeuticIndication,
      product.therapeuticAreaMesh,
      product.atcCode,
      product.pharmacotherapeuticGroup,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  /**
   * Get entity embedding statistics
   */
  async getStats(): Promise<{
    products: { total: number; withEmbeddings: number }
    substances: { total: number; withEmbeddings: number }
    companies: { total: number; withEmbeddings: number }
  }> {
    const productTotal = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(medicinalProductsExtended)
    const productWithEmb = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(medicinalProductsExtended)
      .where(sql`embedding IS NOT NULL`)

    const substanceTotal = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(substances)
    const substanceWithEmb = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(substances)
      .where(sql`embedding IS NOT NULL`)

    const companyTotal = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
    const companyWithEmb = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(sql`embedding IS NOT NULL`)

    return {
      products: {
        total: Number(productTotal[0]?.count ?? 0),
        withEmbeddings: Number(productWithEmb[0]?.count ?? 0),
      },
      substances: {
        total: Number(substanceTotal[0]?.count ?? 0),
        withEmbeddings: Number(substanceWithEmb[0]?.count ?? 0),
      },
      companies: {
        total: Number(companyTotal[0]?.count ?? 0),
        withEmbeddings: Number(companyWithEmb[0]?.count ?? 0),
      },
    }
  }
}
