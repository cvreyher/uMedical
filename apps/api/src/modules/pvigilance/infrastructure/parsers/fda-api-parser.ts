import { Injectable, Logger } from '@nestjs/common'

import type { RawFeedEvent } from '../../application/services/event-normalizer.service'

/**
 * FDA openFDA API Response Types
 */
interface FdaEnforcementResult {
  recall_number: string
  reason_for_recall: string
  status: string
  distribution_pattern: string
  product_description: string
  product_quantity: string
  code_info: string
  recalling_firm: string
  report_date: string
  recall_initiation_date: string
  classification: string
  product_type: string
  event_id: string
  voluntary_mandated: string
  city?: string
  state?: string
  country?: string
}

interface FdaApiResponse {
  meta: {
    results: {
      total: number
      skip: number
      limit: number
    }
  }
  results: FdaEnforcementResult[]
}

/**
 * FDA API Parser
 *
 * Parses responses from the openFDA API endpoints:
 * - Drug Enforcement (recalls)
 * - Drug Events (adverse events)
 * - Drug Labels
 */
@Injectable()
export class FdaApiParser {
  private readonly logger = new Logger(FdaApiParser.name)

  /**
   * Fetch and parse FDA API endpoint
   */
  async parse(
    feedUrl: string,
    config?: Record<string, unknown>,
  ): Promise<RawFeedEvent[]> {
    try {
      // Build URL with query parameters
      const url = new URL(feedUrl)

      // Add query parameters from config
      const queryParams = config?.queryParams as Record<string, string> | undefined
      if (queryParams) {
        for (const [key, value] of Object.entries(queryParams)) {
          url.searchParams.set(key, value)
        }
      }

      // Add API key if provided
      const apiKey = config?.apiKey as string | undefined
      if (apiKey) {
        url.searchParams.set('api_key', apiKey)
      }

      this.logger.debug(`Fetching FDA API: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'uMedical/1.0 (+https://umedical.store; info@umedical.store)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(60000), // 60 second timeout
      })

      if (!response.ok) {
        // FDA API returns 404 when no results found
        if (response.status === 404) {
          this.logger.debug('FDA API returned no results')
          return []
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json() as FdaApiResponse

      // Determine which parser to use based on URL path
      if (feedUrl.includes('/drug/enforcement')) {
        return this.parseEnforcementResults(data.results)
      }

      // Default: try to parse as generic results
      return this.parseGenericResults(data.results)
    } catch (error) {
      this.logger.error(`Failed to parse FDA API ${feedUrl}`, error)
      throw error
    }
  }

  /**
   * Parse drug enforcement (recall) results
   */
  private parseEnforcementResults(results: FdaEnforcementResult[]): RawFeedEvent[] {
    return results.map(result => ({
      title: this.buildRecallTitle(result),
      description: this.buildRecallDescription(result),
      date: this.parseDate(result.report_date || result.recall_initiation_date),
      url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=${result.event_id}`,
      sourceId: result.recall_number || result.event_id,
      // FDA-specific fields
      recallClass: this.extractRecallClass(result.classification),
      reason: result.reason_for_recall,
      eventType: 'recall',
      lotNumbers: this.extractLotNumbers(result.code_info),
      distributionPattern: result.distribution_pattern,
      recallingFirm: result.recalling_firm,
      productDescription: result.product_description,
      voluntaryMandated: result.voluntary_mandated,
      status: result.status,
    }))
  }

  /**
   * Parse generic FDA API results
   */
  private parseGenericResults(results: any[]): RawFeedEvent[] {
    return results.map(result => ({
      title: result.product_description || result.brand_name || 'FDA Alert',
      description: result.reason_for_recall || result.reactions || '',
      date: result.report_date || result.receiptdate || new Date().toISOString(),
      url: this.buildFdaUrl(result),
      sourceId: result.recall_number || result.safetyreportid || result.event_id,
    }))
  }

  /**
   * Build a descriptive title for a recall
   */
  private buildRecallTitle(result: FdaEnforcementResult): string {
    const classification = this.extractRecallClass(result.classification)
    const firm = result.recalling_firm || 'Unknown Firm'

    let title = `Class ${classification} Recall: ${firm}`

    // Add product info if available
    if (result.product_description) {
      const shortDesc = result.product_description.substring(0, 100)
      title += ` - ${shortDesc}${result.product_description.length > 100 ? '...' : ''}`
    }

    return title
  }

  /**
   * Build a detailed description for a recall
   */
  private buildRecallDescription(result: FdaEnforcementResult): string {
    const parts: string[] = []

    if (result.reason_for_recall) {
      parts.push(`Reason: ${result.reason_for_recall}`)
    }

    if (result.product_description) {
      parts.push(`Product: ${result.product_description}`)
    }

    if (result.distribution_pattern) {
      parts.push(`Distribution: ${result.distribution_pattern}`)
    }

    if (result.product_quantity) {
      parts.push(`Quantity: ${result.product_quantity}`)
    }

    return parts.join('\n\n')
  }

  /**
   * Extract recall class from classification string
   */
  private extractRecallClass(classification: string): string {
    if (!classification) return 'Unknown'

    const match = classification.match(/Class\s+(I{1,3})/i)
    if (match) {
      return match[1]!
    }

    // Try numeric format
    const numMatch = classification.match(/(\d)/i)
    if (numMatch) {
      const num = parseInt(numMatch[1]!, 10)
      return ['I', 'II', 'III'][num - 1] || classification
    }

    return classification
  }

  /**
   * Extract lot numbers from code info
   */
  private extractLotNumbers(codeInfo: string): string[] {
    if (!codeInfo) return []

    // Common patterns for lot numbers
    const patterns = [
      /lot[s]?\s*(?:#|number[s]?|no\.?)?\s*:?\s*([A-Z0-9-]+(?:,\s*[A-Z0-9-]+)*)/gi,
      /batch[es]?\s*(?:#|number[s]?|no\.?)?\s*:?\s*([A-Z0-9-]+(?:,\s*[A-Z0-9-]+)*)/gi,
    ]

    const lots: Set<string> = new Set()

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(codeInfo)) !== null) {
        const lotStr = match[1]!
        for (const lot of lotStr.split(/,\s*/)) {
          if (lot.trim()) {
            lots.add(lot.trim().toUpperCase())
          }
        }
      }
    }

    return Array.from(lots)
  }

  /**
   * Parse FDA date formats
   */
  private parseDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString()

    // FDA uses YYYYMMDD format
    if (/^\d{8}$/.test(dateStr)) {
      const year = dateStr.substring(0, 4)
      const month = dateStr.substring(4, 6)
      const day = dateStr.substring(6, 8)
      return `${year}-${month}-${day}`
    }

    // Try standard parsing
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]!
    }

    return new Date().toISOString().split('T')[0]!
  }

  /**
   * Build FDA URL for a result
   */
  private buildFdaUrl(result: any): string {
    if (result.event_id) {
      return `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=${result.event_id}`
    }
    if (result.recall_number) {
      return `https://www.fda.gov/search?s=${encodeURIComponent(result.recall_number)}`
    }
    return 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts'
  }
}
