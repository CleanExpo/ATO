/**
 * POST /api/analysis/fuel-tax-credits
 *
 * Analyze fuel purchases to identify potential Fuel Tax Credits.
 * Calculates eligible credits based on business use and fuel type.
 *
 * Body:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - financialYear: string (optional, "FY2024-25" format) - Specific FY to analyze
 *
 * Returns:
 * - Fuel tax credit analysis with credit calculations
 * - Data quality assessment
 * - BAS quarter breakdown
 *
 * Legislation: Fuel Tax Act 2006, ATO Fuel Tax Credit Rates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import {
  analyzeFuelTaxCredits,
  type FuelPurchase,
  type FuelTaxCreditAnalysis,
} from '@/lib/analysis/fuel-tax-credits-analyzer';

export const dynamic = 'force-dynamic';

// Fuel supplier keywords for identification
const FUEL_SUPPLIER_KEYWORDS = [
  'bp',
  'shell',
  'caltex',
  'ampol',
  'mobil',
  '7-eleven',
  'united petroleum',
  'metro petroleum',
  'coles express',
  'woolworths petrol',
  'costco fuel',
  'fuel',
  'petrol',
  'diesel',
  'servo',
  'service station',
];

// Account codes typically used for fuel expenses
const FUEL_ACCOUNT_CODES = ['461', '462', '463', '464', '465']; // Motor vehicle expenses

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

    // Step 1: Identify fuel purchases from transactions
    // Look for:
    // - Supplier names containing fuel keywords
    // - Account codes for motor vehicle/fuel expenses
    // - Descriptions containing fuel keywords

    let transactionsQuery = supabase
      .from('xero_transactions')
      .select('*')
      .eq('tenant_id', tenantId);

    // Apply financial year filter if specified
    if (financialYear) {
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
        message: 'No transactions found for analysis.',
        analyses: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          tenantId,
          financialYear: financialYear || 'all',
        },
      });
    }

    // Filter for fuel purchases
    const fuelTransactions = transactions.filter(txn => isFuelPurchase(txn));

    if (fuelTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No fuel purchases identified in transactions.',
        fuel_purchases_found: 0,
        analyses: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          tenantId,
          financialYear: financialYear || 'all',
        },
      });
    }

    // Step 2: Convert to FuelPurchase format
    const fuelPurchases: FuelPurchase[] = fuelTransactions.map(txn => convertToFuelPurchase(txn));

    // Step 3: Run fuel tax credit analysis
    const analyses: FuelTaxCreditAnalysis[] = await analyzeFuelTaxCredits(fuelPurchases);

    // Step 4: Calculate overall statistics
    const totalAnalyses = analyses.length;
    const totalCredits = analyses.reduce((sum, a) => sum + a.total_credits_claimable, 0);
    const totalPurchases = analyses.reduce((sum, a) => sum + a.total_fuel_purchases, 0);
    const avgDataQuality = analyses.length > 0
      ? analyses.reduce((sum, a) => sum + a.data_quality_score, 0) / analyses.length
      : 0;

    return NextResponse.json({
      success: true,
      fuel_purchases_found: totalPurchases,
      analyses,
      summary: {
        total_analyses: totalAnalyses,
        total_fuel_purchases: totalPurchases,
        total_credits_claimable: totalCredits,
        average_data_quality: Math.round(avgDataQuality),
        professional_review_required: analyses.some(a => a.professional_review_required),
      },
      metadata: {
        analyzedAt: new Date().toISOString(),
        tenantId,
        financialYear: financialYear || 'all',
        legislation: 'Fuel Tax Act 2006',
        credit_rates: {
          diesel: '$0.479/L',
          petrol: '$0.479/L',
          lpg: '$0.198/L',
          source: 'ATO Fuel Tax Credit Rates FY2024-25',
        },
      },
    });
  } catch (error) {
    console.error('Error analyzing fuel tax credits:', error);

    return createErrorResponse(
      error,
      {
        operation: 'analyzeFuelTaxCredits',
        endpoint: '/api/analysis/fuel-tax-credits',
      },
      500
    );
  }
}

/**
 * Determine if transaction is a fuel purchase
 */
function isFuelPurchase(transaction: any): boolean {
  // Check supplier name
  const supplierName = (transaction.contact_name || '').toLowerCase();
  if (FUEL_SUPPLIER_KEYWORDS.some(keyword => supplierName.includes(keyword))) {
    return true;
  }

  // Check description
  const description = (transaction.description || '').toLowerCase();
  if (FUEL_SUPPLIER_KEYWORDS.some(keyword => description.includes(keyword))) {
    return true;
  }

  // Check account code (if available)
  const accountCode = transaction.account_code || '';
  if (FUEL_ACCOUNT_CODES.some(code => accountCode.startsWith(code))) {
    return true;
  }

  return false;
}

/**
 * Convert Xero transaction to FuelPurchase format
 */
function convertToFuelPurchase(transaction: any): FuelPurchase {
  const totalAmount = Math.abs(transaction.amount || transaction.total || 0);

  // Determine fuel type from description (simplified)
  let fuelType: 'diesel' | 'petrol' | 'lpg' | 'unknown' = 'unknown';
  const desc = (transaction.description || '').toLowerCase();
  if (desc.includes('diesel')) {
    fuelType = 'diesel';
  } else if (desc.includes('petrol') || desc.includes('unleaded') || desc.includes('premium')) {
    fuelType = 'petrol';
  } else if (desc.includes('lpg') || desc.includes('autogas')) {
    fuelType = 'lpg';
  }

  // Extract litres from description if present (e.g., "45.5L")
  const litresMatch = desc.match(/(\d+\.?\d*)\s*l/i);
  const fuelLitres = litresMatch ? parseFloat(litresMatch[1]) : undefined;

  // Assume 100% business use unless indicated otherwise
  // In production, this would come from logbook data or user input
  const businessUsePercentage = 100;

  // Assume off-road use if description contains heavy vehicle/machinery keywords
  const isOffRoadUse = desc.includes('truck') ||
    desc.includes('machinery') ||
    desc.includes('farm') ||
    desc.includes('tractor') ||
    desc.includes('excavator');

  // Assume has tax invoice if transaction is from accounting system
  const hasValidTaxInvoice = true;

  // Determine financial year
  const txnDate = new Date(transaction.transaction_date);
  const fy = determineFY(txnDate);

  return {
    transaction_id: transaction.transaction_id,
    transaction_date: transaction.transaction_date,
    supplier_name: transaction.contact_name || 'Unknown Supplier',
    supplier_id: transaction.contact_id,
    description: transaction.description,
    total_amount: totalAmount,
    fuel_litres: fuelLitres,
    fuel_type: fuelType,
    business_use_percentage: businessUsePercentage,
    is_off_road_use: isOffRoadUse,
    has_valid_tax_invoice: hasValidTaxInvoice,
    financial_year: fy,
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
