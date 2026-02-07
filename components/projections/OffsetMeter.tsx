'use client'

import { useMemo } from 'react'

interface OffsetMeterProps {
  /** Current value */
  value: number
  /** Maximum/target value */
  max: number
  /** Label text */
  label: string
  /** Format for display */
  format?: 'currency' | 'number' | 'percent'
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional className */
  className?: string
}

function formatValue(value: number, format: string): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case 'percent':
      return `${value.toFixed(1)}%`
    default:
      return new Intl.NumberFormat('en-AU').format(value)
  }
}

function getStatusColour(ratio: number): string {
  if (ratio < 0.6) return 'var(--compliance-ok)'
  if (ratio < 0.85) return 'var(--compliance-warn)'
  return 'var(--compliance-risk)'
}

function getStatusLabel(ratio: number): string {
  if (ratio < 0.6) return 'On track'
  if (ratio < 0.85) return 'Approaching limit'
  return 'At risk'
}

const SIZES = {
  sm: { width: 120, stroke: 6, fontSize: 14, labelSize: 9 },
  md: { width: 160, stroke: 8, fontSize: 18, labelSize: 10 },
  lg: { width: 200, stroke: 10, fontSize: 22, labelSize: 11 },
}

/**
 * OffsetMeter - SVG arc gauge for tax offset/cap projections
 *
 * Accessible via role="meter" with aria-valuenow/min/max.
 * Colour transitions from green (on track) to amber to red (at risk).
 */
export function OffsetMeter({
  value,
  max,
  label,
  format = 'currency',
  size = 'md',
  className = '',
}: OffsetMeterProps) {
  const s = SIZES[size]
  const radius = (s.width - s.stroke) / 2
  const cx = s.width / 2
  const cy = s.width / 2

  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  const colour = getStatusColour(ratio)
  const statusLabel = getStatusLabel(ratio)

  // Arc from 135deg to 405deg (270deg sweep)
  const startAngle = 135
  const endAngle = 405
  const sweepAngle = (endAngle - startAngle) * ratio

  const polarToCartesian = useMemo(() => {
    return (angleDeg: number) => {
      const rad = ((angleDeg - 90) * Math.PI) / 180
      return {
        x: cx + radius * Math.cos(rad),
        y: cy + radius * Math.sin(rad),
      }
    }
  }, [cx, radius])

  const bgStart = polarToCartesian(startAngle)
  const bgEnd = polarToCartesian(endAngle)
  const fillEnd = polarToCartesian(startAngle + sweepAngle)

  const bgArc = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`
  const largeArcFlag = sweepAngle > 180 ? 1 : 0
  const fillArc = sweepAngle > 0
    ? `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${fillEnd.x} ${fillEnd.y}`
    : ''

  return (
    <div
      className={className}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${label}: ${formatValue(value, format)} of ${formatValue(max, format)}. ${statusLabel}.`}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <svg width={s.width} height={s.width * 0.75} viewBox={`0 0 ${s.width} ${s.width * 0.85}`}>
        {/* Background arc */}
        <path
          d={bgArc}
          fill="none"
          stroke="var(--border-light)"
          strokeWidth={s.stroke}
          strokeLinecap="round"
        />
        {/* Fill arc */}
        {fillArc && (
          <path
            d={fillArc}
            fill="none"
            stroke={colour}
            strokeWidth={s.stroke}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease',
            }}
          />
        )}
        {/* Value text */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="var(--text-primary)"
          fontFamily="var(--font-mono)"
          fontSize={s.fontSize}
          fontWeight={400}
        >
          {formatValue(value, format)}
        </text>
        {/* Max text */}
        <text
          x={cx}
          y={cy + s.fontSize - 2}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={s.labelSize - 1}
        >
          of {formatValue(max, format)}
        </text>
      </svg>

      {/* Label and status */}
      <span className="typo-label" style={{ marginTop: 'var(--space-xs)', textAlign: 'center' }}>
        {label}
      </span>
      <span
        className="compliance-badge"
        style={{
          marginTop: '2px',
          background: ratio < 0.6 ? 'var(--compliance-ok-dim)' : ratio < 0.85 ? 'var(--compliance-warn-dim)' : 'var(--compliance-risk-dim)',
          color: colour,
        }}
      >
        {statusLabel}
      </span>
    </div>
  )
}
