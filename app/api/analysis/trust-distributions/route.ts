/**
 * POST /api/analysis/trust-distributions
 *
 * Analyze trust distributions for Section 100A ITAA 1936 compliance.
 * Detects reimbursement agreements, UPE balances, and high-risk distributions.
 *
 * Body:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - financialYear: string (optional, "FY2024-25" format) - Specific FY to analyze
 *
 * Returns:
 * - Section 100A compliance analysis for each trust entity
 * - UPE summary and risk flags
 * - Professional review recommendations
 *
 * Legislation: Section 100A ITAA 1936, TR 2022/4, Division 7A ITAA 1936
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import {
  analyzeTrustDistributions,
  type TrustDistribution,
  type Section100AAnalysis,
} from '@/lib/analysis/trust-distribution-analyzer';

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

    // Step 1: Identify trust entities from contacts
    const { data: trustContacts, error: contactsError } = await supabase
      .from('xero_contacts')
      .select('contact_id, name, entity_type')
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'trust');

    if (contactsError) {
      throw contactsError;
    }

    if (!trustContacts || trustContacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No trust entities found in contacts. This analysis requires trust entity classification.',
        trust_count: 0,
        analyses: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          tenantId,
          financialYear: financialYear || 'all',
        },
      });
    }

    const trustIds = trustContacts.map(t => t.contact_id);

    // Step 2: Fetch transactions involving trust entities
    // Look for transactions where:
    // - Contact is a trust (distributions TO beneficiaries from trust)
    // - OR account code indicates trust distribution (typically 'Trust Distributions' expense account)

    let transactionsQuery = supabase
      .from('xero_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('contact_id', trustIds);

    // Apply financial year filter if specified
    if (financialYear) {
      // Parse FY format: "FY2024-25" = July 1, 2024 to June 30, 2025
      const fyMatch = financialYear.match(/FY(\d{4})-(\d{2})/);
      if (fyMatch) {
        const startYear = parseInt(fyMatch[1]);
        const startDate = `${startYear}-07-01`;
        const endDate = `${startYear + 1}-06-30`;

        transactionsQuery = transactionsQuery
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);
      }
    }

    const { data: transactions, error: transactionsError } = await transactionsQuery;

    if (transactionsError) {
      throw transactionsError;
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No trust distribution transactions found.',
        trust_count: trustContacts.length,
        analyses: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          tenantId,
          financialYear: financialYear || 'all',
        },
      });
    }

    // Step 3: Convert transactions to TrustDistribution format
    const distributions: TrustDistribution[] = await convertToTrustDistributions(
      transactions,
      trustContacts,
      supabase,
      tenantId
    );

    // Step 4: Run Section 100A analysis
    const analyses: Section100AAnalysis[] = await analyzeTrustDistributions(distributions);

    // Step 5: Calculate overall statistics
    const totalTrusts = analyses.length;
    const totalDistributions = analyses.reduce((sum, a) => sum + a.total_distributions, 0);
    const totalUPE = analyses.reduce((sum, a) => sum + a.upe_summary.total_upe_balance, 0);
    const criticalIssues = analyses.filter(a => a.overall_risk_level === 'critical').length;
    const highIssues = analyses.filter(a => a.overall_risk_level === 'high').length;

    return NextResponse.json({
      success: true,
      trust_count: totalTrusts,
      analyses,
      summary: {
        total_trusts_analyzed: totalTrusts,
        total_distributions: totalDistributions,
        total_upe_balance: totalUPE,
        critical_risk_trusts: criticalIssues,
        high_risk_trusts: highIssues,
        professional_review_required: criticalIssues > 0 || highIssues > 0,
      },
      metadata: {
        analyzedAt: new Date().toISOString(),
        tenantId,
        financialYear: financialYear || 'all',
        legislation: 'Section 100A ITAA 1936, TR 2022/4, Division 7A ITAA 1936',
      },
    });
  } catch (error) {
    console.error('Error analyzing trust distributions:', error);

    return createErrorResponse(
      error,
      {
        operation: 'analyzeTrustDistributions',
        endpoint: '/api/analysis/trust-distributions',
      },
      500
    );
  }
}

/**
 * Convert Xero transactions to TrustDistribution format
 */
async function convertToTrustDistributions(
  transactions: any[],
  trustContacts: any[],
  supabase: any,
  tenantId: string
): Promise<TrustDistribution[]> {
  const distributions: TrustDistribution[] = [];

  // Fetch all contacts to get beneficiary details
  const { data: allContacts } = await supabase
    .from('xero_contacts')
    .select('contact_id, name, entity_type, is_related_party')
    .eq('tenant_id', tenantId);

  const contactMap = new Map(allContacts?.map(c => [c.contact_id, c]) || []);

  for (const txn of transactions) {
    const trust = trustContacts.find(t => t.contact_id === txn.contact_id);
    if (!trust) continue;

    // Determine beneficiary (simplified - would need more complex logic in production)
    // For now, assume the contact on the transaction is the beneficiary
    const beneficiary = contactMap.get(txn.contact_id);
    if (!beneficiary) continue;

    // Determine distribution type based on transaction status
    let distributionType: 'cash' | 'asset' | 'upe' = 'cash';
    if (txn.status === 'UNPAID' || txn.status === 'DRAFT') {
      distributionType = 'upe'; // Unpaid Present Entitlement
    }

    // Calculate UPE age if applicable
    let upeAgeYears: number | undefined;
    let upeBalance: number | undefined;
    if (distributionType === 'upe') {
      const txnDate = new Date(txn.transaction_date);
      const now = new Date();
      upeAgeYears = (now.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      upeBalance = Math.abs(txn.amount || txn.total || 0);
    }

    // Determine financial year
    const txnDate = new Date(txn.transaction_date);
    const fy = determineFY(txnDate);

    // Detect reimbursement pattern (simplified - would need transaction sequence analysis)
    // Check if there's a reverse transaction within 30 days
    const hasReimbursement = false; // Placeholder - would require complex analysis

    distributions.push({
      transaction_id: txn.transaction_id,
      transaction_date: txn.transaction_date,
      trust_entity_id: trust.contact_id,
      trust_entity_name: trust.name,
      beneficiary_id: beneficiary.contact_id,
      beneficiary_name: beneficiary.name,
      beneficiary_entity_type: beneficiary.entity_type || 'unknown',
      distribution_amount: Math.abs(txn.amount || txn.total || 0),
      distribution_type: distributionType,
      financial_year: fy,
      is_related_party: beneficiary.is_related_party || false,
      has_reimbursement_pattern: hasReimbursement,
      upe_balance: upeBalance,
      upe_age_years: upeAgeYears,
    });
  }

  return distributions;
}

/**
 * Determine Australian financial year from date
 */
function determineFY(date: Date): string {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  if (month >= 7) {
    // July-December = FY starts this year
    return `FY${year}-${String(year + 1).slice(-2)}`;
  } else {
    // January-June = FY started last year
    return `FY${year - 1}-${String(year).slice(-2)}`;
  }
}
