import type { TimelineEvent } from './api'

/**
 * Agency color mapping for timeline visualization
 */
export const AGENCY_COLORS: Record<string, string> = {
  EMA: '#0066CC', // Blue
  FDA: '#DC143C', // Crimson red
  MHRA: '#004C97', // Dark blue (UK)
  PMDA: '#FF6B6B', // Coral red (Japan)
  HC: '#FFA500', // Orange (Health Canada)
  TGA: '#008751', // Green (Australia)
  SWISSMEDIC: '#E60012', // Red (Switzerland)
  DEFAULT: '#6B7280', // Gray for unknown agencies
}

/**
 * Extract agency name from sourceType field
 * Examples:
 * - "ema_medicines_json" → "EMA"
 * - "fda_documents_json" → "FDA"
 * - "mhra_news_json" → "MHRA"
 */
export function extractAgency(sourceType: string): string {
  if (!sourceType) return 'UNKNOWN'

  // Split by underscore and take first part
  const parts = sourceType.toLowerCase().split('_')
  const agencyCode = parts[0] ?? ''

  // Map common agency codes to full names
  const agencyMap: Record<string, string> = {
    ema: 'EMA',
    fda: 'FDA',
    mhra: 'MHRA',
    pmda: 'PMDA',
    hc: 'HC',
    tga: 'TGA',
    swissmedic: 'SWISSMEDIC',
  }

  return agencyMap[agencyCode] ?? agencyCode.toUpperCase()
}

/**
 * Extract agency from sourceUrl as fallback
 * Checks URL patterns like:
 * - ema.europa.eu → EMA
 * - fda.gov → FDA
 */
export function extractAgencyFromUrl(sourceUrl: string): string {
  if (!sourceUrl) return 'UNKNOWN'

  try {
    const url = new URL(sourceUrl)
    const hostname = url.hostname.toLowerCase()

    if (hostname.includes('ema.europa.eu')) return 'EMA'
    if (hostname.includes('fda.gov')) return 'FDA'
    if (hostname.includes('mhra.gov.uk')) return 'MHRA'
    if (hostname.includes('pmda.go.jp')) return 'PMDA'
    if (hostname.includes('hc-sc.gc.ca')) return 'HC'
    if (hostname.includes('tga.gov.au')) return 'TGA'
    if (hostname.includes('swissmedic.ch')) return 'SWISSMEDIC'

    return 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

/**
 * Get agency from timeline event
 * Tries sourceType first, then falls back to sourceUrl
 */
export function getAgencyFromEvent(event: TimelineEvent): string {
  // Check if sourceType exists (it might not be in the frontend type yet)
  const sourceType = (event as any).sourceType
  if (sourceType) {
    return extractAgency(sourceType)
  }

  // Fallback to URL parsing
  return extractAgencyFromUrl(event.sourceUrl)
}

/**
 * Get color for an agency
 */
export function getAgencyColor(agency: string): string {
  return AGENCY_COLORS[agency] ?? AGENCY_COLORS.DEFAULT ?? '#6B7280'
}

/**
 * Transform timeline event to d3kit-timeline format
 */
export interface D3KitTimelineData {
  time: Date
  episode: number
  name: string
  agency: string
  color: string
  event: TimelineEvent // Keep reference to original event
}

export function transformEventToD3Kit(event: TimelineEvent, index: number): D3KitTimelineData {
  const agency = getAgencyFromEvent(event)
  const color = getAgencyColor(agency)

  return {
    time: new Date(event.eventDate),
    episode: event.id || index,
    name: event.title,
    agency,
    color,
    event,
  }
}

/**
 * Get unique agencies from a list of events
 */
export function getUniqueAgencies(events: TimelineEvent[]): string[] {
  const agencies = new Set<string>()
  events.forEach((event) => {
    agencies.add(getAgencyFromEvent(event))
  })
  return Array.from(agencies).sort()
}
