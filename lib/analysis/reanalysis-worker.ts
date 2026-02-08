/**
 * Re-Analysis Worker
 *
 * Background worker that processes analysis queue jobs after questionnaire completion.
 * Compares before/after confidence scores to measure questionnaire impact.
 */

import { createServiceClient, type SupabaseServiceClient } from '@/lib/supabase/server';
import { analyzeFuelTaxCredits, type FuelPurchase } from './fuel-tax-credits-analyzer';
import { analyzeTrustDistributions, type TrustDistribution, type Section100AAnalysis } from './trust-distribution-analyzer';
import { analyzeSuperannuationCaps, type SuperContribution } from './superannuation-cap-analyzer';
import { createLogger } from '@/lib/logger';

/** Row shape from xero_transactions table (partial) */
interface XeroTransactionRow {
  transaction_id: string;
  date: string;
  contact_name: string;
  contact_id?: string;
  total: number;
  description?: string;
  raw_xero_data?: Record<string, unknown>;
  entity_type?: string;
  [key: string]: unknown;
}

/** Row shape from xero_super_contributions table (partial) */
interface XeroSuperContributionRow {
  employee_id: string;
  employee_name: string;
  period_start_date: string;
  period_end_date: string;
  super_amount: number;
  contribution_type?: string;
  is_concessional?: boolean;
  super_fund_id?: string;
  super_fund_name?: string;
  [key: string]: unknown;
}

/** Row shape from xero_contacts table (partial) */
interface XeroContactRow {
  contact_id: string;
  entity_type?: string;
  [key: string]: unknown;
}

// Trust analysis result type imported as Section100AAnalysis from trust-distribution-analyzer

const log = createLogger('analysis:reanalysis');

interface AnalysisQueueJob {
  id: string;
  tenant_id: string;
  analysis_type: string;
  priority: string;
  previous_analysis_id?: string;
  created_at: string;
}

interface ReanalysisResult {
  success: boolean;
  new_analysis_id?: string;
  improvement_summary?: {
    confidence_before: number;
    confidence_after: number;
    new_findings_count: number;
    additional_benefit: number;
    data_quality_improved: boolean;
  };
  error_message?: string;
}

/**
 * Poll analysis queue for pending jobs and process them
 */
export async function processAnalysisQueue(
  maxJobs: number = 10
): Promise<{ processed: number; failed: number; errors: string[] }> {
  const supabase = await createServiceClient();

  // Fetch pending jobs (high priority first, then by creation time)
  const { data: jobs, error: fetchError } = await supabase
    .from('analysis_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: true }) // critical=1, high=2, etc.
    .order('created_at', { ascending: true })
    .limit(maxJobs);

  if (fetchError) {
    console.error('Error fetching analysis queue:', fetchError);
    return { processed: 0, failed: 0, errors: [fetchError.message] };
  }

  if (!jobs || jobs.length === 0) {
    log.info('No pending analysis jobs in queue');
    return { processed: 0, failed: 0, errors: [] };
  }

  log.info('Processing analysis queue jobs', { count: jobs.length });

  let processedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    try {
      log.info('Processing job', { jobId: job.id, analysisType: job.analysis_type, tenantId: job.tenant_id });

      // Mark job as processing
      await supabase
        .from('analysis_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Run re-analysis
      const result = await runReanalysis(supabase, job);

      if (result.success) {
        // Mark job as completed
        await supabase
          .from('analysis_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            new_analysis_id: result.new_analysis_id,
            improvement_summary: result.improvement_summary,
          })
          .eq('id', job.id);

        processedCount++;
        log.info('Job completed successfully', { jobId: job.id });
      } else {
        throw new Error(result.error_message || 'Re-analysis failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during re-analysis';

      console.error(`Job ${job.id} failed:`, errorMessage);

      // Check retry count
      const { data: jobData } = await supabase
        .from('analysis_queue')
        .select('retry_count, max_retries')
        .eq('id', job.id)
        .single();

      const retryCount = (jobData?.retry_count || 0) + 1;
      const maxRetries = jobData?.max_retries || 3;

      if (retryCount < maxRetries) {
        // Retry later
        await supabase
          .from('analysis_queue')
          .update({
            status: 'pending', // Reset to pending for retry
            retry_count: retryCount,
            last_retry_at: new Date().toISOString(),
            error_message: errorMessage,
          })
          .eq('id', job.id);

        log.info('Job will retry', { jobId: job.id, attempt: retryCount, maxRetries });
      } else {
        // Max retries exceeded, mark as failed
        await supabase
          .from('analysis_queue')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: `Max retries exceeded. Last error: ${errorMessage}`,
          })
          .eq('id', job.id);

        failedCount++;
      }

      errors.push(`Job ${job.id}: ${errorMessage}`);
    }
  }

  log.info('Queue processing complete', { processed: processedCount, failed: failedCount, errors: errors.length });

  return { processed: processedCount, failed: failedCount, errors };
}

/**
 * Run re-analysis for a specific job
 */
async function runReanalysis(
  supabase: SupabaseServiceClient,
  job: AnalysisQueueJob
): Promise<ReanalysisResult> {
  try {
    // Get previous analysis for comparison
    let previousConfidence = 0;
    let previousBenefit = 0;

    if (job.previous_analysis_id) {
      const previousAnalysis = await getPreviousAnalysis(
        supabase,
        job.analysis_type,
        job.previous_analysis_id
      );

      if (previousAnalysis) {
        previousConfidence = (previousAnalysis.confidence as number) || 0;
        previousBenefit = (previousAnalysis.total_benefit as number) || 0;
      }
    }

    // Run analysis based on type
    let newAnalysisId: string | undefined;
    let newConfidence = 0;
    let newBenefit = 0;
    let newFindingsCount = 0;

    switch (job.analysis_type) {
      case 'fuel_tax_credits': {
        // Fetch fuel purchases
        const { data: transactions } = await supabase
          .from('xero_transactions')
          .select('*')
          .eq('tenant_id', job.tenant_id);

        if (!transactions || transactions.length === 0) {
          throw new Error('No transactions found for re-analysis');
        }

        // Convert to FuelPurchase format (simplified)
        const fuelPurchases = transactions
          .filter((t: XeroTransactionRow) => isFuelTransaction(t))
          .map((t: XeroTransactionRow) => convertToFuelPurchase(t));

        // Run analysis
        const analyses = await analyzeFuelTaxCredits(fuelPurchases);

        // Store results (simplified - would need proper database insertion)
        if (analyses.length > 0) {
          const analysis = analyses[0];
          newAnalysisId = `fuel_${job.tenant_id}_${Date.now()}`;
          newConfidence = analysis.data_quality_score;
          newBenefit = analysis.total_credits_claimable;
          newFindingsCount = analysis.calculations.filter((c) => c.net_credit_claimable > 0).length;
        }

        break;
      }

      case 'trust_distributions': {
        // Fetch trust entities and transactions
        const { data: trustContacts } = await supabase
          .from('xero_contacts')
          .select('*')
          .eq('tenant_id', job.tenant_id)
          .eq('entity_type', 'trust');

        if (!trustContacts || trustContacts.length === 0) {
          throw new Error('No trust entities found for re-analysis');
        }

        const trustIds = trustContacts.map((c: XeroContactRow) => c.contact_id);

        const { data: transactions } = await supabase
          .from('xero_transactions')
          .select('*')
          .in('contact_id', trustIds);

        if (!transactions || transactions.length === 0) {
          throw new Error('No trust transactions found for re-analysis');
        }

        // Convert and analyze (simplified)
        const distributions = transactions.map((t: XeroTransactionRow) => convertToTrustDistribution(t));
        const analyses = await analyzeTrustDistributions(distributions);

        if (analyses.length > 0) {
          const analysis = analyses[0];
          newAnalysisId = `trust_${job.tenant_id}_${Date.now()}`;
          newConfidence = calculateTrustConfidence(analysis);
          newBenefit = analysis.total_distributions;
          newFindingsCount = analysis.section_100a_flags.length;
        }

        break;
      }

      case 'superannuation_caps': {
        // Fetch super contributions
        const { data: contributions } = await supabase
          .from('xero_super_contributions')
          .select('*')
          .eq('tenant_id', job.tenant_id);

        if (!contributions || contributions.length === 0) {
          throw new Error('No super contributions found for re-analysis');
        }

        // Convert and analyze
        const superContributions = contributions.map((c: XeroSuperContributionRow) => convertToSuperContribution(c));
        const analyses = await analyzeSuperannuationCaps(superContributions);

        if (analyses.length > 0) {
          const analysis = analyses[0];
          newAnalysisId = `super_${job.tenant_id}_${Date.now()}`;
          newConfidence = analysis.employees_breaching_cap === 0 ? 95 : 70;
          newBenefit = analysis.total_division_291_tax; // Tax liability identified
          newFindingsCount = analysis.employees_breaching_cap;
        }

        break;
      }

      default:
        throw new Error(`Unsupported analysis type: ${job.analysis_type}`);
    }

    // Calculate improvement
    const confidenceImprovement = newConfidence - previousConfidence;
    const benefitImprovement = newBenefit - previousBenefit;

    return {
      success: true,
      new_analysis_id: newAnalysisId,
      improvement_summary: {
        confidence_before: previousConfidence,
        confidence_after: newConfidence,
        new_findings_count: newFindingsCount,
        additional_benefit: benefitImprovement,
        data_quality_improved: confidenceImprovement > 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get previous analysis for comparison
 */
async function getPreviousAnalysis(
  supabase: SupabaseServiceClient,
  analysisType: string,
  analysisId: string
): Promise<Record<string, unknown> | null> {
  let tableName: string;

  switch (analysisType) {
    case 'fuel_tax_credits':
      tableName = 'fuel_tax_credits_analyses';
      break;
    case 'trust_distributions':
      tableName = 'trust_distribution_analyses';
      break;
    case 'superannuation_caps':
      tableName = 'superannuation_cap_analyses';
      break;
    default:
      return null;
  }

  const { data, error } = await supabase.from(tableName).select('*').eq('id', analysisId).single();

  if (error) {
    console.warn(`Could not fetch previous analysis ${analysisId}:`, error);
    return null;
  }

  return data;
}

// Helper functions (simplified - would need full implementations)
function isFuelTransaction(transaction: XeroTransactionRow): boolean {
  const description = (transaction.description || '').toLowerCase();
  const contactName = (transaction.contact_name || '').toLowerCase();
  const fuelKeywords = ['fuel', 'petrol', 'diesel', 'bp', 'shell', 'caltex', 'ampol'];
  return fuelKeywords.some(
    (keyword) => description.includes(keyword) || contactName.includes(keyword)
  );
}

function convertToFuelPurchase(transaction: XeroTransactionRow): FuelPurchase {
  const rawData = transaction.raw_xero_data;
  return {
    transaction_id: transaction.transaction_id,
    transaction_date: transaction.date,
    supplier_name: transaction.contact_name,
    total_amount: Math.abs(transaction.total),
    fuel_type: (rawData?.fuel_type as FuelPurchase['fuel_type']) || 'unknown',
    fuel_litres: rawData?.fuel_litres as number | undefined,
    business_use_percentage: (rawData?.business_use_percentage as number) || 100,
    is_off_road_use: (rawData?.is_off_road_use as boolean) || false,
    has_valid_tax_invoice: (rawData?.has_valid_tax_invoice as boolean) || false,
    financial_year: determineFY(new Date(transaction.date)),
  };
}

function convertToTrustDistribution(transaction: XeroTransactionRow): TrustDistribution {
  return {
    transaction_id: transaction.transaction_id,
    transaction_date: transaction.date,
    trust_entity_id: transaction.contact_id || '',
    trust_entity_name: transaction.contact_name || 'Unknown Trust',
    beneficiary_id: transaction.contact_id || '',
    beneficiary_name: transaction.contact_name,
    beneficiary_entity_type: 'unknown',
    distribution_amount: Math.abs(transaction.total),
    distribution_type: 'cash',
    financial_year: determineFY(new Date(transaction.date)),
  };
}

function convertToSuperContribution(contribution: XeroSuperContributionRow): SuperContribution {
  return {
    employee_id: contribution.employee_id,
    employee_name: contribution.employee_name,
    contribution_date: contribution.period_end_date,
    contribution_amount: contribution.super_amount,
    contribution_type: (contribution.contribution_type || 'SG') as SuperContribution['contribution_type'],
    is_concessional: contribution.is_concessional !== false,
    financial_year: determineFY(new Date(contribution.period_start_date)),
    super_fund_id: contribution.super_fund_id,
    super_fund_name: contribution.super_fund_name,
  };
}

function calculateTrustConfidence(analysis: Section100AAnalysis): number {
  // High confidence if no critical flags
  const criticalFlags = analysis.section_100a_flags.filter(
    (f: { severity: string }) => f.severity === 'critical'
  ).length;
  if (criticalFlags === 0) return 90;
  if (criticalFlags <= 2) return 70;
  return 50;
}

function determineFY(date: Date): string {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (month >= 7) {
    return `FY${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `FY${year - 1}-${String(year).slice(-2)}`;
  }
}
