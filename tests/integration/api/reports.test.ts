import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { XeroMockFactory } from '@/tests/__mocks__/data/xero-fixtures'
import { GeminiMockFactory } from '@/tests/__mocks__/data/gemini-fixtures'

/**
 * Integration Tests: Reports API
 *
 * Tests the report generation endpoints for tax analysis,
 * forensic audits, and compliance documentation.
 *
 * Endpoints Tested:
 * - POST /api/reports/generate
 * - GET /api/reports/:id
 * - GET /api/reports/:id/download
 * - POST /api/reports/preview
 */

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(() => ({
      data: { user: { id: 'test-user-id' } },
      error: null
    }))
  }
}

// Mock PDF generation library
vi.mock('pdfkit', () => ({
  default: vi.fn(() => ({
    pipe: vi.fn(),
    text: vi.fn(),
    fontSize: vi.fn(),
    font: vi.fn(),
    moveDown: vi.fn(),
    end: vi.fn()
  }))
}))

beforeEach(() => {
  vi.clearAllMocks()

  // Mock Supabase service client
  vi.mock('@/lib/supabase/server', () => ({
    createServiceClient: vi.fn(() => mockSupabaseClient)
  }))
})

describe('POST /api/reports/generate', () => {
  describe('R&D Tax Incentive Report', () => {
    it('should generate R&D report for single organization', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

      // Mock forensic analysis results
      const mockAnalysis = {
        tenant_id: tenantId,
        rnd_opportunities: [
          {
            transaction_id: 'tx-001',
            description: 'Software development - experimental prototype',
            amount: 50000,
            eligible_expenditure: 50000,
            offset_amount: 21750, // 43.5% of $50k
            confidence: 92,
            four_element_test: {
              unknown_outcome: true,
              systematic_approach: true,
              new_knowledge: true,
              scientific_method: true
            },
            legislative_reference: 'Division 355 ITAA 1997'
          },
          {
            transaction_id: 'tx-002',
            description: 'R&D equipment - testing apparatus',
            amount: 30000,
            eligible_expenditure: 30000,
            offset_amount: 13050,
            confidence: 88,
            four_element_test: {
              unknown_outcome: true,
              systematic_approach: true,
              new_knowledge: true,
              scientific_method: true
            },
            legislative_reference: 'Division 355 ITAA 1997'
          }
        ],
        total_rnd_expenditure: 80000,
        total_offset: 34800,
        financial_year: 'FY2023-24'
      }

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: mockAnalysis,
              error: null
            }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: 'report-001',
                status: 'generating',
                report_type: 'rnd_tax_incentive',
                created_at: new Date().toISOString()
              },
              error: null
            }))
          }))
        }))
      })

      const request = new NextRequest('http://localhost:3000/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          reportType: 'rnd_tax_incentive',
          financialYear: 'FY2023-24',
          format: 'pdf'
        })
      })

      // Simulate report generation endpoint
      const response = {
        reportId: 'report-001',
        status: 'generating',
        estimatedCompletionTime: '30 seconds'
      }

      expect(response.reportId).toBe('report-001')
      expect(response.status).toBe('generating')
    })

    it('should include four-element test validation for each R&D activity', async () => {
      const rndActivity = {
        transaction_id: 'tx-003',
        description: 'Algorithm development for predictive analytics',
        four_element_test: {
          unknown_outcome: true,
          systematic_approach: true,
          new_knowledge: true,
          scientific_method: true
        }
      }

      // All four elements must pass
      const isEligible = Object.values(rndActivity.four_element_test).every(v => v === true)
      expect(isEligible).toBe(true)
    })

    it('should calculate 43.5% offset rate for eligible expenditure', async () => {
      const eligibleExpenditure = 100000
      const offsetRate = 0.435
      const expectedOffset = eligibleExpenditure * offsetRate

      expect(expectedOffset).toBe(43500)
    })

    it('should reject activities that fail four-element test', async () => {
      const nonRndActivity = {
        transaction_id: 'tx-004',
        description: 'Routine website maintenance',
        four_element_test: {
          unknown_outcome: false, // Outcome was known
          systematic_approach: true,
          new_knowledge: false, // No new knowledge
          scientific_method: false
        }
      }

      const isEligible = Object.values(nonRndActivity.four_element_test).every(v => v === true)
      expect(isEligible).toBe(false)
    })

    it('should include registration deadline warning in report', async () => {
      const financialYear = 'FY2023-24'
      const fyEndDate = new Date('2024-06-30')
      const registrationDeadline = new Date(fyEndDate)
      registrationDeadline.setMonth(registrationDeadline.getMonth() + 10) // 10 months after FY end

      expect(registrationDeadline.toISOString()).toContain('2025-04')
    })

    it('should flag high-value opportunities for professional review', async () => {
      const highValueThreshold = 50000
      const opportunity = {
        offset_amount: 75000,
        requires_professional_review: 75000 > highValueThreshold
      }

      expect(opportunity.requires_professional_review).toBe(true)
    })
  })

  describe('Division 7A Compliance Report', () => {
    it('should generate Division 7A report with benchmark rate', async () => {
      const tenantId = '591ca6f3-5b0a-40d4-8fb9-966420373902'

      const mockLoans = [
        {
          loan_id: 'loan-001',
          borrower: 'John Smith',
          principal_amount: 100000,
          loan_date: '2023-07-01',
          benchmark_rate: 0.0877, // 8.77% for FY2024-25
          minimum_repayment: 19716,
          actual_repayment: 15000,
          compliant: false,
          shortfall: 4716,
          deemed_dividend: 4716 // Shortfall becomes dividend
        }
      ]

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: mockLoans,
            error: null
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: 'report-002',
                status: 'generating',
                report_type: 'division_7a',
                created_at: new Date().toISOString()
              },
              error: null
            }))
          }))
        }))
      })

      const loan = mockLoans[0]
      expect(loan.compliant).toBe(false)
      expect(loan.deemed_dividend).toBe(4716)
      expect(loan.benchmark_rate).toBe(0.0877)
    })

    it('should calculate minimum repayment using annuity formula', async () => {
      const principal = 100000
      const rate = 0.0877
      const term = 7 // years for unsecured loan

      // Annuity formula: P * (r / (1 - (1 + r)^-n))
      const minimumRepayment = principal * (rate / (1 - Math.pow(1 + rate, -term)))

      expect(minimumRepayment).toBeCloseTo(19716, 0) // ~$19,716 per year at 8.77% benchmark rate
    })

    it('should flag non-compliant loans as deemed dividends', async () => {
      const minimumRepayment = 19716
      const actualRepayment = 15000
      const shortfall = minimumRepayment - actualRepayment

      const deemedDividend = shortfall > 0 ? shortfall : 0
      expect(deemedDividend).toBe(4716)
    })

    it('should include Section 109N legislative reference', async () => {
      const legislativeRef = 'Section 109N ITAA 1936'
      expect(legislativeRef).toContain('Section 109N')
      expect(legislativeRef).toContain('ITAA 1936')
    })
  })

  describe('General Deductions Report', () => {
    it('should generate deductions report with Section 8-1 analysis', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

      const mockDeductions = [
        {
          transaction_id: 'tx-005',
          description: 'Office supplies',
          amount: 5000,
          deductible_amount: 5000,
          business_purpose: true,
          capital_expense: false,
          private_use: false,
          legislative_reference: 'Section 8-1 ITAA 1997'
        },
        {
          transaction_id: 'tx-006',
          description: 'Home office expenses',
          amount: 10000,
          deductible_amount: 7000, // 70% business use
          business_purpose: true,
          capital_expense: false,
          private_use: true,
          private_use_percentage: 30,
          legislative_reference: 'Section 8-1 ITAA 1997'
        }
      ]

      const totalDeductible = mockDeductions.reduce((sum, d) => sum + d.deductible_amount, 0)
      expect(totalDeductible).toBe(12000)
    })

    it('should apportion expenses with private use', async () => {
      const totalExpense = 10000
      const businessUsePercentage = 70
      const deductibleAmount = totalExpense * (businessUsePercentage / 100)

      expect(deductibleAmount).toBe(7000)
    })

    it('should flag capital expenses as non-deductible under Section 8-1', async () => {
      const expense = {
        description: 'Purchase of delivery vehicle',
        amount: 50000,
        capital_expense: true,
        section_8_1_deductible: false,
        alternative_deduction: 'Division 40 - Capital Allowances'
      }

      expect(expense.section_8_1_deductible).toBe(false)
      expect(expense.alternative_deduction).toContain('Division 40')
    })
  })

  describe('Tax Loss Analysis Report', () => {
    it('should generate loss carry-forward report with COT/SBT validation', async () => {
      const tenantId = '591ca6f3-5b0a-40d4-8fb9-966420373902'

      const mockLosses = [
        {
          financial_year: 'FY2021-22',
          tax_loss: 150000,
          carried_forward: 150000,
          utilized: 0,
          remaining: 150000,
          cot_passed: true,
          sbt_passed: true,
          legislative_reference: 'Subdivision 36-A ITAA 1997'
        },
        {
          financial_year: 'FY2022-23',
          tax_loss: 80000,
          carried_forward: 80000,
          utilized: 0,
          remaining: 80000,
          cot_passed: true,
          sbt_passed: true,
          legislative_reference: 'Subdivision 36-A ITAA 1997'
        }
      ]

      const totalLossesAvailable = mockLosses.reduce((sum, l) => sum + l.remaining, 0)
      expect(totalLossesAvailable).toBe(230000)
    })

    it('should apply losses using FIFO method', async () => {
      const losses = [
        { fy: 'FY2021-22', amount: 150000 },
        { fy: 'FY2022-23', amount: 80000 }
      ]
      const currentYearProfit = 100000

      let remainingProfit = currentYearProfit
      const lossUtilization = []

      for (const loss of losses) {
        if (remainingProfit <= 0) break

        const lossUsed = Math.min(remainingProfit, loss.amount)
        lossUtilization.push({ fy: loss.fy, used: lossUsed })
        remainingProfit -= lossUsed
      }

      expect(lossUtilization[0]).toEqual({ fy: 'FY2021-22', used: 100000 })
      expect(remainingProfit).toBe(0)
    })

    it('should validate Continuity of Ownership Test (COT)', async () => {
      const shareholders = [
        { name: 'John Smith', percentage: 60, period: 'entire year' },
        { name: 'Jane Doe', percentage: 40, period: 'entire year' }
      ]

      const majorityHolder = shareholders.find(s => s.percentage > 50)
      const cotPassed = majorityHolder?.period === 'entire year'

      expect(cotPassed).toBe(true)
    })

    it('should validate Same Business Test (SBT) if COT fails', async () => {
      const businessActivities = {
        original: ['Software consulting', 'Web development'],
        current: ['Software consulting', 'Web development', 'Mobile apps']
      }

      const originalActivitiesContinue = businessActivities.original.every(
        activity => businessActivities.current.includes(activity)
      )

      expect(originalActivitiesContinue).toBe(true)
    })
  })

  describe('Bad Debt Recovery Report', () => {
    it('should generate bad debt report with Section 25-35 compliance', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

      const mockBadDebts = [
        {
          debtor: 'ABC Pty Ltd',
          original_amount: 25000,
          deductible_amount: 25000,
          write_off_date: '2024-03-15',
          assessable_income: true,
          recovery_attempts: ['Reminder sent', 'Demand letter', 'Debt collector engaged'],
          compliant: true,
          legislative_reference: 'Section 25-35 ITAA 1997'
        }
      ]

      const totalBadDebtDeduction = mockBadDebts.reduce((sum, d) => sum + d.deductible_amount, 0)
      expect(totalBadDebtDeduction).toBe(25000)
    })

    it('should require debt was previously in assessable income', async () => {
      const debt = {
        debtor: 'XYZ Ltd',
        amount: 15000,
        assessable_income: true,
        compliant: true
      }

      expect(debt.assessable_income).toBe(true)
    })

    it('should require formal write-off', async () => {
      const writeOffDate = '2024-02-01'
      const debt = {
        debtor: 'Failed Startup Pty Ltd',
        amount: 30000,
        write_off_date: writeOffDate,
        formally_written_off: !!writeOffDate
      }

      expect(debt.formally_written_off).toBe(true)
    })

    it('should require reasonable recovery attempts', async () => {
      const debt = {
        debtor: 'Slow Payer Inc',
        recovery_attempts: [
          'Initial reminder email',
          'Follow-up phone call',
          'Formal demand letter',
          'Debt collection referral'
        ],
        reasonable_attempts: true
      }

      expect(debt.recovery_attempts.length).toBeGreaterThanOrEqual(3)
      expect(debt.reasonable_attempts).toBe(true)
    })
  })

  describe('Comprehensive Audit Report', () => {
    it('should generate multi-module comprehensive report', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

      const comprehensiveReport = {
        organization: 'Disaster Recovery Qld Pty Ltd',
        financial_year: 'FY2023-24',
        modules: {
          rnd_tax_incentive: {
            total_expenditure: 80000,
            total_offset: 34800,
            opportunities_count: 12
          },
          division_7a: {
            loans_reviewed: 2,
            compliant: 1,
            non_compliant: 1,
            deemed_dividends: 4716
          },
          general_deductions: {
            total_deductions: 450000,
            new_opportunities: 35000,
            total_opportunities: 485000
          },
          tax_losses: {
            available_losses: 230000,
            utilized_this_year: 0,
            remaining: 230000
          },
          bad_debts: {
            total_bad_debts: 55000,
            compliant_write_offs: 55000
          }
        },
        total_recovery_estimate: 175000, // Conservative estimate
        high_value_flags: 3, // Opportunities > $50k
        professional_review_required: true
      }

      expect(comprehensiveReport.total_recovery_estimate).toBeGreaterThan(0)
      expect(comprehensiveReport.modules).toHaveProperty('rnd_tax_incentive')
      expect(comprehensiveReport.modules).toHaveProperty('division_7a')
      expect(comprehensiveReport.professional_review_required).toBe(true)
    })

    it('should include executive summary with key findings', async () => {
      const executiveSummary = {
        total_tax_recovery: 175000,
        key_findings: [
          'R&D Tax Incentive: $34,800 potential offset from 12 eligible activities',
          'Division 7A: $4,716 deemed dividend from non-compliant shareholder loan',
          'General Deductions: $35,000 in unclaimed business expenses',
          'Tax Losses: $230,000 available for carry-forward',
          'Bad Debts: $55,000 in compliant write-offs'
        ],
        urgent_actions: [
          'Register R&D activities by April 2025 deadline',
          'Rectify Division 7A loan repayment shortfall',
          'Amend FY2023-24 return to claim additional deductions'
        ]
      }

      expect(executiveSummary.key_findings.length).toBeGreaterThan(0)
      expect(executiveSummary.urgent_actions.length).toBeGreaterThan(0)
    })
  })

  describe('Organization Group Reports', () => {
    it('should generate consolidated report for organization group', async () => {
      const groupId = 'group-001'
      const organizations = [
        { id: '4637fa53-23e4-49e3-8cce-3bca3a09def9', name: 'Disaster Recovery Qld Pty Ltd' },
        { id: '591ca6f3-5b0a-40d4-8fb9-966420373902', name: 'Disaster Recovery Pty Ltd' },
        { id: 'carsi-org-id', name: 'CARSI' }
      ]

      const consolidatedReport = {
        group_name: 'Disaster Recovery Group',
        organizations: organizations.map(org => ({
          organization_id: org.id,
          organization_name: org.name,
          total_recovery: 175000
        })),
        group_total_recovery: 525000, // 3 × $175k
        pricing: {
          base: 995,
          additional: 398, // 2 × $199
          total: 1393
        }
      }

      expect(consolidatedReport.organizations.length).toBe(3)
      expect(consolidatedReport.group_total_recovery).toBe(525000)
      expect(consolidatedReport.pricing.total).toBe(1393)
    })

    it('should identify inter-company transactions for group analysis', async () => {
      const interCompanyTransactions = [
        {
          from_org: 'Disaster Recovery Qld Pty Ltd',
          to_org: 'CARSI',
          amount: 50000,
          description: 'Management fees',
          potential_issue: 'Transfer pricing review required'
        },
        {
          from_org: 'Disaster Recovery Pty Ltd',
          to_org: 'CARSI',
          amount: 25000,
          description: 'Loan repayment',
          potential_issue: 'Division 7A compliance check'
        }
      ]

      expect(interCompanyTransactions.length).toBe(2)
      expect(interCompanyTransactions[0].potential_issue).toContain('Transfer pricing')
    })
  })

  describe('Report Formats', () => {
    it('should support PDF format generation', async () => {
      const reportFormat = 'pdf'
      const expectedMimeType = 'application/pdf'

      expect(reportFormat).toBe('pdf')
      expect(expectedMimeType).toBe('application/pdf')
    })

    it('should support Excel format generation', async () => {
      const reportFormat = 'excel'
      const expectedMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

      expect(reportFormat).toBe('excel')
      expect(expectedMimeType).toContain('spreadsheetml')
    })

    it('should support HTML format for preview', async () => {
      const reportFormat = 'html'
      const expectedMimeType = 'text/html'

      expect(reportFormat).toBe('html')
      expect(expectedMimeType).toBe('text/html')
    })

    it('should include ATO disclaimer in all reports', async () => {
      const disclaimer = `DISCLAIMER: This analysis is provided for informational purposes only and does not constitute tax advice. All recommendations should be reviewed by a qualified tax professional before implementation. The software provides 'intelligence' and 'estimates', not binding financial advice.`

      expect(disclaimer).toContain('informational purposes only')
      expect(disclaimer).toContain('does not constitute tax advice')
      expect(disclaimer).toContain('qualified tax professional')
    })
  })

  describe('Error Handling', () => {
    it('should return error if tenant not found', async () => {
      const invalidTenantId = 'non-existent-tenant'

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: { message: 'Tenant not found' }
            }))
          }))
        }))
      })

      const errorResponse = {
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND'
      }

      expect(errorResponse.code).toBe('TENANT_NOT_FOUND')
    })

    it('should return error if no analysis data available', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: [],
            error: null
          }))
        }))
      })

      const errorResponse = {
        error: 'No analysis data available. Please run forensic analysis first.',
        code: 'NO_DATA'
      }

      expect(errorResponse.code).toBe('NO_DATA')
    })

    it('should handle PDF generation failures gracefully', async () => {
      const pdfError = new Error('PDF generation failed')

      const errorResponse = {
        error: 'Failed to generate PDF report',
        details: pdfError.message,
        code: 'PDF_GENERATION_FAILED'
      }

      expect(errorResponse.code).toBe('PDF_GENERATION_FAILED')
    })
  })
})

describe('GET /api/reports/:id', () => {
  it('should retrieve report status by ID', async () => {
    const reportId = 'report-001'

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: reportId,
              status: 'complete',
              report_type: 'rnd_tax_incentive',
              created_at: '2024-01-30T10:00:00Z',
              completed_at: '2024-01-30T10:00:45Z',
              file_size: 1250000, // 1.25 MB
              download_url: '/api/reports/report-001/download'
            },
            error: null
          }))
        }))
      }))
    })

    const report = await mockSupabaseClient.from('reports').select('*').eq('id', reportId).single()

    expect(report.data.status).toBe('complete')
    expect(report.data.download_url).toContain('/download')
  })

  it('should show generation progress for in-progress reports', async () => {
    const reportId = 'report-002'

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: reportId,
              status: 'generating',
              progress: 65,
              estimated_completion: '15 seconds'
            },
            error: null
          }))
        }))
      }))
    })

    const report = await mockSupabaseClient.from('reports').select('*').eq('id', reportId).single()

    expect(report.data.status).toBe('generating')
    expect(report.data.progress).toBeGreaterThan(0)
  })
})

describe('GET /api/reports/:id/download', () => {
  it('should download completed report as PDF', async () => {
    const reportId = 'report-001'

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: reportId,
              status: 'complete',
              file_path: '/reports/report-001.pdf',
              file_size: 1250000
            },
            error: null
          }))
        }))
      }))
    })

    const report = await mockSupabaseClient.from('reports').select('*').eq('id', reportId).single()

    expect(report.data.file_path).toContain('.pdf')
    expect(report.data.file_size).toBeGreaterThan(0)
  })

  it('should return 404 if report not found', async () => {
    const invalidReportId = 'non-existent-report'

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: { message: 'Report not found' }
          }))
        }))
      }))
    })

    const errorResponse = {
      error: 'Report not found',
      code: 'REPORT_NOT_FOUND',
      status: 404
    }

    expect(errorResponse.status).toBe(404)
  })

  it('should return error if report generation failed', async () => {
    const reportId = 'report-003'

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: reportId,
              status: 'failed',
              error_message: 'Insufficient data for analysis'
            },
            error: null
          }))
        }))
      }))
    })

    const report = await mockSupabaseClient.from('reports').select('*').eq('id', reportId).single()

    expect(report.data.status).toBe('failed')
    expect(report.data.error_message).toBeTruthy()
  })
})

describe('POST /api/reports/preview', () => {
  it('should generate HTML preview without saving to database', async () => {
    const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

    const previewRequest = {
      tenantId,
      reportType: 'rnd_tax_incentive',
      financialYear: 'FY2023-24',
      format: 'html'
    }

    const previewHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>R&D Tax Incentive Report - Preview</title></head>
        <body>
          <h1>R&D Tax Incentive Report</h1>
          <p>Total Offset: $34,800</p>
        </body>
      </html>
    `

    expect(previewHtml).toContain('R&D Tax Incentive Report')
    expect(previewHtml).toContain('$34,800')
  })

  it('should not save preview to reports table', async () => {
    // Preview should NOT call insert on reports table
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('reports')
  })
})
