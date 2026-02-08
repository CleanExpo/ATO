/**
 * Audit Risk Assessment Engine
 *
 * Evaluates the likelihood of an ATO audit based on:
 * - Deviation from ATO industry benchmarks
 * - Known high-scrutiny categories (cash businesses, R&D claims, etc.)
 * - Historical amendment patterns
 * - Unusual transaction patterns
 *
 * IMPORTANT: ATO benchmarks are DESCRIPTIVE, not NORMATIVE.
 * Being outside a benchmark is NOT illegal. It increases audit probability.
 * This engine NEVER recommends changing business behaviour to match benchmarks.
 * Correct framing: "Your figures deviate from ATO benchmarks. This may increase audit likelihood."
 *
 * Sources:
 * - ATO Small Business Benchmarks (ato.gov.au/Business/Small-business-benchmarks)
 * - ATO compliance focus areas (published annually)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentFinancialYear, checkAmendmentPeriod, type EntityTypeForAmendment } from '@/lib/utils/financial-year'
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
  [key: string]: unknown
}

/** Row from historical_transactions_cache */
interface HistoricalCacheRow {
  raw_data: XeroRawTransaction | XeroRawTransaction[]
  financial_year?: string
  [key: string]: unknown
}

/**
 * Risk level classification.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high'

/**
 * Individual risk factor.
 */
export interface RiskFactor {
  category: string
  description: string
  riskLevel: RiskLevel
  /** Risk score 0-100 */
  score: number
  /** ATO benchmark value (if applicable) */
  benchmarkValue?: number
  /** Entity's actual value */
  actualValue?: number
  /** Deviation from benchmark (percentage) */
  deviation?: number
  /** Specific ATO compliance focus area reference */
  atoFocusArea?: string
  /** Legislative reference */
  legislativeReference?: string
  /** Actionable note (never "change to match benchmark") */
  note: string
}

/**
 * ATO industry benchmark data.
 */
export interface IndustryBenchmark {
  industryCode: string
  industryName: string
  costOfSalesRatio: { low: number; high: number }
  totalExpenseRatio: { low: number; high: number }
  labourCostRatio: { low: number; high: number }
  rentRatio: { low: number; high: number }
  motorVehicleRatio: { low: number; high: number }
}

/**
 * Audit risk assessment result.
 */
export interface AuditRiskAssessment {
  tenantId: string
  financialYear: string

  // Overall assessment
  overallRiskLevel: RiskLevel
  overallRiskScore: number // 0-100
  auditProbabilityEstimate: string // e.g., "Moderate" -- NOT a precise percentage

  // Risk factors
  riskFactors: RiskFactor[]
  highRiskFactors: RiskFactor[]
  mediumRiskFactors: RiskFactor[]

  // Benchmark comparison
  benchmarkComparison: {
    industryCode: string
    industryName: string
    deviations: Array<{
      metric: string
      benchmarkRange: string
      actualValue: number
      isOutside: boolean
      note: string
    }>
  } | null

  // ATO compliance focus areas for current year
  complianceFocusAreas: string[]

  // Metadata
  confidence: number
  recommendations: string[]
  disclaimer: string
  legislativeReferences: string[]
  taxRateSource: string
  taxRateVerifiedAt: string
}

// ATO compliance focus areas (updated annually from ATO publications)
const ATO_COMPLIANCE_FOCUS_AREAS = [
  'Work-related expenses (particularly work from home deductions)',
  'Rental property expenses and deductions',
  'Capital gains on cryptocurrency and property',
  'Cash economy and unreported income',
  'Division 7A private company loans and payments',
  'R&D Tax Incentive claims',
  'Trusts and distribution of income',
  'International transactions and transfer pricing',
  'GST reporting and BAS obligations',
  'Superannuation guarantee compliance',
]

// Simplified industry benchmarks (in production, these would come from ATO data)
const FALLBACK_BENCHMARKS: Record<string, IndustryBenchmark> = {
  'default': {
    industryCode: 'default',
    industryName: 'General Business',
    costOfSalesRatio: { low: 0.30, high: 0.70 },
    totalExpenseRatio: { low: 0.60, high: 0.95 },
    labourCostRatio: { low: 0.20, high: 0.50 },
    rentRatio: { low: 0.02, high: 0.15 },
    motorVehicleRatio: { low: 0.01, high: 0.08 },
  },
}

/**
 * Assess audit risk for a tenant.
 */
export async function assessAuditRisk(
  tenantId: string,
  financialYear?: string,
  industryCode?: string,
  entityType?: EntityTypeForAmendment
): Promise<AuditRiskAssessment> {
  const fy = financialYear || getCurrentFinancialYear()
  const supabase = await createServiceClient()

  // Fetch financial data
  const { data: transactions, error } = await supabase
    .from('historical_transactions_cache')
    .select('raw_data, financial_year')
    .eq('tenant_id', tenantId)
    .eq('financial_year', fy)

  if (error) {
    console.error('Failed to fetch transactions for audit risk:', error)
    throw new Error(`Failed to fetch transactions: ${error.message}`)
  }

  // Parse financial metrics
  const metrics = calculateFinancialMetrics(transactions || [])

  // Get benchmark data
  const benchmark = FALLBACK_BENCHMARKS[industryCode || 'default'] || FALLBACK_BENCHMARKS['default']

  // Assess individual risk factors
  const riskFactors: RiskFactor[] = []

  // 1. Benchmark deviation analysis
  if (metrics.totalIncome > 0) {
    assessBenchmarkRisk(metrics, benchmark, riskFactors)
  }

  // 2. High-scrutiny category analysis
  assessHighScrutinyCategories(metrics, riskFactors)

  // 3. Transaction pattern analysis
  assessTransactionPatterns(metrics, riskFactors)

  // 4. Amendment period proximity
  const amendmentWarning = checkAmendmentPeriod(fy, entityType || 'unknown')
  if (amendmentWarning) {
    riskFactors.push({
      category: 'Amendment Period',
      description: 'Financial year approaching amendment period expiry',
      riskLevel: 'medium',
      score: 40,
      note: amendmentWarning,
    })
  }

  // Calculate overall risk
  const highRiskFactors = riskFactors.filter(f => f.riskLevel === 'high' || f.riskLevel === 'very_high')
  const mediumRiskFactors = riskFactors.filter(f => f.riskLevel === 'medium')

  const overallRiskScore = calculateOverallRiskScore(riskFactors)
  const overallRiskLevel = scoreToRiskLevel(overallRiskScore)

  // Benchmark comparison
  const benchmarkComparison = metrics.totalIncome > 0
    ? buildBenchmarkComparison(metrics, benchmark)
    : null

  // Recommendations -- NEVER recommend changing to match benchmarks
  const recommendations = generateAuditRiskRecommendations(riskFactors, overallRiskLevel)

  return {
    tenantId,
    financialYear: fy,
    overallRiskLevel,
    overallRiskScore,
    auditProbabilityEstimate: riskLevelToDescription(overallRiskLevel),
    riskFactors,
    highRiskFactors,
    mediumRiskFactors,
    benchmarkComparison,
    complianceFocusAreas: ATO_COMPLIANCE_FOCUS_AREAS,
    confidence: 50, // Low-moderate: benchmarks are approximations
    recommendations,
    disclaimer: 'This assessment estimates audit likelihood based on publicly available ATO benchmarks and compliance focus areas. ' +
      'It does NOT predict actual ATO actions. Being outside benchmarks is not illegal and does not require changes to business operations. ' +
      'Ensure all claims are legitimate and well-documented regardless of benchmark alignment.',
    legislativeReferences: [
      'Taxation Administration Act 1953 - ATO audit and investigation powers',
      's 263 ITAA 1936 - ATO access powers',
      's 264 ITAA 1936 - Power to require information',
    ],
    taxRateSource: 'ATO_benchmarks',
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

interface FinancialMetrics {
  totalIncome: number
  totalExpenses: number
  costOfSales: number
  labourCosts: number
  rentExpenses: number
  motorVehicleExpenses: number
  entertainmentExpenses: number
  travelExpenses: number
  homeOfficeExpenses: number
  cashTransactions: number
  totalTransactions: number
  largeTransactions: number // >$10k
  roundNumberTransactions: number
  averageTransactionSize: number
}

function calculateFinancialMetrics(transactions: HistoricalCacheRow[]): FinancialMetrics {
  const metrics: FinancialMetrics = {
    totalIncome: 0,
    totalExpenses: 0,
    costOfSales: 0,
    labourCosts: 0,
    rentExpenses: 0,
    motorVehicleExpenses: 0,
    entertainmentExpenses: 0,
    travelExpenses: 0,
    homeOfficeExpenses: 0,
    cashTransactions: 0,
    totalTransactions: 0,
    largeTransactions: 0,
    roundNumberTransactions: 0,
    averageTransactionSize: 0,
  }

  const rawTxs = transactions.flatMap((t: HistoricalCacheRow) => {
    const raw = t.raw_data
    return Array.isArray(raw) ? raw : [raw]
  })

  rawTxs.forEach((tx: XeroRawTransaction) => {
    const amount = Math.abs(parseFloat(String(tx.Total)) || 0)
    const type = tx.Type
    const desc = (tx.Description || tx.Reference || '').toLowerCase()

    metrics.totalTransactions++

    if (type === 'ACCREC' || (type === 'BANK' && parseFloat(String(tx.Total)) > 0)) {
      metrics.totalIncome += amount
    } else if (type === 'ACCPAY' || (type === 'BANK' && parseFloat(String(tx.Total)) < 0)) {
      metrics.totalExpenses += amount

      // Categorise expenses
      if (desc.includes('wage') || desc.includes('salary') || desc.includes('payroll')) {
        metrics.labourCosts += amount
      }
      if (desc.includes('rent') || desc.includes('lease') || desc.includes('premises')) {
        metrics.rentExpenses += amount
      }
      if (desc.includes('vehicle') || desc.includes('fuel') || desc.includes('car') || desc.includes('motor')) {
        metrics.motorVehicleExpenses += amount
      }
      if (desc.includes('entertain') || desc.includes('meal') || desc.includes('dining')) {
        metrics.entertainmentExpenses += amount
      }
      if (desc.includes('travel') || desc.includes('flight') || desc.includes('hotel') || desc.includes('accommodation')) {
        metrics.travelExpenses += amount
      }
    }

    // Pattern analysis
    if (amount > 10000) metrics.largeTransactions++
    if (amount > 0 && amount % 100 === 0) metrics.roundNumberTransactions++
    if (type === 'BANK') metrics.cashTransactions++
  })

  if (metrics.totalTransactions > 0) {
    metrics.averageTransactionSize = (metrics.totalIncome + metrics.totalExpenses) / metrics.totalTransactions
  }

  return metrics
}

function assessBenchmarkRisk(
  metrics: FinancialMetrics,
  benchmark: IndustryBenchmark,
  riskFactors: RiskFactor[]
): void {
  const income = metrics.totalIncome
  if (income <= 0) return

  // Total expense ratio
  const expenseRatio = metrics.totalExpenses / income
  if (expenseRatio > benchmark.totalExpenseRatio.high) {
    riskFactors.push({
      category: 'Expense Ratio',
      description: 'Total expenses as a proportion of income exceeds industry benchmark',
      riskLevel: expenseRatio > benchmark.totalExpenseRatio.high * 1.2 ? 'high' : 'medium',
      score: Math.min(80, Math.round((expenseRatio - benchmark.totalExpenseRatio.high) * 200)),
      benchmarkValue: benchmark.totalExpenseRatio.high,
      actualValue: expenseRatio,
      deviation: ((expenseRatio - benchmark.totalExpenseRatio.high) / benchmark.totalExpenseRatio.high) * 100,
      note: `Your expense ratio (${(expenseRatio * 100).toFixed(1)}%) exceeds the industry benchmark upper range (${(benchmark.totalExpenseRatio.high * 100).toFixed(1)}%). This may increase ATO scrutiny. Ensure all expenses are genuine and well-documented.`,
    })
  }

  // Labour cost ratio
  const labourRatio = metrics.labourCosts / income
  if (labourRatio > benchmark.labourCostRatio.high || (labourRatio > 0 && labourRatio < benchmark.labourCostRatio.low * 0.5)) {
    const isHigh = labourRatio > benchmark.labourCostRatio.high
    riskFactors.push({
      category: 'Labour Costs',
      description: isHigh ? 'Labour costs exceed benchmark' : 'Labour costs unusually low for industry',
      riskLevel: 'medium',
      score: 35,
      benchmarkValue: isHigh ? benchmark.labourCostRatio.high : benchmark.labourCostRatio.low,
      actualValue: labourRatio,
      note: isHigh
        ? `Labour costs (${(labourRatio * 100).toFixed(1)}%) exceed benchmark. Verify all payments are at arm's length.`
        : `Labour costs (${(labourRatio * 100).toFixed(1)}%) are low for your industry. ATO may query whether workers are being paid correctly including superannuation guarantee.`,
    })
  }

  // Motor vehicle ratio
  const mvRatio = metrics.motorVehicleExpenses / income
  if (mvRatio > benchmark.motorVehicleRatio.high) {
    riskFactors.push({
      category: 'Motor Vehicle Expenses',
      description: 'Motor vehicle expenses exceed benchmark',
      riskLevel: 'medium',
      score: 30,
      benchmarkValue: benchmark.motorVehicleRatio.high,
      actualValue: mvRatio,
      atoFocusArea: 'Work-related expenses',
      note: `Motor vehicle expenses (${(mvRatio * 100).toFixed(1)}%) exceed benchmark (${(benchmark.motorVehicleRatio.high * 100).toFixed(1)}%). Maintain log book records for substantiation.`,
    })
  }
}

function assessHighScrutinyCategories(
  metrics: FinancialMetrics,
  riskFactors: RiskFactor[]
): void {
  // Cash transaction proportion
  if (metrics.totalTransactions > 0) {
    const cashProportion = metrics.cashTransactions / metrics.totalTransactions
    if (cashProportion > 0.5) {
      riskFactors.push({
        category: 'Cash Economy',
        description: 'High proportion of cash/bank transactions',
        riskLevel: cashProportion > 0.7 ? 'high' : 'medium',
        score: Math.round(cashProportion * 60),
        actualValue: cashProportion,
        atoFocusArea: 'Cash economy and unreported income',
        note: `${(cashProportion * 100).toFixed(0)}% of transactions are bank/cash. Cash-heavy businesses are an ATO compliance focus area. Ensure all income is recorded.`,
      })
    }
  }

  // Entertainment expenses
  if (metrics.entertainmentExpenses > 5000) {
    riskFactors.push({
      category: 'Entertainment',
      description: 'Significant entertainment expense claims',
      riskLevel: metrics.entertainmentExpenses > 20000 ? 'medium' : 'low',
      score: Math.min(40, Math.round(metrics.entertainmentExpenses / 500)),
      actualValue: metrics.entertainmentExpenses,
      atoFocusArea: 'Work-related expenses',
      note: `Entertainment expenses of $${metrics.entertainmentExpenses.toLocaleString()} claimed. ATO closely scrutinises entertainment deductions. Maintain records of business purpose for each expense.`,
    })
  }

  // Travel expenses
  if (metrics.travelExpenses > 10000) {
    riskFactors.push({
      category: 'Travel',
      description: 'Significant travel expense claims',
      riskLevel: metrics.travelExpenses > 50000 ? 'medium' : 'low',
      score: Math.min(35, Math.round(metrics.travelExpenses / 1500)),
      actualValue: metrics.travelExpenses,
      note: `Travel expenses of $${metrics.travelExpenses.toLocaleString()} claimed. Keep detailed records of business purpose, itineraries, and receipts.`,
    })
  }
}

function assessTransactionPatterns(
  metrics: FinancialMetrics,
  riskFactors: RiskFactor[]
): void {
  // Round number frequency (potential indicator of estimated rather than actual amounts)
  if (metrics.totalTransactions > 20) {
    const roundProportion = metrics.roundNumberTransactions / metrics.totalTransactions
    if (roundProportion > 0.4) {
      riskFactors.push({
        category: 'Transaction Patterns',
        description: 'High frequency of round-number transactions',
        riskLevel: 'low',
        score: 20,
        actualValue: roundProportion,
        note: `${(roundProportion * 100).toFixed(0)}% of transactions are round numbers. While not inherently problematic, this pattern may draw ATO attention in cash businesses.`,
      })
    }
  }
}

function calculateOverallRiskScore(riskFactors: RiskFactor[]): number {
  if (riskFactors.length === 0) return 10 // Low baseline risk

  // Weighted average with emphasis on highest risk factors
  const sortedScores = riskFactors.map(f => f.score).sort((a, b) => b - a)

  let weightedSum = 0
  let weightSum = 0

  sortedScores.forEach((score, index) => {
    const weight = Math.max(1, sortedScores.length - index) // Higher weight for higher scores
    weightedSum += score * weight
    weightSum += weight
  })

  return Math.min(100, Math.round(weightedSum / weightSum))
}

function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'very_high'
  if (score >= 50) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

function riskLevelToDescription(level: RiskLevel): string {
  switch (level) {
    case 'very_high': return 'High likelihood of ATO scrutiny'
    case 'high': return 'Elevated likelihood of ATO review'
    case 'medium': return 'Moderate likelihood - standard risk'
    case 'low': return 'Low likelihood - within normal parameters'
  }
}

function buildBenchmarkComparison(
  metrics: FinancialMetrics,
  benchmark: IndustryBenchmark
): {
  industryCode: string
  industryName: string
  deviations: Array<{
    metric: string
    benchmarkRange: string
    actualValue: number
    isOutside: boolean
    note: string
  }>
} {
  const income = metrics.totalIncome
  if (income <= 0) {
    return {
      industryCode: benchmark.industryCode,
      industryName: benchmark.industryName,
      deviations: [],
    }
  }

  const expenseRatio = metrics.totalExpenses / income
  const labourRatio = metrics.labourCosts / income
  const rentRatio = metrics.rentExpenses / income
  const mvRatio = metrics.motorVehicleExpenses / income

  const deviations = [
    {
      metric: 'Total Expense Ratio',
      benchmarkRange: `${(benchmark.totalExpenseRatio.low * 100).toFixed(0)}% - ${(benchmark.totalExpenseRatio.high * 100).toFixed(0)}%`,
      actualValue: expenseRatio,
      isOutside: expenseRatio < benchmark.totalExpenseRatio.low || expenseRatio > benchmark.totalExpenseRatio.high,
      note: `Your ratio: ${(expenseRatio * 100).toFixed(1)}%`,
    },
    {
      metric: 'Labour Cost Ratio',
      benchmarkRange: `${(benchmark.labourCostRatio.low * 100).toFixed(0)}% - ${(benchmark.labourCostRatio.high * 100).toFixed(0)}%`,
      actualValue: labourRatio,
      isOutside: labourRatio < benchmark.labourCostRatio.low || labourRatio > benchmark.labourCostRatio.high,
      note: `Your ratio: ${(labourRatio * 100).toFixed(1)}%`,
    },
    {
      metric: 'Rent Ratio',
      benchmarkRange: `${(benchmark.rentRatio.low * 100).toFixed(0)}% - ${(benchmark.rentRatio.high * 100).toFixed(0)}%`,
      actualValue: rentRatio,
      isOutside: rentRatio < benchmark.rentRatio.low || rentRatio > benchmark.rentRatio.high,
      note: `Your ratio: ${(rentRatio * 100).toFixed(1)}%`,
    },
    {
      metric: 'Motor Vehicle Ratio',
      benchmarkRange: `${(benchmark.motorVehicleRatio.low * 100).toFixed(0)}% - ${(benchmark.motorVehicleRatio.high * 100).toFixed(0)}%`,
      actualValue: mvRatio,
      isOutside: mvRatio < benchmark.motorVehicleRatio.low || mvRatio > benchmark.motorVehicleRatio.high,
      note: `Your ratio: ${(mvRatio * 100).toFixed(1)}%`,
    },
  ]

  return {
    industryCode: benchmark.industryCode,
    industryName: benchmark.industryName,
    deviations,
  }
}

function generateAuditRiskRecommendations(
  riskFactors: RiskFactor[],
  overallLevel: RiskLevel
): string[] {
  const recommendations: string[] = []

  if (overallLevel === 'very_high' || overallLevel === 'high') {
    recommendations.push(
      'Your financial profile shows elevated audit risk. Ensure all claims are legitimate, properly documented, and can be substantiated if audited.'
    )
    recommendations.push(
      'Consider engaging a registered tax agent to review your return before lodgement.'
    )
  }

  // Specific recommendations based on risk factors (never "change to match benchmark")
  const highRisk = riskFactors.filter(f => f.riskLevel === 'high' || f.riskLevel === 'very_high')
  highRisk.forEach(factor => {
    recommendations.push(`${factor.category}: ${factor.note}`)
  })

  recommendations.push(
    'Maintain complete records for a minimum of 5 years (s 262A ITAA 1936). This includes receipts, invoices, bank statements, and contracts.'
  )

  recommendations.push(
    'IMPORTANT: Deviating from ATO benchmarks is not illegal. Benchmarks reflect industry averages, not requirements. Do NOT modify legitimate business operations to match benchmarks.'
  )

  return recommendations
}
