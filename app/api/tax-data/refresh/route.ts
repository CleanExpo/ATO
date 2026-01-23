/**
 * Tax Rates Refresh API
 *
 * POST - Force refresh tax rates from ATO.gov.au
 */

import { NextResponse } from 'next/server'
import { getCacheManager } from '@/lib/tax-data/cache-manager'

export async function POST(_request: Request) {
  try {
    const cacheManager = getCacheManager()

    console.log('🔄 Forcing tax rates refresh...')

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
