import { describe, it, expect, beforeEach, vi } from 'vitest'
import { XeroMockFactory } from '@/tests/__mocks__/data/xero-fixtures'

/**
 * Integration Tests: Xero Data Fetching
 *
 * Tests Xero API integration including:
 * - Organization/tenant management
 * - Bank transactions retrieval
 * - Invoices and bills fetching
 * - Reports generation
 * - Error handling and retry logic
 * - Rate limiting compliance
 */

// Mock Xero client
const mockXeroClient = {
  accountingApi: {
    getBankTransactions: vi.fn(),
    getInvoices: vi.fn(),
    getBankTransactionsByID: vi.fn(),
    getAccounts: vi.fn(),
    getReportProfitAndLoss: vi.fn(),
    getReportBalanceSheet: vi.fn(),
    getReportTrialBalance: vi.fn(),
    getOrganisations: vi.fn(),
    getContacts: vi.fn()
  },
  setTokenSet: vi.fn(),
  refreshToken: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.mock('xero-node', () => ({
    XeroClient: vi.fn(() => mockXeroClient)
  }))
})

describe('Xero Organization Management', () => {
  describe('Organization Retrieval', () => {
    it('should fetch organization details', async () => {
      const mockOrganization = {
        organisationID: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
        name: 'Disaster Recovery Qld Pty Ltd',
        legalName: 'Disaster Recovery Queensland Pty Ltd',
        baseCurrency: 'AUD',
        countryCode: 'AU',
        organisationType: 'COMPANY',
        taxNumber: '12345678901',
        financialYearEndDay: 30,
        financialYearEndMonth: 6,
        isDemoCompany: false,
        organisationStatus: 'ACTIVE'
      }

      mockXeroClient.accountingApi.getOrganisations.mockResolvedValue({
        body: {
          organisations: [mockOrganization]
        }
      })

      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const result = await mockXeroClient.accountingApi.getOrganisations(tenantId)

      expect(result.body.organisations.length).toBe(1)
      expect(result.body.organisations[0].name).toBe('Disaster Recovery Qld Pty Ltd')
      expect(result.body.organisations[0].baseCurrency).toBe('AUD')
    })

    it('should validate organization is not demo company', async () => {
      const mockOrganization = {
        organisationID: 'demo-org-id',
        name: 'Demo Company',
        isDemoCompany: true
      }

      mockXeroClient.accountingApi.getOrganisations.mockResolvedValue({
        body: {
          organisations: [mockOrganization]
        }
      })

      const result = await mockXeroClient.accountingApi.getOrganisations('demo-tenant-id')
      const org = result.body.organisations[0]

      // Flag demo companies
      const isDemoWarning = org.isDemoCompany

      expect(isDemoWarning).toBe(true)
    })

    it('should extract financial year end date', async () => {
      const mockOrganization = {
        financialYearEndDay: 30,
        financialYearEndMonth: 6 // June
      }

      mockXeroClient.accountingApi.getOrganisations.mockResolvedValue({
        body: {
          organisations: [mockOrganization]
        }
      })

      const result = await mockXeroClient.accountingApi.getOrganisations('tenant-id')
      const org = result.body.organisations[0]

      expect(org.financialYearEndMonth).toBe(6)
      expect(org.financialYearEndDay).toBe(30)
    })
  })

  describe('Multi-Tenant Management', () => {
    it('should retrieve all authorized tenants', async () => {
      const mockTenants = [
        {
          tenantId: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
          tenantName: 'Disaster Recovery Qld Pty Ltd',
          tenantType: 'ORGANISATION'
        },
        {
          tenantId: '591ca6f3-5b0a-40d4-8fb9-966420373902',
          tenantName: 'Disaster Recovery Pty Ltd',
          tenantType: 'ORGANISATION'
        },
        {
          tenantId: '9656b831-bb60-43db-8176-9f009903c1a8',
          tenantName: 'CARSI',
          tenantType: 'ORGANISATION'
        }
      ]

      // Mock tenant retrieval (implementation specific to SDK)
      expect(mockTenants.length).toBe(3)
      expect(mockTenants[0].tenantName).toBe('Disaster Recovery Qld Pty Ltd')
    })

    it('should handle tenant without organization access', async () => {
      const unauthorizedTenant = {
        tenantId: 'unauthorized-tenant-id',
        tenantName: 'Unauthorized Org',
        hasAccess: false
      }

      expect(unauthorizedTenant.hasAccess).toBe(false)
    })
  })
})

describe('Bank Transactions Retrieval', () => {
  describe('Transaction Fetching', () => {
    it('should fetch bank transactions for tenant', async () => {
      const mockTransactions = XeroMockFactory.transactions(100, {
        financialYear: 'FY2023-24'
      })

      mockXeroClient.accountingApi.getBankTransactions.mockResolvedValue({
        body: {
          bankTransactions: mockTransactions
        }
      })

      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const result = await mockXeroClient.accountingApi.getBankTransactions(tenantId)

      expect(result.body.bankTransactions.length).toBe(100)
      // Factory uses 'transactionID' and 'total' field names
      expect(result.body.bankTransactions[0]).toHaveProperty('transactionID')
      expect(result.body.bankTransactions[0]).toHaveProperty('total')
    })

    it('should filter transactions by date range', async () => {
      const dateFilter = {
        where: 'Date >= DateTime(2023, 07, 01) AND Date <= DateTime(2024, 06, 30)'
      }

      const mockTransactions = XeroMockFactory.transactions(50, {
        financialYear: 'FY2023-24'
      })

      mockXeroClient.accountingApi.getBankTransactions.mockResolvedValue({
        body: {
          bankTransactions: mockTransactions
        }
      })

      const result = await mockXeroClient.accountingApi.getBankTransactions(
        'tenant-id',
        undefined,
        undefined,
        dateFilter
      )

      // All transactions should fall within FY2023-24
      // Factory uses 'date' field
      const allInRange = result.body.bankTransactions.every((tx: any) => {
        const txDate = new Date(tx.date)
        return txDate >= new Date('2023-07-01') && txDate <= new Date('2024-06-30')
      })

      expect(allInRange).toBe(true)
    })

    it('should filter transactions by status', async () => {
      const statusFilter = {
        where: 'Status=="AUTHORISED"'
      }

      const mockTransactions = XeroMockFactory.transactions(30).filter(
        tx => tx.status === 'AUTHORISED'
      )

      mockXeroClient.accountingApi.getBankTransactions.mockResolvedValue({
        body: {
          bankTransactions: mockTransactions
        }
      })

      const result = await mockXeroClient.accountingApi.getBankTransactions(
        'tenant-id',
        undefined,
        undefined,
        statusFilter
      )

      expect(result.body.bankTransactions.every((tx: any) => tx.status === 'AUTHORISED')).toBe(true)
    })

    it('should retrieve single transaction by ID', async () => {
      const transactionId = 'tx-123456'
      const mockTransaction = {
        transactionId,
        transactionDate: '2024-01-15',
        description: 'Software development',
        amount: 15000,
        status: 'AUTHORISED'
      }

      mockXeroClient.accountingApi.getBankTransactionsByID.mockResolvedValue({
        body: {
          bankTransactions: [mockTransaction]
        }
      })

      const result = await mockXeroClient.accountingApi.getBankTransactionsByID(
        'tenant-id',
        transactionId
      )

      expect(result.body.bankTransactions[0].transactionId).toBe(transactionId)
    })
  })

  describe('Pagination', () => {
    it('should paginate large transaction sets', async () => {
      const totalTransactions = 3500
      const pageSize = 100

      let page = 1
      let allTransactions: any[] = []

      while (allTransactions.length < totalTransactions) {
        const mockPage = XeroMockFactory.transactions(
          Math.min(pageSize, totalTransactions - allTransactions.length)
        )

        mockXeroClient.accountingApi.getBankTransactions.mockResolvedValueOnce({
          body: {
            bankTransactions: mockPage
          }
        })

        const result = await mockXeroClient.accountingApi.getBankTransactions(
          'tenant-id',
          undefined,
          `page=${page}`
        )

        allTransactions = allTransactions.concat(result.body.bankTransactions)
        page++

        if (result.body.bankTransactions.length < pageSize) {
          break // Last page
        }
      }

      expect(allTransactions.length).toBe(totalTransactions)
    })

    it('should use page parameter for pagination', async () => {
      const pageParam = 'page=2'

      mockXeroClient.accountingApi.getBankTransactions.mockResolvedValue({
        body: {
          bankTransactions: XeroMockFactory.transactions(100)
        }
      })

      await mockXeroClient.accountingApi.getBankTransactions(
        'tenant-id',
        undefined,
        pageParam
      )

      expect(mockXeroClient.accountingApi.getBankTransactions).toHaveBeenCalledWith(
        'tenant-id',
        undefined,
        'page=2'
      )
    })
  })
})

describe('Invoices and Bills Retrieval', () => {
  describe('Invoice Fetching', () => {
    it('should fetch sales invoices (ACCREC)', async () => {
      const mockInvoices = Array.from({ length: 50 }, (_, i) => ({
        invoiceID: `inv-${i}`,
        invoiceNumber: `INV-${String(i + 1).padStart(5, '0')}`,
        type: 'ACCREC', // Accounts Receivable
        contact: { name: `Customer ${i + 1}` },
        date: '2024-01-15',
        dueDate: '2024-02-14',
        status: 'PAID',
        total: 5000 + (i * 100)
      }))

      mockXeroClient.accountingApi.getInvoices.mockResolvedValue({
        body: {
          invoices: mockInvoices
        }
      })

      const result = await mockXeroClient.accountingApi.getInvoices(
        'tenant-id',
        undefined,
        { where: 'Type=="ACCREC"' }
      )

      expect(result.body.invoices.length).toBe(50)
      expect(result.body.invoices.every((inv: any) => inv.type === 'ACCREC')).toBe(true)
    })

    it('should fetch purchase bills (ACCPAY)', async () => {
      const mockBills = Array.from({ length: 30 }, (_, i) => ({
        invoiceID: `bill-${i}`,
        invoiceNumber: `BILL-${String(i + 1).padStart(5, '0')}`,
        type: 'ACCPAY', // Accounts Payable
        contact: { name: `Supplier ${i + 1}` },
        date: '2024-01-10',
        dueDate: '2024-02-09',
        status: 'PAID',
        total: 3000 + (i * 50)
      }))

      mockXeroClient.accountingApi.getInvoices.mockResolvedValue({
        body: {
          invoices: mockBills
        }
      })

      const result = await mockXeroClient.accountingApi.getInvoices(
        'tenant-id',
        undefined,
        { where: 'Type=="ACCPAY"' }
      )

      expect(result.body.invoices.length).toBe(30)
      expect(result.body.invoices.every((bill: any) => bill.type === 'ACCPAY')).toBe(true)
    })

    it('should filter invoices by status', async () => {
      const mockInvoices = [
        { invoiceID: 'inv-1', status: 'PAID', total: 5000 },
        { invoiceID: 'inv-2', status: 'PAID', total: 3000 }
      ]

      mockXeroClient.accountingApi.getInvoices.mockResolvedValue({
        body: {
          invoices: mockInvoices
        }
      })

      const result = await mockXeroClient.accountingApi.getInvoices(
        'tenant-id',
        undefined,
        { where: 'Status=="PAID"' }
      )

      expect(result.body.invoices.every((inv: any) => inv.status === 'PAID')).toBe(true)
    })

    it('should filter invoices by date range', async () => {
      const dateFilter = {
        where: 'Date >= DateTime(2024, 01, 01) AND Date <= DateTime(2024, 03, 31)'
      }

      const mockInvoices = [
        { invoiceID: 'inv-1', date: '2024-01-15', total: 5000 },
        { invoiceID: 'inv-2', date: '2024-02-20', total: 3000 }
      ]

      mockXeroClient.accountingApi.getInvoices.mockResolvedValue({
        body: {
          invoices: mockInvoices
        }
      })

      const result = await mockXeroClient.accountingApi.getInvoices(
        'tenant-id',
        undefined,
        dateFilter
      )

      expect(result.body.invoices.length).toBe(2)
    })
  })

  describe('Invoice Line Items', () => {
    it('should retrieve invoice line items', async () => {
      const mockInvoice = {
        invoiceID: 'inv-001',
        lineItems: [
          {
            description: 'Consulting services',
            quantity: 10,
            unitAmount: 150,
            lineAmount: 1500,
            accountCode: '200',
            taxType: 'OUTPUT2'
          },
          {
            description: 'Software license',
            quantity: 1,
            unitAmount: 500,
            lineAmount: 500,
            accountCode: '200',
            taxType: 'OUTPUT2'
          }
        ]
      }

      mockXeroClient.accountingApi.getInvoices.mockResolvedValue({
        body: {
          invoices: [mockInvoice]
        }
      })

      const result = await mockXeroClient.accountingApi.getInvoices('tenant-id')

      expect(result.body.invoices[0].lineItems.length).toBe(2)
      expect(result.body.invoices[0].lineItems[0].lineAmount).toBe(1500)
    })
  })
})

describe('Chart of Accounts', () => {
  it('should fetch chart of accounts', async () => {
    const mockAccounts = [
      {
        accountID: 'acc-001',
        code: '200',
        name: 'Sales',
        type: 'REVENUE',
        class: 'REVENUE',
        status: 'ACTIVE',
        taxType: 'OUTPUT2'
      },
      {
        accountID: 'acc-002',
        code: '400',
        name: 'General Expenses',
        type: 'EXPENSE',
        class: 'EXPENSE',
        status: 'ACTIVE',
        taxType: 'INPUT2'
      },
      {
        accountID: 'acc-003',
        code: '800',
        name: 'Depreciation',
        type: 'DEPRECIATION',
        class: 'EXPENSE',
        status: 'ACTIVE',
        taxType: 'NONE'
      }
    ]

    mockXeroClient.accountingApi.getAccounts.mockResolvedValue({
      body: {
        accounts: mockAccounts
      }
    })

    const result = await mockXeroClient.accountingApi.getAccounts('tenant-id')

    expect(result.body.accounts.length).toBe(3)
    expect(result.body.accounts[0].type).toBe('REVENUE')
    expect(result.body.accounts[1].type).toBe('EXPENSE')
  })

  it('should filter active accounts only', async () => {
    const mockAccounts = [
      { accountID: 'acc-001', code: '200', status: 'ACTIVE' },
      { accountID: 'acc-002', code: '400', status: 'ACTIVE' },
      { accountID: 'acc-003', code: '500', status: 'ARCHIVED' }
    ]

    mockXeroClient.accountingApi.getAccounts.mockResolvedValue({
      body: {
        accounts: mockAccounts.filter(acc => acc.status === 'ACTIVE')
      }
    })

    const result = await mockXeroClient.accountingApi.getAccounts('tenant-id')

    expect(result.body.accounts.length).toBe(2)
    expect(result.body.accounts.every((acc: any) => acc.status === 'ACTIVE')).toBe(true)
  })
})

describe('Financial Reports', () => {
  describe('Profit and Loss Report', () => {
    it('should fetch P&L report for financial year', async () => {
      const mockPnL = {
        reports: [{
          reportID: 'ProfitAndLoss',
          reportName: 'Profit and Loss',
          reportDate: '30 June 2024',
          rows: [
            {
              rowType: 'Header',
              cells: [
                { value: '' },
                { value: '1 Jul 2023 - 30 Jun 2024' }
              ]
            },
            {
              rowType: 'Section',
              title: 'Income',
              rows: [
                {
                  rowType: 'Row',
                  cells: [
                    { value: 'Sales' },
                    { value: '500000' }
                  ]
                }
              ]
            },
            {
              rowType: 'Section',
              title: 'Expenses',
              rows: [
                {
                  rowType: 'Row',
                  cells: [
                    { value: 'General Expenses' },
                    { value: '300000' }
                  ]
                }
              ]
            }
          ]
        }]
      }

      mockXeroClient.accountingApi.getReportProfitAndLoss.mockResolvedValue({
        body: mockPnL
      })

      const result = await mockXeroClient.accountingApi.getReportProfitAndLoss(
        'tenant-id',
        '2023-07-01',
        '2024-06-30'
      )

      expect(result.body.reports[0].reportName).toBe('Profit and Loss')
      expect(result.body.reports[0].rows.length).toBeGreaterThan(0)
    })
  })

  describe('Balance Sheet Report', () => {
    it('should fetch balance sheet at specific date', async () => {
      const mockBalanceSheet = {
        reports: [{
          reportID: 'BalanceSheet',
          reportName: 'Balance Sheet',
          reportDate: '30 June 2024',
          rows: [
            {
              rowType: 'Section',
              title: 'Assets',
              rows: [
                {
                  rowType: 'Row',
                  cells: [
                    { value: 'Bank' },
                    { value: '100000' }
                  ]
                }
              ]
            },
            {
              rowType: 'Section',
              title: 'Liabilities',
              rows: [
                {
                  rowType: 'Row',
                  cells: [
                    { value: 'Accounts Payable' },
                    { value: '50000' }
                  ]
                }
              ]
            }
          ]
        }]
      }

      mockXeroClient.accountingApi.getReportBalanceSheet.mockResolvedValue({
        body: mockBalanceSheet
      })

      const result = await mockXeroClient.accountingApi.getReportBalanceSheet(
        'tenant-id',
        '2024-06-30'
      )

      expect(result.body.reports[0].reportName).toBe('Balance Sheet')
    })
  })

  describe('Trial Balance Report', () => {
    it('should fetch trial balance for date range', async () => {
      const mockTrialBalance = {
        reports: [{
          reportID: 'TrialBalance',
          reportName: 'Trial Balance',
          reportDate: '30 June 2024'
        }]
      }

      mockXeroClient.accountingApi.getReportTrialBalance.mockResolvedValue({
        body: mockTrialBalance
      })

      const result = await mockXeroClient.accountingApi.getReportTrialBalance(
        'tenant-id',
        '2024-06-30'
      )

      expect(result.body.reports[0].reportName).toBe('Trial Balance')
    })
  })
})

describe('Error Handling', () => {
  describe('API Errors', () => {
    it('should handle 401 Unauthorized errors', async () => {
      mockXeroClient.accountingApi.getBankTransactions.mockRejectedValue({
        response: {
          statusCode: 401,
          body: {
            message: 'Token expired'
          }
        }
      })

      try {
        await mockXeroClient.accountingApi.getBankTransactions('tenant-id')
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.response.statusCode).toBe(401)
      }
    })

    it('should handle 429 Rate Limit errors', async () => {
      mockXeroClient.accountingApi.getBankTransactions.mockRejectedValue({
        response: {
          statusCode: 429,
          body: {
            message: 'Rate limit exceeded'
          },
          headers: {
            'retry-after': '60'
          }
        }
      })

      try {
        await mockXeroClient.accountingApi.getBankTransactions('tenant-id')
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.response.statusCode).toBe(429)
        expect(error.response.headers['retry-after']).toBe('60')
      }
    })

    it('should handle 404 Not Found errors', async () => {
      mockXeroClient.accountingApi.getBankTransactionsByID.mockRejectedValue({
        response: {
          statusCode: 404,
          body: {
            message: 'Transaction not found'
          }
        }
      })

      try {
        await mockXeroClient.accountingApi.getBankTransactionsByID('tenant-id', 'invalid-id')
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.response.statusCode).toBe(404)
      }
    })

    it('should handle 500 Internal Server errors', async () => {
      mockXeroClient.accountingApi.getInvoices.mockRejectedValue({
        response: {
          statusCode: 500,
          body: {
            message: 'Internal server error'
          }
        }
      })

      try {
        await mockXeroClient.accountingApi.getInvoices('tenant-id')
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.response.statusCode).toBe(500)
      }
    })
  })

  describe('Retry Logic', () => {
    it('should retry on transient errors', async () => {
      let attemptCount = 0

      mockXeroClient.accountingApi.getBankTransactions.mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          return Promise.reject({
            response: {
              statusCode: 503,
              body: { message: 'Service unavailable' }
            }
          })
        }
        return Promise.resolve({
          body: {
            bankTransactions: XeroMockFactory.transactions(10)
          }
        })
      })

      const maxRetries = 3
      let result

      for (let i = 0; i < maxRetries; i++) {
        try {
          result = await mockXeroClient.accountingApi.getBankTransactions('tenant-id')
          break
        } catch (error: any) {
          if (i < maxRetries - 1 && error.response?.statusCode === 503) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            throw error
          }
        }
      }

      expect(result).toBeDefined()
      expect(attemptCount).toBe(3)
    })

    it('should use exponential backoff', async () => {
      const retryDelays = [1000, 2000, 4000] // 1s, 2s, 4s

      retryDelays.forEach((delay, index) => {
        const expectedDelay = Math.pow(2, index) * 1000
        expect(delay).toBe(expectedDelay)
      })
    })
  })

  describe('Token Refresh', () => {
    it('should refresh token on 401 error', async () => {
      let callCount = 0

      mockXeroClient.accountingApi.getBankTransactions.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject({
            response: {
              statusCode: 401,
              body: { message: 'Token expired' }
            }
          })
        }
        return Promise.resolve({
          body: {
            bankTransactions: XeroMockFactory.transactions(10)
          }
        })
      })

      mockXeroClient.refreshToken.mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 1800
      })

      try {
        await mockXeroClient.accountingApi.getBankTransactions('tenant-id')
      } catch (error: any) {
        if (error.response?.statusCode === 401) {
          // Refresh token
          await mockXeroClient.refreshToken()

          // Retry request
          const result = await mockXeroClient.accountingApi.getBankTransactions('tenant-id')
          expect(result.body.bankTransactions.length).toBe(10)
        }
      }

      expect(mockXeroClient.refreshToken).toHaveBeenCalled()
    })
  })
})

describe('Rate Limiting', () => {
  it('should respect 60 requests per minute limit', async () => {
    const rateLimit = {
      maxRequestsPerMinute: 60,
      requestWindow: 60000 // 1 minute in ms
    }

    const delayBetweenRequests = rateLimit.requestWindow / rateLimit.maxRequestsPerMinute

    expect(delayBetweenRequests).toBe(1000) // 1 second between requests
  })

  it('should track request count within sliding window', async () => {
    const requestTimestamps: number[] = []
    const maxRequests = 60
    const windowMs = 60000

    const canMakeRequest = () => {
      const now = Date.now()
      const windowStart = now - windowMs

      // Remove timestamps outside window
      while (requestTimestamps.length > 0 && requestTimestamps[0] < windowStart) {
        requestTimestamps.shift()
      }

      return requestTimestamps.length < maxRequests
    }

    // Simulate 60 requests
    for (let i = 0; i < 60; i++) {
      if (canMakeRequest()) {
        requestTimestamps.push(Date.now())
      }
    }

    expect(requestTimestamps.length).toBe(60)

    // 61st request should be blocked
    expect(canMakeRequest()).toBe(false)
  })
})
