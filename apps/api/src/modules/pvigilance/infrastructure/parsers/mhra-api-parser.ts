import { Injectable, Logger } from '@nestjs/common'

import type { RawFeedEvent } from '../../application/services/event-normalizer.service'

/**
 * GOV.UK Content API Response Types
 */
interface GovUkSearchResult {
  title: string
  description?: string
  link: string
  public_timestamp: string
  content_store_document_type?: string
  organisations?: Array<{
    title: string
    slug: string
  }>
}

interface GovUkSearchResponse {
  results: GovUkSearchResult[]
  total: number
  start: number
  facets?: Record<string, unknown>
}

/**
 * MHRA API Parser
 *
 * Parses responses from the GOV.UK Content API for MHRA content.
 * The MHRA publishes drug safety updates through the GOV.UK platform.
 */
@Injectable()
export class MhraApiParser {
  private readonly logger = new Logger(MhraApiParser.name)

  /**
   * Fetch and parse MHRA content from GOV.UK API
   */
  async parse(
    feedUrl: string,
    config?: Record<string, unknown>,
  ): Promise<RawFeedEvent[]> {
    try {
      // GOV.UK search API endpoint
      const searchUrl = 'https://www.gov.uk/api/search.json'
      const url = new URL(searchUrl)

      // Filter for MHRA content
      url.searchParams.set('filter_organisations', 'medicines-and-healthcare-products-regulatory-agency')
      url.searchParams.set('filter_content_purpose_supergroup', 'guidance_and_regulation')
      url.searchParams.set('count', '50')
      url.searchParams.set('order', '-public_timestamp')

      // Add any additional query parameters from config
      const queryParams = config?.queryParams as Record<string, string> | undefined
      if (queryParams) {
        for (const [key, value] of Object.entries(queryParams)) {
          url.searchParams.set(key, value)
        }
      }

      this.logger.debug(`Fetching MHRA content: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'uMedical/1.0 (+https://github.com/cvreyher/uMedical)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json() as GovUkSearchResponse

      // Filter for drug safety related content
      const safetyResults = data.results.filter(result =>
        this.isDrugSafetyContent(result)
      )

      return this.parseSearchResults(safetyResults)
    } catch (error) {
      this.logger.error(`Failed to parse MHRA API ${feedUrl}`, error)
      throw error
    }
  }

  /**
   * Check if content is drug safety related
   */
  private isDrugSafetyContent(result: GovUkSearchResult): boolean {
    const title = result.title?.toLowerCase() || ''
    const description = result.description?.toLowerCase() || ''
    const content = `${title} ${description}`

    const safetyKeywords = [
      'drug safety',
      'safety update',
      'dhpc',
      'direct healthcare',
      'recall',
      'alert',
      'patient safety',
      'medicine safety',
      'adverse',
      'side effect',
      'risk',
      'warning',
      'caution',
      'contraindication',
    ]

    return safetyKeywords.some(keyword => content.includes(keyword))
  }

  /**
   * Parse search results into raw events
   */
  private parseSearchResults(results: GovUkSearchResult[]): RawFeedEvent[] {
    return results.map(result => ({
      title: result.title,
      description: result.description || '',
      date: result.public_timestamp || new Date().toISOString(),
      url: `https://www.gov.uk${result.link}`,
      sourceId: result.link,
      // MHRA-specific fields
      contentType: result.content_store_document_type,
      eventType: this.determineEventType(result),
    }))
  }

  /**
   * Determine event type from content
   */
  private determineEventType(result: GovUkSearchResult): string {
    const title = result.title?.toLowerCase() || ''
    const description = result.description?.toLowerCase() || ''
    const content = `${title} ${description}`

    if (content.includes('dhpc') || content.includes('direct healthcare professional')) {
      return 'dhpc'
    }
    if (content.includes('recall')) {
      return 'recall'
    }
    if (content.includes('drug safety update')) {
      return 'safety_update'
    }
    if (content.includes('alert')) {
      return 'alert'
    }

    return 'safety_update'
  }
}
