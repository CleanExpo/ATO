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
import { CGT_DISCOUNTS } from '@/lib/tax-visualisation/brackets'

interface CGTDiscountChartProps {
  /** Capital gain amount to visualise */
  capitalGain?: number
  className?: string
}

/**
 * CGTDiscountChart - CGT discount comparison across entity types
 *
 * Shows pre-discount vs post-discount capital gain for individuals (50%),
 * super funds (33.33%), and companies (0% discount).
 */
export function CGTDiscountChart({
  capitalGain = 100_000,
  className = '',
}: CGTDiscountChartProps) {
  const discounts = CGT_DISCOUNTS

  const data = useMemo(() => [
    {
      entity: 'Individual',
      fullGain: capitalGain,
      discountedGain: Math.round(capitalGain * (1 - discounts.individual.rate)),
      discount: Math.round(capitalGain * discounts.individual.rate),
      discountLabel: '50%',
      ref: discounts.individual.legislativeRef,
    },
    {
      entity: 'Super Fund',
      fullGain: capitalGain,
      discountedGain: Math.round(capitalGain * (1 - discounts.superFund.rate)),
      discount: Math.round(capitalGain * discounts.superFund.rate),
      discountLabel: '33.33%',
      ref: discounts.superFund.legislativeRef,
    },
    {
      entity: 'Company',
      fullGain: capitalGain,
      discountedGain: capitalGain,
      discount: 0,
      discountLabel: '0%',
      ref: discounts.company.legislativeRef,
    },
  ], [capitalGain, discounts])

  const columns = [
    { key: 'entity', label: 'Entity Type' },
    {
      key: 'fullGain',
      label: 'Full Capital Gain',
      format: (v: unknown) => `$${Number(v).toLocaleString('en-AU')}`,
    },
    { key: 'discountLabel', label: 'Discount Rate' },
    {
      key: 'discountedGain',
      label: 'Taxable Capital Gain',
      format: (v: unknown) => `$${Number(v).toLocaleString('en-AU')}`,
    },
  ]

  return (
    <div className={className}>
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <h3 className="typo-title" style={{ marginBottom: 'var(--space-xs)' }}>
          CGT Discount by Entity Type
        </h3>
        <p className="typo-caption">
          {discounts.financialYear} &middot; Assets held 12+ months &middot; {discounts.source}
        </p>
      </div>

      <div
        className="alert alert--info"
        style={{ marginBottom: 'var(--space-md)', fontSize: '0.75rem' }}
        role="note"
      >
        The CGT discount applies to assets held for at least 12 months before disposal.
        Companies are not eligible for the CGT discount.{' '}
        <span className="typo-caption">{discounts.individual.legislativeRef}</span>
      </div>

      <AccessibleChart
        label={`CGT discount comparison for a $${capitalGain.toLocaleString('en-AU')} capital gain. Individuals receive 50% discount, super funds 33.33%, companies receive no discount.`}
        data={data}
        columns={columns}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 20, left: 80, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-light)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-light)' }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
            />
            <YAxis
              dataKey="entity"
              type="category"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-light)' }}
              width={80}
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
            />
            <Legend
              wrapperStyle={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}
            />
            <Bar
              dataKey="discountedGain"
              name="Taxable gain (after discount)"
              fill="var(--color-warning)"
              radius={[0, 2, 2, 0]}
              maxBarSize={30}
            />
            <Bar
              dataKey="discount"
              name="Discount amount"
              fill="var(--color-success)"
              radius={[0, 2, 2, 0]}
              maxBarSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </div>
  )
}
