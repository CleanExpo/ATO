import type { ReactNode } from 'react'
import { OrganizationProvider } from '@/lib/context/OrganizationContext'
import { VerticalNav, DynamicIsland } from '@/components/ui/DynamicIsland'

/**
 * Dashboard Layout
 *
 * Wraps dashboard pages with multi-tenant organization context
 * Implements persistent navigation (Sidebar + Floating Island)
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <OrganizationProvider>
      <div className="flex min-h-screen bg-[var(--bg-base)]">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <VerticalNav />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 md:pl-[72px] relative">
          {/* Floating Navigation (Desktop & Mobile) */}
          <DynamicIsland showLogo />

          {/* Child Page Content */}
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </OrganizationProvider>
  )
}
