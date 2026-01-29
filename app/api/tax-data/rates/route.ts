/**
 * Tax Rates API
 *
 * GET - Retrieve current Australian tax rates (from cache or fresh fetch)
 */

import { NextResponse } from 'next/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === 'true'

  try {
    const rates = await getCurrentTaxRates(forceRefresh)

    return NextResponse.json({
      success: true,
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
        cacheHit: rates.cacheHit,
        cacheAge: rates.cacheAge,
        sources: rates.sources,
      },
    })
  } catch (error: unknown) {
    console.error('Failed to fetch tax rates:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tax rates',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
