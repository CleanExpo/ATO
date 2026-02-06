/**
 * GET /api/audit/cached-transactions
 *
 * Get cached historical transactions from database.
 * Used after sync is complete to retrieve data for analysis.
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant ID
 * - financialYear: string (optional) - Filter by FY (e.g., 'FY2024-25')
 * - page: number (optional) - Page number (default: 1)
 * - pageSize: number (optional) - Items per page (default: 100, max: 1000)
 *
 * Response:
 * - transactions: HistoricalTransaction[]
 * - pagination: { page, pageSize, total, hasMore }
 * - summary: { totalAmount, transactionCount, dateRange }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { isSingleUserMode } from '@/lib/auth/single-user-check'

export async function GET(request: NextRequest) {
    try {
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
        const financialYear = request.nextUrl.searchParams.get('financialYear') || undefined
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10)
        const pageSize = Math.min(
            parseInt(request.nextUrl.searchParams.get('pageSize') || '100', 10),
            1000 // Max 1000 per page
        )

        // Validate pagination
        if (page < 1) {
            return createValidationError('page must be >= 1')
        }
        if (pageSize < 1) {
            return createValidationError('pageSize must be >= 1')
        }

        console.log(`Getting cached transactions for tenant ${tenantId}, FY: ${financialYear || 'all'}, page ${page}`)

        // Get total count first
        const supabase = await createServiceClient()

        let countQuery = supabase
            .from('historical_transactions_cache')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)

        if (financialYear) {
            countQuery = countQuery.eq('financial_year', financialYear)
        }

        const { count, error: countError } = await countQuery

        if (countError) {
            throw countError
        }

        const total = count || 0

        // Get paginated data
        let dataQuery = supabase
            .from('historical_transactions_cache')
            .select('raw_data, transaction_date, total_amount, contact_name, transaction_type, financial_year')
            .eq('tenant_id', tenantId)
            .order('transaction_date', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)

        if (financialYear) {
            dataQuery = dataQuery.eq('financial_year', financialYear)
        }

        const { data, error: dataError } = await dataQuery

        if (dataError) {
            throw dataError
        }

        // Extract raw transaction data
        const transactions = data.map(record => record.raw_data)

        // Calculate summary statistics
        const totalAmount = data.reduce((sum, record) => {
            return sum + (record.total_amount || 0)
        }, 0)

        const dates = data
            .map(record => record.transaction_date)
            .filter(d => d)
            .sort()

        const dateRange = dates.length > 0 ? {
            from: dates[0],
            to: dates[dates.length - 1]
        } : null

        // Group by financial year
        const byYear = data.reduce((acc, record) => {
            const year = record.financial_year || 'Unknown'
            acc[year] = (acc[year] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        return NextResponse.json({
            transactions,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
                hasMore: page * pageSize < total
            },
            summary: {
                totalAmount,
                transactionCount: data.length,
                totalTransactions: total,
                dateRange,
                byFinancialYear: byYear
            }
        })

    } catch (error) {
        console.error('Failed to get cached transactions:', error)
        return createErrorResponse(error, { operation: 'getCachedTransactions' }, 500)
    }
}
