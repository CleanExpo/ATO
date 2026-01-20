/**
 * Opportunity Card Component
 *
 * Displays a tax opportunity with amount, confidence, and details
 */

import React from 'react'
import Link from 'next/link'

interface OpportunityCardProps {
  title: string
  amount: number
  confidence?: number
  description?: string
  icon?: string
  color?: 'purple' | 'blue' | 'orange' | 'red' | 'green'
  href?: string
  onClick?: () => void
  metadata?: Array<{ label: string; value: string | number }>
}

const colorClasses = {
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    hover: 'hover:border-purple-600',
  },
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    hover: 'hover:border-blue-600',
  },
  orange: {
    border: 'border-orange-500',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    hover: 'hover:border-orange-600',
  },
  red: {
    border: 'border-red-500',
    bg: 'bg-red-50',
    text: 'text-red-600',
    hover: 'hover:border-red-600',
  },
  green: {
    border: 'border-green-500',
    bg: 'bg-green-50',
    text: 'text-green-600',
    hover: 'hover:border-green-600',
  },
}

export default function OpportunityCard({
  title,
  amount,
  confidence,
  description,
  icon,
  color = 'blue',
  href,
  onClick,
  metadata,
}: OpportunityCardProps) {
  const colors = colorClasses[color]

  const content = (
    <div
      className={`bg-white rounded-lg shadow border-l-4 ${colors.border} ${
        href || onClick ? `${colors.hover} cursor-pointer hover:shadow-lg transition` : ''
      } p-6`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {icon && <span className="text-3xl mb-2 block">{icon}</span>}
          <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
          {description && <p className="text-xs text-gray-600 mb-2">{description}</p>}
        </div>
      </div>

      <div className="mb-4">
        <p className={`text-3xl font-bold ${colors.text}`}>
          ${amount.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
        {confidence !== undefined && (
          <p className="text-xs text-gray-500 mt-1">{confidence}% confidence</p>
        )}
      </div>

      {metadata && metadata.length > 0 && (
        <div className="border-t border-gray-200 pt-3 space-y-1">
          {metadata.map((item, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className="text-gray-600">{item.label}:</span>
              <span className="font-medium text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {(href || onClick) && (
        <div className="mt-4 text-right">
          <span className={`text-sm font-medium ${colors.text}`}>View Details →</span>
        </div>
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
