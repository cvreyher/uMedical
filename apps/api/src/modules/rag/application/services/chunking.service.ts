import { Inject, Injectable, Logger } from '@nestjs/common'
import { documentChunks } from '@workspace/database'
import { eq } from 'drizzle-orm'
import * as crypto from 'crypto'

import { DB_TOKEN } from '@/shared-kernel/infrastructure/db/db.port'

import type { Document, DocumentChunk, NewDocumentChunk } from '@workspace/database'
import type { DrizzleDb } from '@/shared-kernel/infrastructure/db/db.port'

interface ChunkResult {
  content: string
  sectionType: string | null
  sectionTitle: string | null
}

/**
 * Service for splitting document text into semantic chunks
 *
 * Strategies:
 * - Section-aware chunking for SmPC (17 numbered sections)
 * - Fixed-size fallback (300-500 tokens, 50 token overlap)
 * - Content hash for deduplication
 */
@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name)

  // Chunk size configuration
  private readonly TARGET_CHUNK_SIZE = 400 // tokens
  private readonly MIN_CHUNK_SIZE = 100 // tokens
  private readonly MAX_CHUNK_SIZE = 500 // tokens
  private readonly CHUNK_OVERLAP = 50 // tokens

  // Approximate chars per token for estimation
  private readonly CHARS_PER_TOKEN = 4

  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  /**
   * Chunk a document and store in database
   */
  async chunkDocument(doc: Document, text: string): Promise<DocumentChunk[]> {
    // First, delete any existing chunks for this document
    await this.db.delete(documentChunks).where(eq(documentChunks.documentId, doc.id))

    // Split text into chunks based on document type
    let chunks: ChunkResult[]
    if (doc.documentType === 'smpc') {
      chunks = this.chunkSmpc(text)
    } else if (doc.documentType === 'pl') {
      chunks = this.chunkPackageLeaflet(text)
    } else {
      chunks = this.chunkGeneric(text)
    }

    this.logger.log(`Created ${chunks.length} chunks for document ${doc.id}`)

    // Store chunks in database
    const insertedChunks: DocumentChunk[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (!chunk) continue

      const contentHash = this.hashContent(chunk.content)
      const charCount = chunk.content.length
      const tokenCount = Math.ceil(charCount / this.CHARS_PER_TOKEN)

      const newChunk: NewDocumentChunk = {
        documentId: doc.id,
        productId: doc.productId,
        chunkIndex: i,
        sectionType: chunk.sectionType,
        sectionTitle: chunk.sectionTitle,
        content: chunk.content,
        contentHash,
        language: doc.language,
        charCount,
        tokenCount,
        extractorVersion: '1.0',
      }

      const [inserted] = await this.db.insert(documentChunks).values(newChunk).returning()

      if (inserted) {
        insertedChunks.push(inserted)
      }
    }

    return insertedChunks
  }

  /**
   * Section-aware chunking for SmPC (Summary of Product Characteristics)
   * SmPC has 17 standard numbered sections
   */
  private chunkSmpc(text: string): ChunkResult[] {
    const chunks: ChunkResult[] = []

    // SmPC section patterns
    const sectionPatterns = [
      { pattern: /\b1\.\s*NAME OF THE MEDICINAL PRODUCT/i, type: 'smpc_1', title: '1. Name' },
      { pattern: /\b2\.\s*QUALITATIVE AND QUANTITATIVE COMPOSITION/i, type: 'smpc_2', title: '2. Composition' },
      { pattern: /\b3\.\s*PHARMACEUTICAL FORM/i, type: 'smpc_3', title: '3. Pharmaceutical Form' },
      { pattern: /\b4\.1\s*THERAPEUTIC INDICATIONS/i, type: 'smpc_4.1', title: '4.1 Therapeutic Indications' },
      { pattern: /\b4\.2\s*POSOLOGY AND METHOD OF ADMINISTRATION/i, type: 'smpc_4.2', title: '4.2 Posology' },
      { pattern: /\b4\.3\s*CONTRAINDICATIONS/i, type: 'smpc_4.3', title: '4.3 Contraindications' },
      { pattern: /\b4\.4\s*SPECIAL WARNINGS/i, type: 'smpc_4.4', title: '4.4 Special Warnings' },
      { pattern: /\b4\.5\s*INTERACTION/i, type: 'smpc_4.5', title: '4.5 Interactions' },
      { pattern: /\b4\.6\s*FERTILITY, PREGNANCY AND LACTATION/i, type: 'smpc_4.6', title: '4.6 Fertility/Pregnancy' },
      { pattern: /\b4\.7\s*EFFECTS ON ABILITY TO DRIVE/i, type: 'smpc_4.7', title: '4.7 Driving' },
      { pattern: /\b4\.8\s*UNDESIRABLE EFFECTS/i, type: 'smpc_4.8', title: '4.8 Undesirable Effects' },
      { pattern: /\b4\.9\s*OVERDOSE/i, type: 'smpc_4.9', title: '4.9 Overdose' },
      { pattern: /\b5\.1\s*PHARMACODYNAMIC PROPERTIES/i, type: 'smpc_5.1', title: '5.1 Pharmacodynamics' },
      { pattern: /\b5\.2\s*PHARMACOKINETIC PROPERTIES/i, type: 'smpc_5.2', title: '5.2 Pharmacokinetics' },
      { pattern: /\b5\.3\s*PRECLINICAL SAFETY DATA/i, type: 'smpc_5.3', title: '5.3 Preclinical Data' },
      { pattern: /\b6\.\s*PHARMACEUTICAL PARTICULARS/i, type: 'smpc_6', title: '6. Pharmaceutical Particulars' },
    ]

    // Find all section positions
    const sections: Array<{ start: number; type: string; title: string }> = []
    for (const sp of sectionPatterns) {
      const match = text.match(sp.pattern)
      if (match && match.index !== undefined) {
        sections.push({ start: match.index, type: sp.type, title: sp.title })
      }
    }

    // Sort by position
    sections.sort((a, b) => a.start - b.start)

    if (sections.length === 0) {
      // No sections found, fall back to generic chunking
      return this.chunkGeneric(text)
    }

    // Extract each section
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      if (!section) continue

      const nextSection = sections[i + 1]
      const sectionText = nextSection
        ? text.slice(section.start, nextSection.start)
        : text.slice(section.start)

      // If section is too large, split it further
      const sectionChunks = this.splitLargeText(sectionText.trim(), section.type, section.title)
      chunks.push(...sectionChunks)
    }

    return chunks
  }

  /**
   * Section-aware chunking for Package Leaflet
   * Standard sections: What it is, Before you take, How to take, Possible side effects, Storage, Contents
   */
  private chunkPackageLeaflet(text: string): ChunkResult[] {
    const chunks: ChunkResult[] = []

    const sectionPatterns = [
      { pattern: /\bWhat .+ is and what it is used for/i, type: 'pl_1', title: 'What it is' },
      { pattern: /\bWhat you need to know before/i, type: 'pl_2', title: 'Before taking' },
      { pattern: /\bHow to (take|use)/i, type: 'pl_3', title: 'How to take' },
      { pattern: /\bPossible side effects/i, type: 'pl_4', title: 'Side effects' },
      { pattern: /\bHow to store/i, type: 'pl_5', title: 'Storage' },
      { pattern: /\bContents of the pack/i, type: 'pl_6', title: 'Contents' },
    ]

    const sections: Array<{ start: number; type: string; title: string }> = []
    for (const sp of sectionPatterns) {
      const match = text.match(sp.pattern)
      if (match && match.index !== undefined) {
        sections.push({ start: match.index, type: sp.type, title: sp.title })
      }
    }

    sections.sort((a, b) => a.start - b.start)

    if (sections.length === 0) {
      return this.chunkGeneric(text)
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      if (!section) continue

      const nextSection = sections[i + 1]
      const sectionText = nextSection
        ? text.slice(section.start, nextSection.start)
        : text.slice(section.start)

      const sectionChunks = this.splitLargeText(sectionText.trim(), section.type, section.title)
      chunks.push(...sectionChunks)
    }

    return chunks
  }

  /**
   * Generic fixed-size chunking with overlap
   */
  private chunkGeneric(text: string): ChunkResult[] {
    return this.splitLargeText(text, null, null)
  }

  /**
   * Split large text into chunks of target size with overlap
   */
  private splitLargeText(
    text: string,
    sectionType: string | null,
    sectionTitle: string | null
  ): ChunkResult[] {
    const chunks: ChunkResult[] = []
    const targetChars = this.TARGET_CHUNK_SIZE * this.CHARS_PER_TOKEN
    const overlapChars = this.CHUNK_OVERLAP * this.CHARS_PER_TOKEN
    const minChars = this.MIN_CHUNK_SIZE * this.CHARS_PER_TOKEN

    // If text is small enough, return as single chunk
    if (text.length <= targetChars * 1.2) {
      if (text.trim().length >= minChars) {
        chunks.push({
          content: text.trim(),
          sectionType,
          sectionTitle,
        })
      }
      return chunks
    }

    // Split by paragraphs first, then sentences
    const paragraphs = text.split(/\n\n+/)

    let currentChunk = ''

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed max size
      if ((currentChunk + '\n\n' + paragraph).length > targetChars) {
        // Save current chunk if it has content
        if (currentChunk.trim().length >= minChars) {
          chunks.push({
            content: currentChunk.trim(),
            sectionType,
            sectionTitle,
          })
        }

        // Start new chunk with overlap from previous
        if (chunks.length > 0 && currentChunk.length > overlapChars) {
          // Get last overlapChars of previous chunk
          const overlap = currentChunk.slice(-overlapChars)
          currentChunk = overlap + '\n\n' + paragraph
        } else {
          currentChunk = paragraph
        }
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length >= minChars) {
      chunks.push({
        content: currentChunk.trim(),
        sectionType,
        sectionTitle,
      })
    }

    return chunks
  }

  /**
   * Generate SHA-256 hash of content for deduplication
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Get chunking statistics
   */
  async getChunkingStats(): Promise<{
    totalChunks: number
    bySection: Record<string, number>
    avgChunkSize: number
    minChunkSize: number
    maxChunkSize: number
  }> {
    const allChunks = await this.db
      .select({
        sectionType: documentChunks.sectionType,
        tokenCount: documentChunks.tokenCount,
      })
      .from(documentChunks)

    const bySection: Record<string, number> = {}
    let totalTokens = 0
    let minTokens = Infinity
    let maxTokens = 0

    for (const chunk of allChunks) {
      const section = chunk.sectionType || 'generic'
      bySection[section] = (bySection[section] || 0) + 1

      const tokens = chunk.tokenCount || 0
      totalTokens += tokens
      minTokens = Math.min(minTokens, tokens)
      maxTokens = Math.max(maxTokens, tokens)
    }

    return {
      totalChunks: allChunks.length,
      bySection,
      avgChunkSize: allChunks.length > 0 ? Math.round(totalTokens / allChunks.length) : 0,
      minChunkSize: minTokens === Infinity ? 0 : minTokens,
      maxChunkSize: maxTokens,
    }
  }
}
