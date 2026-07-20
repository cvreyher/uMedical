'use client'

import { useMemo } from 'react'
import type { TimelineEvent } from '@/lib/api'
import { getUniqueAgencies, getAgencyColor, getAgencyFromEvent } from '@/lib/timeline-utils'
import { Button } from '@workspace/ui/components/ui/button'
import { Badge } from '@workspace/ui/components/ui/badge'

interface AgencyFilterProps {
  events: TimelineEvent[]
  selectedAgencies: string[]
  onAgencyToggle: (agency: string) => void
  className?: string
}

export function AgencyFilter({
  events,
  selectedAgencies,
  onAgencyToggle,
  className = '',
}: AgencyFilterProps) {
  const availableAgencies = useMemo(() => getUniqueAgencies(events), [events])

  if (availableAgencies.length === 0) {
    return null
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <span className="text-sm font-medium text-muted-foreground shrink-0">Filter nach Behörde:</span>
      {availableAgencies.map((agency) => {
        const isSelected = selectedAgencies.includes(agency)
        const color = getAgencyColor(agency)

        return (
          <Button
            key={agency}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            onClick={() => onAgencyToggle(agency)}
            className="gap-2"
            style={
              isSelected
                ? {
                    backgroundColor: color,
                    borderColor: color,
                    color: 'white',
                  }
                : {
                    borderColor: color,
                    color: color,
                  }
            }
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: isSelected ? 'white' : color }}
            />
            {agency}
            {isSelected && (
              <Badge
                variant="secondary"
                className="ml-1 bg-white/20 text-white text-xs"
              >
                {events.filter((e) => getAgencyFromEvent(e) === agency).length}
              </Badge>
            )}
          </Button>
        )
      })}
      {selectedAgencies.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Clear all selections by toggling each selected agency
            selectedAgencies.forEach((agency) => onAgencyToggle(agency))
          }}
          className="text-xs"
        >
          Alle zurücksetzen
        </Button>
      )}
    </div>
  )
}
