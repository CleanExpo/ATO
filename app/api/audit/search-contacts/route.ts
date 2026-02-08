/**
 * GET /api/audit/search-contacts
 *
 * Search cached transactions by contact name for bad debt identification.
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant ID
 * - search: string (required) - Contact name to search for (case-insensitive)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:audit:search-contacts')

export async function GET(request: NextRequest) {
    try {
        const tenantId = request.nextUrl.searchParams.get('tenantId')
        const search = request.nextUrl.searchParams.get('search')

        if (!tenantId) {
            return createValidationError('tenantId is required')
        }
        if (!search) {
            return createValidationError('search is required')
        }

        log.info('Searching contacts', { search, tenantId })

        const supabase = await createServiceClient()

        // Search for transactions with matching contact name
        const { data, error } = await supabase
            .from('historical_transactions_cache')
            .select('transaction_id, contact_name, total_amount, transaction_date, financial_year, transaction_type, raw_data')
            .eq('tenant_id', tenantId)
            .ilike('contact_name', `%${search}%`)
            .order('transaction_date', { ascending: false })
            .limit(500)

        if (error) {
            throw error
        }

        // Calculate totals by contact
        interface ContactTransaction {
            id: string;
            date: string | null;
            amount: number | null;
            type: string | null;
            year: string | null;
        }
        const contactTotals: Record<string, { count: number; totalReceived: number; totalPaid: number; transactions: ContactTransaction[] }> = {}

        for (const tx of data || []) {
            const contact = tx.contact_name || 'Unknown'
            if (!contactTotals[contact]) {
                contactTotals[contact] = { count: 0, totalReceived: 0, totalPaid: 0, transactions: [] }
            }
            contactTotals[contact].count++

            const amount = Math.abs(tx.total_amount || 0)
            // RECEIVE = money coming in (customer payment), SPEND = money going out
            if (tx.transaction_type === 'RECEIVE') {
                contactTotals[contact].totalReceived += amount
            } else {
                contactTotals[contact].totalPaid += amount
            }

            contactTotals[contact].transactions.push({
                id: tx.transaction_id,
                date: tx.transaction_date,
                amount: tx.total_amount,
                type: tx.transaction_type,
                year: tx.financial_year
            })
        }

        return NextResponse.json({
            search,
            tenantId,
            totalFound: data?.length || 0,
            contacts: contactTotals,
            transactions: data?.map(tx => ({
                id: tx.transaction_id,
                contact: tx.contact_name,
                amount: tx.total_amount,
                date: tx.transaction_date,
                type: tx.transaction_type,
                year: tx.financial_year
            }))
        })

    } catch (error) {
        console.error('Failed to search contacts:', error)
        return createErrorResponse(error, { operation: 'searchContacts' }, 500)
    }
}
