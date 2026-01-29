/**
 * R&D Tax Incentive Analysis Engine (Division 355)
 *
 * Analyzes R&D candidates to identify eligible expenditure and calculate
 * the 43.5% refundable tax offset under Division 355 ITAA 1997.
 *
 * Four-Element Test for R&D Eligibility:
 * 1. Outcome Unknown: The outcome of the activity cannot be determined in advance
 * 2. Systematic Approach: Follows a systematic progression of work
 * 3. New Knowledge: Generates new knowledge about a scientific or technical uncertainty
 * 4. Scientific Method: Uses principles of science, engineering, or computer science
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'

// R&D Tax Incentive Rates (Division 355)
// NOTE: These are fallback values - actual values fetched from ATO.gov.au
const FALLBACK_RND_OFFSET_RATE = 0.435 // 43.5% refundable offset (2024-25 fallback)
const MIN_CONFIDENCE_FOR_RECOMMENDATION = 70 // Minimum confidence to recommend claiming
const REGISTRATION_DEADLINE_MONTHS = 10 // 10 months after end of financial year

// Cache for R&D offset rate (refreshed per function invocation)
let cachedRndRate: number | null = null
let cachedRndSource: string = 'fallback'

/**
 * Get current R&D offset rate from ATO (cached for 24 hours)
 */
async function getRndOffsetRate(): Promise<{ rate: number; source: string }> {
  if (cachedRndRate !== null) {
    return { rate: cachedRndRate, source: cachedRndSource }
  }

  try {
    const rates = await getCurrentTaxRates()
    cachedRndRate = rates.rndOffsetRate || FALLBACK_RND_OFFSET_RATE
    cachedRndSource = rates.sources.rndIncentive || 'ATO_FALLBACK_DEFAULT'
    return { rate: cachedRndRate, source: cachedRndSource }
  } catch (error) {
    console.warn('Failed to fetch R&D offset rate, using fallback value:', error)
    return { rate: FALLBACK_RND_OFFSET_RATE, source: 'ERROR_FALLBACK' }
  }
}

export interface FourElementTest {
  outcomeUnknown: {
    met: boolean
    confidence: number // 0-100
    evidence: string[]
  }
  systematicApproach: {
    met: boolean
    confidence: number
    evidence: string[]
  }
  newKnowledge: {
    met: boolean
    confidence: number
    evidence: string[]
  }
  scientificMethod: {
    met: boolean
    confidence: number
    evidence: string[]
  }
}

export interface RndTransaction {
  transactionId: string
  transactionDate: string
  description: string
  amount: number
  supplier: string | null
  activityType: 'core_rnd' | 'supporting_rnd' | 'not_eligible'
  confidence: number
  reasoning: string
  fourElementTest: FourElementTest
}

export interface RndProjectAnalysis {
  projectName: string
  projectDescription: string
  financialYears: string[]
  totalExpenditure: number
  eligibleExpenditure: number
  estimatedOffset: number // 43.5% of eligible expenditure (s 355-100 ITAA 1997)
  meetsEligibility: boolean
  eligibilityCriteria: FourElementTest
  overallConfidence: number // Average confidence across all elements
  transactions: RndTransaction[]
  transactionCount: number
  registrationDeadline: Date
  registrationStatus: 'not_registered' | 'deadline_approaching' | 'deadline_passed'
  documentationRequired: string[]
  recommendations: string[]
  evidence: string[] // Supporting evidence from forensic analysis results
  evidenceSufficient: boolean // Whether minimum evidence threshold is met
}

/**
 * Borderline/excluded R&D project that did not meet eligibility thresholds.
 * Included in output so users can review near-misses and provide additional
 * documentation to potentially qualify under Division 355 ITAA 1997.
 */
export interface BorderlineProject {
  projectName: string
  confidence: number
  transactionCount: number
  totalAmount: number
  reason: string
  failedElements: string[] // Which four-element test criteria were not met
}

export interface RndSummary {
  totalProjects: number
  totalEligibleExpenditure: number
  totalEstimatedOffset: number
  projectsByYear: Record<string, number>
  expenditureByYear: Record<string, number>
  offsetByYear: Record<string, number>
  averageConfidence: number
  coreRndTransactions: number
  supportingRndTransactions: number
  projects: RndProjectAnalysis[]
  /** Source URL of the tax rate used for calculations */
  taxRateSource: string
  /** Timestamp of when the tax rate was verified */
  taxRateVerifiedAt: string

  /** Projects excluded due to insufficient evidence or failed eligibility (Division 355 s 355-25) */
  excludedProjects: BorderlineProject[]
  /** Summary note about excluded projects for user review */
  excludedProjectsNote: string
}

/**
 * Analyze all R&D opportunities for a tenant across multiple years
 */
export async function analyzeRndOpportunities(
  tenantId: string,
  startYear?: string,
  endYear?: string
): Promise<RndSummary> {
  const supabase = await createServiceClient()

  // Build query for R&D candidates
  let query = supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_rnd_candidate', true)
    .order('transaction_date', { ascending: true })

  if (startYear) {
    query = query.gte('financial_year', startYear)
  }
  if (endYear) {
    query = query.lte('financial_year', endYear)
  }

  const { data: rndCandidates, error } = await query

  if (error) {
    console.error('Failed to fetch R&D candidates:', error)
    throw new Error(`Failed to fetch R&D candidates: ${error.message}`)
  }

  if (!rndCandidates || rndCandidates.length === 0) {
    console.log(`No R&D candidates found for tenant ${tenantId}`)
    return {
      totalProjects: 0,
      totalEligibleExpenditure: 0,
      totalEstimatedOffset: 0,
      projectsByYear: {},
      expenditureByYear: {},
      offsetByYear: {},
      averageConfidence: 0,
      coreRndTransactions: 0,
      supportingRndTransactions: 0,
      projects: [],
      excludedProjects: [],
      excludedProjectsNote: '',
      taxRateSource: 'none',
      taxRateVerifiedAt: new Date().toISOString(),
    }
  }

  console.log(`Found ${rndCandidates.length} R&D candidate transactions`)

  // Get current R&D offset rate from ATO
  const { rate: rndOffsetRate, source: rndOffsetSource } = await getRndOffsetRate()
  console.log(`Using R&D offset rate: ${(rndOffsetRate * 100).toFixed(1)}% [Source: ${rndOffsetSource}]`)

  // Group transactions into projects (returns both eligible and excluded)
  const { eligible, excluded } = groupIntoProjects(rndCandidates, rndOffsetRate)

  // Calculate summary statistics (includes excluded projects for user visibility)
  const summary = calculateRndSummary(eligible, excluded, rndOffsetRate, rndOffsetSource)

  return summary
}

/**
 * Group R&D candidate transactions into logical projects.
 * Uses category and supplier patterns to identify related work.
 *
 * Returns both eligible projects and excluded (borderline) projects.
 * Excluded projects are NOT silently dropped - they are returned so users
 * can review near-misses and provide additional documentation.
 * Division 355 ITAA 1997 (s 355-25, s 355-30)
 */
function groupIntoProjects(
  transactions: any[],
  rndOffsetRate: number
): { eligible: RndProjectAnalysis[]; excluded: BorderlineProject[] } {
  const projectMap = new Map<string, any[]>()

  // Group by primary category and supplier patterns
  transactions.forEach((tx) => {
    const category = tx.primary_category || 'Uncategorized R&D'
    const supplier = tx.supplier_name || 'Internal'

    // Create project key based on category and supplier
    const projectKey = `${category} - ${supplier}`

    if (!projectMap.has(projectKey)) {
      projectMap.set(projectKey, [])
    }
    projectMap.get(projectKey)!.push(tx)
  })

  // Convert grouped transactions into project analyses
  const eligible: RndProjectAnalysis[] = []
  const excluded: BorderlineProject[] = []

  projectMap.forEach((txs, projectKey) => {
    const project = analyzeProject(projectKey, txs, rndOffsetRate)

    if (project.meetsEligibility && project.overallConfidence >= MIN_CONFIDENCE_FOR_RECOMMENDATION) {
      eligible.push(project)
    } else {
      // Build exclusion reason and track failed elements (Fix 5c)
      const failedElements: string[] = []
      if (!project.eligibilityCriteria.outcomeUnknown.met) {
        failedElements.push('outcomeUnknown')
      }
      if (!project.eligibilityCriteria.systematicApproach.met) {
        failedElements.push('systematicApproach')
      }
      if (!project.eligibilityCriteria.newKnowledge.met) {
        failedElements.push('newKnowledge')
      }
      if (!project.eligibilityCriteria.scientificMethod.met) {
        failedElements.push('scientificMethod')
      }

      const reasons: string[] = []
      if (failedElements.length > 0) {
        reasons.push(
          `Failed four-element test: ${failedElements.join(', ')} not met (s 355-25 ITAA 1997)`
        )
      }
      if (project.overallConfidence < MIN_CONFIDENCE_FOR_RECOMMENDATION) {
        reasons.push(
          `Confidence ${project.overallConfidence}% below ${MIN_CONFIDENCE_FOR_RECOMMENDATION}% threshold`
        )
      }
      if (!project.evidenceSufficient) {
        reasons.push('Insufficient supporting evidence for R&D claim')
      }

      excluded.push({
        projectName: project.projectName,
        confidence: project.overallConfidence,
        transactionCount: project.transactionCount,
        totalAmount: project.totalExpenditure,
        reason: reasons.join('; '),
        failedElements,
      })
    }
  })

  // Sort eligible by estimated offset (descending)
  eligible.sort((a, b) => b.estimatedOffset - a.estimatedOffset)

  // Sort excluded by total amount (descending) so highest-value near-misses appear first
  excluded.sort((a, b) => b.totalAmount - a.totalAmount)

  return { eligible, excluded }
}

/**
 * Analyze a group of related transactions as a single R&D project
 */
function analyzeProject(projectName: string, transactions: any[], rndOffsetRate: number): RndProjectAnalysis {
  const financialYears = Array.from(new Set(transactions.map((tx) => tx.financial_year))).sort()

  // Calculate expenditure and eligibility
  let totalExpenditure = 0
  let eligibleExpenditure = 0
  let coreRndExpenditure = 0
  let supportingRndExpenditure = 0

  const rndTransactions: RndTransaction[] = transactions.map((tx) => {
    const amount = parseFloat(tx.transaction_amount) || 0
    totalExpenditure += amount

    // Only include in eligible expenditure if meets Division 355 criteria
    if (tx.meets_div355_criteria && tx.rnd_confidence >= MIN_CONFIDENCE_FOR_RECOMMENDATION) {
      eligibleExpenditure += amount

      if (tx.rnd_activity_type === 'core_rnd') {
        coreRndExpenditure += amount
      } else if (tx.rnd_activity_type === 'supporting_rnd') {
        supportingRndExpenditure += amount
      }
    }

    return {
      transactionId: tx.transaction_id,
      transactionDate: tx.transaction_date,
      description: tx.transaction_description,
      amount,
      supplier: tx.supplier_name,
      activityType: tx.rnd_activity_type,
      confidence: tx.rnd_confidence,
      reasoning: tx.rnd_reasoning,
      fourElementTest: parseFourElementTest(tx),
    }
  })

  // Collect supporting evidence from forensic analysis results (Fix 5b)
  // Division 355 ITAA 1997: Evidence must substantiate each R&D activity claim
  const projectEvidence: string[] = []
  transactions.forEach((tx) => {
    // Extract from supporting_evidence JSONB/text field in forensic_analysis_results
    if (tx.supporting_evidence) {
      if (typeof tx.supporting_evidence === 'string') {
        // Single string evidence entry
        if (tx.supporting_evidence.trim().length > 0) {
          projectEvidence.push(
            `[${tx.transaction_id}] ${tx.supporting_evidence.trim()}`
          )
        }
      } else if (Array.isArray(tx.supporting_evidence)) {
        // Array of evidence items
        tx.supporting_evidence.forEach((ev: string) => {
          if (typeof ev === 'string' && ev.trim().length > 0) {
            projectEvidence.push(`[${tx.transaction_id}] ${ev.trim()}`)
          }
        })
      } else if (typeof tx.supporting_evidence === 'object') {
        // JSONB object - extract relevant fields
        const evidenceObj = tx.supporting_evidence as Record<string, unknown>
        const evidenceEntries = Object.entries(evidenceObj)
          .filter(([, v]) => v && typeof v === 'string' && (v as string).trim().length > 0)
          .map(([k, v]) => `[${tx.transaction_id}] ${k}: ${(v as string).trim()}`)
        projectEvidence.push(...evidenceEntries)
      }
    }

    // Also include rnd_reasoning as fallback evidence if no supporting_evidence
    if (projectEvidence.length === 0 && tx.rnd_reasoning && typeof tx.rnd_reasoning === 'string') {
      projectEvidence.push(`[${tx.transaction_id}] ${tx.rnd_reasoning}`)
    }
  })

  // Deduplicate evidence
  const uniqueEvidence = Array.from(new Set(projectEvidence))

  // Calculate overall eligibility criteria (aggregate across all transactions)
  const aggregatedCriteria = aggregateFourElementTest(transactions)

  // Inject collected evidence into the aggregated criteria elements
  // This ensures per-element evidence is populated from forensic analysis
  const elementNames: Array<keyof FourElementTest> = [
    'outcomeUnknown', 'systematicApproach', 'newKnowledge', 'scientificMethod'
  ]
  elementNames.forEach((elementName) => {
    if (aggregatedCriteria[elementName].evidence.length === 0 && uniqueEvidence.length > 0) {
      // Populate from project-level evidence when element-level evidence is empty
      aggregatedCriteria[elementName].evidence = uniqueEvidence.slice(0, 10) // Cap at 10 items per element
    }
  })

  // Calculate average confidence
  let avgConfidence = transactions.reduce((sum, tx) => sum + (tx.rnd_confidence || 0), 0) / transactions.length

  // Evidence sufficiency check (Division 355 s 355-25):
  // Cannot claim high confidence without substantive evidence
  const MIN_EVIDENCE_FOR_HIGH_CONFIDENCE = 3
  if (uniqueEvidence.length < MIN_EVIDENCE_FOR_HIGH_CONFIDENCE) {
    // Cap confidence to prevent overstatement when evidence is insufficient
    avgConfidence = Math.min(avgConfidence, 50) // Force 'low' confidence band
  }

  // Calculate R&D offset (using current ATO rate)
  const estimatedOffset = eligibleExpenditure * rndOffsetRate

  // Determine if project meets eligibility
  const meetsEligibility =
    aggregatedCriteria.outcomeUnknown.met &&
    aggregatedCriteria.systematicApproach.met &&
    aggregatedCriteria.newKnowledge.met &&
    aggregatedCriteria.scientificMethod.met &&
    eligibleExpenditure > 0

  // Calculate registration deadline (10 months after end of latest FY)
  const latestYear = financialYears[financialYears.length - 1]
  const registrationDeadline = calculateRegistrationDeadline(latestYear)
  const registrationStatus = getRegistrationStatus(registrationDeadline)

  // Generate documentation requirements
  const documentationRequired = generateDocumentationRequirements(
    coreRndExpenditure,
    supportingRndExpenditure,
    transactions.length
  )

  // Add evidence insufficiency flag to documentation requirements
  if (uniqueEvidence.length < MIN_EVIDENCE_FOR_HIGH_CONFIDENCE) {
    documentationRequired.unshift(
      '⚠️ Insufficient evidence - professional review required before claiming (Division 355 ITAA 1997)'
    )
  }

  // Generate recommendations
  const recommendations = generateRecommendations(
    projectName,
    meetsEligibility,
    estimatedOffset,
    registrationStatus,
    avgConfidence,
    financialYears
  )

  // Create project description
  const projectDescription = generateProjectDescription(
    transactions,
    coreRndExpenditure,
    supportingRndExpenditure
  )

  return {
    projectName,
    projectDescription,
    financialYears,
    totalExpenditure,
    eligibleExpenditure,
    estimatedOffset,
    meetsEligibility,
    eligibilityCriteria: aggregatedCriteria,
    overallConfidence: Math.round(avgConfidence),
    transactions: rndTransactions,
    transactionCount: transactions.length,
    registrationDeadline,
    registrationStatus,
    documentationRequired,
    recommendations,
    evidence: uniqueEvidence,
    evidenceSufficient: uniqueEvidence.length >= MIN_EVIDENCE_FOR_HIGH_CONFIDENCE,
  }
}

/**
 * Parse four-element test from forensic analysis result
 */
function parseFourElementTest(tx: any): FourElementTest {
  // Try to parse from JSON if stored as object
  if (tx.rnd_four_element_test && typeof tx.rnd_four_element_test === 'object') {
    return tx.rnd_four_element_test as FourElementTest
  }

  // Fallback: create basic structure from available fields
  return {
    outcomeUnknown: {
      met: tx.meets_div355_criteria || false,
      confidence: tx.rnd_confidence || 0,
      evidence: tx.rnd_reasoning ? [tx.rnd_reasoning] : [],
    },
    systematicApproach: {
      met: tx.meets_div355_criteria || false,
      confidence: tx.rnd_confidence || 0,
      evidence: [],
    },
    newKnowledge: {
      met: tx.meets_div355_criteria || false,
      confidence: tx.rnd_confidence || 0,
      evidence: [],
    },
    scientificMethod: {
      met: tx.meets_div355_criteria || false,
      confidence: tx.rnd_confidence || 0,
      evidence: [],
    },
  }
}

/**
 * Aggregate four-element test across multiple transactions
 * All four elements must be consistently met across the project
 *
 * Division 355 ITAA 1997 (s 355-25 core R&D, s 355-30 supporting R&D):
 * Elements are weighted by dollar value, not transaction count, to prevent
 * many small irrelevant transactions from outvoting significant expenditure.
 */
function aggregateFourElementTest(transactions: any[]): FourElementTest {
  const allTests = transactions.map(parseFourElementTest)
  const amounts = transactions.map((tx) => Math.abs(parseFloat(tx.transaction_amount) || 0))

  return {
    outcomeUnknown: aggregateElement(allTests.map((t) => t.outcomeUnknown), amounts),
    systematicApproach: aggregateElement(allTests.map((t) => t.systematicApproach), amounts),
    newKnowledge: aggregateElement(allTests.map((t) => t.newKnowledge), amounts),
    scientificMethod: aggregateElement(allTests.map((t) => t.scientificMethod), amounts),
  }
}

/**
 * Aggregate a single element across multiple transactions, weighted by dollar value.
 *
 * The element is considered "met" if at least 70% of the total dollar value
 * (not transaction count) passes the element. This ensures large expenditure
 * items are weighted proportionally to their significance.
 *
 * Example: 10 x $100 transactions (pass) + 1 x $50,000 (fail)
 *   - By count: 91% pass (MISLEADING)
 *   - By value: 1.9% pass (CORRECT - the dominant expenditure fails)
 */
function aggregateElement(
  elements: Array<{ met: boolean; confidence: number; evidence: string[] }>,
  amounts: number[]
) {
  const totalAmount = amounts.reduce((sum, a) => sum + a, 0)
  const allEvidence = elements.flatMap((e) => e.evidence)

  // Weight by dollar value: sum amounts where the element is met
  let passingAmount = 0
  let weightedConfidenceSum = 0

  elements.forEach((e, i) => {
    const txAmount = amounts[i] || 0
    if (e.met) {
      passingAmount += txAmount
    }
    weightedConfidenceSum += e.confidence * txAmount
  })

  // Value-weighted pass rate (Division 355 s 355-25: eligibility by expenditure significance)
  const passRate = totalAmount > 0 ? passingAmount / totalAmount : 0
  const weightedConfidence = totalAmount > 0
    ? weightedConfidenceSum / totalAmount
    : elements.reduce((sum, e) => sum + e.confidence, 0) / (elements.length || 1)

  return {
    met: passRate >= 0.7, // At least 70% of dollar value meets this element
    confidence: Math.round(weightedConfidence),
    evidence: Array.from(new Set(allEvidence)), // Deduplicate evidence
  }
}

/**
 * Calculate registration deadline (10 months after end of financial year)
 */
function calculateRegistrationDeadline(financialYear: string): Date {
  // Financial year format: "FY2024-25" means July 1, 2024 to June 30, 2025
  const endYearMatch = financialYear.match(/FY\d{4}-(\d{2})/)
  if (!endYearMatch) {
    throw new Error(`Invalid financial year format: ${financialYear}`)
  }

  const endYearShort = parseInt(endYearMatch[1], 10)
  const endYear = endYearShort < 50 ? 2000 + endYearShort : 1900 + endYearShort

  // FY ends June 30
  const fyEndDate = new Date(endYear, 5, 30) // Month is 0-indexed (5 = June)

  // Registration deadline is 10 months after FY end
  const deadline = new Date(fyEndDate)
  deadline.setMonth(deadline.getMonth() + REGISTRATION_DEADLINE_MONTHS)

  return deadline
}

/**
 * Determine registration status based on deadline
 */
function getRegistrationStatus(deadline: Date): 'not_registered' | 'deadline_approaching' | 'deadline_passed' {
  const now = new Date()
  const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDeadline < 0) {
    return 'deadline_passed'
  } else if (daysUntilDeadline < 90) {
    return 'deadline_approaching' // Less than 3 months remaining
  } else {
    return 'not_registered'
  }
}

/**
 * Generate documentation requirements for R&D project
 */
function generateDocumentationRequirements(
  coreRndExpenditure: number,
  supportingRndExpenditure: number,
  transactionCount: number
): string[] {
  const requirements: string[] = []

  requirements.push('R&D Tax Incentive Schedule (Schedule 16N) - detailing all eligible R&D activities')
  requirements.push('Company Tax Return - including R&D offset claim')
  requirements.push('Technical documentation explaining the scientific or technical uncertainty addressed')
  requirements.push('Project plan or methodology showing systematic approach')
  requirements.push('Evidence of new knowledge generated (reports, prototypes, test results)')

  if (coreRndExpenditure > 0) {
    requirements.push(`Core R&D activities documentation (${transactionCount} transactions totaling $${coreRndExpenditure.toFixed(2)})`)
  }

  if (supportingRndExpenditure > 0) {
    requirements.push(`Supporting R&D activities documentation and nexus to core R&D`)
  }

  requirements.push('Invoices, timesheets, and payment records for all claimed expenditure')
  requirements.push('Advance/Overseas Finding (if applicable) for activities conducted outside Australia')

  return requirements
}

/**
 * Generate actionable recommendations for R&D project
 */
function generateRecommendations(
  projectName: string,
  meetsEligibility: boolean,
  estimatedOffset: number,
  registrationStatus: string,
  confidence: number,
  financialYears: string[]
): string[] {
  const recommendations: string[] = []

  if (!meetsEligibility) {
    recommendations.push('❌ Does not meet Division 355 four-element test - not eligible for R&D offset')
    recommendations.push('Consider reviewing project activities to ensure scientific/technical uncertainty exists')
    return recommendations
  }

  if (confidence < MIN_CONFIDENCE_FOR_RECOMMENDATION) {
    recommendations.push(`⚠️ Confidence level (${confidence}%) below recommendation threshold (${MIN_CONFIDENCE_FOR_RECOMMENDATION}%)`)
    recommendations.push('Recommend detailed review with R&D tax specialist before claiming')
  }

  if (registrationStatus === 'deadline_passed') {
    recommendations.push('⚠️ Registration deadline has passed for some financial years')
    recommendations.push('Check if late registration is possible or if amendments can be lodged')
  } else if (registrationStatus === 'deadline_approaching') {
    recommendations.push('🔴 URGENT: Registration deadline approaching - register immediately')
  } else {
    recommendations.push('✅ Registration window is open - register R&D activities with AusIndustry')
  }

  recommendations.push(`💰 Estimated R&D offset: $${estimatedOffset.toFixed(2)} (43.5% refundable)`)
  recommendations.push(`📋 Lodge Schedule 16N for ${financialYears.join(', ')}`)
  recommendations.push('Ensure all four-element test criteria are documented in technical reports')
  recommendations.push('Maintain detailed project records (timesheets, invoices, technical documentation)')

  if (estimatedOffset > 100000) {
    recommendations.push('⚠️ High-value claim (>$100k) - expect ATO review, ensure documentation is comprehensive')
  }

  return recommendations
}

/**
 * Generate project description from transactions
 */
function generateProjectDescription(
  transactions: any[],
  coreRndExpenditure: number,
  supportingRndExpenditure: number
): string {
  const categories = Array.from(new Set(transactions.map((tx) => tx.primary_category)))
  const suppliers = Array.from(new Set(transactions.map((tx) => tx.supplier_name).filter(Boolean)))

  let description = `R&D project involving ${categories.join(', ')} activities`

  if (suppliers.length > 0) {
    description += ` with ${suppliers.length} supplier(s): ${suppliers.slice(0, 3).join(', ')}`
    if (suppliers.length > 3) {
      description += ` and ${suppliers.length - 3} others`
    }
  }

  description += `. Core R&D: $${coreRndExpenditure.toFixed(2)}, Supporting R&D: $${supportingRndExpenditure.toFixed(2)}.`

  return description
}

/**
 * Calculate overall R&D summary across all projects.
 * Includes excluded/borderline projects for user visibility (Fix 5c).
 * Excluded projects are NOT included in eligible expenditure totals.
 */
function calculateRndSummary(
  projects: RndProjectAnalysis[],
  excludedProjects: BorderlineProject[],
  rndOffsetRate: number,
  rndOffsetSource: string
): RndSummary {
  let totalEligibleExpenditure = 0
  let totalEstimatedOffset = 0
  let totalConfidence = 0
  let coreRndTransactions = 0
  let supportingRndTransactions = 0

  const projectsByYear: Record<string, number> = {}
  const expenditureByYear: Record<string, number> = {}
  const offsetByYear: Record<string, number> = {}

  projects.forEach((project) => {
    totalEligibleExpenditure += project.eligibleExpenditure
    totalEstimatedOffset += project.estimatedOffset
    totalConfidence += project.overallConfidence

    project.transactions.forEach((tx) => {
      if (tx.activityType === 'core_rnd') {
        coreRndTransactions++
      } else if (tx.activityType === 'supporting_rnd') {
        supportingRndTransactions++
      }
    })

    project.financialYears.forEach((year) => {
      projectsByYear[year] = (projectsByYear[year] || 0) + 1

      const yearExpenditure = project.transactions
        .filter((tx) => tx.transactionDate.includes(year.replace('FY', '')))
        .reduce((sum, tx) => sum + tx.amount, 0)

      expenditureByYear[year] = (expenditureByYear[year] || 0) + yearExpenditure
      offsetByYear[year] = (offsetByYear[year] || 0) + (yearExpenditure * rndOffsetRate)
    })
  })

  const averageConfidence = projects.length > 0 ? Math.round(totalConfidence / projects.length) : 0

  // Generate summary note for excluded projects (Division 355 s 355-25 ITAA 1997)
  const excludedNote = excludedProjects.length > 0
    ? `${excludedProjects.length} project(s) excluded due to insufficient evidence or failed eligibility criteria. ` +
    `Review these projects - additional documentation may qualify them for R&D Tax Incentive under Division 355 ITAA 1997.`
    : ''

  return {
    totalProjects: projects.length,
    totalEligibleExpenditure,
    totalEstimatedOffset,
    projectsByYear,
    expenditureByYear,
    offsetByYear,
    averageConfidence,
    coreRndTransactions,
    supportingRndTransactions,
    projects,
    excludedProjects,
    excludedProjectsNote: excludedNote,
    taxRateSource: rndOffsetSource,
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

/**
 * Get detailed analysis for a specific R&D project
 */
export async function getProjectDetails(
  tenantId: string,
  projectName: string
): Promise<RndProjectAnalysis | null> {
  const summary = await analyzeRndOpportunities(tenantId)
  const project = summary.projects.find((p) => p.projectName === projectName)
  return project || null
}

/**
 * Calculate total R&D benefit across all years
 */
export async function calculateTotalRndBenefit(tenantId: string): Promise<number> {
  const summary = await analyzeRndOpportunities(tenantId)
  return summary.totalEstimatedOffset
}
