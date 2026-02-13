'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { AccessibleChart } from '@/components/ui/AccessibleChart'
import { COMPANY_RATES_FY2024_25 } from '@/lib/tax-visualisation/brackets'

interface CompanyRateComparisonProps {
  /** Taxable income amounts to compare */
  incomeAmounts?: number[]
  className?: string
}

const DEFAULT_INCOMES = [100_000, 250_000, 500_000, 1_000_000]

/**
 * CompanyRateComparison - Base rate (25%) vs standard rate (30%) comparison
 *
 * Shows grouped bars comparing tax payable under each rate for
 * different income levels.
 */
export function CompanyRateComparison({
  incomeAmounts = DEFAULT_INCOMES,
  className = '',
}: CompanyRateComparisonProps) {
  const rates = COMPANY_RATES_FY2024_25

  const data = useMemo(() =>
    incomeAmounts.map((income) => ({
      income,
      incomeLabel: `$${(income / 1000).toFixed(0)}K`,
      baseRateTax: Math.round(income * rates.baseRate.rate),
      standardRateTax: Math.round(income * rates.standardRate.rate),
      saving: Math.round(income * (rates.standardRate.rate - rates.baseRate.rate)),
    })),
    [incomeAmounts, rates]
  )

  const columns = [
    { key: 'incomeLabel', label: 'Taxable Income' },
    {
      key: 'baseRateTax',
      label: 'Tax at 25%',
      format: (v: unknown) => `$${Number(v).toLocaleString('en-AU')}`,
    },
    {
      key: 'standardRateTax',
      label: 'Tax at 30%',
      format: (v: unknown) => `$${Number(v).toLocaleString('en-AU')}`,
    },
    {
      key: 'saving',
      label: 'Saving with Base Rate',
      format: (v: unknown) => `$${Number(v).toLocaleString('en-AU')}`,
    },
  ]

  return (
    <div className={className}>
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <h3 className="typo-title" style={{ marginBottom: 'var(--space-xs)' }}>
          Company Tax Rate Comparison
        </h3>
        <p className="typo-caption">
          {rates.financialYear} &middot; {rates.source}
        </p>
      </div>

      {/* Eligibility note */}
      <div
        className="alert alert--info"
        style={{ marginBottom: 'var(--space-md)', fontSize: '0.75rem' }}
        role="note"
      >
        <strong>Base rate entity</strong> (25%): Aggregated turnover under $50M and no more than
        80% of assessable income is base rate entity passive income.{' '}
        <span className="typo-caption">{rates.baseRate.legislativeRef}</span>
      </div>

      <AccessibleChart
        label={`Company tax comparison for ${rates.financialYear}. Base rate entities pay 25% while standard rate is 30%.`}
        data={data}
        columns={columns}
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-light)"
              vertical={false}
            />
            <XAxis
              dataKey="incomeLabel"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-light)' }}
            />
            <YAxis
              tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-light)' }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-subtle)',
                border: '0.5px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
              }}
              formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString('en-AU')}`, '']}
              labelFormatter={(label) => `Taxable income: ${label}`}
            />
            <Legend
              wrapperStyle={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}
            />
            <Bar
              dataKey="baseRateTax"
              name="Base rate (25%)"
              fill="var(--color-success)"
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="standardRateTax"
              name="Standard rate (30%)"
              fill="var(--color-warning)"
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </div>
  )
}
