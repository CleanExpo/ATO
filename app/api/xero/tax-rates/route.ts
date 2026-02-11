/**
 * GET /api/xero/tax-rates
 *
 * Fetch all tax rates configured in a Xero organisation.
 * These are the BAS/GST tax codes used for transaction categorisation.
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
import { TaxRate } from 'xero-node'
import { createLogger } from '@/lib/logger'
import { decryptStoredToken, encryptTokenForStorage } from '@/lib/xero/token-store'

const log = createLogger('api:xero:tax-rates')

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

// Australian BAS component mapping
const BAS_MAPPING: Record<string, { basField: string; description: string }> = {
    'OUTPUT': { basField: 'G1', description: 'Taxable sales (GST on income)' },
    'INPUT': { basField: 'G11', description: 'GST credits (GST on expenses)' },
    'EXEMPTOUTPUT': { basField: 'G2', description: 'GST-free sales' },
    'EXEMPTEXPORT': { basField: 'G2', description: 'Export sales (zero-rated)' },
    'GSTONIMPORTS': { basField: 'G11', description: 'GST on imports' },
    'CAPEXINPUT': { basField: 'G11', description: 'GST on capital purchases' },
    'INPUTTAXED': { basField: '-', description: 'Input-taxed supplies (no GST credit)' },
    'BASEXCLUDED': { basField: '-', description: 'Excluded from BAS' },
    'NONE': { basField: '-', description: 'No GST applicable' }
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth(request, { tenantIdSource: 'query' })
        if (isErrorResponse(auth)) return auth

        const tenantId = request.nextUrl.searchParams.get('tenantId')

        if (!tenantId) {
            return createValidationError('tenantId is required')
        }

        log.info('Fetching Xero tax rates', { tenantId })

        const tokenSet = await getValidTokenSet(tenantId)
        if (!tokenSet) {
            return createNotFoundError('Xero connection')
        }

        const client = createXeroClient()
        client.setTokenSet(tokenSet)

        // Fetch tax rates from Xero
        const response = await client.accountingApi.getTaxRates(tenantId)
        const taxRates = response.body.taxRates || []

        // Categorise tax rates
        const categorisedRates = taxRates.map(rate => {
            const taxType = rate.taxType || ''
            const basMapping = BAS_MAPPING[taxType] || { basField: 'Unknown', description: 'Custom tax type' }

            return {
                name: rate.name,
                taxType: rate.taxType,
                status: rate.status,
                displayTaxRate: rate.displayTaxRate,
                effectiveRate: rate.effectiveRate,
                // Tax components (e.g., GST 10%)
                taxComponents: rate.taxComponents?.map(comp => ({
                    name: comp.name,
                    rate: comp.rate,
                    isCompound: comp.isCompound,
                    isNonRecoverable: comp.isNonRecoverable
                })),
                // BAS mapping for Australian compliance
                basField: basMapping.basField,
                basDescription: basMapping.description,
                // Applicability flags
                canApplyToAssets: rate.canApplyToAssets,
                canApplyToEquity: rate.canApplyToEquity,
                canApplyToExpenses: rate.canApplyToExpenses,
                canApplyToLiabilities: rate.canApplyToLiabilities,
                canApplyToRevenue: rate.canApplyToRevenue,
                // Tax optimisation flags
                flags: {
                    isGstApplicable: taxType === 'OUTPUT' || taxType === 'INPUT',
                    isGstFree: taxType === 'EXEMPTOUTPUT' || taxType === 'EXEMPTEXPORT',
                    isInputTaxed: taxType === 'INPUTTAXED',
                    isBasExcluded: taxType === 'BASEXCLUDED' || taxType === 'NONE',
                    needsReview: !rate.taxType || rate.status !== TaxRate.StatusEnum.ACTIVE
                }
            }
        })

        // Summary statistics
        const activeTaxRates = categorisedRates.filter(r => r.status === TaxRate.StatusEnum.ACTIVE)
        const gstRates = activeTaxRates.filter(r => r.flags.isGstApplicable)
        const exemptRates = activeTaxRates.filter(r => r.flags.isGstFree || r.flags.isInputTaxed)

        return NextResponse.json({
            tenantId,
            taxRates: categorisedRates,
            summary: {
                total: taxRates.length,
                active: activeTaxRates.length,
                gstApplicable: gstRates.length,
                exempt: exemptRates.length,
                needsReview: categorisedRates.filter(r => r.flags.needsReview).length
            },
            basComponents: {
                G1: 'GST on sales (OUTPUT)',
                G2: 'GST-free sales (EXEMPTOUTPUT, EXEMPTEXPORT)',
                G11: 'GST credits (INPUT, GSTONIMPORTS, CAPEXINPUT)',
                excluded: 'BASEXCLUDED, NONE, INPUTTAXED'
            }
        })

    } catch (error) {
        console.error('Failed to fetch Xero tax rates:', error)
        return createErrorResponse(error, { operation: 'fetchXeroTaxRates' }, 500)
    }
}
