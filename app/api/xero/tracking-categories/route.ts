/**
 * GET /api/xero/tracking-categories
 *
 * Fetch all tracking categories configured in a Xero organisation.
 * Tracking categories are used for cost centres, projects, and R&D allocation.
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import { createErrorResponse, createValidationError, createNotFoundError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import type { TokenSet } from 'xero-node'
import { TrackingOption, TrackingCategory } from 'xero-node'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:xero:tracking-categories')

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

    const tokenSet = {
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        expires_at: connection.expires_at,
        id_token: connection.id_token,
        scope: connection.scope,
        token_type: 'Bearer'
    } as TokenSet

    // Refresh if expired
    if (isTokenExpired(tokenSet)) {
        try {
            const newTokens = await refreshXeroTokens(tokenSet)

            // Update stored tokens — match by tenant_id (unique) to avoid
            // collision when multiple connections share the same refresh_token
            await supabase
                .from('xero_connections')
                .update({
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
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

// R&D Tax Incentive tracking category recommendations
const RND_TRACKING_RECOMMENDATIONS = {
    suggestedCategories: [
        {
            name: 'Division/Business Unit',
            description: 'Allocate expenses to R&D vs operational divisions',
            suggestedOptions: ['R&D', 'Sales', 'Admin', 'Support', 'Manufacturing']
        },
        {
            name: 'R&D Project',
            description: 'Track costs by R&D project for Division 355 claims',
            suggestedOptions: ['Project A', 'Project B', 'Internal R&D', 'External Contract R&D']
        },
        {
            name: 'Compliance Flag',
            description: 'Flag transactions requiring special tax treatment',
            suggestedOptions: ['Division7A', 'Related-Party', 'R&D-Eligible', 'Bad-Debt']
        }
    ],
    taxBenefits: {
        'R&D': 'Division 355 ITAA 1997 - 43.5% R&D tax offset for small business',
        'Division7A': 'Division 7A ITAA 1936 - Loan compliance tracking',
        'Bad-Debt': 'Section 25-35 ITAA 1997 - Bad debt deductions'
    }
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth(request, { tenantIdSource: 'query' })
        if (isErrorResponse(auth)) return auth

        const tenantId = request.nextUrl.searchParams.get('tenantId')

        if (!tenantId) {
            return createValidationError('tenantId is required')
        }

        log.info('Fetching Xero tracking categories', { tenantId })

        const tokenSet = await getValidTokenSet(tenantId)
        if (!tokenSet) {
            return createNotFoundError('Xero connection')
        }

        const client = createXeroClient()
        client.setTokenSet(tokenSet)

        // Fetch tracking categories from Xero
        const response = await client.accountingApi.getTrackingCategories(tenantId)
        const trackingCategories = response.body.trackingCategories || []

        // Map tracking categories with options
        const categoriesWithAnalysis = trackingCategories.map(category => {
            const options = category.options || []
            const activeOptions = options.filter(opt => opt.status === TrackingOption.StatusEnum.ACTIVE)

            // Check if category might be R&D related
            const isRndRelated = category.name?.toLowerCase().includes('r&d') ||
                                 category.name?.toLowerCase().includes('research') ||
                                 category.name?.toLowerCase().includes('project') ||
                                 options.some(opt => opt.name?.toLowerCase().includes('r&d'))

            // Check if category is for cost centres
            const isCostCentre = category.name?.toLowerCase().includes('cost') ||
                                 category.name?.toLowerCase().includes('department') ||
                                 category.name?.toLowerCase().includes('division')

            return {
                trackingCategoryId: category.trackingCategoryID,
                name: category.name,
                status: category.status,
                options: activeOptions.map(opt => ({
                    trackingOptionId: opt.trackingOptionID,
                    name: opt.name,
                    status: opt.status
                })),
                totalOptions: options.length,
                activeOptions: activeOptions.length,
                // Tax optimisation analysis
                analysis: {
                    isRndRelated,
                    isCostCentre,
                    couldSupportDivision355: isRndRelated || isCostCentre,
                    recommendation: isRndRelated
                        ? 'Use this category to allocate R&D expenditure for Division 355 claims'
                        : isCostCentre
                        ? 'Use this category for general cost allocation and expense tracking'
                        : 'Consider if this category could help with tax categorisation'
                }
            }
        })

        // Check for R&D tracking capability
        const hasRndTracking = categoriesWithAnalysis.some(c => c.analysis.isRndRelated)
        const hasCostCentres = categoriesWithAnalysis.some(c => c.analysis.isCostCentre)

        return NextResponse.json({
            tenantId,
            trackingCategories: categoriesWithAnalysis,
            summary: {
                total: trackingCategories.length,
                active: categoriesWithAnalysis.filter(c => c.status === TrackingCategory.StatusEnum.ACTIVE).length,
                rndRelated: categoriesWithAnalysis.filter(c => c.analysis.isRndRelated).length,
                costCentres: categoriesWithAnalysis.filter(c => c.analysis.isCostCentre).length
            },
            taxOptimisation: {
                hasRndTracking,
                hasCostCentres,
                division355Ready: hasRndTracking,
                recommendations: hasRndTracking
                    ? ['R&D tracking is configured - ensure all eligible R&D expenses are tagged']
                    : ['Consider adding R&D tracking category for Division 355 claims'],
                suggestedSetup: RND_TRACKING_RECOMMENDATIONS
            }
        })

    } catch (error) {
        console.error('Failed to fetch Xero tracking categories:', error)
        return createErrorResponse(error, { operation: 'fetchXeroTrackingCategories' }, 500)
    }
}
