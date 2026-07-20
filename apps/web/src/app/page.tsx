import { Suspense } from 'react'
import Link from 'next/link'
import { BlankLayout } from '@/components/layouts'
import { Nav } from '@/components/nav'
import { Faq1 } from '@/components/faq1'
import { Footer2 } from '@/components/footer2'
import { Compliance1 } from '@/components/compliance1'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import { Input } from '@workspace/ui/components/ui/input'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import { Separator } from '@workspace/ui/components/ui/separator'
import { Github as GithubIcon } from '@workspace/icons'
import {
  SearchIcon,
  PillIcon,
  FlaskConicalIcon,
  BuildingIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  TrendingUpIcon,
  ActivityIcon,
  BarChart3Icon,
  PieChartIcon,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  StatusBarChart,
  CategoryPieChart,
  EventTrendChart,
  ChartSkeleton,
  AreaLineChart,
  HorizontalBarChart,
  TreemapChart,
} from '@/components/charts'

const features = [
  {
    icon: <PillIcon className="w-6 h-6" />,
    title: 'Medikamente',
    description: 'Alle EU-zugelassenen Arzneimittel',
    href: '/medikamente',
  },
  {
    icon: <FlaskConicalIcon className="w-6 h-6" />,
    title: 'Wirkstoffe',
    description: 'Aktive Substanzen (INN)',
    href: '/wirkstoffe',
  },
  {
    icon: <BuildingIcon className="w-6 h-6" />,
    title: 'Unternehmen',
    description: 'Zulassungsinhaber & Hersteller',
    href: '/unternehmen',
  },
]

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
      {[1, 2, 3, 4].map((i) => (
        <div key={i}>
          <Skeleton className="h-10 w-24 mx-auto mb-2" />
          <Skeleton className="h-4 w-20 mx-auto" />
        </div>
      ))}
    </div>
  )
}

async function StatsDisplay() {
  try {
    const stats = await api.medicines.stats()
    const eventStats = await api.events.stats()

    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
        <div>
          <p className="text-4xl font-bold text-primary mb-2">{stats.total.toLocaleString('de-DE')}</p>
          <p className="text-sm text-muted-foreground">Medikamente</p>
        </div>
        <div>
          <p className="text-4xl font-bold text-primary mb-2">
            {(stats.byStatus?.['Authorised'] || 0).toLocaleString('de-DE')}
          </p>
          <p className="text-sm text-muted-foreground">Zugelassen</p>
        </div>
        <div>
          <p className="text-4xl font-bold text-primary mb-2">
            {stats.orphanMedicines.toLocaleString('de-DE')}
          </p>
          <p className="text-sm text-muted-foreground">Orphan-Arzneimittel</p>
        </div>
        <div>
          <p className="text-4xl font-bold text-primary mb-2">{eventStats.total.toLocaleString('de-DE')}</p>
          <p className="text-sm text-muted-foreground">Timeline Events</p>
        </div>
      </div>
    )
  } catch {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
        <div>
          <p className="text-4xl font-bold text-primary mb-2">2.600+</p>
          <p className="text-sm text-muted-foreground">Medikamente</p>
        </div>
        <div>
          <p className="text-4xl font-bold text-primary mb-2">1.500+</p>
          <p className="text-sm text-muted-foreground">Zugelassen</p>
        </div>
        <div>
          <p className="text-4xl font-bold text-primary mb-2">200+</p>
          <p className="text-sm text-muted-foreground">Orphan-Arzneimittel</p>
        </div>
      </div>
    )
  }
}

function RecentEventsSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i}>
          <div className="flex gap-6 py-6">
            <Skeleton className="w-24 h-4" />
            <div className="flex-1">
              <Skeleton className="h-5 w-full mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          {i < 5 && <Separator />}
        </div>
      ))}
    </div>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

async function RecentEventsDisplay() {
  try {
    const { data: events } = await api.events.recent(8)

    if (!events || events.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-12">
          Keine aktuellen Events verfügbar
        </p>
      )
    }

    return (
      <div className="space-y-0">
        {events.map((event, index) => (
          <div key={event.id}>
            <Link
              href={event.medicine?.slug ? `/medikamente/${event.medicine.slug}` : '#'}
              className="flex gap-6 py-6 hover:bg-muted/30 transition-colors group"
            >
              <div className="w-24 shrink-0 text-xs text-muted-foreground font-medium">
                {formatDate(event.eventDate)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-2 group-hover:text-primary transition-colors">
                  {event.title}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={event.eventType === 'authorised' ? 'default' : event.eventType === 'withdrawn' ? 'destructive' : 'secondary'}
                    className="text-xs gap-1.5"
                  >
                    {event.eventType === 'authorised' ? (
                      <CheckCircleIcon className="w-3 h-3" />
                    ) : event.eventType === 'withdrawn' ? (
                      <XCircleIcon className="w-3 h-3" />
                    ) : (
                      <ActivityIcon className="w-3 h-3" />
                    )}
                    {event.eventType}
                  </Badge>
                  {event.medicine && (
                    <span className="text-xs text-muted-foreground truncate">
                      {event.medicine.name}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRightIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary shrink-0 self-center transition-colors" />
            </Link>
            {index < events.length - 1 && <Separator />}
          </div>
        ))}
      </div>
    )
  } catch {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Events werden geladen...
      </p>
    )
  }
}

async function ChartsDisplay() {
  try {
    const stats = await api.medicines.stats()
    const { data: recentEvents } = await api.events.recent(100)

    // Prepare event trend data
    const eventTrendData = recentEvents.map((event) => ({
      date: event.eventDate,
      count: 1,
    }))

    return (
      <div className="grid gap-12 lg:grid-cols-3">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <BarChart3Icon className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Status Verteilung</h3>
          </div>
          <Separator />
          <StatusBarChart data={stats.byStatus || {}} total={stats.total} />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <PieChartIcon className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Kategorien</h3>
          </div>
          <Separator />
          <CategoryPieChart data={stats.byCategory || {}} />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <TrendingUpIcon className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Event Trends</h3>
          </div>
          <Separator />
          <EventTrendChart data={eventTrendData} />
        </div>
      </div>
    )
  } catch {
    return (
      <div className="grid gap-12 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-6">
            <Skeleton className="h-6 w-32" />
            <Separator />
            <ChartSkeleton />
          </div>
        ))}
      </div>
    )
  }
}

async function ApprovalsPerYearChart() {
  try {
    const data = await api.statistics.products.approvalsPerYear({ startYear: 1995 })

    const chartData = data.data.map((d) => ({
      label: String(d.year),
      value: d.count,
    }))

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUpIcon className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Zulassungen pro Jahr</h3>
        </div>
        <Separator />
        <AreaLineChart data={chartData} seriesName="Zulassungen" height="400px" />
      </div>
    )
  } catch {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <Separator />
        <ChartSkeleton height="400px" />
      </div>
    )
  }
}

async function HighlightsSection() {
  try {
    const [topMah, topSubstances, atcData] = await Promise.all([
      api.statistics.companies.topMah({ limit: 5 }),
      api.statistics.substances.mostCommon({ limit: 5 }),
      api.statistics.therapeutic.atcDistribution({ level: 1, limit: 10 }),
    ])

    const mahData = topMah.data.map((d) => ({
      name: d.name,
      value: d.productCount,
    }))

    const substanceData = topSubstances.data.map((d) => ({
      name: d.innName,
      value: d.productCount,
    }))

    const atcTreemapData = atcData.data.map((d) => ({
      name: d.description || d.atcCode,
      value: d.count,
    }))

    return (
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="p-6 rounded-xl border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <BuildingIcon className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Top Unternehmen</h3>
          </div>
          <HorizontalBarChart data={mahData} height="250px" maxItems={5} showLabels={true} />
        </div>

        <div className="p-6 rounded-xl border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConicalIcon className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Top Wirkstoffe</h3>
          </div>
          <HorizontalBarChart data={substanceData} height="250px" maxItems={5} showLabels={true} />
        </div>

        <div className="p-6 rounded-xl border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <PillIcon className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">ATC Klassifikation</h3>
          </div>
          <TreemapChart data={atcTreemapData} height="250px" />
        </div>
      </div>
    )
  } catch {
    return (
      <div className="grid gap-8 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 rounded-xl border bg-card">
            <Skeleton className="h-6 w-32 mb-4" />
            <ChartSkeleton height="250px" />
          </div>
        ))}
      </div>
    )
  }
}

export default function HomePage() {
  return (
    <BlankLayout>
      <Nav />

      {/* Hero Section */}
      <section className="py-20 sm:py-32">
        <div className="container max-w-4xl mx-auto px-6 sm:px-12">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-8">
              Open Source Medikamenten-Suchmaschine
            </Badge>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-8">
              Medikamente in Europa
              <br />
              <span className="text-primary">transparent durchsuchen</span>
            </h1>

            <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12">
              Die erste kostenlose Open-Source Suchmaschine für EU-zugelassene Arzneimittel.
              Basierend auf offiziellen EMA-Daten.
            </p>

            {/* Search Bar */}
            <div className="w-full max-w-2xl mx-auto mb-16">
              <div className="relative">
                <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Medikament, Wirkstoff oder Unternehmen suchen..."
                  className="w-full h-16 pl-14 pr-32 text-lg border focus:border-primary"
                  disabled
                />
                <Button size="lg" className="absolute right-2 top-1/2 -translate-y-1/2 h-12 px-6" disabled>
                  Suchen
                </Button>
              </div>
              <p className="text-sm text-muted-foreground text-center mt-4">
                Suche wird bald verfügbar sein. Durchstöbern Sie in der Zwischenzeit unsere Datenbank unten.
              </p>
            </div>

            {/* Feature Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-20">
              {features.map((feature) => (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="group flex flex-col items-center py-8 hover:text-primary transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground text-center">{feature.description}</p>
                </Link>
              ))}
            </div>

            {/* Stats */}
            <Suspense fallback={<StatsSkeleton />}>
              <StatsDisplay />
            </Suspense>

            {/* GitHub CTA */}
            <div className="mt-16">
              <Button variant="outline" size="lg" asChild>
                <Link href="https://github.com/cvreyher/uMedical" target="_blank">
                  <GithubIcon className="w-5 h-5 fill-current mr-2" />
                  Auf GitHub ansehen
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* News & Stats Section */}
      <section className="py-20 sm:py-32">
        <div className="container max-w-6xl mx-auto px-6 sm:px-12">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-6">
              <TrendingUpIcon className="w-3 h-3 mr-1" />
              Live aus der EMA-Datenbank
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">Aktuelle Entwicklungen</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Verfolgen Sie die neuesten Zulassungen, Statusänderungen und regulatorischen Events
              aus der Europäischen Arzneimittel-Agentur.
            </p>
          </div>

          <div className="grid gap-16 lg:grid-cols-2 mb-20">
            {/* Recent Events */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <ClockIcon className="w-6 h-6 text-muted-foreground" />
                <h3 className="text-2xl font-bold">Letzte Events</h3>
              </div>
              <Separator />
              <Suspense fallback={<RecentEventsSkeleton />}>
                <RecentEventsDisplay />
              </Suspense>
            </div>

            {/* Stats Summary */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <ActivityIcon className="w-6 h-6 text-muted-foreground" />
                <h3 className="text-2xl font-bold">Übersicht</h3>
              </div>
              <Separator />
              <Suspense fallback={<StatsSkeleton />}>
                <StatsDisplay />
              </Suspense>
            </div>
          </div>

          {/* Charts Section */}
          <div className="space-y-12">
            <div className="text-center">
              <h3 className="text-3xl sm:text-4xl font-bold mb-4">Datenvisualisierung</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Interaktive Charts zur Verteilung und Entwicklung der Medikamentendaten
              </p>
            </div>
            <Suspense fallback={
              <div className="grid gap-12 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-6">
                    <Skeleton className="h-6 w-32" />
                    <Separator />
                    <ChartSkeleton />
                  </div>
                ))}
              </div>
            }>
              <ChartsDisplay />
            </Suspense>
          </div>

          {/* Approvals Per Year */}
          <div className="mt-16">
            <Suspense fallback={
              <div className="space-y-6">
                <Skeleton className="h-6 w-48" />
                <Separator />
                <ChartSkeleton height="400px" />
              </div>
            }>
              <ApprovalsPerYearChart />
            </Suspense>
          </div>
        </div>
      </section>

      <Separator />

      {/* Highlights Section */}
      <section className="py-20 sm:py-32">
        <div className="container max-w-6xl mx-auto px-6 sm:px-12">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-6">
              <BarChart3Icon className="w-3 h-3 mr-1" />
              Marktanalyse
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">Highlights</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Die wichtigsten Akteure im europaischen Arzneimittelmarkt auf einen Blick
            </p>
          </div>

          <Suspense fallback={
            <div className="grid gap-8 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 rounded-xl border bg-card">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <ChartSkeleton height="250px" />
                </div>
              ))}
            </div>
          }>
            <HighlightsSection />
          </Suspense>

          <div className="text-center mt-12">
            <Button variant="outline" size="lg" asChild>
              <Link href="/statistiken">
                <BarChart3Icon className="w-5 h-5 mr-2" />
                Alle Statistiken anzeigen
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      <Compliance1 className="mt-0" />
      <Faq1 />
      <Footer2 />
    </BlankLayout>
  )
}
