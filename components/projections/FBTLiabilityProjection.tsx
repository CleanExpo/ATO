'use client'

import { OffsetMeter } from './OffsetMeter'

interface FBTLiabilityProjectionProps {
  /** Total FBT liability */
  totalLiability: number
  /** Estimated FBT payable */
  estimatedPayable: number
  /** FBT year label */
  fbtYear?: string
  /** Confidence level */
  confidence?: number
  className?: string
}

const FBT_RATE = 0.47
const LEGISLATION_REF = 'FBTAA 1986'

/**
 * FBTLiabilityProjection - FBT liability gauge at 47% rate
 *
 * Shows projected FBT liability with rate information.
 */
export function FBTLiabilityProjection({
  totalLiability,
  estimatedPayable,
  fbtYear = 'FBT2024-25',
  confidence,
  className = '',
}: FBTLiabilityProjectionProps) {
  return (
    <div className={className}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <div>
          <h4 className="typo-title">FBT Liability</h4>
          <p className="typo-caption">{LEGISLATION_REF} &middot; {fbtYear} &middot; {(FBT_RATE * 100)}% rate</p>
        </div>
        <span className="estimate-label">PROJECTED</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)' }}>
        <OffsetMeter
          value={estimatedPayable}
          max={totalLiability}
          label="FBT Payable"
          format="currency"
          size="md"
        />

        <div className="layout-stack" style={{ flex: 1 }}>
          <div className="data-strip" style={{ borderLeftColor: 'var(--color-warning)' }}>
            <div className="data-strip__label">
              <span className="typo-label">Total Taxable Value</span>
            </div>
            <div className="data-strip__metric">
              <span className="typo-data">${totalLiability.toLocaleString('en-AU')}</span>
            </div>
          </div>

          <div className="data-strip" style={{ borderLeftColor: 'var(--color-error)' }}>
            <div className="data-strip__label">
              <span className="typo-label">FBT Rate</span>
            </div>
            <div className="data-strip__metric">
              <span className="typo-data">{(FBT_RATE * 100)}%</span>
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
