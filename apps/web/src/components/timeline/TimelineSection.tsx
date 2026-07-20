'use client'

import { useState, useMemo } from 'react'
import type { TimelineEvent } from '@/lib/api'
import { AgencyFilter } from './AgencyFilter'
import { MedicineTimeline } from './MedicineTimeline'
import { getAgencyFromEvent } from '@/lib/timeline-utils'

interface TimelineSectionProps {
  events: TimelineEvent[]
  className?: string
}

export function TimelineSection({ events, className = '' }: TimelineSectionProps) {
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([])

  // Filter events based on selected agencies
  const filteredEvents = useMemo(() => {
    if (selectedAgencies.length === 0) {
      return events
    }
    return events.filter((event) => {
      const agency = getAgencyFromEvent(event)
      return selectedAgencies.includes(agency)
    })
  }, [events, selectedAgencies])

  const handleAgencyToggle = (agency: string) => {
    setSelectedAgencies((prev) => {
      if (prev.includes(agency)) {
        return prev.filter((a) => a !== agency)
      }
      return [...prev, agency]
    })
  }

  if (events.length === 0) {
    return (
      <div className={`text-center py-12 text-muted-foreground ${className}`}>
        Keine Timeline-Events verfügbar
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <AgencyFilter
        events={events}
        selectedAgencies={selectedAgencies}
        onAgencyToggle={handleAgencyToggle}
        className="mb-4 pb-4 border-b"
      />
      <MedicineTimeline events={filteredEvents} className="max-h-[500px] overflow-y-auto" />
    </div>
  )
}
