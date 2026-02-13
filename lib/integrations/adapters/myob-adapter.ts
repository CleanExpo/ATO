/**
 * MYOB AccountRight Platform Adapter
 *
 * Converts MYOB AccountRight API data to canonical schema format
 *
 * API Reference: https://developer.myob.com/api/accountright/v2/
 */

import type {
  PlatformAdapter,
  AuthCredentials,
  SyncOptions,
  SyncProgress,
} from '../adapter'
import type {
  CanonicalTransaction,
  CanonicalAccount,
  CanonicalReportData,
  CanonicalContact,
  CanonicalLineItem,
  ValidationResult,
  DataQualityMetrics,
  TransactionStatus,
} from '../canonical-schema'
import type {
  MYOBInvoice,
  MYOBBankTransaction,
  MYOBGeneralJournal,
  MYOBContact,
  MYOBLine,
  MYOBAddress,
  MYOBAccount,
} from './myob-types'
import { getFinancialYearFromDate } from '@/lib/types'
import { serverConfig } from '@/lib/config/env'

/**
 * MYOB API Configuration
 */
const MYOB_API_BASE = 'https://api.myob.com/accountright'
const _MYOB_AUTH_URL = 'https://secure.myob.com/oauth2/account/authorize'
const MYOB_TOKEN_URL = 'https://secure.myob.com/oauth2/v1/authorize'

/**
 * MYOB API Rate Limits
 * - 60 requests per minute per company file
 * - Burst limit: 150 requests
 */
const RATE_LIMIT_PER_MINUTE = 60
const RATE_LIMIT_DELAY_MS = 1000 // 1 second between requests

/**
 * MYOB Adapter
 */
export class MYOBAdapter implements PlatformAdapter {
  readonly platform = 'myob' as const
  readonly platformName = 'MYOB AccountRight'
  readonly apiVersion = 'v2'

  private credentials: AuthCredentials | null = null
  private companyFileId: string | null = null
  private lastRequestTime = 0

  /**
   * Initialize adapter
   */
  async initialize(credentials: AuthCredentials): Promise<void> {
    this.credentials = credentials
    this.companyFileId = credentials.tenantId // In MYOB, tenantId is the company file ID

    // Test connection on initialization
    const isConnected = await this.testConnection()
    if (!isConnected) {
      throw new Error('Failed to connect to MYOB - invalid credentials or company file')
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.credentials || !this.companyFileId) {
      return false
    }

    try {
      const response = await this.makeRequest('/Info')
      return response.ok
    } catch (error) {
      console.error('MYOB connection test failed:', error)
      return false
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(credentials: AuthCredentials): Promise<AuthCredentials> {
    try {
      const response = await fetch(MYOB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: serverConfig.myob.clientId,
          client_secret: serverConfig.myob.clientSecret,
          refresh_token: credentials.refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`)
      }

      const data = await response.json()

      return {
        ...credentials,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || credentials.refreshToken,
        expiresAt: Date.now() + (data.expires_in * 1000),
      }
    } catch (error) {
      console.error('MYOB token refresh failed:', error)
      throw error
    }
  }

  /**
   * Fetch transactions
   */
  async fetchTransactions(options: SyncOptions = {}): Promise<CanonicalTransaction[]> {
    if (!this.credentials || !this.companyFileId) {
      throw new Error('Adapter not initialized')
    }

    const transactions: CanonicalTransaction[] = []
    const syncProgress: SyncProgress = {
      progress: 0,
      transactionsSynced: 0,
      totalEstimated: 1000,
      phase: 'initializing',
      message: 'Starting MYOB data sync...',
      errors: [],
    }

    try {
      syncProgress.phase = 'fetching'
      syncProgress.message = 'Fetching sales invoices...'
      options.onProgress?.(syncProgress)

      // Fetch sales (customer invoices)
      const invoices = await this.fetchSalesInvoices(options)
      transactions.push(...invoices)
      syncProgress.transactionsSynced = transactions.length
      syncProgress.progress = 25
      options.onProgress?.(syncProgress)

      // Fetch purchases (supplier bills)
      syncProgress.message = 'Fetching purchase bills...'
      options.onProgress?.(syncProgress)
      const bills = await this.fetchPurchaseBills(options)
      transactions.push(...bills)
      syncProgress.transactionsSynced = transactions.length
      syncProgress.progress = 33
      options.onProgress?.(syncProgress)

      // Fetch spend money transactions
      syncProgress.message = 'Fetching spend money transactions...'
      options.onProgress?.(syncProgress)
      const spendTransactions = await this.fetchSpendMoneyTransactions(options)
      transactions.push(...spendTransactions)
      syncProgress.transactionsSynced = transactions.length
      syncProgress.progress = 50
      options.onProgress?.(syncProgress)

      // Fetch receive money transactions
      syncProgress.message = 'Fetching receive money transactions...'
      options.onProgress?.(syncProgress)
      const receiveTransactions = await this.fetchReceiveMoneyTransactions(options)
      transactions.push(...receiveTransactions)
      syncProgress.transactionsSynced = transactions.length
      syncProgress.progress = 65
      options.onProgress?.(syncProgress)

      // Fetch general journals
      syncProgress.message = 'Fetching general journals...'
      options.onProgress?.(syncProgress)
      const journals = await this.fetchGeneralJournals(options)
      transactions.push(...journals)
      syncProgress.transactionsSynced = transactions.length
      syncProgress.progress = 80
      options.onProgress?.(syncProgress)

      // Normalize phase
      syncProgress.phase = 'normalizing'
      syncProgress.message = 'Normalizing data to canonical format...'
      syncProgress.progress = 90
      options.onProgress?.(syncProgress)

      // Validation phase
      syncProgress.phase = 'validating'
      syncProgress.message = 'Validating normalized data...'
      syncProgress.progress = 95
      options.onProgress?.(syncProgress)

      const validation = await this.validateData(transactions)
      if (!validation.isValid) {
        syncProgress.errors.push({
          code: 'VALIDATION_FAILED',
          message: `Found ${validation.errors.length} validation errors`,
          timestamp: new Date().toISOString(),
        })
      }

      // Complete
      syncProgress.phase = 'complete'
      syncProgress.message = `Synced ${transactions.length} transactions successfully`
      syncProgress.progress = 100
      syncProgress.totalEstimated = transactions.length
      options.onProgress?.(syncProgress)

      return transactions
    } catch (error) {
      syncProgress.phase = 'error'
      syncProgress.message = error instanceof Error ? error.message : 'Unknown error'
      syncProgress.errors.push({
        code: 'FETCH_ERROR',
        message: syncProgress.message,
        timestamp: new Date().toISOString(),
      })
      options.onProgress?.(syncProgress)
      throw error
    }
  }

  /**
   * Fetch MYOB sales invoices
   */
  private async fetchSalesInvoices(options: SyncOptions): Promise<CanonicalTransaction[]> {
    const endpoint = '/Sale/Invoice/Item'
    const response = await this.makeRequest(endpoint)

    if (!response.ok) {
      throw new Error(`Failed to fetch sales invoices: ${response.status}`)
    }

    const data = await response.json()
    const invoices = data.Items || []

    return invoices
      .filter((inv: MYOBInvoice) => this.matchesDateFilter(inv.Date, options))
      .map((inv: MYOBInvoice) => this.normalizeMYOBInvoice(inv, 'invoice'))
  }

  /**
   * Fetch MYOB purchase bills
   */
  private async fetchPurchaseBills(options: SyncOptions): Promise<CanonicalTransaction[]> {
    const endpoint = '/Purchase/Bill/Item'
    const response = await this.makeRequest(endpoint)

    if (!response.ok) {
      throw new Error(`Failed to fetch purchase bills: ${response.status}`)
    }

    const data = await response.json()
    const bills = data.Items || []

    return bills
      .filter((bill: MYOBInvoice) => this.matchesDateFilter(bill.Date, options))
      .map((bill: MYOBInvoice) => this.normalizeMYOBInvoice(bill, 'bill'))
  }

  /**
   * Fetch MYOB spend money transactions
   */
  private async fetchSpendMoneyTransactions(options: SyncOptions): Promise<CanonicalTransaction[]> {
    const endpoint = '/Banking/SpendMoneyTxn'
    const response = await this.makeRequest(endpoint)

    if (!response.ok) {
      throw new Error(`Failed to fetch spend money transactions: ${response.status}`)
    }

    const data = await response.json()
    const transactions = data.Items || []

    return transactions
      .filter((txn: MYOBBankTransaction) => this.matchesDateFilter(txn.Date, options))
      .map((txn: MYOBBankTransaction) => this.normalizeMYOBBankTransaction(txn, 'spend'))
  }

  /**
   * Fetch MYOB receive money transactions
   */
  private async fetchReceiveMoneyTransactions(options: SyncOptions): Promise<CanonicalTransaction[]> {
    const endpoint = '/Banking/ReceiveMoneyTxn'
    const response = await this.makeRequest(endpoint)

    if (!response.ok) {
      throw new Error(`Failed to fetch receive money transactions: ${response.status}`)
    }

    const data = await response.json()
    const transactions = data.Items || []

    return transactions
      .filter((txn: MYOBBankTransaction) => this.matchesDateFilter(txn.Date, options))
      .map((txn: MYOBBankTransaction) => this.normalizeMYOBBankTransaction(txn, 'receive'))
  }

  /**
   * Fetch MYOB general journals
   */
  private async fetchGeneralJournals(options: SyncOptions): Promise<CanonicalTransaction[]> {
    const endpoint = '/GeneralLedger/GeneralJournal'
    const response = await this.makeRequest(endpoint)

    if (!response.ok) {
      throw new Error(`Failed to fetch general journals: ${response.status}`)
    }

    const data = await response.json()
    const journals = data.Items || []

    return journals
      .filter((journal: MYOBGeneralJournal) => this.matchesDateFilter(journal.DateOccurred, options))
      .map((journal: MYOBGeneralJournal) => this.normalizeMYOBGeneralJournal(journal))
  }

  /**
   * Normalize MYOB invoice/bill to canonical format
   */
  private normalizeMYOBInvoice(invoice: MYOBInvoice, type: 'invoice' | 'bill'): CanonicalTransaction {
    const lineItems: CanonicalLineItem[] = (invoice.Lines || []).map((line: MYOBLine) => {
      const quantity = line.ShipQuantity || line.BillQuantity || 1
      const unitPrice = line.UnitPrice || 0
      const lineAmount = line.Total || (quantity * unitPrice)
      const taxAmount = line.Tax?.Amount || 0

      return {
        id: line.RowID?.toString(),
        description: line.Description || '',
        quantity,
        unitPrice,
        lineAmount,
        taxAmount,
        totalAmount: lineAmount + taxAmount,
        accountCode: line.Account?.DisplayID,
        accountName: line.Account?.Name,
        taxType: line.TaxCode?.Code,
        taxRate: this.getMYOBTaxRate(line.TaxCode?.Code),
        itemCode: line.Item?.Number,
        metadata: {
          myobLineRowID: line.RowID,
          myobJobID: line.Job?.UID,
        },
      }
    })

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineAmount, 0)
    const totalTax = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)

    const contactData = invoice.Customer || invoice.Supplier

    return {
      id: invoice.UID || '',
      platform: 'myob',
      type,
      date: invoice.Date || '',
      dueDate: invoice.DueDate || invoice.PromisedDate,
      reference: invoice.Number,
      financialYear: getFinancialYearFromDate(new Date(invoice.Date || '')),
      contact: contactData ? this.normalizeMYOBContact(
        contactData,
        type === 'invoice' ? 'customer' : 'supplier'
      ) : undefined,
      lineItems,
      subtotal,
      totalTax,
      total: invoice.TotalAmount || (subtotal + totalTax),
      currency: invoice.ForeignCurrency?.Code || 'AUD',
      exchangeRate: invoice.ForeignCurrency?.CurrencyRate,
      status: this.mapMYOBStatusToCanonical(invoice.Status || ''),
      isPaid: invoice.Status === 'Closed',
      paidDate: invoice.Status === 'Closed' ? invoice.LastModified : undefined,
      hasAttachments: false, // MYOB API v2 doesn't expose attachments easily
      attachmentCount: 0,
      sourceUrl: invoice.URI,
      createdAt: invoice.DateOccurred,
      updatedAt: invoice.LastModified,
      rawData: invoice as unknown as Record<string, unknown>,
      metadata: {
        myobUID: invoice.UID,
        myobNumber: invoice.Number,
        myobInvoiceType: invoice.InvoiceType,
      },
    }
  }

  /**
   * Normalize MYOB bank transaction
   */
  private normalizeMYOBBankTransaction(txn: MYOBBankTransaction, txnType: 'spend' | 'receive' = 'spend'): CanonicalTransaction {
    const lineItems: CanonicalLineItem[] = (txn.Lines || []).map((line: MYOBLine) => ({
      description: line.Description || '',
      quantity: 1,
      unitPrice: line.Amount || 0,
      lineAmount: line.Amount || 0,
      taxAmount: line.Tax?.Amount || 0,
      totalAmount: (line.Amount || 0) + (line.Tax?.Amount || 0),
      accountCode: line.Account?.DisplayID,
      accountName: line.Account?.Name,
      taxType: line.TaxCode?.Code,
      taxRate: this.getMYOBTaxRate(line.TaxCode?.Code),
      metadata: {
        myobLineRowID: line.RowID,
      },
    }))

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineAmount, 0)
    const totalTax = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)

    return {
      id: txn.UID || '',
      platform: 'myob',
      type: txnType === 'receive' ? 'payment' : 'bank_transaction',
      date: txn.Date || '',
      reference: txn.PaymentNumber || txn.Memo || txn.ReceiptNumber,
      financialYear: getFinancialYearFromDate(new Date(txn.Date || '')),
      contact: txn.Payee ? this.normalizeMYOBContact(txn.Payee, txnType === 'receive' ? 'customer' : 'supplier') : undefined,
      lineItems,
      subtotal,
      totalTax,
      total: txn.Amount || (subtotal + totalTax),
      currency: 'AUD',
      status: 'paid',
      isPaid: true,
      paidDate: txn.Date,
      hasAttachments: false,
      attachmentCount: 0,
      sourceUrl: txn.URI,
      createdAt: txn.Date,
      updatedAt: txn.LastModified,
      rawData: txn as unknown as Record<string, unknown>,
      metadata: {
        myobUID: txn.UID,
        myobPaymentNumber: txn.PaymentNumber || txn.ReceiptNumber,
        myobTransactionType: txnType,
      },
    }
  }

  /**
   * Normalize MYOB general journal
   */
  private normalizeMYOBGeneralJournal(journal: MYOBGeneralJournal): CanonicalTransaction {
    const lineItems: CanonicalLineItem[] = (journal.Lines || []).map((line: MYOBLine) => ({
      description: line.Description || line.Memo || '',
      quantity: 1,
      unitPrice: Math.abs(line.Amount || 0),
      lineAmount: Math.abs(line.Amount || 0),
      taxAmount: line.TaxAmount || 0,
      totalAmount: Math.abs(line.Amount || 0) + (line.TaxAmount || 0),
      accountCode: line.Account?.DisplayID,
      accountName: line.Account?.Name,
      metadata: {
        myobLineRowID: line.RowID,
        myobDebitCredit: line.IsCredit ? 'Credit' : 'Debit',
      },
    }))

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineAmount, 0)
    const totalTax = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)

    return {
      id: journal.UID || '',
      platform: 'myob',
      type: 'journal_entry',
      date: journal.DateOccurred || '',
      reference: journal.GSTReportingMethod || journal.Memo,
      financialYear: getFinancialYearFromDate(new Date(journal.DateOccurred || '')),
      lineItems,
      subtotal,
      totalTax,
      total: subtotal + totalTax,
      currency: 'AUD',
      status: 'authorized',
      isPaid: false,
      hasAttachments: false,
      attachmentCount: 0,
      sourceUrl: journal.URI,
      createdAt: journal.DateOccurred,
      updatedAt: journal.LastModified,
      rawData: journal as unknown as Record<string, unknown>,
      metadata: {
        myobUID: journal.UID,
        myobGSTReportingMethod: journal.GSTReportingMethod,
      },
    }
  }

  /**
   * Normalize MYOB contact
   */
  private normalizeMYOBContact(contact: MYOBContact, type: 'customer' | 'supplier' | 'other'): CanonicalContact {
    const addresses = contact.Addresses || []
    const primaryAddress = addresses.find((a: MYOBAddress) => a.Location === 1) || addresses[0]

    return {
      id: contact.UID || '',
      name: contact.DisplayID || contact.CompanyName || contact.LastName || '',
      type,
      email: contact.Email,
      taxNumber: contact.ABN,
      address: primaryAddress ? {
        line1: primaryAddress.Street,
        line2: primaryAddress.City,
        city: primaryAddress.City,
        state: primaryAddress.State,
        postcode: primaryAddress.PostCode,
        country: primaryAddress.Country,
      } : undefined,
      metadata: {
        myobUID: contact.UID,
        myobDisplayID: contact.DisplayID,
      },
    }
  }

  /**
   * Map MYOB status to canonical status
   */
  private mapMYOBStatusToCanonical(myobStatus: string): TransactionStatus {
    const mapping: Record<string, TransactionStatus> = {
      'Open': 'authorized',
      'Closed': 'paid',
      'Void': 'voided',
      'Credit': 'authorized',
    }
    return mapping[myobStatus] || 'authorized'
  }

  /**
   * Get MYOB tax rate from tax code
   */
  private getMYOBTaxRate(taxCode?: string): number | undefined {
    if (!taxCode) return undefined

    const rates: Record<string, number> = {
      'GST': 0.10,      // 10% GST
      'N-T': 0,         // No tax
      'FRE': 0,         // Tax free
      'CAP': 0,         // Capital acquisitions
      'EXP': 0,         // Exports
      'BAS': 0,         // BAS excluded
    }

    return rates[taxCode]
  }

  /**
   * Check if date matches filter
   */
  private matchesDateFilter(date: string | undefined, options: SyncOptions): boolean {
    if (!date) return false
    if (!options.startDate && !options.endDate) return true

    const txnDate = new Date(date)

    if (options.startDate && txnDate < new Date(options.startDate)) {
      return false
    }

    if (options.endDate && txnDate > new Date(options.endDate)) {
      return false
    }

    return true
  }

  /**
   * Fetch chart of accounts
   */
  async fetchAccounts(): Promise<CanonicalAccount[]> {
    if (!this.credentials || !this.companyFileId) {
      throw new Error('Adapter not initialized')
    }

    const response = await this.makeRequest('/GeneralLedger/Account')

    if (!response.ok) {
      throw new Error(`Failed to fetch accounts: ${response.status}`)
    }

    const data = await response.json()
    const accounts = data.Items || []

    return accounts.map((acc: MYOBAccount) => ({
      code: acc.DisplayID || acc.Number || '',
      name: acc.Name || '',
      type: this.mapMYOBAccountType(acc.Classification),
      class: acc.Type,
      taxType: acc.TaxCode?.Code,
      isActive: acc.IsActive !== false,
      description: acc.Description,
      parentCode: acc.ParentAccount?.DisplayID,
      metadata: {
        myobUID: acc.UID,
        myobAccountType: acc.Type,
        myobClassification: acc.Classification,
      },
    }))
  }

  /**
   * Map MYOB account classification to canonical type
   */
  private mapMYOBAccountType(classification?: string): 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' {
    if (!classification) return 'expense'

    const mapping: Record<string, 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'> = {
      'Asset': 'asset',
      'Liability': 'liability',
      'Equity': 'equity',
      'Income': 'revenue',
      'CostOfSales': 'expense',
      'Expense': 'expense',
      'OtherIncome': 'revenue',
      'OtherExpense': 'expense',
    }

    return mapping[classification] || 'expense'
  }

  /**
   * Fetch report data
   */
  async fetchReport(
    reportType: 'profit_loss' | 'balance_sheet' | 'trial_balance',
    startDate: string,
    endDate: string
  ): Promise<CanonicalReportData> {
    if (!this.credentials) throw new Error('Adapter not initialized')

    // MYOB AccountRight API report endpoints
    const endpointMap = {
      profit_loss: '/Report/ProfitAndLossSummary',
      balance_sheet: '/Report/BalanceSheetSummary',
      trial_balance: '/Report/TrialBalance',
    } as const

    const endpoint = `${endpointMap[reportType]}?StartDate=${startDate}&EndDate=${endDate}`

    try {
      const response = await this.makeRequest(endpoint)

      if (!response.ok) {
        return {
          type: reportType,
          startDate,
          endDate,
          financialYear: this.getFinancialYearFromDate(startDate),
          sections: [],
          totals: {},
          metadata: { error: `MYOB returned status ${response.status}` },
        }
      }

      const data = await response.json()
      const lines = data?.Lines ?? data?.Items ?? []

      // Parse MYOB report rows
      const sectionMap = new Map<string, Array<{ accountName: string; amount: number }>>()
      const totals: CanonicalReportData['totals'] = {}

      for (const line of lines) {
        const sectionTitle = line.Type || line.Classification || 'Other'
        const accountName = line.AccountName || line.Name || ''
        const amount = line.Amount ?? line.Total ?? 0

        if (!sectionMap.has(sectionTitle)) {
          sectionMap.set(sectionTitle, [])
        }
        sectionMap.get(sectionTitle)!.push({ accountName, amount })

        const titleLower = sectionTitle.toLowerCase()
        if (titleLower.includes('income') || titleLower.includes('revenue')) {
          totals.revenue = (totals.revenue ?? 0) + amount
        } else if (titleLower.includes('expense') || titleLower.includes('cost')) {
          totals.expenses = (totals.expenses ?? 0) + amount
        } else if (titleLower.includes('asset')) {
          totals.assets = (totals.assets ?? 0) + amount
        } else if (titleLower.includes('liabilit')) {
          totals.liabilities = (totals.liabilities ?? 0) + amount
        } else if (titleLower.includes('equity')) {
          totals.equity = (totals.equity ?? 0) + amount
        }
      }

      if (totals.revenue !== undefined && totals.expenses !== undefined) {
        totals.netProfit = totals.revenue - Math.abs(totals.expenses)
      }

      const sections = Array.from(sectionMap.entries()).map(([title, rows]) => ({
        title,
        rows,
        subtotal: rows.reduce((sum, r) => sum + r.amount, 0),
      }))

      return {
        type: reportType,
        startDate,
        endDate,
        financialYear: this.getFinancialYearFromDate(startDate),
        sections,
        totals,
        metadata: { source: 'MYOB AccountRight API' },
      }
    } catch (error) {
      return {
        type: reportType,
        startDate,
        endDate,
        financialYear: this.getFinancialYearFromDate(startDate),
        sections: [],
        totals: {},
        metadata: { error: error instanceof Error ? error.message : 'Unknown error fetching MYOB report' },
      }
    }
  }

  private getFinancialYearFromDate(dateStr: string): string {
    const d = new Date(dateStr)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    // AU FY runs Jul-Jun
    if (month >= 7) return `FY${year}-${(year + 1).toString().slice(-2)}`
    return `FY${year - 1}-${year.toString().slice(-2)}`
  }

  /**
   * Validate data
   */
  async validateData(transactions: CanonicalTransaction[]): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = []
    const warnings: ValidationResult['warnings'] = []

    for (const txn of transactions) {
      if (!txn.id) {
        errors.push({ field: 'id', message: 'Transaction ID is required', code: 'REQUIRED_FIELD' })
      }

      if (!txn.date) {
        errors.push({ field: 'date', message: 'Transaction date is required', code: 'REQUIRED_FIELD' })
      }

      if (txn.lineItems.length === 0) {
        warnings.push({ field: 'lineItems', message: 'Transaction has no line items', code: 'EMPTY_LINE_ITEMS' })
      }

      const calculatedSubtotal = txn.lineItems.reduce((sum, item) => sum + item.lineAmount, 0)
      if (Math.abs(calculatedSubtotal - txn.subtotal) > 0.01) {
        errors.push({
          field: 'subtotal',
          message: `Subtotal mismatch: ${txn.subtotal} vs ${calculatedSubtotal}`,
          code: 'AMOUNT_MISMATCH',
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Calculate quality metrics
   */
  async calculateQualityMetrics(transactions: CanonicalTransaction[]): Promise<DataQualityMetrics> {
    const totalTransactions = transactions.length
    let missingDataCount = 0
    let invalidDataCount = 0
    const issues: DataQualityMetrics['issues'] = []

    const missingContact = transactions.filter((t) => !t.contact)
    if (missingContact.length > 0) {
      missingDataCount += missingContact.length
      issues.push({
        type: 'missing_contact',
        count: missingContact.length,
        severity: 'warning',
        affectedTransactionIds: missingContact.map((t) => t.id),
      })
    }

    const invalidAmounts = transactions.filter((t) => t.total < 0 && t.type !== 'credit_note')
    if (invalidAmounts.length > 0) {
      invalidDataCount += invalidAmounts.length
      issues.push({
        type: 'invalid_amount',
        count: invalidAmounts.length,
        severity: 'critical',
        affectedTransactionIds: invalidAmounts.map((t) => t.id),
      })
    }

    const completenessScore = totalTransactions > 0
      ? ((totalTransactions - missingDataCount) / totalTransactions) * 100
      : 100

    const accuracyScore = totalTransactions > 0
      ? ((totalTransactions - invalidDataCount) / totalTransactions) * 100
      : 100

    const overallScore = (completenessScore + accuracyScore) / 2

    return {
      totalTransactions,
      missingDataCount,
      invalidDataCount,
      completenessScore,
      accuracyScore,
      overallScore,
      issues,
    }
  }

  /**
   * Get organization info
   */
  async getOrganizationInfo() {
    if (!this.credentials || !this.companyFileId) {
      throw new Error('Adapter not initialized')
    }

    const response = await this.makeRequest('/Info')

    if (!response.ok) {
      throw new Error(`Failed to fetch organization info: ${response.status}`)
    }

    const data = await response.json()

    return {
      id: data.Id || this.companyFileId,
      name: data.CompanyName || data.Name || '',
      taxNumber: data.ABN,
      currency: data.CurrencyCode || 'AUD',
      country: data.Country || 'AU',
      fiscalYearEnd: data.CurrentFiscalYear,
    }
  }

  /**
   * Get metadata
   */
  getMetadata(): Record<string, unknown> {
    return {
      platform: this.platform,
      platformName: this.platformName,
      apiVersion: this.apiVersion,
      capabilities: {
        invoices: true,
        bills: true,
        bankTransactions: true,
        reports: false,
        attachments: false,
        multiCurrency: true,
      },
      rateLimits: {
        perMinute: RATE_LIMIT_PER_MINUTE,
        delayMs: RATE_LIMIT_DELAY_MS,
      },
    }
  }

  /**
   * Make authenticated request to MYOB API with rate limiting
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.credentials || !this.companyFileId) {
      throw new Error('Adapter not initialized')
    }

    // Rate limiting: ensure 1 second between requests
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest))
    }

    const url = `${MYOB_API_BASE}/${this.companyFileId}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'x-myobapi-key': serverConfig.myob.clientId,
        'x-myobapi-version': 'v2',
        'Accept': 'application/json',
      },
    })

    this.lastRequestTime = Date.now()

    // Handle token expiry
    if (response.status === 401) {
      const newCredentials = await this.refreshToken(this.credentials)
      this.credentials = newCredentials

      // Retry request with new token
      return this.makeRequest(endpoint, options)
    }

    return response
  }
}
