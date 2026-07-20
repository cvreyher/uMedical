'use client'

import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface CategoryPieChartProps {
  data: Record<string, number>
  className?: string
}

export function CategoryPieChart({ data, className }: CategoryPieChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const option = useMemo(() => {
    const entries = Object.entries(data)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 8)

    const total = entries.reduce((sum, [, count]) => sum + (count as number), 0)

    // Generate colors based on theme
    const colors = isDark
      ? [
          '#6366f1', // indigo-500
          '#8b5cf6', // violet-500
          '#a855f7', // purple-500
          '#d946ef', // fuchsia-500
          '#ec4899', // pink-500
          '#f43f5e', // rose-500
          '#ef4444', // red-500
          '#f97316', // orange-500
        ]
      : [
          '#4f46e5', // indigo-600
          '#7c3aed', // violet-600
          '#9333ea', // purple-600
          '#c026d3', // fuchsia-600
          '#db2777', // pink-600
          '#e11d48', // rose-600
          '#dc2626', // red-600
          '#ea580c', // orange-600
        ]

    return {
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
          const entry = entries.find(([cat]) => cat === name)
          if (!entry) return name
          const count = entry[1] as number
          const percentage = ((count / total) * 100).toFixed(1)
          return `${name} (${percentage}%)`
        },
      },
      series: [
        {
          name: 'Kategorien',
          type: 'pie',
          radius: ['40%', '70%'],
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
          data: entries.map(([category, count], index) => ({
            value: count,
            name: category,
            itemStyle: {
              color: colors[index % colors.length],
            },
          })),
        },
      ],
    }
  }, [data, isDark])

  return (
    <ReactECharts
      option={option}
      style={{ height: '400px', width: '100%' }}
      className={className}
      opts={{ renderer: 'svg' }}
    />
  )
}
