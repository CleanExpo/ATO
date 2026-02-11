/**
 * GET /api/xero/payroll
 *
 * Fetch pay runs from Xero Payroll API.
 * Requires payroll.payruns.read OAuth scope (Phase 1.2 - ATODE Integration).
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - startDate: string (optional, ISO 8601) - Filter pay runs from this date
 * - endDate: string (optional, ISO 8601) - Filter pay runs to this date
 * - status: 'DRAFT' | 'POSTED' (optional) - Filter by pay run status
 *
 * Returns:
 * - Array of pay runs with wages, tax, super, deductions
 * - Normalized to ATODE internal format
 *
 * Legislation: Superannuation Guarantee (Administration) Act 1992, Division 291 ITAA 1997
 */

import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, type XeroPayRun, type NormalizedPayRun } from '@/lib/xero/client';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import { decryptStoredToken } from '@/lib/xero/token-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const statusFilter = searchParams.get('status') as 'DRAFT' | 'POSTED' | null;

    // Validate required parameters
    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required');
    }

    // Get Xero connection from database
    const supabase = await createServiceClient();
    const { data: connection, error: dbError } = await supabase
      .from('xero_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('tenant_id', tenantId)
      .single();

    if (dbError || !connection) {
      return createErrorResponse(
        new Error('Xero connection not found. Please connect your Xero account first.'),
        { tenantId },
        404
      );
    }

    // Initialize Xero client
    const xeroClient = createXeroClient();
    await xeroClient.initialize();
    // Decrypt tokens from database (SEC-001)
    xeroClient.setTokenSet({
      access_token: decryptStoredToken(connection.access_token),
      refresh_token: decryptStoredToken(connection.refresh_token),
      expires_at: connection.expires_at,
    });

    // Fetch pay runs from Xero Payroll AU API
    const response = await xeroClient.payrollAUApi.getPayRuns(tenantId);

    // Extract pay runs from response
    let xeroPayRuns = (response.body.payRuns || []) as unknown as XeroPayRun[];

    // Apply filters
    if (startDate) {
      xeroPayRuns = xeroPayRuns.filter(pr => pr.periodStartDate >= startDate);
    }
    if (endDate) {
      xeroPayRuns = xeroPayRuns.filter(pr => pr.periodEndDate <= endDate);
    }
    if (statusFilter) {
      xeroPayRuns = xeroPayRuns.filter(pr => pr.payRunStatus === statusFilter);
    }

    // Normalize to ATODE internal format
    const normalizedPayRuns: NormalizedPayRun[] = xeroPayRuns.map(pr => normalizePayRun(pr));

    // Calculate aggregate statistics
    const totalWages = normalizedPayRuns.reduce((sum, pr) => sum + pr.total_wages, 0);
    const totalSuper = normalizedPayRuns.reduce((sum, pr) => sum + pr.total_super, 0);
    const totalTax = normalizedPayRuns.reduce((sum, pr) => sum + pr.total_tax, 0);

    return NextResponse.json({
      success: true,
      count: normalizedPayRuns.length,
      tenantId,
      payRuns: normalizedPayRuns,
      aggregates: {
        total_wages: totalWages,
        total_super: totalSuper,
        total_tax: totalTax,
        average_wages_per_pay_run: normalizedPayRuns.length > 0 ? totalWages / normalizedPayRuns.length : 0,
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'xero_payroll_au_api',
        apiVersion: '2.0',
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          status: statusFilter || 'all',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching Xero pay runs:', error);

    // Handle Xero API errors
    if (error instanceof Error && error.message.includes('payroll.payruns.read')) {
      return createErrorResponse(
        new Error(
          'Missing payroll.payruns.read OAuth scope. Please reconnect your Xero account to grant payroll access.'
        ),
        { operation: 'fetchPayRuns' },
        403
      );
    }

    return createErrorResponse(
      error,
      {
        operation: 'fetchPayRuns',
        endpoint: '/api/xero/payroll',
      },
      500
    );
  }
}

/**
 * Normalize Xero pay run to ATODE internal format
 */
function normalizePayRun(xeroPayRun: XeroPayRun): NormalizedPayRun {
  return {
    pay_run_id: xeroPayRun.payRunID,
    period_start_date: xeroPayRun.periodStartDate,
    period_end_date: xeroPayRun.periodEndDate,
    payment_date: xeroPayRun.paymentDate,
    total_wages: xeroPayRun.totalWages,
    total_tax: xeroPayRun.totalTax,
    total_super: xeroPayRun.totalSuper,
    total_deductions: xeroPayRun.totalDeduction,
    total_net_pay: xeroPayRun.totalNetPay,
    employee_count: xeroPayRun.payslips?.length || 0,
    status: xeroPayRun.payRunStatus === 'POSTED' ? 'posted' : 'draft',
  };
}
