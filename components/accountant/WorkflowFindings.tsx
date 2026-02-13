/**
 * WorkflowFindings - Interactive findings list with filtering and actions
 *
 * Client component that wraps FindingCards with:
 * - Status filtering (all/pending/approved/rejected/deferred)
 * - Sort controls (date/benefit/confidence)
 * - High value quick filter
 * - Optimistic status updates via PATCH API
 * - Live summary stats
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import { FindingCard, type Finding } from './FindingCard'
import { Filter, ArrowUpDown, DollarSign } from 'lucide-react'

type WorkflowAreaId = 'sundries' | 'deductions' | 'fbt' | 'div7a' | 'documents' | 'reconciliation'
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'deferred'
type SortBy = 'date' | 'benefit' | 'confidence'

interface WorkflowFindingsProps {
  initialFindings: Finding[]
  workflowArea: WorkflowAreaId
}

export function WorkflowFindings({ initialFindings, workflowArea }: WorkflowFindingsProps) {
  const [findings, setFindings] = useState<Finding[]>(initialFindings)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [highValueOnly, setHighValueOnly] = useState(false)

  // Filtered and sorted findings
  const displayFindings = useMemo(() => {
    let filtered = findings

    if (statusFilter !== 'all') {
      filtered = filtered.filter((f) => f.status === statusFilter)
    }

    if (highValueOnly) {
      filtered = filtered.filter((f) => (f.estimatedBenefit ?? 0) >= 50000)
    }

    const sorted = [...filtered]
    switch (sortBy) {
      case 'benefit':
        sorted.sort((a, b) => (b.estimatedBenefit ?? 0) - (a.estimatedBenefit ?? 0))
        break
      case 'confidence':
        sorted.sort((a, b) => b.confidence.score - a.confidence.score)
        break
      case 'date':
      default:
        // Already sorted by date from server
        break
    }

    return sorted
  }, [findings, statusFilter, sortBy, highValueOnly])

  // Summary stats from current findings (not filtered)
  const stats = useMemo(() => {
    const total = findings.length
    const pending = findings.filter((f) => f.status === 'pending').length
    const approved = findings.filter((f) => f.status === 'approved').length
    const totalBenefit = findings.reduce((sum, f) => sum + (f.estimatedBenefit ?? 0), 0)
    return { total, pending, approved, totalBenefit }
  }, [findings])

  // Update finding status via API
  const updateFindingStatus = useCallback(
    async (findingId: string, status: string, reason?: string) => {
      const response = await fetch(`/api/accountant/findings/${findingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Failed to update status to ${status}`)
      }

      // Optimistic update
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status: status as Finding['status'] } : f))
      )
    },
    []
  )

  const onApprove = useCallback(
    (findingId: string) => updateFindingStatus(findingId, 'approved'),
    [updateFindingStatus]
  )

  const onReject = useCallback(
    (findingId: string, reason: string) => updateFindingStatus(findingId, 'rejected', reason),
    [updateFindingStatus]
  )

  const onDefer = useCallback(
    (findingId: string) => updateFindingStatus(findingId, 'deferred'),
    [updateFindingStatus]
  )

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'deferred', label: 'Deferred' },
  ]

  return (
    <>
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'var(--void-elevated)', border: '1px solid var(--glass-border)' }}
        >
          <div className="text-xs text-white/60 mb-1">Total Findings</div>
          <div className="text-2xl font-light text-white/90">{stats.total}</div>
        </div>
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'var(--void-elevated)', border: '1px solid var(--glass-border)' }}
        >
          <div className="text-xs text-white/60 mb-1">Pending Review</div>
          <div className="text-2xl font-light text-white/90">{stats.pending}</div>
        </div>
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'var(--void-elevated)', border: '1px solid var(--glass-border)' }}
        >
          <div className="text-xs text-white/60 mb-1">Approved</div>
          <div className="text-2xl font-light text-white/90">{stats.approved}</div>
        </div>
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'var(--void-elevated)', border: '1px solid var(--glass-border)' }}
        >
          <div className="text-xs text-white/60 mb-1">Estimated Benefit</div>
          <div className="text-2xl font-light text-white/90">
            ${stats.totalBenefit.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-white/40" />
        {statusFilters.map((sf) => (
          <button
            key={sf.value}
            onClick={() => setStatusFilter(sf.value)}
            className="px-4 py-2 rounded-xl text-sm transition-all"
            style={
              statusFilter === sf.value
                ? { background: 'var(--accent-primary)', color: '#000' }
                : { background: 'var(--void-elevated)', border: '1px solid var(--glass-border)', color: 'rgba(255,255,255,0.6)' }
            }
          >
            {sf.label}
          </button>
        ))}

        <div className="w-px h-6 bg-white/10 mx-1" />

        <button
          onClick={() => setHighValueOnly(!highValueOnly)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-all"
          style={
            highValueOnly
              ? { background: '#00FF0020', border: '1px solid #00FF0040', color: '#00FF00' }
              : { background: 'var(--void-elevated)', border: '1px solid var(--glass-border)', color: 'rgba(255,255,255,0.6)' }
          }
        >
          <DollarSign size={14} />
          High Value
        </button>

        <div className="ml-auto flex items-center gap-2">
          <ArrowUpDown size={14} className="text-white/40" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 rounded-xl text-sm bg-transparent text-white/60"
            style={{ background: 'var(--void-elevated)', border: '1px solid var(--glass-border)' }}
          >
            <option value="date">Sort by Date</option>
            <option value="benefit">Sort by Benefit</option>
            <option value="confidence">Sort by Confidence</option>
          </select>
        </div>
      </div>

      {/* Findings List */}
      {displayFindings.length === 0 ? (
        <div
          className="p-12 rounded-2xl text-center"
          style={{ background: 'var(--void-elevated)', border: '1px solid var(--glass-border)' }}
        >
          <h3 className="text-lg font-light text-white/90 mb-2">
            {findings.length === 0 ? 'No Findings Yet' : 'No Matching Findings'}
          </h3>
          <p className="text-sm text-white/60 max-w-md mx-auto">
            {findings.length === 0
              ? 'Run a forensic audit and generate findings to see items here.'
              : 'Try adjusting your filters to see more results.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              workflowArea={workflowArea}
              onApprove={onApprove}
              onReject={onReject}
              onDefer={onDefer}
            />
          ))}
        </div>
      )}
    </>
  )
}
