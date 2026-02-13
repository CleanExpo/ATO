/**
 * Legislation Link Component
 *
 * Displays clickable legislation references with deep links to ATO/legislation.gov.au.
 * Based on legislation-reference-guide.md
 */

'use client'

import { ExternalLink } from 'lucide-react'

interface LegislationRef {
  section: string // e.g., "s 8-1 ITAA 1997"
  title: string // e.g., "General deductions"
  url: string // Deep link to legislation.gov.au
}

interface LegislationLinkProps {
  references: LegislationRef[]
  compact?: boolean
}

/**
 * Get legislation color by Act
 */
function getLegislationColor(section: string): string {
  if (section.includes('ITAA 1997')) return '#00D9FF' // Cyan
  if (section.includes('ITAA 1936')) return '#FF0080' // Magenta
  if (section.includes('FBTAA')) return '#FFFF00' // Yellow
  if (section.includes('TAA')) return '#00FF00' // Green
  return '#FFFFFF'
}

export function LegislationLink({ references, compact = false }: LegislationLinkProps) {
  if (references.length === 0) {
    return (
      <div className="text-xs text-white/40 italic">
        No specific legislation referenced
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      {references.map((ref, idx) => {
        const color = getLegislationColor(ref.section)

        return (
          <a
            key={idx}
            href={ref.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-2 p-2 rounded-xl transition-all hover:scale-[1.02]"
            style={{
              background: `${color}10`,
              border: `1px solid ${color}20`,
            }}
          >
            {/* Section Number */}
            <div
              className={`px-2 py-1 rounded-lg font-mono ${compact ? 'text-[10px]' : 'text-xs'} font-medium flex-shrink-0`}
              style={{
                background: `${color}20`,
                color: color,
              }}
            >
              {ref.section}
            </div>

            {/* Title */}
            <div className="flex-1 min-w-0">
              <div
                className={`${compact ? 'text-xs' : 'text-sm'} text-white/80 group-hover:text-white/100 transition-colors`}
              >
                {ref.title}
              </div>
            </div>

            {/* External Link Icon */}
            <ExternalLink
              size={compact ? 12 : 14}
              className="text-white/40 group-hover:text-white/70 transition-colors flex-shrink-0 mt-0.5"
            />
          </a>
        )
      })}
    </div>
  )
}

/**
 * Compact inline version for displaying in cards
 */
export function LegislationBadge({ reference }: { reference: LegislationRef }) {
  const color = getLegislationColor(reference.section)

  return (
    <a
      href={reference.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono transition-all hover:scale-105"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}30`,
        color: color,
      }}
      title={reference.title}
    >
      {reference.section}
      <ExternalLink size={10} className="opacity-60" />
    </a>
  )
}
