import type { ReactNode } from 'react'

/**
 * Dashboard Layout
 *
 * Simple passthrough layout for dashboard pages.
 * Authentication has been removed for single-user operation.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
    return <>{children}</>
}
