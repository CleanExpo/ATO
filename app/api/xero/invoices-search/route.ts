/**
 * GET /api/xero/invoices-search
 *
 * Search Xero invoices directly by contact name.
 * Use this to find unpaid invoices for bad debt identification.
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant ID
 * - search: string (required) - Contact name to search for
 * - status: string (optional) - Filter by status (e.g., 'AUTHORISED', 'PAID', 'VOIDED')
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import { createErrorResponse, createValidationError, createNotFoundError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import type { TokenSet } from 'xero-node'
import { createLogger } from '@/lib/logger'
import { decryptStoredToken, encryptTokenForStorage } from '@/lib/xero/token-store'

export const dynamic = 'force-dynamic'

const log = createLogger('api:xero:invoices-search')

/** Shape of a Xero invoice from the accounting API */
interface XeroInvoice {
    invoiceID?: string
    invoiceNumber?: string
    contact?: { name?: string }
    date?: string
    dueDate?: string
    total?: number
    amountPaid?: number
    amountDue?: number
    status?: string
    type?: string
    reference?: string
}

/** Formatted invoice for API response */
interface FormattedInvoice {
    invoiceId: string | undefined
    invoiceNumber: string | undefined
    contact: string | undefined
    date: string | undefined
    dueDate: string | undefined
    total: number
    amountPaid: number
    amountDue: number
    status: string | undefined
    type: string | undefined
    reference: string | undefined
    gstComponent?: number
    badDebtDeduction?: number
    gstRecovery?: number
}

// Helper to get valid token set for a tenant
async function getValidTokenSet(tenantId: string): Promise<TokenSet | null> {
    const supabase = await createServiceClient()

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

    // Refresh if expired
    if (isTokenExpired(tokenSet)) {
        try {
            const newTokens = await refreshXeroTokens(tokenSet)

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

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth(request, { tenantIdSource: 'query' })
        if (isErrorResponse(auth)) return auth

        const tenantId = request.nextUrl.searchParams.get('tenantId')
        const search = request.nextUrl.searchParams.get('search')
        const status = request.nextUrl.searchParams.get('status')

        if (!tenantId) {
            return createValidationError('tenantId is required')
        }
        if (!search) {
            return createValidationError('search is required')
        }

        log.info('Searching Xero invoices', { search, tenantId })

        const tokenSet = await getValidTokenSet(tenantId)
        if (!tokenSet) {
            return createNotFoundError('Xero connection')
        }

        const client = createXeroClient()
        client.setTokenSet(tokenSet)

        // Build where clause for contact name search
        // Xero API doesn't support partial contact name search in where clause
        // So we'll fetch all invoices and filter client-side
        // For better performance, also filter by type (ACCREC = sales invoices for bad debt)
        let whereClause = ''
        const includeReceivablesOnly = request.nextUrl.searchParams.get('receivablesOnly') === 'true'

        if (status) {
            whereClause = `Status=="${status}"`
        }

        // For bad debt searches, focus on sales invoices (ACCREC)
        if (includeReceivablesOnly) {
            whereClause = whereClause
                ? `${whereClause}&&Type=="ACCREC"`
                : 'Type=="ACCREC"'
        }

        // Fetch all invoices from Xero (paginated)
        let allInvoices: XeroInvoice[] = []
        let page = 1
        let hasMore = true

        while (hasMore && page <= 20) { // Max 20 pages (2000 invoices)
            const response = await client.accountingApi.getInvoices(
                tenantId,
                undefined,    // ifModifiedSince
                whereClause || undefined,  // where
                undefined,    // order
                undefined,    // ids
                undefined,    // invoiceNumbers
                undefined,    // contactIDs
                undefined,    // statuses
                page,         // page
                true          // includeArchived
            )

            const invoices = (response.body.invoices || []) as XeroInvoice[]
            allInvoices = allInvoices.concat(invoices)

            // Stop if we got less than 100 (default page size)
            if (invoices.length < 100) {
                hasMore = false
            }
            page++
        }

        log.info('Fetched invoices', { totalInvoices: allInvoices.length, pages: page - 1 })

        // Filter by contact name (case-insensitive partial match)
        const searchLower = search.toLowerCase()
        const matchingInvoices = allInvoices.filter(inv => {
            const contactName = inv.contact?.name?.toLowerCase() || ''
            return contactName.includes(searchLower)
        })

        // Calculate totals
        let totalOutstanding = 0
        let totalPaid = 0
        let totalVoided = 0
        const unpaidInvoices: FormattedInvoice[] = []
        const paidInvoices: FormattedInvoice[] = []

        for (const inv of matchingInvoices) {
            const amount = inv.total || 0
            const amountPaid = inv.amountPaid || 0
            const amountDue = inv.amountDue || 0

            if (inv.status === 'PAID') {
                totalPaid += amount
                paidInvoices.push({
                    invoiceId: inv.invoiceID,
                    invoiceNumber: inv.invoiceNumber,
                    contact: inv.contact?.name,
                    date: inv.date,
                    dueDate: inv.dueDate,
                    total: amount,
                    amountPaid: amountPaid,
                    amountDue: amountDue,
                    status: inv.status,
                    type: inv.type, // ACCREC = Sales Invoice, ACCPAY = Bill
                    reference: inv.reference
                })
            } else if (inv.status === 'VOIDED') {
                totalVoided += amount
            } else {
                // AUTHORISED, SUBMITTED, DRAFT
                totalOutstanding += amountDue
                unpaidInvoices.push({
                    invoiceId: inv.invoiceID,
                    invoiceNumber: inv.invoiceNumber,
                    contact: inv.contact?.name,
                    date: inv.date,
                    dueDate: inv.dueDate,
                    total: amount,
                    amountPaid: amountPaid,
                    amountDue: amountDue,
                    status: inv.status,
                    type: inv.type,
                    reference: inv.reference,
                    // Bad debt calculation
                    gstComponent: amount / 11, // GST = 1/11 of total (assuming GST-inclusive)
                    badDebtDeduction: amountDue, // Amount claimable under Section 25-35
                    gstRecovery: amountDue / 11 // GST recoverable on bad debt
                })
            }
        }

        // Sort unpaid by oldest first (potential bad debts)
        unpaidInvoices.sort((a, b) => new Date(a.dueDate || a.date || 0).getTime() - new Date(b.dueDate || b.date || 0).getTime())

        return NextResponse.json({
            search,
            tenantId,
            summary: {
                totalInvoicesFound: matchingInvoices.length,
                unpaidCount: unpaidInvoices.length,
                paidCount: paidInvoices.length,
                totalOutstanding,
                totalPaid,
                totalVoided,
                // Bad debt recovery potential
                potentialBadDebtDeduction: totalOutstanding,
                potentialGstRecovery: totalOutstanding / 11 // GST component
            },
            unpaidInvoices,
            paidInvoices: paidInvoices.slice(0, 10) // Only return last 10 paid for reference
        })

    } catch (error) {
        console.error('Failed to search Xero invoices:', error)
        return createErrorResponse(error, { operation: 'searchXeroInvoices' }, 500)
    }
}
