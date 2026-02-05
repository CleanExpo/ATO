/**
 * GET /api/xero/employees
 *
 * Fetch employees from Xero Payroll API.
 * Requires payroll.employees.read OAuth scope (Phase 1.2 - ATODE Integration).
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - status: 'ACTIVE' | 'TERMINATED' (optional) - Filter by employee status
 *
 * Returns:
 * - Array of employees with employment details
 * - Normalized to ATODE internal format
 *
 * Legislation: Superannuation Guarantee (Administration) Act 1992, Division 291 ITAA 1997 (Super caps)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, type XeroEmployee, type NormalizedEmployee } from '@/lib/xero/client';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const statusFilter = searchParams.get('status') as 'ACTIVE' | 'TERMINATED' | null;

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

    // Fetch employees from Xero Payroll AU API
    // Note: Xero Payroll API differs by region (AU, UK, NZ, US)
    // This implementation assumes Australian Payroll API
    const response = await xeroClient.payrollAUApi.getEmployees(tenantId);

    // Extract employees from response
    const xeroEmployees = (response.body.employees || []) as any[];

    // Filter by status if requested
    let filteredEmployees = xeroEmployees;
    if (statusFilter) {
      filteredEmployees = xeroEmployees.filter(emp => emp.status === statusFilter);
    }

    // Normalize to ATODE internal format
    const normalizedEmployees: NormalizedEmployee[] = filteredEmployees.map(emp => normalizeEmployee(emp));

    return NextResponse.json({
      success: true,
      count: normalizedEmployees.length,
      tenantId,
      employees: normalizedEmployees,
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'xero_payroll_au_api',
        apiVersion: '2.0',
        statusFilter: statusFilter || 'all',
      },
    });
  } catch (error) {
    console.error('Error fetching Xero employees:', error);

    // Handle Xero API errors
    if (error instanceof Error && error.message.includes('payroll.employees.read')) {
      return createErrorResponse(
        new Error(
          'Missing payroll.employees.read OAuth scope. Please reconnect your Xero account to grant payroll access.'
        ),
        { operation: 'fetchEmployees' },
        403
      );
    }

    return createErrorResponse(
      error,
      {
        operation: 'fetchEmployees',
        endpoint: '/api/xero/employees',
      },
      500
    );
  }
}

/**
 * Normalize Xero employee to ATODE internal format
 */
function normalizeEmployee(xeroEmployee: XeroEmployee): NormalizedEmployee {
  return {
    employee_id: xeroEmployee.employeeID,
    first_name: xeroEmployee.firstName,
    last_name: xeroEmployee.lastName,
    email: xeroEmployee.email,
    start_date: xeroEmployee.startDate,
    end_date: xeroEmployee.endDate,
    job_title: xeroEmployee.jobTitle,
    status: xeroEmployee.status === 'ACTIVE' ? 'active' : 'terminated',
  };
}
