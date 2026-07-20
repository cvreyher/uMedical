// Use relative URL for client-side (proxied via middleware)
// Server-side requests are handled by fetch-client.ts with API_UPSTREAM_BASE_URL
const API_BASE_URL = typeof window !== 'undefined' 
  ? '/api' // Client-side: use relative URL (proxied by middleware)
  : (process.env.API_UPSTREAM_BASE_URL || 'http://localhost:3000') + '/api' // Server-side: direct to backend

// ============ Types ============

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface Medicine {
  id: number
  slug: string
  name: string
  emaNumber: string | null
  category: string
  medicineStatus: string
  activeSubstance: string | null
  atcCode: string | null
  orphanMedicine: boolean
  marketingAuthorisationDate: string | null
  lastUpdatedDate: string | null
  medicineUrl: string | null
}

export interface MedicineDetail extends Medicine {
  internationalNonProprietaryName: string | null
  therapeuticAreaMesh: string | null
  therapeuticIndication: string | null
  pharmacotherapeuticGroup: string | null
  patientSafety: boolean
  acceleratedAssessment: boolean
  additionalMonitoring: boolean
  advancedTherapy: boolean
  biosimilar: boolean
  conditionalApproval: boolean
  exceptionalCircumstances: boolean
  genericOrHybrid: boolean
  primePriorityMedicine: boolean
  marketingAuthorisationHolderDeveloperApplicant: string | null
  opinionAdoptedDate: string | null
  europeanCommissionDecisionDate: string | null
  withdrawalExpiryRevocationLapseDate: string | null
  firstPublishedDate: string | null
  revisionNumber: number | null
  substances: Array<{
    id: number
    slug: string
    innName: string
  }>
  companies: Array<{
    id: number
    slug: string
    name: string
    role: string
  }>
  timeline: TimelineEvent[]
}

export interface Substance {
  id: number
  slug: string
  innName: string
  createdAt: string
  updatedAt: string
}

export interface SubstanceDetail extends Substance {
  medicines: Array<{
    id: number
    slug: string
    name: string
    medicineStatus: string
    category: string
  }>
}

export interface Company {
  id: number
  slug: string
  name: string
  country: string | null
  createdAt: string
  updatedAt: string
}

export interface CompanyDetail extends Company {
  medicines: Array<{
    id: number
    slug: string
    name: string
    medicineStatus: string
    category: string
    role: string
  }>
}

export interface TimelineEvent {
  id: number
  eventType: string
  eventCategory: string
  productId: number | null
  title: string
  description: string | null
  eventDate: string
  eventData: Record<string, unknown> | null
  sourceUrl: string
  sourceType?: string // Agency source type (e.g., "ema_medicines_json", "fda_documents_json")
  confidence: string
  createdAt: string
  medicine?: {
    id: number
    slug: string
    name: string
  }
}

export interface MedicineStats {
  total: number
  byStatus: Record<string, number>
  byCategory: Record<string, number>
  orphanMedicines: number
}

export interface EventStats {
  total: number
  byType: Record<string, number>
  byCategory: Record<string, number>
}

export interface ImportLog {
  id: number
  source: string
  sourceUrl: string
  status: string
  startedAt: string
  completedAt: string | null
  totalFetched: number
  productsCreated: number
  productsUpdated: number
  substancesCreated: number
  companiesCreated: number
  errorCount: number
  errors: string[] | null
  metadata: Record<string, unknown> | null
}

// ============ Statistics Types ============

export interface ProductsOverview {
  total: number
  byStatus: Record<string, number>
  byCategory: Record<string, number>
  designations: {
    orphanMedicine: number
    biosimilar: number
    advancedTherapy: number
    additionalMonitoring: number
    genericOrHybrid: number
    conditionalApproval: number
    exceptionalCircumstances: number
    acceleratedAssessment: number
    primePriorityMedicine: number
  }
}

export interface ProductsByStatus {
  total: number
  breakdown: Array<{ status: string; count: number }>
  percentages: Array<{ status: string; count: number; percentage: string }>
}

export interface ProductsByCategory {
  totals: Record<string, number>
  breakdown: Array<{ category: string; status: string; count: number }>
}

export interface ProductDesignations {
  orphanMedicine: number
  biosimilar: number
  advancedTherapy: number
  additionalMonitoring: number
  genericOrHybrid: number
  conditionalApproval: number
  exceptionalCircumstances: number
  acceleratedAssessment: number
  primePriorityMedicine: number
  patientSafety: number
}

export interface ApprovalsPerYear {
  period: { startYear: number; endYear: number }
  data: Array<{ year: number; count: number }>
  total: number
}

export interface ApprovalsPerMonth {
  data: Array<{ yearMonth: string; count: number }>
}

export interface WithdrawalsPerYear {
  data: Array<{ year: number; count: number }>
}

export interface WithdrawalRate {
  authorized: number
  withdrawn: number
  total: number
  withdrawalRate: string
}

export interface ProductLifecycle {
  averageAgeDays: number
  averageAgeYears: string
  byAgeGroup: Array<{ ageGroup: string; count: number }>
  oldestProducts: Array<{ name: string; slug: string; authorisationDate: string }>
}

export interface OpinionToAuthorization {
  averageDays: number
  minDays: number
  maxDays: number
  productsWithBothDates: number
}

export interface AtcDistribution {
  level: number
  data: Array<{ atcCode: string; count: number; description?: string }>
}

export interface TopAtcCodes {
  data: Array<{ atcCode: string; pharmacotherapeuticGroup: string | null; count: number }>
}

export interface TherapeuticAreasMesh {
  data: Array<{ meshTerm: string; count: number }>
}

export interface OrphanDiseaseCoverage {
  totalOrphanMedicines: number
  byTherapeuticArea: Array<{ meshTerm: string; count: number }>
}

export interface PharmacotherapeuticGroups {
  data: Array<{ group: string; count: number }>
}

export interface CompaniesOverview {
  totalCompanies: number
  topByProductCount: Array<{
    id: number
    name: string
    slug: string
    country: string | null
    productCount: number
  }>
}

export interface TopMah {
  data: Array<{
    id: number
    name: string
    slug: string
    country: string | null
    productCount: number
  }>
}

export interface CompaniesByCountry {
  data: Array<{ country: string | null; companyCount: number }>
}

export interface MarketConcentration {
  totalProducts: number
  totalCompanies: number
  top20Companies: Array<{
    rank: number
    name: string
    productCount: number
    marketShare: string
    cumulativeShare: string
  }>
  herfindahlIndex: number
  top5Share: string
  top10Share: string
}

export interface ProductsPerCompany {
  distribution: Record<string, number>
  totalCompaniesWithProducts: number
}

export interface MostActiveCompanies {
  period: { months: number; startDate: string }
  data: Array<{
    name: string
    slug: string
    country: string | null
    newApprovals: number
  }>
}

export interface SubstancesOverview {
  totalSubstances: number
  totalProducts: number
  productsWithSubstanceLinks: number
}

export interface MostCommonSubstances {
  data: Array<{
    id: number
    slug: string
    innName: string
    productCount: number
  }>
}

export interface MultiProductSubstances {
  minProductThreshold: number
  data: Array<{
    slug: string
    innName: string
    productCount: number
  }>
}

export interface SubstancesPerProduct {
  averageSubstancesPerProduct: string
  distribution: Record<string, number>
  totalProductsWithSubstances: number
}

export interface MostVersatileSubstances {
  data: Array<{
    innName: string
    slug: string
    productCount: number
    uniqueAtcCodes: number
  }>
}

export interface ProceduresOverview {
  total: number
  byType: Array<{ type: string; count: number }>
}

export interface ProceduresByType {
  data: Array<{ type: string; count: number }>
}

export interface ProceduresPerProduct {
  averageProceduresPerProduct: string
  productsWithProcedures: number
  mostActiveProducts: Array<{ name: string; slug: string; procedureCount: number }>
}

export interface ReferralsOverview {
  total: number
  byLegalBasis: Array<{ legalBasis: string | null; count: number }>
  byConcernType: Array<{ concernType: string | null; count: number }>
  byOutcome: Array<{ outcome: string | null; count: number }>
}

export interface ReferralsByLegalBasis {
  data: Array<{ legalBasis: string | null; count: number }>
}

export interface ReferralDuration {
  averageDays: number
  referralsWithBothDates: number
}

export interface EventsOverview {
  total: number
  byCategory: Array<{ category: string; count: number }>
  byType: Array<{ type: string; count: number }>
}

export interface EventsByCategory {
  data: Array<{ category: string; count: number }>
}

export interface MostEventfulProducts {
  data: Array<{ name: string; slug: string; eventCount: number }>
}

export interface EventFrequency {
  data: Array<{ yearMonth: string; count: number }>
}

export interface ShortagesOverview {
  total: number
  activeShortages: number
  byStatus: Array<{ status: string; count: number }>
  bySeverity: Array<{ severity: string | null; count: number }>
  byAuthority: Array<{ authority: string; count: number }>
  byRegion: Array<{ region: string; count: number }>
}

export interface ShortagesByAuthority {
  data: Array<{
    authority: string
    region: string
    count: number
    activeCount: number
  }>
}

export interface ShortagesByRegion {
  data: Array<{
    region: string
    authority: string
    total: number
    active: number
    resolved: number
  }>
}

export interface ShortagesByInn {
  data: Array<{
    inn: string
    total: number
    activeCount: number
    authorities: string
  }>
}

export interface ActiveShortages {
  count: number
  data: Array<{
    id: number
    slug: string | null
    title: string
    medicineAffected: string | null
    inn: string | null
    sourceAuthority: string
    region: string
    severity: string | null
    category: string | null
    therapeuticAreaMesh: string | null
    pharmaceuticalFormsAffected: string | null
    strengthsAffected: string | null
    availabilityOfAlternatives: string | null
    startOfShortageDate: string | null
    expectedResolutionDate: string | null
    lastUpdatedDate: string | null
    sourceUrl: string | null
    product: { name: string; slug: string } | null
  }>
}

export interface ShortagesDuration {
  overall: {
    averageDaysToResolution: number
    resolvedShortagesWithData: number
  }
  byAuthority: Array<{
    authority: string
    averageDays: number
    count: number
  }>
}

export interface MostAffectedProducts {
  data: Array<{ name: string; slug: string; shortageCount: number }>
}

export interface ShortagesByCountry {
  data: Array<{ country: string; count: number }>
}

export interface ShortagesOverTime {
  data: Array<{ yearMonth: string; authority: string; count: number }>
}

export interface AdditionalMonitoring {
  total: number
  products: Array<{ name: string; slug: string; status: string }>
}

export interface DataCompleteness {
  totalProducts: number
  completeness: {
    atcCode: { complete: number; missing: number; percentComplete: string }
    marketingAuthorisationHolder: { complete: number; missing: number; percentComplete: string }
    marketingAuthorisationDate: { complete: number; missing: number; percentComplete: string }
    internationalNonProprietaryName: { complete: number; missing: number; percentComplete: string }
    therapeuticAreaMesh: { complete: number; missing: number; percentComplete: string }
  }
}

export interface DataCoverage {
  totalProducts: number
  coverage: {
    substances: number
    companies: number
    timelineEvents: number
    procedures: number
  }
}

export interface RecentlyUpdated {
  data: Array<{
    name: string
    slug: string
    lastUpdatedDate: string | null
    updatedAt: string
  }>
}

export interface DataStaleness {
  updatedWithin6Months: number
  updatedBetween6And12Months: number
  notUpdatedInOver1Year: number
}

export interface NewsOverview {
  total: number
  byType: Array<{ type: string | null; count: number }>
}

export interface NewsByType {
  data: Array<{ type: string | null; count: number }>
}

export interface MostCoveredProducts {
  data: Array<{ name: string; slug: string; newsCount: number }>
}

export interface NewsFrequency {
  data: Array<{ yearMonth: string; count: number }>
}

export interface OrphanWithdrawalCorrelation {
  orphanMedicines: { total: number; withdrawn: number; rate: string }
  nonOrphanMedicines: { total: number; withdrawn: number; rate: string }
}

export interface DesignationCombinations {
  productsWithMultipleDesignations: number
  examples: Array<{
    name: string
    slug: string
    orphan: boolean | null
    biosimilar: boolean | null
    advancedTherapy: boolean | null
    conditionalApproval: boolean | null
    acceleratedAssessment: boolean | null
    exceptionalCircumstances: boolean | null
    primePriority: boolean | null
  }>
}

export interface CompanyPortfolioDiversity {
  data: Array<{
    name: string
    slug: string
    productCount: number
    uniqueAtcAreas: number
  }>
}

export interface ApprovalTrendsByDesignation {
  data: Array<{
    year: number
    total: number
    orphan: number
    biosimilar: number
    advancedTherapy: number
    genericOrHybrid: number
  }>
}

// ============ API Client ============

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    next: { revalidate: 60 }, // Cache for 60 seconds
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export const api = {
  medicines: {
    list: (params?: {
      page?: number
      limit?: number
      search?: string
      status?: string
      category?: string
      orphan?: boolean
      atcCode?: string
    }) => {
      const searchParams = new URLSearchParams()
      if (params?.page) searchParams.set('page', String(params.page))
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.search) searchParams.set('search', params.search)
      if (params?.status) searchParams.set('status', params.status)
      if (params?.category) searchParams.set('category', params.category)
      if (params?.orphan) searchParams.set('orphan', 'true')
      if (params?.atcCode) searchParams.set('atcCode', params.atcCode)
      const query = searchParams.toString()
      return fetchApi<PaginatedResponse<Medicine>>(`/medicines${query ? `?${query}` : ''}`)
    },
    get: (slug: string) => fetchApi<MedicineDetail>(`/medicines/${slug}`),
    stats: () => fetchApi<MedicineStats>('/medicines/stats'),
    timeline: (slug: string, limit?: number) =>
      fetchApi<{ data: TimelineEvent[] }>(`/medicines/${slug}/timeline${limit ? `?limit=${limit}` : ''}`),
  },
  substances: {
    list: (params?: { page?: number; limit?: number; search?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.page) searchParams.set('page', String(params.page))
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.search) searchParams.set('search', params.search)
      const query = searchParams.toString()
      return fetchApi<PaginatedResponse<Substance>>(`/substances${query ? `?${query}` : ''}`)
    },
    get: (slug: string) => fetchApi<SubstanceDetail>(`/substances/${slug}`),
  },
  companies: {
    list: (params?: { page?: number; limit?: number; search?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.page) searchParams.set('page', String(params.page))
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.search) searchParams.set('search', params.search)
      const query = searchParams.toString()
      return fetchApi<PaginatedResponse<Company>>(`/companies${query ? `?${query}` : ''}`)
    },
    get: (slug: string) => fetchApi<CompanyDetail>(`/companies/${slug}`),
  },
  events: {
    list: (params?: {
      page?: number
      limit?: number
      eventType?: string
      eventCategory?: string
      from?: string
      to?: string
    }) => {
      const searchParams = new URLSearchParams()
      if (params?.page) searchParams.set('page', String(params.page))
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.eventType) searchParams.set('eventType', params.eventType)
      if (params?.eventCategory) searchParams.set('eventCategory', params.eventCategory)
      if (params?.from) searchParams.set('from', params.from)
      if (params?.to) searchParams.set('to', params.to)
      const query = searchParams.toString()
      return fetchApi<PaginatedResponse<TimelineEvent>>(`/events${query ? `?${query}` : ''}`)
    },
    recent: (limit?: number) =>
      fetchApi<{ data: TimelineEvent[] }>(`/events/recent${limit ? `?limit=${limit}` : ''}`),
    stats: () => fetchApi<EventStats>('/events/stats'),
    get: (id: number) => fetchApi<TimelineEvent & { medicine?: MedicineDetail }>(`/events/${id}`),
  },
  admin: {
    imports: {
      list: (params?: { page?: number; limit?: number; status?: string }) => {
        const searchParams = new URLSearchParams()
        if (params?.page) searchParams.set('page', String(params.page))
        if (params?.limit) searchParams.set('limit', String(params.limit))
        if (params?.status) searchParams.set('status', params.status)
        const query = searchParams.toString()
        return fetchApi<PaginatedResponse<ImportLog>>(`/admin/imports${query ? `?${query}` : ''}`)
      },
      latest: () => fetchApi<ImportLog | null>('/admin/imports/latest'),
      get: (id: number) => fetchApi<ImportLog>(`/admin/imports/${id}`),
    },
    ema: {
      status: () =>
        fetchApi<{
          medicines: {
            importInProgress: boolean
            lastImportTime: string | null
            lastImportResult: {
              totalFetched: number
              productsCreated: number
              productsUpdated: number
              eventsCreated: number
              errors: string[]
            } | null
          }
          shortages: {
            importInProgress: boolean
            lastImportTime: string | null
            lastImportResult: {
              totalFetched: number
              shortagesCreated: number
              shortagesUpdated: number
              shortagesSkipped: number
              substancesLinked: number
              errors: string[]
            } | null
          }
        }>('/admin/ema/status'),
      triggerImport: () =>
        fetchApi<{ message: string; status: string }>('/admin/ema/import', { method: 'POST' }),
      triggerExtendedImport: () =>
        fetchApi<{ message: string; status: string }>('/admin/ema/import/extended', { method: 'POST' }),
      triggerShortagesImport: () =>
        fetchApi<{ message: string; status: string }>('/admin/ema/import/shortages', { method: 'POST' }),
      shortagesStatus: () =>
        fetchApi<{
          importInProgress: boolean
          lastImportTime: string | null
          lastImportResult: {
            totalFetched: number
            shortagesCreated: number
            shortagesUpdated: number
            substancesLinked: number
            errors: string[]
          } | null
        }>('/admin/ema/status/shortages'),
    },
  },
  statistics: {
    products: {
      overview: () => fetchApi<ProductsOverview>('/statistics/products/overview'),
      byStatus: () => fetchApi<ProductsByStatus>('/statistics/products/by-status'),
      byCategory: () => fetchApi<ProductsByCategory>('/statistics/products/by-category'),
      designations: () => fetchApi<ProductDesignations>('/statistics/products/designations'),
      approvalsPerYear: (params?: { startYear?: number; endYear?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.startYear) searchParams.set('startYear', String(params.startYear))
        if (params?.endYear) searchParams.set('endYear', String(params.endYear))
        const query = searchParams.toString()
        return fetchApi<ApprovalsPerYear>(`/statistics/products/approvals-per-year${query ? `?${query}` : ''}`)
      },
      approvalsPerMonth: (params?: { months?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.months) searchParams.set('months', String(params.months))
        const query = searchParams.toString()
        return fetchApi<ApprovalsPerMonth>(`/statistics/products/approvals-per-month${query ? `?${query}` : ''}`)
      },
      withdrawalsPerYear: () => fetchApi<WithdrawalsPerYear>('/statistics/products/withdrawals-per-year'),
      withdrawalRate: () => fetchApi<WithdrawalRate>('/statistics/products/withdrawal-rate'),
      lifecycle: () => fetchApi<ProductLifecycle>('/statistics/products/lifecycle'),
      opinionToAuthorization: () => fetchApi<OpinionToAuthorization>('/statistics/products/opinion-to-authorization'),
    },
    therapeutic: {
      atcDistribution: (params?: { level?: number; limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.level) searchParams.set('level', String(params.level))
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<AtcDistribution>(`/statistics/therapeutic/atc-distribution${query ? `?${query}` : ''}`)
      },
      topAtcCodes: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<TopAtcCodes>(`/statistics/therapeutic/top-atc-codes${query ? `?${query}` : ''}`)
      },
      therapeuticAreasMesh: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<TherapeuticAreasMesh>(`/statistics/therapeutic/therapeutic-areas-mesh${query ? `?${query}` : ''}`)
      },
      orphanDiseaseCoverage: () => fetchApi<OrphanDiseaseCoverage>('/statistics/therapeutic/orphan-disease-coverage'),
      pharmacotherapeuticGroups: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<PharmacotherapeuticGroups>(`/statistics/therapeutic/pharmacotherapeutic-groups${query ? `?${query}` : ''}`)
      },
    },
    companies: {
      overview: () => fetchApi<CompaniesOverview>('/statistics/companies/overview'),
      topMah: (params?: { limit?: number; status?: string }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        if (params?.status) searchParams.set('status', params.status)
        const query = searchParams.toString()
        return fetchApi<TopMah>(`/statistics/companies/top-mah${query ? `?${query}` : ''}`)
      },
      byCountry: () => fetchApi<CompaniesByCountry>('/statistics/companies/by-country'),
      marketConcentration: () => fetchApi<MarketConcentration>('/statistics/companies/market-concentration'),
      productsPerCompany: () => fetchApi<ProductsPerCompany>('/statistics/companies/products-per-company'),
      mostActive: (params?: { months?: number; limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.months) searchParams.set('months', String(params.months))
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<MostActiveCompanies>(`/statistics/companies/most-active${query ? `?${query}` : ''}`)
      },
    },
    substances: {
      overview: () => fetchApi<SubstancesOverview>('/statistics/substances/overview'),
      mostCommon: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<MostCommonSubstances>(`/statistics/substances/most-common${query ? `?${query}` : ''}`)
      },
      multiProduct: (params?: { minProducts?: number; limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.minProducts) searchParams.set('minProducts', String(params.minProducts))
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<MultiProductSubstances>(`/statistics/substances/multi-product${query ? `?${query}` : ''}`)
      },
      substancesPerProduct: () => fetchApi<SubstancesPerProduct>('/statistics/substances/substances-per-product'),
      mostVersatile: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<MostVersatileSubstances>(`/statistics/substances/most-versatile${query ? `?${query}` : ''}`)
      },
    },
    regulatory: {
      proceduresOverview: () => fetchApi<ProceduresOverview>('/statistics/regulatory/procedures/overview'),
      proceduresByType: () => fetchApi<ProceduresByType>('/statistics/regulatory/procedures/by-type'),
      proceduresPerProduct: () => fetchApi<ProceduresPerProduct>('/statistics/regulatory/procedures/per-product'),
      referralsOverview: () => fetchApi<ReferralsOverview>('/statistics/regulatory/referrals/overview'),
      referralsByLegalBasis: () => fetchApi<ReferralsByLegalBasis>('/statistics/regulatory/referrals/by-legal-basis'),
      referralDuration: () => fetchApi<ReferralDuration>('/statistics/regulatory/referrals/duration'),
      eventsOverview: () => fetchApi<EventsOverview>('/statistics/regulatory/events/overview'),
      eventsByCategory: () => fetchApi<EventsByCategory>('/statistics/regulatory/events/by-category'),
      mostEventfulProducts: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<MostEventfulProducts>(`/statistics/regulatory/events/most-eventful-products${query ? `?${query}` : ''}`)
      },
      eventFrequency: (params?: { months?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.months) searchParams.set('months', String(params.months))
        const query = searchParams.toString()
        return fetchApi<EventFrequency>(`/statistics/regulatory/events/frequency${query ? `?${query}` : ''}`)
      },
    },
    safety: {
      shortagesOverview: () => fetchApi<ShortagesOverview>('/statistics/safety/shortages/overview'),
      activeShortages: (params?: { authority?: string; region?: string; limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.authority) searchParams.set('authority', params.authority)
        if (params?.region) searchParams.set('region', params.region)
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<ActiveShortages>(`/statistics/safety/shortages/active${query ? `?${query}` : ''}`)
      },
      shortagesByAuthority: (params?: { status?: string }) => {
        const searchParams = new URLSearchParams()
        if (params?.status) searchParams.set('status', params.status)
        const query = searchParams.toString()
        return fetchApi<ShortagesByAuthority>(`/statistics/safety/shortages/by-authority${query ? `?${query}` : ''}`)
      },
      shortagesByRegion: () => fetchApi<ShortagesByRegion>('/statistics/safety/shortages/by-region'),
      shortagesByInn: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<ShortagesByInn>(`/statistics/safety/shortages/by-inn${query ? `?${query}` : ''}`)
      },
      shortagesDuration: () => fetchApi<ShortagesDuration>('/statistics/safety/shortages/duration'),
      mostAffectedProducts: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<MostAffectedProducts>(`/statistics/safety/shortages/affected-products${query ? `?${query}` : ''}`)
      },
      shortagesByCountry: () => fetchApi<ShortagesByCountry>('/statistics/safety/shortages/by-country'),
      shortagesOverTime: (params?: { months?: number; authority?: string }) => {
        const searchParams = new URLSearchParams()
        if (params?.months) searchParams.set('months', String(params.months))
        if (params?.authority) searchParams.set('authority', params.authority)
        const query = searchParams.toString()
        return fetchApi<ShortagesOverTime>(`/statistics/safety/shortages/over-time${query ? `?${query}` : ''}`)
      },
      additionalMonitoring: () => fetchApi<AdditionalMonitoring>('/statistics/safety/monitoring/additional'),
    },
    dataQuality: {
      completeness: () => fetchApi<DataCompleteness>('/statistics/data-quality/completeness'),
      coverage: () => fetchApi<DataCoverage>('/statistics/data-quality/coverage'),
      recentlyUpdated: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<RecentlyUpdated>(`/statistics/data-quality/recently-updated${query ? `?${query}` : ''}`)
      },
      staleness: () => fetchApi<DataStaleness>('/statistics/data-quality/staleness'),
    },
    news: {
      overview: () => fetchApi<NewsOverview>('/statistics/news/overview'),
      byType: () => fetchApi<NewsByType>('/statistics/news/by-type'),
      mostCoveredProducts: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<MostCoveredProducts>(`/statistics/news/most-covered-products${query ? `?${query}` : ''}`)
      },
      frequency: (params?: { months?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.months) searchParams.set('months', String(params.months))
        const query = searchParams.toString()
        return fetchApi<NewsFrequency>(`/statistics/news/frequency${query ? `?${query}` : ''}`)
      },
    },
    analytics: {
      orphanWithdrawalCorrelation: () => fetchApi<OrphanWithdrawalCorrelation>('/statistics/analytics/orphan-withdrawal-correlation'),
      designationCombinations: () => fetchApi<DesignationCombinations>('/statistics/analytics/designation-combinations'),
      companyPortfolioDiversity: (params?: { limit?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.limit) searchParams.set('limit', String(params.limit))
        const query = searchParams.toString()
        return fetchApi<CompanyPortfolioDiversity>(`/statistics/analytics/company-portfolio-diversity${query ? `?${query}` : ''}`)
      },
      approvalTrendsByDesignation: (params?: { years?: number }) => {
        const searchParams = new URLSearchParams()
        if (params?.years) searchParams.set('years', String(params.years))
        const query = searchParams.toString()
        return fetchApi<ApprovalTrendsByDesignation>(`/statistics/analytics/approval-trends-by-designation${query ? `?${query}` : ''}`)
      },
    },
  },
}
