/**
 * Tax Alerts Dashboard Page
 *
 * Displays all tax alerts for the authenticated user
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AlertsList from '@/components/alerts/AlertsList'

export const metadata = {
  title: 'Tax Alerts | Australian Tax Optimizer',
  description: 'View and manage your tax alerts, deadlines, and opportunities'
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic'

export default async function AlertsPage() {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Tax Alerts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Stay on top of deadlines, opportunities, and compliance requirements
          </p>
        </div>

        {/* Alerts List */}
        <AlertsList tenantId={user.id} />
      </div>
    </div>
  )
}
