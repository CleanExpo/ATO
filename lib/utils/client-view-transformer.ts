/**
 * Client View Transformer
 *
 * Transforms technical audit findings into plain English for clients
 * - Converts jargon to simple language
 * - Creates visual summaries
 * - Generates actionable next steps
 */

export interface ClientSummary {
  headline: string // "Great News! Your books are 98% accurate"
  keyFindings: string[] // Plain language bullet points
  visualData: {
    savingsPotential: number
    issuesCount: number
    estimatedFixTime: string
    accuracyScore: number
  }
  issueBreakdown: Array<{
    name: string
    percentage: number
    description: string // Plain English
    color: string
  }>
  whatThisMeans: string // Paragraph explanation
  nextSteps: string[] // Action items in simple language
}

export interface DataQualityScanResult {
  issuesFound: number
  transactionsScanned: number
  issuesByType: {
    duplicate: number
    wrongAccount: number
    taxClassification: number
    unreconciled: number
    misallocated: number
  }
  totalImpactAmount: number
  issuesAutoCorrected: number
  issuesPendingReview: number
  confidence: number
}

export interface ForensicAuditResult {
  totalAdjustedBenefit: number
  byTaxArea: {
    rnd: number
    deductions: number
    losses: number
    div7a: number
  }
  byPriority: {
    critical: number
    high: number
    medium: number
    low: number
  }
  transactionsAnalyzed: number
  yearsAnalyzed: number
}

/**
 * Transform Data Quality Scan results to client-friendly format
 */
export function transformDataQualityToClientView(
  data: DataQualityScanResult
): ClientSummary {
  const accuracyScore = Math.round(
    ((data.transactionsScanned - data.issuesFound) / data.transactionsScanned) * 100
  )

  // Generate headline based on accuracy
  let headline = ''
  if (accuracyScore >= 95) {
    headline = `Excellent! Your books are ${accuracyScore}% accurate`
  } else if (accuracyScore >= 85) {
    headline = `Good news! Your books are ${accuracyScore}% accurate`
  } else if (accuracyScore >= 75) {
    headline = `Your books are ${accuracyScore}% accurate - some fixes needed`
  } else {
    headline = `We found ${data.issuesFound} issues that need attention`
  }

  // Generate key findings in plain language
  const keyFindings: string[] = []

  if (data.issuesByType.duplicate > 0) {
    keyFindings.push(
      `Found ${data.issuesByType.duplicate} duplicate transactions (likely from bank feed imports)`
    )
  }

  if (data.issuesByType.wrongAccount > 0) {
    keyFindings.push(
      `${data.issuesByType.wrongAccount} expenses are in the wrong category`
    )
  }

  if (data.issuesByType.taxClassification > 0) {
    keyFindings.push(
      `${data.issuesByType.taxClassification} transactions have incorrect tax settings`
    )
  }

  if (data.issuesAutoCorrected > 0) {
    keyFindings.push(
      `${data.issuesAutoCorrected} issues were automatically fixed (high confidence)`
    )
  }

  // Estimate fix time
  let estimatedFixTime = '30 minutes'
  if (data.issuesPendingReview > 50) {
    estimatedFixTime = '3-4 hours'
  } else if (data.issuesPendingReview > 20) {
    estimatedFixTime = '1-2 hours'
  } else if (data.issuesPendingReview > 10) {
    estimatedFixTime = '30-60 minutes'
  }

  // Issue breakdown with percentages
  const totalIssues = data.issuesFound
  const issueBreakdown = [
    {
      name: 'Duplicate Transactions',
      percentage: totalIssues > 0 ? (data.issuesByType.duplicate / totalIssues) * 100 : 0,
      description: 'Same transaction recorded twice (usually from bank feeds)',
      color: '#f59e0b'
    },
    {
      name: 'Wrong Categories',
      percentage: totalIssues > 0 ? (data.issuesByType.wrongAccount / totalIssues) * 100 : 0,
      description: 'Expenses in the wrong account category',
      color: '#ef4444'
    },
    {
      name: 'Tax Errors',
      percentage:
        totalIssues > 0 ? (data.issuesByType.taxClassification / totalIssues) * 100 : 0,
      description: 'Incorrect GST or tax codes',
      color: '#8b5cf6'
    }
  ].filter((item) => item.percentage > 0)

  // What this means
  let whatThisMeans = ''
  if (accuracyScore >= 95) {
    whatThisMeans =
      'Your accounting is in excellent shape! The issues we found are minor and easily fixed. This level of accuracy shows good bookkeeping practices.'
  } else if (accuracyScore >= 85) {
    whatThisMeans =
      'Your accounting is generally good, but there are some areas that need attention. Most issues are straightforward to fix and won\'t take long to resolve.'
  } else {
    whatThisMeans =
      'We found several issues that should be addressed to ensure accurate financial reporting and tax compliance. The good news is that many of these can be fixed quickly.'
  }

  // Next steps
  const nextSteps: string[] = []

  if (data.issuesPendingReview > 0) {
    nextSteps.push('Review the flagged transactions and approve the suggested fixes')
  }

  if (data.issuesByType.duplicate > 0) {
    nextSteps.push('Delete duplicate transactions to avoid overstating expenses')
  }

  if (data.issuesByType.wrongAccount > 0) {
    nextSteps.push('Move expenses to the correct categories for accurate reporting')
  }

  if (data.issuesByType.taxClassification > 0) {
    nextSteps.push('Update tax codes to ensure correct GST treatment')
  }

  nextSteps.push('Schedule a call with your accountant to review the changes')

  return {
    headline,
    keyFindings,
    visualData: {
      savingsPotential: data.totalImpactAmount,
      issuesCount: data.issuesFound,
      estimatedFixTime,
      accuracyScore
    },
    issueBreakdown,
    whatThisMeans,
    nextSteps
  }
}

/**
 * Transform Forensic Audit results to client-friendly format
 */
export function transformForensicAuditToClientView(
  data: ForensicAuditResult
): ClientSummary {
  const headline = data.totalAdjustedBenefit > 100000
    ? `Excellent! We found $${Math.round(data.totalAdjustedBenefit / 1000)}k in tax savings`
    : data.totalAdjustedBenefit > 50000
    ? `Good news! We found $${Math.round(data.totalAdjustedBenefit / 1000)}k in potential tax savings`
    : `We found $${Math.round(data.totalAdjustedBenefit / 1000)}k in tax opportunities`

  // Generate key findings
  const keyFindings: string[] = []

  if (data.byTaxArea.rnd > 0) {
    keyFindings.push(
      `$${Math.round(data.byTaxArea.rnd / 1000)}k available through the R&D Tax Incentive program`
    )
  }

  if (data.byTaxArea.deductions > 0) {
    keyFindings.push(
      `$${Math.round(data.byTaxArea.deductions / 1000)}k in missed tax deductions`
    )
  }

  if (data.byTaxArea.losses > 0) {
    keyFindings.push(
      `$${Math.round(data.byTaxArea.losses / 1000)}k in unused tax losses to carry forward`
    )
  }

  if (data.byTaxArea.div7a > 0) {
    keyFindings.push(
      `$${Math.round(data.byTaxArea.div7a / 1000)}k in Division 7A risks to address`
    )
  }

  keyFindings.push(
    `Analyzed ${data.transactionsAnalyzed.toLocaleString()} transactions across ${data.yearsAnalyzed} years`
  )

  // Opportunity breakdown
  const totalBenefit = data.totalAdjustedBenefit
  const issueBreakdown = [
    {
      name: 'R&D Tax Incentive',
      percentage: (data.byTaxArea.rnd / totalBenefit) * 100,
      description: 'Tax offset for research and development activities',
      color: '#8b5cf6'
    },
    {
      name: 'Tax Deductions',
      percentage: (data.byTaxArea.deductions / totalBenefit) * 100,
      description: 'Business expenses you can claim',
      color: '#0ea5e9'
    },
    {
      name: 'Loss Carry-Forward',
      percentage: (data.byTaxArea.losses / totalBenefit) * 100,
      description: 'Past losses to reduce future tax',
      color: '#f59e0b'
    },
    {
      name: 'Division 7A',
      percentage: (data.byTaxArea.div7a / totalBenefit) * 100,
      description: 'Compliance issues to fix',
      color: '#ef4444'
    }
  ].filter((item) => item.percentage > 0)

  // What this means
  const whatThisMeans =
    'Our AI analyzed your financial history and found opportunities to reduce your tax liability. These are legitimate tax strategies that you may have missed. Your accountant can help you claim these benefits in your next tax return or through amendments.'

  // Next steps
  const nextSteps = [
    'Download the detailed report to review each opportunity',
    'Schedule a meeting with your accountant to discuss the findings',
    'Prioritize high-value opportunities that can be claimed immediately',
    'Gather supporting documentation for R&D and deduction claims',
    'Consider filing amendments for previous years if beneficial'
  ]

  return {
    headline,
    keyFindings,
    visualData: {
      savingsPotential: data.totalAdjustedBenefit,
      issuesCount: data.byPriority.critical + data.byPriority.high,
      estimatedFixTime: 'Varies by opportunity',
      accuracyScore: 0 // Not applicable for forensic audits
    },
    issueBreakdown,
    whatThisMeans,
    nextSteps
  }
}
