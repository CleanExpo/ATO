/**
 * POST /api/analysis/superannuation-caps
 *
 * Analyze superannuation contributions for Division 291 tax breaches.
 * Tracks concessional contributions against annual cap ($30,000 FY2024-25).
 *
 * Body:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - financialYear: string (optional, "FY2024-25" format) - Specific FY to analyze
 *
 * Returns:
 * - Superannuation cap analysis for each employee
 * - Division 291 tax calculations
 * - Cap breach warnings and recommendations
 *
 * Legislation: Division 291 ITAA 1997, Superannuation Guarantee (Administration) Act 1992
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import {
  analyzeSuperannuationCaps,
  type SuperContribution,
  type SuperannuationCapAnalysis,
} from '@/lib/analysis/superannuation-cap-analyzer';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, financialYear } = body;

    // Validate required parameters
    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required');
    }

    // Get Supabase client
    const supabase = createServiceClient();

    // Step 1: Fetch superannuation contributions from payroll data
    // Source: xero_super_contributions table (created in Phase 1.2)

    let contributionsQuery = supabase
      .from('xero_super_contributions')
      .select('*')
      .eq('tenant_id', tenantId);

    // Apply financial year filter if specified
    if (financialYear) {
      const fyMatch = financialYear.match(/FY(\d{4})-(\d{2})/);
      if (fyMatch) {
        const startYear = parseInt(fyMatch[1]);
        const startDate = `${startYear}-07-01`;
        const endDate = `${startYear + 1}-06-30`;

        contributionsQuery = contributionsQuery
          .gte('period_start_date', startDate)
          .lte('period_end_date', endDate);
      }
    }

    const { data: superContributions, error: contributionsError } = await contributionsQuery;

    if (contributionsError) {
      throw contributionsError;
    }

    if (!superContributions || superContributions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No superannuation contributions found. Ensure payroll data has been synced from Xero.',
        contributions_found: 0,
        analyses: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          tenantId,
          financialYear: financialYear || 'all',
        },
      });
    }

    // Step 2: Convert to SuperContribution format
    const contributions: SuperContribution[] = superContributions.map(contrib =>
      convertToSuperContribution(contrib)
    );

    // Step 3: Run superannuation cap analysis
    const analyses: SuperannuationCapAnalysis[] = await analyzeSuperannuationCaps(contributions);

    // Step 4: Calculate overall statistics
    const totalAnalyses = analyses.length;
    const totalEmployees = analyses.reduce((sum, a) => sum + a.total_employees_analyzed, 0);
    const totalBreaches = analyses.reduce((sum, a) => sum + a.employees_breaching_cap, 0);
    const totalDivision291Tax = analyses.reduce((sum, a) => sum + a.total_division_291_tax, 0);

    return NextResponse.json({
      success: true,
      contributions_found: contributions.length,
      analyses,
      summary: {
        total_analyses: totalAnalyses,
        total_employees_analyzed: totalEmployees,
        employees_breaching_cap: totalBreaches,
        total_division_291_tax: totalDivision291Tax,
        professional_review_required: totalBreaches > 0,
      },
      metadata: {
        analyzedAt: new Date().toISOString(),
        tenantId,
        financialYear: financialYear || 'all',
        legislation: 'Division 291 ITAA 1997',
        concessional_cap: {
          'FY2024-25': 30000,
          'FY2023-24': 27500,
          'FY2022-23': 27500,
          source: 'Income Tax Assessment (1997 Act) Regulation 2021',
        },
      },
    });
  } catch (error) {
    console.error('Error analyzing superannuation caps:', error);

    return createErrorResponse(
      error,
      {
        operation: 'analyzeSuperannuationCaps',
        endpoint: '/api/analysis/superannuation-caps',
      },
      500
    );
  }
}

/**
 * Convert database super contribution to SuperContribution format
 */
function convertToSuperContribution(dbContrib: any): SuperContribution {
  // Determine financial year from period start date
  const periodStartDate = new Date(dbContrib.period_start_date);
  const fy = determineFY(periodStartDate);

  return {
    employee_id: dbContrib.employee_id,
    employee_name: dbContrib.employee_name,
    contribution_date: dbContrib.period_end_date, // Use period end as contribution date
    contribution_amount: dbContrib.super_amount,
    contribution_type: dbContrib.contribution_type || 'SG',
    is_concessional: dbContrib.is_concessional !== false, // Default to true
    financial_year: fy,
    super_fund_id: dbContrib.super_fund_id,
    super_fund_name: dbContrib.super_fund_name,
  };
}

/**
 * Determine Australian financial year from date
 */
function determineFY(date: Date): string {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  if (month >= 7) {
    return `FY${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `FY${year - 1}-${String(year).slice(-2)}`;
  }
}
