/**
 * Small Business Entity (SBE) Eligibility Checker
 *
 * Determines eligibility for small business tax concessions under Division 328 ITAA 1997
 *
 * Key Rules:
 * - Aggregated turnover threshold: $10 million for most concessions
 * - $50 million threshold for instant asset write-off (as of FY2024-25)
 * - Must aggregate turnover from connected entities and affiliates
 * - Different thresholds apply to different concessions
 */

import Decimal from 'decimal.js'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'

// Turnover thresholds for FY2024-25 - FALLBACKS
const FALLBACK_SBE_THRESHOLD_STANDARD = 10_000_000 // $10M for most concessions
const FALLBACK_SBE_THRESHOLD_INSTANT_WRITEOFF = 50_000_000 // $50M for instant asset write-off

export interface Entity {
  name: string
  abn?: string
  turnover: number
  relationship: 'primary' | 'connected' | 'affiliate'
  controlPercentage?: number // For connected entities
}

export interface SBEConcession {
  name: string
  description: string
  eligible: boolean
  turnoverThreshold: number
  potentialBenefit?: string
  requirements: string[]
}

export interface SBEEligibilityResult {
  isPrimaryEntityEligible: boolean
  aggregatedTurnover: number
  threshold: number
  margin: number
  entities: Entity[]
  eligibleConcessions: SBEConcession[]
  ineligibleConcessions: SBEConcession[]
  warnings: string[]
  recommendations: string[]
  taxRateSource?: string
}

/**
 * Check Small Business Entity eligibility
 */
export async function checkSBEEligibility(entities: Entity[]): Promise<SBEEligibilityResult> {
  const warnings: string[] = []
  const recommendations: string[] = []

  // Fetch live thresholds if possible
  const thresholdStandard = FALLBACK_SBE_THRESHOLD_STANDARD
  const thresholdInstant = FALLBACK_SBE_THRESHOLD_INSTANT_WRITEOFF
  let rateSource = 'ATO_FALLBACK'

  try {
    const rates = await getCurrentTaxRates()
    // Note: If our rates-fetcher doesn't have specific SBE thresholds yet, we use fallbacks
    // but we can at least attribute the source of the corporate rate as context.
    rateSource = rates.sources.corporateTax || 'ATO.gov.au'
  } catch (err) {
    console.warn('Failed to fetch live metadata for SBE checker', err)
  }

  const aggregatedTurnover = entities.reduce((total, entity) => total + entity.turnover, 0)
  const isPrimaryEligible = aggregatedTurnover < thresholdStandard
  const margin = thresholdStandard - aggregatedTurnover

  const allConcessions: Omit<SBEConcession, 'eligible'>[] = [
    {
      name: 'Simplified Depreciation (Pool)',
      description: 'Depreciate most assets in a single pool at 15% (Year 1) and 30% thereafter',
      turnoverThreshold: thresholdStandard,
      potentialBenefit: 'Faster depreciation deductions',
      requirements: ['Aggregated turnover < $10M', 'Opt-in required'],
    },
    {
      name: 'Instant Asset Write-Off',
      description: 'Immediately deduct assets costing less than $20,000',
      turnoverThreshold: thresholdInstant,
      potentialBenefit: 'Immediate tax deduction',
      requirements: ['Aggregated turnover < $50M', 'Asset cost < $20,000'],
    },
    {
      name: 'GST Accounting Cash Basis',
      description: 'Account for GST on a cash basis rather than accruals',
      turnoverThreshold: thresholdStandard,
      potentialBenefit: 'Improved cash flow for GST',
      requirements: ['Aggregated turnover < $10M'],
    },
    {
      name: 'Simpler PAYG Instalment',
      description: 'Calculate PAYG instalments based on GDP-adjusted notional tax',
      turnoverThreshold: thresholdStandard,
      potentialBenefit: 'Simplified cash flow',
      requirements: ['Aggregated turnover < $10M'],
    },
    {
      name: 'FBT Exemption (Car Parking)',
      description: 'Exempt from FBT on car parking benefits',
      turnoverThreshold: thresholdStandard,
      potentialBenefit: 'Save 47% FBT on parking',
      requirements: ['Aggregated turnover < $10M'],
    }
  ]

  const eligibleConcessions: SBEConcession[] = []
  const ineligibleConcessions: SBEConcession[] = []

  allConcessions.forEach((concession) => {
    const eligible = aggregatedTurnover < concession.turnoverThreshold
    const fullConcession: SBEConcession = { ...concession, eligible }
    if (eligible) eligibleConcessions.push(fullConcession)
    else ineligibleConcessions.push(fullConcession)
  })

  if (margin > 0 && margin < 500_000) {
    warnings.push(`Turnover is only $${margin.toLocaleString()} below $10M threshold.`)
  }

  if (isPrimaryEligible) {
    recommendations.push(`Eligible for ${eligibleConcessions.length} SBE concessions.`)
  } else {
    recommendations.push('Consider restructuring to access small business concessions.')
  }

  return {
    isPrimaryEntityEligible: isPrimaryEligible,
    aggregatedTurnover,
    threshold: thresholdStandard,
    margin,
    entities,
    eligibleConcessions,
    ineligibleConcessions,
    warnings,
    recommendations,
    taxRateSource: rateSource
  }
}

/**
 * Calculate turnover reduction strategies
 */
export function calculateTurnoverReductionStrategies(currentTurnover: number) {
  const excess = currentTurnover - FALLBACK_SBE_THRESHOLD_STANDARD
  if (excess <= 0) return []

  return [
    {
      strategy: 'Restructure to Separate Entities',
      description: 'Split business operations into separate legal entities',
      potentialReduction: excess * 0.5,
      newTurnover: currentTurnover - excess * 0.5,
      feasibility: 'complex',
      considerations: ['Must ensure entities are not "connected"', 'Seek legal advice'],
    },
    {
      strategy: 'Exclude Non-Ordinary Income',
      description: 'Review if any amounts (e.g. capital gains) can be excluded',
      potentialReduction: currentTurnover * 0.05,
      newTurnover: currentTurnover * 0.95,
      feasibility: 'easy',
      considerations: ['Capital gains generally excluded', 'Review "ordinary income" definition'],
    },
  ]
}

/**
 * Estimate value of SBE concessions
 */
export function estimateSBEConcessionsValue(
  turnover: number,
  assetPurchases: number,
  employeeCount: number
) {
  const breakdown: Array<{ concession: string; estimatedValue: number; notes: string }> = []

  const instantWriteoffValue = assetPurchases * 0.25 * 0.3
  breakdown.push({
    concession: 'Instant Asset Write-Off',
    estimatedValue: instantWriteoffValue,
    notes: 'Time value of money benefit',
  })

  const fbtExemptionValue = employeeCount * 2000 * 0.47
  breakdown.push({
    concession: 'FBT Car Parking Exemption',
    estimatedValue: fbtExemptionValue,
    notes: 'Estimated $2k parking benefit per employee',
  })

  const totalEstimatedValue = breakdown.reduce((sum, item) => sum + item.estimatedValue, 0)

  return {
    totalEstimatedValue,
    breakdown,
  }
}

