/**
 * R&D Deadlines API
 *
 * GET /api/rnd/deadlines?tenantId=X
 *
 * Returns upcoming R&D registration deadlines with urgency levels.
 * Combines existing registrations with FYs that have R&D candidates but no registration yet.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import {
  type RndDeadlineSummary,
  type DeadlineUrgency,
  calculateDeadlineFromFY,
  calculateDaysUntilDeadline,
  calculateUrgencyLevel,
  URGENCY_CONFIG,
} from '@/lib/types/rnd-registration'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:rnd:deadlines')

/**
 * GET /api/rnd/deadlines
 *
 * Get all upcoming R&D deadlines for a tenant, including:
 * - FYs with existing registrations (tracked)
 * - FYs with R&D candidates but no registration (untracked)
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - includeUntracked?: boolean (default: true) - Include FYs with R&D candidates but no registration
 * - urgencyFilter?: string (optional) - Filter by urgency level
 *
 * Response:
 * - deadlines: Array of deadline summaries sorted by urgency/date
 * - alerts: Count of urgent/critical deadlines
 * - nextDeadline: Most urgent deadline details
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get('tenantId')
    const includeUntracked = searchParams.get('includeUntracked') !== 'false'
    const urgencyFilter = searchParams.get('urgencyFilter') as DeadlineUrgency | null

    if (!tenantId) {
      return createValidationError('tenantId is required')
    }

    log.info('Fetching deadlines', { tenantId })

    const supabase = await createServiceClient()

    // Fetch existing registrations
    const { data: registrations, error: regError } = await supabase
      .from('rnd_registrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('deadline_date', { ascending: true })

    if (regError) {
      console.error('[R&D Deadlines] Database error fetching registrations:', regError)
      return createErrorResponse(regError, { operation: 'fetchRegistrations', tenantId }, 500)
    }

    // Build map of registered FYs
    const registeredFYs = new Map<string, typeof registrations[0]>()
    for (const reg of registrations || []) {
      registeredFYs.set(reg.financial_year, reg)
    }

    // Fetch FYs with R&D candidates (untracked)
    let untrackedFYs: string[] = []
    if (includeUntracked) {
      const { data: rndCandidates, error: rndError } = await supabase
        .from('forensic_analysis_results')
        .select('financial_year')
        .eq('tenant_id', tenantId)
        .eq('is_rnd_candidate', true)

      if (!rndError && rndCandidates) {
        // Get unique FYs that don't have registrations
        const fySet = new Set<string>()
        for (const candidate of rndCandidates) {
          if (candidate.financial_year && !registeredFYs.has(candidate.financial_year)) {
            fySet.add(candidate.financial_year)
          }
        }
        untrackedFYs = Array.from(fySet)
      }
    }

    // Build deadline summaries
    const deadlines: RndDeadlineSummary[] = []

    // Add tracked registrations
    for (const reg of registrations || []) {
      const daysUntilDeadline = calculateDaysUntilDeadline(reg.deadline_date)
      const urgencyLevel = calculateUrgencyLevel(daysUntilDeadline, reg.registration_status)

      deadlines.push({
        financialYear: reg.financial_year,
        deadlineDate: reg.deadline_date,
        daysUntilDeadline,
        urgencyLevel,
        registrationStatus: reg.registration_status,
        eligibleExpenditure: reg.eligible_expenditure ? parseFloat(reg.eligible_expenditure) : undefined,
        estimatedOffset: reg.estimated_offset ? parseFloat(reg.estimated_offset) : undefined,
        ausindustryReference: reg.ausindustry_reference || undefined,
      })
    }

    // Add untracked FYs (R&D candidates without registration)
    for (const fy of untrackedFYs) {
      try {
        const deadlineDate = calculateDeadlineFromFY(fy)
        const daysUntilDeadline = calculateDaysUntilDeadline(deadlineDate)
        const urgencyLevel = calculateUrgencyLevel(daysUntilDeadline, 'not_started')

        // Skip if deadline has passed and it's untracked
        if (daysUntilDeadline < -365) {
          continue // Skip very old deadlines (> 1 year overdue)
        }

        deadlines.push({
          financialYear: fy,
          deadlineDate,
          daysUntilDeadline,
          urgencyLevel,
          registrationStatus: 'not_started',
        })
      } catch (_e) {
        console.warn(`[R&D Deadlines] Invalid FY format: ${fy}`)
      }
    }

    // Apply urgency filter if provided
    let filteredDeadlines = deadlines
    if (urgencyFilter) {
      filteredDeadlines = deadlines.filter((d) => d.urgencyLevel === urgencyFilter)
    }

    // Sort by urgency priority (critical first), then by deadline date
    filteredDeadlines.sort((a, b) => {
      const priorityA = URGENCY_CONFIG[a.urgencyLevel].priority
      const priorityB = URGENCY_CONFIG[b.urgencyLevel].priority

      if (priorityA !== priorityB) {
        return priorityB - priorityA // Higher priority first
      }

      return a.daysUntilDeadline - b.daysUntilDeadline
    })

    // Calculate alert counts
    const criticalCount = deadlines.filter((d) => d.urgencyLevel === 'critical').length
    const urgentCount = deadlines.filter((d) => d.urgencyLevel === 'urgent').length
    const approachingCount = deadlines.filter((d) => d.urgencyLevel === 'approaching').length
    const overdueCount = deadlines.filter((d) => d.urgencyLevel === 'overdue').length

    // Find next deadline (most urgent non-completed)
    const nextDeadline = filteredDeadlines.find(
      (d) => d.urgencyLevel !== 'completed' && d.daysUntilDeadline >= 0
    )

    return NextResponse.json({
      deadlines: filteredDeadlines,
      alerts: {
        critical: criticalCount,
        urgent: urgentCount,
        approaching: approachingCount,
        overdue: overdueCount,
        total: criticalCount + urgentCount + approachingCount + overdueCount,
      },
      nextDeadline: nextDeadline || null,
      summary: {
        total: filteredDeadlines.length,
        tracked: registrations?.length || 0,
        untracked: untrackedFYs.length,
        completed: deadlines.filter((d) => d.urgencyLevel === 'completed').length,
      },
    })
  } catch (error) {
    console.error('[R&D Deadlines] Error:', error)
    return createErrorResponse(error, { operation: 'getDeadlines' }, 500)
  }
}
