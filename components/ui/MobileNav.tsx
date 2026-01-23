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
  Beaker,
  FileSearch,
  TrendingDown,
  Settings
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  matchPaths?: string[]
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: <LayoutDashboard className="mobile-nav__icon" />,
    matchPaths: ['/dashboard']
  },
  {
    href: '/dashboard/rnd',
    label: 'R&D',
    icon: <Beaker className="mobile-nav__icon" />,
    matchPaths: ['/dashboard/rnd']
  },
  {
    href: '/dashboard/forensic-audit',
    label: 'Audit',
    icon: <FileSearch className="mobile-nav__icon" />,
    matchPaths: ['/dashboard/forensic-audit', '/dashboard/audit', '/dashboard/data-quality']
  },
  {
    href: '/dashboard/losses',
    label: 'Losses',
    icon: <TrendingDown className="mobile-nav__icon" />,
    matchPaths: ['/dashboard/losses']
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: <Settings className="mobile-nav__icon" />,
    matchPaths: ['/dashboard/settings']
  }
]

export function MobileNav() {
  const pathname = usePathname()

  const isActive = (item: NavItem): boolean => {
    if (item.matchPaths) {
      return item.matchPaths.some(path => {
        if (path === '/dashboard') {
          return pathname === '/dashboard'
        }
        return pathname.startsWith(path)
      })
    }
    return pathname === item.href
  }

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`mobile-nav__item ${isActive(item) ? 'mobile-nav__item--active' : ''}`}
        >
          {item.icon}
          <span className="mobile-nav__label">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

export default MobileNav
