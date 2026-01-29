/**
 * Recommendation Card Component
 *
 * Displays a single recommendation with priority, benefit, and action details
 */

import React from 'react'

interface RecommendationCardProps {
  priority: 'critical' | 'high' | 'medium' | 'low'
  taxArea: 'rnd' | 'deductions' | 'losses' | 'div7a'
  financialYear: string
  action: string
  description?: string
  benefit: number
  confidence: number
  deadline: Date
  forms: string[]
  transactionCount?: number
  onClick?: () => void
}

const priorityConfig = {
  critical: {
    badge: 'bg-red-600 text-white',
    border: 'border-red-500',
    bg: 'bg-red-50',
  },
  high: {
    badge: 'bg-orange-600 text-white',
    border: 'border-orange-500',
    bg: 'bg-orange-50',
  },
  medium: {
    badge: 'bg-yellow-600 text-white',
    border: 'border-yellow-500',
    bg: 'bg-yellow-50',
  },
  low: {
    badge: 'bg-gray-600 text-white',
    border: 'border-gray-500',
    bg: 'bg-gray-50',
  },
}

const taxAreaLabels = {
  rnd: 'R&D',
  deductions: 'Deductions',
  losses: 'Losses',
  div7a: 'Division 7A',
}

export default function RecommendationCard({
  priority,
  taxArea,
  financialYear,
  action,
  description,
  benefit,
  confidence,
  deadline,
  forms,
  transactionCount,
  onClick,
}: RecommendationCardProps) {
  const config = priorityConfig[priority]

  const daysUntilDeadline = Math.ceil(
    (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div
      className={`border-l-4 ${config.border} ${config.bg} rounded-r shadow p-6 ${
        onClick ? 'cursor-pointer hover:shadow-lg transition' : ''
      }`}
      onClick={onClick}
    >
      {/* Header with badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`px-3 py-1 rounded text-xs font-bold ${config.badge}`}>
          {priority.toUpperCase()}
        </span>
        <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
          {taxAreaLabels[taxArea]}
        </span>
        <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
          {financialYear}
        </span>
        {daysUntilDeadline < 0 ? (
          <span className="px-3 py-1 bg-red-200 text-red-800 rounded text-xs font-medium">
            ❌ Deadline Passed
          </span>
        ) : daysUntilDeadline < 90 ? (
          <span className="px-3 py-1 bg-orange-200 text-orange-800 rounded text-xs font-medium">
            ⚠️ {daysUntilDeadline} days remaining
          </span>
        ) : (
          <span className="px-3 py-1 bg-green-200 text-green-800 rounded text-xs font-medium">
            ✅ {daysUntilDeadline} days remaining
          </span>
        )}
      </div>

      {/* Action */}
      <h3 className="text-lg font-bold text-gray-900 mb-2">{action}</h3>

      {/* Description */}
      {description && <p className="text-sm text-gray-700 mb-3">{description}</p>}

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
        <div>
          <span className="text-gray-600">Benefit:</span>
          <span className="ml-2 font-semibold text-green-600">
            ${benefit.toLocaleString('en-AU')}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Confidence:</span>
          <span className="ml-2 font-semibold text-gray-900">{confidence}%</span>
        </div>
        <div>
          <span className="text-gray-600">Deadline:</span>
          <span className="ml-2 font-semibold text-gray-900">
            {deadline.toLocaleDateString()}
          </span>
        </div>
        {transactionCount !== undefined && transactionCount > 0 && (
          <div>
            <span className="text-gray-600">Transactions:</span>
            <span className="ml-2 font-semibold text-gray-900">{transactionCount}</span>
          </div>
        )}
      </div>

      {/* Forms */}
      <div className="text-xs text-gray-600">
        <span className="font-medium">Forms Required:</span> {forms.join(', ')}
      </div>

      {/* Click indicator */}
      {onClick && (
        <div className="mt-3 text-right">
          <span className="text-sm text-blue-600 font-medium">View Details →</span>
        </div>
      )}
    </div>
  )
}
