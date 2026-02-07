'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { AccessibleChart } from '@/components/ui/AccessibleChart'
import {
  INDIVIDUAL_BRACKETS_FY2024_25,
  calculateTax,
  type TaxBracketSet,
} from '@/lib/tax-visualisation/brackets'

interface DeductionImpactCalculatorProps {
  /** Initial gross income */
  defaultIncome?: number
  /** Initial deduction amount */
  defaultDeduction?: number
  bracketSet?: TaxBracketSet
  className?: string
}

/**
 * DeductionImpactCalculator - Interactive before/after deduction comparison
 *
 * Users adjust income and deduction amounts to see real-time impact on:
 * - Taxable income
 * - Tax payable
 * - Effective rate
 * - Tax saved
 *
 * Uses aria-live for screen reader updates on calculation changes.
 */
export function DeductionImpactCalculator({
  defaultIncome = 120_000,
  defaultDeduction = 15_000,
  bracketSet = INDIVIDUAL_BRACKETS_FY2024_25,
  className = '',
}: DeductionImpactCalculatorProps) {
  const [income, setIncome] = useState(defaultIncome)
  const [deduction, setDeduction] = useState(defaultDeduction)

  const before = useMemo(() => calculateTax(income, bracketSet), [income, bracketSet])
  const after = useMemo(() => calculateTax(income - deduction, bracketSet), [income, deduction, bracketSet])
  const taxSaved = before.taxPayable - after.taxPayable

  // Generate curve data for the area chart
  const curveData = useMemo(() => {
    const points = []
    const max = Math.min(income + 20_000, 300_000)
    const step = Math.max(1000, Math.round(max / 50))
    for (let i = 0; i <= max; i += step) {
      const calc = calculateTax(i, bracketSet)
      points.push({
        income: i,
        incomeLabel: `$${(i / 1000).toFixed(0)}K`,
        taxPayable: calc.taxPayable,
        effectiveRate: calc.effectiveRate,
      })
    }
    return points
  }, [income, bracketSet])

  const formatAUD = (v: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(v)

  return (
    <div className={className}>
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <h3 className="typo-title" style={{ marginBottom: 'var(--space-xs)' }}>
          Deduction Impact Calculator
        </h3>
        <p className="typo-caption">
          {bracketSet.financialYear} &middot; See how deductions reduce your tax
        </p>
        <span className="estimate-label" style={{ marginTop: 'var(--space-xs)' }}>
          ESTIMATE
        </span>
      </div>

      {/* Input controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <div>
          <label htmlFor="calc-income" className="typo-label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
            Gross Income
          </label>
          <input
            id="calc-income"
            type="number"
            value={income}
            onChange={(e) => setIncome(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            max={1_000_000}
            step={1000}
            aria-label="Gross income amount in dollars"
          />
        </div>
        <div>
          <label htmlFor="calc-deduction" className="typo-label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
            Deduction Amount
          </label>
          <input
            id="calc-deduction"
            type="number"
            value={deduction}
            onChange={(e) => setDeduction(Math.max(0, Math.min(income, parseInt(e.target.value) || 0)))}
            min={0}
            max={income}
            step={500}
            aria-label="Deduction amount in dollars"
          />
        </div>
      </div>

      {/* Deduction slider */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <label htmlFor="calc-slider" className="sr-only">
          Adjust deduction amount
        </label>
        <input
          id="calc-slider"
          type="range"
          min={0}
          max={income}
          step={500}
          value={deduction}
          onChange={(e) => setDeduction(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
          aria-label={`Deduction slider: ${formatAUD(deduction)}`}
          aria-valuemin={0}
          aria-valuemax={income}
          aria-valuenow={deduction}
        />
      </div>

      {/* Results - announced to screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="bento-grid bento-grid--stats"
        style={{ marginBottom: 'var(--space-lg)' }}
      >
        <div className="stat-card">
          <span className="stat-card__label">Before Deduction</span>
          <span className="stat-card__value" aria-label={`Tax before deduction: ${formatAUD(before.taxPayable)}`}>
            {formatAUD(before.taxPayable)}
          </span>
          <span className="stat-card__trend" style={{ background: 'var(--bg-card)', color: 'var(--text-tertiary)' }}>
            Effective: {before.effectiveRate}%
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">After Deduction</span>
          <span className="stat-card__value" style={{ color: 'var(--color-success)' }} aria-label={`Tax after deduction: ${formatAUD(after.taxPayable)}`}>
            {formatAUD(after.taxPayable)}
          </span>
          <span className="stat-card__trend stat-card__trend--up">
            Effective: {after.effectiveRate}%
          </span>
        </div>
        <div className="stat-card accent">
          <span className="stat-card__label">Tax Saved</span>
          <span className="stat-card__value" style={{ color: 'var(--color-success)' }} aria-label={`Estimated tax saved: ${formatAUD(taxSaved)}`}>
            {formatAUD(taxSaved)}
          </span>
          <span className="estimate-label">ESTIMATE</span>
        </div>
      </div>

      {/* Tax curve chart */}
      <AccessibleChart
        label={`Tax payable curve showing impact of ${formatAUD(deduction)} deduction on ${formatAUD(income)} income. Tax saved: ${formatAUD(taxSaved)}.`}
        data={[
          { label: 'Before deduction', income: formatAUD(income), tax: formatAUD(before.taxPayable), effectiveRate: `${before.effectiveRate}%` },
          { label: 'After deduction', income: formatAUD(income - deduction), tax: formatAUD(after.taxPayable), effectiveRate: `${after.effectiveRate}%` },
          { label: 'Tax saved', income: '', tax: formatAUD(taxSaved), effectiveRate: '' },
        ]}
        columns={[
          { key: 'label', label: 'Scenario' },
          { key: 'income', label: 'Taxable Income' },
          { key: 'tax', label: 'Tax Payable' },
          { key: 'effectiveRate', label: 'Effective Rate' },
        ]}
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={curveData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-light)"
              vertical={false}
            />
            <XAxis
              dataKey="income"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-light)' }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
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
              formatter={(value: number | undefined) => [formatAUD(value ?? 0), 'Tax payable']}
              labelFormatter={(v) => `Income: $${(Number(v) / 1000).toFixed(0)}K`}
            />
            <defs>
              <linearGradient id="taxGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="taxPayable"
              stroke="var(--accent-primary)"
              fill="url(#taxGradient)"
              strokeWidth={2}
            />
            {/* Before deduction marker */}
            <ReferenceLine
              x={income}
              stroke="var(--color-error)"
              strokeDasharray="4 4"
              label={{
                value: 'Before',
                position: 'top',
                fill: 'var(--color-error)',
                fontSize: 10,
              }}
            />
            {/* After deduction marker */}
            <ReferenceLine
              x={income - deduction}
              stroke="var(--color-success)"
              strokeDasharray="4 4"
              label={{
                value: 'After',
                position: 'top',
                fill: 'var(--color-success)',
                fontSize: 10,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </div>
  )
}
