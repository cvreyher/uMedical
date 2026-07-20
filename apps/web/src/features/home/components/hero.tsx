import { Github as GithubIcon } from '@workspace/icons'
import { Button } from '@workspace/ui/components/ui/button'
import { Input } from '@workspace/ui/components/ui/input'
import { Badge } from '@workspace/ui/components/ui/badge'
import { SearchIcon, PillIcon, FlaskConicalIcon, BuildingIcon } from 'lucide-react'
import Link from 'next/link'

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

const Hero = () => {
  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="flex flex-1 w-full max-w-4xl flex-col items-center py-16 px-4 sm:py-24 sm:px-8">
        {/* Badge */}
        <Badge variant="secondary" className="mb-6">
          Open Source Medikamenten-Suchmaschine
        </Badge>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl font-bold text-center leading-tight mb-4">
          Medikamente in Europa
          <br />
          <span className="text-primary">transparent durchsuchen</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-muted-foreground text-center max-w-2xl mb-8">
          Die erste kostenlose Open-Source Suchmaschine für EU-zugelassene Arzneimittel.
          Basierend auf offiziellen EMA-Daten.
        </p>

        {/* Search Bar */}
        <div className="w-full max-w-2xl mb-12">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Medikament, Wirkstoff oder Unternehmen suchen..."
              className="w-full h-14 pl-12 pr-4 text-lg rounded-xl border-2 focus:border-primary"
              disabled
            />
            <Button
              size="lg"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              disabled
            >
              Suchen
            </Button>
          </div>
          <p className="text-sm text-muted-foreground text-center mt-3">
            Suche wird bald verfügbar sein. Durchstöbern Sie in der Zwischenzeit unsere Datenbank unten.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-12">
          {features.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group flex flex-col items-center p-6 rounded-xl border bg-card hover:border-primary hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground text-center">
                {feature.description}
              </p>
            </Link>
          ))}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 mb-12 text-center">
          <div>
            <p className="text-3xl font-bold text-primary">1.600+</p>
            <p className="text-sm text-muted-foreground">Medikamente</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary">1.000+</p>
            <p className="text-sm text-muted-foreground">Wirkstoffe</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary">500+</p>
            <p className="text-sm text-muted-foreground">Unternehmen</p>
          </div>
        </div>

        {/* GitHub CTA */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Button variant="outline" size="lg" asChild>
            <Link href="https://github.com/cvreyher/uMedical" target="_blank">
              <GithubIcon className="w-5 h-5 fill-current mr-2" />
              Auf GitHub ansehen
            </Link>
          </Button>
        </div>
      </main>
    </div>
  )
}

export { Hero }
