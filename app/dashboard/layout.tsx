import type { ReactNode } from 'react'
import Link from 'next/link'
import { OrganizationProvider } from '@/lib/context/OrganizationContext'
import { VerticalNav, DynamicIsland } from '@/components/ui/DynamicIsland'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

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
              <Breadcrumb />
              {children}
            </div>
          </main>

          {/* Legal footer */}
          <footer className="flex items-center justify-center gap-4 py-4 px-6 border-t-[0.5px] border-white/[0.04]">
            <Link
              href="/privacy"
              className="text-[11px] text-white/20 hover:text-white/40 transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-white/10 text-[11px]">·</span>
            <Link
              href="/terms"
              className="text-[11px] text-white/20 hover:text-white/40 transition-colors"
            >
              Terms of Service
            </Link>
          </footer>
        </div>
      </div>
    </OrganizationProvider>
  )
}
