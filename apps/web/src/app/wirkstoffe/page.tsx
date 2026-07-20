import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { BlankLayout } from '@/components/layouts'
import { Nav } from '@/components/nav'
import { Footer2 } from '@/components/footer2'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import { FlaskConicalIcon, ArrowRightIcon, AlertCircleIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@workspace/ui/components/ui/button'
import { api } from '@/lib/api'

function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <AlertCircleIcon className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Daten konnten nicht geladen werden</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        {message || 'Es gab ein Problem beim Laden der Wirkstoffe. Bitte versuchen Sie es später erneut.'}
      </p>
      <Button variant="outline" asChild>
        <Link href="/wirkstoffe">
          <RefreshCwIcon className="w-4 h-4 mr-2" />
          Erneut versuchen
        </Link>
      </Button>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Alle Wirkstoffe',
  description: 'Durchsuchen Sie alle Wirkstoffe (INN) in EU-zugelassenen Medikamenten. Finden Sie Informationen zu aktiven Substanzen und zugehörigen Arzneimitteln.',
}

function SubstanceListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  )
}

async function SubstanceList() {
  let substances, meta
  try {
    const result = await api.substances.list({ limit: 50 })
    substances = result.data
    meta = result.meta
  } catch (error) {
    console.error('Failed to load substances:', error)
    return <ErrorState />
  }

  return (
    <>
      <div className="flex gap-4 mb-8">
        <Badge variant="secondary" className="text-sm py-1 px-3">
          {meta.total.toLocaleString('de-DE')} Wirkstoffe
        </Badge>
      </div>

      <div className="space-y-2">
        {substances.map((substance) => (
          <Link
            key={substance.slug}
            href={`/wirkstoffe/${substance.slug}`}
            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:border-primary hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <FlaskConicalIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold group-hover:text-primary transition-colors">
                  {substance.innName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  INN (Internationaler Freiname)
                </p>
              </div>
            </div>
            <ArrowRightIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>

      {meta.totalPages > 1 && (
        <p className="text-sm text-muted-foreground mt-8 text-center">
          Zeige {substances.length} von {meta.total.toLocaleString('de-DE')} Wirkstoffen
        </p>
      )}
    </>
  )
}

export default function WirkstoffePage() {
  return (
    <BlankLayout>
      <Nav />
      <main className="container py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FlaskConicalIcon className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold">Wirkstoffe</h1>
          </div>
          <p className="text-muted-foreground mb-8">
            Alle aktiven Substanzen (INN) in EU-zugelassenen Medikamenten
          </p>

          <Suspense fallback={<SubstanceListSkeleton />}>
            <SubstanceList />
          </Suspense>
        </div>
      </main>
      <Footer2 />
    </BlankLayout>
  )
}
