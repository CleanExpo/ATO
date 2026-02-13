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
  Cell,
} from 'recharts'
import { AccessibleChart } from '@/components/ui/AccessibleChart'
import {
  INDIVIDUAL_BRACKETS_FY2024_25,
  generateWaterfallData,
  type TaxBracketSet,
} from '@/lib/tax-visualisation/brackets'

interface TaxBracketWaterfallProps {
  bracketSet?: TaxBracketSet
  className?: string
}

const BRACKET_COLOURS = [
  'var(--color-success)',    // 0% - green
  'var(--color-info)',       // 16% - cyan
  'var(--accent-primary)',   // 30% - blue-cyan
  'var(--color-warning)',    // 37% - amber
  'var(--color-error)',      // 45% - red
]

/**
 * TaxBracketWaterfall - Individual tax bracket marginal rate chart
 *
 * Shows each bracket as a bar with marginal rate, plus effective rate annotation.
 * Includes explanatory text distinguishing marginal from effective rates.
 */
export function TaxBracketWaterfall({
  bracketSet = INDIVIDUAL_BRACKETS_FY2024_25,
  className = '',
}: TaxBracketWaterfallProps) {
  const data = useMemo(() => generateWaterfallData(bracketSet), [bracketSet])

  const columns = [
    { key: 'rangeLabel', label: 'Income Range' },
    { key: 'rate', label: 'Marginal Rate (%)' },
    { key: 'effectiveRate', label: 'Effective Rate (%)' },
  ]

  return (
    <div className={className}>
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <h3 className="typo-title" style={{ marginBottom: 'var(--space-xs)' }}>
          Individual Tax Brackets
        </h3>
        <p className="typo-caption">{bracketSet.financialYear} &middot; {bracketSet.source}</p>
      </div>

      {/* Marginal vs Effective rate explanation */}
      <div
        className="alert alert--info"
        style={{ marginBottom: 'var(--space-md)', fontSize: '0.75rem' }}
        role="note"
      >
        <strong>Marginal rate</strong> is the tax rate on your last dollar of income.{' '}
        <strong>Effective rate</strong> is the average rate across all your income.
        They are different values.
      </div>

      <AccessibleChart
        label={`Individual tax bracket marginal rates for ${bracketSet.financialYear}. Rates range from 0% on income up to $18,200 to 45% on income above $190,000.`}
        data={data}
        columns={columns}
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-light)"
              vertical={false}
            />
            <XAxis
              dataKey="rangeLabel"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-light)' }}
            />
            <YAxis
              tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-light)' }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 50]}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-subtle)',
                border: '0.5px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
              }}
              formatter={(value: number | undefined, name?: string) => {
                const v = value ?? 0
                if (name === 'rate') return [`${v}%`, 'Marginal Rate']
                return [v, name ?? '']
              }}
              labelFormatter={(label) => `Income range: ${label}`}
            />
            <Bar dataKey="rate" radius={[2, 2, 0, 0]} maxBarSize={60}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={BRACKET_COLOURS[index] || BRACKET_COLOURS[BRACKET_COLOURS.length - 1]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </AccessibleChart>

      {/* Bracket details */}
      <div className="layout-stack" style={{ marginTop: 'var(--space-md)' }}>
        {bracketSet.brackets.map((bracket, i) => (
          <div
            key={i}
            className="data-strip"
            style={{ borderLeftColor: BRACKET_COLOURS[i] }}
          >
            <div className="data-strip__label">
              <span className="typo-label">{bracket.label}</span>
            </div>
            <div className="data-strip__value">
              <span className="typo-data" style={{ color: BRACKET_COLOURS[i] }}>
                {(bracket.rate * 100).toFixed(0)}%
              </span>
              <span className="typo-caption" style={{ marginLeft: 'var(--space-sm)' }}>
                marginal rate
              </span>
            </div>
            <div className="data-strip__metric">
              <span className="typo-caption">{bracket.legislativeRef}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
