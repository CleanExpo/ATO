'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useState } from 'react'
import {
  LayoutDashboard,
  Search,
  FileSearch,
  Calendar,
  Beaker,
  TrendingDown,
  Settings,
  Users,
  Menu,
  X,
  ShieldAlert,
  BrainCircuit,
  Terminal,
  HelpCircle,
  CreditCard,
  Briefcase
} from 'lucide-react'
import {
  getDesktopNavItems,
  isNavItemActive,
  type NavItemConfig,
  type IconName
} from '@/lib/config/navigation'
import { OrganizationSwitcher } from '@/components/dashboard/OrganizationSwitcher'
import NotificationBell from '@/components/collaboration/NotificationBell'

// Icon mapping for rendering
const iconMap: Record<IconName, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard,
  Search,
  FileSearch,
  Calendar,
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

function NavIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  const Icon = iconMap[name]
  return Icon ? <Icon size={size} /> : null
}

// Get navigation items from shared config
const navItems = getDesktopNavItems()

interface DynamicIslandProps {
  /** Show logo/brand element */
  showLogo?: boolean
  /** Custom logo element */
  logo?: ReactNode
}

/**
 * DynamicIsland - Floating pill navigation
 *
 * A floating navigation bar inspired by Apple's Dynamic Island.
 * Sits at the top center of the viewport with frosted glass effect.
 *
 * @example
 * <DynamicIsland showLogo />
 */
export function DynamicIsland({ showLogo = false, logo }: DynamicIslandProps) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.nav
      className="dynamic-island"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      layout
    >
      {showLogo && (
        <>
          {logo || (
            <Link href="/dashboard" className="dynamic-island__item">
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>ATO</span>
            </Link>
          )}
          <div className="dynamic-island__divider" />
        </>
      )}

      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = isNavItemActive(item, pathname)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dynamic-island__item ${isActive ? 'dynamic-island__item--active' : ''}`}
            >
              <NavIcon name={item.icon} size={16} />
              <span className="ml-2">{item.shortLabel || item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Notification Bell & Organization Switcher */}
      <div className="hidden md:flex items-center">
        <div className="dynamic-island__divider" />
        <div className="px-2">
          <NotificationBell />
        </div>
        <div className="px-2">
          <OrganizationSwitcher />
        </div>
      </div>

      {/* Mobile Menu Toggle */}
      <button
        className="dynamic-island__item md:hidden"
        onClick={() => setExpanded(!expanded)}
        aria-label="Toggle menu"
      >
        {expanded ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile Expanded Menu */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl md:hidden"
            style={{
              background: 'var(--void-elevated)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(40px)',
            }}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {navItems.map((item) => {
              const isActive = isNavItemActive(item, pathname)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setExpanded(false)}
                  className={`dynamic-island__item w-full justify-start ${isActive ? 'dynamic-island__item--active' : ''}`}
                  style={{ borderRadius: '8px', marginBottom: '4px' }}
                >
                  <NavIcon name={item.icon} size={16} />
                  <span className="ml-3">{item.label}</span>
                </Link>
              )
            })}

            {/* Organization Switcher - Mobile */}
            <div className="pt-2 mt-2 border-t border-white/10">
              <OrganizationSwitcher />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}

/**
 * VerticalNav - Icon-only sidebar navigation
 *
 * Alternative to Dynamic Island for desktop layouts.
 * Fixed position vertical bar with icon buttons.
 */
export function VerticalNav() {
  const pathname = usePathname()
  const mainItems = navItems.filter(item => item.href !== '/dashboard/settings')
  const settingsItem = navItems.find(item => item.href === '/dashboard/settings')

  return (
    <nav className="vertical-nav">
      <Link href="/dashboard" className="vertical-nav__logo">
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>A</span>
      </Link>

      <div className="vertical-nav__items">
        {mainItems.map((item) => {
          const isActive = isNavItemActive(item, pathname)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`vertical-nav__item ${isActive ? 'vertical-nav__item--active' : ''}`}
              title={item.label}
            >
              <NavIcon name={item.icon} size={18} />
            </Link>
          )
        })}
      </div>

      <div className="vertical-nav__footer">
        {settingsItem && (
          <Link
            href={settingsItem.href}
            className={`vertical-nav__item ${isNavItemActive(settingsItem, pathname) ? 'vertical-nav__item--active' : ''}`}
            title={settingsItem.label}
          >
            <NavIcon name={settingsItem.icon} size={18} />
          </Link>
        )}
      </div>
    </nav>
  )
}
