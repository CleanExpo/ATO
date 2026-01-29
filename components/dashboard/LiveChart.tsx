/**
 * Live Chart Component
 *
 * Real-time chart visualization with Recharts
 * - Supports bar, pie, area, and line charts
 * - Smooth data transitions
 * - Auto-refresh on interval or manual trigger
 * - Dark theme colors matching dashboard
 * - Responsive sizing
 */

'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'

interface ChartDataPoint {
  name: string
  value: number
  color?: string
  [key: string]: unknown
}

interface LiveChartProps {
  data: ChartDataPoint[]
  type: 'bar' | 'pie' | 'area' | 'line'
  title?: string
  dataKey?: string // For non-pie charts
  showLegend?: boolean
  height?: number
  className?: string
  colors?: string[]
}

// Default color palette matching dark theme
const DEFAULT_COLORS = [
  '#0ea5e9', // Sky blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
]

// Recharts tooltip props type
interface TooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number | string
    color: string
  }>
  label?: string
}

// Custom tooltip styling
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border border-[var(--border-default)]">
        <p className="text-[var(--text-primary)] font-semibold mb-1">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number'
              ? entry.value.toLocaleString()
              : entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function LiveChart({
  data,
  type,
  title,
  dataKey = 'value',
  showLegend = true,
  height = 300,
  className = '',
  colors = DEFAULT_COLORS
}: LiveChartProps) {
  // Render different chart types
  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis
                dataKey="name"
                stroke="var(--text-secondary)"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="var(--text-secondary)"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />}
              <Bar
                dataKey={dataKey}
                fill={colors[0]}
                radius={[8, 8, 0, 0]}
                animationDuration={500}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || colors[index % colors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill={colors[0]}
                dataKey={dataKey}
                animationDuration={500}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />}
            </PieChart>
          </ResponsiveContainer>
        )

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors[0]} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={colors[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis
                dataKey="name"
                stroke="var(--text-secondary)"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="var(--text-secondary)"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />}
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={colors[0]}
                fillOpacity={1}
                fill="url(#colorValue)"
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis
                dataKey="name"
                stroke="var(--text-secondary)"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="var(--text-secondary)"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />}
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ fill: colors[0], r: 4 }}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        )

      default:
        return null
    }
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          {title}
        </h3>
      )}
      {renderChart()}
    </div>
  )
}
