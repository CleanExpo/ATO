/**
 * Consolidated Multi-Organization Dashboard
 *
 * Aggregate view across all organizations for enterprise clients.
 * Scientific Luxury design system.
 */

'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  TrendingUp,
  Database,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  BarChart3,
  DollarSign,
  Clock,
  Zap,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useOrganization } from '@/lib/context/OrganizationContext'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import { PlatformBadge } from '@/components/ui/PlatformBadge'

// ─── Types ───────────────────────────────────────────────────────────

interface OrganizationSummary {
  id: string
  name: string
  role: string
  connectionStatus: 'connected' | 'disconnected' | 'error'
  lastSyncAt: string | null
  platform: 'xero' | 'quickbooks' | 'myob' | null
  transactionCount: number
  taxOpportunities: number
  estimatedRecovery: number
  xeroConnected: boolean
  quickbooksConnected: boolean
  myobConnected: boolean
}

interface ConsolidatedStats {
  totalOrganizations: number
  organizationsWithXero: number
  organizationsWithQuickBooks: number
  organizationsWithMYOB: number
  totalTransactionsSynced: number
  totalTaxOpportunitiesIdentified: number
  totalEstimatedRecovery: number
  organizationSummaries: OrganizationSummary[]
}

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  magenta: '#FF00FF',
  grey: '#6B7280',
} as const

const EASING = {
  outExpo: [0.19, 1, 0.22, 1] as const,
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`
  }
  return `$${amount.toFixed(0)}`
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'

  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

// ─── Glass Card Component ────────────────────────────────────────────

function GlassCard({ children, className = '', highlight = false }: {
  children: React.ReactNode
  className?: string
  highlight?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASING.outExpo }}
      className={`p-6 border-[0.5px] rounded-sm backdrop-blur-xl ${
        highlight
          ? 'border-cyan-500/30 bg-cyan-500/5'
          : 'border-white/[0.08] bg-black/40'
      } ${className}`}
    >
      {children}
    </motion.div>
  )
}

// ─── Metric Card Component ───────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, format = 'number', color = SPECTRAL.cyan }: {
  icon: React.ElementType
  label: string
  value: number
  format?: 'number' | 'currency'
  color?: string
}) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between mb-4">
        <div
          className="p-3 rounded-lg border-[0.5px]"
          style={{
            borderColor: `${color}30`,
            backgroundColor: `${color}10`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
          {label}
        </p>
        <p className="text-2xl font-light tabular-nums" style={{ color }}>
          {format === 'currency' ? formatCurrency(value) : value.toLocaleString()}
        </p>
      </div>
    </GlassCard>
  )
}

// ─── Organization Row Component ──────────────────────────────────────

function OrganizationRow({ org, onView }: {
  org: OrganizationSummary
  onView: (orgId: string) => void
}) {
  const statusColor = {
    connected: SPECTRAL.emerald,
    disconnected: SPECTRAL.grey,
    error: SPECTRAL.red,
  }[org.connectionStatus]

  const StatusIcon = {
    connected: CheckCircle2,
    disconnected: XCircle,
    error: AlertCircle,
  }[org.connectionStatus]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group p-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex items-center gap-4">
        {/* Status Indicator */}
        <div
          className="w-1 h-12 rounded-full"
          style={{ backgroundColor: statusColor }}
        />

        {/* Organization Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-white truncate">
              {org.name}
            </h3>
            <span className="px-2 py-0.5 text-[8px] uppercase tracking-wider rounded-sm bg-white/5 text-white/40">
              {org.role}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <div className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" style={{ color: statusColor }} />
              <span className="capitalize">{org.connectionStatus}</span>
            </div>
            {org.lastSyncAt && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(org.lastSyncAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Platform Badges */}
        <div className="flex items-center gap-2">
          {org.xeroConnected && <PlatformBadge platform="xero" size="sm" />}
          {org.quickbooksConnected && <PlatformBadge platform="quickbooks" size="sm" />}
          {org.myobConnected && <PlatformBadge platform="myob" size="sm" />}
        </div>

        {/* Metrics */}
        <div className="hidden md:flex items-center gap-6 text-xs">
          <div className="text-center">
            <p className="font-mono" style={{ color: SPECTRAL.cyan }}>
              {(org.transactionCount ?? 0).toLocaleString()}
            </p>
            <p className="text-[8px] uppercase tracking-wider text-white/30">
              Transactions
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono" style={{ color: SPECTRAL.magenta }}>
              {org.taxOpportunities}
            </p>
            <p className="text-[8px] uppercase tracking-wider text-white/30">
              Opportunities
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono" style={{ color: SPECTRAL.emerald }}>
              {formatCurrency(org.estimatedRecovery)}
            </p>
            <p className="text-[8px] uppercase tracking-wider text-white/30">
              Recovery
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onView(org.id)}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
        >
          <ExternalLink className="w-4 h-4 text-white/40" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────

export function ConsolidatedDashboard() {
  const { switchOrganization } = useOrganization()
  const [stats, setStats] = useState<ConsolidatedStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      setError(null)
      const response = await fetch('/api/organizations/consolidated/stats')

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`)
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch consolidated stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchStats()
  }

  const handleViewOrganization = (orgId: string) => {
    switchOrganization(orgId)
    // Navigate to organization dashboard
    window.location.href = '/dashboard/overview'
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw className="w-8 h-8 text-cyan-400" />
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <GlassCard className="text-center" highlight>
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          Failed to Load Dashboard
        </h2>
        <p className="text-sm text-white/60 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          Retry
        </button>
      </GlassCard>
    )
  }

  if (!stats || stats.totalOrganizations === 0) {
    return (
      <GlassCard className="text-center" highlight>
        <Building2 className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          No Organizations Found
        </h2>
        <p className="text-sm text-white/60 mb-4">
          Create your first organization to get started
        </p>
        <Link
          href="/dashboard/organization/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors"
        >
          Create Organization
          <ChevronRight className="w-4 h-4" />
        </Link>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Multi-Organization Dashboard
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Consolidated view across {stats.totalOrganizations} organizations
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </span>
        </button>
      </div>

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Building2}
          label="Total Organizations"
          value={stats.totalOrganizations}
          color={SPECTRAL.cyan}
        />
        <MetricCard
          icon={Database}
          label="Total Transactions"
          value={stats.totalTransactionsSynced}
          color={SPECTRAL.magenta}
        />
        <MetricCard
          icon={Zap}
          label="Tax Opportunities"
          value={stats.totalTaxOpportunitiesIdentified}
          color={SPECTRAL.amber}
        />
        <MetricCard
          icon={TrendingUp}
          label="Estimated Recovery"
          value={stats.totalEstimatedRecovery}
          format="currency"
          color={SPECTRAL.emerald}
        />
      </div>

      {/* Platform Distribution */}
      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Platform Distribution
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <PlatformBadge platform="xero" size="md" showIcon />
            </div>
            <p className="text-2xl font-light tabular-nums text-white mb-1">
              {stats.organizationsWithXero}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              Organizations
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <PlatformBadge platform="quickbooks" size="md" showIcon />
            </div>
            <p className="text-2xl font-light tabular-nums text-white mb-1">
              {stats.organizationsWithQuickBooks}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              Organizations
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <PlatformBadge platform="myob" size="md" showIcon />
            </div>
            <p className="text-2xl font-light tabular-nums text-white mb-1">
              {stats.organizationsWithMYOB}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              Organizations
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Organization List */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-6 border-b border-white/[0.08]">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Organizations
          </h2>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <AnimatePresence>
            {stats.organizationSummaries.map((org) => (
              <OrganizationRow
                key={org.id}
                org={org}
                onView={handleViewOrganization}
              />
            ))}
          </AnimatePresence>
        </div>
      </GlassCard>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white mb-1">
              Sync All Organizations
            </h3>
            <p className="text-xs text-white/40">
              Refresh data from all connected platforms
            </p>
          </div>
          <button className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-colors border-[0.5px] border-cyan-500/30">
            Sync All
          </button>
        </GlassCard>

        <GlassCard className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white mb-1">
              Export Consolidated Report
            </h3>
            <p className="text-xs text-white/40">
              Generate cross-organization analysis
            </p>
          </div>
          <button className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border-[0.5px] border-emerald-500/30">
            Export
          </button>
        </GlassCard>
      </div>
    </div>
  )
}

export default ConsolidatedDashboard
