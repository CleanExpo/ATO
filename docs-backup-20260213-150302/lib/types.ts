export interface XeroConnection {
    id: string
    user_id: string | null
    tenant_id: string
    tenant_name: string | null
    tenant_type: string | null
    access_token: string
    refresh_token: string
    expires_at: number
    id_token: string | null
    scope: string | null
    organisation_name: string | null
    organisation_type: string | null
    country_code: string | null
    base_currency: string | null
    financial_year_end_day: number | null
    financial_year_end_month: number | null
    is_demo_company: boolean
    connected_at: string
    updated_at: string
    last_sync_at: string | null
    sync_status: 'pending' | 'syncing' | 'complete' | 'error'
}

export interface TaxAuditFinding {
    id: string
    tenant_id: string
    finding_type: 'misclassification' | 'rnd_candidate' | 'unclaimed_deduction' | 'missing_tax_type'
    priority: 'critical' | 'high' | 'medium' | 'low'
    category: string | null
    transaction_id: string | null
    transaction_date: string | null
    transaction_description: string | null
    transaction_amount: number | null
    current_classification: string | null
    recommended_classification: string | null
    rationale: string | null
    legislation_reference: string | null
    estimated_benefit: number | null
    confidence_level: 'high' | 'medium' | 'low'
    status: 'open' | 'reviewed' | 'actioned' | 'dismissed'
    reviewed_by: string | null
    reviewed_at: string | null
    notes: string | null
    created_at: string
    updated_at: string
    financial_year: string | null
}

export interface RnDActivity {
    id: string
    tenant_id: string
    activity_name: string
    activity_description: string | null
    activity_type: 'core_rnd' | 'supporting_rnd' | 'not_eligible' | null
    outcome_unknown: boolean
    systematic_approach: boolean
    new_knowledge: boolean
    scientific_method: boolean
    eligibility_score: number
    start_date: string | null
    end_date: string | null
    financial_year: string | null
    total_expenditure: number | null
    eligible_expenditure: number | null
    estimated_offset: number | null
    documentation_status: 'complete' | 'partial' | 'missing'
    has_timesheets: boolean
    has_project_docs: boolean
    status: 'identified' | 'assessed' | 'documented' | 'registered'
    registration_deadline: string | null
    created_at: string
    updated_at: string
}

export interface LossRecord {
    id: string
    tenant_id: string
    financial_year: string
    revenue_loss: number | null
    capital_loss: number | null
    total_loss: number | null
    continuity_of_ownership_satisfied: boolean | null
    same_business_test_satisfied: boolean | null
    is_eligible_for_carryforward: boolean | null
    amount_utilized: number
    remaining_balance: number | null
    future_tax_value: number | null
    created_at: string
    updated_at: string
}

export interface ShareholderLoan {
    id: string
    tenant_id: string
    shareholder_name: string
    loan_direction: 'to_company' | 'from_company'
    original_amount: number
    current_balance: number
    has_written_agreement: boolean
    agreement_date: string | null
    interest_rate: number | null
    benchmark_rate: number | null
    loan_term_years: number | null
    minimum_yearly_repayment: number | null
    repayments_made_this_fy: number
    is_compliant: boolean | null
    deemed_dividend_risk: number | null
    compliance_action_required: string | null
    created_at: string
    updated_at: string
    financial_year: string | null
}

export interface AuditReport {
    id: string
    tenant_id: string
    report_type: 'full_audit' | 'rnd_assessment' | 'deduction_scan' | 'loss_analysis'
    report_title: string | null
    financial_years: string[]
    total_findings: number | null
    critical_findings: number | null
    estimated_total_benefit: number | null
    summary_json: Record<string, unknown> | null
    findings_json: Record<string, unknown> | null
    recommendations_json: Record<string, unknown> | null
    status: 'draft' | 'final' | 'archived'
    generated_at: string
    generated_by: string | null
}

// Xero API Types
export interface AnalyzedTransaction {
    id: string
    type: string
    date: string
    reference: string | null
    contact: string | null
    total: number
    status: string
    isReconciled: boolean
    lineItems: TransactionLineItem[]
    analysis: TransactionAnalysis
}

export interface TransactionLineItem {
    description: string | null
    quantity: number | null
    unitAmount: number | null
    accountCode: string | null
    taxType: string | null
    lineAmount: number | null
    flags: {
        missingTaxType: boolean
        missingAccount: boolean
    }
}

export interface TransactionAnalysis {
    isRndCandidate: boolean
    rndScore: number
    rndKeywordsFound: string[]
    hasMissingTaxTypes: boolean
    hasMissingAccounts: boolean
    needsReview: boolean
}

export interface TransactionSummary {
    total: number
    rndCandidates: number
    rndValue: number
    needsReview: number
    missingTaxTypes: number
}

// Dashboard Types
export interface DashboardStats {
    connections: number
    potentialRndRefund: number
    accumulatedLosses: number
    openFindings: number
    criticalFindings: number
}

export interface FinancialYear {
    label: string
    value: string
    startDate: string
    endDate: string
    isAmendable: boolean
    isCurrent: boolean
}

/**
 * Convert a date to Australian financial year format (FY2024-25)
 * Australian FY runs from July 1 to June 30
 */
export function getFinancialYearFromDate(date: Date): string {
    const year = date.getFullYear()
    const month = date.getMonth() + 1 // 1-12

    // If month is July-December, FY ends next year
    // If month is January-June, FY ends this year
    const fyEndYear = month >= 7 ? year + 1 : year
    const fyStartYear = fyEndYear - 1

    return `FY${fyStartYear}-${String(fyEndYear).slice(2)}`
}

// Get Australian financial years
export function getFinancialYears(): FinancialYear[] {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const currentFY = currentMonth >= 7 ? currentYear + 1 : currentYear

    return [
        {
            label: `FY${currentFY - 1}-${String(currentFY).slice(2)}`,
            value: `FY${currentFY - 1}-${String(currentFY).slice(2)}`,
            startDate: `${currentFY - 1}-07-01`,
            endDate: `${currentFY}-06-30`,
            isAmendable: true,
            isCurrent: true
        },
        {
            label: `FY${currentFY - 2}-${String(currentFY - 1).slice(2)}`,
            value: `FY${currentFY - 2}-${String(currentFY - 1).slice(2)}`,
            startDate: `${currentFY - 2}-07-01`,
            endDate: `${currentFY - 1}-06-30`,
            isAmendable: true,
            isCurrent: false
        },
        {
            label: `FY${currentFY - 3}-${String(currentFY - 2).slice(2)}`,
            value: `FY${currentFY - 3}-${String(currentFY - 2).slice(2)}`,
            startDate: `${currentFY - 3}-07-01`,
            endDate: `${currentFY - 2}-06-30`,
            isAmendable: true,
            isCurrent: false
        },
        {
            label: `FY${currentFY - 4}-${String(currentFY - 3).slice(2)}`,
            value: `FY${currentFY - 4}-${String(currentFY - 3).slice(2)}`,
            startDate: `${currentFY - 4}-07-01`,
            endDate: `${currentFY - 3}-06-30`,
            isAmendable: false, // Generally out of amendment period
            isCurrent: false
        },
    ]
}
