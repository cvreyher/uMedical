'use client'

import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/ui/tabs'
import { Badge } from '@workspace/ui/components/ui/badge'

export interface Authority {
  id: string | null
  label: string
  region: string
  flag?: string
}

export const AUTHORITIES: Authority[] = [
  { id: null, label: 'Alle', region: 'Global', flag: '🌐' },
  { id: 'EMA', label: 'EMA', region: 'EU', flag: '🇪🇺' },
  { id: 'FDA', label: 'FDA', region: 'US', flag: '🇺🇸' },
  { id: 'MHRA', label: 'MHRA', region: 'UK', flag: '🇬🇧' },
  { id: 'BfArM', label: 'BfArM', region: 'DE', flag: '🇩🇪' },
]

interface AuthorityFilterProps {
  selected: string | null
  onChange: (authority: string | null) => void
  className?: string
  showRegionBadge?: boolean
}

export function AuthorityFilter({
  selected,
  onChange,
  className,
  showRegionBadge = false,
}: AuthorityFilterProps) {
  return (
    <Tabs
      value={selected ?? 'all'}
      onValueChange={(value) => onChange(value === 'all' ? null : value)}
      className={className}
    >
      <TabsList>
        {AUTHORITIES.map((authority) => (
          <TabsTrigger
            key={authority.id ?? 'all'}
            value={authority.id ?? 'all'}
            className="gap-1.5"
          >
            {authority.flag && <span className="text-sm">{authority.flag}</span>}
            <span>{authority.label}</span>
            {showRegionBadge && authority.id && (
              <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                {authority.region}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

interface AuthoritySummaryProps {
  data: Record<string, number>
  className?: string
}

export function AuthoritySummary({ data, className }: AuthoritySummaryProps) {
  return (
    <div className={`flex flex-wrap gap-3 ${className ?? ''}`}>
      {AUTHORITIES.filter(a => a.id).map((authority) => {
        const count = data[authority.id!] ?? 0
        return (
          <div
            key={authority.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50"
          >
            <span className="text-sm">{authority.flag}</span>
            <span className="text-sm font-medium">{authority.label}</span>
            <Badge variant="secondary" className="text-xs">
              {count.toLocaleString('de-DE')}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}
