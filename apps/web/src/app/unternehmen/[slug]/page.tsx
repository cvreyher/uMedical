import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { BlankLayout } from '@/components/layouts'
import { Nav } from '@/components/nav'
import { Footer2 } from '@/components/footer2'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import { BuildingIcon, PillIcon, ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from 'lucide-react'
import { Separator } from '@workspace/ui/components/ui/separator'
import { api } from '@/lib/api'
import { TimelineSection } from '@/components/timeline/TimelineSection'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const company = await api.companies.get(slug)
    return {
      title: company.name,
      description: `Informationen zu ${company.name}: Alle Medikamente dieses Pharmaunternehmens.`,
    }
  } catch {
    return { title: 'Unternehmen nicht gefunden' }
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="flex items-start gap-4">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

async function CompanyDetail({ slug }: { slug: string }) {
  let company
  try {
    company = await api.companies.get(slug)
  } catch {
    notFound()
  }

  // Fetch timeline events for all medicines of this company
  let allTimelineEvents: Array<import('@/lib/api').TimelineEvent> = []
  
  if (company.medicines.length > 0) {
    try {
      // Fetch timeline for each medicine (limit to 50 events per medicine to avoid too many requests)
      const timelinePromises = company.medicines.slice(0, 20).map((med) =>
        api.medicines.timeline(med.slug, 50).catch(() => ({ data: [] }))
      )
      const timelines = await Promise.all(timelinePromises)
      allTimelineEvents = timelines.flatMap((t) => t.data)
      
      // Sort by date (newest first) and limit to 200 most recent events
      allTimelineEvents.sort((a, b) => {
        return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
      })
      allTimelineEvents = allTimelineEvents.slice(0, 200)
    } catch (error) {
      console.error('Error fetching timeline events:', error)
      // Continue without timeline events
    }
  }

  return (
    <>
      <Link
        href="/unternehmen"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Alle Unternehmen
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <BuildingIcon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
          <Badge variant="secondary">Zulassungsinhaber (MAH)</Badge>
        </div>
      </div>

      <div className="p-6 rounded-xl border bg-card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <PillIcon className="w-5 h-5" />
          <h2 className="font-semibold">Medikamente dieses Unternehmens</h2>
          <Badge variant="outline" className="ml-auto">
            {company.medicines.length} Medikamente
          </Badge>
        </div>

        {company.medicines.length > 0 ? (
          <div className="space-y-2">
            {company.medicines.map((med) => (
              <Link
                key={med.slug}
                href={`/medikamente/${med.slug}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:border-primary transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <PillIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {med.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={med.medicineStatus === 'Authorised' ? 'default' : 'destructive'}
                    className="text-xs gap-1"
                  >
                    {med.medicineStatus === 'Authorised' ? (
                      <CheckCircleIcon className="w-3 h-3" />
                    ) : (
                      <XCircleIcon className="w-3 h-3" />
                    )}
                    {med.medicineStatus}
                  </Badge>
                  <ArrowRightIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Keine Medikamente für dieses Unternehmen gefunden.
          </p>
        )}
      </div>

      {/* Timeline */}
      {allTimelineEvents.length > 0 && (
        <>
          <Separator className="mb-6" />
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <ClockIcon className="w-6 h-6 text-muted-foreground" />
              <h2 className="text-2xl font-bold">Timeline</h2>
            </div>
            <TimelineSection events={allTimelineEvents} />
          </div>
        </>
      )}
    </>
  )
}

export default async function UnternehmenDetailPage({ params }: PageProps) {
  const { slug } = await params

  return (
    <BlankLayout>
      <Nav />
      <main className="container py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <Suspense fallback={<DetailSkeleton />}>
            <CompanyDetail slug={slug} />
          </Suspense>
        </div>
      </main>
      <Footer2 />
    </BlankLayout>
  )
}
