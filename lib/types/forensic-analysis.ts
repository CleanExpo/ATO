/**
 * ForensicAnalysisRow
 *
 * TypeScript interface matching the `forensic_analysis_results` Supabase table.
 * Used across analysis engines, report generators, and API routes to replace
 * `transactions: any[]` parameters with a proper type.
 *
 * Schema source: supabase/migrations/20260124_forensic_analysis_complete.sql
 *               + 20260124_add_transaction_columns.sql
 *               + 20260128000009_add_platform_to_analysis_tables.sql
 */

export interface ForensicAnalysisRow {
  id: string
  tenant_id: string
  transaction_id: string
  financial_year: string | null

  // Transaction data (added by later migrations)
  transaction_date: string | null
  transaction_amount: number | null
  transaction_description: string | null
  supplier_name: string | null
  platform: 'xero' | 'myob' | 'quickbooks'

  // Categories
  primary_category: string | null
  secondary_categories: string[] | null
  category_confidence: number | null

  // R&D Assessment
  is_rnd_candidate: boolean
  meets_div355_criteria: boolean
  rnd_activity_type: string | null
  rnd_confidence: number | null
  rnd_reasoning: string | null

  // Four-element test (Division 355)
  div355_outcome_unknown: boolean | null
  div355_systematic_approach: boolean | null
  div355_new_knowledge: boolean | null
  div355_scientific_method: boolean | null

  // Deductions
  is_fully_deductible: boolean
  deduction_type: string | null
  claimable_amount: number | null
  deduction_restrictions: string[] | null
  deduction_confidence: number | null

  // Compliance
  requires_documentation: boolean
  fbt_implications: boolean
  division7a_risk: boolean
  compliance_notes: string[] | null

  // Metadata
  analyzed_at: string | null
}
