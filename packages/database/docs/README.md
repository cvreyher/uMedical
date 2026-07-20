# EMA Pharmaceutical Data Platform - Database Layer

## Übersicht

Umfassendes Datenmodell für alle EMA (European Medicines Agency) Daten mit Fokus auf:
- **Vollständigkeit** - Alle EMA JSON-Felder erfasst
- **Provenance** - Jedes Datum kennt seine Quelle
- **Event Timeline** - Northdata-style Change Tracking
- **Erweiterbarkeit** - Vorbereitet für RAG, Multi-Language, User Features

## Architektur

Das Datenmodell ist in **6 Schichten** organisiert:

### Layer 1: Raw Sources (Änderungserkennung)
**Tabellen:** `ema_sources`

Trackt alle EMA API-Endpunkte mit ETags, Last-Modified und Content-Hashes für inkrementelles Crawling.

### Layer 2: Core Entities
**Tabellen:** `product_categories`, `medicinal_products_extended`, `substances`, `companies`, `product_substances`, `product_companies`, `product_designations`

Zentrale Entitäten mit **allen** EMA-Feldern:
- Vollständige Medikamentendaten (50+ Felder)
- Wirkstoffe (Substances)
- Unternehmen (Marketing Authorization Holders)
- Spezielle Designations (Orphan, Prime, Conditional Approval)

### Layer 3: Documents
**Tabellen:** `documents`

Alle EPAR und Non-EPAR Dokumente:
- SmPC, Product Information, Assessment Reports
- Multi-Language Support (EN, DE, FR, etc.)
- Vorbereitet für RAG/Vector Search

### Layer 4: Regulatory Entities
**Tabellen:** `procedures`, `referrals`, `product_referrals`

Regulatorische Verfahren:
- Variations, Type IA/IB/II Procedures
- Referrals (Article 31, 107, etc.)
- Links zu betroffenen Produkten

### Layer 5: Timeline & Events (Northdata-Style)
**Tabellen:** `timeline_events`, `event_sources`

**Kernstück des Systems**: Alle Änderungen als immutable Events
- Event Categories: regulatory, documents, procedures, safety, news, supply
- Full Provenance: source_url, confidence, extractor_version
- Queryable Timeline für komplette Produkthistorie

### Layer 6: News & Shortages
**Tabellen:** `news_items`, `product_news`, `shortages`

- EMA News und Press Releases
- Lieferengpässe mit Severity-Tracking
- Auto-Linking zu Produkten

## Datenquellen

Das Schema unterstützt alle EMA JSON-Endpunkte:

1. **Medicines JSON** → `medicinal_products_extended`
2. **EPAR Documents JSON** → `documents`
3. **Non-EPAR Documents JSON** → `documents`
4. **Referrals JSON** → `referrals`
5. **News JSON** → `news_items`
6. **Shortages JSON** → `shortages`

## Dateien

### Schema-Definitionen
- `/schemas/ema-sources.schema.ts` - Raw source tracking
- `/schemas/product-categories.schema.ts` - Human/Veterinary
- `/schemas/medicinal-products-extended.schema.ts` - Complete product data
- `/schemas/documents.schema.ts` - Document metadata
- `/schemas/procedures.schema.ts` - Regulatory procedures
- `/schemas/referrals.schema.ts` - Referral procedures
- `/schemas/timeline-events.schema.ts` - Event system
- `/schemas/news.schema.ts` - News items
- `/schemas/shortages.schema.ts` - Supply shortages
- `/schemas/product-designations.schema.ts` - Special designations

### Relations
- `/relations-extended.ts` - Drizzle ORM relationships

### Dokumentation
- `/docs/EMA_DATA_MODEL.md` - Vollständige Architektur-Dokumentation
- `/docs/EXAMPLE_QUERIES.sql` - 20+ SQL Query-Beispiele
- `/docs/EXAMPLE_USAGE.ts` - TypeScript Usage Patterns

## Schnellstart

### 1. Schema Review
```bash
# Lesen Sie die vollständige Architektur-Dokumentation
cat packages/database/docs/EMA_DATA_MODEL.md
```

### 2. Beispiel-Queries
```bash
# 20+ vordefinierte Queries für häufige Use Cases
cat packages/database/docs/EXAMPLE_QUERIES.sql
```

### 3. TypeScript Integration
```typescript
import { db } from '@/database'
import { medicinalProductsExtended, timelineEvents } from '@/database/schemas'

// Get product timeline
const timeline = await db.query.timelineEvents.findMany({
  where: eq(timelineEvents.productId, 123),
  orderBy: desc(timelineEvents.eventDate),
})
```

## Kernkonzepte

### Provenance Tracking
**Jedes Datum kennt seine Quelle:**
```typescript
{
  sourceUrl: 'https://www.ema.europa.eu/...',
  sourceType: 'ema_medicines_json',
  confidence: 'high',
  extractorVersion: 'v1.0.0'
}
```

### Event Timeline (Northdata-Style)
**Alle Änderungen als Events:**
```typescript
// Status change event
{
  eventType: 'status_changed',
  eventCategory: 'regulatory',
  productId: 123,
  eventDate: '2025-12-05',
  eventData: {
    oldStatus: 'Authorised',
    newStatus: 'Withdrawn'
  },
  sourceUrl: '...',
  confidence: 'high'
}
```

### Incremental Ingestion
**Verhindert unnötige Re-Crawls:**
```typescript
// Check if source changed
const source = await db.query.emaSources.findFirst({
  where: eq(emaSources.sourceUrl, url)
})

if (source.etag === currentEtag) {
  // No changes, skip crawl
  return
}
```

### Idempotent Upserts
**Re-Imports erzeugen keine Duplikate:**
```typescript
await db
  .insert(medicinalProductsExtended)
  .values(productData)
  .onConflictDoUpdate({
    target: medicinalProductsExtended.emaNumber,
    set: productData
  })
```

## Query-Patterns

### Product Timeline
```typescript
const timeline = await getProductTimeline(productId)
// Returns: All events for a product, sorted by date
```

### Active Shortages
```typescript
const shortages = await getActiveShortages()
// Returns: Current supply issues, sorted by severity
```

### Recent News
```typescript
const news = await db.query.newsItems.findMany({
  where: gte(newsItems.publishedDate, thirtyDaysAgo),
  with: { productNews: { with: { product: true } } }
})
```

### Orphan Medicines
```typescript
const orphans = await db.query.medicinalProductsExtended.findMany({
  where: eq(medicinalProductsExtended.orphanMedicine, true),
  with: { designations: true }
})
```

## Indexes

### Performance-Critical Indexes
- **Timeline Queries:** `(product_id, event_date)` compound
- **Status Filtering:** `medicine_status`, `category`
- **Date Ranges:** `last_updated_date`, `published_date`, `event_date`
- **Type Filtering:** `document_type`, `event_type`, `designation_type`

### Future Enhancements
- GIN indexes für Full-Text Search
- HNSW indexes für Vector Search (RAG Layer)
- JSONB indexes für `event_data` queries

## Erweiterbarkeit

### Geplante Erweiterungen

1. **RAG/Vector Search Layer:**
   - `chunks` table mit embeddings
   - Hybrid search (vector + keyword)
   - Document Q&A

2. **Facts Extraction:**
   - `facts` table mit structured extractions
   - Full provenance chain
   - Confidence scoring

3. **Multi-Language:**
   - `document_translations` table
   - Parallel EN/DE content
   - Language-aware search

4. **User Layer:**
   - Bookmarks, Annotations, Alerts
   - Personalized feeds
   - Separated from core EMA data

## Migration Path

### Phase 1 → Extended Migration
1. Erstelle alle neuen Tabellen
2. Migriere von `medicinal_products` → `medicinal_products_extended`
3. Behalte alte Tabelle für Backwards Compatibility
4. Backfill `timeline_events` aus existierenden Daten

### Version Control
- Alle Migrations mit Drizzle Kit
- Rollback-fähig via Snapshots
- Schema-Versionierung

## Nächste Schritte

1. **Migrations generieren:**
   ```bash
   pnpm db:generate
   ```

2. **Schema deployen:**
   ```bash
   pnpm db:push
   ```

3. **Ingestion Pipeline implementieren:**
   - EMA API Crawler
   - Entity Extraction
   - Event Generation
   - Change Detection

4. **API Layer bauen:**
   - REST/GraphQL Endpoints
   - Timeline Queries
   - Search & Filtering

## Support

Für Fragen zum Datenmodell:
- Siehe `/docs/EMA_DATA_MODEL.md` für vollständige Architektur
- Siehe `/docs/EXAMPLE_QUERIES.sql` für Query-Patterns
- Siehe `/docs/EXAMPLE_USAGE.ts` für TypeScript-Beispiele

---

**Status:** Ready for Implementation
**Version:** 1.0.0
**Last Updated:** 2026-01-24
