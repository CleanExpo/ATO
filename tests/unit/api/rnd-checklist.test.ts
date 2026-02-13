/**
 * R&D Checklist API Route Tests
 *
 * Tests for GET /api/rnd/checklist.
 * Validates authentication, tenantId requirement, template/completion
 * merging, progress calculation, and error handling.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive claim preparation.
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
      tenantId: 'tenant-123',
      supabase: null,
    })
  ),
  isErrorResponse: vi.fn((result: unknown) => result instanceof NextResponse),
}))

// Mock single-user check
vi.mock('@/lib/auth/single-user-check', () => ({
  isSingleUserMode: vi.fn(() => true),
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
    NextResponse.json({ error: 'Internal error' }, { status })
  ),
  createValidationError: vi.fn((message: string) =>
    NextResponse.json({ error: message }, { status: 400 })
  ),
}))

// Mock rnd-checklist types
const mockMergeTemplatesWithCompletion = vi.fn()
const mockCalculateChecklistProgress = vi.fn()

vi.mock('@/lib/types/rnd-checklist', () => ({
  CHECKLIST_CATEGORIES: ['eligibility', 'documentation', 'registration', 'claim'],
  CATEGORY_CONFIG: {
    eligibility: { label: 'Eligibility', description: 'Verify R&D eligibility' },
    documentation: { label: 'Documentation', description: 'Prepare supporting documents' },
    registration: { label: 'Registration', description: 'AusIndustry registration' },
    claim: { label: 'Claim', description: 'Tax return preparation' },
  },
  dbRowToChecklistTemplate: vi.fn((row: Record<string, unknown>) => ({
    itemKey: row.item_key,
    category: row.category,
    label: row.label,
    description: row.description,
    isMandatory: row.is_mandatory,
    displayOrder: row.display_order,
  })),
  dbRowToChecklistItem: vi.fn((row: Record<string, unknown>) => ({
    itemKey: row.item_key,
    tenantId: row.tenant_id,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
  })),
  mergeTemplatesWithCompletion: (...args: unknown[]) => mockMergeTemplatesWithCompletion(...args),
  calculateChecklistProgress: (...args: unknown[]) => mockCalculateChecklistProgress(...args),
}))

// Supabase mock
const mockServiceFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: (...args: unknown[]) => mockServiceFrom(...args),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockTemplateRows = [
  {
    item_key: 'core_activity_identified',
    category: 'eligibility',
    label: 'Core R&D activity identified',
    description: 'Identify at least one core R&D activity',
    is_mandatory: true,
    display_order: 1,
  },
  {
    item_key: 'supporting_activity_linked',
    category: 'eligibility',
    label: 'Supporting activities linked',
    description: 'Link supporting activities to core activities',
    is_mandatory: false,
    display_order: 2,
  },
  {
    item_key: 'contemporaneous_records',
    category: 'documentation',
    label: 'Contemporaneous records maintained',
    description: 'Records created at time of R&D activity',
    is_mandatory: true,
    display_order: 3,
  },
]

const mockCompletionRows = [
  {
    item_key: 'core_activity_identified',
    tenant_id: 'tenant-123',
    is_completed: true,
    completed_at: '2026-02-01T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/rnd/checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: merged items with completion data
    mockMergeTemplatesWithCompletion.mockReturnValue([
      {
        itemKey: 'core_activity_identified',
        category: 'eligibility',
        label: 'Core R&D activity identified',
        isMandatory: true,
        isCompleted: true,
        displayOrder: 1,
      },
      {
        itemKey: 'supporting_activity_linked',
        category: 'eligibility',
        label: 'Supporting activities linked',
        isMandatory: false,
        isCompleted: false,
        displayOrder: 2,
      },
      {
        itemKey: 'contemporaneous_records',
        category: 'documentation',
        label: 'Contemporaneous records maintained',
        isMandatory: true,
        isCompleted: false,
        displayOrder: 3,
      },
    ])

    mockCalculateChecklistProgress.mockReturnValue({
      totalItems: 3,
      completedItems: 1,
      percentComplete: 33,
      mandatoryItems: 2,
      mandatoryCompleted: 1,
      isReadyToFile: false,
    })
  })

  it('returns checklist items with progress for tenant', async () => {
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'rnd_checklist_templates') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockTemplateRows,
              error: null,
            }),
          }),
        }
      }
      if (table === 'rnd_checklist_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockCompletionRows,
              error: null,
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    })

    const { GET } = await import('@/app/api/rnd/checklist/route')

    const req = new NextRequest('http://localhost:3000/api/rnd/checklist?tenantId=tenant-123')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.progress).toBeDefined()
    expect(data.totalTemplates).toBe(3)
    expect(data.totalCompletions).toBe(1)
  })

  it('returns 400 when tenantId is missing', async () => {
    const { GET } = await import('@/app/api/rnd/checklist/route')

    const req = new NextRequest('http://localhost:3000/api/rnd/checklist')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('tenantId')
  })

  it('requires authentication', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const { GET } = await import('@/app/api/rnd/checklist/route')

    const req = new NextRequest('http://localhost:3000/api/rnd/checklist?tenantId=tenant-123')
    const response = await GET(req)

    expect(response.status).toBe(401)
  })

  it('filters completions by registrationId when provided', async () => {
    const eqCalls: [string, string][] = []

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'rnd_checklist_templates') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockTemplateRows,
              error: null,
            }),
          }),
        }
      }
      if (table === 'rnd_checklist_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn((...args: unknown[]) => {
              eqCalls.push([args[0] as string, args[1] as string])
              return {
                eq: vi.fn((...args2: unknown[]) => {
                  eqCalls.push([args2[0] as string, args2[1] as string])
                  return Promise.resolve({
                    data: mockCompletionRows,
                    error: null,
                  })
                }),
              }
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    })

    const { GET } = await import('@/app/api/rnd/checklist/route')

    const req = new NextRequest(
      'http://localhost:3000/api/rnd/checklist?tenantId=tenant-123&registrationId=reg-456'
    )
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(eqCalls.some(([field, value]) =>
      field === 'registration_id' && value === 'reg-456'
    )).toBe(true)
  })

  it('returns 500 when template fetch fails', async () => {
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'rnd_checklist_templates') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'table does not exist' },
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    })

    const { GET } = await import('@/app/api/rnd/checklist/route')

    const req = new NextRequest('http://localhost:3000/api/rnd/checklist?tenantId=tenant-123')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })

  it('returns 500 when completion fetch fails', async () => {
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'rnd_checklist_templates') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockTemplateRows,
              error: null,
            }),
          }),
        }
      }
      if (table === 'rnd_checklist_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'permission denied' },
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    })

    const { GET } = await import('@/app/api/rnd/checklist/route')

    const req = new NextRequest('http://localhost:3000/api/rnd/checklist?tenantId=tenant-123')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })

  it('returns progress with category summaries', async () => {
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'rnd_checklist_templates') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockTemplateRows,
              error: null,
            }),
          }),
        }
      }
      if (table === 'rnd_checklist_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockCompletionRows,
              error: null,
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    })

    const { GET } = await import('@/app/api/rnd/checklist/route')

    const req = new NextRequest('http://localhost:3000/api/rnd/checklist?tenantId=tenant-123')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.progress).toHaveProperty('totalItems')
    expect(data.progress).toHaveProperty('completedItems')
    expect(data.progress).toHaveProperty('percentComplete')
    expect(data.progress).toHaveProperty('categories')
    expect(data.progress.categories).toBeInstanceOf(Array)
  })

  it('handles empty template list gracefully', async () => {
    mockMergeTemplatesWithCompletion.mockReturnValue([])
    mockCalculateChecklistProgress.mockReturnValue({
      totalItems: 0,
      completedItems: 0,
      percentComplete: 0,
      mandatoryItems: 0,
      mandatoryCompleted: 0,
      isReadyToFile: false,
    })

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'rnd_checklist_templates') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }
      }
      if (table === 'rnd_checklist_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnThis() }
    })

    const { GET } = await import('@/app/api/rnd/checklist/route')

    const req = new NextRequest('http://localhost:3000/api/rnd/checklist?tenantId=tenant-123')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.totalTemplates).toBe(0)
    expect(data.totalCompletions).toBe(0)
    expect(data.progress.totalItems).toBe(0)
  })

  it('handles thrown exceptions gracefully', async () => {
    mockServiceFrom.mockImplementation(() => {
      throw new Error('Unexpected database error')
    })

    const { GET } = await import('@/app/api/rnd/checklist/route')

    const req = new NextRequest('http://localhost:3000/api/rnd/checklist?tenantId=tenant-123')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })
})
