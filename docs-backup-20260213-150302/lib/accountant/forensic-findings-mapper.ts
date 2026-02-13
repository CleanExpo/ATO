/**
 * Forensic-to-Findings Mapper
 *
 * Transforms forensic_analysis_results into accountant_findings records.
 * This is the bridge between the AI forensic analysis pipeline and the
 * accountant workflow dashboard.
 *
 * Routing priority (first match wins):
 *   1. R&D candidate / Division 355 → sundries
 *   2. Division 7A risk → div7a
 *   3. FBT implications → fbt
 *   4. Requires documentation (no other flag) → documents
 *   5. Fully deductible but low confidence → deductions
 *   6. Low category confidence → reconciliation
 *   7. Default → skip (not an actionable finding)
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type WorkflowArea = 'sundries' | 'deductions' | 'fbt' | 'div7a' | 'documents' | 'reconciliation'

export interface ForensicAnalysisRow {
  id: string
  tenant_id: string
  transaction_id: string
  financial_year: string | null
  primary_category: string | null
  secondary_categories: string[] | null
  category_confidence: number | null
  is_rnd_candidate: boolean
  meets_div355_criteria: boolean
  rnd_activity_type: string | null
  rnd_confidence: number | null
  rnd_reasoning: string | null
  div355_outcome_unknown: boolean | null
  div355_systematic_approach: boolean | null
  div355_new_knowledge: boolean | null
  div355_scientific_method: boolean | null
  is_fully_deductible: boolean
  deduction_type: string | null
  claimable_amount: number | null
  deduction_restrictions: unknown[] | null
  deduction_confidence: number | null
  requires_documentation: boolean
  fbt_implications: boolean
  division7a_risk: boolean
  compliance_notes: unknown[] | null
  transaction_amount: number | null
  transaction_date: string | null
  transaction_description: string | null
  supplier_name: string | null
  analyzed_at: string
}

export interface AccountantFindingInsert {
  organization_id: string
  workflow_area: WorkflowArea
  status: 'pending'
  transaction_id: string
  transaction_date: string
  description: string
  amount: number
  current_classification: string | null
  suggested_classification: string | null
  suggested_action: string
  confidence_score: number
  confidence_level: 'High' | 'Medium' | 'Low'
  confidence_factors: Array<{ factor: string; impact: 'positive' | 'negative'; weight: number }>
  legislation_refs: Array<{ section: string; act: string; relevance: string }>
  reasoning: string
  financial_year: string
  estimated_benefit: number
}

export interface GenerateResult {
  created: number
  skipped: number
  byArea: Record<WorkflowArea, number>
}

/**
 * Determine which workflow area a forensic analysis row routes to.
 * Returns null if the row does not warrant an actionable finding.
 */
export function determineWorkflowArea(row: ForensicAnalysisRow): WorkflowArea | null {
  // Priority 1: R&D / Division 355 → sundries
  if (row.is_rnd_candidate || row.meets_div355_criteria) {
    return 'sundries'
  }

  // Priority 2: Division 7A risk → div7a
  if (row.division7a_risk) {
    return 'div7a'
  }

  // Priority 3: FBT implications → fbt
  if (row.fbt_implications) {
    return 'fbt'
  }

  // Priority 4: Requires documentation AND no other flag → documents
  if (row.requires_documentation) {
    return 'documents'
  }

  // Priority 5: Fully deductible but low confidence → deductions
  if (row.is_fully_deductible && row.deduction_confidence != null && row.deduction_confidence < 80) {
    return 'deductions'
  }

  // Priority 6: Low category confidence → reconciliation (potential misclassification)
  if (row.category_confidence != null && row.category_confidence < 50) {
    return 'reconciliation'
  }

  // Default: not actionable
  return null
}

/**
 * Map confidence data from forensic analysis to accountant finding format.
 */
export function mapConfidence(row: ForensicAnalysisRow): {
  score: number
  level: 'High' | 'Medium' | 'Low'
  factors: Array<{ factor: string; impact: 'positive' | 'negative'; weight: number }>
} {
  const factors: Array<{ factor: string; impact: 'positive' | 'negative'; weight: number }> = []

  // Use category_confidence as base, weighted at 40%
  const catConf = row.category_confidence ?? 50
  factors.push({
    factor: `Category classification confidence: ${catConf}%`,
    impact: catConf >= 70 ? 'positive' : 'negative',
    weight: 0.4,
  })

  // R&D confidence if applicable, weighted at 25%
  if (row.is_rnd_candidate && row.rnd_confidence != null) {
    factors.push({
      factor: `R&D eligibility confidence: ${row.rnd_confidence}%`,
      impact: row.rnd_confidence >= 70 ? 'positive' : 'negative',
      weight: 0.25,
    })
  }

  // Deduction confidence, weighted at 20%
  if (row.deduction_confidence != null) {
    factors.push({
      factor: `Deduction confidence: ${row.deduction_confidence}%`,
      impact: row.deduction_confidence >= 70 ? 'positive' : 'negative',
      weight: 0.2,
    })
  }

  // Documentation completeness, weighted at 15%
  if (row.requires_documentation) {
    factors.push({
      factor: 'Missing source documentation',
      impact: 'negative',
      weight: 0.15,
    })
  } else {
    factors.push({
      factor: 'Documentation appears adequate',
      impact: 'positive',
      weight: 0.15,
    })
  }

  // Calculate weighted score from available factors
  let weightedSum = 0
  let totalWeight = 0

  for (const f of factors) {
    let factorScore: number
    // Extract numeric value from factor string, or use 70 for boolean factors
    const numMatch = f.factor.match(/(\d+)%/)
    if (numMatch) {
      factorScore = parseInt(numMatch[1], 10)
    } else {
      factorScore = f.impact === 'positive' ? 80 : 30
    }
    weightedSum += factorScore * f.weight
    totalWeight += f.weight
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50

  let level: 'High' | 'Medium' | 'Low'
  if (score >= 80) level = 'High'
  else if (score >= 60) level = 'Medium'
  else level = 'Low'

  return { score, level, factors }
}

/**
 * Estimate the financial benefit of a finding based on workflow area.
 */
export function estimateBenefit(row: ForensicAnalysisRow, area: WorkflowArea): number {
  const amount = Math.abs(row.transaction_amount ?? row.claimable_amount ?? 0)
  const claimable = Math.abs(row.claimable_amount ?? amount)

  switch (area) {
    case 'sundries':
      // R&D offset: 43.5% of claimable amount (Division 355 ITAA 1997)
      return Math.round(claimable * 0.435 * 100) / 100
    case 'deductions':
      // Small business tax rate: 25% (s 23AA ITAA 1997)
      return Math.round(claimable * 0.25 * 100) / 100
    case 'fbt':
      // FBT rate exposure: 47% (FBTAA 1986)
      return Math.round(amount * 0.47 * 100) / 100
    case 'div7a':
      // Full deemed dividend risk (Division 7A ITAA 1936)
      return Math.round(amount * 100) / 100
    case 'documents':
      // Compliance item, no direct monetary benefit
      return 0
    case 'reconciliation':
      // Potential misclassification recovery at 25%
      return Math.round(claimable * 0.25 * 100) / 100
  }
}

/**
 * Build a suggested action string for a finding.
 */
function buildSuggestedAction(row: ForensicAnalysisRow, area: WorkflowArea): string {
  switch (area) {
    case 'sundries':
      return row.meets_div355_criteria
        ? 'Review for R&D Tax Incentive eligibility under Division 355 ITAA 1997. Verify four-element test compliance.'
        : 'Assess R&D candidacy. Transaction shows characteristics of eligible R&D expenditure.'
    case 'deductions':
      return `Review deduction eligibility under s 8-1 ITAA 1997. Deduction confidence is ${row.deduction_confidence ?? 'unknown'}%. Verify business purpose nexus.`
    case 'fbt':
      return 'Determine FBT Type 1 vs Type 2 classification. Assess GST credit entitlement and apply appropriate gross-up rate.'
    case 'div7a':
      return 'Review for Division 7A compliance. Check if payment constitutes a loan or deemed dividend. Verify minimum repayment obligations.'
    case 'documents':
      return 'Obtain missing source documentation. Required for substantiation of claim under s 900-70 ITAA 1997.'
    case 'reconciliation':
      return `Category classification confidence is low (${row.category_confidence ?? 'unknown'}%). Verify correct GL account allocation and primary category assignment.`
  }
}

/**
 * Build reasoning text for a finding.
 */
function buildReasoning(row: ForensicAnalysisRow, area: WorkflowArea): string {
  const parts: string[] = []

  parts.push(`AI forensic analysis flagged this transaction for ${area} review.`)

  if (row.rnd_reasoning) {
    parts.push(`R&D assessment: ${row.rnd_reasoning}`)
  }

  if (row.primary_category) {
    parts.push(`Primary category: ${row.primary_category}.`)
  }

  if (row.deduction_type) {
    parts.push(`Deduction type: ${row.deduction_type}.`)
  }

  if (row.compliance_notes && Array.isArray(row.compliance_notes) && row.compliance_notes.length > 0) {
    parts.push(`Compliance notes: ${row.compliance_notes.join('; ')}.`)
  }

  if (row.deduction_restrictions && Array.isArray(row.deduction_restrictions) && row.deduction_restrictions.length > 0) {
    parts.push(`Deduction restrictions: ${row.deduction_restrictions.join('; ')}.`)
  }

  return parts.join(' ')
}

/**
 * Get legislation references relevant to the workflow area.
 */
function getLegislationRefs(area: WorkflowArea): Array<{ section: string; act: string; relevance: string }> {
  switch (area) {
    case 'sundries':
      return [
        { section: 'Division 355', act: 'ITAA 1997', relevance: 'R&D Tax Incentive eligibility and offset calculation' },
        { section: 's 355-25', act: 'ITAA 1997', relevance: 'Core R&D activities definition' },
      ]
    case 'deductions':
      return [
        { section: 's 8-1', act: 'ITAA 1997', relevance: 'General deduction provision - business purpose test' },
      ]
    case 'fbt':
      return [
        { section: 's 136', act: 'FBTAA 1986', relevance: 'FBT liability assessment and rate' },
        { section: 's 67', act: 'FBTAA 1986', relevance: 'Shortfall penalties for incorrect FBT returns' },
      ]
    case 'div7a':
      return [
        { section: 'Division 7A', act: 'ITAA 1936', relevance: 'Deemed dividends from private company payments' },
        { section: 's 109D', act: 'ITAA 1936', relevance: 'Payments and loans treated as dividends' },
      ]
    case 'documents':
      return [
        { section: 's 900-70', act: 'ITAA 1997', relevance: 'Substantiation requirements for deductions' },
        { section: 's 262A', act: 'ITAA 1936', relevance: 'Record-keeping obligations (5-year retention)' },
      ]
    case 'reconciliation':
      return [
        { section: 's 8-1', act: 'ITAA 1997', relevance: 'Correct classification required for deduction eligibility' },
      ]
  }
}

/**
 * Transform a single forensic analysis row into an accountant finding insert.
 * Returns null if the row does not route to any workflow area.
 */
export function mapAnalysisToFinding(
  row: ForensicAnalysisRow,
  organizationId: string
): AccountantFindingInsert | null {
  const area = determineWorkflowArea(row)
  if (!area) return null

  const confidence = mapConfidence(row)
  const benefit = estimateBenefit(row, area)
  const amount = Math.abs(row.transaction_amount ?? row.claimable_amount ?? 0)

  return {
    organization_id: organizationId,
    workflow_area: area,
    status: 'pending',
    transaction_id: row.transaction_id,
    transaction_date: row.transaction_date ?? new Date().toISOString().split('T')[0],
    description: row.transaction_description ?? `Transaction ${row.transaction_id}`,
    amount,
    current_classification: row.primary_category ?? null,
    suggested_classification: row.deduction_type ?? row.primary_category ?? null,
    suggested_action: buildSuggestedAction(row, area),
    confidence_score: confidence.score,
    confidence_level: confidence.level,
    confidence_factors: confidence.factors,
    legislation_refs: getLegislationRefs(area),
    reasoning: buildReasoning(row, area),
    financial_year: row.financial_year ?? '',
    estimated_benefit: benefit,
  }
}

/**
 * Main entry point: generate accountant findings from forensic analysis results.
 *
 * Fetches all forensic_analysis_results for the given tenant and financial year,
 * maps them to accountant_findings, deduplicates, and inserts new records.
 */
export async function generateAccountantFindings(
  supabase: SupabaseClient,
  tenantId: string,
  organizationId: string,
  financialYear: string
): Promise<GenerateResult> {
  const result: GenerateResult = {
    created: 0,
    skipped: 0,
    byArea: {
      sundries: 0,
      deductions: 0,
      fbt: 0,
      div7a: 0,
      documents: 0,
      reconciliation: 0,
    },
  }

  // Fetch forensic analysis results for this tenant/FY
  let query = supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', tenantId)

  if (financialYear) {
    query = query.eq('financial_year', financialYear)
  }

  const { data: forensicRows, error: fetchError } = await query

  if (fetchError) {
    throw new Error(`Failed to fetch forensic analysis results: ${fetchError.message}`)
  }

  if (!forensicRows || forensicRows.length === 0) {
    return result
  }

  // Fetch existing findings for deduplication
  const { data: existingFindings, error: existingError } = await supabase
    .from('accountant_findings')
    .select('transaction_id, organization_id, workflow_area')
    .eq('organization_id', organizationId)

  if (existingError) {
    throw new Error(`Failed to fetch existing findings: ${existingError.message}`)
  }

  // Build deduplication set: transaction_id + organization_id + workflow_area
  const existingKeys = new Set(
    (existingFindings ?? []).map(
      (f: { transaction_id: string; organization_id: string; workflow_area: string }) =>
        `${f.transaction_id}|${f.organization_id}|${f.workflow_area}`
    )
  )

  // Map and collect inserts
  const inserts: AccountantFindingInsert[] = []

  for (const row of forensicRows as ForensicAnalysisRow[]) {
    const finding = mapAnalysisToFinding(row, organizationId)
    if (!finding) {
      result.skipped++
      continue
    }

    const key = `${finding.transaction_id}|${finding.organization_id}|${finding.workflow_area}`
    if (existingKeys.has(key)) {
      result.skipped++
      continue
    }

    // Also prevent duplicates within this batch
    existingKeys.add(key)
    inserts.push(finding)
  }

  // Batch insert findings (in chunks of 100 to avoid payload limits)
  const BATCH_SIZE = 100
  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE)
    const { error: insertError } = await supabase
      .from('accountant_findings')
      .insert(batch)

    if (insertError) {
      throw new Error(`Failed to insert findings batch: ${insertError.message}`)
    }

    for (const finding of batch) {
      result.created++
      result.byArea[finding.workflow_area]++
    }
  }

  return result
}
