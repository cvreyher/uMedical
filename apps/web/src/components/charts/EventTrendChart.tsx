'use client'

import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface EventTrendChartProps {
  data: Array<{ date: string; count: number }>
  className?: string
}

export function EventTrendChart({ data, className }: EventTrendChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const option = useMemo(() => {
    // Group data by month
    const monthlyData = data.reduce((acc, item) => {
      const date = new Date(item.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      acc[monthKey] = (acc[monthKey] || 0) + item.count
      return acc
    }, {} as Record<string, number>)

    const sortedMonths = Object.keys(monthlyData).sort()
    const values = sortedMonths.map((month) => monthlyData[month])

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: {
          color: isDark ? '#f9fafb' : '#111827',
        },
        formatter: (params: any) => {
          const param = params[0]
          return `${param.name}<br/>${param.value.toLocaleString('de-DE')} Events`
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: sortedMonths.map((month) => {
          const [year, monthNum] = month.split('-')
          return `${monthNum}/${(year ?? '').slice(2)}`
        }),
        axisLabel: {
          color: isDark ? '#9ca3af' : '#6b7280',
          rotate: 45,
        },
        axisLine: {
          lineStyle: {
            color: isDark ? '#374151' : '#e5e7eb',
          },
        },
      },
      yAxis: {
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
      series: [
        {
          name: 'Events',
          type: 'line',
          smooth: true,
          data: values,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(79, 70, 229, 0.3)',
                },
                {
                  offset: 1,
                  color: isDark ? 'rgba(99, 102, 241, 0)' : 'rgba(79, 70, 229, 0)',
                },
              ],
            },
          },
          lineStyle: {
            color: isDark ? '#6366f1' : '#4f46e5',
            width: 3,
          },
          itemStyle: {
            color: isDark ? '#6366f1' : '#4f46e5',
          },
          emphasis: {
            focus: 'series',
          },
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
