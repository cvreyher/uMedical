import { Injectable, Logger } from '@nestjs/common'
import { XMLParser } from 'fast-xml-parser'

import type { RawFeedEvent } from '../../application/services/event-normalizer.service'

/**
 * RSS Feed Parser
 *
 * Parses RSS/Atom feeds from regulatory authorities.
 * Handles common RSS 2.0 and Atom 1.0 formats.
 */
@Injectable()
export class RssParser {
  private readonly logger = new Logger(RssParser.name)
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  })

  /**
   * Fetch and parse an RSS feed
   */
  async parse(
    feedUrl: string,
    _config?: Record<string, unknown>,
  ): Promise<RawFeedEvent[]> {
    try {
      // Fetch the feed
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'MedikamentenProfil/1.0 (+https://medikamentenprofil.de)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const xml = await response.text()

      // Parse XML
      const parsed = this.xmlParser.parse(xml)

      // Handle RSS 2.0
      if (parsed.rss?.channel) {
        return this.parseRss2(parsed.rss.channel)
      }

      // Handle Atom
      if (parsed.feed) {
        return this.parseAtom(parsed.feed)
      }

      // Handle RDF (RSS 1.0)
      if (parsed['rdf:RDF']) {
        return this.parseRdf(parsed['rdf:RDF'])
      }

      this.logger.warn(`Unknown feed format from ${feedUrl}`)
      return []
    } catch (error) {
      this.logger.error(`Failed to parse RSS feed ${feedUrl}`, error)
      throw error
    }
  }

  /**
   * Parse RSS 2.0 format
   */
  private parseRss2(channel: any): RawFeedEvent[] {
    const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean)

    return items.map((item: any) => ({
      title: this.getText(item.title),
      description: this.getText(item.description),
      date: item.pubDate || item.date || new Date().toISOString(),
      url: this.getText(item.link) || item['@_href'] || '',
      sourceId: item.guid?.['#text'] || item.guid || item.link,
      // Additional fields if present
      category: this.getCategory(item.category),
    }))
  }

  /**
   * Parse Atom format
   */
  private parseAtom(feed: any): RawFeedEvent[] {
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry].filter(Boolean)

    return entries.map((entry: any) => {
      // Atom can have multiple links, find the HTML one
      const links = Array.isArray(entry.link) ? entry.link : [entry.link].filter(Boolean)
      const htmlLink = links.find((l: any) =>
        l['@_type'] === 'text/html' || l['@_rel'] === 'alternate' || !l['@_rel']
      )

      return {
        title: this.getText(entry.title),
        description: this.getText(entry.summary) || this.getText(entry.content),
        date: entry.updated || entry.published || new Date().toISOString(),
        url: htmlLink?.['@_href'] || this.getText(entry.link) || '',
        sourceId: this.getText(entry.id),
        author: this.getText(entry.author?.name),
      }
    })
  }

  /**
   * Parse RDF/RSS 1.0 format
   */
  private parseRdf(rdf: any): RawFeedEvent[] {
    const items = Array.isArray(rdf.item) ? rdf.item : [rdf.item].filter(Boolean)

    return items.map((item: any) => ({
      title: this.getText(item.title),
      description: this.getText(item.description),
      date: item['dc:date'] || item.date || new Date().toISOString(),
      url: item['@_rdf:about'] || this.getText(item.link) || '',
      sourceId: item['@_rdf:about'] || item.link,
    }))
  }

  /**
   * Extract text content from various XML structures
   */
  private getText(node: any): string {
    if (!node) return ''
    if (typeof node === 'string') return node.trim()
    if (node['#text']) return String(node['#text']).trim()
    if (node['@_value']) return String(node['@_value']).trim()
    return ''
  }

  /**
   * Extract category from RSS item
   */
  private getCategory(category: any): string | undefined {
    if (!category) return undefined
    if (typeof category === 'string') return category
    if (Array.isArray(category)) {
      return category.map(c => this.getText(c)).filter(Boolean).join(', ')
    }
    return this.getText(category)
  }
}
