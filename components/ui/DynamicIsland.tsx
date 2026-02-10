'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useState, useEffect, useCallback } from 'react'
import {
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
  Menu,
  X,
  ShieldAlert,
  BrainCircuit,
  Terminal,
  HelpCircle,
  CreditCard,
  Briefcase,
  Check
} from 'lucide-react'
import {
  getDesktopNavItems,
  isNavItemActive,
  type NavItemConfig,
  type IconName
} from '@/lib/config/navigation'
import { OrganizationSwitcher } from '@/components/dashboard/OrganizationSwitcher'
import NotificationBell from '@/components/collaboration/NotificationBell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

// Icon mapping for rendering
const iconMap: Record<IconName, React.ComponentType<{ size?: number }>> = {
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

function NavIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  const Icon = iconMap[name]
  return Icon ? <Icon size={size} /> : null
}

// Get navigation items from shared config
const navItems = getDesktopNavItems()

// --- Onboarding Steps ---

type StepStatus = 'complete' | 'active' | 'pending'

interface OnboardingStep {
  label: string
  status: StepStatus
}

function useOnboardingSteps(): OnboardingStep[] {
  const [steps, setSteps] = useState<OnboardingStep[]>([
    { label: 'Connect', status: 'active' },
    { label: 'Analyse', status: 'pending' },
    { label: 'Results', status: 'pending' },
  ])

  const fetchStepState = useCallback(async () => {
    let hasConnection = false
    let hasSyncedData = false
    let hasResults = false

    try {
      const [xeroRes, myobRes] = await Promise.all([
        fetch('/api/xero/organizations').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/myob/connections').then(r => r.ok ? r.json() : null).catch(() => null),
      ])

      const xeroOrgs = Array.isArray(xeroRes) ? xeroRes : xeroRes?.organizations ?? []
      const myobConns = Array.isArray(myobRes) ? myobRes : myobRes?.connections ?? []
      hasConnection = xeroOrgs.length > 0 || myobConns.length > 0
    } catch {
      // Connection check failed — step 1 stays active
    }

    if (hasConnection) {
      try {
        const txRes = await fetch('/api/audit/cached-transactions?limit=1')
        if (txRes.ok) {
          const txData = await txRes.json()
          const txList = Array.isArray(txData) ? txData : txData?.transactions ?? []
          hasSyncedData = txList.length > 0
        }
      } catch {
        // Sync check failed
      }
    }

    if (hasSyncedData) {
      try {
        const recRes = await fetch('/api/audit/recommendations')
        if (recRes.ok) {
          const recData = await recRes.json()
          const recs = Array.isArray(recData) ? recData : recData?.recommendations ?? []
          hasResults = recs.some((r: { estimatedBenefit?: number; estimated_benefit?: number }) =>
            (r.estimatedBenefit ?? r.estimated_benefit ?? 0) > 0
          )
        }
      } catch {
        // Results check failed
      }
    }

    const newSteps: OnboardingStep[] = [
      { label: 'Connect', status: hasConnection ? 'complete' : 'active' },
      { label: 'Analyse', status: hasSyncedData ? 'complete' : hasConnection ? 'active' : 'pending' },
      { label: 'Results', status: hasResults ? 'complete' : hasSyncedData ? 'active' : 'pending' },
    ]

    setSteps(newSteps)
  }, [])

  useEffect(() => {
    fetchStepState()
  }, [fetchStepState])

  return steps
}

function OnboardingSteps({ steps, compact = false }: { steps: OnboardingStep[]; compact?: boolean }) {
  return (
    <div className={`onboarding-steps ${compact ? 'onboarding-steps--compact' : ''}`} role="list" aria-label="Onboarding progress">
      {steps.map((step, i) => (
        <div key={step.label} className="onboarding-steps__step" role="listitem">
          {i > 0 && (
            <div className={`onboarding-steps__connector onboarding-steps__connector--${steps[i - 1].status === 'complete' ? 'complete' : 'pending'}`} />
          )}
          <div className={`onboarding-steps__circle onboarding-steps__circle--${step.status}`}>
            {step.status === 'complete' ? (
              <Check size={12} strokeWidth={3} />
            ) : (
              <span>{i + 1}</span>
            )}
          </div>
          <span className={`onboarding-steps__label onboarding-steps__label--${step.status}`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// --- DynamicIsland ---

interface DynamicIslandProps {
  /** Show logo/brand element */
  showLogo?: boolean
  /** Custom logo element */
  logo?: ReactNode
}

/**
 * DynamicIsland - Floating header with onboarding progress
 *
 * Shows a 3-step progress indicator (Connect → Analyse → Results)
 * replacing the old horizontal navigation tabs.
 * VerticalNav sidebar handles page navigation.
 *
 * @example
 * <DynamicIsland showLogo />
 */
export function DynamicIsland({ showLogo = false, logo }: DynamicIslandProps) {
  const [expanded, setExpanded] = useState(false)
  const steps = useOnboardingSteps()

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

      {/* Desktop: Onboarding Steps */}
      <div className="hidden md:flex items-center">
        <OnboardingSteps steps={steps} />
      </div>

      {/* Theme Toggle, Notification Bell & Organization Switcher */}
      <div className="hidden md:flex items-center">
        <div className="dynamic-island__divider" />
        <ThemeToggle />
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
            className="absolute top-full left-0 right-0 mt-2 p-4 md:hidden"
            style={{
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--border-light)',
              backdropFilter: 'blur(40px)',
              borderRadius: 'var(--radius-sm)',
            }}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Compact onboarding steps */}
            <OnboardingSteps steps={steps} compact />

            {/* Organization Switcher - Mobile */}
            <div className="pt-3 mt-3 border-t border-white/10">
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
