/**
 * Alert Generation Engine
 *
 * Monitors forensic analysis results and triggers tax alerts based on:
 * - R&D opportunities
 * - Division 7A loans
 * - Deduction opportunities
 * - Compliance deadlines
 * - Legislative changes
 */

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'
import { createLogger } from '@/lib/logger'

const log = createLogger('alerts:generator')

type TaxAlert = Database['public']['Tables']['tax_alerts']['Insert']
type ForensicAnalysisResult = Database['public']['Tables']['forensic_analysis_results']['Row']

interface AlertTriggerContext {
  tenantId: string
  financialYear: string
  platform?: string
  analysisResults: ForensicAnalysisResult[]
}

interface GeneratedAlert {
  alert: TaxAlert
  priority: number
}

/**
 * Main alert generation function
 * Called after each analysis batch completes
 */
export async function generateAlertsForAnalysis(context: AlertTriggerContext): Promise<GeneratedAlert[]> {
  const alerts: GeneratedAlert[] = []

  // Check for R&D opportunities
  const rndAlerts = await checkRnDOpportunities(context)
  alerts.push(...rndAlerts)

  // Check for deduction opportunities
  const deductionAlerts = await checkDeductionOpportunities(context)
  alerts.push(...deductionAlerts)

  // Check for Division 7A loans
  const div7aAlerts = await checkDivision7ALoans(context)
  alerts.push(...div7aAlerts)

  // Check for instant asset write-off opportunities
  const instantWriteoffAlerts = await checkInstantWriteoffOpportunities(context)
  alerts.push(...instantWriteoffAlerts)

  // Check for compliance issues
  const complianceAlerts = await checkComplianceIssues(context)
  alerts.push(...complianceAlerts)

  return alerts
}

/**
 * Check for R&D Tax Incentive opportunities
 */
async function checkRnDOpportunities(context: AlertTriggerContext): Promise<GeneratedAlert[]> {
  const alerts: GeneratedAlert[] = []
  const supabase = await createClient()

  // Get R&D alert definitions
  const { data: definitions } = await supabase
    .from('tax_alert_definitions')
    .select('*')
    .in('alert_type', ['rnd_registration_deadline', 'rnd_claim_deadline'])
    .eq('is_active', true)

  if (!definitions || definitions.length === 0) return alerts

  // Count R&D candidates in this financial year
  const rndCandidates = context.analysisResults.filter(r =>
    r.is_rnd_candidate && r.rnd_confidence && r.rnd_confidence > 50
  )

  if (rndCandidates.length === 0) return alerts

  // Calculate potential R&D benefit
  const totalRndSpend = rndCandidates.reduce((sum, r) => {
    const adjustedBenefit = r.adjusted_benefit || 0
    // Reverse calculate spend from benefit (benefit = spend * 0.435)
    return sum + (adjustedBenefit / 0.435)
  }, 0)

  const potentialBenefit = totalRndSpend * 0.435

  // Only alert if benefit is significant (> $10,000)
  if (potentialBenefit < 10000) return alerts

  // Check if registration deadline alert should trigger
  const registrationDef = definitions.find(d => d.alert_type === 'rnd_registration_deadline')
  if (registrationDef) {
    // Calculate deadline (10 months after FY end)
    const fyEndDate = getFYEndDate(context.financialYear)
    const registrationDeadline = new Date(fyEndDate)
    registrationDeadline.setMonth(registrationDeadline.getMonth() + 10)

    // Calculate days until deadline
    const daysUntilDeadline = Math.floor((registrationDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

    // Trigger if within advance notice period
    const advanceNoticeDays = registrationDef.advance_notice_days || 60
    if (daysUntilDeadline > 0 && daysUntilDeadline <= advanceNoticeDays) {
      alerts.push({
        alert: {
          tenant_id: context.tenantId,
          alert_definition_id: registrationDef.id,
          alert_type: 'rnd_registration_deadline',
          title: registrationDef.title,
          message: `You have ${rndCandidates.length} R&D eligible transactions totaling $${totalRndSpend.toFixed(2)} in ${context.financialYear}. Registration deadline is ${registrationDeadline.toLocaleDateString()}. Potential tax benefit: $${potentialBenefit.toFixed(2)}.`,
          severity: 'critical',
          category: 'deadline',
          financial_year: context.financialYear,
          platform: context.platform,
          related_transaction_ids: rndCandidates.map(r => r.transaction_id),
          due_date: registrationDeadline.toISOString(),
          status: 'unread',
          action_url: '/dashboard/rnd-analysis',
          action_label: registrationDef.action_label || 'Register for R&D',
          email_sent: false,
          metadata: {
            total_rnd_transactions: rndCandidates.length,
            total_rnd_spend: totalRndSpend,
            potential_benefit: potentialBenefit,
            high_confidence_count: rndCandidates.filter(r => (r.rnd_confidence || 0) > 70).length
          }
        },
        priority: 100 // High priority
      })
    }
  }

  // Check if claim deadline alert should trigger
  const claimDef = definitions.find(d => d.alert_type === 'rnd_claim_deadline')
  if (claimDef) {
    // R&D claim is due with tax return (typically 15 May for Feb 28 year end, or 15 months after FY end)
    const fyEndDate = getFYEndDate(context.financialYear)
    const claimDeadline = new Date(fyEndDate)
    claimDeadline.setMonth(claimDeadline.getMonth() + 15)

    const daysUntilDeadline = Math.floor((claimDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const advanceNoticeDays = claimDef.advance_notice_days || 30

    if (daysUntilDeadline > 0 && daysUntilDeadline <= advanceNoticeDays) {
      alerts.push({
        alert: {
          tenant_id: context.tenantId,
          alert_definition_id: claimDef.id,
          alert_type: 'rnd_claim_deadline',
          title: claimDef.title,
          message: `R&D claim deadline approaching (${claimDeadline.toLocaleDateString()}). You have $${potentialBenefit.toFixed(2)} in potential R&D tax offsets for ${context.financialYear}.`,
          severity: 'critical',
          category: 'deadline',
          financial_year: context.financialYear,
          platform: context.platform,
          related_transaction_ids: rndCandidates.map(r => r.transaction_id),
          due_date: claimDeadline.toISOString(),
          status: 'unread',
          action_url: '/dashboard/rnd-analysis',
          action_label: claimDef.action_label || 'Submit R&D Claim',
          email_sent: false,
          metadata: {
            total_rnd_transactions: rndCandidates.length,
            potential_benefit: potentialBenefit
          }
        },
        priority: 95
      })
    }
  }

  return alerts
}

/**
 * Check for general deduction opportunities
 */
async function checkDeductionOpportunities(context: AlertTriggerContext): Promise<GeneratedAlert[]> {
  const alerts: GeneratedAlert[] = []
  const supabase = await createClient()

  // Get deduction opportunity alert definition
  const { data: definition } = await supabase
    .from('tax_alert_definitions')
    .select('*')
    .eq('alert_type', 'deduction_opportunity')
    .eq('is_active', true)
    .single()

  if (!definition) return alerts

  // Find transactions with deduction opportunities flagged
  const deductionOpportunities = context.analysisResults.filter(r =>
    r.flags && Array.isArray(r.flags) && r.flags.some((flag: string) =>
      flag.toLowerCase().includes('deduction') ||
      flag.toLowerCase().includes('claim')
    )
  )

  if (deductionOpportunities.length === 0) return alerts

  // Calculate potential value of unclaimed deductions
  const potentialValue = deductionOpportunities.reduce((sum, r) => sum + Math.abs(r.amount), 0)

  // Only alert if value is significant (> $5,000)
  if (potentialValue < 5000) return alerts

  alerts.push({
    alert: {
      tenant_id: context.tenantId,
      alert_definition_id: definition.id,
      alert_type: 'deduction_opportunity',
      title: definition.title,
      message: `Our AI analysis identified ${deductionOpportunities.length} transactions with potential unclaimed deductions totaling $${potentialValue.toFixed(2)} in ${context.financialYear}.`,
      severity: 'info',
      category: 'opportunity',
      financial_year: context.financialYear,
      platform: context.platform,
      related_transaction_ids: deductionOpportunities.map(r => r.transaction_id),
      status: 'unread',
      action_url: '/dashboard/forensic-audit',
      action_label: definition.action_label || 'Review Deductions',
      email_sent: false,
      metadata: {
        opportunity_count: deductionOpportunities.length,
        potential_value: potentialValue,
        categories: [...new Set(deductionOpportunities.map(r => r.primary_category).filter(Boolean))]
      }
    },
    priority: 60
  })

  return alerts
}

/**
 * Check for Division 7A loan issues
 */
async function checkDivision7ALoans(context: AlertTriggerContext): Promise<GeneratedAlert[]> {
  const alerts: GeneratedAlert[] = []
  const supabase = await createClient()

  // Get Division 7A alert definitions
  const { data: definitions } = await supabase
    .from('tax_alert_definitions')
    .select('*')
    .in('alert_type', ['div7a_loan_unpaid', 'div7a_minimum_repayment'])
    .eq('is_active', true)

  if (!definitions || definitions.length === 0) return alerts

  // Look for transactions that might indicate Division 7A loans
  // These are typically large payments to directors/shareholders or related parties
  const suspectedLoans = context.analysisResults.filter(r => {
    const flags = r.flags || []
    const keywords = r.keywords || []

    return (
      flags.some((f: string) => f.toLowerCase().includes('division 7a') || f.toLowerCase().includes('div 7a')) ||
      keywords.some((k: string) => k.toLowerCase().includes('loan') || k.toLowerCase().includes('director'))
    ) && Math.abs(r.amount) > 5000 // Significant amounts only
  })

  if (suspectedLoans.length === 0) return alerts

  const totalLoanAmount = suspectedLoans.reduce((sum, r) => sum + Math.abs(r.amount), 0)

  // Trigger unpaid loan alert
  const unpaidDef = definitions.find(d => d.alert_type === 'div7a_loan_unpaid')
  if (unpaidDef) {
    const fyEndDate = getFYEndDate(context.financialYear)
    const daysUntilFYEnd = Math.floor((fyEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const advanceNoticeDays = unpaidDef.advance_notice_days || 60

    if (daysUntilFYEnd > 0 && daysUntilFYEnd <= advanceNoticeDays) {
      alerts.push({
        alert: {
          tenant_id: context.tenantId,
          alert_definition_id: unpaidDef.id,
          alert_type: 'div7a_loan_unpaid',
          title: unpaidDef.title,
          message: `Detected ${suspectedLoans.length} potential Division 7A loan transactions totaling $${totalLoanAmount.toFixed(2)} in ${context.financialYear}. Ensure minimum repayment by ${fyEndDate.toLocaleDateString()} to avoid deemed dividend treatment.`,
          severity: 'warning',
          category: 'compliance',
          financial_year: context.financialYear,
          platform: context.platform,
          related_transaction_ids: suspectedLoans.map(r => r.transaction_id),
          due_date: fyEndDate.toISOString(),
          status: 'unread',
          action_url: '/dashboard/forensic-audit',
          action_label: unpaidDef.action_label || 'View Loan Details',
          email_sent: false,
          metadata: {
            suspected_loan_count: suspectedLoans.length,
            total_loan_amount: totalLoanAmount,
            benchmark_rate: 0.0877 // FY2024-25 rate
          }
        },
        priority: 80
      })
    }
  }

  return alerts
}

/**
 * Check for instant asset write-off opportunities
 */
async function checkInstantWriteoffOpportunities(context: AlertTriggerContext): Promise<GeneratedAlert[]> {
  const alerts: GeneratedAlert[] = []
  const supabase = await createClient()

  // Get instant write-off alert definition
  const { data: definition } = await supabase
    .from('tax_alert_definitions')
    .select('*')
    .eq('alert_type', 'instant_writeoff_threshold')
    .eq('is_active', true)
    .single()

  if (!definition) return alerts

  // Find asset purchases that qualify for instant write-off (under $20,000)
  const eligibleAssets = context.analysisResults.filter(r => {
    const amount = Math.abs(r.amount)
    const category = (r.primary_category || '').toLowerCase()
    const keywords = r.keywords || []

    return (
      amount > 1000 && amount < 20000 && // Within instant write-off threshold
      (
        category.includes('asset') ||
        category.includes('equipment') ||
        category.includes('computer') ||
        category.includes('software') ||
        keywords.some((k: string) => {
          const kl = k.toLowerCase()
          return kl.includes('equipment') || kl.includes('computer') || kl.includes('furniture') || kl.includes('machinery')
        })
      )
    )
  })

  if (eligibleAssets.length === 0) return alerts

  const totalEligibleValue = eligibleAssets.reduce((sum, r) => sum + Math.abs(r.amount), 0)
  const potentialTaxSaving = totalEligibleValue * 0.25 // Assuming 25% company tax rate

  // Only alert if there are multiple eligible assets or significant value
  if (eligibleAssets.length < 3 && totalEligibleValue < 10000) return alerts

  const fyEndDate = getFYEndDate(context.financialYear)
  const daysUntilFYEnd = Math.floor((fyEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const advanceNoticeDays = definition.advance_notice_days || 60

  if (daysUntilFYEnd > 0 && daysUntilFYEnd <= advanceNoticeDays) {
    alerts.push({
      alert: {
        tenant_id: context.tenantId,
        alert_definition_id: definition.id,
        alert_type: 'instant_writeoff_threshold',
        title: definition.title,
        message: `You have ${eligibleAssets.length} assets under $20,000 eligible for instant write-off (total value: $${totalEligibleValue.toFixed(2)}). Purchase before ${fyEndDate.toLocaleDateString()} to claim this year. Potential tax saving: $${potentialTaxSaving.toFixed(2)}.`,
        severity: 'info',
        category: 'opportunity',
        financial_year: context.financialYear,
        platform: context.platform,
        related_transaction_ids: eligibleAssets.map(r => r.transaction_id),
        due_date: fyEndDate.toISOString(),
        status: 'unread',
        action_url: '/dashboard/forensic-audit',
        action_label: definition.action_label || 'View Eligible Assets',
        email_sent: false,
        metadata: {
          eligible_asset_count: eligibleAssets.length,
          total_eligible_value: totalEligibleValue,
          potential_tax_saving: potentialTaxSaving,
          threshold: 20000
        }
      },
      priority: 50
    })
  }

  return alerts
}

/**
 * Check for compliance issues
 */
async function checkComplianceIssues(context: AlertTriggerContext): Promise<GeneratedAlert[]> {
  const alerts: GeneratedAlert[] = []
  const supabase = await createClient()

  // Get compliance warning definition
  const { data: definition } = await supabase
    .from('tax_alert_definitions')
    .select('*')
    .eq('alert_type', 'compliance_warning')
    .eq('is_active', true)
    .single()

  if (!definition) return alerts

  // Find transactions with compliance flags
  const complianceIssues = context.analysisResults.filter(r => {
    const flags = r.flags || []
    return flags.some((f: string) => {
      const fl = f.toLowerCase()
      return fl.includes('compliance') || fl.includes('warning') || fl.includes('risk') || fl.includes('review')
    })
  })

  if (complianceIssues.length === 0) return alerts

  // Calculate total value at risk
  const totalValueAtRisk = complianceIssues.reduce((sum, r) => sum + Math.abs(r.amount), 0)

  // Only alert if there are significant compliance issues
  if (complianceIssues.length < 5 && totalValueAtRisk < 10000) return alerts

  alerts.push({
    alert: {
      tenant_id: context.tenantId,
      alert_definition_id: definition.id,
      alert_type: 'compliance_warning',
      title: definition.title,
      message: `Our analysis detected ${complianceIssues.length} transactions with potential compliance issues in ${context.financialYear} (total value: $${totalValueAtRisk.toFixed(2)}). Review these to avoid ATO penalties.`,
      severity: 'warning',
      category: 'compliance',
      financial_year: context.financialYear,
      platform: context.platform,
      related_transaction_ids: complianceIssues.map(r => r.transaction_id),
      status: 'unread',
      action_url: '/dashboard/forensic-audit',
      action_label: definition.action_label || 'Review Issue',
      email_sent: false,
      metadata: {
        issue_count: complianceIssues.length,
        total_value_at_risk: totalValueAtRisk,
        flag_types: [...new Set(complianceIssues.flatMap(r => r.flags || []))]
      }
    },
    priority: 70
  })

  return alerts
}

/**
 * Store generated alerts in database
 */
export async function storeGeneratedAlerts(alerts: GeneratedAlert[]): Promise<void> {
  if (alerts.length === 0) return

  const supabase = await createClient()

  // Sort by priority (highest first)
  const sortedAlerts = alerts.sort((a, b) => b.priority - a.priority)

  // Check for existing alerts of same type to avoid duplicates
  const existingAlerts = await supabase
    .from('tax_alerts')
    .select('alert_type, financial_year, tenant_id')
    .eq('tenant_id', alerts[0].alert.tenant_id)
    .eq('financial_year', alerts[0].alert.financial_year || '')
    .in('status', ['unread', 'read'])

  const existingAlertKeys = new Set(
    (existingAlerts.data || []).map(a => `${a.alert_type}:${a.financial_year}`)
  )

  // Filter out duplicates
  const newAlerts = sortedAlerts.filter(({ alert }) => {
    const key = `${alert.alert_type}:${alert.financial_year}`
    return !existingAlertKeys.has(key)
  })

  if (newAlerts.length === 0) {
    log.debug('No new alerts to create (duplicates filtered)')
    return
  }

  // Insert new alerts
  const { error } = await supabase
    .from('tax_alerts')
    .insert(newAlerts.map(({ alert }) => alert))

  if (error) {
    console.error('Error storing alerts:', error)
    throw error
  }

  log.info('Created new tax alerts', { count: newAlerts.length })

  // Log alert creation in history
  for (const { alert } of newAlerts) {
    await supabase.from('tax_alert_history').insert({
      alert_id: alert.id,
      tenant_id: alert.tenant_id,
      event_type: 'created',
      metadata: { priority: sortedAlerts.find(a => a.alert === alert)?.priority }
    })
  }
}

/**
 * Helper: Get financial year end date
 */
function getFYEndDate(financialYear: string): Date {
  // Financial year format: "2024" or "FY2024" means July 1 2023 - June 30 2024
  const year = parseInt(financialYear.replace(/\D/g, ''))
  return new Date(year, 5, 30) // June 30 of the year
}

/**
 * Main entry point: Generate and store alerts after analysis
 */
export async function triggerAlertGeneration(
  tenantId: string,
  financialYear: string,
  platform?: string
): Promise<number> {
  log.info('Generating alerts', { tenantId, financialYear, platform })

  const supabase = await createClient()

  // Fetch recent analysis results for this FY and platform
  let query = supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('financial_year', financialYear)

  if (platform) {
    query = query.eq('platform', platform)
  }

  const { data: analysisResults, error } = await query

  if (error) {
    console.error('Error fetching analysis results:', error)
    throw error
  }

  if (!analysisResults || analysisResults.length === 0) {
    log.info('No analysis results found for alert generation')
    return 0
  }

  // Generate alerts
  const alerts = await generateAlertsForAnalysis({
    tenantId,
    financialYear,
    platform,
    analysisResults
  })

  // Store alerts
  await storeGeneratedAlerts(alerts)

  return alerts.length
}
