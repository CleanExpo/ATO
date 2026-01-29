/**
 * GET /api/organizations/consolidated/stats
 *
 * Returns consolidated statistics across all organizations for the current user
 * Used for multi-org dashboard overview
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/api/errors'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      )
    }

    // Get all organizations the user has access to
    const { data: userOrgs, error: orgsError } = await supabase
      .rpc('get_user_organizations')

    if (orgsError) {
      console.error('Error fetching user organizations:', orgsError)
      return createErrorResponse(orgsError, { operation: 'get_user_organizations' }, 500)
    }

    if (!userOrgs || userOrgs.length === 0) {
      // No organizations - user might be in single-user mode
      return NextResponse.json({
        totalOrganizations: 0,
        organizationsWithXero: 0,
        organizationsWithQuickBooks: 0,
        organizationsWithMYOB: 0,
        totalTransactionsSynced: 0,
        totalTaxOpportunitiesIdentified: 0,
        totalEstimatedRecovery: 0,
        organizationSummaries: [],
      })
    }

    const organizationIds = userOrgs.map((org: { organization_id: string }) => org.organization_id)

    // Get detailed stats for each organization
    const organizationSummaries = await Promise.all(
      organizationIds.map(async (orgId: string) => {
        const orgData = userOrgs.find((o: { organization_id: string }) => o.organization_id === orgId)

        // Get transaction count from historical_transactions_cache
        const { count: transactionCount } = await supabase
          .from('historical_transactions_cache')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', user.id)
          // Note: We'd need to add organization_id to historical_transactions_cache
          // For now, just filter by tenant_id

        // Get tax opportunities (recommendations count)
        const { count: opportunitiesCount } = await supabase
          .from('forensic_analysis_results')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          // Note: We'd need to filter by organization when available

        // Get last sync time from audit_sync_status
        const { data: syncStatus } = await supabase
          .from('audit_sync_status')
          .select('last_sync_at, status, platform')
          .eq('tenant_id', user.id)
          .order('last_sync_at', { ascending: false })
          .limit(1)
          .single()

        // Determine connection status
        let connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected'
        if (orgData.xero_connected || orgData.quickbooks_connected || orgData.myob_connected) {
          connectionStatus = 'connected'
          if (syncStatus?.status === 'error') {
            connectionStatus = 'error'
          }
        }

        return {
          id: orgId,
          name: orgData.name,
          role: orgData.role,
          connectionStatus,
          lastSyncAt: syncStatus?.last_sync_at || null,
          platform: syncStatus?.platform || null,
          transactionCount: transactionCount || 0,
          taxOpportunities: opportunitiesCount || 0,
          estimatedRecovery: 0, // Would need to calculate from recommendations
          xeroConnected: orgData.xero_connected || false,
          quickbooksConnected: orgData.quickbooks_connected || false,
          myobConnected: orgData.myob_connected || false,
        }
      })
    )

    // Calculate aggregate stats
    const totalOrganizations = organizationSummaries.length
    const organizationsWithXero = organizationSummaries.filter(o => o.xeroConnected).length
    const organizationsWithQuickBooks = organizationSummaries.filter(o => o.quickbooksConnected).length
    const organizationsWithMYOB = organizationSummaries.filter(o => o.myobConnected).length
    const totalTransactionsSynced = organizationSummaries.reduce((sum, o) => sum + o.transactionCount, 0)
    const totalTaxOpportunitiesIdentified = organizationSummaries.reduce((sum, o) => sum + o.taxOpportunities, 0)
    const totalEstimatedRecovery = organizationSummaries.reduce((sum, o) => sum + o.estimatedRecovery, 0)

    return NextResponse.json({
      totalOrganizations,
      organizationsWithXero,
      organizationsWithQuickBooks,
      organizationsWithMYOB,
      totalTransactionsSynced,
      totalTaxOpportunitiesIdentified,
      totalEstimatedRecovery,
      organizationSummaries: organizationSummaries.sort((a, b) => a.name.localeCompare(b.name)),
    })

  } catch (error) {
    console.error('Consolidated stats error:', error)
    return createErrorResponse(error, {
      operation: 'getConsolidatedStats',
    }, 500)
  }
}
