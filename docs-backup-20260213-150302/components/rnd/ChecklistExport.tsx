'use client'

/**
 * ChecklistExport
 *
 * Export button with format options for downloading the
 * R&D claim preparation checklist as CSV.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive claim preparation.
 */

import { useState } from 'react'

interface ChecklistExportProps {
  tenantId: string
  registrationId?: string
  className?: string
}

export function ChecklistExport({
  tenantId,
  registrationId,
  className = '',
}: ChecklistExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        tenantId,
        format: 'csv',
      })

      if (registrationId) {
        params.set('registrationId', registrationId)
      }

      const response = await fetch(`/api/rnd/checklist/export?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      // Trigger file download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const filename =
        response.headers
          .get('Content-Disposition')
          ?.match(/filename="(.+)"/)?.[1] ?? `rnd_checklist_${tenantId}.csv`

      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-sm transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '0.5px solid rgba(255, 255, 255, 0.2)',
          color: 'var(--text-secondary)',
        }}
      >
        {isExporting ? (
          <>
            <div
              className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin"
            />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>Export CSV</span>
          </>
        )}
      </button>

      {error && (
        <span className="text-xs" style={{ color: '#FF4444' }}>
          {error}
        </span>
      )}
    </div>
  )
}

export default ChecklistExport
