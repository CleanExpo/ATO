/**
 * Trust Distribution Analyzer
 *
 * Analyzes trust distributions to beneficiaries for Section 100A ITAA 1936 compliance.
 * Detects potential reimbursement agreements and tracks Unpaid Present Entitlements (UPE).
 *
 * Legislation:
 * - Section 100A ITAA 1936: Anti-avoidance rule for trust distributions
 * - TR 2022/4: ATO Taxation Ruling on Section 100A application
 *
 * Triggers:
 * - Trust distributions recorded in accounting system
 * - Beneficiary payments from trust entities
 * - UPE balances in contact accounts payable
 *
 * Red Flags:
 * - Distribution to low-tax beneficiary (company taxed at 25-30% vs individual at 45%)
 * - Immediate reimbursement/loan-back to trust
 * - Beneficiary is non-resident or minor
 * - UPE outstanding for >2 years (Division 7A implications)
 */


// Trust distribution transaction pattern
export interface TrustDistribution {
  transaction_id: string;
  transaction_date: string;
  trust_entity_id: string;
  trust_entity_name: string;
  beneficiary_id: string;
  beneficiary_name: string;
  beneficiary_entity_type: 'individual' | 'company' | 'trust' | 'partnership' | 'unknown';
  distribution_amount: number;
  distribution_type: 'cash' | 'asset' | 'upe'; // Cash paid, Asset transferred, Unpaid Present Entitlement
  financial_year: string;

  // Section 100A risk factors
  is_non_resident?: boolean;
  is_minor?: boolean; // Under 18 years old
  is_related_party?: boolean;
  has_reimbursement_pattern?: boolean; // Payment followed by loan-back within 30 days
  is_family_member?: boolean; // TR 2022/4: Family member for ordinary dealing exclusion

  // UPE tracking
  upe_balance?: number; // Outstanding unpaid entitlement
  upe_age_years?: number; // Years since distribution
}

// Section 100A analysis result
export interface Section100AAnalysis {
  trust_entity_id: string;
  trust_entity_name: string;
  financial_year: string;

  total_distributions: number;
  cash_distributions: number;
  upe_distributions: number;

  distributions_by_beneficiary: Array<{
    beneficiary_id: string;
    beneficiary_name: string;
    beneficiary_type: string;
    total_distributed: number;
    cash_paid: number;
    upe_balance: number;
    risk_score: number; // 0-100
    risk_factors: string[];
    familyDealingExclusion?: string; // TR 2022/4: Note if family dealing exclusion may apply
  }>;

  section_100a_flags: Array<{
    flag_type: 'reimbursement_agreement' | 'non_resident_distribution' | 'minor_distribution' | 'excessive_upe';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    beneficiary_id: string;
    beneficiary_name: string;
    amount: number;
    recommendation: string;
    familyDealingNote?: string; // TR 2022/4: Family dealing context for this flag
  }>;

  upe_summary: {
    total_upe_balance: number;
    beneficiaries_with_upe: number;
    aged_upe_over_2_years: number; // Triggers Division 7A
    aged_upe_amount: number;
  };

  overall_risk_level: 'critical' | 'high' | 'medium' | 'low';
  compliance_summary: string;
  professional_review_required: boolean;
}

/**
 * Analyze trust distributions for Section 100A compliance
 */
export async function analyzeTrustDistributions(
  distributions: TrustDistribution[]
): Promise<Section100AAnalysis[]> {
  // Group distributions by trust entity and financial year
  const trustGroups = groupDistributionsByTrust(distributions);

  const analyses: Section100AAnalysis[] = [];

  for (const [trustKey, trustDistributions] of trustGroups.entries()) {
    const [trustId, trustName, fy] = trustKey.split('||');

    const analysis = analyzeOneTrust(trustId, trustName, fy, trustDistributions);
    analyses.push(analysis);
  }

  return analyses;
}

/**
 * Group distributions by trust entity and financial year
 */
function groupDistributionsByTrust(
  distributions: TrustDistribution[]
): Map<string, TrustDistribution[]> {
  const groups = new Map<string, TrustDistribution[]>();

  for (const dist of distributions) {
    const key = `${dist.trust_entity_id}||${dist.trust_entity_name}||${dist.financial_year}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(dist);
  }

  return groups;
}

/**
 * Analyze one trust's distributions for a financial year
 */
function analyzeOneTrust(
  trustId: string,
  trustName: string,
  fy: string,
  distributions: TrustDistribution[]
): Section100AAnalysis {
  // Calculate totals
  const totalDistributions = distributions.reduce((sum, d) => sum + d.distribution_amount, 0);
  const cashDistributions = distributions
    .filter(d => d.distribution_type === 'cash')
    .reduce((sum, d) => sum + d.distribution_amount, 0);
  const upeDistributions = distributions
    .filter(d => d.distribution_type === 'upe')
    .reduce((sum, d) => sum + d.distribution_amount, 0);

  // Group by beneficiary
  const beneficiaryMap = new Map<string, TrustDistribution[]>();
  for (const dist of distributions) {
    const key = dist.beneficiary_id;
    if (!beneficiaryMap.has(key)) {
      beneficiaryMap.set(key, []);
    }
    beneficiaryMap.get(key)!.push(dist);
  }

  // Analyze each beneficiary
  const distributionsByBeneficiary = [];
  const flags: Section100AAnalysis['section_100a_flags'] = [];

  for (const [beneficiaryId, beneficiaryDists] of beneficiaryMap.entries()) {
    const firstDist = beneficiaryDists[0];
    const beneficiaryName = firstDist.beneficiary_name;
    const beneficiaryType = firstDist.beneficiary_entity_type;

    const totalDistributed = beneficiaryDists.reduce((sum, d) => sum + d.distribution_amount, 0);
    const cashPaid = beneficiaryDists
      .filter(d => d.distribution_type === 'cash')
      .reduce((sum, d) => sum + d.distribution_amount, 0);
    const upeBalance = beneficiaryDists
      .filter(d => d.distribution_type === 'upe')
      .reduce((sum, d) => sum + (d.upe_balance || 0), 0);

    // Calculate risk score and identify risk factors
    const { riskScore, riskFactors } = calculateBeneficiaryRisk(beneficiaryDists);

    distributionsByBeneficiary.push({
      beneficiary_id: beneficiaryId,
      beneficiary_name: beneficiaryName,
      beneficiary_type: beneficiaryType,
      total_distributed: totalDistributed,
      cash_paid: cashPaid,
      upe_balance: upeBalance,
      risk_score: riskScore,
      risk_factors: riskFactors,
      familyDealingExclusion:
        firstDist.is_related_party && firstDist.is_family_member && !firstDist.has_reimbursement_pattern
          ? 'Ordinary family dealing exclusion (TR 2022/4) may apply. Distribution is to a related party ' +
            'family member with no reimbursement agreement detected. Section 100A may not apply to this ' +
            'distribution. Confirm with professional advisor.'
          : undefined,
    });

    // Generate Section 100A flags
    const beneficiaryFlags = generateSection100AFlags(
      beneficiaryId,
      beneficiaryName,
      beneficiaryDists,
      riskScore
    );
    flags.push(...beneficiaryFlags);
  }

  // Calculate UPE summary
  const upeSummary = calculateUPESummary(distributionsByBeneficiary);

  // Determine overall risk level
  const overallRiskLevel = determineOverallRisk(flags, upeSummary);

  // Generate compliance summary
  const complianceSummary = generateComplianceSummary(
    trustName,
    fy,
    distributionsByBeneficiary,
    flags,
    upeSummary
  );

  // Professional review required if critical or high risk
  const professionalReviewRequired = overallRiskLevel === 'critical' || overallRiskLevel === 'high';

  return {
    trust_entity_id: trustId,
    trust_entity_name: trustName,
    financial_year: fy,
    total_distributions: totalDistributions,
    cash_distributions: cashDistributions,
    upe_distributions: upeDistributions,
    distributions_by_beneficiary: distributionsByBeneficiary,
    section_100a_flags: flags,
    upe_summary: upeSummary,
    overall_risk_level: overallRiskLevel,
    compliance_summary: complianceSummary,
    professional_review_required: professionalReviewRequired,
  };
}

/**
 * Calculate beneficiary risk score (0-100)
 */
function calculateBeneficiaryRisk(
  distributions: TrustDistribution[]
): { riskScore: number; riskFactors: string[] } {
  let riskScore = 0;
  const riskFactors: string[] = [];

  const firstDist = distributions[0];

  // Risk Factor 1: Non-resident beneficiary (+40 points)
  if (firstDist.is_non_resident) {
    riskScore += 40;
    riskFactors.push('Non-resident beneficiary (Section 100A high risk)');
  }

  // Risk Factor 2: Minor beneficiary (+35 points)
  if (firstDist.is_minor) {
    riskScore += 35;
    riskFactors.push('Minor beneficiary under 18 (exceeds $1,307 threshold)');
  }

  // Risk Factor 3: Reimbursement agreement pattern (+30 points)
  if (firstDist.has_reimbursement_pattern) {
    riskScore += 30;
    riskFactors.push('Reimbursement agreement detected (distribution followed by loan-back)');
  }

  // Risk Factor 4: UPE outstanding for >2 years (+25 points, Division 7A risk)
  const oldestUPE = Math.max(...distributions.map(d => d.upe_age_years || 0));
  if (oldestUPE > 2) {
    riskScore += 25;
    riskFactors.push(`UPE outstanding for ${oldestUPE.toFixed(1)} years (Division 7A deemed dividend risk)`);
  }

  // Risk Factor 5: Large UPE balance relative to distributions (+20 points)
  const totalDistributed = distributions.reduce((sum, d) => sum + d.distribution_amount, 0);
  const totalUPE = distributions.reduce((sum, d) => sum + (d.upe_balance || 0), 0);
  const upeRatio = totalDistributed > 0 ? totalUPE / totalDistributed : 0;

  if (upeRatio > 0.8) {
    riskScore += 20;
    riskFactors.push(`High UPE ratio (${(upeRatio * 100).toFixed(0)}% of distributions unpaid)`);
  }

  // Risk Reduction: Ordinary family dealing exclusion (TR 2022/4 / s 100A(13) ITAA 1936)
  // Distributions to family members for ordinary family purposes are excluded from s 100A
  // when there is no reimbursement agreement. TR 2022/4 Examples 12-16 clarify that routine
  // distributions to family members (adult children, spouses, family companies/trusts) without
  // a reimbursement pattern are generally ordinary family dealings.
  if (firstDist.is_related_party && firstDist.is_family_member && !firstDist.has_reimbursement_pattern) {
    const reduction = Math.min(40, riskScore); // Substantial reduction — exclusion likely applies
    riskScore -= reduction;
    riskFactors.push(
      'Ordinary family dealing exclusion likely applies (s 100A(13) ITAA 1936, TR 2022/4): ' +
      'distribution to related-party family member with no reimbursement agreement detected. ' +
      'Section 100A unlikely to apply. Professional review recommended to confirm exclusion.'
    );
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100);

  return { riskScore, riskFactors };
}

/**
 * Generate Section 100A flags for a beneficiary
 */
function generateSection100AFlags(
  beneficiaryId: string,
  beneficiaryName: string,
  distributions: TrustDistribution[],
  _riskScore: number
): Section100AAnalysis['section_100a_flags'] {
  const flags: Section100AAnalysis['section_100a_flags'] = [];

  const firstDist = distributions[0];
  const totalAmount = distributions.reduce((sum, d) => sum + d.distribution_amount, 0);
  const totalUPE = distributions.reduce((sum, d) => sum + (d.upe_balance || 0), 0);

  // T-1 fix: Ordinary family dealing exclusion (s 100A(13) ITAA 1936, TR 2022/4)
  // When ALL conditions met, s 100A is unlikely to apply — downgrade flag severity.
  // Conditions: related party + family member + no reimbursement agreement detected.
  const familyDealingApplies =
    firstDist.is_related_party === true &&
    firstDist.is_family_member === true &&
    !firstDist.has_reimbursement_pattern;

  // Flag 1: Reimbursement agreement
  // Note: familyDealingApplies is always false here (requires !has_reimbursement_pattern)
  if (firstDist.has_reimbursement_pattern) {
    flags.push({
      flag_type: 'reimbursement_agreement',
      severity: 'critical',
      description: `Distribution of $${totalAmount.toLocaleString()} followed by loan-back pattern detected within 30 days.`,
      beneficiary_id: beneficiaryId,
      beneficiary_name: beneficiaryName,
      amount: totalAmount,
      recommendation: 'URGENT: Review for Section 100A reimbursement agreement. If ATO determines agreement exists, distribution may be assessed to trustee at 47% (top marginal rate 45% + 2% Medicare Levy per s 99A ITAA 1936). Obtain legal advice immediately.',
      familyDealingNote: firstDist.is_family_member
        ? 'Beneficiary is a family member but a reimbursement pattern was detected. The ordinary family dealing ' +
          'exclusion under TR 2022/4 does NOT apply when a reimbursement agreement exists.'
        : undefined,
    });
  }

  // Flag 2: Non-resident distribution
  // TR 2022/4 Example 16: family dealing may apply to non-resident family members
  // but ATO scrutiny is increased. Downgrade severity when exclusion applies.
  if (firstDist.is_non_resident) {
    flags.push({
      flag_type: 'non_resident_distribution',
      severity: familyDealingApplies ? 'medium' : 'high',
      description: familyDealingApplies
        ? `Distribution of $${totalAmount.toLocaleString()} to non-resident family member. Ordinary family dealing exclusion (s 100A(13)) may apply but non-resident status warrants review.`
        : `Distribution of $${totalAmount.toLocaleString()} to non-resident beneficiary.`,
      beneficiary_id: beneficiaryId,
      beneficiary_name: beneficiaryName,
      amount: totalAmount,
      recommendation: familyDealingApplies
        ? 'Non-resident family member distribution. Ordinary family dealing exclusion (TR 2022/4) likely applies but ATO may scrutinise non-resident distributions more closely. Ensure withholding tax applied and document family relationship.'
        : 'Review for Section 100A application. Non-resident distributions are high-risk for ATO scrutiny. Ensure proper withholding tax applied and genuine economic substance.',
      familyDealingNote: familyDealingApplies
        ? 'Ordinary family dealing exclusion (s 100A(13), TR 2022/4) likely applies. Severity reduced from high to medium. Non-resident status still warrants professional review.'
        : undefined,
    });
  }

  // Flag 3: Minor beneficiary
  // TR 2022/4: distributions genuinely for a minor family member's benefit qualify
  // for the family dealing exclusion. Downgrade severity when exclusion applies.
  if (firstDist.is_minor) {
    flags.push({
      flag_type: 'minor_distribution',
      severity: familyDealingApplies ? 'low' : 'high',
      description: familyDealingApplies
        ? `Distribution of $${totalAmount.toLocaleString()} to minor family member (under 18). Ordinary family dealing exclusion (s 100A(13)) likely applies.`
        : `Distribution of $${totalAmount.toLocaleString()} to minor beneficiary (under 18).`,
      beneficiary_id: beneficiaryId,
      beneficiary_name: beneficiaryName,
      amount: totalAmount,
      recommendation: familyDealingApplies
        ? `Minor family member distribution. Ordinary family dealing exclusion (TR 2022/4) likely applies for distributions genuinely for the minor's benefit. Excepted income for minors limited to $1,307 (FY2024-25); excess taxed at 66%. Section 100A unlikely to apply.`
        : `Excepted income for minors limited to $1,307 (FY2024-25). Excess taxed at 66%. Review if distribution genuinely for minor's benefit and not a reimbursement agreement.`,
      familyDealingNote: familyDealingApplies
        ? 'Ordinary family dealing exclusion (s 100A(13), TR 2022/4) likely applies. Severity reduced from high to low. Minor income penalty rules still apply independently.'
        : undefined,
    });
  }

  // Flag 4: Excessive UPE
  if (totalUPE > 0) {
    const oldestUPE = Math.max(...distributions.map(d => d.upe_age_years || 0));

    if (oldestUPE > 2) {
      flags.push({
        flag_type: 'excessive_upe',
        severity: 'critical',
        description: `UPE balance of $${totalUPE.toLocaleString()} outstanding for ${oldestUPE.toFixed(1)} years.`,
        beneficiary_id: beneficiaryId,
        beneficiary_name: beneficiaryName,
        amount: totalUPE,
        recommendation: `UPE >2 years old may trigger Division 7A deemed dividend if trust is a private company shareholder. Pay UPE immediately or formalize as complying loan (7-year term, 8.77% interest). Failure to act results in deemed dividend taxed at marginal rate.`,
        familyDealingNote: firstDist.is_family_member && !firstDist.has_reimbursement_pattern
          ? 'Note: Beneficiary is a family member. Family dealing exclusion (TR 2022/4) may apply to the ' +
            'distribution but the UPE itself has separate Division 7A implications.'
          : undefined,
      });
    } else if (totalUPE > 100000) {
      flags.push({
        flag_type: 'excessive_upe',
        severity: 'medium',
        description: `Large UPE balance of $${totalUPE.toLocaleString()}.`,
        beneficiary_id: beneficiaryId,
        beneficiary_name: beneficiaryName,
        amount: totalUPE,
        recommendation: `Monitor UPE age. If unpaid for >2 years and trust owes money to private company, Division 7A deemed dividend rules apply. Plan repayment strategy or loan agreement.`,
        familyDealingNote: firstDist.is_family_member && !firstDist.has_reimbursement_pattern
          ? 'Note: Beneficiary is a family member. Family dealing exclusion (TR 2022/4) may apply to the ' +
            'distribution but the UPE itself has separate Division 7A implications.'
          : undefined,
      });
    }
  }

  return flags;
}

/**
 * Calculate UPE summary statistics
 */
function calculateUPESummary(
  beneficiaries: Section100AAnalysis['distributions_by_beneficiary']
): Section100AAnalysis['upe_summary'] {
  const totalUPEBalance = beneficiaries.reduce((sum, b) => sum + b.upe_balance, 0);
  const beneficiariesWithUPE = beneficiaries.filter(b => b.upe_balance > 0).length;

  // Count aged UPE (>2 years) - this would require additional data
  // For now, flag any UPE as potential aged UPE requiring review
  const agedUPEOver2Years = beneficiariesWithUPE; // Placeholder
  const agedUPEAmount = totalUPEBalance; // Placeholder

  return {
    total_upe_balance: totalUPEBalance,
    beneficiaries_with_upe: beneficiariesWithUPE,
    aged_upe_over_2_years: agedUPEOver2Years,
    aged_upe_amount: agedUPEAmount,
  };
}

/**
 * Determine overall risk level
 */
function determineOverallRisk(
  flags: Section100AAnalysis['section_100a_flags'],
  upeSummary: Section100AAnalysis['upe_summary']
): 'critical' | 'high' | 'medium' | 'low' {
  const hasCriticalFlag = flags.some(f => f.severity === 'critical');
  const hasHighFlag = flags.some(f => f.severity === 'high');
  const hasMediumFlag = flags.some(f => f.severity === 'medium');

  if (hasCriticalFlag || upeSummary.aged_upe_amount > 500000) {
    return 'critical';
  } else if (hasHighFlag || upeSummary.total_upe_balance > 200000) {
    return 'high';
  } else if (hasMediumFlag || upeSummary.total_upe_balance > 50000) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Generate compliance summary text
 */
function generateComplianceSummary(
  trustName: string,
  fy: string,
  beneficiaries: Section100AAnalysis['distributions_by_beneficiary'],
  flags: Section100AAnalysis['section_100a_flags'],
  upeSummary: Section100AAnalysis['upe_summary']
): string {
  const flagCount = flags.length;
  const beneficiaryCount = beneficiaries.length;
  const totalDistributed = beneficiaries.reduce((sum, b) => sum + b.total_distributed, 0);

  let summary = `Trust "${trustName}" distributed $${totalDistributed.toLocaleString()} to ${beneficiaryCount} beneficiaries in ${fy}. `;

  // Count flags where family dealing exclusion reduced severity
  const familyDealingReducedFlags = flags.filter(f => f.familyDealingNote?.includes('Severity reduced')).length;

  if (flagCount === 0 && upeSummary.total_upe_balance === 0) {
    summary += 'No Section 100A compliance issues detected. All distributions appear to be genuine beneficiary entitlements with no reimbursement agreements.';
  } else {
    summary += `Identified ${flagCount} potential Section 100A compliance issues. `;

    if (familyDealingReducedFlags > 0) {
      summary += `${familyDealingReducedFlags} flag(s) had severity reduced due to ordinary family dealing exclusion (s 100A(13), TR 2022/4). `;
    }

    if (upeSummary.total_upe_balance > 0) {
      summary += `UPE balance of $${upeSummary.total_upe_balance.toLocaleString()} requires monitoring for Division 7A implications. `;
    }

    const criticalFlags = flags.filter(f => f.severity === 'critical');
    if (criticalFlags.length > 0) {
      summary += `URGENT: ${criticalFlags.length} critical issues require immediate professional review to avoid potential 47% tax assessment to trustee (top marginal rate 45% + 2% Medicare Levy per s 99A ITAA 1936).`;
    }
  }

  return summary;
}
