/**
 * @vitest-environment node
 *
 * Accountant Findings API Integration Tests
 *
 * Tests the accountant workflow API routes with mocked Supabase and auth:
 * - PATCH /api/accountant/findings/[id]/status
 * - POST /api/accountant/findings/generate
 * - POST /api/accountant/reports/generate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks -- factory functions cannot reference top-level variables.
// Use __mocks__ module-level state via vi.hoisted() instead.
// ---------------------------------------------------------------------------

const {
  mockSingle,
  mockFrom,
  mockUpdate,
  mockInsert,
  mockSelect,
  mockEq,
  mockIn,
  mockOr,
  mockOrder,
  mockLimit,
  mockGenerateFindings,
  mockReportData,
  mockExcel,
} = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })

  const qb: Record<string, unknown> = {}
  const mockSelect = vi.fn().mockReturnValue(qb)
  const mockEq = vi.fn().mockReturnValue(qb)
  const mockIn = vi.fn().mockReturnValue(qb)
  const mockOr = vi.fn().mockReturnValue(qb)
  const mockOrder = vi.fn().mockReturnValue(qb)
  const mockLimit = vi.fn().mockReturnValue(qb)
  const mockInsert = vi.fn().mockReturnValue(qb)
  const mockUpdate = vi.fn().mockReturnValue(qb)

  qb.select = mockSelect
  qb.eq = mockEq
  qb.in = mockIn
  qb.or = mockOr
  qb.order = mockOrder
  qb.limit = mockLimit
  qb.insert = mockInsert
  qb.update = mockUpdate
  qb.single = mockSingle
  qb.then = (resolve: (val: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)

  const mockFrom = vi.fn().mockReturnValue(qb)

  const mockGenerateFindings = vi.fn().mockResolvedValue({
    created: 5,
    skipped: 2,
    byArea: {
      sundries: 2, deductions: 1, fbt: 1, div7a: 1, documents: 0, reconciliation: 0,
    },
  })

  const mockReportData = vi.fn().mockResolvedValue([])
  const mockExcel = vi.fn().mockResolvedValue(Buffer.from('mock-excel-content'))

  return {
    mockSingle,
    mockFrom,
    mockUpdate,
    mockInsert,
    mockSelect,
    mockEq,
    mockIn,
    mockOr,
    mockOrder,
    mockLimit,
    mockGenerateFindings,
    mockReportData,
    mockExcel,
  }
})

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

vi.mock('@/lib/alerts/email-notifier', () => ({
  sendAlertEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    after: vi.fn(),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }),
}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'test-user', email: 'test@example.com' },
    tenantId: 'tenant-abc',
    supabase: { from: mockFrom },
  }),
  isErrorResponse: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/auth/single-user-check', () => ({
  isSingleUserMode: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/utils/financial-year', () => ({
  getCurrentFinancialYear: vi.fn().mockReturnValue('FY2024-25'),
}))

vi.mock('@/lib/accountant/forensic-findings-mapper', () => ({
  generateAccountantFindings: mockGenerateFindings,
}))

vi.mock('@/lib/reports/accountant-report-generator', () => ({
  generateAccountantReportData: mockReportData,
  generateAccountantExcel: mockExcel,
}))

vi.mock('@/lib/config/env', () => ({
  clientConfig: {
    supabase: { url: 'https://test.supabase.co', anonKey: 'test-anon-key' },
  },
  serverConfig: {
    supabase: { serviceRoleKey: 'test-service-key' },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PATCH as statusPatch } from '@/app/api/accountant/findings/[id]/status/route'
import { POST as generateFindings } from '@/app/api/accountant/findings/generate/route'
import { POST as generateReport } from '@/app/api/accountant/reports/generate/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string, body: unknown, method = 'POST'): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createPatchRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ===========================================================================
// PATCH /api/accountant/findings/[id]/status
// ===========================================================================

describe('PATCH /api/accountant/findings/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset default mock behaviour: finding exists
    mockSingle.mockResolvedValue({
      data: {
        id: 'finding-1',
        status: 'pending',
        tenant_id: 'tenant-abc',
        workflow_area: 'sundries',
        title: 'Test Finding',
      },
      error: null,
    })
  })

  it('should validate that status field is required', async () => {
    const request = createPatchRequest('/api/accountant/findings/finding-1/status', {
      // missing status
    })

    const response = await statusPatch(request, { params: Promise.resolve({ id: 'finding-1' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('status is required')
  })

  it('should validate status is one of valid values', async () => {
    const request = createPatchRequest('/api/accountant/findings/finding-1/status', {
      status: 'invalid_status',
    })

    const response = await statusPatch(request, { params: Promise.resolve({ id: 'finding-1' }) })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('approved')
    expect(json.error).toContain('rejected')
    expect(json.error).toContain('deferred')
    expect(json.error).toContain('pending')
  })

  it('should return 404 for non-existent finding', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' },
    })

    const request = createPatchRequest('/api/accountant/findings/nonexistent/status', {
      status: 'approved',
    })

    const response = await statusPatch(request, { params: Promise.resolve({ id: 'nonexistent' }) })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toContain('not found')
  })

  it('should successfully update status to approved', async () => {
    let callCount = 0
    mockSingle.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          data: { id: 'finding-1', status: 'pending', tenant_id: 'tenant-abc', workflow_area: 'sundries' },
          error: null,
        })
      }
      if (callCount === 2) {
        return Promise.resolve({
          data: { id: 'finding-1', status: 'approved', tenant_id: 'tenant-abc', updated_at: '2024-11-01T12:00:00Z' },
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const request = createPatchRequest('/api/accountant/findings/finding-1/status', {
      status: 'approved',
    })

    const response = await statusPatch(request, { params: Promise.resolve({ id: 'finding-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('approved')
    expect(json.message).toContain('approved')
  })

  it('should record rejection reason when provided', async () => {
    let callCount = 0
    mockSingle.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          data: { id: 'finding-1', status: 'pending', tenant_id: 'tenant-abc' },
          error: null,
        })
      }
      return Promise.resolve({
        data: { id: 'finding-1', status: 'rejected', tenant_id: 'tenant-abc', updated_at: new Date().toISOString() },
        error: null,
      })
    })

    const request = createPatchRequest('/api/accountant/findings/finding-1/status', {
      status: 'rejected',
      reason: 'Not eligible for R&D offset',
    })

    const response = await statusPatch(request, { params: Promise.resolve({ id: 'finding-1' }) })

    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('should record accountant notes when provided', async () => {
    let callCount = 0
    mockSingle.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          data: { id: 'finding-1', status: 'pending', tenant_id: 'tenant-abc' },
          error: null,
        })
      }
      return Promise.resolve({
        data: { id: 'finding-1', status: 'deferred', tenant_id: 'tenant-abc', updated_at: new Date().toISOString() },
        error: null,
      })
    })

    const request = createPatchRequest('/api/accountant/findings/finding-1/status', {
      status: 'deferred',
      accountantNotes: 'Needs further review with client',
    })

    const response = await statusPatch(request, { params: Promise.resolve({ id: 'finding-1' }) })

    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('should accept pending status', async () => {
    let callCount = 0
    mockSingle.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          data: { id: 'finding-1', status: 'approved', tenant_id: 'tenant-abc' },
          error: null,
        })
      }
      return Promise.resolve({
        data: { id: 'finding-1', status: 'pending', tenant_id: 'tenant-abc', updated_at: new Date().toISOString() },
        error: null,
      })
    })

    const request = createPatchRequest('/api/accountant/findings/finding-1/status', {
      status: 'pending',
    })

    const response = await statusPatch(request, { params: Promise.resolve({ id: 'finding-1' }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('pending')
  })
})

// ===========================================================================
// POST /api/accountant/findings/generate
// ===========================================================================

describe('POST /api/accountant/findings/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: xero connection found
    mockSingle.mockResolvedValue({
      data: { organization_id: 'org-123' },
      error: null,
    })

    mockGenerateFindings.mockResolvedValue({
      created: 5,
      skipped: 2,
      byArea: {
        sundries: 2, deductions: 1, fbt: 1, div7a: 1, documents: 0, reconciliation: 0,
      },
    })
  })

  it('should validate that tenantId is required', async () => {
    const request = createRequest('/api/accountant/findings/generate', {
      // missing tenantId
    })

    const response = await generateFindings(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('tenantId')
  })

  it('should validate that tenantId is a string', async () => {
    const request = createRequest('/api/accountant/findings/generate', {
      tenantId: 123,
    })

    const response = await generateFindings(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('tenantId')
  })

  it('should return error when no Xero connection exists', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' },
    })

    const request = createRequest('/api/accountant/findings/generate', {
      tenantId: 'tenant-no-xero',
    })

    const response = await generateFindings(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('Xero connection')
  })

  it('should return error when Xero connection has no organization_id', async () => {
    mockSingle.mockResolvedValue({
      data: { organization_id: null },
      error: null,
    })

    const request = createRequest('/api/accountant/findings/generate', {
      tenantId: 'tenant-no-org',
    })

    const response = await generateFindings(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('organisation')
  })

  it('should call generateAccountantFindings with correct params', async () => {
    const request = createRequest('/api/accountant/findings/generate', {
      tenantId: 'tenant-abc',
      financialYear: 'FY2024-25',
    })

    const response = await generateFindings(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(mockGenerateFindings).toHaveBeenCalledWith(
      expect.anything(), // supabase
      'tenant-abc',
      'org-123',
      'FY2024-25'
    )
  })

  it('should return byArea breakdown in response', async () => {
    const request = createRequest('/api/accountant/findings/generate', {
      tenantId: 'tenant-abc',
    })

    const response = await generateFindings(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('complete')
    expect(json.created).toBe(5)
    expect(json.skipped).toBe(2)
    expect(json.byArea).toEqual({
      sundries: 2, deductions: 1, fbt: 1, div7a: 1, documents: 0, reconciliation: 0,
    })
  })

  it('should default financial year when not provided', async () => {
    const request = createRequest('/api/accountant/findings/generate', {
      tenantId: 'tenant-abc',
    })

    await generateFindings(request)

    expect(mockGenerateFindings).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-abc',
      'org-123',
      'FY2024-25' // from mocked getCurrentFinancialYear
    )
  })
})

// ===========================================================================
// POST /api/accountant/reports/generate
// ===========================================================================

describe('POST /api/accountant/reports/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: xero connection found
    mockSingle.mockResolvedValue({
      data: { organization_id: 'org-123' },
      error: null,
    })

    // Default: findings exist
    mockReportData.mockResolvedValue([
      { id: 'f1', workflow_area: 'sundries', amount: 5000, status: 'approved' },
    ])

    mockExcel.mockResolvedValue(Buffer.from('mock-excel-content'))
  })

  it('should validate that tenantId is required', async () => {
    const request = createRequest('/api/accountant/reports/generate', {
      format: 'excel',
    })

    const response = await generateReport(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('tenantId')
  })

  it('should validate that format must be excel', async () => {
    const request = createRequest('/api/accountant/reports/generate', {
      tenantId: 'tenant-abc',
      format: 'pdf',
    })

    const response = await generateReport(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('excel')
  })

  it('should return 404 when no findings match filters', async () => {
    mockReportData.mockResolvedValue([])

    const request = createRequest('/api/accountant/reports/generate', {
      tenantId: 'tenant-abc',
      format: 'excel',
    })

    const response = await generateReport(request)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toContain('No findings')
  })

  it('should return Excel binary with correct content type', async () => {
    const request = createRequest('/api/accountant/reports/generate', {
      tenantId: 'tenant-abc',
      format: 'excel',
    })

    const response = await generateReport(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })

  it('should include Content-Disposition header for download', async () => {
    const request = createRequest('/api/accountant/reports/generate', {
      tenantId: 'tenant-abc',
      format: 'excel',
      organizationName: 'Test Corp',
    })

    const response = await generateReport(request)

    const disposition = response.headers.get('Content-Disposition')
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('Test-Corp')
    expect(disposition).toContain('.xlsx')
  })

  it('should pass workflow areas filter to report data', async () => {
    const request = createRequest('/api/accountant/reports/generate', {
      tenantId: 'tenant-abc',
      format: 'excel',
      workflowAreas: ['sundries', 'fbt'],
    })

    await generateReport(request)

    expect(mockReportData).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workflowAreas: ['sundries', 'fbt'],
      })
    )
  })

  it('should pass statuses filter to report data', async () => {
    const request = createRequest('/api/accountant/reports/generate', {
      tenantId: 'tenant-abc',
      format: 'excel',
      statuses: ['approved', 'deferred'],
    })

    await generateReport(request)

    expect(mockReportData).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        statuses: ['approved', 'deferred'],
      })
    )
  })

  it('should default statuses to approved when not provided', async () => {
    const request = createRequest('/api/accountant/reports/generate', {
      tenantId: 'tenant-abc',
      format: 'excel',
    })

    await generateReport(request)

    expect(mockReportData).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        statuses: ['approved'],
      })
    )
  })

  it('should include Content-Length header', async () => {
    const request = createRequest('/api/accountant/reports/generate', {
      tenantId: 'tenant-abc',
      format: 'excel',
    })

    const response = await generateReport(request)

    const contentLength = response.headers.get('Content-Length')
    expect(contentLength).toBeDefined()
    expect(parseInt(contentLength!, 10)).toBeGreaterThan(0)
  })
})
