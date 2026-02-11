'use client'

/**
 * Breadcrumb - Navigation breadcrumb for sub-pages
 *
 * Auto-generates breadcrumb trail from the current pathname.
 * Used in dashboard layout for nested routes.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

// Label overrides for route segments
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'forensic-audit': 'Forensic Audit',
  'data-quality': 'Data Quality',
  'tax-reporting': 'Tax Reporting',
  projections: 'Projections',
  calendar: 'Calendar',
  strategies: 'Strategies',
  settings: 'Settings',
  admin: 'Admin',
  pricing: 'Pricing',
  rnd: 'R&D Assessment',
  losses: 'Loss Analysis',
  accountant: 'Accountant',
  audit: 'Audit',
  connect: 'Connect',
  checklist: 'Checklist',
  organization: 'Organisation',
  members: 'Members',
}

function segmentLabel(segment: string): string {
  return SEGMENT_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

interface BreadcrumbProps {
  className?: string
}

export function Breadcrumb({ className = '' }: BreadcrumbProps) {
  const pathname = usePathname()

  // Only show breadcrumbs for paths deeper than /dashboard
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 1) return null

  const crumbs = segments.map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/')
    const isLast = idx === segments.length - 1
    return { label: segmentLabel(seg), href, isLast }
  })

  return (
    <nav
      className={`flex items-center gap-1.5 text-xs mb-4 ${className}`}
      aria-label="Breadcrumb"
      style={{ color: 'var(--text-tertiary, rgba(255,255,255,0.4))' }}
    >
      {crumbs.map((crumb, idx) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {idx > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
          {crumb.isLast ? (
            <span className="font-medium" style={{ color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href} className="hover:text-white transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

export default Breadcrumb
