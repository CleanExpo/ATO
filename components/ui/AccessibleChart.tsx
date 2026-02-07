'use client'

import { ReactNode } from 'react'

interface ChartColumn {
  key: string
  label: string
  format?: (value: unknown) => string
}

interface AccessibleChartProps {
  /** Descriptive label for screen readers */
  label: string
  /** Chart content (Recharts component) */
  children: ReactNode
  /** Data array for the hidden accessible table */
  data: Record<string, unknown>[]
  /** Column definitions for the accessible table */
  columns: ChartColumn[]
  /** Optional className */
  className?: string
}

function formatCurrency(value: unknown): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return String(value)
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function formatPercent(value: unknown): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return String(value)
  return `${num}%`
}

/**
 * AccessibleChart - Wrapper for Recharts with WCAG 2.1 AA compliance
 *
 * Provides:
 * - role="img" with descriptive aria-label on chart container
 * - Hidden <table> with screen reader content (.sr-only)
 * - Proper <th scope> and <caption> for accessible data table
 *
 * @example
 * <AccessibleChart
 *   label="Individual tax brackets for FY2024-25"
 *   data={bracketData}
 *   columns={[
 *     { key: 'bracket', label: 'Income Range' },
 *     { key: 'rate', label: 'Tax Rate', format: formatPercent },
 *   ]}
 * >
 *   <BarChart data={bracketData}>...</BarChart>
 * </AccessibleChart>
 */
export function AccessibleChart({
  label,
  children,
  data,
  columns,
  className = '',
}: AccessibleChartProps) {
  return (
    <div className={className}>
      {/* Visual chart */}
      <div role="img" aria-label={label}>
        {children}
      </div>

      {/* Screen reader accessible data table */}
      <div className="sr-only">
        <table role="table">
          <caption>{label}</caption>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col) => {
                  const value = row[col.key]
                  const formatted = col.format ? col.format(value) : String(value ?? '')
                  return <td key={col.key}>{formatted}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export { formatCurrency, formatPercent }
