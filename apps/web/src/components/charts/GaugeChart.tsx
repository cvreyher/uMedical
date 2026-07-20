'use client'

import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

interface GaugeChartProps {
  value: number
  max?: number
  title?: string
  unit?: string
  className?: string
  height?: string
  color?: string
  thresholds?: { value: number; color: string }[]
}

export function GaugeChart({
  value,
  max = 100,
  title,
  unit = '',
  className,
  height = '300px',
  color,
  thresholds,
}: GaugeChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const option = useMemo(() => {
    const percentage = (value / max) * 100

    // Default color based on percentage or provided thresholds
    let gaugeColor = color || (isDark ? '#6366f1' : '#4f46e5')

    if (thresholds && !color) {
      for (const threshold of thresholds.sort((a, b) => b.value - a.value)) {
        if (value >= threshold.value) {
          gaugeColor = threshold.color
          break
        }
      }
    }

    return {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max,
          splitNumber: 5,
          center: ['50%', '70%'],
          radius: '100%',
          axisLine: {
            lineStyle: {
              width: 20,
              color: [
                [percentage / 100, gaugeColor],
                [1, isDark ? '#374151' : '#e5e7eb'],
              ],
            },
          },
          pointer: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          splitLine: {
            show: false,
          },
          axisLabel: {
            show: false,
          },
          title: {
            show: !!title,
            offsetCenter: [0, '30%'],
            color: isDark ? '#9ca3af' : '#6b7280',
            fontSize: 14,
          },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '-10%'],
            fontSize: 32,
            fontWeight: 'bold',
            formatter: (val: number) => {
              const formatted = val.toLocaleString('de-DE', { maximumFractionDigits: 1 })
              return unit ? `${formatted}${unit}` : formatted
            },
            color: isDark ? '#f9fafb' : '#111827',
          },
          data: [
            {
              value,
              name: title || '',
            },
          ],
        },
      ],
    }
  }, [value, max, title, unit, color, thresholds, isDark])

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      className={className}
      opts={{ renderer: 'svg' }}
    />
  )
}
