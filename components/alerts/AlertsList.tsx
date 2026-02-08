'use client'

/**
 * Alerts List
 *
 * Displays a filterable list of tax alerts
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, RefreshCw, Inbox } from 'lucide-react'
import AlertCard from './AlertCard'

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

interface AlertsListProps {
  tenantId: string
  initialFilters?: {
    status?: string
    severity?: string
    category?: string
    financialYear?: string
    platform?: string
  }
}

export default function AlertsList({
  tenantId,
  initialFilters = {}
}: AlertsListProps) {
  const [alerts, setAlerts] = useState<TaxAlert[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || 'all')
  const [severityFilter, setSeverityFilter] = useState(initialFilters.severity || 'all')
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.category || 'all')

  useEffect(() => {
    fetchAlerts()
  }, [tenantId, statusFilter, severityFilter, categoryFilter])

  const fetchAlerts = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      // Build query params
      const params = new URLSearchParams()

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      if (severityFilter !== 'all') {
        params.append('severity', severityFilter)
      }

      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter)
      }

      params.append('limit', '100')

      const response = await fetch(`/api/alerts?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch alerts')
      }

      const data = await response.json()
      setAlerts(data.alerts || [])
      setTotal(data.total || 0)
      setUnreadCount(data.unreadCount || 0)

    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchAlerts(true)
  }

  const handleStatusChange = (alertId: string, newStatus: string) => {
    // Optimistically update UI
    setAlerts(prevAlerts =>
      prevAlerts.map(alert =>
        alert.id === alertId
          ? { ...alert, status: newStatus as TaxAlert['status'] }
          : alert
      )
    )

    // Update counts
    if (newStatus !== 'unread') {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  const handleDelete = (alertId: string) => {
    // Remove from list
    setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId))
    setTotal(prev => Math.max(0, prev - 1))

    // Update unread count if deleted alert was unread
    const deletedAlert = alerts.find(a => a.id === alertId)
    if (deletedAlert?.status === 'unread') {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  // Filter options
  const statusOptions = [
    { value: 'all', label: 'All Alerts' },
    { value: 'unread', label: 'Unread' },
    { value: 'read', label: 'Read' },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'dismissed', label: 'Dismissed' },
    { value: 'actioned', label: 'Actioned' }
  ]

  const severityOptions = [
    { value: 'all', label: 'All Severity' },
    { value: 'critical', label: 'Critical' },
    { value: 'warning', label: 'Warning' },
    { value: 'info', label: 'Info' }
  ]

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'deadline', label: 'Deadlines' },
    { value: 'opportunity', label: 'Opportunities' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'legislative', label: 'Legislative' },
    { value: 'financial', label: 'Financial' }
  ]

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tax Alerts
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {total} total • {unreadCount} unread
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Severity Filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm"
        >
          {severityOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm"
        >
          {categoryOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && alerts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No alerts found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {statusFilter !== 'all' || severityFilter !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Your tax alerts will appear here'}
          </p>
        </motion.div>
      )}

      {/* Alerts List */}
      {!isLoading && alerts.length > 0 && (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
