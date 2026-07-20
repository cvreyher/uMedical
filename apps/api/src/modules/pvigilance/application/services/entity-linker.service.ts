import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  substances,
  medicinalProducts,
  productSubstances,
  pvigilanceEventProducts,
  pvigilanceEventSubstances,
} from '@workspace/database'
import { eq, ilike, or, sql } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

/**
 * Matched entity with confidence score
 */
export interface MatchedEntity {
  id: number
  slug: string
  name: string
  matchType: 'exact' | 'synonym' | 'extracted' | 'fuzzy' | 'inn'
  matchConfidence: number
  matchSource: string
}

/**
 * Entity Linker Service
 *
 * Links pharmacovigilance events to EMA entities (products and substances)
 * using INN (International Nonproprietary Name) as the primary identifier.
 *
 * Matching strategies:
 * 1. Exact INN match - highest confidence
 * 2. Synonym match - uses substance synonyms array
 * 3. Product name match - matches against product names
 * 4. Fuzzy match - partial matching with lower confidence
 */
@Injectable()
export class EntityLinkerService {
  private readonly logger = new Logger(EntityLinkerService.name)

  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  /**
   * Extract potential drug names and INNs from event text
   */
  extractDrugNames(title: string, description?: string | null): string[] {
    const text = `${title} ${description || ''}`.toLowerCase()
    const names: Set<string> = new Set()

    // Common patterns for drug names in safety communications
    // Pattern 1: "Drug name (brand)" or "brand (drug name)"
    const parenthesesPattern = /\b([a-z]+)\s*\(([^)]+)\)/gi
    let match
    while ((match = parenthesesPattern.exec(text)) !== null) {
      names.add(match[1]!.trim())
      names.add(match[2]!.trim())
    }

    // Pattern 2: "containing [drug name]"
    const containingPattern = /containing\s+([a-z]+(?:\s+[a-z]+)?)/gi
    while ((match = containingPattern.exec(text)) !== null) {
      names.add(match[1]!.trim())
    }

    // Pattern 3: Words that look like drug names (typically end in common suffixes)
    const drugSuffixes = ['mab', 'nib', 'vir', 'stat', 'pril', 'sartan', 'olol', 'azole', 'mycin', 'cillin', 'oxacin']
    const wordPattern = /\b([a-z]{4,}(?:mab|nib|vir|stat|pril|sartan|olol|azole|mycin|cillin|oxacin))\b/gi
    while ((match = wordPattern.exec(text)) !== null) {
      names.add(match[1]!.trim())
    }

    // Pattern 4: Capitalized words that might be brand names
    const brandPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g
    const originalText = `${title} ${description || ''}`
    while ((match = brandPattern.exec(originalText)) !== null) {
      const word = match[1]!.trim().toLowerCase()
      // Filter out common non-drug words
      if (!this.isCommonWord(word) && word.length >= 4) {
        names.add(word)
      }
    }

    return Array.from(names).filter(n => n.length >= 3)
  }

  /**
   * Find matching substances by INN
   */
  async findMatchingSubstances(drugNames: string[]): Promise<MatchedEntity[]> {
    if (drugNames.length === 0) return []

    const matches: MatchedEntity[] = []

    for (const name of drugNames) {
      // Try exact INN match first
      const exactMatches = await this.db
        .select({
          id: substances.id,
          slug: substances.slug,
          innName: substances.innName,
        })
        .from(substances)
        .where(ilike(substances.innName, name))
        .limit(5)

      for (const sub of exactMatches) {
        matches.push({
          id: sub.id,
          slug: sub.slug,
          name: sub.innName,
          matchType: 'exact',
          matchConfidence: 1.0,
          matchSource: 'inn_name',
        })
      }

      // Try partial/fuzzy match
      if (exactMatches.length === 0 && name.length >= 4) {
        const fuzzyMatches = await this.db
          .select({
            id: substances.id,
            slug: substances.slug,
            innName: substances.innName,
          })
          .from(substances)
          .where(
            or(
              ilike(substances.innName, `${name}%`),
              ilike(substances.innName, `%${name}`),
            )
          )
          .limit(3)

        for (const sub of fuzzyMatches) {
          matches.push({
            id: sub.id,
            slug: sub.slug,
            name: sub.innName,
            matchType: 'fuzzy',
            matchConfidence: 0.7,
            matchSource: 'inn_name_partial',
          })
        }
      }
    }

    // Deduplicate by ID, keeping highest confidence
    const deduped = new Map<number, MatchedEntity>()
    for (const match of matches) {
      const existing = deduped.get(match.id)
      if (!existing || existing.matchConfidence < match.matchConfidence) {
        deduped.set(match.id, match)
      }
    }

    return Array.from(deduped.values())
  }

  /**
   * Find matching products by substance or name
   */
  async findMatchingProducts(
    matchedSubstances: MatchedEntity[],
    drugNames: string[],
  ): Promise<MatchedEntity[]> {
    const matches: MatchedEntity[] = []

    // Find products containing matched substances
    for (const substance of matchedSubstances) {
      const productMatches = await this.db
        .select({
          id: medicinalProducts.id,
          slug: medicinalProducts.slug,
          name: medicinalProducts.name,
        })
        .from(medicinalProducts)
        .innerJoin(
          productSubstances,
          eq(medicinalProducts.id, productSubstances.productId)
        )
        .where(eq(productSubstances.substanceId, substance.id))
        .limit(10)

      for (const prod of productMatches) {
        matches.push({
          id: prod.id,
          slug: prod.slug,
          name: prod.name,
          matchType: 'inn',
          matchConfidence: substance.matchConfidence * 0.9,
          matchSource: `substance:${substance.name}`,
        })
      }
    }

    // Also try direct product name matching
    for (const name of drugNames) {
      const directMatches = await this.db
        .select({
          id: medicinalProducts.id,
          slug: medicinalProducts.slug,
          name: medicinalProducts.name,
        })
        .from(medicinalProducts)
        .where(ilike(medicinalProducts.name, `%${name}%`))
        .limit(5)

      for (const prod of directMatches) {
        // Check if this is likely a brand name match
        const isExact = prod.name.toLowerCase() === name.toLowerCase()
        matches.push({
          id: prod.id,
          slug: prod.slug,
          name: prod.name,
          matchType: isExact ? 'exact' : 'fuzzy',
          matchConfidence: isExact ? 0.95 : 0.6,
          matchSource: 'product_name',
        })
      }
    }

    // Deduplicate by ID, keeping highest confidence
    const deduped = new Map<number, MatchedEntity>()
    for (const match of matches) {
      const existing = deduped.get(match.id)
      if (!existing || existing.matchConfidence < match.matchConfidence) {
        deduped.set(match.id, match)
      }
    }

    return Array.from(deduped.values())
  }

  /**
   * Link an event to matched entities
   */
  async linkEventToEntities(
    eventId: number,
    matchedSubstances: MatchedEntity[],
    matchedProducts: MatchedEntity[],
    extractedInns: string[],
  ): Promise<{
    substanceLinks: number
    productLinks: number
  }> {
    let substanceLinks = 0
    let productLinks = 0

    // Link to substances
    for (const substance of matchedSubstances) {
      try {
        await this.db
          .insert(pvigilanceEventSubstances)
          .values({
            eventId,
            substanceId: substance.id,
            inn: substance.name,
            matchType: substance.matchType,
            matchConfidence: substance.matchConfidence,
            matchSource: substance.matchSource,
          })
          .onConflictDoNothing()

        substanceLinks++
      } catch (error) {
        this.logger.warn(`Failed to link event ${eventId} to substance ${substance.id}: ${error}`)
      }
    }

    // Also store extracted INNs that didn't match any substance
    // This allows future matching when substances are added
    for (const inn of extractedInns) {
      const alreadyLinked = matchedSubstances.some(
        s => s.name.toLowerCase() === inn.toLowerCase()
      )
      if (!alreadyLinked) {
        try {
          await this.db
            .insert(pvigilanceEventSubstances)
            .values({
              eventId,
              substanceId: null, // No matching substance in DB
              inn: inn.toLowerCase(),
              matchType: 'extracted',
              matchConfidence: 0.5,
              matchSource: 'text_extraction',
            })
            .onConflictDoNothing()

          substanceLinks++
        } catch (error) {
          // Likely duplicate, ignore
        }
      }
    }

    // Link to products
    for (const product of matchedProducts) {
      try {
        await this.db
          .insert(pvigilanceEventProducts)
          .values({
            eventId,
            productId: product.id,
            matchType: product.matchType,
            matchConfidence: product.matchConfidence,
            matchSource: product.matchSource,
          })
          .onConflictDoNothing()

        productLinks++
      } catch (error) {
        this.logger.warn(`Failed to link event ${eventId} to product ${product.id}: ${error}`)
      }
    }

    return { substanceLinks, productLinks }
  }

  /**
   * Check if a word is a common non-drug word
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'been',
      'drug', 'drugs', 'medicine', 'medicines', 'product', 'products',
      'recall', 'alert', 'safety', 'update', 'warning', 'information',
      'healthcare', 'professional', 'patient', 'patients', 'risk', 'risks',
      'use', 'used', 'using', 'may', 'can', 'should', 'will', 'would',
      'class', 'type', 'form', 'dose', 'dosage', 'tablet', 'tablets',
      'injection', 'solution', 'suspension', 'cream', 'ointment',
      'voluntary', 'mandatory', 'immediate', 'urgent', 'important',
      'january', 'february', 'march', 'april', 'june', 'july',
      'august', 'september', 'october', 'november', 'december',
    ])
    return commonWords.has(word.toLowerCase())
  }
}
