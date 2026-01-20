/**
 * POST /api/audit/analyze
 *
 * Start AI forensic analysis of cached transactions.
 * Uses Google AI (Gemini) to perform deep analysis for tax optimization.
 *
 * Body:
 * - tenantId: string (required)
 * - businessName?: string (optional - will fetch from DB if not provided)
 * - industry?: string (optional)
 * - abn?: string (optional)
 * - batchSize?: number (optional, default: 50)
 *
 * Response:
 * - status: 'analyzing' | 'complete' | 'error'
 * - progress: number (0-100)
 * - transactionsAnalyzed: number
 * - totalTransactions: number
 * - estimatedCostUSD: number
 * - message: string
 * - pollUrl: string
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { analyzeAllTransactions, getAnalysisStatus } from '@/lib/ai/batch-processor'
import { estimateAnalysisCost } from '@/lib/ai/forensic-analyzer'
import { getCachedTransactions } from '@/lib/xero/historical-fetcher'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Validate required fields
        const tenantId = body.tenantId
        if (!tenantId || typeof tenantId !== 'string') {
            return createValidationError('tenantId is required and must be a string')
        }

        // Parse optional fields
        const businessName = body.businessName
        const industry = body.industry
        const abn = body.abn
        const batchSize = body.batchSize && typeof body.batchSize === 'number' ? body.batchSize : 50

        // Validate batch size
        if (batchSize < 1 || batchSize > 100) {
            return createValidationError('batchSize must be between 1 and 100')
        }

        console.log(`Starting AI analysis for tenant ${tenantId}`)

        // Check if already analyzing
        const currentStatus = await getAnalysisStatus(tenantId)
        if (currentStatus && currentStatus.status === 'analyzing') {
            return NextResponse.json({
                status: 'analyzing',
                progress: currentStatus.progress,
                transactionsAnalyzed: currentStatus.transactionsAnalyzed,
                totalTransactions: currentStatus.totalTransactions,
                estimatedCostUSD: currentStatus.estimatedCostUSD,
                message: 'Analysis already in progress'
            })
        }

        // Check if cached data exists
        const cachedCount = await getCachedTransactionCount(tenantId)
        if (cachedCount === 0) {
            return createValidationError('No cached transactions found. Run historical sync first.')
        }

        // Estimate cost
        const costEstimate = estimateAnalysisCost(cachedCount)

        console.log(`Estimated cost: $${costEstimate.estimatedCostUSD.toFixed(4)} for ${cachedCount} transactions`)

        // Start analysis in background
        // Note: This is a long-running operation (can take 30-60 minutes for 1000s of transactions)
        // In production, move to background job queue

        analyzeAllTransactions(
            tenantId,
            {
                name: businessName,
                industry,
                abn,
            },
            {
                batchSize,
                onProgress: (progress) => {
                    console.log(`Analysis progress: ${progress.progress.toFixed(1)}% (${progress.transactionsAnalyzed}/${progress.totalTransactions})`)
                }
            }
        ).catch(error => {
            console.error('Analysis failed:', error)
        })

        // Return immediate response
        return NextResponse.json({
            status: 'analyzing',
            progress: 0,
            transactionsAnalyzed: 0,
            totalTransactions: cachedCount,
            estimatedCostUSD: costEstimate.estimatedCostUSD,
            message: `Started AI analysis of ${cachedCount} transactions. Estimated cost: $${costEstimate.estimatedCostUSD.toFixed(4)}. Poll /api/audit/analysis-status/${tenantId} for progress.`,
            pollUrl: `/api/audit/analysis-status/${tenantId}`,
            costBreakdown: {
                inputTokens: costEstimate.inputTokens,
                outputTokens: costEstimate.outputTokens,
                totalCost: costEstimate.estimatedCostUSD
            }
        })

    } catch (error) {
        console.error('Failed to start analysis:', error)
        return createErrorResponse(error, { operation: 'startAnalysis' }, 500)
    }
}

// GET /api/audit/analyze?tenantId=xxx
// Quick status check
export async function GET(request: NextRequest) {
    try {
        const tenantId = request.nextUrl.searchParams.get('tenantId')

        if (!tenantId) {
            return createValidationError('tenantId query parameter is required')
        }

        const status = await getAnalysisStatus(tenantId)

        if (!status) {
            return NextResponse.json({
                status: 'idle',
                progress: 0,
                transactionsAnalyzed: 0,
                totalTransactions: 0,
                estimatedCostUSD: 0,
                message: 'No analysis has been started yet'
            })
        }

        return NextResponse.json({
            status: status.status,
            progress: status.progress,
            transactionsAnalyzed: status.transactionsAnalyzed,
            totalTransactions: status.totalTransactions,
            estimatedCostUSD: status.estimatedCostUSD,
            errorMessage: status.errorMessage,
            message: getStatusMessage(status.status, status.progress)
        })

    } catch (error) {
        console.error('Failed to get analysis status:', error)
        return createErrorResponse(error, { operation: 'getAnalysisStatus' }, 500)
    }
}

async function getCachedTransactionCount(tenantId: string): Promise<number> {
    const transactions = await getCachedTransactions(tenantId)
    return transactions.length
}

function getStatusMessage(status: string, progress: number): string {
    switch (status) {
        case 'idle':
            return 'Ready to start analysis'
        case 'analyzing':
            return `Analyzing transactions with AI... ${progress.toFixed(0)}% complete`
        case 'complete':
            return 'AI analysis complete'
        case 'error':
            return 'Analysis failed - check errorMessage'
        default:
            return 'Unknown status'
    }
}
