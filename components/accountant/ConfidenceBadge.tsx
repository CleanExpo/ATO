/**
 * Confidence Badge Component
 *
 * Displays AI confidence score with color-coded level indicator.
 * Based on validated calculation formulas (docs/compliance/validated-calculation-formulas.md)
 */

'use client'

import { Info } from 'lucide-react'
import { useState } from 'react'

interface ConfidenceScore {
  score: number // 0-100
  level: 'High' | 'Medium' | 'Low'
  factors?: Array<{
    factor: string
    impact: 'positive' | 'negative'
    weight: number
  }>
}

interface ConfidenceBadgeProps {
  confidence: ConfidenceScore
  showFactors?: boolean
}

/**
 * Map confidence level to color
 */
function getLevelColor(level: string): string {
  switch (level) {
    case 'High':
      return '#00FF00' // Green
    case 'Medium':
      return '#FFFF00' // Yellow
    case 'Low':
      return '#FF0080' // Magenta
    default:
      return '#FFFFFF'
  }
}

/**
 * Get confidence interpretation
 */
function getInterpretation(score: number): string {
  if (score >= 80) {
    return 'Strong AI analysis with high legislative and precedent support'
  } else if (score >= 60) {
    return 'Moderate AI analysis - professional review recommended'
  } else if (score >= 40) {
    return 'Lower confidence - additional research required'
  } else {
    return 'Insufficient data for reliable analysis'
  }
}

export function ConfidenceBadge({ confidence, showFactors = false }: ConfidenceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const color = getLevelColor(confidence.level)

  return (
    <div className="relative inline-flex items-center gap-2">
      {/* Badge */}
      <div
        className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2"
        style={{
          background: `${color}15`,
          border: `1px solid ${color}30`,
          color: color,
        }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: color }}
        />
        <span>{confidence.level} Confidence</span>
        <span className="text-white/40">({confidence.score}/100)</span>

        {/* Info Icon */}
        <button
          className="hover:opacity-70 transition-opacity"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
        >
          <Info size={14} />
        </button>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute top-full left-0 mt-2 p-4 rounded-2xl z-50 w-80 shadow-2xl"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(40px)',
          }}
        >
          <div className="text-xs space-y-3">
            {/* Interpretation */}
            <div>
              <div className="text-white/90 font-medium mb-1">Interpretation</div>
              <div className="text-white/60">{getInterpretation(confidence.score)}</div>
            </div>

            {/* Confidence Factors */}
            {showFactors && confidence.factors && confidence.factors.length > 0 && (
              <div>
                <div className="text-white/90 font-medium mb-2">Confidence Factors</div>
                <div className="space-y-2">
                  {confidence.factors.map((factor, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{
                          background: factor.impact === 'positive' ? '#00FF00' : '#FF0080',
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-white/70">{factor.factor}</div>
                        <div className="text-white/40 text-[10px]">
                          Weight: {(factor.weight * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scoring Guide */}
            <div className="pt-3 border-t border-white/10">
              <div className="text-white/90 font-medium mb-2">Scoring Guide</div>
              <div className="space-y-1 text-[10px] text-white/60">
                <div>80-100: High - Strong legislative + precedent support</div>
                <div>60-79: Medium - Some support, professional review advised</div>
                <div>40-59: Low - Limited support, additional research needed</div>
                <div>0-39: Very Low - Insufficient data for reliable analysis</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
