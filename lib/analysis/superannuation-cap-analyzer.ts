/**
 * Superannuation Cap Analyzer
 *
 * Analyzes superannuation contributions to identify potential Division 291 tax breaches.
 * Tracks concessional (pre-tax) super contributions against annual cap.
 *
 * Legislation:
 * - Division 291 ITAA 1997: Excess concessional contributions tax
 * - Superannuation Guarantee (Administration) Act 1992
 * - Income Tax Assessment (1997 Act) Regulation 2021
 *
 * Concessional Contributions Cap (FY2024-25): $30,000
 * Includes:
 * - Superannuation Guarantee (SG) contributions (11.5% from 1 July 2024)
 * - Salary sacrifice contributions
 * - Employer additional contributions
 *
 * Division 291 Tax:
 * - 15% tax on contributions within cap (taxed in super fund)
 * - 30% tax on contributions exceeding cap (additional 15% = Division 291 tax)
 */

import { Decimal } from 'decimal.js';

/**
 * Carry-forward concessional contribution allowance.
 * From FY2018-19, unused concessional cap amounts can be carried forward
 * for up to 5 years if total super balance < $500,000 (s 291-20 ITAA 1997).
 */
export interface CarryForwardAllowance {
  /** Financial year the unused amount is from */
  fromYear: string;
  /** Unused cap amount from that year */
  unusedAmount: number;
  /** Whether this year is within the 5-year carry-forward window */
  isWithinWindow: boolean;
}

// Superannuation contribution
export interface SuperContribution {
  employee_id: string;
  employee_name: string;
  contribution_date: string;
  contribution_amount: number;
  contribution_type: 'SG' | 'salary_sacrifice' | 'employer_additional';
  is_concessional: boolean; // Pre-tax (concessional) vs post-tax (non-concessional)
  financial_year: string;
  super_fund_id?: string;
  super_fund_name?: string;
  /** Total super balance (needed for carry-forward eligibility). Optional. */
  total_super_balance?: number;
  /** Prior year contributions for carry-forward calculation. Optional. */
  prior_year_contributions?: Record<string, number>;
}

// Employee super contribution summary
export interface EmployeeSuperSummary {
  employee_id: string;
  employee_name: string;
  financial_year: string;

  // Contribution breakdown
  total_concessional: number;
  sg_contributions: number;
  salary_sacrifice: number;
  employer_additional: number;

  // Cap analysis (including carry-forward)
  concessional_cap: number; // Base cap for this FY ($30,000 for FY2024-25)
  /** Effective cap including carry-forward allowance (s 291-20 ITAA 1997) */
  effective_cap: number;
  /** Carry-forward amounts from prior years (if eligible) */
  carry_forward_amounts: CarryForwardAllowance[];
  /** Total carry-forward available */
  total_carry_forward: number;
  /** Whether carry-forward is eligible (balance < $500K, FY2018-19 onwards) */
  carry_forward_eligible: boolean;
  cap_usage_percentage: number; // (total_concessional / effective_cap) × 100
  excess_contributions: number; // Amount over effective cap (triggers Division 291)

  // Division 291 tax
  division_291_tax_payable: number; // Excess × 15%
  breaches_cap: boolean;

  // Compliance flags
  warnings: string[];
  recommendations: string[];
}

// Overall superannuation cap analysis
export interface SuperannuationCapAnalysis {
  tenant_id: string;
  financial_year: string;

  total_employees_analyzed: number;
  employees_with_contributions: number;

  employee_summaries: EmployeeSuperSummary[];

  total_concessional_contributions: number;
  total_excess_contributions: number;
  total_division_291_tax: number;

  employees_breaching_cap: number;
  employees_approaching_cap: number; // >80% cap usage

  compliance_summary: string;
  professional_review_required: boolean;
  /** Source of the superannuation cap values used for this analysis */
  cap_source: string;
  /** Warning when using fallback cap values for an unconfirmed FY */
  cap_fallback_warning?: string;
}

/**
 * Superannuation contribution caps by financial year.
 *
 * Both concessional and non-concessional caps are tracked.
 * Source: ATO — Key super rates and thresholds
 * https://www.ato.gov.au/rates/key-superannuation-rates-and-thresholds/
 *
 * Division 291 ITAA 1997 (concessional caps)
 * Division 292 ITAA 1997 (non-concessional caps)
 */
const SUPER_CAPS: Record<string, { concessional: Decimal; nonConcessional: Decimal }> = {
  'FY2025-26': { concessional: new Decimal('30000'), nonConcessional: new Decimal('120000') }, // Confirmed
  'FY2024-25': { concessional: new Decimal('30000'), nonConcessional: new Decimal('120000') },
  'FY2023-24': { concessional: new Decimal('27500'), nonConcessional: new Decimal('110000') },
  'FY2022-23': { concessional: new Decimal('27500'), nonConcessional: new Decimal('110000') },
  'FY2021-22': { concessional: new Decimal('27500'), nonConcessional: new Decimal('110000') },
  'FY2020-21': { concessional: new Decimal('25000'), nonConcessional: new Decimal('100000') },
  'FY2019-20': { concessional: new Decimal('25000'), nonConcessional: new Decimal('100000') },
  'FY2018-19': { concessional: new Decimal('25000'), nonConcessional: new Decimal('100000') }, // Carry-forward starts from this FY
};

/** The most recent FY with confirmed cap values (used for fallback) */
const LATEST_CONFIRMED_FY = 'FY2025-26';

/**
 * Get superannuation caps for a given financial year with source attribution.
 *
 * Looks up confirmed caps for the given FY. If the FY is not found in
 * the known caps table (e.g. a future year), falls back to the latest
 * known values with a warning.
 *
 * @param financialYear - FY string in 'FY2024-25' format
 * @returns Caps, source attribution, and optional fallback warning
 */
export function getSuperCaps(financialYear: string): {
  concessional: Decimal;
  nonConcessional: Decimal;
  source: string;
  fallbackWarning?: string;
} {
  const caps = SUPER_CAPS[financialYear];

  if (caps) {
    return {
      concessional: caps.concessional,
      nonConcessional: caps.nonConcessional,
      source: `ATO confirmed caps for ${financialYear} (Division 291/292 ITAA 1997)`,
    };
  }

  // Fallback to latest known caps
  const latestCaps = SUPER_CAPS[LATEST_CONFIRMED_FY];
  return {
    concessional: latestCaps.concessional,
    nonConcessional: latestCaps.nonConcessional,
    source: `Fallback to ${LATEST_CONFIRMED_FY} caps (${financialYear} not yet confirmed)`,
    fallbackWarning:
      `Superannuation caps for ${financialYear} not yet confirmed. ` +
      `Using latest known values from ${LATEST_CONFIRMED_FY} ` +
      `(concessional: $${latestCaps.concessional.toFixed(0)}, ` +
      `non-concessional: $${latestCaps.nonConcessional.toFixed(0)}). ` +
      'Verify at ato.gov.au/rates/key-superannuation-rates-and-thresholds/',
  };
}

/**
 * Legacy accessor: concessional cap by FY (for carry-forward calculations).
 * Delegates to getSuperCaps() to maintain a single source of truth.
 */
function getConcessionalCapForFY(financialYear: string): Decimal {
  return getSuperCaps(financialYear).concessional;
}

// Carry-forward constants (s 291-20 ITAA 1997)
const CARRY_FORWARD_BALANCE_THRESHOLD = 500_000; // $500K total super balance
const CARRY_FORWARD_MAX_YEARS = 5; // Up to 5 prior years
const CARRY_FORWARD_START_FY = 'FY2018-19'; // Carry-forward available from this FY

/**
 * Division 291 additional tax rate (on excess contributions)
 */
const DIVISION_291_TAX_RATE = new Decimal('0.15'); // 15% (total 30% - 15% already paid in fund)

/**
 * Analyze superannuation contributions for cap breaches
 */
export async function analyzeSuperannuationCaps(
  contributions: SuperContribution[]
): Promise<SuperannuationCapAnalysis[]> {
  // Group by tenant and financial year
  const groups = groupContributionsByTenantAndFY(contributions);

  const analyses: SuperannuationCapAnalysis[] = [];

  for (const [key, groupContributions] of groups.entries()) {
    const [tenantId, fy] = key.split('||');

    const analysis = analyzeOneTenant(tenantId, fy, groupContributions);
    analyses.push(analysis);
  }

  return analyses;
}

/**
 * Group contributions by tenant and financial year
 */
function groupContributionsByTenantAndFY(
  contributions: SuperContribution[]
): Map<string, SuperContribution[]> {
  const groups = new Map<string, SuperContribution[]>();

  for (const contribution of contributions) {
    // Tenant ID would come from context - for now use 'default'
    const key = `default||${contribution.financial_year}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(contribution);
  }

  return groups;
}

/**
 * Analyze contributions for one tenant and FY
 */
function analyzeOneTenant(
  tenantId: string,
  fy: string,
  contributions: SuperContribution[]
): SuperannuationCapAnalysis {
  // Filter to concessional contributions only (Division 291 applies to concessional)
  const concessionalContributions = contributions.filter(c => c.is_concessional);

  // Group by employee
  const employeeMap = new Map<string, SuperContribution[]>();
  for (const contrib of concessionalContributions) {
    const key = contrib.employee_id;
    if (!employeeMap.has(key)) {
      employeeMap.set(key, []);
    }
    employeeMap.get(key)!.push(contrib);
  }

  // Analyze each employee
  const employeeSummaries: EmployeeSuperSummary[] = [];
  const superCaps = getSuperCaps(fy);
  const concessionalCap = superCaps.concessional;

  for (const [employeeId, employeeContribs] of employeeMap.entries()) {
    const summary = analyzeEmployee(employeeId, fy, employeeContribs, concessionalCap);
    employeeSummaries.push(summary);
  }

  // If using fallback caps, add warning to all employee summaries
  if (superCaps.fallbackWarning) {
    for (const summary of employeeSummaries) {
      summary.warnings.push(superCaps.fallbackWarning);
    }
  }

  // Calculate totals
  const totalEmployeesAnalyzed = employeeSummaries.length;
  const employeesWithContributions = employeeSummaries.filter(s => s.total_concessional > 0).length;

  const totalConcessionalContributions = employeeSummaries.reduce(
    (sum, s) => sum + s.total_concessional,
    0
  );
  const totalExcessContributions = employeeSummaries.reduce((sum, s) => sum + s.excess_contributions, 0);
  const totalDivision291Tax = employeeSummaries.reduce((sum, s) => sum + s.division_291_tax_payable, 0);

  const employeesBreachingCap = employeeSummaries.filter(s => s.breaches_cap).length;
  const employeesApproachingCap = employeeSummaries.filter(
    s => !s.breaches_cap && s.cap_usage_percentage > 80
  ).length;

  // Compliance summary
  const complianceSummary = generateComplianceSummary(
    fy,
    totalEmployeesAnalyzed,
    employeesBreachingCap,
    employeesApproachingCap,
    totalDivision291Tax
  );

  // Professional review required if any cap breaches or using fallback caps
  const professionalReviewRequired = employeesBreachingCap > 0 || totalDivision291Tax > 0 || !!superCaps.fallbackWarning;

  return {
    tenant_id: tenantId,
    financial_year: fy,
    total_employees_analyzed: totalEmployeesAnalyzed,
    employees_with_contributions: employeesWithContributions,
    employee_summaries: employeeSummaries,
    total_concessional_contributions: totalConcessionalContributions,
    total_excess_contributions: totalExcessContributions,
    total_division_291_tax: totalDivision291Tax,
    employees_breaching_cap: employeesBreachingCap,
    employees_approaching_cap: employeesApproachingCap,
    compliance_summary: complianceSummary,
    professional_review_required: professionalReviewRequired,
    cap_source: superCaps.source,
    cap_fallback_warning: superCaps.fallbackWarning,
  };
}

/**
 * Analyze one employee's contributions
 */
/**
 * Calculate carry-forward allowance for an employee.
 * s 291-20 ITAA 1997: Unused concessional cap from up to 5 prior years
 * can be used if total super balance < $500,000 at 30 June of prior year.
 * Available from FY2018-19 onwards.
 */
function calculateCarryForward(
  fy: string,
  contributions: SuperContribution[],
  baseCap: Decimal
): { amounts: CarryForwardAllowance[]; totalCarryForward: number; eligible: boolean } {
  // Check if any contribution has balance data
  const balanceData = contributions.find(c => c.total_super_balance !== undefined);
  const totalBalance = balanceData?.total_super_balance;

  // Cannot apply carry-forward without balance data or if balance >= $500K
  if (totalBalance === undefined) {
    return {
      amounts: [],
      totalCarryForward: 0,
      eligible: false, // Unknown - no balance data
    };
  }

  if (totalBalance >= CARRY_FORWARD_BALANCE_THRESHOLD) {
    return {
      amounts: [],
      totalCarryForward: 0,
      eligible: false, // Balance too high
    };
  }

  // Get prior year contributions data
  const priorYearData = contributions.find(c => c.prior_year_contributions !== undefined);
  const priorContributions = priorYearData?.prior_year_contributions || {};

  // Calculate unused amounts from up to 5 prior years
  const fyMatch = fy.match(/^FY(\d{4})-(\d{2})$/);
  if (!fyMatch) return { amounts: [], totalCarryForward: 0, eligible: true };

  const fyStartYear = parseInt(fyMatch[1], 10);
  const amounts: CarryForwardAllowance[] = [];
  let totalCarryForward = 0;

  for (let i = 1; i <= CARRY_FORWARD_MAX_YEARS; i++) {
    const priorStartYear = fyStartYear - i;
    const priorEndShort = String(priorStartYear + 1).slice(-2);
    const priorFY = `FY${priorStartYear}-${priorEndShort}`;

    // Carry-forward only available from FY2018-19 onwards
    if (priorFY < CARRY_FORWARD_START_FY) continue;

    const priorCap = getConcessionalCapForFY(priorFY);
    const priorContrib = priorContributions[priorFY] || 0;
    const unused = Math.max(0, priorCap.toNumber() - priorContrib);

    if (unused > 0) {
      amounts.push({
        fromYear: priorFY,
        unusedAmount: unused,
        isWithinWindow: true,
      });
      totalCarryForward += unused;
    }
  }

  return { amounts, totalCarryForward, eligible: true };
}

function analyzeEmployee(
  employeeId: string,
  fy: string,
  contributions: SuperContribution[],
  concessionalCap: Decimal
): EmployeeSuperSummary {
  const employeeName = contributions[0]?.employee_name || 'Unknown Employee';

  // Calculate contribution breakdown
  const sgContributions = contributions
    .filter(c => c.contribution_type === 'SG')
    .reduce((sum, c) => sum + c.contribution_amount, 0);

  const salarySacrifice = contributions
    .filter(c => c.contribution_type === 'salary_sacrifice')
    .reduce((sum, c) => sum + c.contribution_amount, 0);

  const employerAdditional = contributions
    .filter(c => c.contribution_type === 'employer_additional')
    .reduce((sum, c) => sum + c.contribution_amount, 0);

  const totalConcessional = sgContributions + salarySacrifice + employerAdditional;

  // Calculate carry-forward allowance (s 291-20 ITAA 1997)
  const carryForward = calculateCarryForward(fy, contributions, concessionalCap);
  const effectiveCap = concessionalCap.toNumber() + carryForward.totalCarryForward;

  // Cap analysis using effective cap (base + carry-forward)
  const capUsagePercentage = effectiveCap > 0
    ? new Decimal(totalConcessional).div(new Decimal(effectiveCap)).times(100).toNumber()
    : 0;

  const excessContributions = Math.max(0, totalConcessional - effectiveCap);
  const breachesCap = excessContributions > 0;

  // Division 291 tax calculation
  const division291TaxPayable = breachesCap
    ? new Decimal(excessContributions)
        .times(DIVISION_291_TAX_RATE)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber()
    : 0;

  // Warnings and recommendations
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (breachesCap) {
    warnings.push(`Exceeded effective concessional cap by $${excessContributions.toLocaleString()}`);
    if (carryForward.totalCarryForward > 0) {
      warnings.push(`Cap included $${carryForward.totalCarryForward.toLocaleString()} carry-forward from prior years`);
    }
    warnings.push(`Division 291 tax of $${division291TaxPayable.toLocaleString()} will be assessed by ATO`);
    recommendations.push(
      'URGENT: Request release of excess contributions from super fund within 60 days of assessment notice to avoid higher tax rate.'
    );
    recommendations.push(
      'Reduce salary sacrifice or employer additional contributions for remainder of FY to avoid further excess.'
    );
  } else if (capUsagePercentage > 80) {
    warnings.push(`Approaching cap (${capUsagePercentage.toFixed(0)}% of $${effectiveCap.toLocaleString()} effective cap used)`);
    recommendations.push(
      `Monitor remaining contributions. Cap space available: $${(effectiveCap - totalConcessional).toLocaleString()}.`
    );
    recommendations.push(
      'Consider pausing salary sacrifice or employer additional contributions to stay within cap.'
    );
  }

  if (carryForward.eligible && carryForward.totalCarryForward > 0 && !breachesCap) {
    recommendations.push(
      `Carry-forward available: $${carryForward.totalCarryForward.toLocaleString()} from ${carryForward.amounts.length} prior year(s) (s 291-20 ITAA 1997). Consider additional contributions to utilise before expiry.`
    );
  }

  if (!carryForward.eligible && contributions.some(c => c.total_super_balance === undefined)) {
    recommendations.push(
      'Carry-forward eligibility unknown - provide total super balance to check s 291-20 carry-forward (requires balance < $500K).'
    );
  }

  if (salarySacrifice > 0 || employerAdditional > 0) {
    recommendations.push(
      'Review salary sacrifice agreements annually to ensure contributions stay within cap.'
    );
  }

  return {
    employee_id: employeeId,
    employee_name: employeeName,
    financial_year: fy,
    total_concessional: totalConcessional,
    sg_contributions: sgContributions,
    salary_sacrifice: salarySacrifice,
    employer_additional: employerAdditional,
    concessional_cap: concessionalCap.toNumber(),
    effective_cap: effectiveCap,
    carry_forward_amounts: carryForward.amounts,
    total_carry_forward: carryForward.totalCarryForward,
    carry_forward_eligible: carryForward.eligible,
    cap_usage_percentage: capUsagePercentage,
    excess_contributions: excessContributions,
    division_291_tax_payable: division291TaxPayable,
    breaches_cap: breachesCap,
    warnings,
    recommendations,
  };
}

/**
 * Generate compliance summary
 */
function generateComplianceSummary(
  fy: string,
  totalEmployees: number,
  breachingCount: number,
  approachingCount: number,
  totalTax: number
): string {
  let summary = `Superannuation Cap Analysis for ${fy}: `;

  if (breachingCount === 0) {
    summary += `All ${totalEmployees} employees within concessional contributions cap. `;
  } else {
    summary += `${breachingCount} employee(s) exceeded concessional cap. `;
    summary += `Division 291 tax payable: $${totalTax.toLocaleString()}. `;
  }

  if (approachingCount > 0) {
    summary += `${approachingCount} employee(s) approaching cap (>80% used). `;
  }

  if (breachingCount > 0) {
    summary += 'URGENT ACTION REQUIRED: Release excess contributions within 60 days of ATO assessment notice.';
  }

  return summary;
}
