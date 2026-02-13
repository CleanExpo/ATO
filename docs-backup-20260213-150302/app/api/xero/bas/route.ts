/**
 * GET /api/xero/bas
 *
 * Fetch Business Activity Statement (BAS) reports from Xero.
 * Requires accounting.reports.read OAuth scope (Phase 1.4 - ATODE Integration).
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - reportYear: string (optional, YYYY format) - Financial year to retrieve BAS data for
 *
 * Returns:
 * - BAS report data with G1-G11, W1-W2, T1-T2 fields
 * - Normalized to ATODE internal format
 *
 * Legislation: GST Act 1999, PAYG Withholding Schedule 1 TAA 1953, PAYG Instalments Division 45 Schedule 1 TAA 1953
 */

import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, type XeroBASReport, type NormalizedBAS } from '@/lib/xero/client';
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
    const reportYear = searchParams.get('reportYear');

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

    // Fetch BAS reports from Xero Accounting API
    // Note: Xero's BAS report endpoint requires specific date ranges (quarters)
    // Australian BAS is lodged quarterly or monthly depending on business size

    // If reportYear is specified, fetch all quarters for that financial year
    // Otherwise, fetch the most recent BAS period
    const basReports: NormalizedBAS[] = [];

    if (reportYear) {
      // Australian financial year: July 1 to June 30
      const fyStartYear = parseInt(reportYear);
      const quarters = [
        { start: `${fyStartYear}-07-01`, end: `${fyStartYear}-09-30` }, // Q1
        { start: `${fyStartYear}-10-01`, end: `${fyStartYear}-12-31` }, // Q2
        { start: `${fyStartYear + 1}-01-01`, end: `${fyStartYear + 1}-03-31` }, // Q3
        { start: `${fyStartYear + 1}-04-01`, end: `${fyStartYear + 1}-06-30` }, // Q4
      ];

      // Fetch BAS report for each quarter
      for (const quarter of quarters) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- getReportBASorGST not typed in xero-node SDK
          const response = await (xeroClient.accountingApi as any).getReportBASorGST(
            tenantId,
            'BASREPORT', // reportID
            quarter.start,
            quarter.end
          );

          if (response.body.reports && response.body.reports.length > 0) {
            const xeroBAS = response.body.reports[0];
            const normalized = normalizeBAS(xeroBAS, quarter.start, quarter.end);
            basReports.push(normalized);
          }
        } catch (error) {
          // Quarter may not have data yet (future quarter), continue
          console.warn(`No BAS data for quarter ${quarter.start} to ${quarter.end}:`, error);
        }
      }
    } else {
      // Fetch most recent BAS period (current quarter or last completed quarter)
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12

      // Determine current Australian financial year
      let fyStartYear = currentYear;
      if (currentMonth < 7) {
        fyStartYear = currentYear - 1; // Before July = previous FY
      }

      // Determine current quarter
      let quarterStart: string;
      let quarterEnd: string;

      if (currentMonth >= 7 && currentMonth <= 9) {
        // Q1: Jul-Sep
        quarterStart = `${fyStartYear}-07-01`;
        quarterEnd = `${fyStartYear}-09-30`;
      } else if (currentMonth >= 10 && currentMonth <= 12) {
        // Q2: Oct-Dec
        quarterStart = `${fyStartYear}-10-01`;
        quarterEnd = `${fyStartYear}-12-31`;
      } else if (currentMonth >= 1 && currentMonth <= 3) {
        // Q3: Jan-Mar
        quarterStart = `${fyStartYear + 1}-01-01`;
        quarterEnd = `${fyStartYear + 1}-03-31`;
      } else {
        // Q4: Apr-Jun
        quarterStart = `${fyStartYear + 1}-04-01`;
        quarterEnd = `${fyStartYear + 1}-06-30`;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- getReportBASorGST not typed in xero-node SDK
        const response = await (xeroClient.accountingApi as any).getReportBASorGST(
          tenantId,
          'BASREPORT',
          quarterStart,
          quarterEnd
        );

        if (response.body.reports && response.body.reports.length > 0) {
          const xeroBAS = response.body.reports[0];
          const normalized = normalizeBAS(xeroBAS, quarterStart, quarterEnd);
          basReports.push(normalized);
        }
      } catch (error) {
        console.warn(`No BAS data for current quarter ${quarterStart} to ${quarterEnd}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      count: basReports.length,
      tenantId,
      basReports,
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'xero_accounting_api',
        apiVersion: '2.0',
        reportYear: reportYear || 'current',
      },
    });
  } catch (error) {
    console.error('Error fetching Xero BAS reports:', error);

    // Handle Xero API errors
    if (error instanceof Error && error.message.includes('accounting.reports.read')) {
      return createErrorResponse(
        new Error(
          'Missing accounting.reports.read OAuth scope. Please reconnect your Xero account to grant reports access.'
        ),
        { operation: 'fetchBAS' },
        403
      );
    }

    return createErrorResponse(
      error,
      {
        operation: 'fetchBAS',
        endpoint: '/api/xero/bas',
      },
      500
    );
  }
}

/**
 * Normalize Xero BAS report to ATODE internal format
 */
function normalizeBAS(
  xeroBAS: XeroBASReport,
  periodStart: string,
  periodEnd: string
): NormalizedBAS {
  // Extract field values from Xero BAS report
  // Xero BAS report has fields array with fieldID and value
  const getField = (fieldID: string): number | undefined => {
    const field = xeroBAS.fields?.find(f => f.fieldID === fieldID);
    return field ? field.value : undefined;
  };

  // Map Xero field IDs to BAS fields
  // Note: Actual Xero field IDs may differ - adjust based on API documentation
  const g1 = getField('G1'); // Total Sales
  const g2 = getField('G2'); // Export Sales
  const g3 = getField('G3'); // Other GST-free Sales
  const g4 = getField('G4'); // Input Taxed Sales
  const g10 = getField('G10'); // Capital Purchases
  const g11 = getField('G11'); // Non-Capital Purchases
  const w1 = getField('W1'); // Total Salary and Wages
  const w2 = getField('W2'); // Amounts Withheld
  const t1 = getField('T1'); // Instalment Income
  const t2 = getField('T2'); // Instalment Amount

  // Calculate GST
  const gstOnSales = g1 ? g1 / 11 : undefined; // G1 × 1/11
  const gstOnPurchases = (g10 || 0) + (g11 || 0) > 0 ? ((g10 || 0) + (g11 || 0)) / 11 : undefined; // (G10 + G11) × 1/11
  const netGST = gstOnSales && gstOnPurchases ? gstOnSales - gstOnPurchases : undefined;

  return {
    report_id: xeroBAS.reportID,
    period_start_date: periodStart,
    period_end_date: periodEnd,
    lodgement_date: undefined, // Xero doesn't provide lodgement date in report
    g1_total_sales: g1,
    g2_export_sales: g2,
    g3_other_gst_free_sales: g3,
    g4_input_taxed_sales: g4,
    g10_capital_purchases: g10,
    g11_non_capital_purchases: g11,
    w1_total_salary_wages: w1,
    w2_withheld_amounts: w2,
    t1_instalment_income: t1,
    t2_instalment_amount: t2,
    gst_on_sales: gstOnSales,
    gst_on_purchases: gstOnPurchases,
    net_gst: netGST,
    status: 'draft', // Assume draft unless confirmed lodged
  };
}
