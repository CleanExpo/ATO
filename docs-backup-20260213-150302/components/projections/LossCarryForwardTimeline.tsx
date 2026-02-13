'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CheckCircle, XCircle } from 'lucide-react'
import { AccessibleChart } from '@/components/ui/AccessibleChart'

interface LossYear {
  financialYear: string
  lossAmount: number
  cotCompliant: boolean
  sbtCompliant: boolean
  utilised: number
  carried: number
}

interface LossCarryForwardTimelineProps {
  /** Loss data by financial year */
  years: LossYear[]
  className?: string
}

/**
 * LossCarryForwardTimeline - Multi-year loss carry-forward visualisation
 *
 * Shows carried losses over financial years with COT/SBT compliance indicators.
 * Uses icon + text for compliance (not colour alone).
 */
export function LossCarryForwardTimeline({
  years,
  className = '',
}: LossCarryForwardTimelineProps) {
  const chartData = years.map((y) => ({
    fy: y.financialYear,
    loss: y.lossAmount,
    carried: y.carried,
    utilised: y.utilised,
  }))

  const columns = [
    { key: 'fy', label: 'Financial Year' },
    {
      key: 'loss',
      label: 'Loss Amount',
      format: (v: unknown) => `$${Number(v).toLocaleString('en-AU')}`,
    },
    {
      key: 'carried',
      label: 'Carried Forward',
      format: (v: unknown) => `$${Number(v).toLocaleString('en-AU')}`,
    },
    {
      key: 'utilised',
      label: 'Utilised',
      format: (v: unknown) => `$${Number(v).toLocaleString('en-AU')}`,
    },
  ]

  return (
    <div className={className}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <div>
          <h4 className="typo-title">Loss Carry-Forward Timeline</h4>
          <p className="typo-caption">Subdivision 36-A ITAA 1997</p>
        </div>
        <span className="estimate-label">ESTIMATE</span>
      </div>

      {years.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>
          No loss data available. Connect your accounting platform to analyse carry-forward losses.
        </div>
      ) : (
        <>
          <AccessibleChart
            label={`Loss carry-forward timeline across ${years.length} financial years.`}
            data={chartData}
            columns={columns}
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-light)"
                  vertical={false}
                />
                <XAxis
                  dataKey="fy"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
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
                />
                <Line
                  type="monotone"
                  dataKey="carried"
                  stroke="var(--color-warning)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--color-warning)' }}
                  name="Carried forward"
                />
                <Line
                  type="monotone"
                  dataKey="utilised"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--color-success)' }}
                  name="Utilised"
                />
              </LineChart>
            </ResponsiveContainer>
          </AccessibleChart>

          {/* Compliance status per year */}
          <div className="layout-stack" style={{ marginTop: 'var(--space-md)' }}>
            {years.map((y, i) => (
              <div
                key={i}
                className="data-strip"
                style={{
                  borderLeftColor: y.cotCompliant && y.sbtCompliant
                    ? 'var(--compliance-ok)'
                    : 'var(--compliance-risk)',
                }}
              >
                <div className="data-strip__label">
                  <span className="typo-label">{y.financialYear}</span>
                </div>
                <div className="data-strip__value" style={{ display: 'flex', gap: 'var(--space-md)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem' }}>
                    {y.cotCompliant ? (
                      <CheckCircle size={12} className="compliance-ok" />
                    ) : (
                      <XCircle size={12} className="compliance-risk" />
                    )}
                    <span>COT {y.cotCompliant ? 'passed' : 'failed'}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem' }}>
                    {y.sbtCompliant ? (
                      <CheckCircle size={12} className="compliance-ok" />
                    ) : (
                      <XCircle size={12} className="compliance-risk" />
                    )}
                    <span>SBT {y.sbtCompliant ? 'passed' : 'failed'}</span>
                  </span>
                </div>
                <div className="data-strip__metric">
                  <span className="typo-data">${y.carried.toLocaleString('en-AU')}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
