# EMA Data Model - Comprehensive Architecture

## Übersicht

Dieses Datenmodell erfasst **alle** Daten der European Medicines Agency (EMA) in einer strukturierten, erweiterbaren Form. Das Design folgt den Prinzipien von Provenance, Versionierung und Northdata-style Event-Tracking.

## Design-Prinzipien

1. **Separation of Raw Content & Extracted Structure** - Rohdaten getrennt von normalisierten Entitäten
2. **Provenance is First-Class** - Jedes Datum kennt seine Quelle, Timestamp und Confidence
3. **Incremental Ingestion** - ETags, Last-Modified, Content-Hashes für inkrementelle Crawls
4. **Idempotent Upserts** - Re-Import erzeugt keine Duplikate
5. **Stable IDs, Human-Friendly Slugs** - Serielle IDs intern, Slugs für URLs
6. **Model Versioning** - Alle extrahierten Daten tracken ihre Pipeline-Version
7. **Event-Sourcing Timeline** - Alle Änderungen als immutable Events (wie Northdata)

## 6-Schichten-Architektur

### Layer 1: Raw Sources (Änderungserkennung)

**`ema_sources`** - Zentrale Registry für alle gecrawlten EMA-Endpunkte

- Tracked Change Detection (etag, last_modified, content_hash)
- Source Types:
  - `medicines_json` - Medicines JSON API
  - `epar_documents_json` - EPAR Documents JSON
  - `non_epar_documents_json` - Non-EPAR Documents JSON
  - `referrals_json` - Referrals JSON
  - `news_json` - News JSON
  - `shortages_json` - Shortages JSON
- Crawl State: last_crawled_at, http_status, errors
- **Zweck**: Verhindert unnötige Re-Crawls, tracked welche Quellen aktualisiert wurden

### Layer 2: Core Entities

#### `product_categories`
- Human vs Veterinary als normalisierte Tabelle
- Slugs: `human`, `veterinary`

#### `medicinal_products_extended`
**ALLE** Felder aus EMA Medicines JSON:

**Core Identity:**
- `id`, `slug`, `name`, `ema_number` (EMEA/H/C/XXXXX)

**Category:**
- `category_id` (FK zu product_categories)
- `category` (denormalisiert für Performance)

**Status:**
- `medicine_status` (Authorised, Withdrawn, etc.)
- `opinion_status`

**Active Substances:**
- `international_non_proprietary_name` (INN - semicolon-separated)
- `active_substance` (semicolon-separated)

**Therapeutic Classification:**
- `therapeutic_area_mesh` (MeSH terms)
- `therapeutic_indication` (full text)
- `atc_code` (ATC classification)
- `pharmacotherapeutic_group`

**Product Designations (Boolean Flags):**
- `patient_safety`, `accelerated_assessment`, `additional_monitoring`
- `advanced_therapy`, `biosimilar`, `conditional_approval`
- `exceptional_circumstances`, `generic_or_hybrid`
- `orphan_medicine`, `prime_priority_medicine`

**Company (Denormalized):**
- `marketing_authorisation_holder_developer_applicant`
  - Tatsächliche Relationship in `product_companies`

**Key Dates:**
- `opinion_adopted_date`
- `european_commission_decision_date`
- `marketing_authorisation_date`
- `withdrawal_expiry_revocation_lapse_date`
- `first_published_date`
- `last_updated_date`

**Procedures:**
- `latest_procedure_affecting_product_information` (VR/XXXX, etc.)

**Provenance:**
- `revision_number` (from EMA)
- `medicine_url`
- `source_ema_source_id` (FK zu ema_sources)

**Indexes:**
- `medicine_status`, `category`, `name`, `atc_code`, `orphan_medicine`, `last_updated_date`
- Compound: `(product_id, event_date)` für Timeline-Queries

#### `substances`
- INN names mit synonyms (Phase 1 - unverändert)

#### `companies`
- Marketing Authorization Holders, Manufacturers
- Phase 1 - unverändert, kann erweitert werden

#### `product_substances`
- Many-to-many: Products ↔ Substances

#### `product_companies`
- Many-to-many: Products ↔ Companies
- `role_type`: 'MAH', 'Developer', 'Applicant', 'Manufacturer'

#### `product_designations`
**Detaillierte Metadaten zu Special Designations:**

- `designation_type`: orphan, prime, conditional_approval, exceptional_circumstances, accelerated_assessment
- **Orphan-specific:**
  - `designation_number` (EU/3/XX/XXXX)
  - `prevalence`
  - `significant_benefit`
- **Prime-specific:**
  - `prime_eligibility_date`
- **Conditional Approval-specific:**
  - `specific_obligations`
  - `annual_reassessment_due`
- **Status tracking:**
  - `status`: active, removed, transferred
  - `granted_date`, `removed_date`

**Zweck:** Ergänzt Boolean-Flags in `medicinal_products_extended` mit vollständiger Historie

### Layer 3: Documents

#### `documents`
**Alle Dokumente von EPAR und Non-EPAR:**

- `document_type`: EPAR, SmPC, PL, Assessment, Annex, Press Release, etc.
- `document_category`: epar, non_epar
- `language`: en, de, fr, etc.
- `document_url`, `pdf_url`, `file_size`
- `published_date`, `last_modified_date`
- `version_number`
- `source_json` (original EMA JSON für debugging)

**Indexes:**
- `product_id`, `document_type`, `language`, `document_category`
- Unique constraint auf `document_url`

**Zweck:** Zentraler Storage für alle Dokument-Metadaten, Basis für RAG/Vector Search

### Layer 4: Regulatory Entities

#### `procedures`
**Alle regulatorischen Verfahren:**

- `procedure_number` (VR/XXXX, EMEA/H/C/XXXX/II/XXXX)
- `procedure_type`: Initial, Type IA, Type IB, Type II, Referral, Annual Re-assessment
- `scope`: Was wurde geändert/bewertet
- **Dates:**
  - `start_date`, `opinion_date`, `commission_decision_date`
- `outcome`: Approved, Withdrawn, Refused

**Zweck:** Tracked alle Verfahren, die Produktinformationen beeinflussen

#### `referrals`
**EMA Referral Procedures (Article 5(3), 31, 107, etc.):**

- `referral_number` (EMEA/H/A-31/1234)
- `legal_basis`: Article 31, Article 107, Article 5(3)
- `concern_type`: Safety, Quality, Efficacy
- **Scope:**
  - `affected_substances`
  - `affected_products_description`
- **Process Dates:**
  - `start_date`
  - `phtp_opinion_date`, `prac_opinion_date`, `chmp_opinion_date`
  - `commission_decision_date`
- `outcome`, `summary`

#### `product_referrals`
- Many-to-many: Products ↔ Referrals
- Ein Referral kann viele Produkte betreffen

**Zweck:** Separate Entität wegen unterschiedlicher Struktur zu Procedures

### Layer 5: Timeline & Events (Northdata-Style)

#### `timeline_events`
**Zentrale Event-Tabelle für ALLE Produktänderungen:**

**Event Categories:**
- **regulatory**: authorised, withdrawn, status_changed, opinion_adopted
- **documents**: epar_published, epar_updated, smpc_updated, pl_updated
- **procedures**: procedure_started, procedure_completed, variation_approved
- **safety**: referral_started, referral_completed, safety_alert
- **news**: press_release, ema_news
- **supply**: shortage_reported, shortage_resolved

**Event Structure:**
- `event_type`: Granular type (authorised, withdrawn, etc.)
- `event_category`: High-level category
- `product_id`: FK zu medicinal_products_extended
- `title`: Human-readable
- `description`: Optional details
- `event_date`: Wann passierte es

**Event-Specific Data (JSONB):**
```typescript
{
  // Status changes
  oldStatus?: string
  newStatus?: string

  // Documents
  documentType?: string
  documentUrl?: string
  versionNumber?: string

  // Procedures
  procedureNumber?: string
  procedureType?: string

  // Referrals
  referralNumber?: string
  legalBasis?: string

  // News/Shortages
  newsId?: number
  shortageId?: number

  // Generic
  [key: string]: unknown
}
```

**Provenance (CRITICAL):**
- `source_url`: Woher kam das Event
- `source_type`: ema_medicines_json, ema_documents_json, etc.
- `confidence`: high, medium, low (für extrahierte Events)
- `extractor_version`: Pipeline-Version

**Indexes:**
- `product_id`, `event_type`, `event_category`, `event_date`
- **Compound:** `(product_id, event_date)` für Timeline-Queries

#### `event_sources`
**Provenance-Tracking: Welche Entität erzeugte ein Event?**

- `event_id`: FK zu timeline_events
- `source_type`: document, procedure, referral, news, shortage
- `source_id`: ID in der jeweiligen Tabelle

**Zweck:** Polymorphic Links zurück zu Original-Entitäten

### Layer 6: News & Shortages

#### `news_items`
**EMA News und Press Releases:**

- `title`, `summary`, `body_text`
- `news_type`: Press Release, News, Safety Update
- `category` (from EMA)
- `published_date`
- `news_url` (unique)
- `language`

**Indexes:**
- `published_date`, `news_type`
- Unique constraint auf `news_url`

#### `product_news`
**Many-to-many: Products ↔ News:**

- `mention_confidence`: high, medium, low (für auto-extraction)
- `mention_context`: Wo im Artikel wurde es erwähnt?

**Zweck:** Verknüpft News mit betroffenen Produkten, erzeugt Timeline-Events

#### `shortages`
**Medicine Supply Shortages:**

- `shortage_number` (unique, falls EMA IDs vergibt)
- `title`, `description`
- `affected_products`: Specific formulations/strengths
- `reason`: Manufacturing issue, supply chain, etc.
- **Status:**
  - `status`: active, resolved, monitoring
  - `severity`: critical, high, medium, low
- **Timeline:**
  - `reported_date`
  - `expected_resolution_date`
  - `actual_resolution_date`
- `affected_countries`: Comma-separated ISO codes
- `alternative_treatments`, `actions_taken`

**Indexes:**
- `product_id`, `status`, `reported_date`, `severity`

**Zweck:** Dedizierte Entität wegen ongoing nature, erzeugt Timeline-Events

## Query-Patterns

### 1. Product Timeline (Northdata-style)
```sql
SELECT
  e.event_date,
  e.event_type,
  e.event_category,
  e.title,
  e.description,
  e.event_data,
  e.source_url
FROM timeline_events e
WHERE e.product_id = 123
ORDER BY e.event_date DESC, e.created_at DESC;
```

### 2. Latest Products by Status
```sql
SELECT *
FROM medicinal_products_extended
WHERE medicine_status = 'Authorised'
  AND category = 'Human'
ORDER BY last_updated_date DESC
LIMIT 50;
```

### 3. Products with Active Shortages
```sql
SELECT
  p.name,
  s.title,
  s.severity,
  s.reported_date,
  s.expected_resolution_date
FROM medicinal_products_extended p
JOIN shortages s ON s.product_id = p.id
WHERE s.status = 'active'
ORDER BY s.severity DESC, s.reported_date DESC;
```

### 4. Orphan Medicines with Full Details
```sql
SELECT
  p.name,
  p.ema_number,
  d.designation_number,
  d.condition,
  d.prevalence,
  d.granted_date
FROM medicinal_products_extended p
JOIN product_designations d ON d.product_id = p.id
WHERE p.orphan_medicine = true
  AND d.designation_type = 'orphan'
  AND d.status = 'active';
```

### 5. Recent News Affecting Products
```sql
SELECT
  n.published_date,
  n.title,
  p.name AS product_name,
  pn.mention_confidence
FROM news_items n
JOIN product_news pn ON pn.news_id = n.id
JOIN medicinal_products_extended p ON p.id = pn.product_id
WHERE n.published_date >= NOW() - INTERVAL '30 days'
ORDER BY n.published_date DESC;
```

### 6. Referrals Timeline
```sql
SELECT
  r.referral_number,
  r.title,
  r.legal_basis,
  r.start_date,
  r.chmp_opinion_date,
  COUNT(pr.product_id) AS affected_products_count
FROM referrals r
LEFT JOIN product_referrals pr ON pr.referral_id = r.id
GROUP BY r.id
ORDER BY r.start_date DESC;
```

## Ingestion-Workflow

### Phase 1: Source Tracking
1. Check `ema_sources` for etag/last_modified
2. Fetch from EMA API only if changed
3. Update `ema_sources` with new content_hash

### Phase 2: Entity Extraction
1. Parse JSON from each source
2. Upsert into respective tables:
   - Medicines JSON → `medicinal_products_extended`
   - Documents JSON → `documents`
   - Referrals JSON → `referrals`
   - News JSON → `news_items`
   - Shortages JSON → `shortages`

### Phase 3: Relationship Building
1. Extract substances → `product_substances`
2. Extract companies → `product_companies`
3. Link news to products → `product_news`
4. Link referrals to products → `product_referrals`

### Phase 4: Event Generation
1. Detect changes (status, dates, etc.)
2. Create `timeline_events` for each change
3. Link events to sources via `event_sources`

### Phase 5: Designations & Procedures
1. Extract designation metadata → `product_designations`
2. Parse procedure references → `procedures`

## Erweiterbarkeit

### Zukünftige Erweiterungen

1. **RAG/Vector Search Layer:**
   - `chunks` table mit embeddings (vector(N))
   - HNSW indexes für similarity search
   - Links zu `documents`

2. **Facts Extraction:**
   - `facts` table mit strukturierten Extractions
   - Full provenance: source_document_id, source_span, quoted_snippet
   - Confidence scores, extractor_version

3. **Multi-Language Support:**
   - `document_translations` für deutsche Versionen
   - Parallel storage von EN/DE texts

4. **RSS/News Integration:**
   - `rss_feeds` für externe News-Quellen
   - `entity_mentions` für automatic product linking

5. **User Layer:**
   - Bookmarks, Annotations, Alerts
   - Separate von core EMA data

## Indexes-Strategie

### High-Priority Indexes (bereits definiert)
- **Timeline Queries:** `(product_id, event_date)` compound
- **Status Filtering:** `medicine_status`, `category`
- **Date Ranges:** `last_updated_date`, `published_date`, `event_date`
- **Type Filtering:** `document_type`, `event_type`, `designation_type`

### Future Considerations
- **Full-Text Search:** GIN indexes auf title/description fields
- **JSONB Queries:** GIN indexes auf event_data, source_json
- **Vector Search:** HNSW indexes für embeddings (future chunks table)

## Migrations-Strategie

1. **Phase 1 → Extended Migration:**
   - Erstelle alle neuen Tabellen
   - Migriere Daten von `medicinal_products` → `medicinal_products_extended`
   - Behalte alte Tabelle für Backwards Compatibility
   - Deprecate schrittweise

2. **Data Backfill:**
   - Populiere `timeline_events` aus existierenden Daten
   - Generiere historische Events aus date fields

3. **Version Tracking:**
   - Alle Migrationen mit Drizzle Kit
   - Rollback-fähig via Drizzle snapshots

## Provenance-Tracking Beispiel

```typescript
// Neues Timeline Event erstellen
const event: NewTimelineEvent = {
  eventType: 'authorised',
  eventCategory: 'regulatory',
  productId: 123,
  title: 'Marketing authorisation granted',
  eventDate: new Date('2021-11-12'),
  eventData: {
    opinionDate: '2021-11-11',
    commissionDecisionDate: '2021-11-12'
  },
  sourceUrl: 'https://www.ema.europa.eu/medicines/...',
  sourceType: 'ema_medicines_json',
  confidence: 'high',
  extractorVersion: 'v1.0.0'
}

// Event-Source Verknüpfung
const eventSource: NewEventSource = {
  eventId: createdEvent.id,
  sourceType: 'document',
  sourceId: 456 // ID aus documents table
}
```

## Performance-Überlegungen

1. **Denormalization:**
   - `category` in `medicinal_products_extended` (trotz category_id)
   - `marketing_authorisation_holder_developer_applicant` (trotz product_companies)
   - **Reason:** Query performance, häufige Filters

2. **Compound Indexes:**
   - `(product_id, event_date)` für Timeline
   - `(language, document_type)` für Document filtering
   - **Reason:** Multi-column WHERE clauses

3. **JSONB für Flexibilität:**
   - `event_data` in timeline_events
   - `source_json` in documents
   - **Reason:** Event types variieren, debugging

4. **Partitioning (Future):**
   - Timeline events by year
   - Documents by language
   - **Reason:** Wenn Tabellen > 10M rows

## Zusammenfassung

Dieses Datenmodell bietet:

✅ **Vollständigkeit** - Alle EMA-Felder erfasst
✅ **Provenance** - Jedes Datum kennt seine Quelle
✅ **Timeline** - Northdata-style Event-Tracking
✅ **Erweiterbarkeit** - Vorbereitet für RAG, Multi-Language, User Layer
✅ **Performance** - Strategische Denormalisierung und Indexes
✅ **Versionierung** - Extractor versions, revision numbers
✅ **Idempotenz** - Re-Imports erzeugen keine Duplikate

**Next Steps:**
1. Drizzle Migrations generieren
2. Ingestion Pipeline implementieren
3. Event-Generation Logic
4. API Layer auf erweitertem Schema
