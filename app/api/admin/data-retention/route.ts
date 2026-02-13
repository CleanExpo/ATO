/**
 * GET /api/admin/data-retention - Returns retention status for all managed tables
 * POST /api/admin/data-retention - Triggers retention policy enforcement (purges expired records)
 *
 * Both endpoints require authentication via requireAuth().
 * Rate limited to prevent abuse.
 *
 * @see s 262A ITAA 1936 - ATO 5-year record-keeping requirement
 * @see lib/data-retention/retention-policy.ts - Policy definitions
 * @see lib/data-retention/retention-enforcer.ts - Enforcement logic
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { applyRateLimit, RATE_LIMITS } from '@/lib/middleware/apply-rate-limit'
import { createErrorResponse } from '@/lib/api/errors'
import { getRetentionStatus } from '@/lib/data-retention/retention-enforcer'
import { enforceRetentionPolicies } from '@/lib/data-retention/retention-enforcer'
import { RETENTION_POLICIES } from '@/lib/data-retention/retention-policy'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/data-retention
 *
 * Returns the current retention status for all policy-managed tables,
 * including total record counts, oldest record dates, and counts of
 * records expiring within the next 30 days.
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.api, 'admin:data-retention:get')
  if (rateLimitResult) return rateLimitResult

  // Require authentication (skip tenant validation -- this is an admin/system endpoint)
  const auth = await requireAuth(request, { skipTenantValidation: true })
  if (auth instanceof NextResponse) return auth

  try {
    const status = await getRetentionStatus()

    // Enrich with policy metadata
    const enrichedStatus = status.map((entry) => {
      const policy = RETENTION_POLICIES.find((p) => p.table === entry.table)
      return {
        ...entry,
        retentionDays: policy?.retentionDays ?? 0,
        description: policy?.description ?? '',
        legislation: policy?.legislation ?? null,
      }
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      policies: enrichedStatus,
    })
  } catch (error) {
    return createErrorResponse(error, { operation: 'getRetentionStatus' })
  }
}

/**
 * POST /api/admin/data-retention
 *
 * Triggers enforcement of all retention policies. Expired records
 * are permanently deleted from their respective tables.
 *
 * Returns a summary of deletions performed.
 */
export async function POST(request: NextRequest) {
  // Rate limit (use analysis limits -- this is an expensive, destructive operation)
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.analysis, 'admin:data-retention:post')
  if (rateLimitResult) return rateLimitResult

  // Require authentication (skip tenant validation -- this is an admin/system endpoint)
  const auth = await requireAuth(request, { skipTenantValidation: true })
  if (auth instanceof NextResponse) return auth

  try {
    const results = await enforceRetentionPolicies()

    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalDeleted,
      results,
    })
  } catch (error) {
    return createErrorResponse(error, { operation: 'enforceRetentionPolicies' })
  }
}
