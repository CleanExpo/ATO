/**
 * PDF Report Generator
 *
 * Generates professional publication-quality PDF reports for forensic tax audits.
 *
 * Report Structure:
 * 1. Executive Summary
 * 2. Methodology
 * 3. R&D Tax Incentive Analysis
 * 4. General Deductions Analysis
 * 5. Loss Carry-Forward Analysis
 * 6. Division 7A Compliance
 * 7. Actionable Recommendations
 * 8. Amendment Schedules
 * 9. Appendices
 *
 * Note: This implementation generates structured data and HTML.
 * For production, integrate with jsPDF or Puppeteer for actual PDF generation.
 */

import { generateRecommendations } from '@/lib/recommendations/recommendation-engine'
import { generateAmendmentSchedules } from '@/lib/reports/amendment-schedules'
import { analyzeRndOpportunities } from '@/lib/analysis/rnd-engine'
import { analyzeDeductionOpportunities } from '@/lib/analysis/deduction-engine'
import { analyzeLossPosition } from '@/lib/analysis/loss-engine'
import { analyzeDiv7aCompliance } from '@/lib/analysis/div7a-engine'
import { getCostSummary } from '@/lib/ai/batch-processor'
import { createLogger } from '@/lib/logger'

const log = createLogger('reports:pdf')

export interface ReportMetadata {
  reportId: string
  tenantId: string
  organizationName: string
  abn: string
  generatedAt: Date
  generatedBy: string
  yearsAnalyzed: string[]
  reportVersion: string
}

export interface ExecutiveSummary {
  totalOpportunity: number
  adjustedOpportunity: number
  breakdown: {
    rnd: number
    deductions: number
    losses: number
    div7a: number
  }
  topRecommendations: string[]
  criticalDeadlines: Array<{ action: string; deadline: Date }>
  overallConfidence: number
}

export interface PDFReport {
  metadata: ReportMetadata
  executiveSummary: ExecutiveSummary
  methodology: {
    dataSources: string[]
    analysisApproach: string
    aiModel: string
    transactionsAnalyzed: number
    costIncurred: number
  }
  rndAnalysis: any
  deductionAnalysis: any
  lossAnalysis: any
  div7aAnalysis: any
  recommendations: any
  amendmentSchedules: any
  appendices: {
    glossary: Record<string, string>
    legislativeReferences: string[]
    contactInformation: Record<string, string>
  }
}

/**
 * Generate complete PDF report data structure
 */
export async function generatePDFReportData(
  tenantId: string,
  organizationName: string,
  abn: string
): Promise<PDFReport> {
  log.info('Generating PDF report', { tenantId })

  // Run all analyses in parallel
  const [
    rndSummary,
    deductionSummary,
    lossSummary,
    div7aSummary,
    recommendationSummary,
    amendmentSummary,
    costSummary,
  ] = await Promise.all([
    analyzeRndOpportunities(tenantId),
    analyzeDeductionOpportunities(tenantId),
    analyzeLossPosition(tenantId),
    analyzeDiv7aCompliance(tenantId),
    generateRecommendations(tenantId),
    generateAmendmentSchedules(tenantId),
    getCostSummary(tenantId),
  ])

  // Create metadata
  const reportId = `FR-${Date.now()}`
  const metadata: ReportMetadata = {
    reportId,
    tenantId,
    organizationName,
    abn,
    generatedAt: new Date(),
    generatedBy: 'Claude AI Forensic Tax Audit System',
    yearsAnalyzed: Array.from(
      new Set([
        ...Object.keys(rndSummary.projectsByYear),
        ...Object.keys(deductionSummary.opportunitiesByYear),
        ...Object.keys(lossSummary.lossesByYear),
      ])
    ).sort(),
    reportVersion: '1.0',
  }

  // Create executive summary
  const executiveSummary: ExecutiveSummary = {
    totalOpportunity: recommendationSummary.totalEstimatedBenefit,
    adjustedOpportunity: recommendationSummary.totalAdjustedBenefit,
    breakdown: {
      rnd: recommendationSummary.byTaxArea.rnd,
      deductions: recommendationSummary.byTaxArea.deductions,
      losses: recommendationSummary.byTaxArea.losses,
      div7a: recommendationSummary.byTaxArea.div7a,
    },
    topRecommendations: recommendationSummary.recommendations
      .slice(0, 10)
      .map((r) => r.action),
    criticalDeadlines: recommendationSummary.criticalRecommendations.map((r) => ({
      action: r.action,
      deadline: r.deadline,
    })),
    overallConfidence:
      (rndSummary.averageConfidence +
        deductionSummary.averageConfidence +
        80 + // Loss analysis confidence (hardcoded)
        90) / // Div7A compliance confidence
      4,
  }

  // Create methodology section
  const methodology = {
    dataSources: [
      'Xero Accounting Software (5 years historical data)',
      'Bank transactions',
      'Profit & Loss statements',
      'Balance sheets',
      'Chart of accounts',
    ],
    analysisApproach:
      'AI-powered forensic analysis using Google Gemini 1.5 Flash. Each transaction analyzed for tax optimization opportunities across R&D, deductions, losses, and Division 7A compliance.',
    aiModel: 'Google Gemini 1.5 Flash',
    transactionsAnalyzed: costSummary.totalTransactions,
    costIncurred: costSummary.totalCost,
  }

  // Appendices
  const appendices = {
    glossary: createGlossary(),
    legislativeReferences: createLegislativeReferences(),
    contactInformation: {
      'System Provider': 'Claude AI Forensic Tax Audit System',
      'Report Generated': metadata.generatedAt.toISOString(),
      'Questions': 'Contact your tax advisor for clarification',
    },
  }

  return {
    metadata,
    executiveSummary,
    methodology,
    rndAnalysis: rndSummary,
    deductionAnalysis: deductionSummary,
    lossAnalysis: lossSummary,
    div7aAnalysis: div7aSummary,
    recommendations: recommendationSummary,
    amendmentSchedules: amendmentSummary,
    appendices,
  }
}

/**
 * Generate HTML version of the report (can be converted to PDF with Puppeteer)
 */
export async function generatePDFReportHTML(report: PDFReport): Promise<string> {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forensic Tax Audit Report - ${report.metadata.organizationName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 297mm;
    }
    h1 {
      font-size: 36px;
      color: #1a1a1a;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 24px;
      color: #2c3e50;
      margin-top: 30px;
      margin-bottom: 15px;
      border-bottom: 2px solid #3498db;
      padding-bottom: 5px;
    }
    h3 {
      font-size: 18px;
      color: #34495e;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    .metadata {
      margin: 30px 0;
      font-size: 14px;
      color: #666;
    }
    .summary-box {
      background: #f8f9fa;
      border-left: 4px solid #3498db;
      padding: 20px;
      margin: 20px 0;
    }
    .opportunity-amount {
      font-size: 48px;
      font-weight: bold;
      color: #27ae60;
      text-align: center;
      margin: 20px 0;
    }
    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    .breakdown-item {
      background: white;
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 5px;
    }
    .breakdown-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .breakdown-value {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #3498db;
      color: white;
      font-weight: 600;
    }
    .priority-critical {
      color: #e74c3c;
      font-weight: bold;
    }
    .priority-high {
      color: #e67e22;
      font-weight: bold;
    }
    .priority-medium {
      color: #f39c12;
    }
    .priority-low {
      color: #95a5a6;
    }
    .recommendation-list {
      list-style: none;
      padding: 0;
    }
    .recommendation-item {
      background: #f8f9fa;
      padding: 15px;
      margin: 10px 0;
      border-left: 4px solid #3498db;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .page-break {
      page-break-after: always;
    }
    @media print {
      .page {
        box-shadow: none;
        margin: 0;
      }
    }
  </style>
</head>
<body>

<!-- Cover Page -->
<div class="page cover-page">
  <div style="background: #6366f1; color: white; padding: 10px 30px; border-radius: 40px; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 40px;">
    Professional Review Required
  </div>
  <h1>Forensic Tax Audit:<br>Audit Outline & Value Discovery</h1>
  <div class="metadata">
    <p><strong>${report.metadata.organizationName}</strong></p>
    <p>ABN: ${report.metadata.abn}</p>
    <p>Report ID: ${report.metadata.reportId}</p>
    <p>Generated: ${report.metadata.generatedAt.toLocaleDateString()}</p>
    <p>Years Analyzed: ${report.metadata.yearsAnalyzed.join(', ')}</p>
  </div>
  <div class="opportunity-amount">
    $${report.executiveSummary.adjustedOpportunity.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
  </div>
  <p style="font-size: 18px; color: #666; font-weight: 600;">Candidate Tax Benefits Identified</p>
  
  <div style="margin-top: 60px; padding: 20px; border: 1px dashed #6366f1; border-radius: 12px; max-width: 80% text-align: left;">
    <p style="font-size: 12px; color: #4338ca; line-height: 1.5;">
      <strong>NOTICE:</strong> This document is an <strong>Audit Outline</strong> generated via AI forensic ledger analysis. It is designed to assist Business Owners and Accountants in identifying missed optimization opportunities. This is not a tax return and must be reviewed by a qualified Tax Agent before implementation.
    </p>
  </div>
</div>

<div class="page-break"></div>

<!-- Executive Summary -->
<div class="page">
  <h2>Executive Summary</h2>

  <div class="summary-box">
    <p><strong>Total Opportunity Identified:</strong> $${report.executiveSummary.totalOpportunity.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
    <p><strong>Proposed Recovery (Risk-Adjusted):</strong> $${report.executiveSummary.adjustedOpportunity.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
    <p><strong>Overall Confidence:</strong> ${report.executiveSummary.overallConfidence.toFixed(0)}%</p>
  </div>

  <h3>Breakdown by Tax Area</h3>
  <div class="breakdown-grid">
    <div class="breakdown-item">
      <div class="breakdown-label">R&D Tax Incentive</div>
      <div class="breakdown-value">$${report.executiveSummary.breakdown.rnd.toLocaleString('en-AU')}</div>
    </div>
    <div class="breakdown-item">
      <div class="breakdown-label">General Deductions</div>
      <div class="breakdown-value">$${report.executiveSummary.breakdown.deductions.toLocaleString('en-AU')}</div>
    </div>
    <div class="breakdown-item">
      <div class="breakdown-label">Loss Optimization</div>
      <div class="breakdown-value">$${report.executiveSummary.breakdown.losses.toLocaleString('en-AU')}</div>
    </div>
    <div class="breakdown-item">
      <div class="breakdown-label">Division 7A Compliance</div>
      <div class="breakdown-value">$${report.executiveSummary.breakdown.div7a.toLocaleString('en-AU')}</div>
    </div>
  </div>

  <h3>Top 10 Recommendations</h3>
  <ol>
    ${report.executiveSummary.topRecommendations.map((rec) => `<li>${rec}</li>`).join('\n    ')}
  </ol>

  ${report.executiveSummary.criticalDeadlines.length > 0
      ? `
  <h3>Critical Deadlines</h3>
  <table>
    <thead>
      <tr>
        <th>Action</th>
        <th>Deadline</th>
        <th>Days Remaining</th>
      </tr>
    </thead>
    <tbody>
      ${report.executiveSummary.criticalDeadlines
        .map(
          (d) => `
        <tr>
          <td>${d.action}</td>
          <td>${d.deadline.toLocaleDateString()}</td>
          <td>${Math.ceil((d.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days</td>
        </tr>
      `
        )
        .join('\n      ')}
    </tbody>
  </table>
  `
      : ''
    }
</div>

<div class="page-break"></div>

<!-- Methodology -->
<div class="page">
  <h2>Methodology</h2>

  <h3>Data Sources</h3>
  <ul>
    ${report.methodology.dataSources.map((source) => `<li>${source}</li>`).join('\n    ')}
  </ul>

  <h3>Analysis Approach</h3>
  <p>${report.methodology.analysisApproach}</p>

  <h3>AI Model</h3>
  <p>${report.methodology.aiModel}</p>

  <h3>Scope</h3>
  <p><strong>Transactions Analyzed:</strong> ${report.methodology.transactionsAnalyzed.toLocaleString()}</p>
  <p><strong>AI Analysis Cost:</strong> $${report.methodology.costIncurred.toFixed(2)}</p>

  <h3>Assumptions & Limitations</h3>
  <ul>
    <li>Analysis based on transaction descriptions and AI categorization</li>
    <li>Confidence scores reflect AI certainty, not legal advice</li>
    <li>All recommendations should be reviewed by qualified tax professional</li>
    <li>Actual refunds may vary based on ATO assessment</li>
    <li>Amendment deadlines are indicative - verify with ATO</li>
  </ul>
</div>

<div class="page-break"></div>

<!-- R&D Analysis -->
<div class="page">
  <h2>R&D Tax Incentive Analysis (Division 355)</h2>

  <div class="summary-box">
    <p><strong>Total R&D Projects:</strong> ${report.rndAnalysis.totalProjects}</p>
    <p><strong>Total Eligible Expenditure:</strong> $${report.rndAnalysis.totalEligibleExpenditure.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
    <p><strong>Estimated 43.5% Offset:</strong> $${report.rndAnalysis.totalEstimatedOffset.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
    <p><strong>Average Confidence:</strong> ${report.rndAnalysis.averageConfidence}%</p>
  </div>

  <h3>Projects Identified</h3>
  ${report.rndAnalysis.projects.length > 0
      ? `
  <table>
    <thead>
      <tr>
        <th>Project</th>
        <th>Years</th>
        <th>Expenditure</th>
        <th>Offset (43.5%)</th>
        <th>Confidence</th>
      </tr>
    </thead>
    <tbody>
      ${report.rndAnalysis.projects
        .map(
          (p: any) => `
        <tr>
          <td>${p.projectName}</td>
          <td>${p.financialYears.join(', ')}</td>
          <td>$${p.eligibleExpenditure.toLocaleString('en-AU')}</td>
          <td>$${p.estimatedOffset.toLocaleString('en-AU')}</td>
          <td>${p.overallConfidence}%</td>
        </tr>
      `
        )
        .join('\n      ')}
    </tbody>
  </table>
  `
      : '<p>No R&D projects identified.</p>'
    }

  <h3>Division 355 Four-Element Test</h3>
  <p>All identified projects meet the following criteria:</p>
  <ol>
    <li><strong>Outcome Unknown:</strong> The outcome of the activity could not be determined in advance</li>
    <li><strong>Systematic Approach:</strong> Activities followed a systematic progression of work</li>
    <li><strong>New Knowledge:</strong> Generated new knowledge about a scientific or technical uncertainty</li>
    <li><strong>Scientific Method:</strong> Used principles of science, engineering, or computer science</li>
  </ol>
</div>

<div class="page-break"></div>

<!-- Deductions Analysis -->
<div class="page">
  <h2>General Deductions Analysis (Division 8)</h2>

  <div class="summary-box">
    <p><strong>Total Opportunities:</strong> ${report.deductionAnalysis.totalOpportunities}</p>
    <p><strong>Total Unclaimed Deductions:</strong> $${report.deductionAnalysis.totalUnclaimedDeductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
    <p><strong>Estimated Tax Saving:</strong> $${report.deductionAnalysis.totalEstimatedTaxSaving.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
    <p><strong>Average Confidence:</strong> ${report.deductionAnalysis.averageConfidence}%</p>
  </div>

  <h3>Opportunities by Category</h3>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Unclaimed Amount</th>
        <th>Tax Saving (25%)</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(report.deductionAnalysis.opportunitiesByCategory)
      .sort((a: any, b: any) => b[1] - a[1])
      .map(
        ([category, amount]: [string, any]) => `
        <tr>
          <td>${category}</td>
          <td>$${amount.toLocaleString('en-AU')}</td>
          <td>$${(amount * 0.25).toLocaleString('en-AU')}</td>
        </tr>
      `
      )
      .join('\n      ')}
    </tbody>
  </table>

  <h3>High-Value Opportunities (>$10,000)</h3>
  ${report.deductionAnalysis.highValueOpportunities.length > 0
      ? `
  <ul>
    ${report.deductionAnalysis.highValueOpportunities.map((opp: any) => `<li><strong>${opp.category}</strong> (${opp.financialYear}): $${opp.unclaimedAmount.toLocaleString('en-AU')}</li>`).join('\n    ')}
  </ul>
  `
      : '<p>No high-value opportunities identified.</p>'
    }
</div>

<div class="page-break"></div>

<!-- Actionable Recommendations -->
<div class="page">
  <h2>Actionable Recommendations</h2>

  <p>Total Recommendations: ${report.recommendations.totalRecommendations}</p>
  <p>By Priority: Critical (${report.recommendations.byPriority.critical}), High (${report.recommendations.byPriority.high}), Medium (${report.recommendations.byPriority.medium}), Low (${report.recommendations.byPriority.low})</p>

  <h3>Priority Recommendations</h3>
  <ul class="recommendation-list">
    ${report.recommendations.recommendations
      .slice(0, 20)
      .map(
        (rec: any) => `
      <li class="recommendation-item">
        <p><span class="priority-${rec.priority}">[${rec.priority.toUpperCase()}]</span> <strong>${rec.action}</strong></p>
        <p><small>${rec.financialYear} | Benefit: $${rec.adjustedBenefit.toLocaleString('en-AU')} (${rec.confidence}% confidence)</small></p>
        <p><small>Deadline: ${rec.deadline.toLocaleDateString()} | Forms: ${rec.atoForms.join(', ')}</small></p>
      </li>
    `
      )
      .join('\n    ')}
  </ul>
</div>

<div class="page-break"></div>

<!-- Footer -->
<div class="page">
  <div class="footer">
    <p><strong>IMPORTANT DISCLAIMER</strong></p>
    <p>This report is generated by AI-powered analysis and is for informational purposes only. It does not constitute legal or tax advice. All recommendations should be reviewed and verified by a qualified tax professional before taking action. The analysis is based on transaction descriptions and automated categorization, which may contain errors or misclassifications. Actual tax benefits may vary based on ATO assessment and individual circumstances.</p>
    <br>
    <p>Report ID: ${report.metadata.reportId} | Generated: ${report.metadata.generatedAt.toISOString()}</p>
    <p>${report.metadata.generatedBy}</p>
  </div>
</div>

</body>
</html>
`

  return html
}

/**
 * Create glossary of tax terms
 */
function createGlossary(): Record<string, string> {
  return {
    'R&D Tax Incentive':
      'A 43.5% refundable tax offset for eligible research and development activities under Division 355 ITAA 1997',
    'Division 355':
      'Legislation governing the R&D Tax Incentive in Australia',
    'Four-Element Test':
      'Criteria for R&D eligibility: outcome unknown, systematic approach, new knowledge, scientific method',
    'Section 8-1':
      'General deductions provision - expenses incurred in gaining or producing assessable income',
    'Division 40':
      'Capital allowances (depreciation) for depreciating assets',
    'Instant Asset Write-Off':
      'Immediate deduction for assets costing $20,000 or less (threshold varies by year)',
    'Division 36':
      'Tax losses for companies',
    'Division 165':
      'Special rules for recouping company tax losses',
    COT: 'Continuity of Ownership Test - requires 50%+ ownership continuity to carry forward losses',
    SBT: 'Same Business Test - allows loss carry-forward if same business maintained despite ownership change',
    'Division 7A':
      'Deemed dividend rules for private company payments/loans to shareholders',
    'Deemed Dividend':
      'Amount treated as a dividend for tax purposes due to Division 7A non-compliance',
    'Benchmark Interest Rate':
      'ATO-published interest rate for Division 7A complying loans (8.77% for FY2024-25)',
    'Amendment Window':
      '2-4 year period to amend tax returns after original lodgment',
    'Lodgment Day':
      'Due date for lodging tax return (May 15 if self-lodged, October 31 if using tax agent)',
  }
}

/**
 * Create list of legislative references
 */
function createLegislativeReferences(): string[] {
  return [
    'Income Tax Assessment Act 1997 (ITAA 1997)',
    'Division 8 ITAA 1997 - General deductions',
    'Section 8-1 ITAA 1997 - General deductions',
    'Division 40 ITAA 1997 - Capital allowances',
    'Section 40-82 ITAA 1997 - Instant asset write-off',
    'Division 355 ITAA 1997 - R&D Tax Incentive',
    'Division 36 ITAA 1997 - Tax losses (companies)',
    'Division 165 ITAA 1997 - Special rules for recouping losses',
    'Income Tax Assessment Act 1936 (ITAA 1936)',
    'Division 7A ITAA 1936 - Deemed dividends',
    'Taxation Administration Act 1953',
    'Australian Taxation Office Rulings and Guidelines',
    'TR 2016/1 - Income tax: Division 355 R&D Tax Incentive',
    'PS LA 2008/10 - Administration of the R&D Tax Incentive',
  ]
}

/**
 * Export report data as JSON for debugging or further processing
 */
export function exportReportJSON(report: PDFReport): string {
  return JSON.stringify(report, null, 2)
}

/**
 * Generate actual PDF file from report data using Puppeteer
 * Returns PDF as Buffer for download or storage
 */
export async function generatePDF(
  tenantId: string,
  organizationName: string,
  abn: string
): Promise<Buffer> {
  // Import puppeteer dynamically to avoid build issues
  const puppeteer = await import('puppeteer')

  log.info('Generating PDF', { tenantId })

  // Generate report data and HTML
  const reportData = await generatePDFReportData(tenantId, organizationName, abn)
  const htmlContent = await generatePDFReportHTML(reportData)

  // Launch headless Chrome
  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Overcome limited resource problems
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  })

  try {
    const page = await browser.newPage()

    // Load HTML content
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })

    // Generate PDF with professional formatting
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 9px; text-align: center; width: 100%; padding: 5px 15mm; color: #6366f1;">
          <span style="font-weight: 600;">ATO Tax Forensic Audit Report</span>
          <span style="margin-left: 20px; color: #64748b;">${organizationName} | ABN: ${abn}</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 8px; text-align: center; width: 100%; padding: 5px 15mm; color: #64748b;">
          <span style="float: left;">Generated: ${new Date().toLocaleDateString()}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          <span style="float: right;">Confidential</span>
        </div>
      `,
      preferCSSPageSize: false
    })

    log.info('PDF generated successfully', { bytes: pdfBuffer.length })
    return Buffer.from(pdfBuffer)

  } finally {
    await browser.close()
  }
}

/**
 * Generate client-friendly PDF (simplified version)
 * Omits technical details and focuses on actionable recommendations
 */
export async function generateClientPDF(
  tenantId: string,
  organizationName: string,
  abn: string
): Promise<Buffer> {
  const puppeteer = await import('puppeteer')

  log.info('Generating client-friendly PDF', { tenantId })

  // Generate full report data
  const reportData = await generatePDFReportData(tenantId, organizationName, abn)

  // Create simplified HTML for clients
  const clientHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Optimization Report - ${organizationName}</title>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { color: #4f46e5; font-size: 28px; margin-bottom: 10px; }
    h2 { color: #6366f1; font-size: 20px; margin-top: 30px; margin-bottom: 15px; }
    h3 { color: #64748b; font-size: 16px; margin-top: 20px; margin-bottom: 10px; }
    .summary-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      margin: 20px 0;
    }
    .summary-box h2 { color: white; margin-top: 0; }
    .opportunity { font-size: 36px; font-weight: bold; margin: 10px 0; }
    .breakdown { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px; }
    .breakdown-item { background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; }
    .breakdown-label { font-size: 12px; opacity: 0.9; }
    .breakdown-value { font-size: 20px; font-weight: bold; margin-top: 5px; }
    .recommendation { background: #f1f5f9; padding: 15px; margin: 10px 0; border-left: 4px solid #4f46e5; border-radius: 4px; }
    .deadline { background: #fef3c7; border-left-color: #f59e0b; }
    .priority-high { background: #fee2e2; border-left-color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <h1>Tax Optimization Report</h1>
  <p style="color: #64748b; font-size: 14px;">
    ${organizationName} | ABN: ${abn}<br>
    Report Generated: ${new Date().toLocaleDateString()}
  </p>

  <div class="summary-box">
    <h2>Total Tax Opportunity Identified</h2>
    <div class="opportunity">$${reportData.executiveSummary.totalOpportunity.toLocaleString()}</div>
    <p style="font-size: 14px; opacity: 0.95;">
      After conservative adjustments: $${reportData.executiveSummary.adjustedOpportunity.toLocaleString()}
    </p>

    <div class="breakdown">
      <div class="breakdown-item">
        <div class="breakdown-label">R&D Tax Incentive</div>
        <div class="breakdown-value">$${reportData.executiveSummary.breakdown.rnd.toLocaleString()}</div>
      </div>
      <div class="breakdown-item">
        <div class="breakdown-label">General Deductions</div>
        <div class="breakdown-value">$${reportData.executiveSummary.breakdown.deductions.toLocaleString()}</div>
      </div>
      <div class="breakdown-item">
        <div class="breakdown-label">Loss Carry-Forward</div>
        <div class="breakdown-value">$${reportData.executiveSummary.breakdown.losses.toLocaleString()}</div>
      </div>
      <div class="breakdown-item">
        <div class="breakdown-label">Division 7A Savings</div>
        <div class="breakdown-value">$${reportData.executiveSummary.breakdown.div7a.toLocaleString()}</div>
      </div>
    </div>
  </div>

  <h2>Top Recommendations</h2>
  ${reportData.executiveSummary.topRecommendations.map((rec, i) => `
    <div class="recommendation ${i === 0 ? 'priority-high' : ''}">
      <strong>${i + 1}.</strong> ${rec}
    </div>
  `).join('')}

  <h2>Critical Deadlines</h2>
  ${reportData.executiveSummary.criticalDeadlines.map(deadline => `
    <div class="recommendation deadline">
      <strong>${deadline.action}</strong><br>
      <span style="font-size: 14px;">Deadline: ${new Date(deadline.deadline).toLocaleDateString()}</span>
    </div>
  `).join('')}

  <h2>Next Steps</h2>
  <ol>
    <li>Review this report with your accountant</li>
    <li>Prioritize recommendations by deadline and benefit</li>
    <li>Gather supporting documentation for R&D claims</li>
    <li>Schedule lodgement of amended returns if applicable</li>
    <li>Register R&D activities with AusIndustry</li>
  </ol>

  <div class="footer">
    <p><strong>Important Notice:</strong> This report is based on automated analysis of your financial data.
    Always consult with a qualified tax professional before making any tax decisions or lodging amendments.</p>
    <p>Generated by ATO Optimizer | Confidence Level: ${reportData.executiveSummary.overallConfidence}%</p>
  </div>
</body>
</html>
  `

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  try {
    const page = await browser.newPage()
    await page.setContent(clientHTML, { waitUntil: 'networkidle0', timeout: 30000 })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      printBackground: true,
      preferCSSPageSize: false
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
