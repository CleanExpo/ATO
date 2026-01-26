/**
 * GET /api/share/[token]
 *
 * Access a shared report using token. Public endpoint (no auth required).
 *
 * Query params:
 * - password?: string (required if link is password protected)
 *
 * Response:
 * - success: true
 * - title: string
 * - description: string | null
 * - reportType: ShareableReportType
 * - organisationName: string
 * - generatedAt: string
 * - expiresAt: string
 * - data: SharedReportData
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/api/errors';
import { isValidTokenFormat, isExpired } from '@/lib/share/token-generator';
import { compare } from 'bcryptjs';
import type {
  AccessShareLinkResponse,
  ShareLinkError,
  SharedReport,
  SharedReportData,
  ExecutiveSummary,
  ReportFinding,
  ReportMetadata,
} from '@/lib/types/shared-reports';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');

    // Validate token format
    if (!isValidTokenFormat(token)) {
      const error: ShareLinkError = {
        success: false,
        error: 'Invalid share link format',
        code: 'INVALID_TOKEN',
      };
      return NextResponse.json(error, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Fetch share record
    const { data: shareRecord, error: fetchError } = await supabase
      .from('shared_reports')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !shareRecord) {
      const error: ShareLinkError = {
        success: false,
        error: 'This share link does not exist or has been removed',
        code: 'NOT_FOUND',
      };
      return NextResponse.json(error, { status: 404 });
    }

    const share = shareRecord as SharedReport;

    // Check if revoked
    if (share.is_revoked) {
      const error: ShareLinkError = {
        success: false,
        error: 'Access to this report has been revoked',
        code: 'REVOKED',
      };
      return NextResponse.json(error, { status: 403 });
    }

    // Check if expired
    if (isExpired(share.expires_at)) {
      const error: ShareLinkError = {
        success: false,
        error: 'This share link has expired. Please request a new one.',
        code: 'EXPIRED',
      };
      return NextResponse.json(error, { status: 403 });
    }

    // Check password if protected
    if (share.password_hash) {
      if (!password) {
        const error: ShareLinkError = {
          success: false,
          error: 'This report is password protected',
          code: 'PASSWORD_REQUIRED',
        };
        return NextResponse.json(error, { status: 401 });
      }

      const isValidPassword = await compare(password, share.password_hash);
      if (!isValidPassword) {
        // Log failed access attempt
        await logAccessAttempt(supabase, share.id, request, false, 'Invalid password');

        const error: ShareLinkError = {
          success: false,
          error: 'Incorrect password',
          code: 'INVALID_PASSWORD',
        };
        return NextResponse.json(error, { status: 401 });
      }
    }

    // Log successful access
    await logAccessAttempt(supabase, share.id, request, true);

    // Update access statistics
    const clientIp = getClientIp(request);
    await supabase
      .from('shared_reports')
      .update({
        access_count: share.access_count + 1,
        last_accessed_at: new Date().toISOString(),
        last_accessed_ip: clientIp,
      })
      .eq('id', share.id);

    // Fetch organisation name
    const { data: tenant } = await supabase
      .from('xero_tenants')
      .select('organisation_name')
      .eq('tenant_id', share.tenant_id)
      .single();

    const organisationName = tenant?.organisation_name || 'Unknown Organisation';

    // Generate report data based on type
    const reportData = await generateReportData(supabase, share);

    const response: AccessShareLinkResponse = {
      success: true,
      title: share.title,
      description: share.description,
      reportType: share.report_type as AccessShareLinkResponse['reportType'],
      organisationName,
      generatedAt: new Date().toISOString(),
      expiresAt: share.expires_at,
      data: reportData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/share/[token]:', error);
    return createErrorResponse(
      error,
      { operation: 'accessShareLink' },
      500
    );
  }
}

/**
 * Log access attempt for audit trail
 */
async function logAccessAttempt(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  shareId: string,
  request: NextRequest,
  successful: boolean,
  failureReason?: string
) {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent');

  await supabase.from('share_access_logs').insert({
    share_id: shareId,
    ip_address: clientIp,
    user_agent: userAgent,
    successful,
    failure_reason: failureReason,
  });
}

/**
 * Get client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Generate report data based on share configuration
 */
async function generateReportData(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  share: SharedReport
): Promise<SharedReportData> {
  const filters = share.filters || {};

  // Build query for analysis results
  let query = supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', share.tenant_id);

  // Apply financial year filters
  if (filters.financialYears && filters.financialYears.length > 0) {
    query = query.in('financial_year', filters.financialYears);
  }

  // Apply confidence filter
  if (filters.confidenceLevel && filters.confidenceLevel !== 'all') {
    const minConfidence =
      filters.confidenceLevel === 'high' ? 0.8 :
      filters.confidenceLevel === 'medium' ? 0.6 : 0.4;
    query = query.gte('classification_confidence', minConfidence);
  }

  // Apply report type specific filters
  if (share.report_type === 'rnd') {
    query = query.eq('is_rnd_candidate', true);
  } else if (share.report_type === 'deductions') {
    query = query.in('tax_category', ['business_expense', 'travel', 'professional_development', 'home_office']);
  } else if (share.report_type === 'div7a') {
    query = query.or('tax_category.eq.div7a_loan,tax_category.eq.shareholder_loan');
  } else if (share.report_type === 'losses') {
    query = query.in('tax_category', ['loss', 'carry_forward_loss']);
  }

  const { data: results, error } = await query.order('transaction_date', { ascending: false });

  if (error) {
    console.error('Error fetching analysis results:', error);
  }

  const analysisResults = results || [];

  // Calculate executive summary
  const executiveSummary = calculateExecutiveSummary(analysisResults, share.report_type);

  // Generate findings
  const findings = generateFindings(analysisResults, share.report_type);

  // Generate transaction samples if requested
  const transactions = filters.includeTransactionDetails
    ? analysisResults.slice(0, 50).map(r => ({
        date: r.transaction_date,
        description: r.description || '',
        amount: r.transaction_amount || 0,
        category: r.tax_category || 'uncategorised',
        classification: r.ai_classification || 'unknown',
        confidence: r.classification_confidence || 0,
      }))
    : undefined;

  // Generate recommendations if requested
  const recommendations = filters.includeRecommendations
    ? generateRecommendations(findings)
    : undefined;

  // Metadata
  const metadata: ReportMetadata = {
    generatedAt: new Date().toISOString(),
    generatedBy: 'ATO Tax Optimizer',
    version: '1.0',
    disclaimer: 'This analysis is provided for informational purposes only and does not constitute tax advice. All recommendations should be reviewed by a qualified tax professional before implementation.',
  };

  return {
    executiveSummary,
    findings,
    transactions,
    recommendations,
    metadata,
  };
}

/**
 * Calculate executive summary from analysis results
 */
function calculateExecutiveSummary(
  results: Array<Record<string, unknown>>,
  reportType: string
): ExecutiveSummary {
  const totalTransactions = results.length;

  // Get unique financial years
  const fys = new Set(results.map(r => r.financial_year as string).filter(Boolean));
  const periodCovered = fys.size > 0
    ? Array.from(fys).sort().join(' to ')
    : 'No period data';

  // Calculate total potential benefit
  const totalPotentialBenefit = results.reduce((sum, r) => {
    const amount = (r.potential_benefit as number) || (r.transaction_amount as number) || 0;
    return sum + Math.abs(amount) * 0.25; // Rough estimate at 25% tax rate
  }, 0);

  // Count high priority items (high confidence R&D or large deductions)
  const highPriorityItems = results.filter(r =>
    (r.is_rnd_candidate && (r.classification_confidence as number) >= 0.8) ||
    (Math.abs((r.transaction_amount as number) || 0) > 10000)
  ).length;

  // Generate key findings
  const keyFindings: string[] = [];

  const rndCount = results.filter(r => r.is_rnd_candidate).length;
  if (rndCount > 0) {
    keyFindings.push(`${rndCount} potential R&D Tax Incentive candidates identified`);
  }

  const deductionSum = results
    .filter(r => ['business_expense', 'travel'].includes(r.tax_category as string))
    .reduce((sum, r) => sum + Math.abs((r.transaction_amount as number) || 0), 0);
  if (deductionSum > 0) {
    keyFindings.push(`$${deductionSum.toLocaleString()} in potential deductions identified`);
  }

  const div7aCount = results.filter(r =>
    (r.tax_category as string)?.includes('div7a') ||
    (r.tax_category as string)?.includes('loan')
  ).length;
  if (div7aCount > 0) {
    keyFindings.push(`${div7aCount} Division 7A compliance items require review`);
  }

  if (keyFindings.length === 0) {
    keyFindings.push('No significant tax optimisation opportunities identified');
  }

  return {
    totalTransactionsAnalysed: totalTransactions,
    periodCovered,
    totalPotentialBenefit: Math.round(totalPotentialBenefit * 100) / 100,
    highPriorityItems,
    keyFindings,
  };
}

/**
 * Generate findings from analysis results
 */
function generateFindings(
  results: Array<Record<string, unknown>>,
  reportType: string
): ReportFinding[] {
  const findings: ReportFinding[] = [];

  // Group results by category
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const r of results) {
    const category = (r.tax_category as string) || 'uncategorised';
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(r);
  }

  // Generate findings for each category
  for (const [category, items] of grouped) {
    if (items.length === 0) continue;

    const totalAmount = items.reduce((sum, r) =>
      sum + Math.abs((r.transaction_amount as number) || 0), 0);

    const avgConfidence = items.reduce((sum, r) =>
      sum + ((r.classification_confidence as number) || 0), 0) / items.length;

    findings.push({
      id: `finding-${category}`,
      category: mapCategoryToDisplay(category),
      title: `${items.length} ${mapCategoryToDisplay(category)} items`,
      description: generateCategoryDescription(category, items.length, totalAmount),
      potentialBenefit: Math.round(totalAmount * 0.25 * 100) / 100,
      confidence: avgConfidence >= 0.8 ? 'high' : avgConfidence >= 0.6 ? 'medium' : 'low',
      priority: totalAmount > 50000 ? 'high' : totalAmount > 10000 ? 'medium' : 'low',
      legislativeReference: getLegislativeReference(category),
      actionRequired: getActionRequired(category),
    });
  }

  return findings.sort((a, b) => b.potentialBenefit - a.potentialBenefit);
}

/**
 * Map internal category to display name
 */
function mapCategoryToDisplay(category: string): string {
  const map: Record<string, string> = {
    'business_expense': 'Business Expenses',
    'rnd': 'R&D Tax Incentive',
    'div7a_loan': 'Division 7A Loans',
    'shareholder_loan': 'Shareholder Loans',
    'travel': 'Travel Expenses',
    'professional_development': 'Professional Development',
    'home_office': 'Home Office',
    'loss': 'Tax Losses',
    'carry_forward_loss': 'Carry-Forward Losses',
    'uncategorised': 'Uncategorised',
  };
  return map[category] || category;
}

/**
 * Generate description for category
 */
function generateCategoryDescription(category: string, count: number, total: number): string {
  return `Identified ${count} transactions totalling $${total.toLocaleString()} that may qualify for tax benefits under ${getLegislativeReference(category)}.`;
}

/**
 * Get legislative reference for category
 */
function getLegislativeReference(category: string): string {
  const refs: Record<string, string> = {
    'business_expense': 'Section 8-1 ITAA 1997',
    'rnd': 'Division 355 ITAA 1997',
    'div7a_loan': 'Division 7A ITAA 1936',
    'shareholder_loan': 'Division 7A ITAA 1936',
    'travel': 'Section 8-1 ITAA 1997',
    'professional_development': 'Section 8-1 ITAA 1997',
    'home_office': 'Section 8-1 ITAA 1997',
    'loss': 'Subdivision 36-A ITAA 1997',
    'carry_forward_loss': 'Subdivision 36-A ITAA 1997',
  };
  return refs[category] || 'General Provisions';
}

/**
 * Get action required for category
 */
function getActionRequired(category: string): string {
  const actions: Record<string, string> = {
    'business_expense': 'Review against lodged tax returns, verify documentation',
    'rnd': 'Complete four-element test, register with AusIndustry, prepare R&D schedule',
    'div7a_loan': 'Verify loan agreements, calculate minimum yearly repayments',
    'shareholder_loan': 'Review loan documentation, ensure Division 7A compliance',
    'travel': 'Verify business purpose, check log book records',
    'professional_development': 'Confirm nexus to current employment',
    'home_office': 'Calculate actual expenses or fixed rate method',
    'loss': 'Verify continuity of ownership or same business tests',
    'carry_forward_loss': 'Review prior year returns, verify loss schedule accuracy',
  };
  return actions[category] || 'Professional review recommended';
}

/**
 * Generate recommendations from findings
 */
function generateRecommendations(findings: ReportFinding[]) {
  return findings
    .filter(f => f.priority === 'high' || f.potentialBenefit > 10000)
    .slice(0, 10)
    .map((f, i) => ({
      id: `rec-${i + 1}`,
      title: `Review ${f.title}`,
      description: f.description,
      estimatedBenefit: f.potentialBenefit,
      effort: f.potentialBenefit > 50000 ? 'high' as const : 'medium' as const,
      steps: [
        'Review transaction details with accountant',
        f.actionRequired,
        'Prepare supporting documentation',
        'Lodge amendment if applicable',
      ],
    }));
}
