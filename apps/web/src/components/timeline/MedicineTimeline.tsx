'use client'

import { useMemo } from 'react'
import type { TimelineEvent } from '@/lib/api'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Separator } from '@workspace/ui/components/ui/separator'
import { CheckCircleIcon, XCircleIcon, ActivityIcon } from 'lucide-react'

interface MedicineTimelineProps {
  events: TimelineEvent[]
  className?: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getEventIcon(eventType: string) {
  switch (eventType.toLowerCase()) {
    case 'authorised':
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />
    case 'withdrawn':
      return <XCircleIcon className="w-4 h-4 text-red-500" />
    default:
      return <ActivityIcon className="w-4 h-4 text-blue-500" />
  }
}

function getEventVariant(eventType: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (eventType.toLowerCase()) {
    case 'authorised':
      return 'default'
    case 'withdrawn':
      return 'destructive'
    default:
      return 'secondary'
  }
}

export function MedicineTimeline({ events, className }: MedicineTimelineProps) {
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
    })
  }, [events])

  if (sortedEvents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Keine Timeline-Events verfügbar
      </div>
    )
  }

  return (
    <div className={`space-y-0 ${className || ''}`}>
      {sortedEvents.map((event, index) => (
        <div key={event.id}>
          <div className="flex gap-6 py-6">
            {/* Timeline line and dot */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full border-2 border-primary/20 bg-background flex items-center justify-center shrink-0">
                {getEventIcon(event.eventType)}
              </div>
              {index < sortedEvents.length - 1 && (
                <div className="w-0.5 h-full bg-border mt-2 min-h-[60px]" />
              )}
            </div>

            {/* Event content */}
            <div className="flex-1 min-w-0 pb-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-2">{event.title}</h3>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {formatDate(event.eventDate)}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getEventVariant(event.eventType)} className="text-xs gap-1.5">
                  {getEventIcon(event.eventType)}
                  {event.eventType}
                </Badge>
                {event.eventCategory && (
                  <Badge variant="outline" className="text-xs">
                    {event.eventCategory}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {index < sortedEvents.length - 1 && <Separator className="ml-[52px]" />}
        </div>
      ))}
    </div>
  )
}
