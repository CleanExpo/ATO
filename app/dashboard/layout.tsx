import type { ReactNode } from 'react'
import { OrganizationProvider } from '@/lib/context/OrganizationContext'
import { VerticalNav, DynamicIsland } from '@/components/ui/DynamicIsland'

// Force dynamic rendering for all dashboard pages (require authentication)
export const dynamic = 'force-dynamic'

/**
 * Dashboard Layout - Clean Centered Design
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <OrganizationProvider>
      {/* Full screen container */}
      <div className="min-h-screen bg-[#050505] flex">

        {/* Desktop Sidebar - Fixed 72px width */}
        <aside className="hidden md:flex w-[72px] flex-shrink-0">
          <VerticalNav />
        </aside>

        {/* Main content area - takes remaining space */}
        <div className="flex-1 flex flex-col min-h-screen">

          {/* Header bar - centered in content area */}
          <header className="w-full flex justify-center py-4 sticky top-0 z-50">
            <DynamicIsland showLogo />
          </header>

          {/* Page content - centered with max-width */}
          <main className="flex-1 flex flex-col items-center w-full px-4 md:px-6 lg:px-8">
            <div className="w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </OrganizationProvider>
  )
}
