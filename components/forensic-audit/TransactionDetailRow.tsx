/**
 * Transaction Detail Row Component
 *
 * Expandable row showing full analysis details for a transaction.
 * Scientific Luxury design with dark background and category-coloured accents.
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────────

export interface AnalysisResult {
  id: string
  transaction_id: string
  tenant_id: string
  financial_year: string | null
  transaction_amount: number
  transaction_date: string | null
  transaction_description: string | null
  supplier_name: string | null
  primary_category: string | null
  secondary_categories: string[] | null
  category_confidence: number | null
  is_rnd_candidate: boolean
  meets_div355_criteria: boolean
  rnd_activity_type: string | null
  rnd_confidence: number | null
  rnd_reasoning: string | null
  div355_outcome_unknown: boolean
  div355_systematic_approach: boolean
  div355_new_knowledge: boolean
  div355_scientific_method: boolean
  is_fully_deductible: boolean
  deduction_type: string | null
  claimable_amount: number | null
  deduction_restrictions: string[] | null
  deduction_confidence: number | null
  requires_documentation: boolean
  fbt_implications: boolean
  division7a_risk: boolean
  compliance_notes: string[] | null
  ai_model: string | null
  created_at: string
}

interface TransactionDetailRowProps {
  transaction: AnalysisResult
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
  categoryColour: string
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
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Component ───────────────────────────────────────────────────────

export function TransactionDetailRow({
  transaction,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  categoryColour,
}: TransactionDetailRowProps) {
  const txn = transaction

  // Four-element test for R&D
  const fourElementTest = [
    { key: 'outcomeUnknown', label: 'Outcome Unknown', met: txn.div355_outcome_unknown },
    { key: 'systematicApproach', label: 'Systematic Approach', met: txn.div355_systematic_approach },
    { key: 'newKnowledge', label: 'New Knowledge', met: txn.div355_new_knowledge },
    { key: 'scientificMethod', label: 'Scientific Method', met: txn.div355_scientific_method },
  ]

  const fourElementScore = fourElementTest.filter(e => e.met).length

  return (
    <>
      {/* Main Row */}
      <tr
        className={`border-b border-white/[0.03] transition-colors cursor-pointer ${
          isExpanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
        }`}
        onClick={onToggleExpand}
      >
        {/* Checkbox */}
        <td className="px-3 py-3 w-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation()
              onToggleSelect()
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-white/20 bg-transparent text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
          />
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-sm text-white/50 font-mono tabular-nums">
          {formatDate(txn.transaction_date)}
        </td>

        {/* Supplier */}
        <td className="px-4 py-3">
          <div className="max-w-[200px]">
            <p className="text-sm text-white/70 truncate">{txn.supplier_name || 'Unknown'}</p>
            <p className="text-[10px] text-white/30 truncate mt-0.5">
              {txn.transaction_description?.substring(0, 50) || '-'}
            </p>
          </div>
        </td>

        {/* Amount */}
        <td className="px-4 py-3 text-right font-mono tabular-nums">
          <span className={txn.transaction_amount >= 0 ? 'text-white/70' : 'text-red-400'}>
            {formatCurrency(Math.abs(txn.transaction_amount))}
          </span>
        </td>

        {/* Category */}
        <td className="px-4 py-3">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-[0.1em] border-[0.5px]"
            style={{
              borderColor: `${categoryColour}30`,
              color: categoryColour,
              backgroundColor: `${categoryColour}08`,
            }}
          >
            {txn.primary_category || 'Uncategorised'}
          </span>
        </td>

        {/* Confidence */}
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-12 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${txn.category_confidence || 0}%`,
                  backgroundColor: (txn.category_confidence || 0) >= 80 ? SPECTRAL.emerald :
                    (txn.category_confidence || 0) >= 60 ? SPECTRAL.amber : SPECTRAL.red
                }}
              />
            </div>
            <span className="text-[10px] text-white/40 tabular-nums w-8">
              {txn.category_confidence || 0}%
            </span>
          </div>
        </td>

        {/* R&D Indicator */}
        <td className="px-4 py-3 text-center">
          {txn.is_rnd_candidate ? (
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: `${SPECTRAL.magenta}15`,
                color: SPECTRAL.magenta,
                border: `0.5px solid ${SPECTRAL.magenta}40`
              }}
            >
              R
            </span>
          ) : (
            <span className="text-white/20">-</span>
          )}
        </td>

        {/* Deduction */}
        <td className="px-4 py-3">
          <span className="text-sm text-white/50">
            {txn.deduction_type || (txn.is_fully_deductible ? 'Full' : '-')}
          </span>
        </td>

        {/* Expand Indicator */}
        <td className="px-3 py-3 w-10">
          <motion.svg
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-4 h-4 text-white/30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </td>
      </tr>

      {/* Expanded Detail Row */}
      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={9} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASING.outExpo }}
                className="overflow-hidden"
              >
                <div
                  className="p-6 border-l-2"
                  style={{
                    backgroundColor: '#0a0a0f',
                    borderLeftColor: categoryColour,
                  }}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Column 1: Transaction Details */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-medium">
                        Transaction Details
                      </h4>

                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Full Description</p>
                          <p className="text-sm text-white/70">{txn.transaction_description || 'No description'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Transaction ID</p>
                            <p className="text-xs text-white/50 font-mono">{txn.transaction_id}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Financial Year</p>
                            <p className="text-xs text-white/50 font-mono">{txn.financial_year || '-'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Transaction Amount</p>
                            <p className="text-lg text-white/70 font-mono tabular-nums">
                              {formatCurrency(txn.transaction_amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Claimable Amount</p>
                            <p className="text-lg font-mono tabular-nums" style={{ color: SPECTRAL.emerald }}>
                              {txn.claimable_amount ? formatCurrency(txn.claimable_amount) : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: R&D Assessment (if applicable) */}
                    <div className="space-y-4">
                      {txn.is_rnd_candidate ? (
                        <>
                          <h4 className="text-[10px] uppercase tracking-[0.3em] font-medium" style={{ color: SPECTRAL.magenta }}>
                            R&D Assessment (Division 355)
                          </h4>

                          <div className="space-y-3">
                            {/* Four-Element Test */}
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">
                                Four-Element Test ({fourElementScore}/4)
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {fourElementTest.map((element) => (
                                  <div
                                    key={element.key}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-sm border-[0.5px]"
                                    style={{
                                      borderColor: element.met ? `${SPECTRAL.emerald}30` : 'rgba(255,255,255,0.06)',
                                      backgroundColor: element.met ? `${SPECTRAL.emerald}08` : 'transparent',
                                    }}
                                  >
                                    <span
                                      className="w-3 h-3 rounded-full flex items-center justify-center text-[8px]"
                                      style={{
                                        backgroundColor: element.met ? SPECTRAL.emerald : 'transparent',
                                        border: element.met ? 'none' : '1px solid rgba(255,255,255,0.2)',
                                        color: element.met ? '#000' : 'transparent',
                                      }}
                                    >
                                      {element.met ? '✓' : ''}
                                    </span>
                                    <span className={`text-[10px] ${element.met ? 'text-white/70' : 'text-white/30'}`}>
                                      {element.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* R&D Reasoning */}
                            {txn.rnd_reasoning && (
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">R&D Reasoning</p>
                                <p className="text-xs text-white/60 leading-relaxed">{txn.rnd_reasoning}</p>
                              </div>
                            )}

                            {/* Activity Type */}
                            {txn.rnd_activity_type && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Activity:</span>
                                <span
                                  className="px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-[0.1em] border-[0.5px]"
                                  style={{
                                    borderColor: `${SPECTRAL.magenta}30`,
                                    color: SPECTRAL.magenta,
                                    backgroundColor: `${SPECTRAL.magenta}08`,
                                  }}
                                >
                                  {txn.rnd_activity_type.replace('_', ' ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-medium">
                            Deduction Details
                          </h4>

                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Deductibility</p>
                                <span
                                  className="px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-[0.1em] border-[0.5px]"
                                  style={{
                                    borderColor: txn.is_fully_deductible ? `${SPECTRAL.emerald}30` : `${SPECTRAL.amber}30`,
                                    color: txn.is_fully_deductible ? SPECTRAL.emerald : SPECTRAL.amber,
                                    backgroundColor: txn.is_fully_deductible ? `${SPECTRAL.emerald}08` : `${SPECTRAL.amber}08`,
                                  }}
                                >
                                  {txn.is_fully_deductible ? 'Fully Deductible' : 'Partial / Review'}
                                </span>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Type</p>
                                <p className="text-xs text-white/50">{txn.deduction_type || 'General'}</p>
                              </div>
                            </div>

                            {txn.deduction_restrictions && txn.deduction_restrictions.length > 0 && (
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Restrictions</p>
                                <ul className="text-xs text-white/50 space-y-1">
                                  {txn.deduction_restrictions.map((r, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-amber-400 mt-1">!</span>
                                      <span>{r}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Legislative Reference</p>
                              <p className="text-xs text-white/50">
                                {txn.is_fully_deductible ? 'Section 8-1 ITAA 1997 (General Deduction)' : 'Review required'}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Column 3: Compliance Flags */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-medium">
                        Compliance & Flags
                      </h4>

                      <div className="space-y-3">
                        {/* Compliance Flags */}
                        <div className="space-y-2">
                          {txn.requires_documentation && (
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-sm border-[0.5px]"
                              style={{
                                borderColor: `${SPECTRAL.amber}30`,
                                backgroundColor: `${SPECTRAL.amber}08`,
                              }}
                            >
                              <svg className="w-4 h-4" style={{ color: SPECTRAL.amber }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-xs" style={{ color: SPECTRAL.amber }}>Documentation Required</span>
                            </div>
                          )}

                          {txn.fbt_implications && (
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-sm border-[0.5px]"
                              style={{
                                borderColor: `${SPECTRAL.amber}30`,
                                backgroundColor: `${SPECTRAL.amber}08`,
                              }}
                            >
                              <svg className="w-4 h-4" style={{ color: SPECTRAL.amber }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span className="text-xs" style={{ color: SPECTRAL.amber }}>FBT Implications</span>
                            </div>
                          )}

                          {txn.division7a_risk && (
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-sm border-[0.5px]"
                              style={{
                                borderColor: `${SPECTRAL.red}30`,
                                backgroundColor: `${SPECTRAL.red}08`,
                              }}
                            >
                              <svg className="w-4 h-4" style={{ color: SPECTRAL.red }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-xs" style={{ color: SPECTRAL.red }}>Division 7A Risk</span>
                            </div>
                          )}

                          {!txn.requires_documentation && !txn.fbt_implications && !txn.division7a_risk && (
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-sm border-[0.5px]"
                              style={{
                                borderColor: `${SPECTRAL.emerald}30`,
                                backgroundColor: `${SPECTRAL.emerald}08`,
                              }}
                            >
                              <svg className="w-4 h-4" style={{ color: SPECTRAL.emerald }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-xs" style={{ color: SPECTRAL.emerald }}>No Compliance Issues</span>
                            </div>
                          )}
                        </div>

                        {/* Compliance Notes */}
                        {txn.compliance_notes && txn.compliance_notes.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">Compliance Notes</p>
                            <ul className="text-xs text-white/50 space-y-1">
                              {txn.compliance_notes.map((note, i) => (
                                <li key={i} className="pl-3 border-l border-white/10">{note}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* AI Model */}
                        <div className="pt-3 border-t border-white/[0.06]">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/20">
                            Analysed by: {txn.ai_model || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}
