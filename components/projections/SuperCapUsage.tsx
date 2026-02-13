'use client'

interface SuperCapUsageProps {
  /** Concessional contributions made */
  concessionalUsed: number
  /** Concessional cap ($30,000 for FY2024-25) */
  concessionalCap?: number
  /** Non-concessional contributions made */
  nonConcessionalUsed: number
  /** Non-concessional cap ($120,000 for FY2024-25) */
  nonConcessionalCap?: number
  className?: string
}

const CONCESSIONAL_CAP = 30_000
const NON_CONCESSIONAL_CAP = 120_000
const FY = 'FY2024-25'
const LEGISLATION_REF = 'ITAA 1997 Division 291'

function CapBar({
  label,
  used,
  cap,
  ariaLabel,
}: {
  label: string
  used: number
  cap: number
  ariaLabel: string
}) {
  const ratio = cap > 0 ? Math.min(used / cap, 1) : 0
  const colour = ratio < 0.7
    ? 'var(--compliance-ok)'
    : ratio < 0.9
    ? 'var(--compliance-warn)'
    : 'var(--compliance-risk)'
  const statusText = ratio < 0.7 ? 'OK' : ratio < 0.9 ? 'Approaching cap' : 'Near/at cap'

  return (
    <div
      role="meter"
      aria-valuenow={used}
      aria-valuemin={0}
      aria-valuemax={cap}
      aria-label={ariaLabel}
      style={{ marginBottom: 'var(--space-md)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
        <span className="typo-label">{label}</span>
        <span className="typo-data" style={{ fontSize: '0.75rem' }}>
          ${used.toLocaleString('en-AU')} / ${cap.toLocaleString('en-AU')}
        </span>
      </div>
      <div className="progress-bar" style={{ height: '8px' }}>
        <div
          className="progress-bar__fill"
          style={{
            width: `${ratio * 100}%`,
            background: colour,
            transition: 'width 0.6s ease, background 0.3s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <span
          className="compliance-badge"
          style={{
            background: ratio < 0.7 ? 'var(--compliance-ok-dim)' : ratio < 0.9 ? 'var(--compliance-warn-dim)' : 'var(--compliance-risk-dim)',
            color: colour,
          }}
        >
          {statusText}
        </span>
        <span className="typo-caption">{(ratio * 100).toFixed(0)}% used</span>
      </div>
    </div>
  )
}

/**
 * SuperCapUsage - Superannuation contribution cap indicators
 *
 * Shows concessional ($30K) and non-concessional ($120K) cap usage
 * with progress bars and status indicators.
 */
export function SuperCapUsage({
  concessionalUsed,
  concessionalCap = CONCESSIONAL_CAP,
  nonConcessionalUsed,
  nonConcessionalCap = NON_CONCESSIONAL_CAP,
  className = '',
}: SuperCapUsageProps) {
  return (
    <div className={className}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <div>
          <h4 className="typo-title">Superannuation Cap Usage</h4>
          <p className="typo-caption">{LEGISLATION_REF} &middot; {FY}</p>
        </div>
        <span className="estimate-label">ESTIMATE</span>
      </div>

      <CapBar
        label="Concessional Contributions"
        used={concessionalUsed}
        cap={concessionalCap}
        ariaLabel={`Concessional super contributions: ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(concessionalUsed)} of ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(concessionalCap)} cap`}
      />

      <CapBar
        label="Non-Concessional Contributions"
        used={nonConcessionalUsed}
        cap={nonConcessionalCap}
        ariaLabel={`Non-concessional super contributions: ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(nonConcessionalUsed)} of ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(nonConcessionalCap)} cap`}
      />
    </div>
  )
}
