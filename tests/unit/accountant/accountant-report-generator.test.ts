/**
 * @vitest-environment node
 *
 * Accountant Report Generator Tests
 *
 * Tests the report generation functions in lib/reports/accountant-report-generator.ts:
 * - generateAccountantReportData: Query building with filters
 * - generateAccountantExcel: Excel workbook creation with 3 sheets
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import {
  generateAccountantReportData,
  generateAccountantExcel,
} from '@/lib/reports/accountant-report-generator'

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

interface MockFindingRow {
  id: string
  workflow_area: string
  transaction_id: string
  transaction_date: string
  description: string
  amount: number
  current_classification: string | null
  suggested_classification: string | null
  suggested_action: string | null
  confidence_score: number
  confidence_level: string
  legislation_refs: Array<{ section: string; title: string; url: string }> | null
  reasoning: string
  financial_year: string
  estimated_benefit: number | null
  status: string
  rejection_reason: string | null
  accountant_notes: string | null
  created_at: string
}

function createMockFinding(overrides: Partial<MockFindingRow> = {}): MockFindingRow {
  return {
    id: 'finding-001',
    workflow_area: 'sundries',
    transaction_id: 'txn-001',
    transaction_date: '2024-10-15',
    description: 'Test finding description',
    amount: 5000,
    current_classification: 'Office Supplies',
    suggested_classification: 'R&D Expenditure',
    suggested_action: 'Review for R&D Tax Incentive eligibility',
    confidence_score: 85,
    confidence_level: 'High',
    legislation_refs: [
      { section: 'Division 355', title: 'R&D Tax Incentive', url: 'https://ato.gov.au' },
    ],
    reasoning: 'AI analysis flagged this transaction for sundries review.',
    financial_year: 'FY2024-25',
    estimated_benefit: 2175,
    status: 'approved',
    rejection_reason: null,
    accountant_notes: null,
    created_at: '2024-11-01T10:00:00Z',
    ...overrides,
  }
}

/**
 * Create a chainable mock Supabase query builder.
 */
function createMockSupabase(
  data: unknown[] | null = [],
  error: { message: string } | null = null
) {
  const terminal = { data, error }

  const queryBuilder: Record<string, unknown> = {}
  queryBuilder.select = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.eq = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.in = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.order = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.single = vi.fn().mockResolvedValue(terminal)
  queryBuilder.then = (resolve: (val: typeof terminal) => void) => {
    return Promise.resolve(terminal).then(resolve)
  }

  const client = {
    from: vi.fn().mockReturnValue(queryBuilder),
    _queryBuilder: queryBuilder,
  }

  return client
}

// ===========================================================================
// generateAccountantReportData()
// ===========================================================================

describe('generateAccountantReportData', () => {
  it('should build query with tenant_id filter', async () => {
    const mockFindings = [createMockFinding()]
    const supabase = createMockSupabase(mockFindings)

    await generateAccountantReportData(supabase as any, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    expect(supabase.from).toHaveBeenCalledWith('accountant_findings')
    expect(supabase._queryBuilder.select).toHaveBeenCalledWith('*')
    expect(supabase._queryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-abc')
  })

  it('should filter by workflow areas when provided', async () => {
    const supabase = createMockSupabase([])

    await generateAccountantReportData(supabase as any, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
      workflowAreas: ['sundries', 'fbt'],
    })

    expect(supabase._queryBuilder.in).toHaveBeenCalledWith('workflow_area', ['sundries', 'fbt'])
  })

  it('should NOT filter by workflow areas when empty array', async () => {
    const supabase = createMockSupabase([])

    await generateAccountantReportData(supabase as any, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
      workflowAreas: [],
    })

    // .in should not be called for workflow_area
    const inCalls = (supabase._queryBuilder.in as ReturnType<typeof vi.fn>).mock.calls
    const workflowAreaCalls = inCalls.filter((c: unknown[]) => c[0] === 'workflow_area')
    expect(workflowAreaCalls.length).toBe(0)
  })

  it('should filter by statuses when provided', async () => {
    const supabase = createMockSupabase([])

    await generateAccountantReportData(supabase as any, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
      statuses: ['approved', 'pending'],
    })

    expect(supabase._queryBuilder.in).toHaveBeenCalledWith('status', ['approved', 'pending'])
  })

  it('should filter by financial year when provided', async () => {
    const supabase = createMockSupabase([])

    await generateAccountantReportData(supabase as any, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
      financialYear: 'FY2024-25',
    })

    expect(supabase._queryBuilder.eq).toHaveBeenCalledWith('financial_year', 'FY2024-25')
  })

  it('should order by workflow_area then created_at desc', async () => {
    const supabase = createMockSupabase([])

    await generateAccountantReportData(supabase as any, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    const orderCalls = (supabase._queryBuilder.order as ReturnType<typeof vi.fn>).mock.calls
    expect(orderCalls[0]).toEqual(['workflow_area'])
    expect(orderCalls[1]).toEqual(['created_at', { ascending: false }])
  })

  it('should return empty array on no data', async () => {
    const supabase = createMockSupabase(null)

    const result = await generateAccountantReportData(supabase as any, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    expect(result).toEqual([])
  })

  it('should return findings data when available', async () => {
    const findings = [createMockFinding(), createMockFinding({ id: 'finding-002' })]
    const supabase = createMockSupabase(findings)

    const result = await generateAccountantReportData(supabase as any, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    expect(result).toHaveLength(2)
  })

  it('should throw on Supabase error', async () => {
    const supabase = createMockSupabase(null, { message: 'Connection refused' })

    await expect(
      generateAccountantReportData(supabase as any, {
        organizationId: 'org-1',
        tenantId: 'tenant-abc',
      })
    ).rejects.toThrow('Failed to fetch findings')
  })
})

// ===========================================================================
// generateAccountantExcel()
// ===========================================================================

describe('generateAccountantExcel', () => {
  it('should generate a non-empty buffer', async () => {
    const findings = [createMockFinding()]
    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
      organizationName: 'Test Corp',
      financialYear: 'FY2024-25',
    })

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('should create 3 worksheets', async () => {
    const ExcelJS = await import('exceljs')
    const findings = [createMockFinding()]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
      organizationName: 'Test Corp',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    expect(workbook.worksheets).toHaveLength(3)
  })

  it('should have Summary as first sheet', async () => {
    const ExcelJS = await import('exceljs')
    const findings = [createMockFinding()]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    expect(workbook.worksheets[0].name).toBe('Summary')
  })

  it('should have Findings Detail as second sheet', async () => {
    const ExcelJS = await import('exceljs')
    const findings = [createMockFinding()]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    expect(workbook.worksheets[1].name).toBe('Findings Detail')
  })

  it('should have Legislation References as third sheet', async () => {
    const ExcelJS = await import('exceljs')
    const findings = [createMockFinding()]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    expect(workbook.worksheets[2].name).toBe('Legislation References')
  })

  it('should include organisation name in Summary sheet', async () => {
    const ExcelJS = await import('exceljs')
    const findings = [createMockFinding()]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
      organizationName: 'CARSI Pty Ltd',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    const summary = workbook.worksheets[0]
    let foundOrgName = false
    summary.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value && String(cell.value).includes('CARSI Pty Ltd')) {
          foundOrgName = true
        }
      })
    })
    expect(foundOrgName).toBe(true)
  })

  it('should include disclaimer in Summary sheet', async () => {
    const ExcelJS = await import('exceljs')
    const findings = [createMockFinding()]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    const summary = workbook.worksheets[0]
    let foundDisclaimer = false
    summary.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value && String(cell.value).includes('DISCLAIMER')) {
          foundDisclaimer = true
        }
      })
    })
    expect(foundDisclaimer).toBe(true)
  })

  it('should have 14 columns in Findings Detail', async () => {
    const ExcelJS = await import('exceljs')
    const findings = [createMockFinding()]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    const detail = workbook.worksheets[1]
    expect(detail.columns.length).toBe(14)
  })

  it('should have correct header names in Findings Detail', async () => {
    const ExcelJS = await import('exceljs')
    const findings = [createMockFinding()]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    const detail = workbook.worksheets[1]
    const headerRow = detail.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell) => {
      headers.push(String(cell.value))
    })

    expect(headers).toContain('Workflow Area')
    expect(headers).toContain('Transaction ID')
    expect(headers).toContain('Date')
    expect(headers).toContain('Description')
    expect(headers).toContain('Amount')
    expect(headers).toContain('Est. Benefit')
    expect(headers).toContain('Confidence')
    expect(headers).toContain('Status')
  })

  it('should deduplicate and sort legislation references by count', async () => {
    const ExcelJS = await import('exceljs')

    // Create findings with overlapping legislation refs
    const findings = [
      createMockFinding({
        id: 'f1',
        legislation_refs: [
          { section: 'Division 355', title: 'R&D', url: 'https://ato.gov.au/1' },
          { section: 's 8-1', title: 'Deductions', url: 'https://ato.gov.au/2' },
        ],
      }),
      createMockFinding({
        id: 'f2',
        legislation_refs: [
          { section: 'Division 355', title: 'R&D', url: 'https://ato.gov.au/1' },
        ],
      }),
      createMockFinding({
        id: 'f3',
        legislation_refs: [
          { section: 's 8-1', title: 'Deductions', url: 'https://ato.gov.au/2' },
          { section: 'Division 355', title: 'R&D', url: 'https://ato.gov.au/1' },
          { section: 'Division 7A', title: 'Loans', url: 'https://ato.gov.au/3' },
        ],
      }),
    ]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    const legSheet = workbook.worksheets[2]

    // Row 1 is header, data starts row 2
    // Division 355 referenced 3 times (first), s 8-1 referenced 2 times, Division 7A 1 time
    const row2 = legSheet.getRow(2)
    expect(row2.getCell(1).value).toBe('Division 355')
    expect(row2.getCell(4).value).toBe(3)

    const row3 = legSheet.getRow(3)
    expect(row3.getCell(1).value).toBe('s 8-1')
    expect(row3.getCell(4).value).toBe(2)

    const row4 = legSheet.getRow(4)
    expect(row4.getCell(1).value).toBe('Division 7A')
    expect(row4.getCell(4).value).toBe(1)
  })

  it('should handle findings with null legislation_refs', async () => {
    const ExcelJS = await import('exceljs')
    const findings = [createMockFinding({ legislation_refs: null })]

    const buffer = await generateAccountantExcel(findings, {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

    // Should not throw, legislation sheet should just have the header row
    const legSheet = workbook.worksheets[2]
    expect(legSheet.rowCount).toBe(1) // header only
  })

  it('should handle empty findings array', async () => {
    const buffer = await generateAccountantExcel([], {
      organizationId: 'org-1',
      tenantId: 'tenant-abc',
    })

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })
})
