'use client'

/**
 * Alert Card
 *
 * Displays a single tax alert with severity styling and action buttons
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  ExternalLink,
  Calendar,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'

interface TaxAlert {
  id: string
  alert_type: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  category: string
  financial_year?: string
  platform?: string
  triggered_at: string
  due_date?: string
  status: 'unread' | 'read' | 'acknowledged' | 'dismissed' | 'actioned'
  action_url?: string
  action_label?: string
  metadata?: Record<string, unknown>
}

interface AlertCardProps {
  alert: TaxAlert
  onStatusChange?: (alertId: string, newStatus: string) => void
  onDelete?: (alertId: string) => void
}

export default function AlertCard({
  alert,
  onStatusChange,
  onDelete
}: AlertCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update alert')
      }

      if (onStatusChange) {
        onStatusChange(alert.id, newStatus)
      }
    } catch (error) {
      console.error('Error updating alert:', error)
      window.alert('Failed to update alert status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this alert?')) {
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/alerts/${alert.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete alert')
      }

      if (onDelete) {
        onDelete(alert.id)
      }
    } catch (error) {
      console.error('Error deleting alert:', error)
      window.alert('Failed to delete alert')
    } finally {
      setIsUpdating(false)
    }
  }

  // Severity colors and icons
  const severityConfig = {
    info: {
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-900 dark:text-blue-100',
      iconColor: 'text-blue-500',
      Icon: Info
    },
    warning: {
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      textColor: 'text-yellow-900 dark:text-yellow-100',
      iconColor: 'text-yellow-500',
      Icon: AlertTriangle
    },
    critical: {
      bgColor: 'bg-red-50 dark:bg-red-950',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-900 dark:text-red-100',
      iconColor: 'text-red-500',
      Icon: AlertCircle
    }
  }

  const config = severityConfig[alert.severity]
  const Icon = config.Icon

  // Status badge
  const statusBadge = {
    unread: { label: 'New', color: 'bg-blue-500 text-white' },
    read: { label: 'Read', color: 'bg-gray-300 text-gray-700' },
    acknowledged: { label: 'Acknowledged', color: 'bg-green-500 text-white' },
    dismissed: { label: 'Dismissed', color: 'bg-gray-400 text-white' },
    actioned: { label: 'Actioned', color: 'bg-purple-500 text-white' }
  }

  const badge = statusBadge[alert.status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`
        relative p-5 rounded-lg border-2
        ${config.bgColor}
        ${config.borderColor}
        ${alert.status === 'unread' ? 'shadow-md' : 'opacity-90'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Icon */}
          <div className={`p-2 rounded-lg bg-white dark:bg-gray-900 ${config.iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Title and Metadata */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-semibold ${config.textColor}`}>
                {alert.title}
              </h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.color}`}>
                {badge.label}
              </span>
            </div>

            {/* Metadata Row */}
            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
              {alert.financial_year && (
                <span>FY {alert.financial_year}</span>
              )}
              {alert.platform && (
                <span className="capitalize">{alert.platform}</span>
              )}
              <span>{formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}</span>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={handleDelete}
          disabled={isUpdating}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Delete alert"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message */}
      <p className={`text-sm mb-4 ${config.textColor}`}>
        {alert.message}
      </p>

      {/* Due Date */}
      {alert.due_date && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Calendar className={`w-4 h-4 ${config.iconColor}`} />
          <span className={config.textColor}>
            Due: {format(new Date(alert.due_date), 'dd MMM yyyy')}
          </span>
        </div>
      )}

      {/* Metadata Highlights */}
      {alert.metadata && (
        <div className="flex gap-4 mb-4 text-sm">
          {typeof alert.metadata.potential_benefit === 'number' && (
            <div className="flex items-center gap-1">
              <DollarSign className={`w-4 h-4 ${config.iconColor}`} />
              <span className={config.textColor}>
                ${alert.metadata.potential_benefit.toFixed(2)} potential benefit
              </span>
            </div>
          )}
          {alert.metadata.total_rnd_transactions != null && (
            <span className={config.textColor}>
              {String(alert.metadata.total_rnd_transactions)} R&D transactions
            </span>
          )}
          {alert.metadata.opportunity_count != null && (
            <span className={config.textColor}>
              {String(alert.metadata.opportunity_count)} opportunities
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Primary Action */}
        {alert.action_url && alert.action_label && (
          <Link
            href={alert.action_url}
            onClick={() => handleStatusChange('actioned')}
            className={`
              inline-flex items-center gap-2 px-4 py-2 rounded-lg
              bg-white dark:bg-gray-900 border-2 ${config.borderColor}
              ${config.textColor} font-medium text-sm
              hover:scale-105 transition-transform
            `}
          >
            {alert.action_label}
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}

        {/* Status Actions */}
        {alert.status === 'unread' && (
          <button
            onClick={() => handleStatusChange('read')}
            disabled={isUpdating}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            Mark as Read
          </button>
        )}

        {alert.status === 'read' && (
          <button
            onClick={() => handleStatusChange('acknowledged')}
            disabled={isUpdating}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            Acknowledge
          </button>
        )}

        {(alert.status === 'unread' || alert.status === 'read') && (
          <button
            onClick={() => handleStatusChange('dismissed')}
            disabled={isUpdating}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Loading Overlay */}
      {isUpdating && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 rounded-lg flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
    </motion.div>
  )
}
