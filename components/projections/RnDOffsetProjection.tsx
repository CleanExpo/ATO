'use client'

import { OffsetMeter } from './OffsetMeter'

interface RnDOffsetProjectionProps {
  /** Eligible R&D expenditure */
  eligibleExpenditure: number
  /** Calculated offset (typically 43.5% of expenditure) */
  offsetAmount: number
  /** Maximum offset available (turnover-dependent) */
  maxOffset: number
  /** Confidence level from analysis */
  confidence?: number
  className?: string
}

const RND_OFFSET_RATE = 0.435
const LEGISLATION_REF = 'Division 355 ITAA 1997'

/**
 * RnDOffsetProjection - R&D Tax Incentive offset gauge
 *
 * Shows 43.5% refundable offset for entities with turnover < $20M.
 */
export function RnDOffsetProjection({
  eligibleExpenditure,
  offsetAmount,
  maxOffset,
  confidence,
  className = '',
}: RnDOffsetProjectionProps) {
  return (
    <div className={className}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <div>
          <h4 className="typo-title">R&D Tax Offset</h4>
          <p className="typo-caption">{LEGISLATION_REF} &middot; {(RND_OFFSET_RATE * 100).toFixed(1)}% refundable offset</p>
        </div>
        <span className="estimate-label">PROJECTED</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)' }}>
        <OffsetMeter
          value={offsetAmount}
          max={maxOffset}
          label="R&D Offset"
          format="currency"
          size="lg"
        />

        <div className="layout-stack" style={{ flex: 1 }}>
          <div className="data-strip" style={{ borderLeftColor: 'var(--accent-primary)' }}>
            <div className="data-strip__label">
              <span className="typo-label">Eligible Expenditure</span>
            </div>
            <div className="data-strip__metric">
              <span
                className="typo-data"
                aria-label={`Eligible R&D expenditure: ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(eligibleExpenditure)}`}
              >
                ${eligibleExpenditure.toLocaleString('en-AU')}
              </span>
            </div>
          </div>

          <div className="data-strip" style={{ borderLeftColor: 'var(--color-success)' }}>
            <div className="data-strip__label">
              <span className="typo-label">Offset Rate</span>
            </div>
            <div className="data-strip__metric">
              <span className="typo-data">{(RND_OFFSET_RATE * 100).toFixed(1)}%</span>
            </div>
          </div>

          {confidence !== undefined && (
            <div className="data-strip" style={{ borderLeftColor: 'var(--color-info)' }}>
              <div className="data-strip__label">
                <span className="typo-label">Analysis Confidence</span>
              </div>
              <div className="data-strip__metric">
                <span className="typo-data">{confidence}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
