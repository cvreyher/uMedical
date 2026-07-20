'use client'

import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface StackedBarChartProps {
  data: {
    categories: string[]
    series: Array<{
      name: string
      data: number[]
      color?: string
    }>
  }
  title?: string
  className?: string
  height?: string
  horizontal?: boolean
}

export function StackedBarChart({
  data,
  title,
  className,
  height = '400px',
  horizontal = false,
}: StackedBarChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const option = useMemo(() => {
    // Color palette
    const colors = isDark
      ? ['#6366f1', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
      : ['#4f46e5', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#ea580c']

    const categoryAxis = {
      type: 'category' as const,
      data: data.categories,
      axisLabel: {
        color: isDark ? '#9ca3af' : '#6b7280',
        rotate: !horizontal && data.categories.length > 8 ? 45 : 0,
        width: horizontal ? 100 : undefined,
        overflow: horizontal ? 'truncate' : undefined,
      },
      axisLine: {
        lineStyle: {
          color: isDark ? '#374151' : '#e5e7eb',
        },
      },
    }

    const valueAxis = {
      type: 'value' as const,
      axisLabel: {
        color: isDark ? '#9ca3af' : '#6b7280',
        formatter: (value: number) => value.toLocaleString('de-DE'),
      },
      axisLine: {
        lineStyle: {
          color: isDark ? '#374151' : '#e5e7eb',
        },
      },
      splitLine: {
        lineStyle: {
          color: isDark ? '#374151' : '#e5e7eb',
          type: 'dashed' as const,
        },
      },
    }

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
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: {
          color: isDark ? '#f9fafb' : '#111827',
        },
        formatter: (params: any) => {
          const category = params[0]?.axisValue || ''
          let result = `<strong>${category}</strong><br/>`
          let total = 0
          params.forEach((p: any) => {
            result += `${p.marker} ${p.seriesName}: ${p.value.toLocaleString('de-DE')}<br/>`
            total += p.value
          })
          result += `<strong>Gesamt: ${total.toLocaleString('de-DE')}</strong>`
          return result
        },
      },
      legend: {
        data: data.series.map(s => s.name),
        top: 'bottom',
        textStyle: {
          color: isDark ? '#9ca3af' : '#6b7280',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: title ? '15%' : '10%',
        containLabel: true,
      },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: data.series.map((s, index) => ({
        name: s.name,
        type: 'bar',
        stack: 'total',
        emphasis: {
          focus: 'series',
        },
        data: s.data,
        itemStyle: {
          color: s.color || colors[index % colors.length],
        },
        barMaxWidth: 50,
      })),
    }
  }, [data, title, horizontal, isDark])

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      className={className}
      opts={{ renderer: 'svg' }}
    />
  )
}
