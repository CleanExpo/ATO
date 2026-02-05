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

  // Cap analysis
  concessional_cap: number; // $30,000 for FY2024-25
  cap_usage_percentage: number; // (total_concessional / cap) × 100
  excess_contributions: number; // Amount over cap (triggers Division 291)

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
}

/**
 * Concessional contributions cap by financial year
 */
const CONCESSIONAL_CAP_BY_FY: Record<string, Decimal> = {
  'FY2024-25': new Decimal('30000'),
  'FY2023-24': new Decimal('27500'),
  'FY2022-23': new Decimal('27500'),
  'FY2021-22': new Decimal('27500'),
  'FY2020-21': new Decimal('25000'),
};

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
  const concessionalCap = CONCESSIONAL_CAP_BY_FY[fy] || new Decimal('30000');

  for (const [employeeId, employeeContribs] of employeeMap.entries()) {
    const summary = analyzeEmployee(employeeId, fy, employeeContribs, concessionalCap);
    employeeSummaries.push(summary);
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

  // Professional review required if any cap breaches
  const professionalReviewRequired = employeesBreachingCap > 0 || totalDivision291Tax > 0;

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
  };
}

/**
 * Analyze one employee's contributions
 */
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

  // Cap analysis
  const capUsagePercentage = concessionalCap.toNumber() > 0
    ? new Decimal(totalConcessional).div(concessionalCap).times(100).toNumber()
    : 0;

  const excessContributions = Math.max(0, totalConcessional - concessionalCap.toNumber());
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
    warnings.push(`Exceeded concessional cap by $${excessContributions.toLocaleString()}`);
    warnings.push(`Division 291 tax of $${division291TaxPayable.toLocaleString()} will be assessed by ATO`);
    recommendations.push(
      'URGENT: Request release of excess contributions from super fund within 60 days of assessment notice to avoid higher tax rate.'
    );
    recommendations.push(
      'Reduce salary sacrifice or employer additional contributions for remainder of FY to avoid further excess.'
    );
  } else if (capUsagePercentage > 80) {
    warnings.push(`Approaching cap (${capUsagePercentage.toFixed(0)}% of $${concessionalCap.toNumber().toLocaleString()} cap used)`);
    recommendations.push(
      `Monitor remaining contributions. Cap space available: $${(concessionalCap.toNumber() - totalConcessional).toLocaleString()}.`
    );
    recommendations.push(
      'Consider pausing salary sacrifice or employer additional contributions to stay within cap.'
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
