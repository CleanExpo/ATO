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

// Turnover thresholds for FY2024-25
const SBE_THRESHOLD_STANDARD = 10_000_000 // $10M for most concessions
const SBE_THRESHOLD_INSTANT_WRITEOFF = 50_000_000 // $50M for instant asset write-off (temporary measure)

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
  margin: number // How far above/below threshold
  entities: Entity[]
  eligibleConcessions: SBEConcession[]
  ineligibleConcessions: SBEConcession[]
  warnings: string[]
  recommendations: string[]
}

/**
 * Check Small Business Entity eligibility
 */
export function checkSBEEligibility(entities: Entity[]): SBEEligibilityResult {
  const warnings: string[] = []
  const recommendations: string[] = []

  // Calculate aggregated turnover
  const aggregatedTurnover = entities.reduce(
    (total, entity) => total + entity.turnover,
    0
  )

  // Check eligibility against standard threshold
  const isPrimaryEligible = aggregatedTurnover < SBE_THRESHOLD_STANDARD
  const margin = SBE_THRESHOLD_STANDARD - aggregatedTurnover

  // Define available concessions
  const allConcessions: Omit<SBEConcession, 'eligible'>[] = [
    {
      name: 'Simplified Depreciation (Pool)',
      description:
        'Depreciate most depreciating assets in a single pool at 15% in first year and 30% thereafter',
      turnoverThreshold: SBE_THRESHOLD_STANDARD,
      potentialBenefit: 'Faster depreciation deductions',
      requirements: [
        'Aggregated turnover < $10M',
        'Assets must cost less than instant write-off threshold',
        'Opt-in by using the simplified depreciation rules',
      ],
    },
    {
      name: 'Instant Asset Write-Off',
      description: 'Immediately deduct assets costing less than $20,000',
      turnoverThreshold: SBE_THRESHOLD_INSTANT_WRITEOFF,
      potentialBenefit: 'Immediate tax deduction for asset purchases',
      requirements: [
        'Aggregated turnover < $50M (temporary measure)',
        'Asset cost < $20,000',
        'Asset must be first used or installed ready for use',
      ],
    },
    {
      name: 'Simplified Trading Stock Rules',
      description:
        'Avoid annual stocktake if reasonable estimate shows change < $5,000',
      turnoverThreshold: SBE_THRESHOLD_STANDARD,
      potentialBenefit: 'Reduced compliance costs',
      requirements: [
        'Aggregated turnover < $10M',
        'Estimated change in trading stock value < $5,000',
      ],
    },
    {
      name: 'Simpler PAYG Instalment',
      description: 'Calculate PAYG instalments based on GDP-adjusted notional tax',
      turnoverThreshold: SBE_THRESHOLD_STANDARD,
      potentialBenefit: 'Simplified cash flow management',
      requirements: [
        'Aggregated turnover < $10M',
        'Choose to use instalment rate option',
      ],
    },
    {
      name: 'Two-Year Amendment Period',
      description: 'ATO has only 2 years to amend assessments (vs 4 years)',
      turnoverThreshold: SBE_THRESHOLD_STANDARD,
      potentialBenefit: 'Earlier certainty on tax positions',
      requirements: [
        'Aggregated turnover < $10M',
        'Applies automatically if eligible',
      ],
    },
    {
      name: 'GST Accounting Cash Basis',
      description: 'Account for GST on a cash basis rather than accruals',
      turnoverThreshold: SBE_THRESHOLD_STANDARD,
      potentialBenefit: 'Improved cash flow for GST',
      requirements: [
        'Aggregated turnover < $10M',
        'Opt-in with BAS agent or ATO',
      ],
    },
    {
      name: 'GST Annual Apportionment',
      description: 'Make single annual adjustment for input tax credits',
      turnoverThreshold: SBE_THRESHOLD_STANDARD,
      potentialBenefit: 'Reduced quarterly GST compliance',
      requirements: [
        'Aggregated turnover < $10M',
        'Turnover from financial supplies < $50,000',
      ],
    },
    {
      name: 'FBT Exemption (Car Parking)',
      description: 'Exempt from FBT on car parking benefits',
      turnoverThreshold: SBE_THRESHOLD_STANDARD,
      potentialBenefit: 'Save up to 47% FBT on parking',
      requirements: [
        'Aggregated turnover < $10M',
        'Parking provided to employees',
      ],
    },
    {
      name: 'CGT Small Business Concessions',
      description:
        '15-year exemption, 50% active asset reduction, retirement exemption, rollover relief',
      turnoverThreshold: SBE_THRESHOLD_STANDARD,
      potentialBenefit: 'Up to 100% CGT exemption on sale',
      requirements: [
        'Aggregated turnover < $10M OR',
        'Net assets < $6M',
        'Asset must be active business asset',
        'Ownership period requirements apply',
      ],
    },
  ]

  // Determine eligibility for each concession
  const eligibleConcessions: SBEConcession[] = []
  const ineligibleConcessions: SBEConcession[] = []

  allConcessions.forEach((concession) => {
    const eligible = aggregatedTurnover < concession.turnoverThreshold

    const fullConcession: SBEConcession = {
      ...concession,
      eligible,
    }

    if (eligible) {
      eligibleConcessions.push(fullConcession)
    } else {
      ineligibleConcessions.push(fullConcession)
    }
  })

  // Generate warnings
  if (margin > 0 && margin < 500_000) {
    warnings.push(
      `Aggregated turnover is $${margin.toLocaleString()} below the $10M threshold. Consider strategies to stay under the threshold.`
    )
  }

  if (!isPrimaryEligible) {
    warnings.push(
      `Aggregated turnover of $${aggregatedTurnover.toLocaleString()} exceeds the $10M SBE threshold by $${Math.abs(margin).toLocaleString()}.`
    )
  }

  // Check for connected entities
  const connectedEntities = entities.filter((e) => e.relationship === 'connected')
  if (connectedEntities.length > 0) {
    warnings.push(
      `${connectedEntities.length} connected entity(ies) included in aggregated turnover calculation.`
    )
  }

  // Generate recommendations
  if (isPrimaryEligible) {
    recommendations.push(
      `You are eligible for ${eligibleConcessions.length} small business concessions. Ensure you opt-in where required.`
    )

    if (eligibleConcessions.some((c) => c.name.includes('Instant Asset'))) {
      recommendations.push(
        'Consider timing asset purchases to maximize instant asset write-off benefits before June 30.'
      )
    }

    if (eligibleConcessions.some((c) => c.name.includes('CGT'))) {
      recommendations.push(
        'If planning to sell business or assets, review CGT small business concessions for potential tax savings.'
      )
    }
  } else {
    recommendations.push(
      'Consider restructuring to reduce aggregated turnover below $10M threshold to access small business concessions.'
    )

    // Check if close to instant write-off threshold
    if (aggregatedTurnover < SBE_THRESHOLD_INSTANT_WRITEOFF) {
      recommendations.push(
        'You still qualify for instant asset write-off (up to $50M turnover). Take advantage before this temporary measure ends.'
      )
    }
  }

  // Check if missing connected entities
  if (entities.length === 1) {
    recommendations.push(
      'Ensure you have identified all connected entities and affiliates. Failure to aggregate turnover correctly may result in penalties.'
    )
  }

  return {
    isPrimaryEntityEligible: isPrimaryEligible,
    aggregatedTurnover,
    threshold: SBE_THRESHOLD_STANDARD,
    margin,
    entities,
    eligibleConcessions,
    ineligibleConcessions,
    warnings,
    recommendations,
  }
}

/**
 * Calculate turnover reduction strategies
 */
export function calculateTurnoverReductionStrategies(
  currentTurnover: number
): Array<{
  strategy: string
  description: string
  potentialReduction: number
  newTurnover: number
  feasibility: 'easy' | 'moderate' | 'complex'
  considerations: string[]
}> {
  const excess = currentTurnover - SBE_THRESHOLD_STANDARD

  if (excess <= 0) {
    return []
  }

  return [
    {
      strategy: 'Restructure to Separate Entities',
      description:
        'Split business operations into separate legal entities that are not connected',
      potentialReduction: excess * 0.5, // Conservative estimate
      newTurnover: currentTurnover - excess * 0.5,
      feasibility: 'complex',
      considerations: [
        'Must ensure entities are not "connected" under Division 328',
        'Requires separate business operations',
        'Ongoing compliance costs',
        'Seek legal and tax advice',
      ],
    },
    {
      strategy: 'Defer Revenue Recognition',
      description: 'Delay invoicing or revenue recognition to next financial year',
      potentialReduction: Math.min(excess, currentTurnover * 0.1), // Max 10% of turnover
      newTurnover: currentTurnover - Math.min(excess, currentTurnover * 0.1),
      feasibility: 'moderate',
      considerations: [
        'Must comply with accounting standards',
        'May impact cash flow',
        'Only temporary solution',
        'Consider commercial implications',
      ],
    },
    {
      strategy: 'Exclude Non-Ordinary Income',
      description: 'Review if any amounts included should be excluded (e.g., capital gains)',
      potentialReduction: Math.min(excess, currentTurnover * 0.05), // Estimate
      newTurnover: currentTurnover - Math.min(excess, currentTurnover * 0.05),
      feasibility: 'easy',
      considerations: [
        'Review definition of "ordinary income"',
        'Capital gains generally excluded',
        'GST-free sales may be excluded in some cases',
        'Seek professional advice on specific items',
      ],
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
): {
  totalEstimatedValue: number
  breakdown: Array<{ concession: string; estimatedValue: number; notes: string }>
} {
  const breakdown: Array<{ concession: string; estimatedValue: number; notes: string }> =
    []

  // Instant asset write-off value (assumes 25% tax rate)
  const instantWriteoffValue = assetPurchases * 0.25 * 0.3 // 30% time value of earlier deduction
  breakdown.push({
    concession: 'Instant Asset Write-Off',
    estimatedValue: instantWriteoffValue,
    notes: 'Time value of money benefit from earlier deduction',
  })

  // Simplified depreciation pool (estimate 5% faster depreciation)
  const simplifiedDepreciationValue = turnover * 0.02 * 0.25 * 0.05 // Rough estimate
  breakdown.push({
    concession: 'Simplified Depreciation Pool',
    estimatedValue: simplifiedDepreciationValue,
    notes: 'Faster depreciation compared to standard rules',
  })

  // FBT car parking exemption (estimate $2,000 per employee)
  const fbtExemptionValue = employeeCount * 2000 * 0.47 // FBT rate 47%
  breakdown.push({
    concession: 'FBT Car Parking Exemption',
    estimatedValue: fbtExemptionValue,
    notes: 'Estimated based on $2,000 parking benefit per employee',
  })

  // Compliance cost savings (estimate $5,000/year)
  const complianceSavings = 5000
  breakdown.push({
    concession: 'Reduced Compliance Costs',
    estimatedValue: complianceSavings,
    notes: 'Simpler trading stock, PAYG, and GST rules',
  })

  const totalEstimatedValue = breakdown.reduce((sum, item) => sum + item.estimatedValue, 0)

  return {
    totalEstimatedValue,
    breakdown,
  }
}
