import { Injectable, Logger } from '@nestjs/common'

/**
 * Raw document structure from EMA EPAR documents JSON
 */
export interface EmaRawDocument {
  // Product identification
  ema_number: string
  medicine_name: string
  product_number: string

  // Document metadata
  document_title: string
  document_type: string // 'EPAR - Public assessment report', 'EPAR - Product Information', etc.
  document_category: string // 'epar_document'
  document_language: string // 'en', 'de', etc. (ISO code)

  // URLs
  document_url: string // Full URL to document
  pdf_url: string // Direct PDF download URL

  // Dates
  document_date: string // Publication date (DD/MM/YYYY)
  last_updated: string // Last update date (DD/MM/YYYY)

  // File info
  file_size?: string // e.g., "1.2 MB"
}

interface EmaDocumentsApiResponse {
  meta: {
    total_records: number
    timestamp: string
  }
  data: EmaRawDocument[]
}

/**
 * HTTP client for EMA document data access
 * Downloads structured JSON data from official EMA document endpoints
 */
@Injectable()
export class EmaDocumentsApiClient {
  private readonly logger = new Logger(EmaDocumentsApiClient.name)

  // Official EMA JSON endpoints for documents (refreshed twice daily)
  private readonly EMA_EPAR_DOCUMENTS_URL =
    'https://www.ema.europa.eu/en/documents/report/documents-output-epar_documents_json-report_en.json'

  private readonly EMA_NON_EPAR_DOCUMENTS_URL =
    'https://www.ema.europa.eu/en/documents/report/documents-output-non_epar_documents_json-report_en.json'

  private readonly USER_AGENT = 'MedikamentenProfil/1.0 (https://medikamentenprofil.de)'

  /**
   * Fetch EPAR documents metadata from EMA
   * Includes: EPAR summaries, Product Information (SmPC), Package Leaflets
   */
  async fetchEparDocuments(): Promise<EmaRawDocument[]> {
    this.logger.log('Fetching EPAR documents from EMA...')
    return this.fetchFromUrl(this.EMA_EPAR_DOCUMENTS_URL)
  }

  /**
   * Fetch non-EPAR documents metadata from EMA
   * Includes: Referral documents, DHPC, other regulatory documents
   */
  async fetchNonEparDocuments(): Promise<EmaRawDocument[]> {
    this.logger.log('Fetching non-EPAR documents from EMA...')
    return this.fetchFromUrl(this.EMA_NON_EPAR_DOCUMENTS_URL)
  }

  /**
   * Fetch all documents (EPAR + non-EPAR)
   */
  async fetchAllDocuments(): Promise<EmaRawDocument[]> {
    const [epar, nonEpar] = await Promise.all([
      this.fetchEparDocuments(),
      this.fetchNonEparDocuments(),
    ])
    return [...epar, ...nonEpar]
  }

  private async fetchFromUrl(url: string): Promise<EmaRawDocument[]> {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': this.USER_AGENT,
      },
    })

    if (!response.ok) {
      throw new Error(`EMA Documents API request failed: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as EmaDocumentsApiResponse

    this.logger.log(`Fetched ${json.data.length} documents (timestamp: ${json.meta.timestamp})`)

    return json.data
  }

  /**
   * Classify document type from EMA's document_type string
   */
  classifyDocumentType(documentType: string): 'epar' | 'smpc' | 'pl' | 'assessment' | 'annex' | 'other' {
    const lower = documentType.toLowerCase()

    if (lower.includes('product information') || lower.includes('smpc')) {
      return 'smpc'
    }
    if (lower.includes('package leaflet') || lower.includes('patient information')) {
      return 'pl'
    }
    if (lower.includes('public assessment') || lower.includes('scientific discussion')) {
      return 'epar'
    }
    if (lower.includes('annex')) {
      return 'annex'
    }
    if (lower.includes('assessment')) {
      return 'assessment'
    }
    return 'other'
  }

  /**
   * Parse EMA date format (DD/MM/YYYY) to ISO date
   */
  parseEmaDate(dateStr: string): Date | null {
    if (!dateStr?.trim()) return null
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) {
      return new Date(`${match[3]}-${match[2]}-${match[1]}`)
    }
    return null
  }

  /**
   * Parse file size string (e.g., "1.2 MB") to bytes
   */
  parseFileSize(sizeStr: string | undefined): number | null {
    if (!sizeStr) return null

    const match = sizeStr.match(/^([\d.]+)\s*(KB|MB|GB)$/i)
    if (!match || !match[1] || !match[2]) return null

    const value = parseFloat(match[1])
    const unit = match[2].toUpperCase()

    switch (unit) {
      case 'KB':
        return Math.round(value * 1024)
      case 'MB':
        return Math.round(value * 1024 * 1024)
      case 'GB':
        return Math.round(value * 1024 * 1024 * 1024)
      default:
        return null
    }
  }
}
