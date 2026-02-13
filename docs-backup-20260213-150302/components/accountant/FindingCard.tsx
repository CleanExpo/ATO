/**
 * Finding Card Component
 *
 * Displays an individual tax finding with:
 * - Transaction details
 * - AI recommendation
 * - Confidence scoring
 * - Legislation references
 * - Approval/rejection actions
 */

'use client'

import { useState } from 'react'
import { Check, X, Clock, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import { ConfidenceBadge } from './ConfidenceBadge'
import { LegislationLink, LegislationBadge } from './LegislationLink'

export interface Finding {
  id: string
  transactionId: string
  date: string
  description: string
  amount: number
  currentClassification?: string
  suggestedClassification?: string
  suggestedAction?: string
  confidence: {
    score: number
    level: 'High' | 'Medium' | 'Low'
    factors?: Array<{
      factor: string
      impact: 'positive' | 'negative'
      weight: number
    }>
  }
  legislationRefs: Array<{
    section: string
    title: string
    url: string
  }>
  reasoning: string
  financialYear: string
  estimatedBenefit?: number
  status: 'pending' | 'approved' | 'rejected' | 'deferred'
}

interface FindingCardProps {
  finding: Finding
  workflowArea: 'sundries' | 'deductions' | 'fbt' | 'div7a' | 'documents' | 'reconciliation'
  onApprove?: (findingId: string) => Promise<void>
  onReject?: (findingId: string, reason: string) => Promise<void>
  onDefer?: (findingId: string) => Promise<void>
}

export function FindingCard({
  finding,
  workflowArea,
  onApprove,
  onReject,
  onDefer,
}: FindingCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleApprove = async () => {
    if (!onApprove) return
    setIsProcessing(true)
    try {
      await onApprove(finding.id)
    } catch (error) {
      console.error('Failed to approve finding:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!onReject) return
    if (!showRejectInput) {
      setShowRejectInput(true)
      return
    }
    setIsProcessing(true)
    try {
      await onReject(finding.id, rejectReason)
      setShowRejectInput(false)
      setRejectReason('')
    } catch (error) {
      console.error('Failed to reject finding:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDefer = async () => {
    if (!onDefer) return
    setIsProcessing(true)
    try {
      await onDefer(finding.id)
    } catch (error) {
      console.error('Failed to defer finding:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Status badge color
  const getStatusColor = () => {
    switch (finding.status) {
      case 'approved':
        return '#00FF00'
      case 'rejected':
        return '#FF0080'
      case 'deferred':
        return '#FFFF00'
      default:
        return '#00D9FF'
    }
  }

  return (
    <div
      className="p-6 rounded-2xl transition-all duration-300"
      style={{
        background: 'var(--void-elevated)',
        border: '1px solid var(--glass-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          {/* Transaction Details */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-white/40 font-mono">{finding.transactionId}</span>
            <span className="text-xs text-white/40">{finding.date}</span>
            <span className="text-xs text-white/40">{finding.financialYear}</span>
            {finding.estimatedBenefit && finding.estimatedBenefit > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#00FF00]">
                <DollarSign size={12} />
                ${finding.estimatedBenefit.toLocaleString()} benefit
              </div>
            )}
          </div>

          <div className="text-base text-white/90 mb-2">{finding.description}</div>

          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>Amount:</span>
            <span className="font-medium text-white/80">
              ${Math.abs(finding.amount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className="px-3 py-1.5 rounded-xl text-xs font-medium flex-shrink-0"
          style={{
            background: `${getStatusColor()}15`,
            border: `1px solid ${getStatusColor()}30`,
            color: getStatusColor(),
          }}
        >
          {finding.status.charAt(0).toUpperCase() + finding.status.slice(1)}
        </div>
      </div>

      {/* Current vs Suggested */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {finding.currentClassification && (
          <div>
            <div className="text-xs text-white/40 mb-1">Current Classification</div>
            <div className="text-sm text-white/70">{finding.currentClassification}</div>
          </div>
        )}
        {finding.suggestedClassification && (
          <div>
            <div className="text-xs text-white/40 mb-1">AI Recommendation</div>
            <div className="text-sm text-white/90 font-medium">
              {finding.suggestedClassification}
            </div>
          </div>
        )}
        {finding.suggestedAction && !finding.suggestedClassification && (
          <div className="md:col-span-2">
            <div className="text-xs text-white/40 mb-1">AI Recommendation</div>
            <div className="text-sm text-white/90 font-medium">{finding.suggestedAction}</div>
          </div>
        )}
      </div>

      {/* Confidence Score */}
      <div className="mb-4">
        <ConfidenceBadge confidence={finding.confidence} showFactors={expanded} />
      </div>

      {/* Legislation References (Compact View) */}
      {!expanded && finding.legislationRefs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-xs text-white/40">Legislation:</span>
          {finding.legislationRefs.slice(0, 3).map((ref, idx) => (
            <LegislationBadge key={idx} reference={ref} />
          ))}
          {finding.legislationRefs.length > 3 && (
            <span className="text-xs text-white/40">
              +{finding.legislationRefs.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="space-y-4 pt-4 border-t border-white/10 mb-4">
          {/* AI Reasoning */}
          <div>
            <div className="text-sm text-white/60 mb-2 font-medium">AI Reasoning</div>
            <div className="text-sm text-white/70 leading-relaxed">{finding.reasoning}</div>
          </div>

          {/* Legislation References (Full View) */}
          {finding.legislationRefs.length > 0 && (
            <div>
              <div className="text-sm text-white/60 mb-2 font-medium">
                Legislation References
              </div>
              <LegislationLink references={finding.legislationRefs} />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs text-white/60 hover:text-white/90 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp size={14} />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              Show Details
            </>
          )}
        </button>

        {/* Approval Actions */}
        {finding.status === 'pending' && (
          <div className="flex items-center gap-2 flex-wrap">
            {showRejectInput && (
              <div className="flex items-center gap-2 w-full mb-2">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection (optional)"
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-transparent text-white/90 placeholder:text-white/30"
                  style={{ border: '1px solid #FF008040' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleReject() }}
                />
                <button
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
                  style={{ background: '#FF008030', color: '#FF0080' }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70"
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              onClick={handleDefer}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: '#FFFF0015',
                border: '1px solid #FFFF0030',
                color: '#FFFF00',
              }}
            >
              <Clock size={14} />
              Defer
            </button>
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: '#FF008015',
                border: '1px solid #FF008030',
                color: '#FF0080',
              }}
            >
              <X size={14} />
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: '#00FF0015',
                border: '1px solid #00FF0030',
                color: '#00FF00',
              }}
            >
              <Check size={14} />
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
