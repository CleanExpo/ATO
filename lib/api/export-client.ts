/**
 * Export Client
 *
 * Client-side library for exporting analysis results.
 * Handles API calls and browser downloads.
 */

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

export interface ExportResult {
  success: boolean
  filename?: string
  error?: string
}

// ─── Download Helper ─────────────────────────────────────────────────

/**
 * Trigger browser download from a Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Get content type for export format
 */
function _getContentType(format: ExportOptions['format']): string {
  switch (format) {
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'pdf':
      return 'application/pdf'
    case 'csv-zip':
    case 'all':
      return 'application/zip'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Get file extension for export format
 */
function getFileExtension(format: ExportOptions['format']): string {
  switch (format) {
    case 'excel':
      return 'xlsx'
    case 'pdf':
      return 'pdf'
    case 'csv-zip':
    case 'all':
      return 'zip'
    default:
      return 'bin'
  }
}

// ─── Export Functions ────────────────────────────────────────────────

/**
 * Export to Excel format
 */
export async function exportToExcel(
  tenantId: string,
  options: Omit<ExportOptions, 'format'>
): Promise<ExportResult> {
  return exportWithFormat(tenantId, { ...options, format: 'excel' })
}

/**
 * Export to PDF format
 */
export async function exportToPDF(
  tenantId: string,
  options: Omit<ExportOptions, 'format'>
): Promise<ExportResult> {
  return exportWithFormat(tenantId, { ...options, format: 'pdf' })
}

/**
 * Export to CSV ZIP format
 */
export async function exportToCSVZip(
  tenantId: string,
  options: Omit<ExportOptions, 'format'>
): Promise<ExportResult> {
  return exportWithFormat(tenantId, { ...options, format: 'csv-zip' })
}

/**
 * Export all formats as ZIP
 */
export async function exportAllFormats(
  tenantId: string,
  options: Omit<ExportOptions, 'format'>
): Promise<ExportResult> {
  return exportWithFormat(tenantId, { ...options, format: 'all' })
}

/**
 * Generic export function
 */
export async function exportWithFormat(
  tenantId: string,
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const response = await fetch('/api/audit/reports/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId,
        ...options,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Export failed with status ${response.status}`)
    }

    // Get filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = `Export_${options.organizationName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.${getFileExtension(options.format)}`

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '')
      }
    }

    // Get blob and trigger download
    const blob = await response.blob()
    downloadBlob(blob, filename)

    return {
      success: true,
      filename,
    }
  } catch (error) {
    console.error('Export failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    }
  }
}

// ─── Quick Export Functions ──────────────────────────────────────────

/**
 * Quick export all transactions as Excel
 */
export async function quickExportExcel(
  tenantId: string,
  organizationName: string,
  abn: string
): Promise<ExportResult> {
  return exportToExcel(tenantId, {
    scope: 'all',
    include: {
      rndCandidates: true,
      highValueDeductions: true,
      fbtItems: true,
      div7aItems: true,
      summaryStats: true,
    },
    organizationName,
    abn,
  })
}

/**
 * Quick export R&D report as PDF
 */
export async function quickExportRndPDF(
  tenantId: string,
  organizationName: string,
  abn: string
): Promise<ExportResult> {
  return exportToPDF(tenantId, {
    scope: 'filtered',
    filters: { isRndCandidate: true },
    include: {
      rndCandidates: true,
      highValueDeductions: false,
      fbtItems: false,
      div7aItems: false,
      summaryStats: true,
    },
    organizationName,
    abn,
  })
}

/**
 * Quick export accountant package as ZIP
 */
export async function quickExportAccountantPackage(
  tenantId: string,
  organizationName: string,
  abn: string
): Promise<ExportResult> {
  return exportAllFormats(tenantId, {
    scope: 'all',
    include: {
      rndCandidates: true,
      highValueDeductions: true,
      fbtItems: true,
      div7aItems: true,
      summaryStats: true,
    },
    organizationName,
    abn,
  })
}
