/**
 * GET /api/tax-obligations
 *
 * Fetch tax obligations and compliance status
 * Calculates quarterly lodgement dates, compliance status,
 * and upcoming deadlines based on Xero data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/api/errors';
import Decimal from 'decimal.js';

interface TaxObligation {
  id: string;
  type: 'BAS' | 'PAYG' | 'ANNUAL_RETURN' | 'STP';
  period: string; // e.g., "Q1 FY2024-25"
  dueDate: string; // ISO date
  status: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'LODGED' | 'NOT_DUE';
  amount?: number; // Estimated amount
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface QuarterlySummary {
  quarter: string;
  gstCollected: number;
  gstPaid: number;
  payg: number;
  netPosition: number; // Positive = refund, Negative = pay
  transactionCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Get financial year dates
    const currentDate = new Date();
    const currentFY = getCurrentFinancialYear(currentDate);
    const fyStart = getFinancialYearStart(currentFY);
    const fyEnd = getFinancialYearEnd(currentFY);

    // Fetch transactions for quarterly summaries from the correct cache table
    const { data: transactions, error: fetchError } = await supabase
      .from('historical_transactions_cache')
      .select('transaction_type, transaction_date, total_amount, raw_data, financial_year')
      .eq('tenant_id', tenantId)
      .gte('transaction_date', fyStart.toISOString())
      .lte('transaction_date', fyEnd.toISOString())
      .order('transaction_date', { ascending: true });

    if (fetchError) {
      console.error('Failed to fetch transactions from cache:', fetchError);
      throw new Error(`Database error: ${fetchError.message}`);
    }

    // Calculate quarterly summaries
    const quarterlySummaries = calculateQuarterlySummaries(
      transactions || [],
      currentFY
    );

    // Generate tax obligations
    const obligations = generateTaxObligations(
      currentFY,
      quarterlySummaries,
      currentDate
    );

    // Calculate compliance metrics
    const complianceStatus = calculateComplianceStatus(obligations);

    // Get upcoming deadlines
    const upcomingDeadlines = obligations
      .filter(o => o.status === 'DUE_SOON' || o.status === 'OVERDUE')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        financialYear: currentFY,
        quarterlySummaries,
        obligations,
        complianceStatus,
        upcomingDeadlines,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching tax obligations:', error);
    return createErrorResponse(error, {
      operation: 'fetchTaxObligations'
    }, 500);
  }
}

/**
 * Get current Australian financial year
 */
function getCurrentFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11

  // Financial year starts July 1 (month 6)
  if (month >= 6) {
    // July-December: FY2024-25
    return `FY${year}-${String(year + 1).slice(2)}`;
  } else {
    // January-June: FY2023-24
    return `FY${year - 1}-${String(year).slice(2)}`;
  }
}

/**
 * Get financial year start date
 */
function getFinancialYearStart(fy: string): Date {
  const year = parseInt(fy.split('-')[0].replace('FY', ''));
  return new Date(year, 6, 1); // July 1
}

/**
 * Get financial year end date
 */
function getFinancialYearEnd(fy: string): Date {
  const year = parseInt(fy.split('-')[0].replace('FY', ''));
  return new Date(year + 1, 5, 30); // June 30
}

/**
 * Calculate quarterly GST summaries
 */
function calculateQuarterlySummaries(
  transactions: any[],
  fy: string
): QuarterlySummary[] {
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const summaries: QuarterlySummary[] = [];

  for (const quarter of quarters) {
    const [start, end] = getQuarterDates(fy, quarter);

    const quarterTransactions = transactions.filter(t => {
      const date = new Date(t.transaction_date);
      return date >= start && date <= end;
    });

    let gstCollected = new Decimal(0);
    let gstPaid = new Decimal(0);
    let payg = new Decimal(0);

    quarterTransactions.forEach(tx => {
      const raw = tx.raw_data || {};
      // Xero field names are often PascalCase in the API response
      const taxAmount = new Decimal(raw.TotalTax || raw.totalTax || raw.taxAmount || 0);
      const type = tx.transaction_type;

      if (type === 'ACCREC' || type === 'RECEIVE') {
        // GST collected on sales
        gstCollected = gstCollected.plus(taxAmount);
      } else if (type === 'ACCPAY' || type === 'SPEND') {
        // GST paid on purchases
        gstPaid = gstPaid.plus(taxAmount);
      }

      // PAYG withholding (if applicable)
      // Account 825 is usually PAYG Withholding Payable in standard Xero Chart of Accounts
      const isPaygAccount = raw.AccountCode === '825' ||
        raw.AccountCode === '820' ||
        (raw.LineItems && raw.LineItems.some((li: any) => li.AccountCode === '825' || li.AccountCode === '820')) ||
        raw.Description?.includes('PAYG') ||
        raw.Reference?.includes('PAYG') ||
        tx.transaction_type === 'PAYG'; // Some might be directly typed

      if (isPaygAccount) {
        payg = payg.plus(new Decimal(Math.abs(tx.total_amount || 0)));
      }
    });

    const netPosition = gstCollected.minus(gstPaid).minus(payg);

    summaries.push({
      quarter: `${quarter} ${fy}`,
      gstCollected: gstCollected.toNumber(),
      gstPaid: gstPaid.toNumber(),
      payg: payg.toNumber(),
      netPosition: netPosition.toNumber(),
      transactionCount: quarterTransactions.length
    });
  }

  return summaries;
}

/**
 * Get quarter start and end dates
 */
function getQuarterDates(fy: string, quarter: string): [Date, Date] {
  const year = parseInt(fy.split('-')[0].replace('FY', ''));

  switch (quarter) {
    case 'Q1': // Jul-Sep
      return [new Date(year, 6, 1), new Date(year, 8, 30)];
    case 'Q2': // Oct-Dec
      return [new Date(year, 9, 1), new Date(year, 11, 31)];
    case 'Q3': // Jan-Mar
      return [new Date(year + 1, 0, 1), new Date(year + 1, 2, 31)];
    case 'Q4': // Apr-Jun
      return [new Date(year + 1, 3, 1), new Date(year + 1, 5, 30)];
    default:
      throw new Error(`Invalid quarter: ${quarter}`);
  }
}

/**
 * Generate tax obligations for the financial year
 */
function generateTaxObligations(
  fy: string,
  summaries: QuarterlySummary[],
  currentDate: Date
): TaxObligation[] {
  const obligations: TaxObligation[] = [];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  // BAS obligations (quarterly)
  quarters.forEach((quarter, index) => {
    const summary = summaries[index];
    const dueDate = getBASDueDate(fy, quarter);
    const status = getObligationStatus(dueDate, currentDate);

    obligations.push({
      id: `BAS-${fy}-${quarter}`,
      type: 'BAS',
      period: `${quarter} ${fy}`,
      dueDate: dueDate.toISOString(),
      status,
      amount: Math.abs(summary.netPosition),
      description: `Business Activity Statement for ${quarter} ${fy}`,
      priority: status === 'OVERDUE' ? 'CRITICAL' : status === 'DUE_SOON' ? 'HIGH' : 'MEDIUM'
    });
  });

  // PAYG obligations (quarterly if applicable)
  quarters.forEach((quarter, index) => {
    const summary = summaries[index];
    if (summary.payg > 0) {
      const dueDate = getPAYGDueDate(fy, quarter);
      const status = getObligationStatus(dueDate, currentDate);

      obligations.push({
        id: `PAYG-${fy}-${quarter}`,
        type: 'PAYG',
        period: `${quarter} ${fy}`,
        dueDate: dueDate.toISOString(),
        status,
        amount: summary.payg,
        description: `PAYG Withholding for ${quarter} ${fy}`,
        priority: status === 'OVERDUE' ? 'CRITICAL' : status === 'DUE_SOON' ? 'HIGH' : 'LOW'
      });
    }
  });

  // Annual return
  const annualDueDate = getAnnualReturnDueDate(fy);
  const annualStatus = getObligationStatus(annualDueDate, currentDate);

  obligations.push({
    id: `ANNUAL-${fy}`,
    type: 'ANNUAL_RETURN',
    period: fy,
    dueDate: annualDueDate.toISOString(),
    status: annualStatus,
    description: `Company Tax Return for ${fy}`,
    priority: annualStatus === 'OVERDUE' ? 'CRITICAL' : annualStatus === 'DUE_SOON' ? 'HIGH' : 'LOW'
  });

  // STP reporting
  const stpDueDate = getSTPDueDate(fy);
  const stpStatus = getObligationStatus(stpDueDate, currentDate);

  obligations.push({
    id: `STP-${fy}`,
    type: 'STP',
    period: fy,
    dueDate: stpDueDate.toISOString(),
    status: stpStatus,
    description: `Single Touch Payroll finalization for ${fy}`,
    priority: stpStatus === 'OVERDUE' ? 'CRITICAL' : stpStatus === 'DUE_SOON' ? 'HIGH' : 'MEDIUM'
  });

  return obligations;
}

/**
 * Get BAS due date for a quarter
 * Due 28 days after quarter end (or next business day)
 */
function getBASDueDate(fy: string, quarter: string): Date {
  const [, end] = getQuarterDates(fy, quarter);
  const dueDate = new Date(end);
  dueDate.setDate(end.getDate() + 28);
  return dueDate;
}

/**
 * Get PAYG due date (same as BAS)
 */
function getPAYGDueDate(fy: string, quarter: string): Date {
  return getBASDueDate(fy, quarter);
}

/**
 * Get annual return due date
 * Due by 15th of 5th month after FY end (15 November)
 */
function getAnnualReturnDueDate(fy: string): Date {
  const fyEnd = getFinancialYearEnd(fy);
  return new Date(fyEnd.getFullYear(), 10, 15); // November 15
}

/**
 * Get STP finalization due date
 * Due by 14 July (14 days after FY end)
 */
function getSTPDueDate(fy: string): Date {
  const fyEnd = getFinancialYearEnd(fy);
  return new Date(fyEnd.getFullYear(), 6, 14); // July 14
}

/**
 * Determine obligation status based on due date
 */
function getObligationStatus(
  dueDate: Date,
  currentDate: Date
): TaxObligation['status'] {
  const daysUntilDue = Math.floor(
    (dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue <= 7) return 'DUE_SOON';
  if (daysUntilDue <= 30) return 'UPCOMING';
  return 'NOT_DUE';
}

/**
 * Calculate overall compliance status
 */
function calculateComplianceStatus(obligations: TaxObligation[]) {
  const overdue = obligations.filter(o => o.status === 'OVERDUE').length;
  const dueSoon = obligations.filter(o => o.status === 'DUE_SOON').length;
  const upcoming = obligations.filter(o => o.status === 'UPCOMING').length;
  const total = obligations.length;

  const complianceRate = ((total - overdue) / total) * 100;

  return {
    overdue,
    dueSoon,
    upcoming,
    total,
    complianceRate: Math.round(complianceRate),
    status: overdue > 0 ? 'AT_RISK' : dueSoon > 0 ? 'WARNING' : 'COMPLIANT'
  };
}
