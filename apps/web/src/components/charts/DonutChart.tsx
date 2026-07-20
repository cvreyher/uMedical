'use client'

import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface DonutChartProps {
  data: Array<{ name: string; value: number; color?: string }>
  title?: string
  centerLabel?: string
  centerValue?: string | number
  className?: string
  height?: string
  maxItems?: number
}

export function DonutChart({
  data,
  title,
  centerLabel,
  centerValue,
  className,
  height = '400px',
  maxItems = 8,
}: DonutChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const option = useMemo(() => {
    const sortedData = [...data]
      .sort((a, b) => b.value - a.value)
      .slice(0, maxItems)

    const total = sortedData.reduce((sum, d) => sum + d.value, 0)

    // Color palette
    const colors = isDark
      ? ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316']
      : ['#4f46e5', '#7c3aed', '#9333ea', '#c026d3', '#db2777', '#e11d48', '#dc2626', '#ea580c']

    return {
      title: title
        ? {
            text: title,
            left: 'center',
            textStyle: {
              color: isDark ? '#f9fafb' : '#111827',
              fontSize: 16,
              fontWeight: 'bold',
            },
          }
        : undefined,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: {
          color: isDark ? '#f9fafb' : '#111827',
        },
        formatter: (params: any) => {
          const percentage = ((params.value / total) * 100).toFixed(1)
          return `${params.name}<br/>${params.value.toLocaleString('de-DE')} (${percentage}%)`
        },
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle',
        textStyle: {
          color: isDark ? '#f9fafb' : '#111827',
        },
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 8,
        formatter: (name: string) => {
          const entry = sortedData.find(d => d.name === name)
          if (!entry) return name
          const percentage = ((entry.value / total) * 100).toFixed(1)
          const truncatedName = name.length > 20 ? name.slice(0, 20) + '...' : name
          return `${truncatedName} (${percentage}%)`
        },
      },
      graphic: centerLabel || centerValue
        ? [
            {
              type: 'group',
              left: 'center',
              top: 'center',
              children: [
                centerValue
                  ? {
                      type: 'text',
                      style: {
                        text: typeof centerValue === 'number' ? centerValue.toLocaleString('de-DE') : centerValue,
                        textAlign: 'center',
                        fill: isDark ? '#f9fafb' : '#111827',
                        fontSize: 28,
                        fontWeight: 'bold',
                      },
                      left: 'center',
                      top: centerLabel ? -10 : 0,
                    }
                  : null,
                centerLabel
                  ? {
                      type: 'text',
                      style: {
                        text: centerLabel,
                        textAlign: 'center',
                        fill: isDark ? '#9ca3af' : '#6b7280',
                        fontSize: 12,
                      },
                      left: 'center',
                      top: centerValue ? 20 : 0,
                    }
                  : null,
              ].filter(Boolean),
            },
          ]
        : undefined,
      series: [
        {
          name: title || 'Verteilung',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: isDark ? '#1f2937' : '#ffffff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: isDark ? '#f9fafb' : '#111827',
            },
          },
          labelLine: {
            show: false,
          },
          data: sortedData.map((d, index) => ({
            value: d.value,
            name: d.name,
            itemStyle: {
              color: d.color || colors[index % colors.length],
            },
          })),
        },
      ],
    }
  }, [data, title, centerLabel, centerValue, maxItems, isDark])

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      className={className}
      opts={{ renderer: 'svg' }}
    />
  )
}
