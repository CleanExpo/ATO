import type { ReactNode } from 'react'
import { OrganizationProvider } from '@/lib/context/OrganizationContext'

/**
 * Dashboard Layout
 *
 * Wraps dashboard pages with multi-tenant organization context
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <OrganizationProvider>
      {children}
    </OrganizationProvider>
  )
}
