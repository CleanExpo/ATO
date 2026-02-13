/**
 * POST /api/reports/consolidated/generate
 *
 * Generate a consolidated report aggregating data from all client organizations
 * accessible by the authenticated accountant.
 *
 * This endpoint is designed for accountants managing 50+ clients who need
 * a single view of their entire portfolio.
 *
 * Body:
 * - batchSize?: number (optional, default: 5, max: 10)
 *   Controls parallel processing - lower values reduce server load
 * - organizationIds?: string[] (optional - filter to specific organizations)
 *
 * Response: ConsolidatedReport
 * - metadata: Report metadata (accountant info, generation time)
 * - portfolioSummary: Aggregated statistics across all clients
 * - clientReports: Individual client summaries
 * - insights: Business intelligence (time saved, action items)
 * - generationMetrics: Performance data
 *
 * Security:
 * - Requires authentication
 * - Only generates reports for organizations the user has access to
 * - Rate limited to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError, createAuthError } from '@/lib/api/errors';
import { generateConsolidatedReport } from '@/lib/reports/consolidated-report-generator';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic'

const log = createLogger('api:reports:consolidated:generate');

const generateConsolidatedReportSchema = z.object({
  batchSize: z.number().int().min(1).max(10).default(5),
  organizationIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('[CONSOLIDATED_REPORT] Unauthorized access attempt');
      return createAuthError('Authentication required to generate consolidated reports');
    }

    log.info('Report request received', { userId: user.id, email: user.email || 'unknown' });

    // Validate request body
    const body = await request.json();
    const validation = generateConsolidatedReportSchema.safeParse(body);

    if (!validation.success) {
      return createValidationError(
        validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      );
    }

    const { batchSize, organizationIds } = validation.data;

    // Validate user has access to all requested organizations
    if (organizationIds && organizationIds.length > 0) {
      const { data: accessibleOrgs, error: accessError } = await supabase
        .from('user_tenant_access')
        .select('tenant_id')
        .eq('user_id', user.id)
        .in('tenant_id', organizationIds);

      if (accessError) {
        log.error('Failed to validate org access', { error: accessError });
        return createErrorResponse(
          new Error('Failed to validate organisation access'),
          { operation: 'validate_org_access', userId: user.id },
          500
        );
      }

      const accessibleIds = new Set((accessibleOrgs || []).map((o) => o.tenant_id));
      const unauthorizedIds = organizationIds.filter((id) => !accessibleIds.has(id));

      if (unauthorizedIds.length > 0) {
        log.warn('Unauthorized org access attempt', { userId: user.id, unauthorizedIds });
        return createAuthError(
          `Access denied to ${unauthorizedIds.length} organisation(s)`
        );
      }
    }

    log.info('Generating report', { batchSize, filteredOrgs: organizationIds?.length });

    // Generate the consolidated report
    const report = await generateConsolidatedReport(user.id, supabase, batchSize);

    // Filter to requested organizations if specified
    let filteredReport = report;
    if (organizationIds && organizationIds.length > 0) {
      const organizationIdSet = new Set(organizationIds);
      filteredReport = {
        ...report,
        clientReports: report.clientReports.filter((cr) =>
          organizationIdSet.has(cr.organizationId)
        ),
      };

      // Recalculate portfolio summary for filtered data
      const successfulReports = filteredReport.clientReports.filter(
        (r) => r.status === 'completed'
      );
      const totalAdjustedOpportunity = successfulReports.reduce(
        (sum, r) => sum + r.adjustedOpportunity,
        0
      );

      filteredReport.portfolioSummary = {
        ...filteredReport.portfolioSummary,
        totalAdjustedOpportunity,
        totalOpportunity: successfulReports.reduce((sum, r) => sum + r.totalOpportunity, 0),
        averageOpportunityPerClient:
          successfulReports.length > 0
            ? totalAdjustedOpportunity / successfulReports.length
            : 0,
        totalRndOpportunity: successfulReports.reduce(
          (sum, r) => sum + r.breakdown.rnd,
          0
        ),
        totalDeductionOpportunity: successfulReports.reduce(
          (sum, r) => sum + r.breakdown.deductions,
          0
        ),
        totalLossRecovery: successfulReports.reduce(
          (sum, r) => sum + r.breakdown.losses,
          0
        ),
        totalDiv7aRisk: successfulReports.reduce((sum, r) => sum + r.breakdown.div7a, 0),
        topClients: successfulReports
          .sort((a, b) => b.adjustedOpportunity - a.adjustedOpportunity)
          .slice(0, 10)
          .map((r) => ({
            name: r.organizationName,
            opportunity: r.adjustedOpportunity,
            percentage: (r.adjustedOpportunity / totalAdjustedOpportunity) * 100,
          })),
        opportunityDistribution: {
          above100k: successfulReports.filter((r) => r.adjustedOpportunity > 100000).length,
          between50kAnd100k: successfulReports.filter(
            (r) => r.adjustedOpportunity >= 50000 && r.adjustedOpportunity <= 100000
          ).length,
          between20kAnd50k: successfulReports.filter(
            (r) => r.adjustedOpportunity >= 20000 && r.adjustedOpportunity < 50000
          ).length,
          below20k: successfulReports.filter((r) => r.adjustedOpportunity < 20000).length,
        },
      };

      filteredReport.metadata.totalClients = filteredReport.clientReports.length;
      filteredReport.metadata.successfulReports = successfulReports.length;
      filteredReport.metadata.failedReports = filteredReport.clientReports.filter(
        (r) => r.status === 'failed'
      ).length;
    }

    log.info('Report generated successfully', {
      totalClients: filteredReport.metadata.totalClients,
      successfulReports: filteredReport.metadata.successfulReports,
      processingTimeMs: filteredReport.generationMetrics.processingTimeMs,
    });

    // Log report generation for analytics
    try {
      await supabase.from('consolidated_report_log').insert({
        accountant_id: user.id,
        accountant_email: user.email,
        report_id: filteredReport.metadata.reportId,
        total_clients: filteredReport.metadata.totalClients,
        successful_reports: filteredReport.metadata.successfulReports,
        failed_reports: filteredReport.metadata.failedReports,
        total_opportunity: filteredReport.portfolioSummary.totalAdjustedOpportunity,
        processing_time_ms: filteredReport.generationMetrics.processingTimeMs,
        generated_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('[CONSOLIDATED_REPORT] Failed to log report generation:', logError);
    }

    return NextResponse.json(filteredReport);
  } catch (error) {
    console.error('[CONSOLIDATED_REPORT] Failed to generate consolidated report:', error);
    return createErrorResponse(
      error as Error,
      {
        operation: 'generate_consolidated_report',
        userId: (error as Record<string, unknown>)?.userId,
      },
      500
    );
  }
}
