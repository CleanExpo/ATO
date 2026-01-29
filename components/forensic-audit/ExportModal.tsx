/**
 * Export Modal Component
 *
 * Modal for exporting analysis results in multiple formats (Excel, PDF, CSV ZIP).
 * Scientific Luxury design with OLED black overlay and spectral colours.
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────────

export interface ExportFilters {
  financialYear?: string
  isRndCandidate?: boolean
  primaryCategory?: string
  minConfidence?: number
}

export interface ExportOptions {
  format: 'excel' | 'pdf' | 'csv-zip' | 'all'
  scope: 'all' | 'filtered' | 'selected'
  filters?: ExportFilters
  selectedIds?: string[]
  include: {
    rndCandidates: boolean
    highValueDeductions: boolean
    fbtItems: boolean
    div7aItems: boolean
    summaryStats: boolean
  }
  organizationName: string
  abn: string
}

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  selectedTransactionIds?: string[]
  currentFilters?: ExportFilters
  defaultOrganizationName?: string
  defaultAbn?: string
  onExport: (options: ExportOptions) => Promise<void>
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

// ─── Breathing Orb ──────────────────────────────────────────────────

function BreathingOrb({ colour, size = 'sm' }: { colour: string; size?: 'xs' | 'sm' | 'md' }) {
  const sizes = { xs: 'h-5 w-5', sm: 'h-8 w-8', md: 'h-12 w-12' }
  const dotSizes = { xs: 'h-1.5 w-1.5', sm: 'h-2 w-2', md: 'h-3 w-3' }

  return (
    <motion.div
      className={`${sizes[size]} flex items-center justify-center rounded-full border-[0.5px]`}
      style={{
        borderColor: `${colour}50`,
        backgroundColor: `${colour}10`,
        boxShadow: `0 0 30px ${colour}40`,
      }}
    >
      <motion.div
        className={`${dotSizes[size]} rounded-full`}
        style={{ backgroundColor: colour }}
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

// ─── Component ───────────────────────────────────────────────────────

export function ExportModal({
  isOpen,
  onClose,
  tenantId,
  selectedTransactionIds = [],
  currentFilters,
  defaultOrganizationName = '',
  defaultAbn = '',
  onExport,
}: ExportModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Form state
  const [format, setFormat] = useState<ExportOptions['format']>('excel')
  const [scope, setScope] = useState<ExportOptions['scope']>(
    selectedTransactionIds.length > 0 ? 'selected' : currentFilters ? 'filtered' : 'all'
  )
  const [organizationName, setOrganizationName] = useState(defaultOrganizationName)
  const [abn, setAbn] = useState(defaultAbn)
  const [include, setInclude] = useState({
    rndCandidates: true,
    highValueDeductions: true,
    fbtItems: true,
    div7aItems: true,
    summaryStats: true,
  })

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<string>('')
  const [exportError, setExportError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setScope(selectedTransactionIds.length > 0 ? 'selected' : currentFilters ? 'filtered' : 'all')
      setOrganizationName(defaultOrganizationName)
      setAbn(defaultAbn)
      setExportError(null)
      setExportProgress('')
    }
  }, [isOpen, selectedTransactionIds.length, currentFilters, defaultOrganizationName, defaultAbn])

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        if (!isExporting) {
          onClose()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, isExporting, onClose])

  // Handle escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isExporting) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isExporting, onClose])

  // Handle export
  async function handleExport() {
    if (!organizationName.trim()) {
      setExportError('Organisation name is required')
      return
    }

    setIsExporting(true)
    setExportError(null)
    setExportProgress('Preparing export...')

    try {
      const options: ExportOptions = {
        format,
        scope,
        filters: scope === 'filtered' ? currentFilters : undefined,
        selectedIds: scope === 'selected' ? selectedTransactionIds : undefined,
        include,
        organizationName: organizationName.trim(),
        abn: abn.trim(),
      }

      setExportProgress(`Generating ${format.toUpperCase()} report...`)
      await onExport(options)
      setExportProgress('Download starting...')

      // Close modal after successful export
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      console.error('Export failed:', error)
      setExportError(error instanceof Error ? error.message : 'Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  // Toggle include option
  function toggleInclude(key: keyof typeof include) {
    setInclude((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const formatOptions = [
    { value: 'excel', label: 'Excel (.xlsx)', icon: '📊', colour: SPECTRAL.emerald },
    { value: 'pdf', label: 'PDF Report', icon: '📄', colour: SPECTRAL.cyan },
    { value: 'csv-zip', label: 'CSV ZIP', icon: '📦', colour: SPECTRAL.amber },
    { value: 'all', label: 'All Formats', icon: '📁', colour: SPECTRAL.magenta },
  ] as const

  const scopeOptions: Array<{
    value: 'all' | 'filtered' | 'selected'
    label: string
    count: number | null
    disabled?: boolean
  }> = [
    { value: 'all', label: 'All Transactions', count: null },
    { value: 'filtered', label: 'Current Filter', count: null, disabled: !currentFilters },
    { value: 'selected', label: 'Selected Only', count: selectedTransactionIds.length, disabled: selectedTransactionIds.length === 0 },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: EASING.outExpo }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-[0.5px] border-white/[0.1] rounded-sm"
            style={{ backgroundColor: '#0a0a0f' }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/[0.06]" style={{ backgroundColor: '#0a0a0f' }}>
              <div>
                <h2 className="text-xl font-light text-white">Export Analysis</h2>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mt-1">
                  Generate downloadable reports
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isExporting}
                className="p-2 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {formatOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormat(option.value)}
                      className="p-3 rounded-sm border-[0.5px] text-left transition-all"
                      style={{
                        borderColor: format === option.value ? `${option.colour}40` : 'rgba(255,255,255,0.06)',
                        backgroundColor: format === option.value ? `${option.colour}10` : 'transparent',
                      }}
                    >
                      <div className="text-lg mb-1">{option.icon}</div>
                      <div
                        className="text-xs font-medium"
                        style={{ color: format === option.value ? option.colour : 'rgba(255,255,255,0.5)' }}
                      >
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope Selection */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
                  Export Scope
                </label>
                <div className="flex flex-wrap gap-2">
                  {scopeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => !option.disabled && setScope(option.value)}
                      disabled={option.disabled}
                      className="px-4 py-2 rounded-sm border-[0.5px] text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        borderColor: scope === option.value ? `${SPECTRAL.cyan}40` : 'rgba(255,255,255,0.06)',
                        backgroundColor: scope === option.value ? `${SPECTRAL.cyan}10` : 'transparent',
                        color: scope === option.value ? SPECTRAL.cyan : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {option.label}
                      {option.count !== null && option.count > 0 && (
                        <span className="ml-1 font-mono">({option.count})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Include Options */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
                  Include in Report
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'rndCandidates', label: 'R&D Candidates', colour: SPECTRAL.magenta },
                    { key: 'highValueDeductions', label: 'High Value Deductions (>$500)', colour: SPECTRAL.emerald },
                    { key: 'fbtItems', label: 'FBT Review Items', colour: SPECTRAL.amber },
                    { key: 'div7aItems', label: 'Division 7A Items', colour: SPECTRAL.red },
                    { key: 'summaryStats', label: 'Summary Statistics', colour: SPECTRAL.cyan },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 p-3 rounded-sm border-[0.5px] cursor-pointer transition-all"
                      style={{
                        borderColor: include[item.key as keyof typeof include]
                          ? `${item.colour}30`
                          : 'rgba(255,255,255,0.06)',
                        backgroundColor: include[item.key as keyof typeof include]
                          ? `${item.colour}08`
                          : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={include[item.key as keyof typeof include]}
                        onChange={() => toggleInclude(item.key as keyof typeof include)}
                        className="w-4 h-4 rounded border-white/20 bg-transparent text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                      />
                      <span
                        className="text-sm"
                        style={{
                          color: include[item.key as keyof typeof include] ? item.colour : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Organisation Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
                    Organisation Name *
                  </label>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Enter organisation name"
                    className="w-full px-3 py-2 bg-transparent border-[0.5px] border-white/[0.1] rounded-sm text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-white/[0.2]"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
                    ABN
                  </label>
                  <input
                    type="text"
                    value={abn}
                    onChange={(e) => setAbn(e.target.value)}
                    placeholder="00 000 000 000"
                    className="w-full px-3 py-2 bg-transparent border-[0.5px] border-white/[0.1] rounded-sm text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-white/[0.2]"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  />
                </div>
              </div>

              {/* Error Message */}
              {exportError && (
                <div
                  className="p-3 rounded-sm border-[0.5px] text-sm"
                  style={{
                    borderColor: `${SPECTRAL.red}30`,
                    backgroundColor: `${SPECTRAL.red}08`,
                    color: SPECTRAL.red,
                  }}
                >
                  {exportError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 p-6 border-t border-white/[0.06] flex items-center justify-between gap-4" style={{ backgroundColor: '#0a0a0f' }}>
              {isExporting ? (
                <div className="flex items-center gap-3">
                  <BreathingOrb colour={SPECTRAL.cyan} size="xs" />
                  <span className="text-sm text-white/50">{exportProgress}</span>
                </div>
              ) : (
                <div className="text-[10px] text-white/30">
                  Report will be generated and downloaded automatically
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  disabled={isExporting}
                  className="px-4 py-2 text-[10px] uppercase tracking-[0.15em] border-[0.5px] border-white/[0.1] rounded-sm text-white/50 hover:text-white/70 hover:border-white/[0.2] disabled:opacity-30 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting || !organizationName.trim()}
                  className="px-6 py-2 text-[10px] uppercase tracking-[0.15em] rounded-sm font-medium flex items-center gap-2 disabled:opacity-30 transition-all hover:brightness-110"
                  style={{
                    backgroundColor: `${SPECTRAL.emerald}20`,
                    borderColor: `${SPECTRAL.emerald}40`,
                    color: SPECTRAL.emerald,
                    border: '0.5px solid',
                  }}
                >
                  {isExporting ? (
                    <>
                      <BreathingOrb colour={SPECTRAL.emerald} size="xs" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
