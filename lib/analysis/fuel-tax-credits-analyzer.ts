/**
 * Fuel Tax Credits Analyzer
 *
 * Analyzes fuel purchases to identify potential Fuel Tax Credits under Fuel Tax Act 2006.
 * Calculates eligible credits based on business use and fuel type.
 *
 * Legislation:
 * - Fuel Tax Act 2006
 * - Fuel Tax (Consequential and Transitional Provisions) Act 2006
 * - ATO Fuel Tax Credit Rates (updated quarterly)
 *
 * Triggers:
 * - Fuel purchases in expense transactions
 * - Supplier names containing fuel keywords
 * - Account codes for fuel/motor vehicle expenses
 *
 * Eligibility Criteria:
 * - Fuel used in carrying on business (Section 41-5)
 * - Excludes fuel used in light vehicles on public roads (< 4.5 tonnes GVM)
 * - Must hold valid tax invoice
 * - Must be registered for GST
 *
 * Fuel Tax Credit Rates (FY2024-25):
 * - Diesel: $0.479 per litre
 * - Petrol: $0.479 per litre
 * - LPG: $0.198 per litre
 */

import { Decimal } from 'decimal.js';

// Fuel purchase transaction
export interface FuelPurchase {
  transaction_id: string;
  transaction_date: string;
  supplier_name: string;
  supplier_id?: string;
  description?: string;

  // Purchase details
  total_amount: number; // Including GST
  fuel_litres?: number; // Extracted from description or estimated
  fuel_type?: 'diesel' | 'petrol' | 'lpg' | 'unknown';

  // Business use
  business_use_percentage: number; // 0-100
  is_off_road_use: boolean; // Heavy vehicles, machinery, farming

  // Tax invoice
  has_valid_tax_invoice: boolean;

  financial_year: string;
}

// Fuel tax credit calculation
export interface FuelTaxCreditCalculation {
  fuel_purchase_id: string;
  transaction_date: string;
  supplier_name: string;

  fuel_litres: number;
  fuel_type: string;
  credit_rate_per_litre: number; // ATO rate for FY

  total_purchase_amount: number;
  business_use_percentage: number;
  business_fuel_litres: number; // fuel_litres × business_use_percentage

  // Eligibility
  is_eligible: boolean;
  ineligibility_reasons: string[];

  // Credit calculation
  gross_credit: number; // business_fuel_litres × credit_rate_per_litre
  gst_adjustment: number; // Credit is GST-exclusive
  net_credit_claimable: number;

  confidence_level: 'high' | 'medium' | 'low';
  requires_verification: boolean;
}

// Overall fuel tax credit analysis
export interface FuelTaxCreditAnalysis {
  tenant_id: string;
  financial_year: string;

  total_fuel_purchases: number;
  total_fuel_expenditure: number;
  eligible_purchases: number;
  ineligible_purchases: number;

  fuel_breakdown_by_type: Array<{
    fuel_type: string;
    litres: number;
    expenditure: number;
    credit_claimable: number;
  }>;

  calculations: FuelTaxCreditCalculation[];

  total_credits_claimable: number;
  total_credits_by_quarter: Array<{
    quarter: string; // "Q1 FY2024-25"
    credit_amount: number;
  }>;

  data_quality_score: number; // 0-100 (based on invoice availability, litre data completeness)
  missing_data_flags: string[];

  recommendations: string[];
  professional_review_required: boolean;

  compliance_summary: string;
}

/**
 * Current fuel tax credit rates (FY2024-25)
 * Source: ATO Fuel Tax Credit Calculator
 * Updated quarterly
 */
const FUEL_TAX_CREDIT_RATES_FY2024_25 = {
  diesel: new Decimal('0.479'), // $0.479/L
  petrol: new Decimal('0.479'), // $0.479/L
  lpg: new Decimal('0.198'), // $0.198/L
};

/**
 * Analyze fuel purchases for fuel tax credits
 */
export async function analyzeFuelTaxCredits(
  purchases: FuelPurchase[]
): Promise<FuelTaxCreditAnalysis[]> {
  // Group by tenant and financial year
  const groups = groupPurchasesByTenantAndFY(purchases);

  const analyses: FuelTaxCreditAnalysis[] = [];

  for (const [key, groupPurchases] of groups.entries()) {
    const [tenantId, fy] = key.split('||');

    const analysis = analyzeOneTenant(tenantId, fy, groupPurchases);
    analyses.push(analysis);
  }

  return analyses;
}

/**
 * Group purchases by tenant and financial year
 */
function groupPurchasesByTenantAndFY(
  purchases: FuelPurchase[]
): Map<string, FuelPurchase[]> {
  const groups = new Map<string, FuelPurchase[]>();

  for (const purchase of purchases) {
    // Tenant ID would come from context - for now use 'default'
    const key = `default||${purchase.financial_year}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(purchase);
  }

  return groups;
}

/**
 * Analyze fuel purchases for one tenant and FY
 */
function analyzeOneTenant(
  tenantId: string,
  fy: string,
  purchases: FuelPurchase[]
): FuelTaxCreditAnalysis {
  const calculations: FuelTaxCreditCalculation[] = [];

  let eligibleCount = 0;
  let ineligibleCount = 0;

  for (const purchase of purchases) {
    const calc = calculateFuelTaxCredit(purchase, fy);
    calculations.push(calc);

    if (calc.is_eligible) {
      eligibleCount++;
    } else {
      ineligibleCount++;
    }
  }

  // Calculate totals
  const totalFuelPurchases = purchases.length;
  const totalFuelExpenditure = purchases.reduce((sum, p) => sum + p.total_amount, 0);
  const totalCreditsClaimable = calculations.reduce((sum, c) => sum + c.net_credit_claimable, 0);

  // Breakdown by fuel type
  const fuelTypeMap = new Map<string, { litres: number; expenditure: number; credit: number }>();

  for (const calc of calculations) {
    const type = calc.fuel_type;
    if (!fuelTypeMap.has(type)) {
      fuelTypeMap.set(type, { litres: 0, expenditure: 0, credit: 0 });
    }

    const entry = fuelTypeMap.get(type)!;
    entry.litres += calc.fuel_litres;
    entry.expenditure += calc.total_purchase_amount;
    entry.credit += calc.net_credit_claimable;
  }

  const fuelBreakdown = Array.from(fuelTypeMap.entries()).map(([type, data]) => ({
    fuel_type: type,
    litres: data.litres,
    expenditure: data.expenditure,
    credit_claimable: data.credit,
  }));

  // Credits by quarter
  const creditsByQuarter = calculateCreditsByQuarter(calculations, fy);

  // Data quality assessment
  const { dataQualityScore, missingDataFlags } = assessDataQuality(purchases, calculations);

  // Recommendations
  const recommendations = generateRecommendations(
    totalCreditsClaimable,
    eligibleCount,
    ineligibleCount,
    missingDataFlags
  );

  // Professional review required if credits > $10,000 or data quality < 70%
  const professionalReviewRequired = totalCreditsClaimable > 10000 || dataQualityScore < 70;

  // Compliance summary
  const complianceSummary = generateComplianceSummary(
    fy,
    totalCreditsClaimable,
    eligibleCount,
    ineligibleCount,
    dataQualityScore
  );

  return {
    tenant_id: tenantId,
    financial_year: fy,
    total_fuel_purchases: totalFuelPurchases,
    total_fuel_expenditure: totalFuelExpenditure,
    eligible_purchases: eligibleCount,
    ineligible_purchases: ineligibleCount,
    fuel_breakdown_by_type: fuelBreakdown,
    calculations,
    total_credits_claimable: totalCreditsClaimable,
    total_credits_by_quarter: creditsByQuarter,
    data_quality_score: dataQualityScore,
    missing_data_flags: missingDataFlags,
    recommendations,
    professional_review_required: professionalReviewRequired,
    compliance_summary: complianceSummary,
  };
}

/**
 * Calculate fuel tax credit for one purchase
 */
function calculateFuelTaxCredit(
  purchase: FuelPurchase,
  _fy: string
): FuelTaxCreditCalculation {
  const ineligibilityReasons: string[] = [];
  let isEligible = true;

  // Check eligibility criteria
  if (!purchase.has_valid_tax_invoice) {
    isEligible = false;
    ineligibilityReasons.push('No valid tax invoice (required under Fuel Tax Act 2006)');
  }

  if (purchase.business_use_percentage === 0) {
    isEligible = false;
    ineligibilityReasons.push('No business use claimed (personal use ineligible)');
  }

  if (!purchase.is_off_road_use && purchase.fuel_type === 'petrol') {
    // Petrol for light vehicles on public roads is ineligible
    isEligible = false;
    ineligibilityReasons.push('Petrol for light vehicles on public roads (< 4.5t GVM) is ineligible');
  }

  // Estimate litres if not provided
  let fuelLitres = purchase.fuel_litres || 0;
  if (fuelLitres === 0) {
    // Estimate from total amount: assume $2.00/L average price
    fuelLitres = purchase.total_amount / 2.0;
    ineligibilityReasons.push('Fuel litres estimated from transaction amount (requires verification)');
  }

  // Get credit rate for fuel type
  const fuelType = purchase.fuel_type || 'unknown';
  let creditRatePerLitre = 0;

  if (fuelType === 'diesel') {
    creditRatePerLitre = FUEL_TAX_CREDIT_RATES_FY2024_25.diesel.toNumber();
  } else if (fuelType === 'petrol') {
    creditRatePerLitre = FUEL_TAX_CREDIT_RATES_FY2024_25.petrol.toNumber();
  } else if (fuelType === 'lpg') {
    creditRatePerLitre = FUEL_TAX_CREDIT_RATES_FY2024_25.lpg.toNumber();
  } else {
    isEligible = false;
    ineligibilityReasons.push('Unknown fuel type (cannot determine credit rate)');
  }

  // Calculate business fuel litres
  const businessUseDecimal = new Decimal(purchase.business_use_percentage).div(100);
  const businessFuelLitres = new Decimal(fuelLitres).times(businessUseDecimal).toNumber();

  // Calculate gross credit
  const grossCredit = new Decimal(businessFuelLitres)
    .times(creditRatePerLitre)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();

  // GST adjustment (fuel tax credits are GST-exclusive)
  // No adjustment needed as credit is separate from GST
  const gstAdjustment = 0;

  // Net credit claimable
  const netCreditClaimable = isEligible ? grossCredit : 0;

  // Confidence level
  let confidenceLevel: 'high' | 'medium' | 'low' = 'high';
  if (!purchase.fuel_litres) {
    confidenceLevel = 'low'; // Estimated litres
  } else if (purchase.fuel_type === 'unknown') {
    confidenceLevel = 'low';
  } else if (purchase.business_use_percentage < 100) {
    confidenceLevel = 'medium'; // Requires logbook validation
  }

  const requiresVerification = confidenceLevel === 'low' || !purchase.has_valid_tax_invoice;

  return {
    fuel_purchase_id: purchase.transaction_id,
    transaction_date: purchase.transaction_date,
    supplier_name: purchase.supplier_name,
    fuel_litres: fuelLitres,
    fuel_type: fuelType,
    credit_rate_per_litre: creditRatePerLitre,
    total_purchase_amount: purchase.total_amount,
    business_use_percentage: purchase.business_use_percentage,
    business_fuel_litres: businessFuelLitres,
    is_eligible: isEligible,
    ineligibility_reasons: ineligibilityReasons,
    gross_credit: grossCredit,
    gst_adjustment: gstAdjustment,
    net_credit_claimable: netCreditClaimable,
    confidence_level: confidenceLevel,
    requires_verification: requiresVerification,
  };
}

/**
 * Calculate credits by BAS quarter
 */
function calculateCreditsByQuarter(
  calculations: FuelTaxCreditCalculation[],
  fy: string
): Array<{ quarter: string; credit_amount: number }> {
  const _quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const fyStartYear = parseInt(fy.match(/FY(\d{4})/)?.[1] || '2024');

  const quarterRanges = [
    { q: 'Q1', start: `${fyStartYear}-07-01`, end: `${fyStartYear}-09-30` },
    { q: 'Q2', start: `${fyStartYear}-10-01`, end: `${fyStartYear}-12-31` },
    { q: 'Q3', start: `${fyStartYear + 1}-01-01`, end: `${fyStartYear + 1}-03-31` },
    { q: 'Q4', start: `${fyStartYear + 1}-04-01`, end: `${fyStartYear + 1}-06-30` },
  ];

  const creditsByQuarter = quarterRanges.map(qr => {
    const creditsInQuarter = calculations
      .filter(c => c.transaction_date >= qr.start && c.transaction_date <= qr.end)
      .reduce((sum, c) => sum + c.net_credit_claimable, 0);

    return {
      quarter: `${qr.q} ${fy}`,
      credit_amount: creditsInQuarter,
    };
  });

  return creditsByQuarter;
}

/**
 * Assess data quality
 */
function assessDataQuality(
  purchases: FuelPurchase[],
  _calculations: FuelTaxCreditCalculation[]
): { dataQualityScore: number; missingDataFlags: string[] } {
  const missingDataFlags: string[] = [];

  // Check for tax invoices
  const withInvoices = purchases.filter(p => p.has_valid_tax_invoice).length;
  const invoiceRate = purchases.length > 0 ? withInvoices / purchases.length : 0;

  if (invoiceRate < 1) {
    missingDataFlags.push(`${((1 - invoiceRate) * 100).toFixed(0)}% of purchases missing valid tax invoice`);
  }

  // Check for fuel litres data
  const withLitres = purchases.filter(p => p.fuel_litres && p.fuel_litres > 0).length;
  const litresRate = purchases.length > 0 ? withLitres / purchases.length : 0;

  if (litresRate < 1) {
    missingDataFlags.push(`${((1 - litresRate) * 100).toFixed(0)}% of purchases missing fuel litres data (estimated)`);
  }

  // Check for fuel type data
  const withFuelType = purchases.filter(p => p.fuel_type && p.fuel_type !== 'unknown').length;
  const fuelTypeRate = purchases.length > 0 ? withFuelType / purchases.length : 0;

  if (fuelTypeRate < 1) {
    missingDataFlags.push(`${((1 - fuelTypeRate) * 100).toFixed(0)}% of purchases missing fuel type classification`);
  }

  // Calculate overall score
  const dataQualityScore = Math.round((invoiceRate * 0.5 + litresRate * 0.3 + fuelTypeRate * 0.2) * 100);

  return { dataQualityScore, missingDataFlags };
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  totalCredits: number,
  eligibleCount: number,
  ineligibleCount: number,
  missingDataFlags: string[]
): string[] {
  const recommendations: string[] = [];

  if (totalCredits > 10000) {
    recommendations.push(
      `High fuel tax credit value ($${totalCredits.toLocaleString()}): Recommend engaging tax advisor to review before lodging BAS.`
    );
  }

  if (totalCredits > 0) {
    recommendations.push(
      'Claim fuel tax credits on your BAS (GST/BAS form field 7D). Credits offset GST payable or generate refund.'
    );
  }

  if (missingDataFlags.length > 0) {
    recommendations.push(
      'Improve data quality: Request fuel dockets with litres from suppliers, maintain logbooks for business use percentage.'
    );
  }

  if (ineligibleCount > 0) {
    recommendations.push(
      `${ineligibleCount} ineligible purchases identified. Review for tax invoice requirements and business use classification.`
    );
  }

  recommendations.push(
    'Maintain fuel logbooks and tax invoices for 5 years (ATO record-keeping requirements).'
  );

  return recommendations;
}

/**
 * Generate compliance summary
 */
function generateComplianceSummary(
  fy: string,
  totalCredits: number,
  eligibleCount: number,
  ineligibleCount: number,
  dataQualityScore: number
): string {
  let summary = `Fuel Tax Credit Analysis for ${fy}: `;

  if (totalCredits === 0) {
    summary += 'No fuel tax credits identified. ';
  } else {
    summary += `Total credits claimable: $${totalCredits.toLocaleString()} from ${eligibleCount} eligible purchases. `;
  }

  if (ineligibleCount > 0) {
    summary += `${ineligibleCount} purchases ineligible (missing invoices, personal use, or light vehicle petrol). `;
  }

  summary += `Data quality score: ${dataQualityScore}%. `;

  if (dataQualityScore < 70) {
    summary += 'CAUTION: Low data quality. Verify fuel litres and obtain tax invoices before claiming.';
  } else {
    summary += 'Data quality sufficient for BAS lodgement.';
  }

  return summary;
}
