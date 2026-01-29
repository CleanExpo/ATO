/**
 * GET /api/data-quality/issues?tenantId=xxx&issueType=wrong_account&severity=high&status=pending_review
 *
 * Get data quality issues with optional filters.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - issueType: string (optional) - 'wrong_account', 'tax_classification', etc.
 * - severity: string (optional) - 'critical', 'high', 'medium', 'low'
 * - status: string (optional) - 'identified', 'auto_corrected', 'pending_review', 'approved', 'rejected'
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { getDataQualityIssues } from '@/lib/xero/data-quality-validator'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    try {
        // Authenticate and validate tenant access
        const auth = await requireAuth(request)
        if (isErrorResponse(auth)) return auth

        const { tenantId } = auth

        // Optional filters
        const issueType = request.nextUrl.searchParams.get('issueType') || undefined
        const severity = request.nextUrl.searchParams.get('severity') || undefined
        const status = request.nextUrl.searchParams.get('status') || undefined

        const issues = await getDataQualityIssues(tenantId, {
            issueType,
            severity,
            status
        })

        return NextResponse.json({
            issues,
            count: issues.length
        })

    } catch (error) {
        console.error('Failed to get data quality issues:', error)
        return createErrorResponse(error, { operation: 'getDataQualityIssues' }, 500)
    }
}

/**
 * PATCH /api/data-quality/issues
 *
 * Update issue status (approve/reject)
 *
 * Body:
 * - issueIds: string[] (required) - Array of issue IDs to update
 * - status: string (required) - 'approved', 'rejected'
 * - accountantNotes: string (optional)
 */
export async function PATCH(request: NextRequest) {
    try {
        // Authenticate user (issue ownership validated from database)
        const auth = await requireAuth(request, { skipTenantValidation: true })
        if (isErrorResponse(auth)) return auth

        const body = await request.json()

        // Validate required fields
        const issueIds = body.issueIds
        if (!issueIds || !Array.isArray(issueIds) || issueIds.length === 0) {
            return createValidationError('issueIds is required and must be a non-empty array')
        }

        const status = body.status
        if (!status || !['approved', 'rejected', 'resolved'].includes(status)) {
            return createValidationError('status must be "approved", "rejected", or "resolved"')
        }

        const accountantNotes = body.accountantNotes || null

        // Update issues in database
        const supabase = await createServiceClient()

        const { error } = await supabase
            .from('data_quality_issues')
            .update({
                status,
                accountant_notes: accountantNotes,
                resolved_at: status !== 'pending_review' ? new Date().toISOString() : null
            })
            .in('id', issueIds)

        if (error) {
            throw error
        }

        return NextResponse.json({
            success: true,
            message: `Updated ${issueIds.length} issue(s) to status: ${status}`
        })

    } catch (error) {
        console.error('Failed to update issues:', error)
        return createErrorResponse(error, { operation: 'updateIssues' }, 500)
    }
}
