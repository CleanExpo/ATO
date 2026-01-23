/**
 * POST /api/data-quality/scan
 *
 * Start data quality scan for forensic validation.
 * Scans all cached transactions for integrity issues.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYears: string[] (required) - e.g., ['FY2024-25', 'FY2023-24']
 * - issueTypes: string[] (optional) - Filter specific issue types
 * - autoFixThreshold: number (optional) - Default: 90
 */

import { NextRequest, NextResponse } from 'next/server'
import { createValidationError, createErrorResponse } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { scanForDataQualityIssues, getScanStatus } from '@/lib/xero/data-quality-validator'
import { applyAutoCorrestions } from '@/lib/xero/auto-correction-engine'
import { createServiceClient } from '@/lib/supabase/server'

interface ScanStatus {
    scan_status: string
    scan_progress: string | number | null
    transactions_scanned: number
    issues_found: number
    issues_auto_corrected: number
    issues_pending_review: number
    wrong_account_count: number
    tax_classification_count: number
    unreconciled_count: number
    misallocated_count: number
    duplicate_count: number
    total_impact_amount: string | number | null
    last_scan_at: string | null
    error_message: string | null
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate and validate tenant access (tenantId from body)
        const auth = await requireAuth(request, { tenantIdSource: 'body' })
        if (isErrorResponse(auth)) return auth

        const { tenantId } = auth
        const body = await request.json()

        const financialYears = body.financialYears
        if (!financialYears || !Array.isArray(financialYears) || financialYears.length === 0) {
            return createValidationError('financialYears is required and must be a non-empty array')
        }

        // Optional parameters
        const issueTypes = body.issueTypes
        const autoFixThreshold = body.autoFixThreshold || 90
        const applyCorrections = body.applyCorrections !== false  // Default true

        console.log(`Starting data quality scan for tenant ${tenantId}`)
        console.log(`Financial years: ${financialYears.join(', ')}`)
        console.log(`Auto-fix threshold: ${autoFixThreshold}%`)

        // Check if already scanning
        const currentStatus = await getScanStatus(tenantId)
        if (currentStatus && currentStatus.scan_status === 'scanning') {
            return NextResponse.json({
                status: 'scanning',
                progress: currentStatus.scan_progress,
                message: 'Scan already in progress'
            })
        }

        // Start scan in background
        scanForDataQualityIssues({
            tenantId,
            financialYears,
            issueTypes,
            autoFixThreshold,
            onProgress: (progress, message) => {
                console.log(`Scan progress: ${progress.toFixed(0)}% - ${message}`)
            }
        }).then(async (scanResult) => {
            console.log(`✅ Scan complete: ${scanResult.issuesFound} issues found`)

            // Apply auto-corrections if enabled
            if (applyCorrections && scanResult.issues.length > 0) {
                console.log('Applying auto-corrections...')

                // Get Xero tokens
                const supabase = await createServiceClient()
                const { data: connection } = await supabase
                    .from('xero_connections')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .maybeSingle()

                if (connection) {
                    await applyAutoCorrestions(scanResult.issues, {
                        tenantId,
                        accessToken: connection.access_token,
                        refreshToken: connection.refresh_token,
                        autoFixThreshold
                    })
                }
            }
        }).catch(error => {
            console.error('Data quality scan failed:', error)
        })

        // Return immediate response
        return NextResponse.json({
            status: 'scanning',
            progress: 0,
            message: `Started data quality scan for ${financialYears.length} years. Poll /api/data-quality/scan?tenantId=${tenantId} for progress.`,
            pollUrl: `/api/data-quality/scan?tenantId=${tenantId}`
        })

    } catch (error) {
        console.error('Failed to start data quality scan:', error)
        return createErrorResponse(error, { operation: 'startDataQualityScan' }, 500)
    }
}

// GET /api/data-quality/scan?tenantId=xxx
// Check scan status
export async function GET(request: NextRequest) {
    try {
        // Authenticate and validate tenant access
        const auth = await requireAuth(request)
        if (isErrorResponse(auth)) return auth

        const { tenantId } = auth
        const rawStatus = await getScanStatus(tenantId)

        if (!rawStatus) {
            return NextResponse.json({
                status: 'idle',
                progress: 0,
                transactionsScanned: 0,
                issuesFound: 0,
                issuesAutoCorrected: 0,
                issuesPendingReview: 0,
                issuesByType: {
                    wrongAccount: 0,
                    taxClassification: 0,
                    unreconciled: 0,
                    misallocated: 0,
                    duplicate: 0
                },
                totalImpactAmount: 0,
                lastScanAt: null,
                errorMessage: null,
                message: 'No scan has been started yet'
            })
        }

        const status = rawStatus as unknown as ScanStatus

        return NextResponse.json({
            status: status.scan_status,
            progress: parseFloat(String(status.scan_progress ?? '0')),
            transactionsScanned: status.transactions_scanned || 0,
            issuesFound: status.issues_found || 0,
            issuesAutoCorrected: status.issues_auto_corrected || 0,
            issuesPendingReview: status.issues_pending_review || 0,
            issuesByType: {
                wrongAccount: status.wrong_account_count || 0,
                taxClassification: status.tax_classification_count || 0,
                unreconciled: status.unreconciled_count || 0,
                misallocated: status.misallocated_count || 0,
                duplicate: status.duplicate_count || 0
            },
            totalImpactAmount: parseFloat(String(status.total_impact_amount ?? '0')),
            lastScanAt: status.last_scan_at,
            errorMessage: status.error_message,
            message: getStatusMessage(status.scan_status, parseFloat(String(status.scan_progress ?? '0')))
        })

    } catch (error) {
        console.error('Failed to get scan status:', error)
        return createErrorResponse(error, { operation: 'getScanStatus' }, 500)
    }
}

function getStatusMessage(status: string, progress: number): string {
    switch (status) {
        case 'idle':
            return 'No scan in progress'
        case 'scanning':
            return `Scanning... ${progress.toFixed(0)}% complete`
        case 'complete':
            return 'Scan complete'
        case 'error':
            return 'Scan failed - check errorMessage'
        default:
            return 'Unknown status'
    }
}
