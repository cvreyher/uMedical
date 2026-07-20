'use client'

import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface TreemapItem {
  name: string
  value: number
  children?: TreemapItem[]
}

interface TreemapChartProps {
  data: TreemapItem[]
  title?: string
  className?: string
  height?: string
}

export function TreemapChart({
  data,
  title,
  className,
  height = '400px',
}: TreemapChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const option = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.value, 0)

    // Color palette
    const colors = isDark
      ? ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6']
      : ['#4f46e5', '#7c3aed', '#9333ea', '#c026d3', '#db2777', '#e11d48', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#0891b2', '#0284c7', '#2563eb']

    const coloredData = data.map((item, index) => ({
      ...item,
      itemStyle: {
        color: colors[index % colors.length],
      },
    }))

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
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: {
          color: isDark ? '#f9fafb' : '#111827',
        },
        formatter: (params: any) => {
          const percentage = total > 0 ? ((params.value / total) * 100).toFixed(1) : '0'
          return `${params.name}<br/>${params.value.toLocaleString('de-DE')} (${percentage}%)`
        },
      },
      series: [
        {
          type: 'treemap',
          top: title ? 40 : 10,
          left: 10,
          right: 10,
          bottom: 10,
          roam: false,
          nodeClick: false,
          breadcrumb: {
            show: false,
          },
          label: {
            show: true,
            formatter: (params: any) => {
              const percentage = total > 0 ? ((params.value / total) * 100).toFixed(0) : '0'
              const name = params.name.length > 15 ? params.name.slice(0, 15) + '...' : params.name
              return `${name}\n${percentage}%`
            },
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 'bold',
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowBlur: 2,
          },
          itemStyle: {
            borderColor: isDark ? '#1f2937' : '#ffffff',
            borderWidth: 2,
            gapWidth: 2,
          },
          emphasis: {
            label: {
              fontSize: 14,
            },
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.3)',
            },
          },
          data: coloredData,
        },
      ],
    }
  }, [data, title, isDark])

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      className={className}
      opts={{ renderer: 'svg' }}
    />
  )
}
