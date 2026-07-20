'use client'

import { useEffect, useRef, useMemo } from 'react'
import type { TimelineEvent } from '@/lib/api'
import { transformEventToD3Kit, type D3KitTimelineData } from '@/lib/timeline-utils'

interface D3KitTimelineProps {
  events: TimelineEvent[]
  className?: string
  width?: number
  height?: number
  direction?: 'left' | 'right' | 'up' | 'down'
}

export function D3KitTimelineChart({
  events,
  className = '',
  width = 800,
  height = 400,
  direction = 'right',
}: D3KitTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const timelineIdRef = useRef(`timeline-${Math.random().toString(36).substr(2, 9)}`)

  // Transform events to d3kit-timeline format
  const timelineData = useMemo(() => {
    return events
      .map((event, index) => transformEventToD3Kit(event, index))
      .sort((a, b) => a.time.getTime() - b.time.getTime())
  }, [events])

  useEffect(() => {
    if (!containerRef.current || timelineData.length === 0) return

    // Initialize timeline
    const initTimeline = async () => {
      if (typeof window === 'undefined') return

      // Dynamic import to avoid SSR issues
      // @ts-expect-error - d3kit-timeline has no type declarations
      const d3KitTimeline = (await import('d3kit-timeline')).default

      // Clear previous chart if exists
      if (chartRef.current) {
        try {
          if (typeof chartRef.current.destroy === 'function') {
            chartRef.current.destroy()
          }
        } catch {
          // Ignore destroy errors
        }
      }

      // Clear container
      const container = containerRef.current
      if (!container) return
      container.innerHTML = ''

      // Create timeline element
      const timelineElement = document.createElement('div')
      timelineElement.id = timelineIdRef.current
      timelineElement.style.width = '100%'
      timelineElement.style.minHeight = `${height}px`
      container.appendChild(timelineElement)

      // Get container width for responsive sizing
      const containerWidth = container.offsetWidth || width

      // Initialize d3kit-timeline with constructor pattern
      const chart = new d3KitTimeline(`#${timelineIdRef.current}`, {
        direction,
        initialWidth: containerWidth,
        initialHeight: height,
        margin: { left: 20, right: 20, top: 20, bottom: 20 },
        layerGap: 60,
        dotRadius: 4,
        dotColor: (d: D3KitTimelineData) => d.color,
        labelBgColor: (d: D3KitTimelineData) => d.color,
        labelTextColor: '#fff',
        linkColor: (d: D3KitTimelineData) => d.color,
        labella: {
          minPos: 0,
          maxPos: direction === 'right' || direction === 'left' ? height - 40 : containerWidth - 40,
        },
        timeFn: (d: D3KitTimelineData) => d.time,
        textFn: (d: D3KitTimelineData) => `${d.time.getFullYear()} - ${d.name}`,
      })

      // Set data and render
      chart.data(timelineData)
      chart.resizeToFit()

      chartRef.current = chart
    }

    initTimeline()

    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        try {
          if (typeof chartRef.current.destroy === 'function') {
            chartRef.current.destroy()
          }
        } catch {
          // Ignore destroy errors
        }
        chartRef.current = null
      }
    }
  }, [timelineData, width, height, direction])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        if (containerWidth > 0) {
          try {
            chartRef.current.width(containerWidth)
            chartRef.current.resizeToFit()
          } catch {
            // Ignore resize errors
          }
        }
      }
    }

    window.addEventListener('resize', handleResize)
    const timeoutId = setTimeout(handleResize, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [])

  if (timelineData.length === 0) {
    return (
      <div className={`text-center py-12 text-muted-foreground ${className}`}>
        Keine Timeline-Events verfügbar
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`} ref={containerRef} style={{ minHeight: `${height}px` }}>
      {/* Timeline will be rendered here by d3kit-timeline */}
    </div>
  )
}
