/**
 * GET /api/xero/super-funds
 *
 * Fetch superannuation funds from Xero Payroll API.
 * Requires payroll.payruns.read OAuth scope (Phase 1.2 - ATODE Integration).
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant/organisation ID
 *
 * Returns:
 * - Array of superannuation funds (APRA-regulated and SMSF)
 * - Used for Division 291 compliance (concessional super cap analysis)
 *
 * Legislation: Superannuation Guarantee (Administration) Act 1992, Division 291 ITAA 1997
 */

import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, type XeroSuperFund } from '@/lib/xero/client';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

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
    xeroClient.setTokenSet({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expires_at: connection.expires_at,
    });

    // Fetch super funds from Xero Payroll AU API
    const response = await xeroClient.payrollAUApi.getSuperfunds(tenantId);

    // Extract super funds from response
    const xeroSuperFunds = (response.body.superFunds || []) as unknown as XeroSuperFund[];

    // Separate SMSF vs APRA-regulated funds
    const smsfFunds = xeroSuperFunds.filter(fund => fund.type === 'SMSF');
    const regulatedFunds = xeroSuperFunds.filter(fund => fund.type === 'REGULATED');

    return NextResponse.json({
      success: true,
      count: xeroSuperFunds.length,
      tenantId,
      superFunds: xeroSuperFunds,
      breakdown: {
        smsf_count: smsfFunds.length,
        regulated_count: regulatedFunds.length,
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'xero_payroll_au_api',
        apiVersion: '2.0',
      },
    });
  } catch (error) {
    console.error('Error fetching Xero super funds:', error);

    // Handle Xero API errors
    if (error instanceof Error && error.message.includes('payroll.payruns.read')) {
      return createErrorResponse(
        new Error(
          'Missing payroll.payruns.read OAuth scope. Please reconnect your Xero account to grant payroll access.'
        ),
        { operation: 'fetchSuperFunds' },
        403
      );
    }

    return createErrorResponse(
      error,
      {
        operation: 'fetchSuperFunds',
        endpoint: '/api/xero/super-funds',
      },
      500
    );
  }
}
