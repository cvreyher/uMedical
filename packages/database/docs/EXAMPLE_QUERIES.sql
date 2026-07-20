-- ============================================================================
-- EMA Data Model - Example Queries
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PRODUCT TIMELINE (Northdata-Style)
-- Get complete history of a product with all events
-- ----------------------------------------------------------------------------
SELECT
  e.event_date,
  e.event_type,
  e.event_category,
  e.title,
  e.description,
  e.event_data,
  e.source_url,
  e.confidence,
  -- Source entity details (polymorphic)
  es.source_type,
  es.source_id
FROM timeline_events e
LEFT JOIN event_sources es ON es.event_id = e.id
WHERE e.product_id = 123
ORDER BY e.event_date DESC, e.created_at DESC;

-- ----------------------------------------------------------------------------
-- 2. LATEST AUTHORISED PRODUCTS
-- Products recently updated, filtered by status
-- ----------------------------------------------------------------------------
SELECT
  p.id,
  p.slug,
  p.name,
  p.ema_number,
  p.medicine_status,
  p.category,
  p.therapeutic_area_mesh,
  p.marketing_authorisation_date,
  p.last_updated_date,
  c.name AS category_name
FROM medicinal_products_extended p
LEFT JOIN product_categories c ON c.id = p.category_id
WHERE p.medicine_status = 'Authorised'
  AND p.category = 'Human'
ORDER BY p.last_updated_date DESC
LIMIT 50;

-- ----------------------------------------------------------------------------
-- 3. ORPHAN MEDICINES WITH FULL DESIGNATION DETAILS
-- Products with orphan status including designation metadata
-- ----------------------------------------------------------------------------
SELECT
  p.id,
  p.name,
  p.ema_number,
  p.therapeutic_area_mesh,
  p.marketing_authorisation_date,
  d.designation_number,
  d.condition,
  d.prevalence,
  d.significant_benefit,
  d.granted_date,
  d.status AS designation_status
FROM medicinal_products_extended p
JOIN product_designations d ON d.product_id = p.id
WHERE p.orphan_medicine = true
  AND d.designation_type = 'orphan'
  AND d.status = 'active'
ORDER BY p.marketing_authorisation_date DESC;

-- ----------------------------------------------------------------------------
-- 4. PRODUCTS WITH ACTIVE SHORTAGES
-- Current supply issues sorted by severity
-- ----------------------------------------------------------------------------
SELECT
  p.id,
  p.name,
  p.ema_number,
  s.title AS shortage_title,
  s.severity,
  s.status,
  s.reported_date,
  s.expected_resolution_date,
  s.affected_countries,
  s.reason
FROM medicinal_products_extended p
JOIN shortages s ON s.product_id = p.id
WHERE s.status = 'active'
ORDER BY
  CASE s.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  s.reported_date DESC;

-- ----------------------------------------------------------------------------
-- 5. RECENT NEWS AFFECTING PRODUCTS
-- News items from last 30 days with product mentions
-- ----------------------------------------------------------------------------
SELECT
  n.published_date,
  n.title,
  n.news_type,
  n.news_url,
  p.name AS product_name,
  p.ema_number,
  pn.mention_confidence,
  pn.mention_context
FROM news_items n
JOIN product_news pn ON pn.news_id = n.id
JOIN medicinal_products_extended p ON p.id = pn.product_id
WHERE n.published_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY n.published_date DESC;

-- ----------------------------------------------------------------------------
-- 6. REFERRALS WITH AFFECTED PRODUCTS COUNT
-- Overview of referral procedures
-- ----------------------------------------------------------------------------
SELECT
  r.referral_number,
  r.title,
  r.legal_basis,
  r.concern_type,
  r.start_date,
  r.chmp_opinion_date,
  r.commission_decision_date,
  r.outcome,
  COUNT(pr.product_id) AS affected_products_count
FROM referrals r
LEFT JOIN product_referrals pr ON pr.referral_id = r.id
GROUP BY r.id
ORDER BY r.start_date DESC;

-- ----------------------------------------------------------------------------
-- 7. PRODUCTS BY THERAPEUTIC AREA (Top 10)
-- Most common therapeutic areas
-- ----------------------------------------------------------------------------
SELECT
  p.therapeutic_area_mesh,
  COUNT(*) AS product_count,
  COUNT(CASE WHEN p.medicine_status = 'Authorised' THEN 1 END) AS authorised_count,
  COUNT(CASE WHEN p.orphan_medicine = true THEN 1 END) AS orphan_count
FROM medicinal_products_extended p
WHERE p.therapeutic_area_mesh IS NOT NULL
  AND p.category = 'Human'
GROUP BY p.therapeutic_area_mesh
ORDER BY product_count DESC
LIMIT 10;

-- ----------------------------------------------------------------------------
-- 8. DOCUMENTS BY TYPE AND LANGUAGE
-- Document inventory
-- ----------------------------------------------------------------------------
SELECT
  d.document_type,
  d.language,
  COUNT(*) AS document_count,
  COUNT(DISTINCT d.product_id) AS products_with_docs
FROM documents d
GROUP BY d.document_type, d.language
ORDER BY d.document_type, d.language;

-- ----------------------------------------------------------------------------
-- 9. PRODUCTS WITH MOST TIMELINE ACTIVITY
-- Products with highest number of events
-- ----------------------------------------------------------------------------
SELECT
  p.id,
  p.name,
  p.ema_number,
  p.medicine_status,
  COUNT(e.id) AS event_count,
  MAX(e.event_date) AS latest_event_date
FROM medicinal_products_extended p
JOIN timeline_events e ON e.product_id = p.id
GROUP BY p.id
ORDER BY event_count DESC
LIMIT 20;

-- ----------------------------------------------------------------------------
-- 10. CONDITIONAL APPROVALS WITH OBLIGATIONS
-- Products under conditional approval
-- ----------------------------------------------------------------------------
SELECT
  p.name,
  p.ema_number,
  p.marketing_authorisation_date,
  d.specific_obligations,
  d.annual_reassessment_due,
  d.granted_date
FROM medicinal_products_extended p
JOIN product_designations d ON d.product_id = p.id
WHERE p.conditional_approval = true
  AND d.designation_type = 'conditional_approval'
  AND d.status = 'active'
ORDER BY d.annual_reassessment_due ASC;

-- ----------------------------------------------------------------------------
-- 11. PRODUCTS WITH SUBSTANCES AND COMPANIES
-- Complete product overview with relationships
-- ----------------------------------------------------------------------------
SELECT
  p.id,
  p.name,
  p.ema_number,
  p.medicine_status,
  STRING_AGG(DISTINCT s.name, '; ' ORDER BY s.name) AS substances,
  STRING_AGG(DISTINCT c.name, '; ' ORDER BY c.name) AS companies
FROM medicinal_products_extended p
LEFT JOIN product_substances ps ON ps.product_id = p.id
LEFT JOIN substances s ON s.id = ps.substance_id
LEFT JOIN product_companies pc ON pc.product_id = p.id
LEFT JOIN companies c ON c.id = pc.company_id
WHERE p.medicine_status = 'Authorised'
GROUP BY p.id
LIMIT 50;

-- ----------------------------------------------------------------------------
-- 12. PROCEDURES AFFECTING PRODUCTS
-- Recent variations and procedures
-- ----------------------------------------------------------------------------
SELECT
  proc.procedure_number,
  proc.procedure_type,
  proc.title,
  proc.opinion_date,
  proc.outcome,
  p.name AS product_name,
  p.ema_number
FROM procedures proc
JOIN medicinal_products_extended p ON p.id = proc.product_id
WHERE proc.opinion_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY proc.opinion_date DESC;

-- ----------------------------------------------------------------------------
-- 13. EVENT TIMELINE WITH SOURCE ENTITIES
-- Rich event view with source context
-- ----------------------------------------------------------------------------
SELECT
  e.event_date,
  e.event_type,
  e.event_category,
  e.title,
  p.name AS product_name,
  CASE
    WHEN es.source_type = 'document' THEN (
      SELECT d.title FROM documents d WHERE d.id = es.source_id
    )
    WHEN es.source_type = 'procedure' THEN (
      SELECT pr.procedure_number FROM procedures pr WHERE pr.id = es.source_id
    )
    WHEN es.source_type = 'news' THEN (
      SELECT n.title FROM news_items n WHERE n.id = es.source_id
    )
  END AS source_entity_title,
  e.source_url,
  e.confidence
FROM timeline_events e
LEFT JOIN medicinal_products_extended p ON p.id = e.product_id
LEFT JOIN event_sources es ON es.event_id = e.id
WHERE e.event_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY e.event_date DESC
LIMIT 100;

-- ----------------------------------------------------------------------------
-- 14. PRODUCTS WITH MULTIPLE DESIGNATIONS
-- Products with special status
-- ----------------------------------------------------------------------------
SELECT
  p.name,
  p.ema_number,
  ARRAY_AGG(DISTINCT d.designation_type) AS designation_types,
  p.orphan_medicine,
  p.conditional_approval,
  p.accelerated_assessment,
  p.additional_monitoring
FROM medicinal_products_extended p
JOIN product_designations d ON d.product_id = p.id
WHERE d.status = 'active'
GROUP BY p.id
HAVING COUNT(DISTINCT d.designation_type) > 1
ORDER BY p.name;

-- ----------------------------------------------------------------------------
-- 15. CHANGE DETECTION - RECENTLY CRAWLED SOURCES
-- Monitor crawling health
-- ----------------------------------------------------------------------------
SELECT
  source_type,
  source_url,
  last_crawled_at,
  last_success_at,
  http_status,
  item_count,
  CASE
    WHEN last_success_at IS NULL THEN 'Never successful'
    WHEN last_crawled_at > last_success_at THEN 'Last crawl failed'
    WHEN last_crawled_at = last_success_at THEN 'Healthy'
  END AS status
FROM ema_sources
ORDER BY last_crawled_at DESC NULLS LAST;

-- ----------------------------------------------------------------------------
-- 16. PRODUCT SEARCH BY NAME OR SUBSTANCE
-- Full-text search pattern
-- ----------------------------------------------------------------------------
SELECT
  p.id,
  p.name,
  p.ema_number,
  p.active_substance,
  p.therapeutic_area_mesh,
  p.medicine_status
FROM medicinal_products_extended p
WHERE
  p.name ILIKE '%insulin%'
  OR p.active_substance ILIKE '%insulin%'
  OR p.international_non_proprietary_name ILIKE '%insulin%'
ORDER BY
  CASE WHEN p.name ILIKE 'insulin%' THEN 1 ELSE 2 END,
  p.name;

-- ----------------------------------------------------------------------------
-- 17. EVENT AGGREGATION BY CATEGORY
-- Event statistics
-- ----------------------------------------------------------------------------
SELECT
  event_category,
  event_type,
  COUNT(*) AS event_count,
  MIN(event_date) AS earliest_event,
  MAX(event_date) AS latest_event
FROM timeline_events
GROUP BY event_category, event_type
ORDER BY event_category, event_count DESC;

-- ----------------------------------------------------------------------------
-- 18. PRODUCTS WITHOUT RECENT UPDATES
-- Stale products (no updates in 2 years)
-- ----------------------------------------------------------------------------
SELECT
  p.name,
  p.ema_number,
  p.medicine_status,
  p.last_updated_date,
  p.marketing_authorisation_date,
  CURRENT_DATE - p.last_updated_date AS days_since_update
FROM medicinal_products_extended p
WHERE p.last_updated_date < CURRENT_DATE - INTERVAL '2 years'
  AND p.medicine_status = 'Authorised'
ORDER BY p.last_updated_date ASC
LIMIT 50;

-- ----------------------------------------------------------------------------
-- 19. COMPANIES WITH MOST AUTHORISED PRODUCTS
-- Top marketing authorization holders
-- ----------------------------------------------------------------------------
SELECT
  c.name,
  c.country,
  COUNT(DISTINCT pc.product_id) AS product_count,
  COUNT(DISTINCT CASE WHEN p.medicine_status = 'Authorised' THEN pc.product_id END) AS authorised_count
FROM companies c
JOIN product_companies pc ON pc.company_id = c.id
JOIN medicinal_products_extended p ON p.id = pc.product_id
GROUP BY c.id
ORDER BY product_count DESC
LIMIT 20;

-- ----------------------------------------------------------------------------
-- 20. NEWS ITEMS WITHOUT PRODUCT LINKS
-- Unlinked news (candidates for auto-extraction)
-- ----------------------------------------------------------------------------
SELECT
  n.published_date,
  n.title,
  n.news_type,
  n.news_url
FROM news_items n
LEFT JOIN product_news pn ON pn.news_id = n.id
WHERE pn.id IS NULL
  AND n.published_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY n.published_date DESC;
