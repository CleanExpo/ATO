/**
 * Shared Navigation Configuration
 *
 * Single source of truth for all navigation items across the application.
 * Used by DynamicIsland, VerticalNav, MobileNav, and sidebar components.
 */

export type IconName =
  | 'LayoutDashboard'
  | 'Search'
  | 'FileSearch'
  | 'Calendar'
  | 'Beaker'
  | 'TrendingDown'
  | 'Settings'
  | 'Users'
  | 'ShieldAlert'
  | 'BrainCircuit'
  | 'Terminal'
  | 'HelpCircle'
  | 'CreditCard'
  | 'Briefcase'

export interface NavItemConfig {
  /** URL path */
  href: string
  /** Display label */
  label: string
  /** Short label for mobile/compact views */
  shortLabel?: string
  /** Lucide icon name */
  icon: IconName
  /** Additional paths that should mark this item as active */
  matchPaths?: string[]
  /** Whether this item should appear in mobile navigation */
  showInMobile?: boolean
  /** Whether this item should appear in desktop navigation */
  showInDesktop?: boolean
}

/**
 * Main navigation items for the dashboard
 */
export const NAV_ITEMS: NavItemConfig[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: 'LayoutDashboard',
    matchPaths: ['/dashboard'],
    showInMobile: true,
    showInDesktop: true,
  },
  {
    href: '/dashboard/data-quality',
    label: 'Data Quality',
    shortLabel: 'Data',
    icon: 'Search',
    matchPaths: ['/dashboard/data-quality'],
    showInMobile: false, // Combined with Audit in mobile
    showInDesktop: true,
  },
  {
    href: '/dashboard/forensic-audit',
    label: 'Forensic Audit',
    shortLabel: 'Audit',
    icon: 'FileSearch',
    matchPaths: ['/dashboard/forensic-audit', '/dashboard/audit', '/dashboard/data-quality'],
    showInMobile: true,
    showInDesktop: true,
  },
  {
    href: '/dashboard/accountant',
    label: 'Accountant Workflow',
    shortLabel: 'Accountant',
    icon: 'Briefcase',
    matchPaths: ['/dashboard/accountant'],
    showInMobile: true,
    showInDesktop: true,
  },
  {
    href: '/dashboard/tax-reporting',
    label: 'Tax Reporting',
    shortLabel: 'Tax',
    icon: 'Calendar',
    matchPaths: ['/dashboard/tax-reporting'],
    showInMobile: true,
    showInDesktop: true,
  },
  {
    href: '/dashboard/rnd',
    label: 'R&D Assessment',
    shortLabel: 'R&D',
    icon: 'Beaker',
    matchPaths: ['/dashboard/rnd'],
    showInMobile: true,
    showInDesktop: true,
  },
  {
    href: '/dashboard/losses',
    label: 'Loss Analysis',
    shortLabel: 'Losses',
    icon: 'TrendingDown',
    matchPaths: ['/dashboard/losses'],
    showInMobile: true,
    showInDesktop: true,
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    icon: 'Settings',
    matchPaths: ['/dashboard/settings', '/dashboard/organization/settings', '/dashboard/organization/members'],
    showInMobile: true,
    showInDesktop: true,
  },
  {
    href: '/dashboard/strategies',
    label: 'Strategies',
    shortLabel: 'Strtgy',
    icon: 'BrainCircuit',
    matchPaths: ['/dashboard/strategies'],
    showInMobile: true,
    showInDesktop: true,
  },
  {
    href: '/dashboard/admin',
    label: 'Admin Control',
    shortLabel: 'Admin',
    icon: 'Terminal',
    matchPaths: ['/dashboard/admin'],
    showInMobile: false,
    showInDesktop: true,
  },
  {
    href: '/dashboard/pricing',
    label: 'Pricing & Licenses',
    shortLabel: 'Pricing',
    icon: 'CreditCard',
    matchPaths: ['/dashboard/pricing'],
    showInMobile: true,
    showInDesktop: true,
  },
  {
    href: '/dashboard/help',
    label: 'Help Center',
    shortLabel: 'Help',
    icon: 'HelpCircle',
    matchPaths: ['/dashboard/help'],
    showInMobile: true,
    showInDesktop: true,
  },
]

/**
 * Get navigation items for desktop view
 */
export function getDesktopNavItems(): NavItemConfig[] {
  return NAV_ITEMS.filter(item => item.showInDesktop !== false)
}

/**
 * Get navigation items for mobile view
 */
export function getMobileNavItems(): NavItemConfig[] {
  return NAV_ITEMS.filter(item => item.showInMobile !== false)
}

/**
 * Get main navigation items (excludes settings)
 */
export function getMainNavItems(): NavItemConfig[] {
  return NAV_ITEMS.filter(item => item.href !== '/dashboard/settings')
}

/**
 * Check if a path matches a navigation item
 */
export function isNavItemActive(item: NavItemConfig, pathname: string): boolean {
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
