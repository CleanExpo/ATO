/**
 * Mobile Bottom Navigation Component
 *
 * A fixed bottom navigation bar for mobile devices.
 * - Shows main navigation items with icons and labels
 * - "More" button reveals additional pages in a slide-up sheet
 * - Hidden on tablet and desktop (>= 768px)
 * - Includes safe area padding for notched devices
 */

'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Beaker,
  FileSearch,
  TrendingDown,
  Settings,
  Calendar,
  CalendarClock,
  Gauge,
  Users,
  ShieldAlert,
  BrainCircuit,
  Terminal,
  HelpCircle,
  CreditCard,
  Briefcase,
  MoreHorizontal,
  X
} from 'lucide-react'
import {
  getMobileNavItems,
  getDesktopNavItems,
  isNavItemActive,
  type IconName
} from '@/lib/config/navigation'

// Icon mapping for mobile nav
const iconMap: Record<IconName, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Search,
  FileSearch,
  Calendar,
  CalendarClock,
  Gauge,
  Beaker,
  TrendingDown,
  Settings,
  Users,
  ShieldAlert,
  BrainCircuit,
  Terminal,
  HelpCircle,
  CreditCard,
  Briefcase,
}

function NavIcon({ name }: { name: IconName }) {
  const Icon = iconMap[name]
  return Icon ? <Icon className="mobile-nav__icon" /> : null
}

// Primary bottom bar items
const primaryItems = getMobileNavItems()

// Items only visible on desktop — these go in the "More" sheet
const allDesktopItems = getDesktopNavItems()
const mobileHrefs = new Set(primaryItems.map(i => i.href))
const moreItems = allDesktopItems.filter(i => !mobileHrefs.has(i.href))

export function MobileNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  const closeSheet = useCallback(() => setShowMore(false), [])

  // Check if any "more" item is active
  const moreIsActive = moreItems.some(item => isNavItemActive(item, pathname))

  return (
    <>
      {/* Slide-up sheet for additional nav items */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-[998] md:hidden"
            onClick={closeSheet}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-[999] md:hidden animate-in slide-in-from-bottom duration-200">
            <div
              className="mx-2 mb-[calc(env(safe-area-inset-bottom,0px)+64px)] rounded-2xl overflow-hidden"
              style={{ background: 'var(--surface-1, #111)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary, rgba(255,255,255,0.4))' }}>
                  More Pages
                </span>
                <button onClick={closeSheet} className="p-1 rounded-lg hover:bg-white/10">
                  <X className="w-4 h-4" style={{ color: 'var(--text-secondary, rgba(255,255,255,0.6))' }} />
                </button>
              </div>
              <nav className="grid grid-cols-3 gap-1 p-2">
                {moreItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeSheet}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-colors hover:bg-white/5"
                    style={{
                      color: isNavItemActive(item, pathname)
                        ? 'var(--accent, #00F5FF)'
                        : 'var(--text-secondary, rgba(255,255,255,0.6))'
                    }}
                  >
                    <NavIcon name={item.icon} />
                    <span className="text-[10px] font-medium text-center leading-tight">
                      {item.shortLabel || item.label}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav className="mobile-nav">
        {primaryItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav__item ${isNavItemActive(item, pathname) ? 'mobile-nav__item--active' : ''}`}
          >
            <NavIcon name={item.icon} />
            <span className="mobile-nav__label">{item.shortLabel || item.label}</span>
          </Link>
        ))}
        {moreItems.length > 0 && (
          <button
            onClick={() => setShowMore(prev => !prev)}
            className={`mobile-nav__item ${moreIsActive ? 'mobile-nav__item--active' : ''}`}
          >
            <MoreHorizontal className="mobile-nav__icon" />
            <span className="mobile-nav__label">More</span>
          </button>
        )}
      </nav>
    </>
  )
}

export default MobileNav
