import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BlankLayout } from '@/components/layouts'
import { Nav } from '@/components/nav'
import { Footer2 } from '@/components/footer2'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import { Separator } from '@workspace/ui/components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/ui/tabs'
import {
  BarChart3Icon,
  PillIcon,
  BuildingIcon,
  FlaskConicalIcon,
  ShieldIcon,
  GavelIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  AreaLineChart,
  HorizontalBarChart,
  DonutChart,
  TreemapChart,
  StackedBarChart,
  GaugeChart,
  ChartSkeleton,
} from '@/components/charts'

// Render per request so the data always comes live from the API (our database)
// instead of being frozen into static HTML at build time.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Statistiken',
  description: 'Umfassende Statistiken und Analysen zu EU-zugelassenen Arzneimitteln.',
}

function StatCardSkeleton() {
  return (
    <div className="p-6 rounded-xl border bg-card">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-32" />
    </div>
  )
}

function ChartCardSkeleton({ height = '400px' }: { height?: string }) {
  return (
    <div className="p-6 rounded-xl border bg-card">
      <Skeleton className="h-6 w-48 mb-4" />
      <ChartSkeleton height={height} />
    </div>
  )
}

// ============ Overview Tab ============

async function OverviewStats() {
  try {
    const overview = await api.statistics.products.overview()

    const stats = [
      { label: 'Gesamt', value: overview.total, icon: PillIcon },
      { label: 'Zugelassen', value: overview.byStatus['Authorised'] || 0, icon: CheckCircleIcon, color: 'text-green-500' },
      { label: 'Zuruckgezogen', value: overview.byStatus['Withdrawn'] || 0, icon: XCircleIcon, color: 'text-red-500' },
      { label: 'Orphan-Arzneimittel', value: overview.designations.orphanMedicine, icon: AlertTriangleIcon, color: 'text-yellow-500' },
    ]

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="p-6 rounded-xl border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color || 'text-muted-foreground'}`} />
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
            <p className="text-3xl font-bold">{stat.value.toLocaleString('de-DE')}</p>
          </div>
        ))}
      </div>
    )
  } catch {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
      </div>
    )
  }
}

async function ApprovalsOverYearsChart() {
  try {
    const data = await api.statistics.products.approvalsPerYear({ startYear: 1995 })

    const chartData = data.data.map((d) => ({
      label: String(d.year),
      value: d.count,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Zulassungen pro Jahr (seit 1995)</h3>
        <AreaLineChart data={chartData} seriesName="Zulassungen" height="350px" />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="350px" />
  }
}

async function WithdrawalRateGauge() {
  try {
    const data = await api.statistics.products.withdrawalRate()

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Ruckzugsrate</h3>
        <GaugeChart
          value={parseFloat(data.withdrawalRate)}
          max={50}
          unit="%"
          title="der Medikamente zuruckgezogen"
          height="250px"
          thresholds={[
            { value: 30, color: '#ef4444' },
            { value: 20, color: '#eab308' },
            { value: 0, color: '#22c55e' },
          ]}
        />
        <div className="flex justify-center gap-8 mt-4 text-sm text-muted-foreground">
          <span>Zugelassen: {data.authorized.toLocaleString('de-DE')}</span>
          <span>Zuruckgezogen: {data.withdrawn.toLocaleString('de-DE')}</span>
        </div>
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="250px" />
  }
}

async function DesignationsChart() {
  try {
    const data = await api.statistics.products.designations()

    const chartData = [
      { name: 'Orphan', value: data.orphanMedicine },
      { name: 'Biosimilar', value: data.biosimilar },
      { name: 'Generika/Hybrid', value: data.genericOrHybrid },
      { name: 'ATMP', value: data.advancedTherapy },
      { name: 'Beschleunigte Bewertung', value: data.acceleratedAssessment },
      { name: 'Bedingte Zulassung', value: data.conditionalApproval },
      { name: 'PRIME', value: data.primePriorityMedicine },
    ].filter((d) => d.value > 0)

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Spezielle Bezeichnungen</h3>
        <HorizontalBarChart data={chartData} height="350px" maxItems={8} />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="350px" />
  }
}

function OverviewTab() {
  return (
    <div className="space-y-8">
      <Suspense fallback={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      }>
        <OverviewStats />
      </Suspense>

      <div className="grid lg:grid-cols-2 gap-8">
        <Suspense fallback={<ChartCardSkeleton height="350px" />}>
          <ApprovalsOverYearsChart />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton height="350px" />}>
          <WithdrawalRateGauge />
        </Suspense>
      </div>

      <Suspense fallback={<ChartCardSkeleton height="350px" />}>
        <DesignationsChart />
      </Suspense>
    </div>
  )
}

// ============ Products Tab ============

async function MonthlyApprovalsChart() {
  try {
    const data = await api.statistics.products.approvalsPerMonth({ months: 36 })

    const chartData = data.data.map((d) => ({
      label: d.yearMonth,
      value: d.count,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Monatliche Zulassungen (letzte 3 Jahre)</h3>
        <AreaLineChart data={chartData} seriesName="Zulassungen" height="350px" />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="350px" />
  }
}

async function ProductLifecycleChart() {
  try {
    const data = await api.statistics.products.lifecycle()

    const ageGroups = data.byAgeGroup || []
    const chartData = {
      categories: ageGroups.map((g) => g.ageGroup),
      series: [
        {
          name: 'Produkte',
          data: ageGroups.map((g) => g.count),
        },
      ],
    }

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Produktlebenszyklus</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Durchschnittsalter: {data.averageAgeYears} Jahre
        </p>
        <StackedBarChart data={chartData} height="300px" />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="300px" />
  }
}

async function OpinionToAuthGauge() {
  try {
    const data = await api.statistics.products.opinionToAuthorization()

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Zeit bis zur Zulassung</h3>
        <GaugeChart
          value={data.averageDays}
          max={200}
          unit=" Tage"
          title="Gutachten bis Zulassung (Durchschnitt)"
          height="250px"
        />
        <div className="flex justify-center gap-8 mt-4 text-sm text-muted-foreground">
          <span>Min: {data.minDays} Tage</span>
          <span>Max: {data.maxDays} Tage</span>
        </div>
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="250px" />
  }
}

async function CategoryDistributionChart() {
  try {
    const data = await api.statistics.products.byCategory()

    const chartData = Object.entries(data.totals).map(([name, value]) => ({
      name,
      value,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Kategorieverteilung</h3>
        <DonutChart
          data={chartData}
          centerValue={chartData.reduce((sum, d) => sum + d.value, 0)}
          centerLabel="Gesamt"
          height="350px"
        />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="350px" />
  }
}

function ProductsTab() {
  return (
    <div className="space-y-8">
      <Suspense fallback={<ChartCardSkeleton height="350px" />}>
        <MonthlyApprovalsChart />
      </Suspense>

      <div className="grid lg:grid-cols-2 gap-8">
        <Suspense fallback={<ChartCardSkeleton height="300px" />}>
          <ProductLifecycleChart />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton height="300px" />}>
          <OpinionToAuthGauge />
        </Suspense>
      </div>

      <Suspense fallback={<ChartCardSkeleton height="350px" />}>
        <CategoryDistributionChart />
      </Suspense>
    </div>
  )
}

// ============ Companies Tab ============

async function TopMahChart() {
  try {
    const data = await api.statistics.companies.topMah({ limit: 20 })

    const chartData = data.data.map((d) => ({
      name: d.name,
      value: d.productCount,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Top 20 Zulassungsinhaber (MAH)</h3>
        <HorizontalBarChart data={chartData} height="500px" maxItems={20} />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="500px" />
  }
}

async function MarketConcentrationChart() {
  try {
    const data = await api.statistics.companies.marketConcentration()

    const chartData = data.top20Companies.map((c) => ({
      name: c.name,
      value: c.productCount,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Marktkonzentration</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold">{data.top5Share}%</p>
            <p className="text-sm text-muted-foreground">Top 5</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{data.top10Share}%</p>
            <p className="text-sm text-muted-foreground">Top 10</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{data.herfindahlIndex}</p>
            <p className="text-sm text-muted-foreground">HHI Index</p>
          </div>
        </div>
        <TreemapChart data={chartData} height="350px" />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="450px" />
  }
}

async function CompaniesByCountryChart() {
  try {
    const data = await api.statistics.companies.byCountry()

    const chartData = data.data
      .filter((d) => d.country)
      .map((d) => ({
        name: d.country!,
        value: d.companyCount,
      }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Unternehmen nach Land</h3>
        <HorizontalBarChart data={chartData} height="400px" maxItems={15} />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="400px" />
  }
}

async function MostActiveCompaniesChart() {
  try {
    const data = await api.statistics.companies.mostActive({ months: 12, limit: 10 })

    const chartData = data.data.map((d) => ({
      name: d.name,
      value: d.newApprovals,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Aktivste Unternehmen (letzte 12 Monate)</h3>
        <HorizontalBarChart data={chartData} height="350px" maxItems={10} />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="350px" />
  }
}

function CompaniesTab() {
  return (
    <div className="space-y-8">
      <Suspense fallback={<ChartCardSkeleton height="500px" />}>
        <TopMahChart />
      </Suspense>

      <Suspense fallback={<ChartCardSkeleton height="450px" />}>
        <MarketConcentrationChart />
      </Suspense>

      <div className="grid lg:grid-cols-2 gap-8">
        <Suspense fallback={<ChartCardSkeleton height="400px" />}>
          <CompaniesByCountryChart />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton height="350px" />}>
          <MostActiveCompaniesChart />
        </Suspense>
      </div>
    </div>
  )
}

// ============ Substances Tab ============

async function TopSubstancesChart() {
  try {
    const data = await api.statistics.substances.mostCommon({ limit: 20 })

    const chartData = data.data.map((d) => ({
      name: d.innName,
      value: d.productCount,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Top 20 Wirkstoffe</h3>
        <HorizontalBarChart data={chartData} height="500px" maxItems={20} />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="500px" />
  }
}

async function SubstancesPerProductChart() {
  try {
    const data = await api.statistics.substances.substancesPerProduct()

    const chartData = Object.entries(data.distribution).map(([name, value]) => ({
      name,
      value,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Wirkstoffe pro Produkt</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Durchschnitt: {data.averageSubstancesPerProduct} Wirkstoffe
        </p>
        <DonutChart
          data={chartData}
          centerValue={data.totalProductsWithSubstances}
          centerLabel="Produkte"
          height="350px"
        />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="350px" />
  }
}

async function AtcDistributionChart() {
  try {
    const data = await api.statistics.therapeutic.atcDistribution({ level: 1, limit: 14 })

    const chartData = data.data.map((d) => ({
      name: d.description || d.atcCode,
      value: d.count,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">ATC-Verteilung (Hauptgruppen)</h3>
        <TreemapChart data={chartData} height="400px" />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="400px" />
  }
}

async function TherapeuticAreasMeshChart() {
  try {
    const data = await api.statistics.therapeutic.therapeuticAreasMesh({ limit: 15 })

    const chartData = data.data.map((d) => ({
      name: d.meshTerm,
      value: d.count,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Therapeutische Gebiete (MeSH)</h3>
        <HorizontalBarChart data={chartData} height="400px" maxItems={15} />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="400px" />
  }
}

function SubstancesTab() {
  return (
    <div className="space-y-8">
      <Suspense fallback={<ChartCardSkeleton height="500px" />}>
        <TopSubstancesChart />
      </Suspense>

      <div className="grid lg:grid-cols-2 gap-8">
        <Suspense fallback={<ChartCardSkeleton height="350px" />}>
          <SubstancesPerProductChart />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton height="400px" />}>
          <TherapeuticAreasMeshChart />
        </Suspense>
      </div>

      <Suspense fallback={<ChartCardSkeleton height="400px" />}>
        <AtcDistributionChart />
      </Suspense>
    </div>
  )
}

// ============ Regulatory Tab ============

async function ProcedureTypesChart() {
  try {
    const data = await api.statistics.regulatory.proceduresByType()

    const chartData = data.data.map((d) => ({
      name: d.type || 'Unbekannt',
      value: d.count,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Verfahrenstypen</h3>
        <DonutChart
          data={chartData}
          centerValue={chartData.reduce((sum, d) => sum + d.value, 0)}
          centerLabel="Verfahren"
          height="350px"
        />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="350px" />
  }
}

async function EventFrequencyChart() {
  try {
    const data = await api.statistics.regulatory.eventFrequency({ months: 24 })

    const chartData = data.data.map((d) => ({
      label: d.yearMonth,
      value: d.count,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Events pro Monat (letzte 2 Jahre)</h3>
        <AreaLineChart data={chartData} seriesName="Events" height="350px" />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="350px" />
  }
}

async function EventsByCategoryChart() {
  try {
    const data = await api.statistics.regulatory.eventsByCategory()

    const chartData = data.data.map((d) => ({
      name: d.category,
      value: d.count,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Events nach Kategorie</h3>
        <HorizontalBarChart data={chartData} height="300px" maxItems={10} />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="300px" />
  }
}

async function MostEventfulProductsChart() {
  try {
    const data = await api.statistics.regulatory.mostEventfulProducts({ limit: 15 })

    const chartData = data.data.map((d) => ({
      name: d.name,
      value: d.eventCount,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Produkte mit meisten Events</h3>
        <HorizontalBarChart data={chartData} height="400px" maxItems={15} />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="400px" />
  }
}

function RegulatoryTab() {
  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-2 gap-8">
        <Suspense fallback={<ChartCardSkeleton height="350px" />}>
          <ProcedureTypesChart />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton height="300px" />}>
          <EventsByCategoryChart />
        </Suspense>
      </div>

      <Suspense fallback={<ChartCardSkeleton height="350px" />}>
        <EventFrequencyChart />
      </Suspense>

      <Suspense fallback={<ChartCardSkeleton height="400px" />}>
        <MostEventfulProductsChart />
      </Suspense>
    </div>
  )
}

// ============ Safety Tab ============

async function ShortagesOverviewStats() {
  try {
    const data = await api.statistics.safety.shortagesOverview()

    const stats = [
      { label: 'Gesamt Engpasse', value: data.total },
      { label: 'Aktive Engpasse', value: data.activeShortages, color: 'text-red-500' },
    ]

    // Authority breakdown
    const authorityStats = data.byAuthority?.slice(0, 4) || []

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="p-6 rounded-xl border bg-card">
              <p className="text-sm text-muted-foreground mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color || ''}`}>
                {stat.value.toLocaleString('de-DE')}
              </p>
            </div>
          ))}
        </div>
        {authorityStats.length > 0 && (
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-sm text-muted-foreground mb-3">Nach Behorde</p>
            <div className="flex flex-wrap gap-3">
              {authorityStats.map((a) => (
                <Badge key={a.authority} variant="outline" className="text-sm">
                  {a.authority}: {a.count.toLocaleString('de-DE')}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  } catch {
    return (
      <div className="grid grid-cols-2 gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    )
  }
}

async function ShortagesOverTimeChart() {
  try {
    const data = await api.statistics.safety.shortagesOverTime({ months: 24 })

    // Aggregate by yearMonth across all authorities
    const aggregated = data.data.reduce((acc, d) => {
      const existing = acc.find((x) => x.label === d.yearMonth)
      if (existing) {
        existing.value += d.count
      } else {
        acc.push({ label: d.yearMonth, value: d.count })
      }
      return acc
    }, [] as Array<{ label: string; value: number }>)

    // Sort by date
    aggregated.sort((a, b) => a.label.localeCompare(b.label))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Engpasse pro Monat (alle Quellen)</h3>
        <AreaLineChart data={aggregated} seriesName="Engpasse" height="350px" />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="350px" />
  }
}

async function ShortagesDurationGauge() {
  try {
    const data = await api.statistics.safety.shortagesDuration()

    // Handle both old and new response formats
    const avgDays = data.overall?.averageDaysToResolution ?? (data as unknown as { averageDaysToResolution: number }).averageDaysToResolution ?? 0

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Durchschnittliche Engpassdauer</h3>
        <GaugeChart
          value={avgDays}
          max={365}
          unit=" Tage"
          title="bis zur Losung"
          height="250px"
          thresholds={[
            { value: 180, color: '#ef4444' },
            { value: 90, color: '#eab308' },
            { value: 0, color: '#22c55e' },
          ]}
        />
        {data.byAuthority && data.byAuthority.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Nach Behorde:</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {data.byAuthority.map((a) => (
                <span key={a.authority} className="bg-muted px-2 py-1 rounded">
                  {a.authority}: {a.averageDays} Tage
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="250px" />
  }
}

async function MostAffectedProductsChart() {
  try {
    const data = await api.statistics.safety.mostAffectedProducts({ limit: 15 })

    const chartData = data.data.map((d) => ({
      name: d.name,
      value: d.shortageCount,
    }))

    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">Am haufigsten betroffene Produkte</h3>
        <HorizontalBarChart data={chartData} height="400px" maxItems={15} />
      </div>
    )
  } catch {
    return <ChartCardSkeleton height="400px" />
  }
}

async function AdditionalMonitoringStats() {
  try {
    const data = await api.statistics.safety.additionalMonitoring()

    return (
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Zusatzliche Uberwachung</h3>
        </div>
        <p className="text-3xl font-bold mb-2">{data.total.toLocaleString('de-DE')}</p>
        <p className="text-sm text-muted-foreground">
          Produkte unter erhohter Uberwachung
        </p>
      </div>
    )
  } catch {
    return <StatCardSkeleton />
  }
}

function SafetyTab() {
  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={
            <div className="grid grid-cols-2 gap-6">
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          }>
            <ShortagesOverviewStats />
          </Suspense>
        </div>
        <Suspense fallback={<StatCardSkeleton />}>
          <AdditionalMonitoringStats />
        </Suspense>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Suspense fallback={<ChartCardSkeleton height="350px" />}>
          <ShortagesOverTimeChart />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton height="250px" />}>
          <ShortagesDurationGauge />
        </Suspense>
      </div>

      <Suspense fallback={<ChartCardSkeleton height="400px" />}>
        <MostAffectedProductsChart />
      </Suspense>
    </div>
  )
}

// ============ Main Page ============

export default function StatistikenPage() {
  return (
    <BlankLayout>
      <Nav />
      <main className="container py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
                <BarChart3Icon className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold">Statistiken</h1>
            </div>
            <p className="text-lg text-muted-foreground ml-16">
              Umfassende Analysen und Visualisierungen zu EU-zugelassenen Arzneimitteln
            </p>
          </div>

          <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 gap-2 h-auto p-2">
              <TabsTrigger value="overview" className="flex items-center gap-2 py-3">
                <TrendingUpIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Ubersicht</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2 py-3">
                <PillIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Produkte</span>
              </TabsTrigger>
              <TabsTrigger value="companies" className="flex items-center gap-2 py-3">
                <BuildingIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Unternehmen</span>
              </TabsTrigger>
              <TabsTrigger value="substances" className="flex items-center gap-2 py-3">
                <FlaskConicalIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Wirkstoffe</span>
              </TabsTrigger>
              <TabsTrigger value="regulatory" className="flex items-center gap-2 py-3">
                <GavelIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Regulatorik</span>
              </TabsTrigger>
              <TabsTrigger value="safety" className="flex items-center gap-2 py-3">
                <ShieldIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Sicherheit</span>
              </TabsTrigger>
            </TabsList>

            <Separator />

            <TabsContent value="overview">
              <OverviewTab />
            </TabsContent>

            <TabsContent value="products">
              <ProductsTab />
            </TabsContent>

            <TabsContent value="companies">
              <CompaniesTab />
            </TabsContent>

            <TabsContent value="substances">
              <SubstancesTab />
            </TabsContent>

            <TabsContent value="regulatory">
              <RegulatoryTab />
            </TabsContent>

            <TabsContent value="safety">
              <SafetyTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer2 />
    </BlankLayout>
  )
}
