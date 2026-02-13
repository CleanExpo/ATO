/**
 * Tax Rates Refresh API
 *
 * POST - Force refresh tax rates from ATO.gov.au
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCacheManager } from '@/lib/tax-data/cache-manager'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('api:tax-data:refresh')

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth

    const cacheManager = getCacheManager()

    log.info('Forcing tax rates refresh')

    // Clear cache and fetch fresh rates
    await cacheManager.clearCache()
    const rates = await cacheManager.getRates(true)

    return NextResponse.json({
      success: true,
      message: 'Tax rates refreshed successfully',
      data: {
        // Deduction rates
        instantWriteOffThreshold: rates.instantWriteOffThreshold,
        homeOfficeRatePerHour: rates.homeOfficeRatePerHour,

        // R&D Tax Incentive
        rndOffsetRate: rates.rndOffsetRate,
        rndOffsetRateSmallBusiness: rates.rndOffsetRateSmallBusiness,

        // Corporate tax
        corporateTaxRateSmall: rates.corporateTaxRateSmall,
        corporateTaxRateStandard: rates.corporateTaxRateStandard,

        // Division 7A
        division7ABenchmarkRate: rates.division7ABenchmarkRate,

        // FBT
        fbtRate: rates.fbtRate,
        fbtType1GrossUpRate: rates.fbtType1GrossUpRate,
        fbtType2GrossUpRate: rates.fbtType2GrossUpRate,

        // Superannuation Guarantee
        superGuaranteeRate: rates.superGuaranteeRate,

        // Fuel Tax Credits
        fuelTaxCreditOnRoad: rates.fuelTaxCreditOnRoad,
        fuelTaxCreditOffRoad: rates.fuelTaxCreditOffRoad,
        fuelTaxCreditQuarter: rates.fuelTaxCreditQuarter,

        // Metadata
        fetchedAt: rates.fetchedAt,
        sources: rates.sources,
      },
    })
  } catch (error: unknown) {
    console.error('Failed to refresh tax rates:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh tax rates',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
