/**
 * Personal Services Income (PSI) Engine (Division 85 ITAA 1997)
 *
 * Determines whether income is classified as PSI and whether the PSI rules
 * apply. If PSI rules apply, deductions are limited to those directly related
 * to earning the PSI.
 *
 * Key Tests (s 87-15 to s 87-40):
 * 1. Results Test (s 87-18) - primary test, requires ALL THREE sub-requirements:
 *    (a) 75%+ of PSI is for producing a result (not time-based)
 *    (b) Individual provides own tools/equipment
 *    (c) Individual is liable for defective work
 * 2. 80% Rule (s 87-15) - if 80%+ income from one client, PSI rules apply
 * 3. Unrelated Clients Test (s 87-20)
 * 4. Employment Test (s 87-25)
 * 5. Business Premises Test (s 87-30)
 *
 * If a personal services business (PSB) determination is obtained,
 * PSI rules do NOT apply (Division 87).
 *
 * Legislation:
 * - Division 85 ITAA 1997: Income that is PSI
 * - Division 86 ITAA 1997: Alienation of PSI through entities
 * - Division 87 ITAA 1997: Personal services business determinations
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentFinancialYear } from '@/lib/utils/financial-year'
import Decimal from 'decimal.js'

/** Xero raw transaction shape from historical_transactions_cache.raw_data */
interface XeroRawTransaction {
  Type?: string
  Total?: string | number
  Date?: string
  DateString?: string
  Description?: string
  Reference?: string
  Contact?: { Name?: string; ContactID?: string }
  ContactName?: string
  [key: string]: unknown
}

/** Row from historical_transactions_cache */
interface HistoricalCacheRow {
  raw_data: XeroRawTransaction | XeroRawTransaction[]
  financial_year?: string
  [key: string]: unknown
}

// PSI thresholds
const PSI_SINGLE_CLIENT_THRESHOLD = 0.80 // 80% from one client triggers PSI rules
const PSI_RESULTS_TEST_THRESHOLD = 0.75 // 75% must be for producing a result

/**
 * Results Test sub-requirements (s 87-18 ITAA 1997).
 * ALL THREE must be satisfied to pass the Results Test.
 */
export interface ResultsTestAnalysis {
  /** (a) 75%+ of PSI is for producing a result, not time-based billing */
  producingResult: {
    met: boolean
    confidence: number
    percentage: number // % of income that is result-based
    evidence: string[]
  }
  /** (b) Individual provides own tools/equipment for the work */
  ownTools: {
    met: boolean
    confidence: number
    evidence: string[]
  }
  /** (c) Individual is liable for rectifying defective work at own cost */
  defectLiability: {
    met: boolean
    confidence: number
    evidence: string[]
  }
  /** Overall results test outcome - true only if ALL THREE pass */
  overallMet: boolean
  overallConfidence: number
}

/**
 * PSI determination for a single client relationship.
 */
export interface ClientPSIAnalysis {
  clientName: string
  clientId: string
  totalIncome: number
  percentageOfTotal: number
  isPSI: boolean
  psiIndicators: string[]
}

/**
 * Complete PSI analysis for an entity.
 */
export interface PSIAnalysis {
  tenantId: string
  financialYear: string

  // Income classification
  totalIncome: number
  totalPSI: number
  psiPercentage: number
  isPSIEntity: boolean

  // Client analysis
  clients: ClientPSIAnalysis[]
  singleClientAbove80: boolean
  primaryClientName: string | null
  primaryClientPercentage: number

  // PSB tests (Division 87)
  resultsTest: ResultsTestAnalysis
  unrelatedClientsTest: {
    met: boolean
    confidence: number
    notes: string[]
  }
  employmentTest: {
    met: boolean
    confidence: number
    notes: string[]
  }
  businessPremisesTest: {
    met: boolean
    confidence: number
    notes: string[]
  }

  // Overall determination
  isPSB: boolean // Personal Services Business (if true, PSI rules don't apply)
  psbDeterminationRequired: boolean
  deductionRestrictions: string[]

  // Metadata
  confidence: number
  recommendations: string[]
  legislativeReferences: string[]
  taxRateSource: string
  taxRateVerifiedAt: string
}

/**
 * Options for PSI analysis.
 */
export interface PSIAnalysisOptions {
  /** Whether the entity has a PSB determination from the ATO */
  hasPSBDetermination?: boolean
  /** Whether the individual provides own tools (for results test) */
  providesOwnTools?: boolean
  /** Whether the individual is liable for defective work */
  liableForDefects?: boolean
  /** Whether the entity has separate business premises */
  hasSeparatePremises?: boolean
  /** Number of unrelated clients */
  unrelatedClientCount?: number
}

/**
 * Analyze Personal Services Income for a tenant.
 *
 * @param tenantId - Xero tenant ID
 * @param financialYear - FY to analyze (defaults to current)
 * @param options - Additional context for PSI determination
 */
export async function analyzePSI(
  tenantId: string,
  financialYear?: string,
  options?: PSIAnalysisOptions
): Promise<PSIAnalysis> {
  const fy = financialYear || getCurrentFinancialYear()
  const supabase = await createServiceClient()

  // Fetch income transactions for the financial year
  const { data: transactions, error } = await supabase
    .from('historical_transactions_cache')
    .select('raw_data, financial_year')
    .eq('tenant_id', tenantId)
    .eq('financial_year', fy)

  if (error) {
    console.error('Failed to fetch transactions for PSI analysis:', error)
    throw new Error(`Failed to fetch transactions: ${error.message}`)
  }

  // Extract income data grouped by client
  const clientIncomeMap = new Map<string, { name: string; total: number }>()
  let totalIncome = 0

  const rawTransactions = (transactions || []).flatMap((t: HistoricalCacheRow) => {
    const raw = t.raw_data
    return Array.isArray(raw) ? raw : [raw]
  })

  rawTransactions.forEach((tx: XeroRawTransaction) => {
    if (tx.Type === 'ACCREC' || (tx.Type === 'BANK' && parseFloat(String(tx.Total)) > 0)) {
      const amount = Math.abs(parseFloat(String(tx.Total)) || 0)
      const clientName = tx.Contact?.Name || tx.ContactName || 'Unknown Client'
      const clientId = tx.Contact?.ContactID || clientName

      if (!clientIncomeMap.has(clientId)) {
        clientIncomeMap.set(clientId, { name: clientName, total: 0 })
      }
      clientIncomeMap.get(clientId)!.total += amount
      totalIncome += amount
    }
  })

  // Analyze each client's contribution
  const clients: ClientPSIAnalysis[] = []
  let singleClientAbove80 = false
  let primaryClientName: string | null = null
  let primaryClientPercentage = 0

  clientIncomeMap.forEach((client, clientId) => {
    const percentage = totalIncome > 0
      ? new Decimal(client.total).div(new Decimal(totalIncome)).times(100).toNumber()
      : 0

    const isPSI = percentage >= 50 // Conservative: flag as PSI if significant portion

    if (percentage > primaryClientPercentage) {
      primaryClientPercentage = percentage
      primaryClientName = client.name
    }

    if (percentage >= PSI_SINGLE_CLIENT_THRESHOLD * 100) {
      singleClientAbove80 = true
    }

    const psiIndicators: string[] = []
    if (percentage >= 80) psiIndicators.push('80%+ of income from this client (s 87-15)')
    if (percentage >= 50) psiIndicators.push('Majority of income from this client')

    clients.push({
      clientName: client.name,
      clientId,
      totalIncome: client.total,
      percentageOfTotal: percentage,
      isPSI,
      psiIndicators,
    })
  })

  // Sort by income descending
  clients.sort((a, b) => b.totalIncome - a.totalIncome)

  // Results Test analysis (s 87-18)
  const resultsTest = analyzeResultsTest(rawTransactions, totalIncome, options)

  // Unrelated Clients Test (s 87-20)
  const unrelatedClientsTest = analyzeUnrelatedClientsTest(clients, options)

  // Employment Test (s 87-25)
  const employmentTest = analyzeEmploymentTest(rawTransactions, options)

  // Business Premises Test (s 87-30)
  const businessPremisesTest = analyzeBusinessPremisesTest(options)

  // Determine if PSB (Personal Services Business)
  // PSB if ANY of: results test, unrelated clients test, employment test, or business premises test passes
  // OR if ATO PSB determination held
  const isPSB = options?.hasPSBDetermination ||
    resultsTest.overallMet ||
    unrelatedClientsTest.met ||
    employmentTest.met ||
    businessPremisesTest.met

  // PSI rules apply if income IS PSI and entity is NOT a PSB
  const isPSIEntity = singleClientAbove80 || (clients.length <= 2 && totalIncome > 0)

  // Deduction restrictions if PSI rules apply
  const deductionRestrictions: string[] = []
  if (isPSIEntity && !isPSB) {
    deductionRestrictions.push('Deductions limited to those directly related to earning PSI (s 86-60 ITAA 1997)')
    deductionRestrictions.push('Cannot deduct home office expenses against PSI')
    deductionRestrictions.push('Cannot deduct car expenses for travel between home and client premises')
    deductionRestrictions.push('Cannot split PSI with associates (s 86-15)')
    deductionRestrictions.push('Entity must pay as salary/wages to individual who earned the PSI')
  }

  // Recommendations
  const recommendations = generatePSIRecommendations(
    isPSIEntity, isPSB, singleClientAbove80, resultsTest, clients, options
  )

  // Legislative references
  const legislativeReferences = [
    'Division 85 ITAA 1997 - Personal services income',
    'Division 86 ITAA 1997 - Alienation of PSI through entities',
    'Division 87 ITAA 1997 - Personal services business determinations',
    's 87-15 - 80% single client rule',
    's 87-18 - Results test (3 sub-requirements)',
    's 87-20 - Unrelated clients test',
    's 87-25 - Employment test',
    's 87-30 - Business premises test',
  ]

  const totalPSI = isPSIEntity ? totalIncome : 0
  const psiPercentage = totalIncome > 0 ? (totalPSI / totalIncome) * 100 : 0

  return {
    tenantId,
    financialYear: fy,
    totalIncome,
    totalPSI,
    psiPercentage,
    isPSIEntity,
    clients,
    singleClientAbove80,
    primaryClientName,
    primaryClientPercentage,
    resultsTest,
    unrelatedClientsTest,
    employmentTest,
    businessPremisesTest,
    isPSB,
    psbDeterminationRequired: isPSIEntity && !isPSB,
    deductionRestrictions,
    confidence: calculateOverallConfidence(resultsTest, unrelatedClientsTest, employmentTest, businessPremisesTest),
    recommendations,
    legislativeReferences,
    taxRateSource: 'Division_85_87_ITAA_1997',
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

/**
 * Results Test (s 87-18 ITAA 1997).
 * Requires ALL THREE sub-requirements to be met.
 */
function analyzeResultsTest(
  transactions: XeroRawTransaction[],
  totalIncome: number,
  options?: PSIAnalysisOptions
): ResultsTestAnalysis {
  // (a) 75%+ of income for producing a result
  // Heuristic: check for fixed-price vs hourly billing indicators
  let resultBasedIncome = 0
  const resultEvidence: string[] = []

  transactions.forEach((tx: XeroRawTransaction) => {
    if (tx.Type !== 'ACCREC') return
    const amount = Math.abs(parseFloat(String(tx.Total)) || 0)
    const desc = (tx.Description || tx.Reference || '').toLowerCase()

    // Indicators of result-based work (not time-based)
    const resultIndicators = ['project', 'deliverable', 'milestone', 'fixed price', 'completion', 'build', 'design', 'install']
    const timeIndicators = ['hourly', 'per hour', 'day rate', 'daily rate', 'time', 'hours']

    const isResultBased = resultIndicators.some(ind => desc.includes(ind))
    const isTimeBased = timeIndicators.some(ind => desc.includes(ind))

    if (isResultBased && !isTimeBased) {
      resultBasedIncome += amount
      if (resultEvidence.length < 5) {
        resultEvidence.push(`${tx.InvoiceNumber || 'Invoice'}: result-based billing detected`)
      }
    }
  })

  const resultPercentage = totalIncome > 0
    ? new Decimal(resultBasedIncome).div(new Decimal(totalIncome)).times(100).toNumber()
    : 0

  const producingResult = {
    met: resultPercentage >= PSI_RESULTS_TEST_THRESHOLD * 100,
    confidence: Math.min(60, resultPercentage), // Low confidence from heuristics alone
    percentage: resultPercentage,
    evidence: resultEvidence.length > 0
      ? resultEvidence
      : ['Insufficient invoice data to determine billing basis. Manual review required.'],
  }

  // (b) Provides own tools/equipment
  const ownTools = {
    met: options?.providesOwnTools ?? false,
    confidence: options?.providesOwnTools !== undefined ? 80 : 20,
    evidence: options?.providesOwnTools !== undefined
      ? [options.providesOwnTools ? 'User confirmed own tools/equipment' : 'User indicated client provides tools']
      : ['Tool ownership not specified. Review contracts for equipment provisions.'],
  }

  // (c) Liable for defective work
  const defectLiability = {
    met: options?.liableForDefects ?? false,
    confidence: options?.liableForDefects !== undefined ? 80 : 20,
    evidence: options?.liableForDefects !== undefined
      ? [options.liableForDefects ? 'User confirmed liability for defects' : 'User indicated no defect liability']
      : ['Defect liability not specified. Review contracts for warranty/rectification clauses.'],
  }

  // ALL THREE must pass for results test to be met
  const overallMet = producingResult.met && ownTools.met && defectLiability.met

  return {
    producingResult,
    ownTools,
    defectLiability,
    overallMet,
    overallConfidence: Math.round(
      (producingResult.confidence + ownTools.confidence + defectLiability.confidence) / 3
    ),
  }
}

/**
 * Unrelated Clients Test (s 87-20 ITAA 1997).
 */
function analyzeUnrelatedClientsTest(
  clients: ClientPSIAnalysis[],
  options?: PSIAnalysisOptions
): { met: boolean; confidence: number; notes: string[] } {
  const unrelatedCount = options?.unrelatedClientCount ?? clients.length

  // Need services provided to 2+ unrelated entities, obtained by making offers
  const met = unrelatedCount >= 2
  const notes: string[] = []

  if (met) {
    notes.push(`${unrelatedCount} clients identified. Must verify clients are unrelated and obtained through genuine offers.`)
    notes.push('s 87-20(1)(a): Services provided to 2+ unrelated entities')
    notes.push('s 87-20(1)(b): Services obtained by making offers or tenders to the public')
  } else {
    notes.push('Fewer than 2 unrelated clients identified. Unrelated clients test not satisfied.')
  }

  return {
    met,
    confidence: options?.unrelatedClientCount !== undefined ? 70 : 40,
    notes,
  }
}

/**
 * Employment Test (s 87-25 ITAA 1997).
 */
function analyzeEmploymentTest(
  _transactions: XeroRawTransaction[],
  _options?: PSIAnalysisOptions
): { met: boolean; confidence: number; notes: string[] } {
  // Employment test requires analysis of whether the individual would be
  // considered an employee under common law. This is highly fact-specific
  // and cannot be reliably determined from transaction data alone.
  return {
    met: false,
    confidence: 20,
    notes: [
      'Employment test requires analysis of the working arrangement against common law employee indicators.',
      'Key factors: control over work, integration into client business, working hours, leave entitlements.',
      'Professional review required to determine employment test outcome (s 87-25 ITAA 1997).',
    ],
  }
}

/**
 * Business Premises Test (s 87-30 ITAA 1997).
 */
function analyzeBusinessPremisesTest(
  options?: PSIAnalysisOptions
): { met: boolean; confidence: number; notes: string[] } {
  const hasPremises = options?.hasSeparatePremises ?? false

  return {
    met: hasPremises,
    confidence: options?.hasSeparatePremises !== undefined ? 80 : 20,
    notes: hasPremises
      ? [
          'User confirmed separate business premises.',
          'Premises must be used exclusively or primarily for providing services (s 87-30).',
          'Home office does NOT satisfy this test unless separate from living areas and primarily used for business.',
        ]
      : [
          'Separate business premises not confirmed.',
          's 87-30 requires premises maintained primarily for providing services.',
        ],
  }
}

function calculateOverallConfidence(
  resultsTest: ResultsTestAnalysis,
  unrelatedClientsTest: { confidence: number },
  employmentTest: { confidence: number },
  businessPremisesTest: { confidence: number }
): number {
  return Math.round(
    (resultsTest.overallConfidence +
      unrelatedClientsTest.confidence +
      employmentTest.confidence +
      businessPremisesTest.confidence) / 4
  )
}

function generatePSIRecommendations(
  isPSIEntity: boolean,
  isPSB: boolean,
  singleClientAbove80: boolean,
  resultsTest: ResultsTestAnalysis,
  clients: ClientPSIAnalysis[],
  options?: PSIAnalysisOptions
): string[] {
  const recommendations: string[] = []

  if (!isPSIEntity) {
    recommendations.push('Income does not appear to be PSI. Standard deduction rules apply.')
    return recommendations
  }

  if (isPSB) {
    recommendations.push('Entity qualifies as a Personal Services Business (PSB). PSI deduction restrictions do NOT apply.')
    if (options?.hasPSBDetermination) {
      recommendations.push('PSB determination held from ATO. Ensure determination remains valid and conditions are met.')
    }
  } else {
    recommendations.push('PSI rules apply - deductions are restricted to those directly related to earning PSI (Division 86).')
    recommendations.push('Consider applying for a PSB determination from the ATO if you believe the business qualifies.')
  }

  if (singleClientAbove80) {
    const topClient = clients[0]
    recommendations.push(
      `80%+ rule triggered: ${topClient?.clientName || 'primary client'} represents ${topClient?.percentageOfTotal.toFixed(0)}% of income (s 87-15).`
    )
    recommendations.push('Diversify client base to reduce PSI exposure.')
  }

  if (!resultsTest.overallMet) {
    if (!resultsTest.producingResult.met) {
      recommendations.push('Results test (a) not met: Less than 75% of income appears result-based. Review billing to use fixed-price/milestone-based invoicing.')
    }
    if (!resultsTest.ownTools.met) {
      recommendations.push('Results test (b) not met: Own tools/equipment not confirmed. Document tools provided for client work.')
    }
    if (!resultsTest.defectLiability.met) {
      recommendations.push('Results test (c) not met: Defect liability not confirmed. Include warranty/rectification clauses in contracts.')
    }
  }

  recommendations.push('Professional review recommended to confirm PSI classification and available deductions.')

  return recommendations
}
