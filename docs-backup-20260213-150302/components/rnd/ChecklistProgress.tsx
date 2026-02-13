'use client'

/**
 * ChecklistProgress
 *
 * Circular progress indicator showing overall claim preparation
 * completeness with mandatory vs optional breakdown.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive claim preparation.
 */

interface ChecklistProgressProps {
  percentComplete: number
  completedItems: number
  totalItems: number
  mandatoryPercentComplete: number
  mandatoryCompleted: number
  mandatoryItems: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ChecklistProgress({
  percentComplete,
  completedItems,
  totalItems,
  mandatoryPercentComplete,
  mandatoryCompleted,
  mandatoryItems,
  size = 'md',
  className = '',
}: ChecklistProgressProps) {
  const dimensions = {
    sm: { width: 80, strokeWidth: 4, fontSize: '14px', labelSize: '9px' },
    md: { width: 120, strokeWidth: 5, fontSize: '22px', labelSize: '10px' },
    lg: { width: 160, strokeWidth: 6, fontSize: '28px', labelSize: '11px' },
  }

  const dim = dimensions[size]
  const radius = (dim.width - dim.strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const mandatoryOffset = circumference - (mandatoryPercentComplete / 100) * circumference
  const totalOffset = circumference - (percentComplete / 100) * circumference

  // Determine colour based on mandatory progress
  const progressColour =
    mandatoryPercentComplete >= 100
      ? '#00FF88'
      : mandatoryPercentComplete >= 50
        ? '#FF8800'
        : '#FF4444'

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Circular SVG */}
      <div className="relative" style={{ width: dim.width, height: dim.width }}>
        <svg
          width={dim.width}
          height={dim.width}
          viewBox={`0 0 ${dim.width} ${dim.width}`}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={dim.width / 2}
            cy={dim.width / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={dim.strokeWidth}
          />
          {/* Total progress (outer, dimmer) */}
          <circle
            cx={dim.width / 2}
            cy={dim.width / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={dim.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={totalOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          {/* Mandatory progress (inner, brighter) */}
          <circle
            cx={dim.width / 2}
            cy={dim.width / 2}
            r={radius - dim.strokeWidth - 2}
            fill="none"
            stroke={progressColour}
            strokeWidth={dim.strokeWidth - 1}
            strokeDasharray={2 * Math.PI * (radius - dim.strokeWidth - 2)}
            strokeDashoffset={
              2 * Math.PI * (radius - dim.strokeWidth - 2) -
              (mandatoryPercentComplete / 100) * 2 * Math.PI * (radius - dim.strokeWidth - 2)
            }
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>

        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-semibold"
            style={{ fontSize: dim.fontSize, color: progressColour }}
          >
            {mandatoryPercentComplete}%
          </span>
          <span
            className="uppercase tracking-wider"
            style={{ fontSize: dim.labelSize, color: 'var(--text-muted)' }}
          >
            Ready
          </span>
        </div>
      </div>

      {/* Stats below */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 text-xs">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: progressColour }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>
            Mandatory: {mandatoryCompleted}/{mandatoryItems}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: 'rgba(255, 255, 255, 0.15)' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>
            Total: {completedItems}/{totalItems}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ChecklistProgress
