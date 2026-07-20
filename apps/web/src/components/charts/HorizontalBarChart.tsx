'use client'

import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface HorizontalBarChartProps {
  data: Array<{ name: string; value: number; color?: string }>
  title?: string
  className?: string
  height?: string
  showLabels?: boolean
  maxItems?: number
}

export function HorizontalBarChart({
  data,
  title,
  className,
  height = '400px',
  showLabels = true,
  maxItems = 10,
}: HorizontalBarChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const option = useMemo(() => {
    const sortedData = [...data]
      .sort((a, b) => b.value - a.value)
      .slice(0, maxItems)
      .reverse()

    const total = data.reduce((sum, d) => sum + d.value, 0)

    // Generate gradient colors
    const colors = sortedData.map((d, index) => {
      if (d.color) return d.color
      const hue = 230 + (index * 15) % 60
      return `hsl(${hue}, ${isDark ? '70%' : '60%'}, ${isDark ? '60%' : '50%'})`
    })

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
          const param = params[0]
          const percentage = total > 0 ? ((param.value / total) * 100).toFixed(1) : '0'
          return `${param.name}<br/>${param.value.toLocaleString('de-DE')} (${percentage}%)`
        },
      },
      grid: {
        left: '3%',
        right: showLabels ? '15%' : '4%',
        bottom: '3%',
        top: title ? '15%' : '3%',
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
        data: sortedData.map(d => d.name),
        axisLabel: {
          color: isDark ? '#9ca3af' : '#6b7280',
          width: 150,
          overflow: 'truncate',
          ellipsis: '...',
        },
        axisLine: {
          lineStyle: {
            color: isDark ? '#374151' : '#e5e7eb',
          },
        },
      },
      series: [
        {
          name: 'Anzahl',
          type: 'bar',
          data: sortedData.map((d, index) => ({
            value: d.value,
            itemStyle: {
              color: colors[index],
              borderRadius: [0, 4, 4, 0],
            },
          })),
          label: showLabels
            ? {
                show: true,
                position: 'right',
                color: isDark ? '#f9fafb' : '#111827',
                formatter: (params: any) => params.value.toLocaleString('de-DE'),
              }
            : undefined,
          barMaxWidth: 30,
        },
      ],
    }
  }, [data, title, maxItems, showLabels, isDark])

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      className={className}
      opts={{ renderer: 'svg' }}
    />
  )
}
