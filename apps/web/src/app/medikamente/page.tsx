import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { BlankLayout } from '@/components/layouts'
import { Nav } from '@/components/nav'
import { Footer2 } from '@/components/footer2'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import { Separator } from '@workspace/ui/components/ui/separator'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@workspace/ui/components/ui/pagination'
import { PillIcon, ArrowRightIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon, RefreshCwIcon } from 'lucide-react'
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
        {message || 'Es gab ein Problem beim Laden der Medikamente. Bitte versuchen Sie es später erneut.'}
      </p>
      <Button variant="outline" asChild>
        <Link href="/medikamente">
          <RefreshCwIcon className="w-4 h-4 mr-2" />
          Erneut versuchen
        </Link>
      </Button>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Alle Medikamente',
  description: 'Durchsuchen Sie alle in der EU zugelassenen Medikamente. Finden Sie Informationen zu Wirkstoffen, Zulassungsstatus und Herstellern.',
}

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

function MedicineListSkeleton() {
  return (
    <div className="space-y-0">
      {[...Array(10)].map((_, i) => (
        <div key={i}>
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center gap-5">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div>
                <Skeleton className="h-6 w-64 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-7 w-28" />
          </div>
          {i < 9 && <Separator />}
        </div>
      ))}
    </div>
  )
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'Authorised':
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />
    case 'Withdrawn':
      return <XCircleIcon className="w-4 h-4 text-red-500" />
    default:
      return <AlertCircleIcon className="w-4 h-4 text-yellow-500" />
  }
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Authorised':
      return 'default'
    case 'Withdrawn':
      return 'destructive'
    default:
      return 'secondary'
  }
}

async function MedicineList({ page = 1 }: { page: number }) {
  let medicines, meta
  try {
    const result = await api.medicines.list({ page, limit: 20 })
    medicines = result.data
    meta = result.meta
  } catch (error) {
    console.error('Failed to load medicines:', error)
    return <ErrorState />
  }

  return (
    <>
      <div className="mb-12">
        <Badge variant="outline" className="text-sm py-1.5 px-4">
          {meta.total.toLocaleString('de-DE')} Medikamente
        </Badge>
      </div>

      <div className="space-y-0 mb-16">
        {medicines.map((med, index) => (
          <div key={med.slug}>
            <Link
              href={`/medikamente/${med.slug}`}
              className="flex items-center justify-between py-6 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <PillIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                    {med.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {med.activeSubstance || med.atcCode || med.category}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={getStatusVariant(med.medicineStatus)} className="hidden sm:inline-flex gap-1.5">
                  {getStatusIcon(med.medicineStatus)}
                  {med.medicineStatus}
                </Badge>
                {med.orphanMedicine && (
                  <Badge variant="outline" className="hidden md:inline-flex">
                    Orphan
                  </Badge>
                )}
                <ArrowRightIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Link>
            {index < medicines.length - 1 && <Separator />}
          </div>
        ))}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex flex-col items-center gap-6">
          <Pagination>
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <Link href={`/medikamente?page=${page - 1}`} legacyBehavior>
                    <PaginationPrevious />
                  </Link>
                </PaginationItem>
              )}
              
              {page > 2 && (
                <>
                  <PaginationItem>
                    <Link href="/medikamente?page=1" legacyBehavior>
                      <PaginationLink isActive={page === 1}>1</PaginationLink>
                    </Link>
                  </PaginationItem>
                  {page > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                </>
              )}

              {page > 1 && (
                <PaginationItem>
                  <Link href={`/medikamente?page=${page - 1}`} legacyBehavior>
                    <PaginationLink>{page - 1}</PaginationLink>
                  </Link>
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationLink isActive>{page}</PaginationLink>
              </PaginationItem>

              {page < meta.totalPages && (
                <PaginationItem>
                  <Link href={`/medikamente?page=${page + 1}`} legacyBehavior>
                    <PaginationLink>{page + 1}</PaginationLink>
                  </Link>
                </PaginationItem>
              )}

              {page < meta.totalPages - 1 && (
                <>
                  {page < meta.totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <Link href={`/medikamente?page=${meta.totalPages}`} legacyBehavior>
                      <PaginationLink isActive={page === meta.totalPages}>{meta.totalPages}</PaginationLink>
                    </Link>
                  </PaginationItem>
                </>
              )}

              {page < meta.totalPages && (
                <PaginationItem>
                  <Link href={`/medikamente?page=${page + 1}`} legacyBehavior>
                    <PaginationNext />
                  </Link>
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
          <p className="text-sm text-muted-foreground text-center">
            Seite {page} von {meta.totalPages} • {medicines.length} von {meta.total.toLocaleString('de-DE')} Medikamenten
          </p>
        </div>
      )}
    </>
  )
}

export default async function MedikamentePage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam || '1', 10))

  return (
    <BlankLayout>
      <Nav />
      <main className="container py-20 sm:py-32">
        <div className="max-w-5xl mx-auto px-6 sm:px-12">
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
                <PillIcon className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold">Medikamente</h1>
            </div>
            <p className="text-lg text-muted-foreground ml-16">
              Alle in der EU zentral zugelassenen Arzneimittel (EMA)
            </p>
          </div>

          <Suspense fallback={<MedicineListSkeleton />}>
            <MedicineList page={page} />
          </Suspense>
        </div>
      </main>
      <Footer2 />
    </BlankLayout>
  )
}
