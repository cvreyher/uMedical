#!/usr/bin/env node

/**
 * Development seed script
 *
 * Fills the local database with realistic sample data so the website can be
 * designed and developed WITHOUT hitting the live EMA/FDA/MHRA APIs
 * (see LIVE_FETCH_ENABLED in apps/api/.env).
 *
 * Idempotent: safe to run multiple times (upserts by slug, seed-tagged
 * timeline events are replaced on each run).
 *
 * Usage: pnpm db:seed:dev  (from packages/database or repo root)
 */

import { config } from 'dotenv'
import { eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import {
  companies,
  medicinalProducts,
  medicinalProductsExtended,
  productCompanies,
  productSubstances,
  pvigilanceEvents,
  shortages,
  substances,
  timelineEvents,
} from '../src/schemas/index.js'

config()

const SEED_SOURCE = 'seed_dev'

const companyData = [
  { slug: 'novo-nordisk', name: 'Novo Nordisk A/S', country: 'Denmark' },
  { slug: 'pfizer', name: 'Pfizer Europe MA EEIG', country: 'Belgium' },
  { slug: 'novartis', name: 'Novartis Europharm Limited', country: 'Ireland' },
  { slug: 'bayer', name: 'Bayer AG', country: 'Germany' },
  { slug: 'roche', name: 'Roche Registration GmbH', country: 'Germany' },
  { slug: 'sanofi', name: 'Sanofi Winthrop Industrie', country: 'France' },
  { slug: 'eli-lilly', name: 'Eli Lilly Nederland B.V.', country: 'Netherlands' },
  { slug: 'abbvie', name: 'AbbVie Deutschland GmbH & Co. KG', country: 'Germany' },
]

const substanceData = [
  { slug: 'semaglutide', innName: 'semaglutide', synonyms: ['NN9535'] },
  { slug: 'tirzepatide', innName: 'tirzepatide', synonyms: ['LY3298176'] },
  { slug: 'apixaban', innName: 'apixaban', synonyms: ['BMS-562247'] },
  { slug: 'rivaroxaban', innName: 'rivaroxaban', synonyms: ['BAY 59-7939'] },
  { slug: 'pembrolizumab', innName: 'pembrolizumab', synonyms: ['MK-3475', 'lambrolizumab'] },
  { slug: 'adalimumab', innName: 'adalimumab', synonyms: ['D2E7'] },
  { slug: 'ocrelizumab', innName: 'ocrelizumab', synonyms: ['RG1594'] },
  { slug: 'tozinameran', innName: 'tozinameran', synonyms: ['BNT162b2', 'COVID-19 mRNA vaccine'] },
]

interface ProductSeed {
  slug: string
  name: string
  emaNumber: string
  medicineStatus: string
  inn: string
  atcCode: string
  therapeuticAreaMesh: string
  therapeuticIndication: string
  authorisationDate: string
  companySlug: string
  substanceSlugs: string[]
  orphanMedicine?: boolean
  biosimilar?: boolean
  additionalMonitoring?: boolean
  advancedTherapy?: boolean
  conditionalApproval?: boolean
}

const productData: ProductSeed[] = [
  {
    slug: 'ozempic',
    name: 'Ozempic',
    emaNumber: 'EMEA/H/C/004174',
    medicineStatus: 'Authorised',
    inn: 'semaglutide',
    atcCode: 'A10BJ06',
    therapeuticAreaMesh: 'Diabetes Mellitus, Type 2',
    therapeuticIndication:
      'Treatment of adults with insufficiently controlled type 2 diabetes mellitus as an adjunct to diet and exercise.',
    authorisationDate: '2018-02-08',
    companySlug: 'novo-nordisk',
    substanceSlugs: ['semaglutide'],
    additionalMonitoring: true,
  },
  {
    slug: 'wegovy',
    name: 'Wegovy',
    emaNumber: 'EMEA/H/C/005422',
    medicineStatus: 'Authorised',
    inn: 'semaglutide',
    atcCode: 'A10BJ06',
    therapeuticAreaMesh: 'Obesity',
    therapeuticIndication:
      'Adjunct to a reduced-calorie diet and increased physical activity for weight management in adults with BMI >= 30 kg/m2.',
    authorisationDate: '2022-01-06',
    companySlug: 'novo-nordisk',
    substanceSlugs: ['semaglutide'],
    additionalMonitoring: true,
  },
  {
    slug: 'mounjaro',
    name: 'Mounjaro',
    emaNumber: 'EMEA/H/C/005620',
    medicineStatus: 'Authorised',
    inn: 'tirzepatide',
    atcCode: 'A10BX16',
    therapeuticAreaMesh: 'Diabetes Mellitus, Type 2; Obesity',
    therapeuticIndication:
      'Treatment of adults with insufficiently controlled type 2 diabetes mellitus and for weight management.',
    authorisationDate: '2022-09-15',
    companySlug: 'eli-lilly',
    substanceSlugs: ['tirzepatide'],
    additionalMonitoring: true,
  },
  {
    slug: 'eliquis',
    name: 'Eliquis',
    emaNumber: 'EMEA/H/C/002148',
    medicineStatus: 'Authorised',
    inn: 'apixaban',
    atcCode: 'B01AF02',
    therapeuticAreaMesh: 'Venous Thromboembolism; Atrial Fibrillation',
    therapeuticIndication:
      'Prevention of stroke and systemic embolism in adult patients with non-valvular atrial fibrillation.',
    authorisationDate: '2011-05-18',
    companySlug: 'pfizer',
    substanceSlugs: ['apixaban'],
  },
  {
    slug: 'xarelto',
    name: 'Xarelto',
    emaNumber: 'EMEA/H/C/000944',
    medicineStatus: 'Authorised',
    inn: 'rivaroxaban',
    atcCode: 'B01AF01',
    therapeuticAreaMesh: 'Venous Thromboembolism; Atrial Fibrillation',
    therapeuticIndication:
      'Prevention of venous thromboembolism and stroke prevention in atrial fibrillation.',
    authorisationDate: '2008-09-30',
    companySlug: 'bayer',
    substanceSlugs: ['rivaroxaban'],
  },
  {
    slug: 'keytruda',
    name: 'Keytruda',
    emaNumber: 'EMEA/H/C/003820',
    medicineStatus: 'Authorised',
    inn: 'pembrolizumab',
    atcCode: 'L01FF02',
    therapeuticAreaMesh: 'Melanoma; Carcinoma, Non-Small-Cell Lung',
    therapeuticIndication:
      'Monotherapy for the treatment of advanced (unresectable or metastatic) melanoma and various other cancers in adults.',
    authorisationDate: '2015-07-17',
    companySlug: 'roche',
    substanceSlugs: ['pembrolizumab'],
  },
  {
    slug: 'humira',
    name: 'Humira',
    emaNumber: 'EMEA/H/C/000481',
    medicineStatus: 'Authorised',
    inn: 'adalimumab',
    atcCode: 'L04AB04',
    therapeuticAreaMesh: 'Arthritis, Rheumatoid; Psoriasis; Crohn Disease',
    therapeuticIndication:
      'Treatment of rheumatoid arthritis, psoriasis, Crohn’s disease and other chronic inflammatory conditions.',
    authorisationDate: '2003-09-08',
    companySlug: 'abbvie',
    substanceSlugs: ['adalimumab'],
  },
  {
    slug: 'ocrevus',
    name: 'Ocrevus',
    emaNumber: 'EMEA/H/C/004043',
    medicineStatus: 'Authorised',
    inn: 'ocrelizumab',
    atcCode: 'L04AG08',
    therapeuticAreaMesh: 'Multiple Sclerosis',
    therapeuticIndication:
      'Treatment of adult patients with relapsing forms of multiple sclerosis and early primary progressive multiple sclerosis.',
    authorisationDate: '2018-01-08',
    companySlug: 'roche',
    substanceSlugs: ['ocrelizumab'],
  },
  {
    slug: 'comirnaty',
    name: 'Comirnaty',
    emaNumber: 'EMEA/H/C/005735',
    medicineStatus: 'Authorised',
    inn: 'tozinameran',
    atcCode: 'J07BN01',
    therapeuticAreaMesh: 'COVID-19',
    therapeuticIndication: 'Active immunisation to prevent COVID-19 caused by SARS-CoV-2.',
    authorisationDate: '2020-12-21',
    companySlug: 'pfizer',
    substanceSlugs: ['tozinameran'],
    conditionalApproval: true,
    additionalMonitoring: true,
  },
  {
    slug: 'zolgensma',
    name: 'Zolgensma',
    emaNumber: 'EMEA/H/C/004750',
    medicineStatus: 'Authorised',
    inn: 'onasemnogene abeparvovec',
    atcCode: 'M09AX09',
    therapeuticAreaMesh: 'Muscular Atrophy, Spinal',
    therapeuticIndication:
      'Treatment of patients with 5q spinal muscular atrophy (SMA) with a bi-allelic mutation in the SMN1 gene.',
    authorisationDate: '2020-05-18',
    companySlug: 'novartis',
    substanceSlugs: [],
    orphanMedicine: true,
    advancedTherapy: true,
    additionalMonitoring: true,
  },
]

async function seed() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not configured')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)

  console.log('🌱 Seeding development data...')

  // --- Companies ---
  await db.insert(companies).values(companyData).onConflictDoNothing()
  const companyRows = await db.select().from(companies)
  const companyIdBySlug = new Map(companyRows.map((c) => [c.slug, c.id]))
  console.log(`  ✓ companies (${companyData.length})`)

  // --- Substances ---
  await db
    .insert(substances)
    .values(substanceData.map((s) => ({ ...s, searchText: `${s.innName} ${s.synonyms.join(' ')}` })))
    .onConflictDoNothing()
  const substanceRows = await db.select().from(substances)
  const substanceIdBySlug = new Map(substanceRows.map((s) => [s.slug, s.id]))
  console.log(`  ✓ substances (${substanceData.length})`)

  // --- Medicinal products (extended table - used by the web app) ---
  await db
    .insert(medicinalProductsExtended)
    .values(
      productData.map((p) => ({
        slug: p.slug,
        name: p.name,
        emaNumber: p.emaNumber,
        category: 'Human',
        medicineStatus: p.medicineStatus,
        internationalNonProprietaryName: p.inn,
        activeSubstance: p.inn,
        therapeuticAreaMesh: p.therapeuticAreaMesh,
        therapeuticIndication: p.therapeuticIndication,
        atcCode: p.atcCode,
        orphanMedicine: p.orphanMedicine ?? false,
        biosimilar: p.biosimilar ?? false,
        additionalMonitoring: p.additionalMonitoring ?? false,
        advancedTherapy: p.advancedTherapy ?? false,
        conditionalApproval: p.conditionalApproval ?? false,
        marketingAuthorisationHolderDeveloperApplicant:
          companyData.find((c) => c.slug === p.companySlug)?.name ?? null,
        marketingAuthorisationDate: p.authorisationDate,
        firstPublishedDate: p.authorisationDate,
        lastUpdatedDate: '2026-06-15',
        medicineUrl: `https://www.ema.europa.eu/en/medicines/human/EPAR/${p.slug}`,
        searchText: `${p.name} ${p.inn} ${p.atcCode}`,
      })),
    )
    .onConflictDoNothing()
  const productRows = await db.select().from(medicinalProductsExtended)
  const productIdBySlug = new Map(productRows.map((p) => [p.slug, p.id]))
  console.log(`  ✓ medicinal products extended (${productData.length})`)

  // --- Phase-1 products + join tables (product <-> substance/company) ---
  await db
    .insert(medicinalProducts)
    .values(
      productData.map((p) => ({
        slug: p.slug,
        name: p.name,
        emaNumber: p.emaNumber,
        status: p.medicineStatus.toLowerCase(),
        authorizationDate: p.authorisationDate,
        emaUrl: `https://www.ema.europa.eu/en/medicines/human/EPAR/${p.slug}`,
        therapeuticArea: p.therapeuticAreaMesh,
        conditionIndication: p.therapeuticIndication,
        atcCode: p.atcCode,
      })),
    )
    .onConflictDoNothing()
  const phase1Rows = await db.select().from(medicinalProducts)
  const phase1IdBySlug = new Map(phase1Rows.map((p) => [p.slug, p.id]))

  for (const p of productData) {
    const productId = phase1IdBySlug.get(p.slug)
    if (!productId) continue

    const companyId = companyIdBySlug.get(p.companySlug)
    if (companyId) {
      await db
        .insert(productCompanies)
        .values({ productId, companyId, role: 'mah' })
        .onConflictDoNothing()
    }

    for (const substanceSlug of p.substanceSlugs) {
      const substanceId = substanceIdBySlug.get(substanceSlug)
      if (substanceId) {
        await db
          .insert(productSubstances)
          .values({ productId, substanceId, isActive: true })
          .onConflictDoNothing()
      }
    }
  }
  console.log('  ✓ product <-> company/substance links')

  // --- Timeline events (replace previously seeded rows for idempotency) ---
  await db.delete(timelineEvents).where(eq(timelineEvents.sourceType, SEED_SOURCE))

  const timelineData = productData.flatMap((p) => {
    const productId = productIdBySlug.get(p.slug)
    if (!productId) return []
    return [
      {
        eventType: 'authorised',
        eventCategory: 'regulatory' as const,
        productId,
        title: `${p.name} authorised in the EU`,
        description: `The European Commission granted marketing authorisation for ${p.name} (${p.inn}).`,
        eventDate: p.authorisationDate,
        eventData: { newStatus: 'Authorised' },
        sourceUrl: `https://www.ema.europa.eu/en/medicines/human/EPAR/${p.slug}`,
        sourceType: SEED_SOURCE,
        confidence: 'high',
      },
      {
        eventType: 'epar_updated',
        eventCategory: 'documents' as const,
        productId,
        title: `EPAR updated for ${p.name}`,
        description: 'The European Public Assessment Report was updated.',
        eventDate: '2026-05-20',
        eventData: { documentType: 'EPAR' },
        sourceUrl: `https://www.ema.europa.eu/en/medicines/human/EPAR/${p.slug}`,
        sourceType: SEED_SOURCE,
        confidence: 'high',
      },
    ]
  })
  await db.insert(timelineEvents).values(timelineData)
  console.log(`  ✓ timeline events (${timelineData.length})`)

  // --- Pharmacovigilance events ---
  const pvEventData = [
    {
      slug: 'seed-fda-recall-eliquis-2026-001',
      sourceAuthority: 'FDA',
      region: 'US',
      eventType: 'recall',
      eventCategory: 'quality',
      severity: 'high',
      title: 'Eliquis (apixaban) 5 mg tablets - recall of specific lots',
      description: 'Voluntary recall of specific lots due to a packaging defect.',
      eventDate: '2026-03-14',
      eventData: { recallClass: 'II' as const, lotNumbers: ['A123456', 'A123457'], reasonForRecall: 'Packaging defect' },
      sourceUrl: 'https://www.fda.gov/safety/recalls',
    },
    {
      slug: 'seed-bfarm-rhb-ozempic-2026-001',
      sourceAuthority: 'BfArM',
      region: 'DE',
      eventType: 'dhpc',
      eventCategory: 'safety',
      severity: 'medium',
      title: 'Rote-Hand-Brief zu Ozempic (Semaglutid): Hinweise zu gefälschten Pens',
      description: 'Warnung vor gefälschten Ozempic-Pens in der Lieferkette.',
      eventDate: '2026-02-02',
      eventData: { keyMessages: ['Gefälschte Pens im Umlauf', 'Chargen prüfen'], targetAudience: ['Ärzte', 'Apotheker'] },
      sourceUrl: 'https://www.bfarm.de/rote-hand-briefe',
    },
    {
      slug: 'seed-ema-signal-keytruda-2026-001',
      sourceAuthority: 'EMA',
      region: 'EU',
      eventType: 'safety_alert',
      eventCategory: 'safety',
      severity: 'medium',
      title: 'PRAC safety signal: pembrolizumab and immune-related myocarditis',
      description: 'PRAC is evaluating a potential signal of immune-related myocarditis.',
      eventDate: '2026-04-10',
      eventData: { affectedProducts: ['Keytruda'], recommendedActions: ['Monitor cardiac symptoms'] },
      sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory/post-authorisation/pharmacovigilance',
    },
    {
      slug: 'seed-mhra-alert-xarelto-2026-001',
      sourceAuthority: 'MHRA',
      region: 'UK',
      eventType: 'label_change',
      eventCategory: 'regulatory',
      severity: 'low',
      title: 'Xarelto (rivaroxaban): updated dosing guidance in renal impairment',
      description: 'Product information updated with revised dosing recommendations.',
      eventDate: '2026-01-22',
      eventData: { changeType: 'dosing', affectedSections: ['4.2'] },
      sourceUrl: 'https://www.gov.uk/drug-safety-update',
    },
    {
      slug: 'seed-swissmedic-hpc-humira-2026-001',
      sourceAuthority: 'Swissmedic',
      region: 'CH',
      eventType: 'dhpc',
      eventCategory: 'safety',
      severity: 'medium',
      title: 'HPC letter: Humira (adalimumab) - risk of serious infections',
      description: 'Reminder about screening for latent tuberculosis before treatment.',
      eventDate: '2026-05-05',
      eventData: { keyMessages: ['TB screening before start'], targetAudience: ['Physicians'] },
      sourceUrl: 'https://www.swissmedic.ch',
    },
    {
      slug: 'seed-fda-medwatch-mounjaro-2026-001',
      sourceAuthority: 'FDA',
      region: 'US',
      eventType: 'safety_alert',
      eventCategory: 'safety',
      severity: 'info',
      title: 'MedWatch: Mounjaro (tirzepatide) - reports of gastrointestinal events',
      description: 'FDA is monitoring reports of severe gastrointestinal adverse events.',
      eventDate: '2026-06-01',
      eventData: { affectedProducts: ['Mounjaro'] },
      sourceUrl: 'https://www.fda.gov/safety/medwatch',
    },
  ]
  await db.insert(pvigilanceEvents).values(pvEventData).onConflictDoNothing()
  console.log(`  ✓ pharmacovigilance events (${pvEventData.length})`)

  // --- Shortages ---
  const shortageData = [
    {
      slug: 'seed-ema-shortage-ozempic',
      sourceAuthority: 'EMA',
      region: 'EU',
      productId: productIdBySlug.get('ozempic') ?? null,
      substanceId: substanceIdBySlug.get('semaglutide') ?? null,
      inn: 'semaglutide',
      title: 'Ozempic (semaglutide) - supply shortage',
      description: 'Intermittent supply shortages due to exceptional increase in demand.',
      medicineAffected: 'Ozempic',
      reason: 'Increased demand exceeding manufacturing capacity',
      status: 'active',
      severity: 'high',
      startOfShortageDate: '2025-11-01',
      expectedResolutionDate: '2026-12-31',
      reportedDate: '2025-11-01',
      affectedCountries: 'DE,FR,IT,ES,NL',
      alternativeTreatments: 'Other GLP-1 receptor agonists where clinically appropriate',
      sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory/post-authorisation/availability-medicines/shortages-catalogue',
    },
    {
      slug: 'seed-bfarm-shortage-mounjaro',
      sourceAuthority: 'BfArM',
      region: 'DE',
      productId: productIdBySlug.get('mounjaro') ?? null,
      substanceId: substanceIdBySlug.get('tirzepatide') ?? null,
      inn: 'tirzepatide',
      title: 'Mounjaro (Tirzepatid) - Lieferengpass',
      description: 'Lieferengpass aufgrund stark gestiegener Nachfrage.',
      medicineAffected: 'Mounjaro',
      reason: 'Nachfrage übersteigt Produktionskapazität',
      status: 'active',
      severity: 'medium',
      startOfShortageDate: '2026-02-15',
      expectedResolutionDate: '2026-09-30',
      reportedDate: '2026-02-15',
      affectedCountries: 'DE',
      sourceUrl: 'https://www.bfarm.de/lieferengpaesse',
    },
    {
      slug: 'seed-ema-shortage-comirnaty-resolved',
      sourceAuthority: 'EMA',
      region: 'EU',
      productId: productIdBySlug.get('comirnaty') ?? null,
      substanceId: substanceIdBySlug.get('tozinameran') ?? null,
      inn: 'tozinameran',
      title: 'Comirnaty - temporary distribution delay (resolved)',
      description: 'Temporary distribution delay, meanwhile resolved.',
      medicineAffected: 'Comirnaty',
      reason: 'Logistics constraints',
      status: 'resolved',
      severity: 'low',
      startOfShortageDate: '2025-12-01',
      actualResolutionDate: '2026-01-15',
      reportedDate: '2025-12-01',
      affectedCountries: 'EU',
      sourceUrl: 'https://www.ema.europa.eu/en/human-regulatory/post-authorisation/availability-medicines/shortages-catalogue',
    },
  ]
  await db.insert(shortages).values(shortageData).onConflictDoNothing()
  console.log(`  ✓ shortages (${shortageData.length})`)

  // Summary
  const seededSlugs = productData.map((p) => p.slug)
  const seeded = await db
    .select({ slug: medicinalProductsExtended.slug })
    .from(medicinalProductsExtended)
    .where(inArray(medicinalProductsExtended.slug, seededSlugs))
  console.log(`\n✅ Done. ${seeded.length}/${seededSlugs.length} sample products available.`)
  console.log('   Tip: keep LIVE_FETCH_ENABLED=false in apps/api/.env to work offline with this data.')

  await pool.end()
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error)
  process.exit(1)
})
