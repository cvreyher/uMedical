import { Injectable, Logger } from '@nestjs/common'

/**
 * Raw shortage data structure from EMA Shortages JSON
 * https://www.ema.europa.eu/en/documents/report/shortages-output-json-report_en.json
 */
export interface EmaRawShortage {
  category: string // e.g., "Currently authorised"
  medicine_affected: string
  supply_shortage_status: string // e.g., "Resolved", "Not resolved"
  international_non_proprietary_name_inn_or_common_name: string
  therapeutic_area_mesh: string
  pharmaceutical_forms_affected: string
  strengths_affected: string
  availability_of_alternatives: string
  start_of_shortage_date: string // DD/MM/YYYY
  expected_resolution_date: string // DD/MM/YYYY
  first_published_date: string // DD/MM/YYYY
  last_updated_date: string // DD/MM/YYYY
  shortage_url: string
}

interface EmaShortagesApiResponse {
  meta: {
    total_records: number
    timestamp: string
  }
  data: EmaRawShortage[]
}

/**
 * Raw medicine data structure from EMA JSON
 * All fields as returned by the official EMA medicines JSON endpoint
 */
export interface EmaRawMedicine {
  // Basic identification
  category: string
  name_of_medicine: string
  ema_product_number: string
  medicine_status: string
  opinion_status: string
  latest_procedure_affecting_product_information: string

  // Substance and therapeutic info
  international_non_proprietary_name_common_name: string
  active_substance: string
  therapeutic_area_mesh: string
  therapeutic_indication: string

  // Classification codes (human)
  atc_code_human: string
  pharmacotherapeutic_group_human: string

  // Classification codes (veterinary)
  species_veterinary: string
  atcvet_code_veterinary: string
  pharmacotherapeutic_group_veterinary: string

  // Designation flags (Yes/No strings)
  patient_safety: string
  accelerated_assessment: string
  additional_monitoring: string
  advanced_therapy: string
  biosimilar: string
  conditional_approval: string
  exceptional_circumstances: string
  generic_or_hybrid: string
  orphan_medicine: string
  prime_priority_medicine: string

  // Marketing authorisation holder
  marketing_authorisation_developer_applicant_holder: string

  // Key dates (DD/MM/YYYY format)
  european_commission_decision_date: string
  start_of_rolling_review_date: string
  start_of_evaluation_date: string
  opinion_adopted_date: string
  withdrawal_of_application_date: string
  marketing_authorisation_date: string
  refusal_of_marketing_authorisation_date: string
  withdrawal_expiry_revocation_lapse_of_marketing_authorisation_date: string
  suspension_of_marketing_authorisation_date: string

  // Version and publication info
  revision_number: string
  first_published_date: string
  last_updated_date: string

  // URL to medicine page
  medicine_url: string
}

interface EmaApiResponse {
  meta: {
    total_records: number
    timestamp: string
  }
  data: EmaRawMedicine[]
}

/**
 * HTTP client for EMA data access
 * Downloads structured JSON data from official EMA sources
 */
@Injectable()
export class EmaApiClient {
  private readonly logger = new Logger(EmaApiClient.name)

  // Official EMA JSON endpoints
  private readonly EMA_MEDICINES_URL =
    'https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json'

  private readonly EMA_SHORTAGES_URL =
    'https://www.ema.europa.eu/en/documents/report/shortages-output-json-report_en.json'

  /**
   * Fetch all human medicines from EMA
   * Returns the medicines array from the JSON response
   */
  async fetchMedicines(): Promise<EmaRawMedicine[]> {
    this.logger.log('Fetching medicines from EMA...')

    const response = await fetch(this.EMA_MEDICINES_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'uMedical/1.0 (+https://github.com/cvreyher/uMedical)',
      },
    })

    if (!response.ok) {
      throw new Error(`EMA API request failed: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as EmaApiResponse

    this.logger.log(`Fetched ${json.data.length} medicines from EMA (timestamp: ${json.meta.timestamp})`)

    return json.data
  }

  /**
   * Fetch all medicine supply shortages from EMA
   * Returns the shortages array from the JSON response
   */
  async fetchShortages(): Promise<EmaRawShortage[]> {
    this.logger.log('Fetching shortages from EMA...')

    const response = await fetch(this.EMA_SHORTAGES_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'uMedical/1.0 (+https://github.com/cvreyher/uMedical)',
      },
    })

    if (!response.ok) {
      throw new Error(`EMA Shortages API request failed: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as EmaShortagesApiResponse

    this.logger.log(`Fetched ${json.data.length} shortages from EMA (timestamp: ${json.meta.timestamp})`)

    return json.data
  }
}
