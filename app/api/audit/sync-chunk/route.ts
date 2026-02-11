/**
 * POST /api/audit/sync-chunk
 *
 * Chunked sync endpoint - fetches ONE page at a time to work within Vercel's timeout limits.
 * Client should call repeatedly until hasMore is false.
 *
 * Body:
 * - tenantId: string (required) - Xero tenant ID
 * - year: string (optional) - Financial year like "FY24-25" (defaults to current)
 * - type: string (optional) - Transaction type: "BANK", "ACCPAY", "ACCREC" (defaults to "BANK")
 * - page: number (optional) - Page number (defaults to 1)
 *
 * Response:
 * - success: boolean
 * - fetched: number - Transactions fetched this page
 * - cached: number - Transactions cached to database
 * - hasMore: boolean - Whether there are more pages for this type/year
 * - nextPage: number - Next page to fetch (if hasMore)
 * - nextType: string - Next transaction type (if current type done)
 * - nextYear: string - Next year (if current year done)
 * - allComplete: boolean - Whether ALL data has been synced
 * - progress: object - Current progress info
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import { createErrorResponse, createValidationError, createNotFoundError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { getFinancialYears } from '@/lib/types'
import type { TokenSet } from 'xero-node'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createLogger } from '@/lib/logger'
import { decryptStoredToken, encryptTokenForStorage } from '@/lib/xero/token-store'

export const dynamic = 'force-dynamic'

const log = createLogger('api:audit:sync-chunk')

/** Shape of a raw Xero transaction (union of invoice/bank transaction fields) */
interface RawXeroTransaction {
    bankTransactionID?: string
    invoiceID?: string
    transactionID?: string
    type?: string
    date?: string
    contact?: { name?: string }
    total?: number
    status?: string
    reference?: string
}

const PAGE_SIZE = 100
const TRANSACTION_TYPES = ['BANK', 'ACCPAY', 'ACCREC'] as const

// Get valid token set for a tenant
async function getValidTokenSet(tenantId: string, baseUrl?: string): Promise<TokenSet | null> {
    const supabase = createAdminClient()

    const { data: connection, error } = await supabase
        .from('xero_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

    if (error || !connection) {
        return null
    }

    // Decrypt tokens from database (SEC-001)
    const tokenSet = {
        access_token: decryptStoredToken(connection.access_token),
        refresh_token: decryptStoredToken(connection.refresh_token),
        expires_at: connection.expires_at,
        id_token: connection.id_token,
        scope: connection.scope,
        token_type: 'Bearer'
    } as TokenSet

    if (isTokenExpired(tokenSet)) {
        try {
            const newTokens = await refreshXeroTokens(tokenSet, baseUrl)
            // Encrypt new tokens before storage (SEC-001)
            await supabase
                .from('xero_connections')
                .update({
                    access_token: encryptTokenForStorage(newTokens.access_token),
                    refresh_token: encryptTokenForStorage(newTokens.refresh_token),
                    expires_at: newTokens.expires_at,
                    id_token: newTokens.id_token,
                    scope: newTokens.scope,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', tenantId)
            return newTokens
        } catch (error) {
            console.error('Failed to refresh Xero tokens:', error)
            return null
        }
    }

    return tokenSet
}

export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        const baseUrl = request.nextUrl.origin
        const body = await request.json()
        let tenantId: string

        if (isSingleUserMode()) {
            // Single-user mode: Get tenantId from body
            tenantId = body.tenantId
            if (!tenantId) {
                return createValidationError('tenantId is required')
            }
        } else {
            // Multi-user mode: Authenticate and validate tenant access
            const auth = await requireAuth(request, { tenantIdSource: 'body' })
            if (isErrorResponse(auth)) return auth
            tenantId = auth.tenantId
        }

        // Get financial years
        const financialYears = getFinancialYears().slice(0, 5) // Last 5 years
        
        // Parse optional fields with defaults
        const year = body.year || financialYears[0].value
        const type = body.type || 'BANK'
        const page = body.page || 1

        // Find the financial year object
        const fy = financialYears.find(f => f.value === year)
        if (!fy) {
            return createValidationError(`Invalid year: ${year}. Valid years: ${financialYears.map(f => f.value).join(', ')}`)
        }

        log.info('Fetching transactions', { type, page, year, tenantId })

        // Get valid token set
        const tokenSet = await getValidTokenSet(tenantId, baseUrl)
        if (!tokenSet || !tokenSet.access_token) {
            return createNotFoundError('Xero connection')
        }

        // Create Xero client
        const xero = createXeroClient()
        await xero.initialize()
        xero.setTokenSet(tokenSet)

        // Fetch ONE page of transactions
        const where = `Date >= DateTime(${fy.startDate.replace(/-/g, ',')}) AND Date <= DateTime(${fy.endDate.replace(/-/g, ',')})`
        
        let transactions: RawXeroTransaction[] = []

        if (type === 'ACCPAY' || type === 'ACCREC') {
            const invResponse = await xero.accountingApi.getInvoices(
                tenantId,
                undefined,
                where,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                page
            )
            transactions = (invResponse.body.invoices || []) as unknown as RawXeroTransaction[]
        } else if (type === 'BANK') {
            const bankResponse = await xero.accountingApi.getBankTransactions(
                tenantId,
                undefined,
                where,
                undefined,
                page
            )
            transactions = (bankResponse.body.bankTransactions || []) as unknown as RawXeroTransaction[]
        }

        const fetchTime = Date.now() - startTime
        log.info('Fetched transactions', { count: transactions.length, type, fetchTimeMs: fetchTime })

        // Cache transactions to database
        const supabase = createAdminClient()
        let cachedCount = 0

        if (transactions.length > 0) {
            const cacheRecords = transactions
                .map(txn => {
                    const transactionId = txn.bankTransactionID || txn.invoiceID || txn.transactionID
                    if (!transactionId) return null

                    return {
                        tenant_id: tenantId,
                        transaction_id: transactionId,
                        transaction_type: txn.type || type,
                        transaction_date: txn.date,
                        financial_year: year,
                        contact_name: txn.contact?.name || null,
                        total_amount: txn.total || null,
                        status: txn.status || null,
                        reference: txn.reference || null,
                        raw_data: txn
                    }
                })
                .filter(r => r !== null)

            if (cacheRecords.length > 0) {
                const { error } = await supabase
                    .from('historical_transactions_cache')
                    .upsert(cacheRecords, {
                        onConflict: 'tenant_id,transaction_id',
                        ignoreDuplicates: false
                    })

                if (error) {
                    console.error('[sync-chunk] Cache error:', error)
                    // Return error details for debugging
                    return NextResponse.json({
                        success: false,
                        error: 'Database cache error',
                        errorDetails: {
                            message: error.message,
                            code: error.code,
                            details: error.details,
                            hint: error.hint
                        },
                        fetched: transactions.length,
                        recordsAttempted: cacheRecords.length,
                        sampleRecord: cacheRecords[0] ? {
                            tenant_id: cacheRecords[0].tenant_id,
                            transaction_id: cacheRecords[0].transaction_id,
                            transaction_date: cacheRecords[0].transaction_date,
                            financial_year: cacheRecords[0].financial_year
                        } : null
                    }, { status: 500 })
                } else {
                    cachedCount = cacheRecords.length
                }
            }
        }

        // Determine next step
        const hasMorePages = transactions.length >= PAGE_SIZE
        
        let nextPage = hasMorePages ? page + 1 : 1
        let nextType = type
        let nextYear = year
        let allComplete = false

        if (!hasMorePages) {
            // Move to next type
            const typeIndex = (TRANSACTION_TYPES as readonly string[]).indexOf(type)
            if (typeIndex < TRANSACTION_TYPES.length - 1) {
                nextType = TRANSACTION_TYPES[typeIndex + 1]
                nextPage = 1
            } else {
                // Move to next year
                const yearIndex = financialYears.findIndex(f => f.value === year)
                if (yearIndex < financialYears.length - 1) {
                    nextYear = financialYears[yearIndex + 1].value
                    nextType = TRANSACTION_TYPES[0]
                    nextPage = 1
                } else {
                    // All done!
                    allComplete = true
                }
            }
        }

        // Update sync progress in database
        await supabase
            .from('audit_sync_status')
            .upsert({
                tenant_id: tenantId,
                sync_status: allComplete ? 'complete' : 'syncing',
                sync_progress: calculateProgress(year, type, page, financialYears),
                current_year: year,
                last_sync_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'tenant_id'
            })

        const totalTime = Date.now() - startTime
        log.info('Sync chunk complete', { totalTimeMs: totalTime, cachedCount, hasMore: !allComplete })

        return NextResponse.json({
            success: true,
            fetched: transactions.length,
            cached: cachedCount,
            hasMore: hasMorePages,
            nextPage: hasMorePages ? nextPage : 1,
            nextType: allComplete ? null : nextType,
            nextYear: allComplete ? null : nextYear,
            allComplete,
            currentProgress: {
                year,
                type,
                page,
                transactionsFetched: transactions.length
            },
            timing: {
                fetchMs: fetchTime,
                totalMs: totalTime
            }
        })

    } catch (error) {
        console.error('[sync-chunk] Error:', error)
        return createErrorResponse(error, { operation: 'syncChunk' }, 500)
    }
}

function calculateProgress(
    currentYear: string,
    currentType: string,
    _currentPage: number,
    allYears: Array<{ value: string }>
): number {
    const yearIndex = allYears.findIndex(f => f.value === currentYear)
    const typeIndex = (TRANSACTION_TYPES as readonly string[]).indexOf(currentType)
    
    // Rough progress calculation
    const yearProgress = (yearIndex / allYears.length) * 100
    const typeProgress = ((typeIndex + 1) / TRANSACTION_TYPES.length) * (100 / allYears.length)
    
    return Math.min(99, yearProgress + typeProgress)
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
    let tenantId: string

    if (isSingleUserMode()) {
        // Single-user mode: Get tenantId from query
        tenantId = request.nextUrl.searchParams.get('tenantId') || ''
        if (!tenantId) {
            return createValidationError('tenantId is required')
        }
    } else {
        // Multi-user mode: Authenticate and validate tenant access
        const auth = await requireAuth(request)
        if (isErrorResponse(auth)) return auth
        tenantId = auth.tenantId
    }
    const supabase = createAdminClient()
    
    const { data: status } = await supabase
        .from('audit_sync_status')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

    const { count } = await supabase
        .from('historical_transactions_cache')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)

    return NextResponse.json({
        status: status?.sync_status || 'idle',
        progress: status?.sync_progress || 0,
        currentYear: status?.current_year,
        totalCached: count || 0,
        lastSync: status?.last_sync_at
    })
}
