'use client'

import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface StatusBarChartProps {
  data: Record<string, number>
  total: number
  className?: string
}

export function StatusBarChart({ data, total, className }: StatusBarChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const option = useMemo(() => {
    const entries = Object.entries(data)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5)

    const colors: Record<string, string> = {
      Authorised: '#22c55e', // green-500
      Withdrawn: '#ef4444', // red-500
      Suspended: '#eab308', // yellow-500
      Refused: '#f97316', // orange-500
    }

    return {
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
          const param = params[0]
          const percentage = ((param.value / total) * 100).toFixed(1)
          return `${param.name}<br/>${param.value.toLocaleString('de-DE')} (${percentage}%)`
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
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
            type: 'dashed',
          },
        },
      },
      yAxis: {
        type: 'category',
        data: entries.map(([status]) => status),
        axisLabel: {
          color: isDark ? '#9ca3af' : '#6b7280',
        },
        axisLine: {
          lineStyle: {
            color: isDark ? '#374151' : '#e5e7eb',
          },
        },
      },
      series: [
        {
          name: 'Medikamente',
          type: 'bar',
          data: entries.map(([status, count]) => ({
            value: count,
            itemStyle: {
              color: colors[status] || (isDark ? '#6366f1' : '#4f46e5'),
            },
          })),
          label: {
            show: true,
            position: 'right',
            color: isDark ? '#f9fafb' : '#111827',
            formatter: (params: any) => params.value.toLocaleString('de-DE'),
          },
        },
      ],
    }
  }, [data, total, isDark])

  return (
    <ReactECharts
      option={option}
      style={{ height: '400px', width: '100%' }}
      className={className}
      opts={{ renderer: 'svg' }}
    />
  )
}
