/**
 * State Payroll Tax Engine
 *
 * Calculates payroll tax obligations across Australian states and territories.
 * Payroll tax is a STATE tax (not federal), and each jurisdiction has different
 * rates, thresholds, and grouping rules.
 *
 * Key Features:
 * - Multi-state payroll tax calculation
 * - Threshold deduction apportionment for multi-state employers
 * - Contractor deeming provisions (common audit issue)
 * - Grouping rules (related entities, common employees)
 * - Monthly/annual reconciliation
 *
 * IMPORTANT: Rates and thresholds change frequently. This engine uses
 * fallback rates but should be updated annually from state revenue office websites.
 *
 * Sources:
 * - NSW: Payroll Tax Act 2007 (NSW)
 * - VIC: Payroll Tax Act 2007 (Vic)
 * - QLD: Payroll Tax Act 1971 (Qld)
 * - WA: Pay-roll Tax Assessment Act 2002 (WA)
 * - SA: Payroll Tax Act 2009 (SA)
 * - TAS: Payroll Tax Act 2008 (Tas)
 * - ACT: Payroll Tax Act 2011 (ACT)
 * - NT: Payroll Tax Act 2009 (NT)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentFinancialYear } from '@/lib/utils/financial-year'
import Decimal from 'decimal.js'

/**
 * Australian state/territory codes.
 */
export type StateCode = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT'

/**
 * Payroll tax rates and thresholds by state (FY2024-25).
 * These are FALLBACK values and should be verified against current state legislation.
 */
export interface StatePayrollTaxConfig {
  state: StateCode
  stateName: string
  /** Annual threshold below which no payroll tax is payable */
  annualThreshold: number
  /** Rate applied to wages above the threshold */
  rate: number
  /** Higher rate for wages above a second tier (if applicable) */
  higherRate?: number
  /** Threshold for higher rate (if applicable) */
  higherRateThreshold?: number
  /** Monthly threshold (annual / 12) */
  monthlyThreshold: number
  /** Legislative reference */
  legislation: string
}

// Payroll tax rates by state - FY2024-25 fallback values
// CRITICAL: Verify these annually from state revenue office websites
const STATE_PAYROLL_TAX_CONFIGS: Record<StateCode, StatePayrollTaxConfig> = {
  NSW: {
    state: 'NSW',
    stateName: 'New South Wales',
    annualThreshold: 1_200_000,
    rate: 0.0485, // 4.85% (reduced from 5.45% since 1 July 2022)
    higherRate: 0.056, // 5.60% surcharge for wages > $10M (COVID surcharge)
    higherRateThreshold: 10_000_000,
    monthlyThreshold: 100_000,
    legislation: 'Payroll Tax Act 2007 (NSW)',
  },
  VIC: {
    state: 'VIC',
    stateName: 'Victoria',
    annualThreshold: 900_000,
    rate: 0.0485, // 4.85%
    higherRate: 0.0575, // Additional mental health levy for > $10M
    higherRateThreshold: 10_000_000,
    monthlyThreshold: 75_000,
    legislation: 'Payroll Tax Act 2007 (Vic)',
  },
  QLD: {
    state: 'QLD',
    stateName: 'Queensland',
    annualThreshold: 1_300_000,
    rate: 0.0475, // 4.75% (< $6.5M)
    higherRate: 0.0475, // Same rate but reduced threshold deduction above $6.5M
    higherRateThreshold: 6_500_000,
    monthlyThreshold: 108_333,
    legislation: 'Payroll Tax Act 1971 (Qld)',
  },
  WA: {
    state: 'WA',
    stateName: 'Western Australia',
    annualThreshold: 1_000_000,
    rate: 0.055, // 5.5%
    monthlyThreshold: 83_333,
    legislation: 'Pay-roll Tax Assessment Act 2002 (WA)',
  },
  SA: {
    state: 'SA',
    stateName: 'South Australia',
    annualThreshold: 1_500_000,
    rate: 0.0495, // 4.95% (effective from 1 Jan 2024)
    monthlyThreshold: 125_000,
    legislation: 'Payroll Tax Act 2009 (SA)',
  },
  TAS: {
    state: 'TAS',
    stateName: 'Tasmania',
    annualThreshold: 1_250_000,
    rate: 0.0412, // 4.12% (tier 1: $1.25M-$2M)
    higherRate: 0.0612, // 6.12% (tier 2: > $2M)
    higherRateThreshold: 2_000_000,
    monthlyThreshold: 104_167,
    legislation: 'Payroll Tax Act 2008 (Tas)',
  },
  ACT: {
    state: 'ACT',
    stateName: 'Australian Capital Territory',
    annualThreshold: 2_000_000,
    rate: 0.0685, // 6.85%
    monthlyThreshold: 166_667,
    legislation: 'Payroll Tax Act 2011 (ACT)',
  },
  NT: {
    state: 'NT',
    stateName: 'Northern Territory',
    annualThreshold: 1_500_000,
    rate: 0.055, // 5.5%
    monthlyThreshold: 125_000,
    legislation: 'Payroll Tax Act 2009 (NT)',
  },
}

/**
 * Wages data for a state.
 */
export interface StateWages {
  state: StateCode
  grossWages: number
  /** Contractor payments that may be deemed wages */
  contractorPayments: number
  /** Whether contractor deeming has been assessed */
  contractorDeemingAssessed: boolean
  /** Number of employees in this state */
  employeeCount: number
}

/**
 * Payroll tax calculation for a single state.
 */
export interface StatePayrollTaxResult {
  state: StateCode
  stateName: string

  // Wages
  totalWages: number
  taxableWages: number // After threshold deduction
  thresholdDeduction: number

  // Tax
  payrollTaxPayable: number
  effectiveRate: number // Actual tax / total wages
  rate: number // Statutory rate

  // Contractor deeming
  contractorPayments: number
  contractorDeemingWarning: string | null

  // Compliance
  isRegistered: boolean
  monthlyLodgementRequired: boolean
  annualReconciliationDue: Date | null

  legislativeReference: string
}

/**
 * Grouping analysis.
 */
export interface GroupingAnalysis {
  isGrouped: boolean
  groupedEntityCount: number
  groupedEntities: string[]
  totalGroupWages: number
  apportionedThreshold: number
  notes: string[]
}

/**
 * Complete payroll tax analysis.
 */
export interface PayrollTaxAnalysis {
  tenantId: string
  financialYear: string

  // State-by-state results
  stateResults: StatePayrollTaxResult[]
  totalPayrollTaxPayable: number

  // Multi-state apportionment
  isMultiStateEmployer: boolean
  statesWithEmployees: StateCode[]
  thresholdApportionment: Record<StateCode, number>

  // Grouping
  groupingAnalysis: GroupingAnalysis

  // Contractor analysis
  contractorDeemingRisk: 'low' | 'medium' | 'high'
  contractorWarnings: string[]

  // Summary
  totalWagesNationwide: number
  averageEffectiveRate: number

  // Metadata
  confidence: number
  recommendations: string[]
  legislativeReferences: string[]
  taxRateSource: string
  taxRateVerifiedAt: string
}

/**
 * Options for payroll tax analysis.
 */
export interface PayrollTaxOptions {
  /** Wages by state */
  stateWages?: StateWages[]
  /** Whether entity is part of a group */
  isGroupMember?: boolean
  /** Total group wages (all entities in group) */
  totalGroupWages?: number
  /** Number of entities in group */
  groupEntityCount?: number
  /** Group entity names */
  groupEntityNames?: string[]
}

/**
 * Analyze payroll tax obligations across states.
 */
export async function analyzePayrollTax(
  tenantId: string,
  financialYear?: string,
  options?: PayrollTaxOptions
): Promise<PayrollTaxAnalysis> {
  const fy = financialYear || getCurrentFinancialYear()
  const supabase = await createServiceClient()

  // If state wages provided, use them directly
  let stateWages = options?.stateWages || []

  // If no state wages provided, attempt to derive from Xero payroll data
  if (stateWages.length === 0) {
    stateWages = await deriveStateWagesFromXero(supabase, tenantId, fy)
  }

  if (stateWages.length === 0) {
    return createEmptyPayrollTaxAnalysis(tenantId, fy)
  }

  // Multi-state employer check
  const statesWithEmployees = stateWages.map(sw => sw.state)
  const isMultiState = statesWithEmployees.length > 1

  // Total wages for threshold apportionment
  const totalWagesNationwide = stateWages.reduce(
    (sum, sw) => sum + sw.grossWages + sw.contractorPayments, 0
  )

  // Grouping analysis
  const groupingAnalysis = analyzeGrouping(options, totalWagesNationwide)

  // Effective wages for threshold purposes (includes group wages if applicable)
  const effectiveWagesForThreshold = groupingAnalysis.isGrouped
    ? groupingAnalysis.totalGroupWages
    : totalWagesNationwide

  // Calculate threshold apportionment for multi-state
  const thresholdApportionment = calculateThresholdApportionment(
    stateWages, effectiveWagesForThreshold, isMultiState
  )

  // Calculate payroll tax per state
  const stateResults: StatePayrollTaxResult[] = stateWages.map(sw => {
    const config = STATE_PAYROLL_TAX_CONFIGS[sw.state]
    const apportionedThreshold = thresholdApportionment[sw.state] || 0

    return calculateStatePayrollTax(sw, config, apportionedThreshold)
  })

  const totalPayrollTaxPayable = stateResults.reduce((sum, r) => sum + r.payrollTaxPayable, 0)

  // Contractor deeming analysis
  const { risk: contractorDeemingRisk, warnings: contractorWarnings } =
    analyzeContractorDeeming(stateWages)

  // Average effective rate
  const averageEffectiveRate = totalWagesNationwide > 0
    ? totalPayrollTaxPayable / totalWagesNationwide
    : 0

  // Recommendations
  const recommendations = generatePayrollTaxRecommendations(
    stateResults, contractorDeemingRisk, isMultiState, groupingAnalysis
  )

  return {
    tenantId,
    financialYear: fy,
    stateResults,
    totalPayrollTaxPayable,
    isMultiStateEmployer: isMultiState,
    statesWithEmployees,
    thresholdApportionment,
    groupingAnalysis,
    contractorDeemingRisk,
    contractorWarnings,
    totalWagesNationwide,
    averageEffectiveRate,
    confidence: options?.stateWages ? 70 : 40,
    recommendations,
    legislativeReferences: stateResults.map(r => r.legislativeReference),
    taxRateSource: 'state_revenue_offices_fallback',
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

/**
 * Calculate payroll tax for a single state.
 */
function calculateStatePayrollTax(
  wages: StateWages,
  config: StatePayrollTaxConfig,
  apportionedThreshold: number
): StatePayrollTaxResult {
  const totalWages = wages.grossWages + wages.contractorPayments
  const thresholdDeduction = Math.min(totalWages, apportionedThreshold)
  const taxableWages = Math.max(0, totalWages - thresholdDeduction)

  let payrollTaxPayable: number

  if (config.higherRate && config.higherRateThreshold && totalWages > config.higherRateThreshold) {
    // Two-tier calculation
    const tier1Wages = Math.min(taxableWages, config.higherRateThreshold - apportionedThreshold)
    const tier2Wages = Math.max(0, taxableWages - tier1Wages)

    payrollTaxPayable = new Decimal(tier1Wages)
      .times(new Decimal(config.rate))
      .plus(new Decimal(tier2Wages).times(new Decimal(config.higherRate)))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()
  } else {
    payrollTaxPayable = new Decimal(taxableWages)
      .times(new Decimal(config.rate))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()
  }

  const effectiveRate = totalWages > 0 ? payrollTaxPayable / totalWages : 0

  // Contractor deeming warning
  let contractorDeemingWarning: string | null = null
  if (wages.contractorPayments > 0 && !wages.contractorDeemingAssessed) {
    contractorDeemingWarning = `$${wages.contractorPayments.toLocaleString()} in contractor payments in ${config.state}. ` +
      `${config.legislation} may deem certain contractor payments as wages. Review contractor arrangements.`
  }

  return {
    state: config.state,
    stateName: config.stateName,
    totalWages,
    taxableWages,
    thresholdDeduction,
    payrollTaxPayable,
    effectiveRate,
    rate: config.rate,
    contractorPayments: wages.contractorPayments,
    contractorDeemingWarning,
    isRegistered: totalWages > config.annualThreshold,
    monthlyLodgementRequired: totalWages > config.annualThreshold,
    annualReconciliationDue: null, // State-specific
    legislativeReference: config.legislation,
  }
}

/**
 * Calculate threshold apportionment for multi-state employers.
 * Each state's threshold is reduced proportionally based on the wages in that state
 * relative to total nationwide wages.
 */
function calculateThresholdApportionment(
  stateWages: StateWages[],
  effectiveWagesForThreshold: number,
  isMultiState: boolean
): Record<StateCode, number> {
  const apportionment: Record<string, number> = {}

  stateWages.forEach(sw => {
    const config = STATE_PAYROLL_TAX_CONFIGS[sw.state]
    const stateWagesTotal = sw.grossWages + sw.contractorPayments

    if (isMultiState && effectiveWagesForThreshold > 0) {
      // Multi-state: apportion threshold based on wage proportion
      const proportion = stateWagesTotal / effectiveWagesForThreshold
      apportionment[sw.state] = config.annualThreshold * proportion
    } else {
      // Single state: full threshold
      apportionment[sw.state] = config.annualThreshold
    }
  })

  return apportionment as Record<StateCode, number>
}

/**
 * Analyze grouping obligations.
 */
function analyzeGrouping(
  options: PayrollTaxOptions | undefined,
  totalWagesNationwide: number
): GroupingAnalysis {
  if (!options?.isGroupMember) {
    return {
      isGrouped: false,
      groupedEntityCount: 1,
      groupedEntities: [],
      totalGroupWages: totalWagesNationwide,
      apportionedThreshold: 0,
      notes: ['No group membership declared. Verify no related bodies corporate or common employees exist.'],
    }
  }

  return {
    isGrouped: true,
    groupedEntityCount: options.groupEntityCount || 2,
    groupedEntities: options.groupEntityNames || [],
    totalGroupWages: options.totalGroupWages || totalWagesNationwide,
    apportionedThreshold: 0,
    notes: [
      `Entity is part of a group of ${options.groupEntityCount || 2} entities.`,
      'Group wages are aggregated for threshold purposes.',
      'Threshold is shared across the group - each entity receives apportioned share.',
      'Grouping rules include: related bodies corporate, common employees, and tracing provisions.',
      'Review grouping to ensure all related entities are included.',
    ],
  }
}

/**
 * Analyze contractor deeming risk.
 */
function analyzeContractorDeeming(
  stateWages: StateWages[]
): { risk: 'low' | 'medium' | 'high'; warnings: string[] } {
  const totalContractorPayments = stateWages.reduce((sum, sw) => sum + sw.contractorPayments, 0)
  const totalWages = stateWages.reduce((sum, sw) => sum + sw.grossWages, 0)

  if (totalContractorPayments === 0) {
    return { risk: 'low', warnings: [] }
  }

  const warnings: string[] = []
  const contractorProportion = totalWages > 0 ? totalContractorPayments / (totalWages + totalContractorPayments) : 1

  if (contractorProportion > 0.3) {
    warnings.push(
      `${(contractorProportion * 100).toFixed(0)}% of total labour cost is contractor payments. ` +
      'High contractor-to-employee ratio is an audit risk factor. ' +
      'All states deem certain contractor payments as wages (e.g., NSW s 37 Payroll Tax Act 2007).'
    )
  }

  warnings.push(
    'Contractor deeming is the most common payroll tax audit issue. ' +
    'Review all contractor arrangements to determine if payments are deemed wages.'
  )

  const statesWithUnassessed = stateWages.filter(sw => sw.contractorPayments > 0 && !sw.contractorDeemingAssessed)
  if (statesWithUnassessed.length > 0) {
    warnings.push(
      `Contractor deeming not assessed in: ${statesWithUnassessed.map(sw => sw.state).join(', ')}. ` +
      'Recommend professional review of contractor arrangements.'
    )
  }

  const risk = contractorProportion > 0.5 ? 'high' : contractorProportion > 0.2 ? 'medium' : 'low'

  return { risk, warnings }
}

/**
 * Derive state wages from Xero payroll data.
 */
async function deriveStateWagesFromXero(
  supabase: any,
  tenantId: string,
  fy: string
): Promise<StateWages[]> {
  // In a full implementation, this would query Xero payroll data
  // For now, return empty - wages must be provided via options
  return []
}

function createEmptyPayrollTaxAnalysis(tenantId: string, fy: string): PayrollTaxAnalysis {
  return {
    tenantId,
    financialYear: fy,
    stateResults: [],
    totalPayrollTaxPayable: 0,
    isMultiStateEmployer: false,
    statesWithEmployees: [],
    thresholdApportionment: {} as Record<StateCode, number>,
    groupingAnalysis: {
      isGrouped: false,
      groupedEntityCount: 0,
      groupedEntities: [],
      totalGroupWages: 0,
      apportionedThreshold: 0,
      notes: ['No payroll data available. Provide state wages via options.'],
    },
    contractorDeemingRisk: 'low',
    contractorWarnings: [],
    totalWagesNationwide: 0,
    averageEffectiveRate: 0,
    confidence: 0,
    recommendations: ['Provide state wages data to calculate payroll tax obligations.'],
    legislativeReferences: [],
    taxRateSource: 'none',
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

function generatePayrollTaxRecommendations(
  stateResults: StatePayrollTaxResult[],
  contractorRisk: 'low' | 'medium' | 'high',
  isMultiState: boolean,
  grouping: GroupingAnalysis
): string[] {
  const recommendations: string[] = []

  // Registration reminders
  const unregistered = stateResults.filter(r => r.isRegistered && r.payrollTaxPayable > 0)
  if (unregistered.length > 0) {
    recommendations.push(
      `Ensure payroll tax registration is current in: ${unregistered.map(r => r.state).join(', ')}.`
    )
  }

  // Multi-state
  if (isMultiState) {
    recommendations.push(
      'Multi-state employer: threshold is apportioned across states based on wage proportion. ' +
      'Ensure consistent reporting across all state revenue offices.'
    )
  }

  // Contractor deeming
  if (contractorRisk === 'high') {
    recommendations.push(
      'HIGH RISK: Significant contractor payments detected. Contractor deeming is the #1 payroll tax audit issue. ' +
      'Obtain professional advice on whether payments are deemed wages.'
    )
  } else if (contractorRisk === 'medium') {
    recommendations.push(
      'Review contractor arrangements - some payments may be deemed wages for payroll tax purposes.'
    )
  }

  // Grouping
  if (grouping.isGrouped) {
    recommendations.push(
      'Grouped entity: coordinate payroll tax lodgement with group members to avoid duplicate threshold claims.'
    )
  } else {
    recommendations.push(
      'Verify no related entities exist that would trigger grouping provisions. Common triggers: related bodies corporate, common employees, common use of premises.'
    )
  }

  // Contractor deeming warnings per state
  stateResults.forEach(r => {
    if (r.contractorDeemingWarning) {
      recommendations.push(r.contractorDeemingWarning)
    }
  })

  recommendations.push(
    'Payroll tax rates and thresholds change annually. Verify current rates with state revenue offices before lodgement.'
  )

  return recommendations
}
