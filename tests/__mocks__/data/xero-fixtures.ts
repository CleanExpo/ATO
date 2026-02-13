/**
 * Xero Mock Data Factory
 *
 * Generates realistic Xero API responses for testing without real API calls.
 * Uses @faker-js/faker for randomized but deterministic data.
 */

import { faker } from '@faker-js/faker'

// Set seed for reproducible tests
faker.seed(12345)

export class XeroMockFactory {
  /**
   * Generate mock Xero transactions
   * @param count Number of transactions to generate
   * @param options Configuration options
   */
  static transactions(count: number, options?: {
    financialYear?: string  // e.g., 'FY2023-24'
    includeRndCandidates?: boolean
    includeDiv7aLoans?: boolean
    accountTypes?: string[]
    supplier?: string
  }) {
    const fyDates = this.parseFY(options?.financialYear || 'FY2023-24')

    return Array.from({ length: count }, (_, i) => {
      const isRndCandidate = !!(options?.includeRndCandidates && Math.random() > 0.7)
      const isDiv7aLoan = !!(options?.includeDiv7aLoans && Math.random() > 0.85)

      return {
        transactionID: `tx-${faker.string.alphanumeric(10)}`,
        date: this.randomDateInRange(fyDates.start, fyDates.end),
        reference: `INV-${faker.string.numeric(6)}`,
        type: faker.helpers.arrayElement(['ACCPAY', 'ACCREC', 'SPEND']),
        status: faker.helpers.arrayElement(['AUTHORISED', 'PAID', 'VOIDED']),
        contact: {
          contactID: faker.string.uuid(),
          name: options?.supplier || faker.company.name(),
        },
        lineItems: [{
          description: this.randomDescription(isRndCandidate, isDiv7aLoan),
          quantity: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
          unitAmount: faker.number.float({ min: 10, max: 10000, fractionDigits: 2 }),
          lineAmount: faker.number.float({ min: 10, max: 100000, fractionDigits: 2 }),
          accountCode: this.randomAccountCode(options?.accountTypes),
          taxType: this.randomTaxType(),
          taxAmount: faker.number.float({ min: 0, max: 10000, fractionDigits: 2 }),
        }],
        total: faker.number.float({ min: 10, max: 100000, fractionDigits: 2 }),
        totalTax: faker.number.float({ min: 0, max: 10000, fractionDigits: 2 }),
        subTotal: faker.number.float({ min: 10, max: 100000, fractionDigits: 2 }),
        updatedDateUTC: this.randomDateInRange(fyDates.start, fyDates.end),
      }
    })
  }

  /**
   * Generate mock Xero organizations
   */
  static organizations(count: number = 3) {
    const orgNames = [
      'Disaster Recovery Qld Pty Ltd',
      'Disaster Recovery Pty Ltd',
      'CARSI'
    ]

    return Array.from({ length: count }, (_, i) => ({
      organisationID: faker.string.uuid(),
      name: orgNames[i] || faker.company.name(),
      legalName: orgNames[i] || faker.company.name(),
      baseCurrency: 'AUD',
      countryCode: 'AU',
      organisationType: 'COMPANY',
      financialYearEndDay: 30,
      financialYearEndMonth: 6,
      isDemoCompany: false,
      paysTax: true,
      version: 'AU',
      organisationStatus: 'ACTIVE',
      taxNumber: faker.string.numeric(11), // ABN
      registrationNumber: faker.string.numeric(9), // ACN
      employerIdentificationNumber: null,
      createdDateUTC: faker.date.past({ years: 5 }).toISOString(),
    }))
  }

  /**
   * Generate mock Xero tenants (for OAuth callback)
   */
  static tenants(count: number = 3) {
    const orgNames = [
      'Disaster Recovery Qld Pty Ltd',
      'Disaster Recovery Pty Ltd',
      'CARSI'
    ]

    return Array.from({ length: count }, (_, i) => ({
      tenantId: faker.string.uuid(),
      tenantName: orgNames[i] || faker.company.name(),
      tenantType: 'ORGANISATION',
      createdDateUtc: faker.date.past({ years: 5 }).toISOString(),
      updatedDateUtc: new Date().toISOString(),
    }))
  }

  /**
   * Generate mock Xero accounts (Chart of Accounts)
   */
  static accounts(count: number = 50) {
    const accountTypes = ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY']
    const accountCodes = ['200', '400', '500', '600', '800', '1000', '2000', '3000']

    return Array.from({ length: count }, (_, i) => ({
      accountID: faker.string.uuid(),
      code: accountCodes[i % accountCodes.length],
      name: faker.commerce.department(),
      type: faker.helpers.arrayElement(accountTypes),
      taxType: this.randomTaxType(),
      description: faker.commerce.productDescription(),
      class: faker.helpers.arrayElement(['ASSET', 'EXPENSE', 'REVENUE']),
      status: 'ACTIVE',
      enablePaymentsToAccount: false,
      showInExpenseClaims: true,
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString(),
    }))
  }

  /**
   * Generate mock Xero reports (P&L, Balance Sheet)
   */
  static profitAndLossReport(financialYear: string = 'FY2023-24') {
    const fyDates = this.parseFY(financialYear)

    return {
      reportID: faker.string.uuid(),
      reportName: 'ProfitAndLoss',
      reportType: 'ProfitAndLoss',
      reportTitles: ['Profit and Loss', `${financialYear}`],
      reportDate: fyDates.end.toISOString().split('T')[0],
      updatedDateUTC: new Date().toISOString(),
      rows: [
        {
          rowType: 'Header',
          cells: [
            { value: 'Account' },
            { value: 'Total' },
          ],
        },
        {
          rowType: 'Section',
          title: 'Revenue',
          rows: [
            {
              rowType: 'Row',
              cells: [
                { value: 'Sales' },
                { value: faker.number.float({ min: 100000, max: 1000000, fractionDigits: 2 }).toString() },
              ],
            },
          ],
        },
        {
          rowType: 'Section',
          title: 'Expenses',
          rows: [
            {
              rowType: 'Row',
              cells: [
                { value: 'Cost of Goods Sold' },
                { value: faker.number.float({ min: 50000, max: 500000, fractionDigits: 2 }).toString() },
              ],
            },
            {
              rowType: 'Row',
              cells: [
                { value: 'Operating Expenses' },
                { value: faker.number.float({ min: 20000, max: 200000, fractionDigits: 2 }).toString() },
              ],
            },
          ],
        },
      ],
    }
  }

  // ============================================================
  // PRIVATE HELPER METHODS
  // ============================================================

  private static randomDescription(isRnd: boolean, isDiv7a: boolean): string {
    if (isRnd) {
      return faker.helpers.arrayElement([
        'Software development - experimental prototype testing',
        'R&D equipment purchase - novel testing apparatus',
        'Laboratory consumables - hypothesis validation experiments',
        'Data analysis services - algorithm development and optimization',
        'Research consulting - feasibility study for new technology',
        'Prototype materials - iterative design testing',
        'Scientific instrument calibration - measurement accuracy improvement',
      ])
    }

    if (isDiv7a) {
      return faker.helpers.arrayElement([
        'Loan to shareholder - personal use',
        'Director loan account adjustment',
        'Shareholder distribution - dividend alternative',
        'Related party transaction - private company loan',
      ])
    }

    return faker.helpers.arrayElement([
      faker.commerce.productDescription(),
      `${faker.commerce.product()} purchase`,
      `${faker.company.buzzPhrase()} services`,
      `Professional fees - ${faker.person.jobTitle()}`,
      `Subscription - ${faker.company.name()}`,
      `Office supplies - ${faker.commerce.productName()}`,
      `Travel expenses - ${faker.location.city()}`,
      `Marketing - ${faker.company.catchPhrase()}`,
    ])
  }

  private static randomAccountCode(types?: string[]): string {
    const codes = types || ['200', '400', '410', '500', '600', '800', '820', '840']
    return faker.helpers.arrayElement(codes)
  }

  private static parseFY(fy: string) {
    // FY2023-24 -> July 1, 2023 to June 30, 2024
    const match = fy.match(/FY(\d{4})-(\d{2})/)
    if (!match) {
      throw new Error(`Invalid financial year format: ${fy}. Expected format: FY2023-24`)
    }

    const year = parseInt(match[1])
    return {
      start: new Date(year, 6, 1),  // July 1
      end: new Date(year + 1, 5, 30, 23, 59, 59) // June 30
    }
  }

  private static randomDateInRange(start: Date, end: Date): string {
    const date = faker.date.between({ from: start, to: end })
    return date.toISOString().split('T')[0]
  }

  private static randomTaxType(): string {
    return faker.helpers.arrayElement([
      'INPUT2',        // GST on Expenses (10%)
      'OUTPUT2',       // GST on Income (10%)
      'EXEMPTOUTPUT',  // GST Free
      'NONE',          // No GST
      'BASEXCLUDED',   // Not reportable
      'CAPEXINPUT2',   // Capital GST
    ])
  }

  /**
   * Generate mock OAuth token set
   */
  static tokenSet() {
    const now = Math.floor(Date.now() / 1000)
    return {
      access_token: `xero_access_${faker.string.alphanumeric(64)}`,
      refresh_token: `xero_refresh_${faker.string.alphanumeric(64)}`,
      id_token: `eyJ${faker.string.alphanumeric(128)}`,
      token_type: 'Bearer',
      expires_in: 1800, // 30 minutes
      expires_at: now + 1800,
      scope: 'openid profile email accounting.transactions.read accounting.reports.read accounting.contacts.read accounting.settings.read',
    }
  }

  /**
   * Generate mock error responses
   */
  static error(type: 'rate_limit' | 'unauthorized' | 'not_found' | 'server_error') {
    const errors = {
      rate_limit: {
        status: 429,
        statusText: 'Too Many Requests',
        response: {
          Type: 'TooManyRequestsException',
          Title: 'Rate limit exceeded',
          Detail: 'Please wait before making another request.',
        },
      },
      unauthorized: {
        status: 401,
        statusText: 'Unauthorized',
        response: {
          Type: 'UnauthorizedException',
          Title: 'Unauthorized',
          Detail: 'Invalid or expired access token.',
        },
      },
      not_found: {
        status: 404,
        statusText: 'Not Found',
        response: {
          Type: 'NotFoundException',
          Title: 'Resource not found',
          Detail: 'The requested resource does not exist.',
        },
      },
      server_error: {
        status: 500,
        statusText: 'Internal Server Error',
        response: {
          Type: 'InternalException',
          Title: 'Internal server error',
          Detail: 'An unexpected error occurred.',
        },
      },
    }

    return errors[type]
  }
}
