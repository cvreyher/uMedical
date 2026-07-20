import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Supported ePI languages (ISO 639-1 codes)
 */
export const EPI_LANGUAGES = [
  'en', // English
  'bg', // Bulgarian
  'cs', // Czech
  'da', // Danish
  'de', // German
  'el', // Greek
  'es', // Spanish
  'et', // Estonian
  'fi', // Finnish
  'fr', // French
  'ga', // Irish
  'hr', // Croatian
  'hu', // Hungarian
  'is', // Icelandic
  'it', // Italian
  'lv', // Latvian
  'lt', // Lithuanian
  'mt', // Maltese
  'nl', // Dutch
  'no', // Norwegian
  'pl', // Polish
  'pt', // Portuguese
  'ro', // Romanian
  'sk', // Slovak
  'sl', // Slovenian
  'sv', // Swedish
] as const

export type EpiLanguage = (typeof EPI_LANGUAGES)[number]

/**
 * Regulatory Agency Organization IDs
 */
export const REGULATORY_AGENCIES = {
  EMA: 'ORG-100013412', // European Medicines Agency
  DKMA: 'ORG-100003918', // Denmark
  MEB: 'ORG-100003934', // Netherlands
  AEMPS: 'ORG-100003943', // Spain
  MPA: 'ORG-100003944', // Sweden
} as const

/**
 * ePI List item from ListBySearchParameter
 */
export interface EpiListItem {
  id: string
  title: string
  productName?: string
  regulatoryAgency?: string
  lastUpdated?: string
}

/**
 * ePI Bundle (FHIR Bundle resource)
 */
export interface EpiBundle {
  resourceType: 'Bundle'
  id: string
  meta?: {
    lastUpdated?: string
    versionId?: string
  }
  type: string
  entry?: Array<{
    fullUrl?: string
    resource: EpiFhirResource
  }>
}

/**
 * Generic FHIR resource in ePI bundle
 */
export interface EpiFhirResource {
  resourceType: string
  id: string
  language?: string
  text?: {
    status: string
    div: string // HTML content
  }
  [key: string]: unknown
}

/**
 * Extracted ePI document content
 */
export interface EpiDocumentContent {
  bundleId: string
  productName: string
  documentType: 'smpc' | 'pl' | 'annex' | 'labelling' | 'other'
  language: EpiLanguage
  sections: Array<{
    code: string
    title: string
    htmlContent: string
    textContent: string
  }>
  lastUpdated?: string
  rawBundle: EpiBundle
}

/**
 * EMA ePI (Electronic Product Information) API Client
 *
 * Accesses structured FHIR data for EU medicines.
 * No API key required (public API).
 *
 * Rate limit: minimum 3 seconds between requests
 *
 * @see https://epi.developer.ema.europa.eu/api-details
 */
@Injectable()
export class EpiApiClient {
  private readonly logger = new Logger(EpiApiClient.name)
  private readonly baseUrl = 'https://epi.ema.europa.eu/api'
  private readonly rateLimitMs = 3000 // 3 seconds between requests
  private lastRequestTime = 0

  constructor(private readonly configService: ConfigService) {}

  /**
   * Search for ePI lists by title
   */
  async listByTitle(title: string): Promise<EpiListItem[]> {
    await this.respectRateLimit()

    const url = `${this.baseUrl}/retrieval/ListBySearchParameter?title=${encodeURIComponent(title)}`
    const response = await this.fetch(url)

    return this.parseListResponse(response)
  }

  /**
   * Search for ePI lists by regulatory agency
   */
  async listByAgency(agencyOrgId: string): Promise<EpiListItem[]> {
    await this.respectRateLimit()

    const url = `${this.baseUrl}/retrieval/ListBySearchParameter?regulatoryAgency=${encodeURIComponent(agencyOrgId)}`
    const response = await this.fetch(url)

    return this.parseListResponse(response)
  }

  /**
   * Get all EMA ePI lists
   */
  async listAllEma(): Promise<EpiListItem[]> {
    return this.listByAgency(REGULATORY_AGENCIES.EMA)
  }

  /**
   * Get ePI List by ID (returns bundle IDs for all documents in the ePI)
   */
  async getListById(listId: string): Promise<string[]> {
    await this.respectRateLimit()

    const url = `${this.baseUrl}/retrieval/ListById?id=${encodeURIComponent(listId)}`
    const response = await this.fetch(url)

    // Extract bundle IDs from the list
    return this.extractBundleIds(response)
  }

  /**
   * Get Bundle by ID (returns full document content)
   */
  async getBundleById(bundleId: string): Promise<EpiBundle> {
    await this.respectRateLimit()

    const url = `${this.baseUrl}/retrieval/BundleById?id=${encodeURIComponent(bundleId)}`
    return this.fetch(url) as Promise<EpiBundle>
  }

  /**
   * Search for bundles by PMS ID (Product Management System ID)
   */
  async getBundleByPmsId(pmsId: string, language?: EpiLanguage): Promise<EpiBundle | null> {
    await this.respectRateLimit()

    let url = `${this.baseUrl}/fhir/BundleBySearchParameter?pmsId=${encodeURIComponent(pmsId)}`
    if (language) {
      url += `&language=${language}`
    }

    try {
      return (await this.fetch(url)) as EpiBundle
    } catch (error) {
      this.logger.warn(`No bundle found for PMS ID ${pmsId}: ${error}`)
      return null
    }
  }

  /**
   * Get all available language versions for a product
   */
  async getAvailableLanguages(pmsId: string): Promise<EpiLanguage[]> {
    const languages: EpiLanguage[] = []

    // Check each language (this is expensive but necessary without a dedicated endpoint)
    for (const lang of EPI_LANGUAGES) {
      try {
        const bundle = await this.getBundleByPmsId(pmsId, lang)
        if (bundle) {
          languages.push(lang)
        }
      } catch {
        // Language not available
      }
    }

    return languages
  }

  /**
   * Extract document content from a bundle
   */
  extractDocumentContent(bundle: EpiBundle, language: EpiLanguage): EpiDocumentContent {
    const sections: EpiDocumentContent['sections'] = []
    let productName = ''
    let documentType: EpiDocumentContent['documentType'] = 'other'

    // Parse bundle entries
    for (const entry of bundle.entry || []) {
      const resource = entry.resource

      // Extract product name from MedicinalProductDefinition
      if (resource.resourceType === 'MedicinalProductDefinition') {
        productName = this.extractProductName(resource)
      }

      // Extract sections from Composition
      if (resource.resourceType === 'Composition') {
        documentType = this.classifyDocumentType(resource)
        const compositionSections = this.extractSections(resource)
        sections.push(...compositionSections)
      }
    }

    return {
      bundleId: bundle.id,
      productName,
      documentType,
      language,
      sections,
      lastUpdated: bundle.meta?.lastUpdated,
      rawBundle: bundle,
    }
  }

  /**
   * Convert HTML content to plain text (for chunking)
   */
  htmlToText(html: string): string {
    // Remove HTML tags and decode entities
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }

  private async fetch(url: string): Promise<unknown> {
    this.logger.debug(`Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: 'application/fhir+json',
        'User-Agent': 'uMedical/1.0 (+https://github.com/cvreyher/uMedical)',
      },
    })

    if (!response.ok) {
      throw new Error(`ePI API error: ${response.status} ${response.statusText}`)
    }

    this.lastRequestTime = Date.now()
    return response.json()
  }

  private async respectRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime
    if (elapsed < this.rateLimitMs) {
      await this.sleep(this.rateLimitMs - elapsed)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private parseListResponse(response: unknown): EpiListItem[] {
    // FHIR Bundle response parsing
    const bundle = response as { entry?: Array<{ resource: unknown }> }
    if (!bundle.entry) return []

    return bundle.entry.map((entry) => {
      const resource = entry.resource as Record<string, unknown>
      return {
        id: resource.id as string,
        title: (resource.title as string) || '',
        productName: this.extractProductNameFromList(resource),
        lastUpdated: (resource.meta as Record<string, unknown>)?.lastUpdated as string,
      }
    })
  }

  private extractBundleIds(response: unknown): string[] {
    const list = response as { entry?: Array<{ item?: { reference?: string } }> }
    if (!list.entry) return []

    return list.entry
      .filter((entry) => entry.item?.reference)
      .map((entry) => {
        // Extract ID from reference like "Bundle/123"
        const ref = entry.item!.reference!
        return ref.split('/').pop() || ref
      })
  }

  private extractProductName(resource: EpiFhirResource): string {
    const name = (resource as Record<string, unknown>).name
    if (Array.isArray(name) && name.length > 0) {
      return (name[0] as Record<string, unknown>).productName as string || ''
    }
    return ''
  }

  private extractProductNameFromList(resource: Record<string, unknown>): string {
    // Try to extract from title or subject
    const title = resource.title as string
    if (title) {
      // Extract product name from title like "SmPC - ProductName"
      const match = title.match(/(?:SmPC|Package Leaflet|Annex)\s*[-–]\s*(.+)/i)
      if (match?.[1]) return match[1].trim()
    }
    return ''
  }

  private classifyDocumentType(composition: EpiFhirResource): EpiDocumentContent['documentType'] {
    const type = (composition as Record<string, unknown>).type as Record<string, unknown>
    const coding = type?.coding as Array<{ code?: string; display?: string }> | undefined

    if (coding?.[0]) {
      const code = coding[0].code?.toLowerCase() || ''
      const display = coding[0].display?.toLowerCase() || ''

      if (code.includes('smpc') || display.includes('summary of product')) return 'smpc'
      if (code.includes('pl') || display.includes('package leaflet')) return 'pl'
      if (code.includes('annex') || display.includes('annex')) return 'annex'
      if (code.includes('label') || display.includes('labelling')) return 'labelling'
    }

    return 'other'
  }

  private extractSections(composition: EpiFhirResource): EpiDocumentContent['sections'] {
    const sections: EpiDocumentContent['sections'] = []
    const rawSections = (composition as Record<string, unknown>).section as Array<{
      code?: { coding?: Array<{ code?: string; display?: string }> }
      title?: string
      text?: { div?: string }
      section?: unknown[]
    }> | undefined

    if (!rawSections) return sections

    const processSection = (section: typeof rawSections[0], prefix = '') => {
      const code = section.code?.coding?.[0]?.code || 'unknown'
      const title = section.title || section.code?.coding?.[0]?.display || ''
      const htmlContent = section.text?.div || ''
      const textContent = this.htmlToText(htmlContent)

      if (textContent.length > 0) {
        sections.push({
          code: prefix ? `${prefix}.${code}` : code,
          title,
          htmlContent,
          textContent,
        })
      }

      // Process nested sections
      if (section.section) {
        for (const nested of section.section as typeof rawSections) {
          processSection(nested, code)
        }
      }
    }

    for (const section of rawSections) {
      processSection(section)
    }

    return sections
  }
}
