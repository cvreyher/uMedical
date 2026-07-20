'use client'

import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface AreaLineChartProps {
  data: Array<{ label: string; value: number; secondary?: number }>
  title?: string
  seriesName?: string
  secondarySeriesName?: string
  className?: string
  height?: string
  showArea?: boolean
}

export function AreaLineChart({
  data,
  title,
  seriesName = 'Wert',
  secondarySeriesName,
  className,
  height = '400px',
  showArea = true,
}: AreaLineChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const option = useMemo(() => {
    const hasSecondary = data.some(d => d.secondary !== undefined)

    const series: any[] = [
      {
        name: seriesName,
        type: 'line',
        smooth: true,
        data: data.map(d => d.value),
        areaStyle: showArea
          ? {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(79, 70, 229, 0.4)' },
                  { offset: 1, color: isDark ? 'rgba(99, 102, 241, 0)' : 'rgba(79, 70, 229, 0)' },
                ],
              },
            }
          : undefined,
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
    ]

    if (hasSecondary && secondarySeriesName) {
      series.push({
        name: secondarySeriesName,
        type: 'line',
        smooth: true,
        data: data.map(d => d.secondary ?? 0),
        areaStyle: showArea
          ? {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: isDark ? 'rgba(236, 72, 153, 0.4)' : 'rgba(219, 39, 119, 0.4)' },
                  { offset: 1, color: isDark ? 'rgba(236, 72, 153, 0)' : 'rgba(219, 39, 119, 0)' },
                ],
              },
            }
          : undefined,
        lineStyle: {
          color: isDark ? '#ec4899' : '#db2777',
          width: 3,
        },
        itemStyle: {
          color: isDark ? '#ec4899' : '#db2777',
        },
        emphasis: {
          focus: 'series',
        },
      })
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
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: {
          color: isDark ? '#f9fafb' : '#111827',
        },
        formatter: (params: any) => {
          const label = params[0]?.axisValue || ''
          let result = `<strong>${label}</strong><br/>`
          params.forEach((p: any) => {
            result += `${p.marker} ${p.seriesName}: ${p.value.toLocaleString('de-DE')}<br/>`
          })
          return result
        },
      },
      legend: hasSecondary
        ? {
            data: [seriesName, secondarySeriesName],
            top: 'bottom',
            textStyle: {
              color: isDark ? '#9ca3af' : '#6b7280',
            },
          }
        : undefined,
      grid: {
        left: '3%',
        right: '4%',
        bottom: hasSecondary ? '15%' : '3%',
        top: title ? '15%' : '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.label),
        axisLabel: {
          color: isDark ? '#9ca3af' : '#6b7280',
          rotate: data.length > 12 ? 45 : 0,
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
      series,
    }
  }, [data, title, seriesName, secondarySeriesName, showArea, isDark])

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      className={className}
      opts={{ renderer: 'svg' }}
    />
  )
}
