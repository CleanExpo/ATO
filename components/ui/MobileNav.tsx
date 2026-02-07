/**
 * Mobile Bottom Navigation Component
 *
 * A fixed bottom navigation bar for mobile devices.
 * - Shows 5 main navigation items with icons and labels
 * - Hidden on tablet and desktop (>= 768px)
 * - Includes safe area padding for notched devices
 */

'use client'

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
  Briefcase
} from 'lucide-react'
import {
  getMobileNavItems,
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

// Get navigation items from shared config
const navItems = getMobileNavItems()

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`mobile-nav__item ${isNavItemActive(item, pathname) ? 'mobile-nav__item--active' : ''}`}
        >
          <NavIcon name={item.icon} />
          <span className="mobile-nav__label">{item.shortLabel || item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

export default MobileNav
