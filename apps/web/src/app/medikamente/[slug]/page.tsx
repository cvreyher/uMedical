import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { BlankLayout } from '@/components/layouts'
import { Nav } from '@/components/nav'
import { Footer2 } from '@/components/footer2'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import { Separator } from '@workspace/ui/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@workspace/ui/components/ui/table'
import {
  PillIcon,
  FlaskConicalIcon,
  BuildingIcon,
  CalendarIcon,
  ExternalLinkIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ShieldIcon,
  HeartIcon,
} from 'lucide-react'
import { api } from '@/lib/api'
import { TimelineSection } from '@/components/timeline/TimelineSection'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const medicine = await api.medicines.get(slug)
    return {
      title: medicine.name,
      description: `Informationen zu ${medicine.name}: Wirkstoffe, Zulassungsstatus, Anwendungsgebiete und Hersteller.`,
    }
  } catch {
    return { title: 'Medikament nicht gefunden' }
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-12">
      <Skeleton className="h-10 w-32" />
      <div className="flex items-start gap-6">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div>
          <Skeleton className="h-10 w-80 mb-3" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function MedicineDetail({ slug }: { slug: string }) {
  let medicine
  try {
    medicine = await api.medicines.get(slug)
  } catch {
    notFound()
  }

  // Get timeline events (limit to 100 recent events)
  let timelineEvents = medicine.timeline || []
  if (timelineEvents.length > 100) {
    timelineEvents = timelineEvents.slice(0, 100)
  }

  const StatusIcon = medicine.medicineStatus === 'Authorised' ? CheckCircleIcon : XCircleIcon

  return (
    <>
      <Link
        href="/medikamente"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-12 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Alle Medikamente
      </Link>

      <div className="flex items-start gap-6 mb-12">
        <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
          <PillIcon className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">{medicine.name}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant={medicine.medicineStatus === 'Authorised' ? 'default' : 'destructive'} className="gap-1.5">
              <StatusIcon className="w-3 h-3" />
              {medicine.medicineStatus}
            </Badge>
            <Badge variant="outline">{medicine.category}</Badge>
            {medicine.orphanMedicine && <Badge variant="secondary">Orphan-Arzneimittel</Badge>}
            {medicine.biosimilar && <Badge variant="secondary">Biosimilar</Badge>}
            {medicine.genericOrHybrid && <Badge variant="secondary">Generikum</Badge>}
          </div>
        </div>
      </div>

      <Separator className="mb-12" />

      {/* Details Table */}
      <div className="space-y-6 mb-12">
        <h2 className="text-2xl font-bold">Details</h2>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="w-48 font-medium text-muted-foreground">EMA-Nummer</TableCell>
              <TableCell>{medicine.emaNumber || '-'}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">ATC-Code</TableCell>
              <TableCell>{medicine.atcCode || '-'}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Zulassung
                </span>
              </TableCell>
              <TableCell>{formatDate(medicine.marketingAuthorisationDate)}</TableCell>
            </TableRow>
            {medicine.medicineStatus === 'Withdrawn' && medicine.withdrawalExpiryRevocationLapseDate && (
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <XCircleIcon className="w-4 h-4" />
                    Zurückgezogen
                  </span>
                </TableCell>
                <TableCell>{formatDate(medicine.withdrawalExpiryRevocationLapseDate)}</TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">Revision</TableCell>
              <TableCell>{medicine.revisionNumber || '-'}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {medicine.medicineUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={medicine.medicineUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              EMA-Seite
            </a>
          </Button>
        )}
      </div>

      <Separator className="mb-12" />

      {/* Therapeutic Indication */}
      <div className="space-y-6 mb-12">
        <h2 className="text-2xl font-bold">Anwendungsgebiet</h2>
        <p className="text-muted-foreground leading-relaxed">
          {medicine.therapeuticIndication || 'Keine Angabe'}
        </p>
        {medicine.therapeuticAreaMesh && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">MeSH:</span> {medicine.therapeuticAreaMesh}
          </div>
        )}
        {medicine.pharmacotherapeuticGroup && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Gruppe:</span> {medicine.pharmacotherapeuticGroup}
          </div>
        )}
      </div>

      {/* Flags */}
      {(medicine.additionalMonitoring || medicine.conditionalApproval || medicine.acceleratedAssessment || medicine.patientSafety) && (
        <>
          <Separator className="mb-12" />
          <div className="space-y-6 mb-12">
            <h2 className="text-2xl font-bold">Besondere Merkmale</h2>
            <div className="flex flex-wrap gap-2">
              {medicine.additionalMonitoring && (
                <Badge variant="outline" className="gap-1.5">
                  <ShieldIcon className="w-3 h-3" /> Zusätzliche Überwachung
                </Badge>
              )}
              {medicine.conditionalApproval && (
                <Badge variant="outline" className="gap-1.5">
                  <ClockIcon className="w-3 h-3" /> Bedingte Zulassung
                </Badge>
              )}
              {medicine.acceleratedAssessment && (
                <Badge variant="outline" className="gap-1.5">
                  <ClockIcon className="w-3 h-3" /> Beschleunigte Bewertung
                </Badge>
              )}
              {medicine.patientSafety && (
                <Badge variant="outline" className="gap-1.5">
                  <HeartIcon className="w-3 h-3" /> Patientensicherheit
                </Badge>
              )}
            </div>
          </div>
        </>
      )}

      {/* Substances */}
      {medicine.substances.length > 0 && (
        <>
          <Separator className="mb-12" />
          <div className="space-y-6 mb-12">
            <div className="flex items-center gap-3">
              <FlaskConicalIcon className="w-6 h-6 text-muted-foreground" />
              <h2 className="text-2xl font-bold">Wirkstoffe</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {medicine.substances.map((substance) => (
                <Link key={substance.slug} href={`/wirkstoffe/${substance.slug}`}>
                  <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer">
                    {substance.innName}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Companies */}
      {medicine.companies.length > 0 && (
        <>
          <Separator className="mb-12" />
          <div className="space-y-6 mb-12">
            <div className="flex items-center gap-3">
              <BuildingIcon className="w-6 h-6 text-muted-foreground" />
              <h2 className="text-2xl font-bold">Zulassungsinhaber</h2>
            </div>
            <div className="space-y-0">
              {medicine.companies.map((company, index) => (
                <div key={company.slug}>
                  <Link
                    href={`/unternehmen/${company.slug}`}
                    className="flex items-center justify-between py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <BuildingIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{company.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {company.role === 'mah' ? 'MAH' : company.role}
                    </Badge>
                  </Link>
                  {index < medicine.companies.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Timeline */}
      {timelineEvents.length > 0 && (
        <>
          <Separator className="mb-12" />
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <ClockIcon className="w-6 h-6 text-muted-foreground" />
              <h2 className="text-2xl font-bold">Timeline</h2>
            </div>
            <TimelineSection events={timelineEvents} />
          </div>
        </>
      )}
    </>
  )
}

export default async function MedikamentDetailPage({ params }: PageProps) {
  const { slug } = await params

  return (
    <BlankLayout>
      <Nav />
      <main className="container py-20 sm:py-32">
        <div className="max-w-5xl mx-auto px-6 sm:px-12">
          <Suspense fallback={<DetailSkeleton />}>
            <MedicineDetail slug={slug} />
          </Suspense>
        </div>
      </main>
      <Footer2 />
    </BlankLayout>
  )
}
