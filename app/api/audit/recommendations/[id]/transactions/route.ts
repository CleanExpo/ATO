/**
 * GET /api/audit/recommendations/:id/transactions
 *
 * Get transaction details for a specific recommendation.
 * Returns the underlying transactions that support the recommendation,
 * with Xero deep links for easy verification.
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant ID
 * - limit: number (optional, default: 20, max: 100)
 * - offset: number (optional, default: 0)
 *
 * Response:
 * - transactions: Array of transaction details with Xero URLs
 * - summary: Subtotals by year and category
 * - pagination: { limit, offset, total, hasMore }
 * - recommendation: Core recommendation data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError, createNotFoundError } from '@/lib/api/errors'
import { getRecommendation } from '@/lib/recommendations/recommendation-engine'
import { generateXeroUrl } from '@/lib/xero/url-generator'
import { isSingleUserMode } from '@/lib/auth/single-user-check'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface TransactionDetail {
  transactionId: string
  transactionDate: string
  transactionType: string
  contactName: string | null
  description: string
  amount: number
  accountCode: string | null
  accountName: string | null
  taxType: string | null
  financialYear: string
  xeroUrl: string | null
  lineItems: Array<{
    description: string
    amount: number
    accountCode: string
  }>
}

export interface TransactionsSummary {
  totalAmount: number
  transactionCount: number
  byFinancialYear: Record<string, { count: number; amount: number }>
  byCategory: Record<string, { count: number; amount: number }>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication
    let tenantId: string
    if (isSingleUserMode()) {
      tenantId = request.nextUrl.searchParams.get('tenantId') || ''
      if (!tenantId) {
        return createValidationError('tenantId is required')
      }
    } else {
      return createValidationError('Multi-user mode not implemented')
    }

    const { id: recommendationId } = await params
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT), 10),
      MAX_LIMIT
    )
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10)

    console.log(`[transactions] Fetching transactions for recommendation ${recommendationId}`)

    // Get the recommendation to get transaction IDs
    const recommendation = await getRecommendation(tenantId, recommendationId)
    if (!recommendation) {
      return createNotFoundError(`Recommendation ${recommendationId}`)
    }

    const transactionIds = recommendation.transactionIds || []

    console.log(`[transactions] Found ${transactionIds.length} transaction IDs`)

    // If no transactions, return empty result
    if (transactionIds.length === 0) {
      return NextResponse.json({
        transactions: [],
        summary: {
          totalAmount: 0,
          transactionCount: 0,
          byFinancialYear: {},
          byCategory: {},
        },
        pagination: { limit, offset, total: 0, hasMore: false },
        recommendation: {
          id: recommendation.id,
          action: recommendation.action,
          description: recommendation.description,
          taxArea: recommendation.taxArea,
          financialYear: recommendation.financialYear,
          estimatedBenefit: recommendation.estimatedBenefit,
          adjustedBenefit: recommendation.adjustedBenefit,
          confidence: recommendation.confidence,
          legislativeReference: recommendation.legislativeReference,
          documentationRequired: recommendation.documentationRequired,
          supportingEvidence: recommendation.supportingEvidence,
        },
      })
    }

    // Fetch transactions from cache
    const supabase = await createServiceClient()

    // Get total count
    const { count: totalCount } = await supabase
      .from('historical_transactions_cache')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('transaction_id', transactionIds)

    // Get paginated transactions (sorted by amount descending - highest first)
    const { data: cachedTransactions, error } = await supabase
      .from('historical_transactions_cache')
      .select('transaction_id, transaction_type, transaction_date, contact_name, description, account_code, account_name, tax_type, amount, line_items, financial_year, raw_data')
      .eq('tenant_id', tenantId)
      .in('transaction_id', transactionIds)
      .order('amount', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[transactions] Database error:', error)
      throw error
    }

    console.log(`[transactions] Retrieved ${cachedTransactions?.length || 0} transactions from cache`)

    // Transform to detailed transactions with Xero URLs
    const transactions: TransactionDetail[] = (cachedTransactions || []).map((cached) => {
      const rawData = (cached.raw_data || {}) as Record<string, unknown>
      const lineItems = (cached.line_items || rawData?.lineItems || []) as Array<Record<string, unknown>>

      // Build description from various sources
      let description = cached.description || ''
      if (!description && lineItems.length > 0) {
        description = (lineItems[0]?.description as string) || ''
      }
      if (!description && rawData?.reference) {
        description = rawData.reference as string
      }
      if (!description) {
        description = 'No description available'
      }

      // Get contact name from various sources
      let contactName = cached.contact_name
      if (!contactName && rawData?.contact) {
        const contact = rawData.contact as Record<string, unknown>
        contactName = contact?.name as string || null
      }

      return {
        transactionId: cached.transaction_id,
        transactionDate: cached.transaction_date,
        transactionType: cached.transaction_type || 'UNKNOWN',
        contactName,
        description,
        amount: Math.abs(cached.amount || 0),
        accountCode: cached.account_code || (lineItems[0]?.accountCode as string) || null,
        accountName: cached.account_name || (lineItems[0]?.accountName as string) || null,
        taxType: cached.tax_type || (lineItems[0]?.taxType as string) || null,
        financialYear: cached.financial_year || 'Unknown',
        xeroUrl: generateXeroUrl({
          transactionId: cached.transaction_id,
          transactionType: cached.transaction_type || '',
          rawData,
        }),
        lineItems: lineItems.slice(0, 5).map((li) => ({
          description: (li.description as string) || '',
          amount: Math.abs((li.lineAmount as number) || (li.unitAmount as number) || 0),
          accountCode: (li.accountCode as string) || '',
        })),
      }
    })

    // Calculate summary (for all transactions, not just paginated)
    const { data: allTransactions } = await supabase
      .from('historical_transactions_cache')
      .select('amount, financial_year, account_code, account_name')
      .eq('tenant_id', tenantId)
      .in('transaction_id', transactionIds)

    const summary: TransactionsSummary = {
      totalAmount: 0,
      transactionCount: totalCount || 0,
      byFinancialYear: {},
      byCategory: {},
    }

    ;(allTransactions || []).forEach((txn) => {
      const amount = Math.abs(txn.amount || 0)
      summary.totalAmount += amount

      // By financial year
      const fy = txn.financial_year || 'Unknown'
      if (!summary.byFinancialYear[fy]) {
        summary.byFinancialYear[fy] = { count: 0, amount: 0 }
      }
      summary.byFinancialYear[fy].count++
      summary.byFinancialYear[fy].amount += amount

      // By category (account code/name)
      const category = txn.account_name || txn.account_code || 'Uncategorised'
      if (!summary.byCategory[category]) {
        summary.byCategory[category] = { count: 0, amount: 0 }
      }
      summary.byCategory[category].count++
      summary.byCategory[category].amount += amount
    })

    return NextResponse.json({
      transactions,
      summary,
      pagination: {
        limit,
        offset,
        total: totalCount || 0,
        hasMore: offset + limit < (totalCount || 0),
      },
      recommendation: {
        id: recommendation.id,
        action: recommendation.action,
        description: recommendation.description,
        taxArea: recommendation.taxArea,
        financialYear: recommendation.financialYear,
        estimatedBenefit: recommendation.estimatedBenefit,
        adjustedBenefit: recommendation.adjustedBenefit,
        confidence: recommendation.confidence,
        legislativeReference: recommendation.legislativeReference,
        documentationRequired: recommendation.documentationRequired,
        supportingEvidence: recommendation.supportingEvidence,
        atoForms: recommendation.atoForms,
        deadline: recommendation.deadline,
      },
    })
  } catch (error) {
    console.error('[transactions] Failed to get recommendation transactions:', error)
    return createErrorResponse(error, { operation: 'getRecommendationTransactions' }, 500)
  }
}
