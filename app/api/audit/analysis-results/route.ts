/**
 * GET /api/audit/analysis-results
 *
 * Get AI analysis results with filtering and pagination.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - financialYear?: string (optional - e.g., 'FY2024-25')
 * - isRndCandidate?: boolean (optional - filter R&D candidates)
 * - primaryCategory?: string (optional - filter by category)
 * - minConfidence?: number (optional - minimum confidence score 0-100)
 * - page?: number (optional, default: 1)
 * - pageSize?: number (optional, default: 100, max: 10000)
 *
 * Response:
 * - results: Array of analysis results
 * - pagination: { page, pageSize, total, hasMore }
 * - summary: Statistics and aggregations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { getAnalysisResults, getCostSummary } from '@/lib/ai/batch-processor'
import cacheManager, { CacheKeys, CacheTTL } from '@/lib/cache/cache-manager'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('api:audit:analysis-results')

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
        const isRndCandidateParam = request.nextUrl.searchParams.get('isRndCandidate')
        const primaryCategory = request.nextUrl.searchParams.get('primaryCategory') || undefined
        const minConfidenceParam = request.nextUrl.searchParams.get('minConfidence')
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10)
        const pageSize = Math.min(
            parseInt(request.nextUrl.searchParams.get('pageSize') || '100', 10),
            10000  // Increased from 1000 to support large exports
        )

        // Parse boolean and number parameters
        const isRndCandidate = isRndCandidateParam === 'true' ? true : isRndCandidateParam === 'false' ? false : undefined
        const minConfidence = minConfidenceParam ? parseInt(minConfidenceParam, 10) : undefined

        log.info('Getting analysis results', { tenantId })

        // Get results with filters (cache for 1 hour)
        const cacheKey = CacheKeys.analysisResults(tenantId, financialYear)
        const results = await cacheManager.getOrCompute(
            cacheKey,
            async () => await getAnalysisResults(tenantId, {
                financialYear,
                isRndCandidate,
                primaryCategory,
                minConfidence,
            }),
            CacheTTL.analysisResults
        )

        // Pagination
        const total = results.length
        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        const paginatedResults = results.slice(startIndex, endIndex)

        // Calculate summary statistics
        const summary = calculateSummary(results)

        // Get cost summary (cache for 5 minutes)
        const costCacheKey = CacheKeys.costSummary(tenantId)
        const costSummary = await cacheManager.getOrCompute(
            costCacheKey,
            async () => await getCostSummary(tenantId),
            CacheTTL.costSummary
        )

        const response = NextResponse.json({
            results: paginatedResults,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
                hasMore: endIndex < total
            },
            summary: {
                ...summary,
                cost: costSummary
            }
        })
        response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')
        return response

    } catch (error) {
        console.error('Failed to get analysis results:', error)
        return createErrorResponse(error, { operation: 'getAnalysisResults' }, 500)
    }
}

interface AnalysisResult {
    is_rnd_candidate?: boolean
    meets_div355_criteria?: boolean
    rnd_activity_type?: string | null
    primary_category?: string | null
    category_confidence?: number | null
    is_fully_deductible?: boolean
    claimable_amount?: number | null
    requires_documentation?: boolean
    fbt_implications?: boolean
    division7a_risk?: boolean
    financial_year?: string | null
}

function calculateSummary(results: AnalysisResult[]) {
    const total = results.length

    // R&D Statistics
    const rndCandidates = results.filter(r => r.is_rnd_candidate).length
    const meetsDiv355 = results.filter(r => r.meets_div355_criteria).length
    const coreRnd = results.filter(r => r.rnd_activity_type === 'core_rnd').length

    // Category breakdown
    const categories: Record<string, number> = {}
    results.forEach(r => {
        const cat = r.primary_category || 'Unknown'
        categories[cat] = (categories[cat] || 0) + 1
    })

    // Confidence distribution
    const highConfidence = results.filter(r => (r.category_confidence ?? 0) >= 80).length
    const mediumConfidence = results.filter(r => (r.category_confidence ?? 0) >= 60 && (r.category_confidence ?? 0) < 80).length
    const lowConfidence = results.filter(r => (r.category_confidence ?? 0) < 60).length

    // Deduction statistics
    const fullyDeductible = results.filter(r => r.is_fully_deductible).length
    const totalClaimable = results.reduce((sum, r) => sum + (r.claimable_amount || 0), 0)

    // Compliance flags
    const requiresDoc = results.filter(r => r.requires_documentation).length
    const fbtImplications = results.filter(r => r.fbt_implications).length
    const division7aRisk = results.filter(r => r.division7a_risk).length

    // Financial year breakdown
    const byYear: Record<string, number> = {}
    results.forEach(r => {
        const year = r.financial_year || 'Unknown'
        byYear[year] = (byYear[year] || 0) + 1
    })

    return {
        total,
        rnd: {
            candidates: rndCandidates,
            meetsDiv355: meetsDiv355,
            coreActivities: coreRnd,
            percentage: total > 0 ? ((rndCandidates / total) * 100).toFixed(1) : '0'
        },
        categories,
        confidence: {
            high: highConfidence,
            medium: mediumConfidence,
            low: lowConfidence
        },
        deductions: {
            fullyDeductible,
            totalClaimableAmount: totalClaimable
        },
        compliance: {
            requiresDocumentation: requiresDoc,
            fbtImplications,
            division7aRisk
        },
        byFinancialYear: byYear
    }
}
