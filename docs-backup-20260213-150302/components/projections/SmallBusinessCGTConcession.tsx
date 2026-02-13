'use client'

import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface EligibilityCriterion {
  name: string
  met: boolean | null // null = not yet assessed
  detail: string
  legislativeRef: string
}

interface SmallBusinessCGTConcessionProps {
  /** Eligibility criteria results */
  criteria: EligibilityCriterion[]
  /** Estimated concession value */
  estimatedConcession?: number
  /** Confidence level */
  confidence?: number
  className?: string
}

/**
 * SmallBusinessCGTConcession - Division 152 eligibility checklist
 *
 * Shows each eligibility criterion with pass/fail/unknown status.
 * Uses icon + colour + text (never colour alone).
 */
export function SmallBusinessCGTConcession({
  criteria,
  estimatedConcession,
  confidence,
  className = '',
}: SmallBusinessCGTConcessionProps) {
  const metCount = criteria.filter(c => c.met === true).length
  const allMet = criteria.length > 0 && metCount === criteria.length

  return (
    <div className={className}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <div>
          <h4 className="typo-title">Small Business CGT Concessions</h4>
          <p className="typo-caption">Division 152 ITAA 1997</p>
        </div>
        <span className="estimate-label">ESTIMATE</span>
      </div>

      {/* Eligibility checklist */}
      <div className="layout-stack" role="list" aria-label="CGT concession eligibility criteria">
        {criteria.map((criterion, i) => (
          <div
            key={i}
            className="data-strip"
            style={{
              borderLeftColor: criterion.met === true
                ? 'var(--compliance-ok)'
                : criterion.met === false
                ? 'var(--compliance-risk)'
                : 'var(--text-muted)',
            }}
            role="listitem"
          >
            <div className="data-strip__label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {criterion.met === true && (
                <CheckCircle size={14} className="compliance-ok" aria-hidden="true" />
              )}
              {criterion.met === false && (
                <XCircle size={14} className="compliance-risk" aria-hidden="true" />
              )}
              {criterion.met === null && (
                <AlertTriangle size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              )}
              <span className="typo-label">
                {criterion.name}
                <span className="sr-only">
                  {criterion.met === true ? ' - met' : criterion.met === false ? ' - not met' : ' - not yet assessed'}
                </span>
              </span>
            </div>
            <div className="data-strip__value">
              <span className="typo-subtitle">{criterion.detail}</span>
            </div>
            <div className="data-strip__metric">
              <span className="typo-caption">{criterion.legislativeRef}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {criteria.length > 0 && (
        <div
          className="stat-card"
          style={{
            marginTop: 'var(--space-md)',
            borderLeft: `2px solid ${allMet ? 'var(--compliance-ok)' : 'var(--compliance-warn)'}`,
          }}
        >
          <span className="stat-card__label">
            {allMet ? 'Eligible for concessions' : `${metCount} of ${criteria.length} criteria met`}
          </span>
          {estimatedConcession !== undefined && (
            <span
              className="stat-card__value"
              style={{ color: allMet ? 'var(--compliance-ok)' : 'var(--text-secondary)' }}
              aria-label={`Estimated concession value: ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(estimatedConcession)}`}
            >
              ${estimatedConcession.toLocaleString('en-AU')}
            </span>
          )}
          {confidence !== undefined && (
            <span className="estimate-label">{confidence}% confidence</span>
          )}
        </div>
      )}
    </div>
  )
}
