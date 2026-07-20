import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { BlankLayout } from '@/components/layouts'
import { Nav } from '@/components/nav'
import { Footer2 } from '@/components/footer2'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import { FlaskConicalIcon, PillIcon, ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react'
import { api } from '@/lib/api'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const substance = await api.substances.get(slug)
    return {
      title: substance.innName,
      description: `Informationen zum Wirkstoff ${substance.innName}: Alle Medikamente mit diesem Wirkstoff.`,
    }
  } catch {
    return { title: 'Wirkstoff nicht gefunden' }
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

async function SubstanceDetail({ slug }: { slug: string }) {
  let substance
  try {
    substance = await api.substances.get(slug)
  } catch {
    notFound()
  }

  return (
    <>
      <Link
        href="/wirkstoffe"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Alle Wirkstoffe
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <FlaskConicalIcon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-2">{substance.innName}</h1>
          <Badge variant="secondary">INN (Internationaler Freiname)</Badge>
        </div>
      </div>

      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <PillIcon className="w-5 h-5" />
          <h2 className="font-semibold">Medikamente mit diesem Wirkstoff</h2>
          <Badge variant="outline" className="ml-auto">
            {substance.medicines.length} Medikamente
          </Badge>
        </div>

        {substance.medicines.length > 0 ? (
          <div className="space-y-2">
            {substance.medicines.map((med) => (
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
            Keine Medikamente mit diesem Wirkstoff gefunden.
          </p>
        )}
      </div>
    </>
  )
}

export default async function WirkstoffDetailPage({ params }: PageProps) {
  const { slug } = await params

  return (
    <BlankLayout>
      <Nav />
      <main className="container py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <Suspense fallback={<DetailSkeleton />}>
            <SubstanceDetail slug={slug} />
          </Suspense>
        </div>
      </main>
      <Footer2 />
    </BlankLayout>
  )
}
