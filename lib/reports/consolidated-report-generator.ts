/**
 * Consolidated Report Generator
 *
 * Aggregates data from multiple client organizations into a single report
 * for accountants managing 50+ clients.
 *
 * Features:
 * - Parallel report generation for performance
 * - Summary statistics across all clients
 * - Top opportunities ranked by value
 * - Client-by-client breakdown
 * - Portfolio health dashboard
 */

import { generatePDFReportData, type PDFReport, type ExecutiveSummary } from './pdf-generator';
import { createLogger } from '@/lib/logger';
// Note: Supabase client must be passed in from API routes, not imported here
// import { createServiceClient } from '@/lib/supabase/server';

const log = createLogger('reports:consolidated');

export interface ClientReportSummary {
  organizationId: string;
  organizationName: string;
  abn?: string;
  totalOpportunity: number;
  adjustedOpportunity: number;
  breakdown: {
    rnd: number;
    deductions: number;
    losses: number;
    div7a: number;
  };
  confidence: number;
  status: 'completed' | 'in_progress' | 'failed';
  errorMessage?: string;
  reportId?: string;
}

export interface ConsolidatedReportMetadata {
  reportId: string;
  accountantId: string;
  accountantName: string;
  accountantEmail: string;
  generatedAt: Date;
  totalClients: number;
  successfulReports: number;
  failedReports: number;
  reportVersion: string;
}

export interface PortfolioSummary {
  totalOpportunity: number;
  totalAdjustedOpportunity: number;
  averageOpportunityPerClient: number;
  totalRndOpportunity: number;
  totalDeductionOpportunity: number;
  totalLossRecovery: number;
  totalDiv7aRisk: number;
  topClients: Array<{
    name: string;
    opportunity: number;
    percentage: number;
  }>;
  opportunityDistribution: {
    above100k: number;
    between50kAnd100k: number;
    between20kAnd50k: number;
    below20k: number;
  };
}

export interface ConsolidatedReport {
  metadata: ConsolidatedReportMetadata;
  portfolioSummary: PortfolioSummary;
  clientReports: ClientReportSummary[];
  insights: {
    totalTimeSaved: number; // Hours saved by batch processing
    averageConfidence: number;
    criticalActionItems: number;
    upcomingDeadlines: Array<{
      clientName: string;
      action: string;
      deadline: Date;
    }>;
  };
  generationMetrics: {
    processingTimeMs: number;
    clientsProcessed: number;
    parallelBatches: number;
  };
}

/**
 * Get all organizations accessible by an accountant
 */
async function getAccountantOrganizations(
  accountantUserId: string,
  supabase: any
): Promise<Array<{ id: string; name: string; abn?: string; tenantId?: string }>> {

  // Get all organizations where user has accountant or admin role
  const { data, error } = await supabase
    .from('user_organization_access')
    .select(`
      organization_id,
      role,
      organizations (
        id,
        name,
        abn,
        xero_tenant_id
      )
    `)
    .eq('user_id', accountantUserId)
    .in('role', ['accountant', 'admin', 'owner']);

  if (error) {
    console.error('Error fetching accountant organizations:', error)
    throw new Error('Failed to fetch accountant organizations');
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((access: any) => ({
    id: access.organizations?.id || access.organization_id,
    name: access.organizations?.name || 'Unknown Organization',
    abn: access.organizations?.abn,
    tenantId: access.organizations?.xero_tenant_id,
  }));
}

/**
 * Generate report for a single client (with error handling)
 */
async function generateClientReport(
  organizationId: string,
  organizationName: string,
  abn: string | undefined,
  tenantId: string | undefined
): Promise<ClientReportSummary> {
  try {
    // Generate full PDF report data for this client
    const reportData = await generatePDFReportData(
      tenantId || organizationId,
      organizationName,
      abn || ''
    );

    return {
      organizationId,
      organizationName,
      abn,
      totalOpportunity: reportData.executiveSummary.totalOpportunity,
      adjustedOpportunity: reportData.executiveSummary.adjustedOpportunity,
      breakdown: reportData.executiveSummary.breakdown,
      confidence: reportData.executiveSummary.overallConfidence,
      status: 'completed',
      reportId: reportData.metadata.reportId,
    };
  } catch (error) {
    console.error(`Failed to generate report for ${organizationName}:`, error)
    return {
      organizationId,
      organizationName,
      abn,
      totalOpportunity: 0,
      adjustedOpportunity: 0,
      breakdown: {
        rnd: 0,
        deductions: 0,
        losses: 0,
        div7a: 0,
      },
      confidence: 0,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate consolidated report for an accountant's entire client portfolio
 *
 * @param accountantUserId - User ID of the accountant
 * @param supabase - Supabase client (must be passed from server context)
 * @param batchSize - Number of reports to generate in parallel (default: 5)
 */
export async function generateConsolidatedReport(
  accountantUserId: string,
  supabase: any,
  batchSize: number = 5
): Promise<ConsolidatedReport> {
  const startTime = Date.now();

  // Get accountant details
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', accountantUserId)
    .single();

  const accountantName = profile?.full_name || 'Unknown Accountant';
  const accountantEmail = profile?.email || '';

  // Get all client organizations
  const organizations = await getAccountantOrganizations(accountantUserId, supabase);

  if (organizations.length === 0) {
    throw new Error('No client organizations found for this accountant');
  }

  log.info('Generating consolidated report', { clientCount: organizations.length });

  // Generate reports in parallel batches for performance
  const clientReports: ClientReportSummary[] = [];
  const batches = Math.ceil(organizations.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const batchStart = i * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, organizations.length);
    const batch = organizations.slice(batchStart, batchEnd);

    log.info('Processing batch', { batch: i + 1, totalBatches: batches, clientRange: `${batchStart + 1}-${batchEnd}` });

    // Generate reports for this batch in parallel
    const batchReports = await Promise.all(
      batch.map((org) =>
        generateClientReport(org.id, org.name, org.abn, org.tenantId)
      )
    );

    clientReports.push(...batchReports);
  }

  // Calculate portfolio summary
  const successfulReports = clientReports.filter((r) => r.status === 'completed');
  const failedReports = clientReports.filter((r) => r.status === 'failed');

  const totalOpportunity = successfulReports.reduce(
    (sum, r) => sum + r.totalOpportunity,
    0
  );
  const totalAdjustedOpportunity = successfulReports.reduce(
    (sum, r) => sum + r.adjustedOpportunity,
    0
  );
  const averageOpportunityPerClient =
    successfulReports.length > 0
      ? totalAdjustedOpportunity / successfulReports.length
      : 0;

  // Calculate category totals
  const totalRndOpportunity = successfulReports.reduce(
    (sum, r) => sum + r.breakdown.rnd,
    0
  );
  const totalDeductionOpportunity = successfulReports.reduce(
    (sum, r) => sum + r.breakdown.deductions,
    0
  );
  const totalLossRecovery = successfulReports.reduce(
    (sum, r) => sum + r.breakdown.losses,
    0
  );
  const totalDiv7aRisk = successfulReports.reduce(
    (sum, r) => sum + r.breakdown.div7a,
    0
  );

  // Top clients by opportunity
  const topClients = successfulReports
    .sort((a, b) => b.adjustedOpportunity - a.adjustedOpportunity)
    .slice(0, 10)
    .map((r) => ({
      name: r.organizationName,
      opportunity: r.adjustedOpportunity,
      percentage: (r.adjustedOpportunity / totalAdjustedOpportunity) * 100,
    }));

  // Opportunity distribution
  const opportunityDistribution = {
    above100k: successfulReports.filter((r) => r.adjustedOpportunity > 100000).length,
    between50kAnd100k: successfulReports.filter(
      (r) => r.adjustedOpportunity >= 50000 && r.adjustedOpportunity <= 100000
    ).length,
    between20kAnd50k: successfulReports.filter(
      (r) => r.adjustedOpportunity >= 20000 && r.adjustedOpportunity < 50000
    ).length,
    below20k: successfulReports.filter((r) => r.adjustedOpportunity < 20000).length,
  };

  const processingTimeMs = Date.now() - startTime;
  const averageConfidence =
    successfulReports.length > 0
      ? successfulReports.reduce((sum, r) => sum + r.confidence, 0) /
        successfulReports.length
      : 0;

  const consolidatedReport: ConsolidatedReport = {
    metadata: {
      reportId: `CONS-${Date.now()}-${accountantUserId.substring(0, 8)}`,
      accountantId: accountantUserId,
      accountantName,
      accountantEmail,
      generatedAt: new Date(),
      totalClients: organizations.length,
      successfulReports: successfulReports.length,
      failedReports: failedReports.length,
      reportVersion: '1.0.0',
    },
    portfolioSummary: {
      totalOpportunity,
      totalAdjustedOpportunity,
      averageOpportunityPerClient,
      totalRndOpportunity,
      totalDeductionOpportunity,
      totalLossRecovery,
      totalDiv7aRisk,
      topClients,
      opportunityDistribution,
    },
    clientReports,
    insights: {
      totalTimeSaved: Math.round(organizations.length * 2.5), // Estimate 2.5 hours per manual analysis
      averageConfidence,
      criticalActionItems: successfulReports.filter((r) => r.adjustedOpportunity > 50000)
        .length,
      upcomingDeadlines: [], // TODO: Extract from individual reports
    },
    generationMetrics: {
      processingTimeMs,
      clientsProcessed: organizations.length,
      parallelBatches: batches,
    },
  };

  log.info('Consolidated report generated', { processingTimeMs, clientCount: organizations.length, batches });

  return consolidatedReport;
}

// Re-export formatting utilities for backwards compatibility
export { formatCurrency, formatPercentage } from './formatting-utils';
