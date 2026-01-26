/**
 * Stat Card Component
 *
 * Displays a single statistic with label and optional trend/icon
 */

import React from 'react'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray'
  size?: 'sm' | 'md' | 'lg'
}

const colorStyles: Record<string, { border: string; text: string }> = {
  blue: { border: '#00F5FF', text: '#00F5FF' },
  green: { border: '#00FF88', text: '#00FF88' },
  orange: { border: '#FFB800', text: '#FFB800' },
  red: { border: '#FF4444', text: '#FF4444' },
  purple: { border: '#8855FF', text: '#8855FF' },
  gray: { border: 'rgba(255,255,255,0.2)', text: 'var(--text-secondary)' },
}

const sizeClasses = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
}

export default function StatCard({
  label,
  value,
  subtext,
  icon,
  trend,
  color = 'blue',
  size = 'md',
}: StatCardProps) {
  const colors = colorStyles[color]

  return (
    <div
      className="glass-card p-6"
      style={{ borderLeft: `2px solid ${colors.border}` }}
    >
      {icon && <div className="text-3xl mb-2">{icon}</div>}

      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">{label}</h3>

      <div className="flex items-baseline gap-2">
        <p className={`${sizeClasses[size]} font-bold text-[var(--text-primary)]`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>

        {trend && (
          <span
            className="text-sm font-medium"
            style={{ color: trend.isPositive ? '#00FF88' : '#FF4444' }}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {subtext && <p className="text-xs text-[var(--text-muted)] mt-2">{subtext}</p>}
    </div>
  )
}
