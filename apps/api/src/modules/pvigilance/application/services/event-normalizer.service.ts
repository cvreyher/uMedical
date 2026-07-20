import { Injectable, Logger } from '@nestjs/common'

/**
 * Normalized event types used across all sources
 */
export type NormalizedEventType =
  | 'recall'
  | 'safety_alert'
  | 'dhpc'
  | 'withdrawal'
  | 'label_change'
  | 'suspension'
  | 'restriction'
  | 'warning'
  | 'other'

/**
 * Normalized event categories
 */
export type NormalizedEventCategory = 'safety' | 'quality' | 'supply' | 'regulatory'

/**
 * Normalized severity levels
 */
export type NormalizedSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/**
 * Raw event from a feed source before normalization
 */
export interface RawFeedEvent {
  title: string
  description?: string
  date: string | Date
  url: string
  sourceId?: string
  // Source-specific fields
  recallClass?: string
  eventType?: string
  severity?: string
  lotNumbers?: string[]
  reason?: string
  [key: string]: unknown
}

/**
 * Normalized event ready for storage
 */
export interface NormalizedEvent {
  slug: string
  sourceAuthority: string
  region: string
  eventType: NormalizedEventType
  eventCategory: NormalizedEventCategory
  severity: NormalizedSeverity
  title: string
  description: string | null
  eventDate: string // YYYY-MM-DD format
  eventData: Record<string, unknown>
  sourceUrl: string
  sourceDocumentId: string | null
  contentHash: string
}

/**
 * Event Normalizer Service
 *
 * Normalizes events from different regulatory authorities into a common format.
 * Each authority has different terminology and classification systems.
 */
@Injectable()
export class EventNormalizerService {
  private readonly logger = new Logger(EventNormalizerService.name)

  /**
   * Normalize a raw event from FDA
   */
  normalizeFdaEvent(raw: RawFeedEvent, _feedSlug: string): NormalizedEvent {
    const { eventType, severity } = this.normalizeFdaClassification(raw)

    return {
      slug: this.generateSlug('fda', raw.sourceId || raw.title, raw.date),
      sourceAuthority: 'FDA',
      region: 'US',
      eventType,
      eventCategory: this.determineCategory(eventType, raw),
      severity,
      title: raw.title,
      description: raw.description || null,
      eventDate: this.normalizeDate(raw.date),
      eventData: this.extractFdaEventData(raw),
      sourceUrl: raw.url,
      sourceDocumentId: raw.sourceId || null,
      contentHash: this.generateContentHash(raw),
    }
  }

  /**
   * Normalize a raw event from MHRA
   */
  normalizeMhraEvent(raw: RawFeedEvent, _feedSlug: string): NormalizedEvent {
    const { eventType, severity } = this.normalizeMhraClassification(raw)

    return {
      slug: this.generateSlug('mhra', raw.sourceId || raw.title, raw.date),
      sourceAuthority: 'MHRA',
      region: 'UK',
      eventType,
      eventCategory: this.determineCategory(eventType, raw),
      severity,
      title: raw.title,
      description: raw.description || null,
      eventDate: this.normalizeDate(raw.date),
      eventData: this.extractMhraEventData(raw),
      sourceUrl: raw.url,
      sourceDocumentId: raw.sourceId || null,
      contentHash: this.generateContentHash(raw),
    }
  }

  /**
   * Normalize a raw event from Swissmedic (HPC letters)
   */
  normalizeSwissmedicEvent(raw: RawFeedEvent, _feedSlug: string): NormalizedEvent {
    return {
      slug: this.generateSlug('swissmedic', raw.sourceId || raw.title, raw.date),
      sourceAuthority: 'Swissmedic',
      region: 'CH',
      eventType: 'dhpc',
      eventCategory: 'safety',
      severity: 'high', // HPC letters are generally high priority
      title: raw.title,
      description: raw.description || null,
      eventDate: this.normalizeDate(raw.date),
      eventData: this.extractGenericEventData(raw),
      sourceUrl: raw.url,
      sourceDocumentId: raw.sourceId || null,
      contentHash: this.generateContentHash(raw),
    }
  }

  /**
   * Normalize a raw event from BfArM (Rote-Hand-Briefe)
   */
  normalizeBfarmEvent(raw: RawFeedEvent, _feedSlug: string): NormalizedEvent {
    return {
      slug: this.generateSlug('bfarm', raw.sourceId || raw.title, raw.date),
      sourceAuthority: 'BfArM',
      region: 'DE',
      eventType: 'dhpc',
      eventCategory: 'safety',
      severity: 'critical', // Rote-Hand-Briefe are critical safety communications
      title: raw.title,
      description: raw.description || null,
      eventDate: this.normalizeDate(raw.date),
      eventData: this.extractGenericEventData(raw),
      sourceUrl: raw.url,
      sourceDocumentId: raw.sourceId || null,
      contentHash: this.generateContentHash(raw),
    }
  }

  /**
   * Normalize a raw event from EMA
   */
  normalizeEmaEvent(raw: RawFeedEvent, _feedSlug: string): NormalizedEvent {
    const { eventType, severity } = this.normalizeEmaClassification(raw)

    return {
      slug: this.generateSlug('ema', raw.sourceId || raw.title, raw.date),
      sourceAuthority: 'EMA',
      region: 'EU',
      eventType,
      eventCategory: this.determineCategory(eventType, raw),
      severity,
      title: raw.title,
      description: raw.description || null,
      eventDate: this.normalizeDate(raw.date),
      eventData: this.extractGenericEventData(raw),
      sourceUrl: raw.url,
      sourceDocumentId: raw.sourceId || null,
      contentHash: this.generateContentHash(raw),
    }
  }

  /**
   * Generic normalization for unknown or new sources
   */
  normalizeGenericEvent(
    raw: RawFeedEvent,
    authority: string,
    region: string,
  ): NormalizedEvent {
    return {
      slug: this.generateSlug(authority.toLowerCase(), raw.sourceId || raw.title, raw.date),
      sourceAuthority: authority,
      region,
      eventType: 'other',
      eventCategory: 'regulatory',
      severity: 'medium',
      title: raw.title,
      description: raw.description || null,
      eventDate: this.normalizeDate(raw.date),
      eventData: this.extractGenericEventData(raw),
      sourceUrl: raw.url,
      sourceDocumentId: raw.sourceId || null,
      contentHash: this.generateContentHash(raw),
    }
  }

  /**
   * FDA classification normalization
   * - Class I: Critical (serious health consequences)
   * - Class II: High (temporary/reversible health consequences)
   * - Class III: Medium (unlikely to cause adverse health)
   */
  private normalizeFdaClassification(raw: RawFeedEvent): {
    eventType: NormalizedEventType
    severity: NormalizedSeverity
  } {
    const recallClass = raw.recallClass?.toUpperCase() || ''
    const title = raw.title?.toLowerCase() || ''

    // Determine event type
    let eventType: NormalizedEventType = 'other'
    if (title.includes('recall') || raw.eventType?.toLowerCase().includes('recall')) {
      eventType = 'recall'
    } else if (title.includes('safety') || title.includes('medwatch')) {
      eventType = 'safety_alert'
    } else if (title.includes('withdrawal')) {
      eventType = 'withdrawal'
    } else if (title.includes('label')) {
      eventType = 'label_change'
    }

    // Determine severity based on recall class
    let severity: NormalizedSeverity = 'medium'
    if (recallClass === 'I' || recallClass === 'CLASS I') {
      severity = 'critical'
    } else if (recallClass === 'II' || recallClass === 'CLASS II') {
      severity = 'high'
    } else if (recallClass === 'III' || recallClass === 'CLASS III') {
      severity = 'medium'
    }

    return { eventType, severity }
  }

  /**
   * MHRA classification normalization
   */
  private normalizeMhraClassification(raw: RawFeedEvent): {
    eventType: NormalizedEventType
    severity: NormalizedSeverity
  } {
    const title = raw.title?.toLowerCase() || ''

    let eventType: NormalizedEventType = 'safety_alert'
    let severity: NormalizedSeverity = 'medium'

    if (title.includes('recall')) {
      eventType = 'recall'
      severity = 'high'
    } else if (title.includes('dhpc') || title.includes('direct healthcare professional')) {
      eventType = 'dhpc'
      severity = 'high'
    } else if (title.includes('drug safety update')) {
      eventType = 'safety_alert'
      severity = 'medium'
    } else if (title.includes('class 1') || title.includes('class i')) {
      severity = 'critical'
    } else if (title.includes('class 2') || title.includes('class ii')) {
      severity = 'high'
    }

    return { eventType, severity }
  }

  /**
   * EMA classification normalization
   */
  private normalizeEmaClassification(raw: RawFeedEvent): {
    eventType: NormalizedEventType
    severity: NormalizedSeverity
  } {
    const title = raw.title?.toLowerCase() || ''

    let eventType: NormalizedEventType = 'safety_alert'
    let severity: NormalizedSeverity = 'medium'

    if (title.includes('signal')) {
      eventType = 'safety_alert'
      severity = 'medium'
    } else if (title.includes('dhpc') || title.includes('direct healthcare')) {
      eventType = 'dhpc'
      severity = 'high'
    } else if (title.includes('referral')) {
      eventType = 'safety_alert'
      severity = 'high'
    } else if (title.includes('withdrawal') || title.includes('withdrawn')) {
      eventType = 'withdrawal'
      severity = 'critical'
    } else if (title.includes('suspension') || title.includes('suspended')) {
      eventType = 'suspension'
      severity = 'critical'
    }

    return { eventType, severity }
  }

  /**
   * Determine event category based on type and content
   */
  private determineCategory(
    eventType: NormalizedEventType,
    raw: RawFeedEvent,
  ): NormalizedEventCategory {
    const content = `${raw.title} ${raw.description || ''}`.toLowerCase()

    // Quality issues
    if (
      content.includes('contamination') ||
      content.includes('sterility') ||
      content.includes('impurity') ||
      content.includes('manufacturing') ||
      content.includes('batch') ||
      content.includes('lot')
    ) {
      return 'quality'
    }

    // Supply issues
    if (
      content.includes('shortage') ||
      content.includes('supply') ||
      content.includes('availability')
    ) {
      return 'supply'
    }

    // Safety-related events
    if (
      eventType === 'dhpc' ||
      eventType === 'safety_alert' ||
      content.includes('adverse') ||
      content.includes('side effect')
    ) {
      return 'safety'
    }

    // Default to regulatory
    return 'regulatory'
  }

  /**
   * Extract FDA-specific event data
   */
  private extractFdaEventData(raw: RawFeedEvent): Record<string, unknown> {
    const data: Record<string, unknown> = {}

    if (raw.recallClass) data.recallClass = raw.recallClass
    if (raw.lotNumbers) data.lotNumbers = raw.lotNumbers
    if (raw.reason) data.reasonForRecall = raw.reason

    // Copy any additional fields
    const knownFields = ['title', 'description', 'date', 'url', 'sourceId', 'recallClass', 'lotNumbers', 'reason', 'eventType', 'severity']
    for (const [key, value] of Object.entries(raw)) {
      if (!knownFields.includes(key) && value !== undefined) {
        data[key] = value
      }
    }

    return data
  }

  /**
   * Extract MHRA-specific event data
   */
  private extractMhraEventData(raw: RawFeedEvent): Record<string, unknown> {
    return this.extractGenericEventData(raw)
  }

  /**
   * Extract generic event data
   */
  private extractGenericEventData(raw: RawFeedEvent): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    const excludeFields = ['title', 'description', 'date', 'url', 'sourceId']

    for (const [key, value] of Object.entries(raw)) {
      if (!excludeFields.includes(key) && value !== undefined) {
        data[key] = value
      }
    }

    return data
  }

  /**
   * Generate a URL-safe slug for the event
   */
  private generateSlug(authority: string, identifier: string, date: string | Date): string {
    const dateStr = this.normalizeDate(date).replace(/-/g, '')
    const cleanId = identifier
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50)

    return `${authority}-${dateStr}-${cleanId}`
  }

  /**
   * Normalize date to YYYY-MM-DD format
   */
  private normalizeDate(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString().split('T')[0]!
    }

    // Try to parse various date formats
    const parsed = new Date(date)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]!
    }

    // Fallback to today if parsing fails
    this.logger.warn(`Could not parse date: ${date}, using today`)
    return new Date().toISOString().split('T')[0]!
  }

  /**
   * Generate a content hash for deduplication
   */
  private generateContentHash(raw: RawFeedEvent): string {
    const content = JSON.stringify({
      title: raw.title,
      description: raw.description,
      url: raw.url,
      date: raw.date,
    })

    // Simple hash function (in production, use crypto.createHash)
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }
}
