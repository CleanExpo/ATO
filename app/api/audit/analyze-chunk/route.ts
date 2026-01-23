/**
 * POST /api/audit/analyze-chunk
 *
 * Chunked AI analysis - analyzes ONE transaction at a time to work within Vercel's timeout.
 * Client should call repeatedly until allComplete is true.
 *
 * Body:
 * - tenantId: string (required)
 * - businessName?: string
 * - abn?: string
 * - industry?: string
 *
 * Response:
 * - success: boolean
 * - transactionAnalyzed: object (the transaction that was analyzed)
 * - analysis: object (the forensic analysis result)
 * - remaining: number (transactions left to analyze)
 * - allComplete: boolean
 * - progress: object
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { analyzeTransaction, type TransactionContext, type BusinessContext } from '@/lib/ai/forensic-analyzer'
import { createErrorResponse } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'

export const maxDuration = 30 // Vercel serverless max

export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        // Authenticate and validate tenant access (tenantId from body)
        const auth = await requireAuth(request, { tenantIdSource: 'body' })
        if (isErrorResponse(auth)) return auth

        const { tenantId } = auth
        const body = await request.json()
        
        const businessContext: BusinessContext = {
            name: body.businessName || 'Unknown Business',
            abn: body.abn,
            industry: body.industry,
            financialYear: new Date().getFullYear().toString()
        }
        
        const supabase = await createServiceClient()
        
        // Get next unanalyzed transaction
        const { data: transactions, error: fetchError } = await supabase
            .from('historical_transactions_cache')
            .select('*')
            .eq('tenant_id', tenantId)
            .is('analysis_complete', null)
            .limit(1)
        
        if (fetchError) {
            console.error('[analyze-chunk] Fetch error:', fetchError)
            return createErrorResponse(fetchError, { operation: 'fetchTransaction' }, 500)
        }
        
        // Check if all done
        if (!transactions || transactions.length === 0) {
            // Count total analyzed
            const { count: totalAnalyzed } = await supabase
                .from('historical_transactions_cache')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .eq('analysis_complete', true)
            
            return NextResponse.json({
                success: true,
                allComplete: true,
                totalAnalyzed: totalAnalyzed || 0,
                message: 'All transactions have been analyzed'
            })
        }
        
        const txn = transactions[0]
        
        // Transform to TransactionContext
        const rawData = txn.raw_data || {}
        const transactionContext: TransactionContext = {
            transactionID: txn.transaction_id,
            date: txn.transaction_date || rawData.date,
            description: getDescription(rawData),
            amount: txn.amount || rawData.total || 0,
            supplier: txn.contact_name || rawData.contact?.name,
            accountCode: rawData.lineItems?.[0]?.accountCode,
            lineItems: rawData.lineItems
        }
        
        console.log(`[analyze-chunk] Analyzing: ${transactionContext.transactionID} - ${transactionContext.description?.slice(0, 50)}...`)
        
        // Run AI analysis
        const analysis = await analyzeTransaction(transactionContext, businessContext)
        
        // Store results
        const { error: updateError } = await supabase
            .from('historical_transactions_cache')
            .update({
                analysis_complete: true,
                analysis_result: analysis,
                analyzed_at: new Date().toISOString()
            })
            .eq('tenant_id', tenantId)
            .eq('transaction_id', txn.transaction_id)
        
        if (updateError) {
            console.error('[analyze-chunk] Update error:', updateError)
        }
        
        // Count remaining
        const { count: remaining } = await supabase
            .from('historical_transactions_cache')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .is('analysis_complete', null)
        
        const { count: totalAnalyzed } = await supabase
            .from('historical_transactions_cache')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('analysis_complete', true)
        
        const processingTime = Date.now() - startTime
        
        console.log(`[analyze-chunk] Complete in ${processingTime}ms. Remaining: ${remaining}`)
        
        return NextResponse.json({
            success: true,
            allComplete: remaining === 0,
            transactionAnalyzed: {
                id: txn.transaction_id,
                date: txn.transaction_date,
                description: transactionContext.description?.slice(0, 100),
                amount: transactionContext.amount
            },
            analysis: {
                categories: analysis.categories,
                isRndCandidate: analysis.rndAssessment.isRndCandidate,
                isFullyDeductible: analysis.deductionEligibility.isFullyDeductible,
                division7aRisk: analysis.complianceFlags.division7aRisk,
                fbtImplications: analysis.complianceFlags.fbtImplications
            },
            progress: {
                analyzed: totalAnalyzed || 0,
                remaining: remaining || 0,
                total: (totalAnalyzed || 0) + (remaining || 0),
                percentComplete: (((totalAnalyzed || 0) / ((totalAnalyzed || 0) + (remaining || 0))) * 100).toFixed(1)
            },
            timing: {
                processingMs: processingTime
            }
        })
        
    } catch (error) {
        console.error('[analyze-chunk] Error:', error)
        return createErrorResponse(error, { operation: 'analyzeChunk' }, 500)
    }
}

function getDescription(rawData: Record<string, unknown>): string {
    // Try various fields for description
    if (rawData.reference) return String(rawData.reference)
    if (rawData.narration) return String(rawData.narration)
    
    // For invoices, combine line item descriptions
    const lineItems = rawData.lineItems as Array<{ description?: string }> | undefined
    if (lineItems && lineItems.length > 0) {
        const descriptions = lineItems
            .filter(li => li.description)
            .map(li => li.description)
            .join('; ')
        if (descriptions) return descriptions
    }
    
    // For bank transactions
    if (rawData.bankAccount) {
        const bankAccount = rawData.bankAccount as { name?: string }
        return `Bank Transaction - ${bankAccount.name || 'Unknown'}`
    }
    
    return 'No description available'
}

// GET endpoint to check progress
export async function GET(request: NextRequest) {
    // Authenticate and validate tenant access
    const auth = await requireAuth(request)
    if (isErrorResponse(auth)) return auth

    const { tenantId } = auth
    const supabase = await createServiceClient()
    
    const { count: totalAnalyzed } = await supabase
        .from('historical_transactions_cache')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('analysis_complete', true)
    
    const { count: remaining } = await supabase
        .from('historical_transactions_cache')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('analysis_complete', null)
    
    const total = (totalAnalyzed || 0) + (remaining || 0)
    
    return NextResponse.json({
        analyzed: totalAnalyzed || 0,
        remaining: remaining || 0,
        total,
        percentComplete: total > 0 ? (((totalAnalyzed || 0) / total) * 100).toFixed(1) : '0',
        allComplete: remaining === 0 && total > 0
    })
}
