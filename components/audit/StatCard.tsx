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

const colorClasses = {
  blue: {
    border: 'border-blue-500',
    text: 'text-blue-600',
  },
  green: {
    border: 'border-green-500',
    text: 'text-green-600',
  },
  orange: {
    border: 'border-orange-500',
    text: 'text-orange-600',
  },
  red: {
    border: 'border-red-500',
    text: 'text-red-600',
  },
  purple: {
    border: 'border-purple-500',
    text: 'text-purple-600',
  },
  gray: {
    border: 'border-gray-500',
    text: 'text-gray-600',
  },
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
  const colors = colorClasses[color]

  return (
    <div className={`bg-white rounded-lg shadow border-l-4 ${colors.border} p-6`}>
      {icon && <div className="text-3xl mb-2">{icon}</div>}

      <h3 className="text-sm font-medium text-gray-500 mb-2">{label}</h3>

      <div className="flex items-baseline gap-2">
        <p className={`${sizeClasses[size]} font-bold text-gray-900`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>

        {trend && (
          <span
            className={`text-sm font-medium ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {subtext && <p className="text-xs text-gray-500 mt-2">{subtext}</p>}
    </div>
  )
}
