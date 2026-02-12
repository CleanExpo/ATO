/**
 * Reports Generate API Route Tests
 *
 * Tests for POST /api/reports/generate.
 * Validates authentication, Zod schema validation, report generation,
 * storage upload, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock requireAuth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'test-user-id', email: 'test@example.com' },
      tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      supabase: null,
    })
  ),
  isErrorResponse: vi.fn((result: unknown) => result instanceof NextResponse),
}))

// Mock single-user check
vi.mock('@/lib/auth/single-user-check', () => ({
  isSingleUserMode: vi.fn(() => true),
}))

// Mock PDF generator
const mockGeneratePDFReportData = vi.fn()
const mockGeneratePDFReportHTML = vi.fn()

vi.mock('@/lib/reports/pdf-generator', () => ({
  generatePDFReportData: (...args: unknown[]) => mockGeneratePDFReportData(...args),
  generatePDFReportHTML: (...args: unknown[]) => mockGeneratePDFReportHTML(...args),
}))

// Mock Excel generator
const mockGenerateExcelFromTenant = vi.fn()

vi.mock('@/lib/reports/excel-generator', () => ({
  generateExcelFromTenant: (...args: unknown[]) => mockGenerateExcelFromTenant(...args),
}))

// Mock email delivery
const mockSendForensicReport = vi.fn()

vi.mock('@/lib/reports/email-delivery', () => ({
  sendForensicReport: (...args: unknown[]) => mockSendForensicReport(...args),
}))

// Mock Supabase with storage
const mockStorageUpload = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: (...args: unknown[]) => mockServiceFrom(...args),
      storage: {
        from: vi.fn(() => ({
          upload: (...args: unknown[]) => mockStorageUpload(...args),
        })),
      },
    })
  ),
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

// Mock error helpers
vi.mock('@/lib/api/errors', () => ({
  createErrorResponse: vi.fn((_error: unknown, _context: unknown, status = 500) =>
    NextResponse.json(
      { error: 'Internal error', errorId: 'abc123' },
      { status }
    )
  ),
  createValidationError: vi.fn((message: string) =>
    NextResponse.json({ error: 'Validation error', message }, { status: 400 })
  ),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/reports/generate', () => {
  const validBody = {
    tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    organizationName: 'Disaster Recovery Qld',
    abn: '12345678901',
    format: 'both',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockGeneratePDFReportData.mockResolvedValue({ summary: 'test' })
    mockGeneratePDFReportHTML.mockResolvedValue('<html><body>Report</body></html>')
    mockGenerateExcelFromTenant.mockResolvedValue(Buffer.from('xlsx-data'))
    mockStorageUpload.mockResolvedValue({ data: { path: 'reports/test.html' }, error: null })
    mockServiceFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
  })

  it('generates both PDF and Excel reports with valid input', async () => {
    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reportId).toBeDefined()
    expect(data.reportId).toMatch(/^REP-/)
    expect(data.pdfUrl).toBeDefined()
    expect(data.excelUrl).toBeDefined()
    expect(data.message).toContain('Report generated successfully')
  })

  it('requires authentication', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })

  it('validates tenantId is a valid UUID', async () => {
    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        tenantId: 'not-a-uuid',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it('validates organizationName is required', async () => {
    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: validBody.tenantId,
        abn: validBody.abn,
        format: 'pdf',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it('validates ABN must be 11 digits', async () => {
    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        abn: '123', // Too short
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it('validates format enum (pdf, excel, both)', async () => {
    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        format: 'csv', // Invalid format
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it('generates only PDF when format is pdf', async () => {
    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        format: 'pdf',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.pdfUrl).toBeDefined()
    expect(data.excelUrl).toBeUndefined()
    expect(mockGeneratePDFReportData).toHaveBeenCalled()
    expect(mockGenerateExcelFromTenant).not.toHaveBeenCalled()
  })

  it('generates only Excel when format is excel', async () => {
    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        format: 'excel',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.excelUrl).toBeDefined()
    expect(data.pdfUrl).toBeUndefined()
    expect(mockGenerateExcelFromTenant).toHaveBeenCalled()
    expect(mockGeneratePDFReportData).not.toHaveBeenCalled()
  })

  it('returns 500 when PDF generation fails', async () => {
    mockGeneratePDFReportData.mockRejectedValue(new Error('Template rendering failed'))

    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        format: 'pdf',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(500)
  })

  it('sends email when emailTo is provided', async () => {
    mockSendForensicReport.mockResolvedValue({ success: true, id: 'email-123' })

    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        emailTo: 'accountant@example.com',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.emailSent).toBe(true)
    expect(mockSendForensicReport).toHaveBeenCalledWith(
      'accountant@example.com',
      validBody.organizationName,
      expect.any(Buffer),
      expect.any(Buffer)
    )
  })

  it('validates emailTo must be valid email format', async () => {
    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        emailTo: 'not-an-email',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it('continues successfully even when email fails', async () => {
    mockSendForensicReport.mockRejectedValue(new Error('SMTP unavailable'))

    const { POST } = await import('@/app/api/reports/generate/route')

    const req = new NextRequest('http://localhost:3000/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        emailTo: 'accountant@example.com',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.emailSent).toBe(false)
  })
})
