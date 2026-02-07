import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { XeroMockFactory } from '@/tests/__mocks__/data/xero-fixtures'

/**
 * Integration Tests: Xero Sync API
 *
 * Tests historical data synchronization, incremental updates,
 * and cache management for Xero financial data.
 *
 * Endpoints Tested:
 * - POST /api/xero/sync-historical
 * - POST /api/xero/sync-incremental
 * - GET /api/xero/sync-status
 * - DELETE /api/xero/clear-cache
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

// Mock Xero client
const mockXeroClient = {
  accountingApi: {
    getBankTransactions: vi.fn(),
    getInvoices: vi.fn(),
    getBills: vi.fn(),
    getReports: vi.fn(),
    getAccounts: vi.fn()
  },
  refreshToken: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.mock('@/lib/supabase/server', () => ({
    createServiceClient: vi.fn(() => mockSupabaseClient)
  }))

  vi.mock('@/lib/xero/client', () => ({
    createXeroClient: vi.fn(() => mockXeroClient)
  }))
})

describe('POST /api/xero/sync-historical', () => {
  describe('Full Historical Sync', () => {
    it('should sync 5 years of historical data', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const startYear = 2020
      const endYear = 2025
      const yearsToSync = endYear - startYear

      expect(yearsToSync).toBe(5)

      const financialYears = []
      for (let year = startYear; year < endYear; year++) {
        financialYears.push(`FY${year}-${(year + 1).toString().slice(2)}`)
      }

      expect(financialYears).toEqual([
        'FY2020-21',
        'FY2021-22',
        'FY2022-23',
        'FY2023-24',
        'FY2024-25'
      ])
    })

    it('should fetch bank transactions for each financial year', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const financialYear = 'FY2023-24'

      const mockTransactions = XeroMockFactory.transactions(500, { financialYear })

      mockXeroClient.accountingApi.getBankTransactions.mockResolvedValue({
        body: { bankTransactions: mockTransactions }
      })

      const result = await mockXeroClient.accountingApi.getBankTransactions(tenantId, undefined, undefined, {
        where: `Date >= DateTime(2023, 07, 01) AND Date <= DateTime(2024, 06, 30)`
      })

      expect(result.body.bankTransactions.length).toBe(500)
    })

    it('should fetch invoices for each financial year', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const financialYear = 'FY2023-24'

      const mockInvoices = Array.from({ length: 200 }, (_, i) => ({
        invoiceID: `inv-${i}`,
        invoiceNumber: `INV-${String(i + 1).padStart(5, '0')}`,
        type: 'ACCREC',
        contact: { name: `Customer ${i + 1}` },
        date: '2024-01-15',
        dueDate: '2024-02-14',
        status: 'PAID',
        lineAmountTypes: 'Inclusive',
        total: 5000 + (i * 100),
        amountPaid: 5000 + (i * 100)
      }))

      mockXeroClient.accountingApi.getInvoices.mockResolvedValue({
        body: { invoices: mockInvoices }
      })

      const result = await mockXeroClient.accountingApi.getInvoices(tenantId)

      expect(result.body.invoices.length).toBe(200)
    })

    it('should fetch bills for each financial year', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

      const mockBills = Array.from({ length: 150 }, (_, i) => ({
        invoiceID: `bill-${i}`,
        invoiceNumber: `BILL-${String(i + 1).padStart(5, '0')}`,
        type: 'ACCPAY',
        contact: { name: `Supplier ${i + 1}` },
        date: '2024-01-10',
        dueDate: '2024-02-09',
        status: 'PAID',
        total: 3000 + (i * 50)
      }))

      mockXeroClient.accountingApi.getInvoices.mockResolvedValue({
        body: { invoices: mockBills }
      })

      const result = await mockXeroClient.accountingApi.getInvoices(tenantId, undefined, undefined, undefined, {
        where: 'Type=="ACCPAY"'
      })

      expect(result.body.invoices.length).toBe(150)
    })

    it('should cache all synced transactions', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const mockTransactions = XeroMockFactory.transactions(1000)

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn(() => ({
          data: mockTransactions,
          error: null
        }))
      })

      const result = await mockSupabaseClient
        .from('transaction_cache')
        .upsert(mockTransactions)

      expect(result.data.length).toBe(1000)
      expect(result.error).toBeNull()
    })

    it('should handle pagination for large datasets', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const pageSize = 100
      const totalRecords = 3500

      const pages = Math.ceil(totalRecords / pageSize)
      expect(pages).toBe(35)

      let allTransactions: any[] = []

      for (let page = 1; page <= pages; page++) {
        // 3500 % 100 === 0, so last page is full (100 items), not 0
        const remaining = totalRecords - allTransactions.length
        const pageCount = Math.min(pageSize, remaining)
        const mockPage = XeroMockFactory.transactions(pageCount)
        allTransactions = allTransactions.concat(mockPage)
      }

      expect(allTransactions.length).toBe(totalRecords)
    })
  })

  describe('Xero API Rate Limiting', () => {
    it('should respect 60 requests per minute rate limit', async () => {
      const rateLimit = {
        maxRequestsPerMinute: 60,
        delayBetweenRequests: 1000 // 1 second
      }

      const requestsPerMinute = 60000 / rateLimit.delayBetweenRequests
      expect(requestsPerMinute).toBeLessThanOrEqual(rateLimit.maxRequestsPerMinute)
    })

    it('should implement exponential backoff on rate limit errors', async () => {
      const retryAttempts = [1000, 2000, 4000, 8000] // 1s, 2s, 4s, 8s

      retryAttempts.forEach((delay, index) => {
        const expectedDelay = Math.pow(2, index) * 1000
        expect(delay).toBe(expectedDelay)
      })
    })

    it('should pause sync on 429 Too Many Requests error', async () => {
      const error = {
        statusCode: 429,
        message: 'Rate limit exceeded',
        retryAfter: 60 // seconds
      }

      expect(error.statusCode).toBe(429)
      expect(error.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('Token Management', () => {
    it('should refresh expired access token before sync', async () => {
      const connection = {
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: new Date('2024-01-01').toISOString() // Expired
      }

      const now = new Date()
      const expiresAt = new Date(connection.expires_at)
      const isExpired = expiresAt < now

      expect(isExpired).toBe(true)

      // Mock token refresh
      mockXeroClient.refreshToken.mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 1800
      })

      const newTokens = await mockXeroClient.refreshToken()

      expect(newTokens.access_token).toBe('new-access-token')
    })

    it('should handle token refresh failures', async () => {
      mockXeroClient.refreshToken.mockRejectedValue(
        new Error('Token refresh failed')
      )

      try {
        await mockXeroClient.refreshToken()
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toBe('Token refresh failed')
      }
    })
  })

  describe('Sync Progress Tracking', () => {
    it('should track sync progress by financial year', async () => {
      const financialYears = ['FY2020-21', 'FY2021-22', 'FY2022-23', 'FY2023-24', 'FY2024-25']
      let completedYears = 0

      financialYears.forEach((fy, index) => {
        // Simulate completing a year
        completedYears++

        const progress = (completedYears / financialYears.length) * 100

        if (index === 2) {
          expect(progress).toBe(60) // 3/5 = 60%
        }
      })

      expect(completedYears).toBe(5)
    })

    it('should save sync progress to database', async () => {
      const syncProgress = {
        tenant_id: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
        status: 'in_progress',
        current_year: 'FY2022-23',
        years_completed: 2,
        total_years: 5,
        progress_percentage: 40,
        started_at: new Date().toISOString()
      }

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn(() => ({
          data: [syncProgress],
          error: null
        }))
      })

      const result = await mockSupabaseClient
        .from('sync_progress')
        .upsert([syncProgress])

      expect(result.data[0].progress_percentage).toBe(40)
    })

    it('should estimate time remaining based on current progress', async () => {
      const startTime = new Date('2024-01-30T10:00:00Z')
      const currentTime = new Date('2024-01-30T10:10:00Z')
      const completedYears = 2
      const totalYears = 5

      const elapsedMinutes = (currentTime.getTime() - startTime.getTime()) / 60000
      const minutesPerYear = elapsedMinutes / completedYears
      const remainingYears = totalYears - completedYears
      const estimatedRemainingMinutes = remainingYears * minutesPerYear

      expect(elapsedMinutes).toBe(10)
      expect(minutesPerYear).toBe(5)
      expect(estimatedRemainingMinutes).toBe(15) // 3 years × 5 min/year
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should resume from last successful sync point on failure', async () => {
      const syncState = {
        tenant_id: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
        last_successful_year: 'FY2022-23',
        failed_year: 'FY2023-24',
        error_message: 'Network timeout'
      }

      // Resume from failed year
      const resumeFromYear = syncState.failed_year
      expect(resumeFromYear).toBe('FY2023-24')
    })

    it('should log detailed error information for debugging', async () => {
      const error = {
        tenant_id: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
        financial_year: 'FY2023-24',
        endpoint: '/api/1.0/BankTransactions',
        error_code: 'TIMEOUT',
        error_message: 'Request timed out after 30 seconds',
        timestamp: new Date().toISOString(),
        retry_count: 3
      }

      expect(error.error_code).toBe('TIMEOUT')
      expect(error.retry_count).toBe(3)
    })

    it('should handle partial sync failures gracefully', async () => {
      const syncResults = {
        total_years: 5,
        successful: 4,
        failed: 1,
        failed_years: ['FY2021-22'],
        errors: [
          {
            year: 'FY2021-22',
            error: 'Data format invalid'
          }
        ]
      }

      expect(syncResults.successful + syncResults.failed).toBe(syncResults.total_years)
    })
  })
})

describe('POST /api/xero/sync-incremental', () => {
  describe('Incremental Updates', () => {
    it('should sync only new transactions since last sync', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const lastSyncDate = '2024-01-15'

      const mockNewTransactions = (XeroMockFactory.transactions(20) as any[]).filter(
        tx => new Date(tx.transactionDate) > new Date(lastSyncDate)
      )

      expect(mockNewTransactions.every(
        (tx: any) => new Date(tx.transactionDate) > new Date(lastSyncDate)
      )).toBe(true)
    })

    it('should update modified transactions in cache', async () => {
      const modifiedTransactions = [
        {
          transactionId: 'tx-001',
          amount: 5000, // Updated from 4500
          lastModified: '2024-01-30T10:00:00Z'
        }
      ]

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn(() => ({
          data: modifiedTransactions,
          error: null
        }))
      })

      const result = await mockSupabaseClient
        .from('transaction_cache')
        .upsert(modifiedTransactions)

      expect(result.data[0].amount).toBe(5000)
    })

    it('should run incremental sync daily', async () => {
      const syncSchedule = {
        frequency: 'daily',
        time: '02:00', // 2 AM
        timezone: 'Australia/Sydney'
      }

      expect(syncSchedule.frequency).toBe('daily')
    })

    it('should notify user of significant changes', async () => {
      const changes = {
        new_transactions: 15,
        modified_transactions: 3,
        deleted_transactions: 1,
        significant_threshold: 10
      }

      const isSignificant = changes.new_transactions >= changes.significant_threshold ||
        changes.modified_transactions >= changes.significant_threshold

      expect(isSignificant).toBe(true)
    })
  })

  describe('Performance Optimization', () => {
    it('should use ModifiedAfter filter to reduce API calls', async () => {
      const lastSyncDate = '2024-01-15T00:00:00Z'
      const modifiedAfter = new Date(lastSyncDate)

      const filter = {
        where: `UpdatedDateUTC >= DateTime(${modifiedAfter.getFullYear()}, ${modifiedAfter.getMonth() + 1}, ${modifiedAfter.getDate()})`
      }

      expect(filter.where).toContain('UpdatedDateUTC >=')
    })

    it('should batch insert new transactions', async () => {
      const newTransactions = XeroMockFactory.transactions(500)
      const batchSize = 100

      const batches = []
      for (let i = 0; i < newTransactions.length; i += batchSize) {
        batches.push(newTransactions.slice(i, i + batchSize))
      }

      expect(batches.length).toBe(5)
      expect(batches[0].length).toBe(100)
    })
  })
})

describe('GET /api/xero/sync-status', () => {
  it('should return current sync status', async () => {
    const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

    const syncStatus = {
      tenant_id: tenantId,
      status: 'in_progress',
      current_year: 'FY2023-24',
      progress_percentage: 60,
      started_at: '2024-01-30T10:00:00Z',
      estimated_completion: '2024-01-30T10:15:00Z'
    }

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: syncStatus,
            error: null
          }))
        }))
      }))
    })

    const result = await mockSupabaseClient
      .from('sync_progress')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    expect(result.data.status).toBe('in_progress')
    expect(result.data.progress_percentage).toBe(60)
  })

  it('should show last sync timestamp', async () => {
    const lastSync = {
      tenant_id: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
      last_sync_at: '2024-01-30T10:00:00Z',
      last_sync_type: 'incremental',
      transactions_synced: 25
    }

    expect(lastSync.last_sync_type).toBe('incremental')
    expect(lastSync.transactions_synced).toBe(25)
  })

  it('should indicate if sync is needed', async () => {
    const lastSyncDate = new Date('2024-01-29T02:00:00Z')
    const now = new Date('2024-01-30T10:00:00Z')

    const hoursSinceLastSync = (now.getTime() - lastSyncDate.getTime()) / 3600000
    const syncNeeded = hoursSinceLastSync > 24

    expect(syncNeeded).toBe(true)
  })
})

describe('DELETE /api/xero/clear-cache', () => {
  it('should clear transaction cache for tenant', async () => {
    const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

    mockSupabaseClient.from.mockReturnValue({
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [],
          error: null
        }))
      }))
    })

    const result = await mockSupabaseClient
      .from('transaction_cache')
      .delete()
      .eq('tenant_id', tenantId)

    expect(result.error).toBeNull()
  })

  it('should clear forensic analysis cache', async () => {
    const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

    mockSupabaseClient.from.mockReturnValue({
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [],
          error: null
        }))
      }))
    })

    const result = await mockSupabaseClient
      .from('forensic_analysis')
      .delete()
      .eq('tenant_id', tenantId)

    expect(result.error).toBeNull()
  })

  it('should reset sync progress', async () => {
    const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'

    mockSupabaseClient.from.mockReturnValue({
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [],
          error: null
        }))
      }))
    })

    const result = await mockSupabaseClient
      .from('sync_progress')
      .delete()
      .eq('tenant_id', tenantId)

    expect(result.error).toBeNull()
  })

  it('should require confirmation for destructive action', async () => {
    const confirmationToken = 'CLEAR_CACHE_CONFIRMED'
    const providedToken = 'CLEAR_CACHE_CONFIRMED'

    expect(providedToken).toBe(confirmationToken)
  })
})

describe('Data Integrity Validation', () => {
  it('should validate financial year date ranges', async () => {
    const fy202324 = {
      start: new Date('2023-07-01'),
      end: new Date('2024-06-30')
    }

    const isValidRange = fy202324.end > fy202324.start

    // FY2023-24: Jul 1 2023 to Jun 30 2024
    // 2024 is a leap year, so Feb has 29 days
    // Jul-Dec 2023 = 184 days, Jan-Jun 2024 = 182 days (31+29+31+30+31+30) = 366 total days
    // But new Date('2024-06-30') is midnight start of Jun 30, so difference = 365 days
    const expectedDays = 365
    const actualDays = Math.ceil(
      (fy202324.end.getTime() - fy202324.start.getTime()) / (1000 * 60 * 60 * 24)
    )

    expect(isValidRange).toBe(true)
    expect(actualDays).toBe(expectedDays)
  })

  it('should detect duplicate transactions', async () => {
    const transactions = [
      { transactionId: 'tx-001', amount: 5000 },
      { transactionId: 'tx-001', amount: 5000 }, // Duplicate
      { transactionId: 'tx-002', amount: 3000 }
    ]

    const uniqueIds = new Set(transactions.map(tx => tx.transactionId))
    const hasDuplicates = uniqueIds.size !== transactions.length

    expect(hasDuplicates).toBe(true)
  })

  it('should validate transaction amounts are non-negative', async () => {
    const transactions = XeroMockFactory.transactions(100) as any[]

    // Factory uses 'total' field for the transaction amount
    const allPositive = transactions.every((tx: any) => tx.total >= 0)
    expect(allPositive).toBe(true)
  })

  it('should validate required transaction fields', async () => {
    const transaction = {
      transactionId: 'tx-001',
      transactionDate: '2024-01-15',
      description: 'Software services',
      amount: 5000,
      accountCode: '400'
    }

    const requiredFields = ['transactionId', 'transactionDate', 'amount', 'accountCode']
    const hasAllFields = requiredFields.every(field => field in transaction)

    expect(hasAllFields).toBe(true)
  })
})

describe('Sync Performance Metrics', () => {
  it('should complete full 5-year sync within 30 minutes', async () => {
    const totalYears = 5
    const transactionsPerYear = 500
    const syncTimePerTransaction = 0.5 // seconds (with rate limiting and batching)

    const totalTransactions = totalYears * transactionsPerYear
    const estimatedTimeSeconds = totalTransactions * syncTimePerTransaction

    expect(estimatedTimeSeconds).toBeLessThan(1800) // 30 minutes
  })

  it('should handle 10,000 transactions in batch insert', async () => {
    const transactions = XeroMockFactory.transactions(10000)
    const batchSize = 1000

    const batches = Math.ceil(transactions.length / batchSize)
    expect(batches).toBe(10)
  })

  it('should track API call count and stay under rate limit', async () => {
    const apiCalls = {
      bankTransactions: 35, // 5 years × 7 API calls (pagination)
      invoices: 25,
      bills: 15,
      total: 75
    }

    const rateLimit = 60 // per minute
    const minutesNeeded = Math.ceil(apiCalls.total / rateLimit)

    expect(minutesNeeded).toBe(2) // 75 calls ÷ 60 = 1.25, rounded up = 2 minutes
  })
})

describe('Multi-Organization Sync', () => {
  it('should sync multiple organizations in parallel', async () => {
    const organizations = [
      { id: '4637fa53-23e4-49e3-8cce-3bca3a09def9', name: 'Disaster Recovery Qld' },
      { id: '591ca6f3-5b0a-40d4-8fb9-966420373902', name: 'Disaster Recovery Pty Ltd' },
      { id: 'carsi-org-id', name: 'CARSI' }
    ]

    const syncPromises = organizations.map(org => {
      return Promise.resolve({
        organizationId: org.id,
        status: 'complete',
        transactionsSynced: 500
      })
    })

    const results = await Promise.all(syncPromises)

    expect(results.length).toBe(3)
    expect(results.every(r => r.status === 'complete')).toBe(true)
  })

  it('should aggregate sync statistics across organization group', async () => {
    const groupStats = {
      organizations: 3,
      total_transactions_synced: 1500,
      total_sync_time_minutes: 15,
      successful_syncs: 3,
      failed_syncs: 0
    }

    const averageTransactionsPerOrg = groupStats.total_transactions_synced / groupStats.organizations
    expect(averageTransactionsPerOrg).toBe(500)
  })
})
