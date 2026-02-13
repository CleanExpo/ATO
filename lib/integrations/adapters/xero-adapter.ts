/**
 * Xero Platform Adapter
 *
 * Converts Xero API data to canonical schema format
 */

import { XeroClient } from 'xero-node'
import type {
  Invoice,
  BankTransaction,
  Contact as XeroSDKContact,
  LineItem as XeroLineItem,
  LineItemTracking,
  Attachment as XeroAttachment,
} from 'xero-node'
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
  TransactionType,
  TransactionStatus,
} from '../canonical-schema'
import { createXeroClient, refreshXeroTokens, isTokenExpired } from '@/lib/xero/client'
import type { TokenSetInput } from '@/lib/xero/client'
import { withRetry } from '@/lib/xero/retry'
import { getFinancialYearFromDate } from '@/lib/types'

/**
 * Xero Adapter
 */
export class XeroAdapter implements PlatformAdapter {
  readonly platform = 'xero' as const
  readonly platformName = 'Xero'
  readonly apiVersion = '2.0'

  private xero: XeroClient | null = null
  private credentials: AuthCredentials | null = null

  /**
   * Initialize adapter
   */
  async initialize(credentials: AuthCredentials): Promise<void> {
    this.credentials = credentials
    this.xero = createXeroClient()
    await this.xero.initialize()

    // Check if token needs refresh
    const tokenSetInput: TokenSetInput = {
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expires_at: credentials.expiresAt,
    }
    if (isTokenExpired(tokenSetInput)) {
      const newCreds = await this.refreshToken(credentials)
      this.credentials = newCreds
    }

    this.xero.setTokenSet({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    })
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.xero || !this.credentials) {
      throw new Error('Adapter not initialized')
    }

    try {
      await this.xero.accountingApi.getOrganisations(this.credentials.tenantId)
      return true
    } catch (error) {
      console.error('Xero connection test failed:', error)
      return false
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(credentials: AuthCredentials): Promise<AuthCredentials> {
    const tokenSetInput: TokenSetInput = {
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expires_at: credentials.expiresAt,
    }
    const newTokens = await refreshXeroTokens(tokenSetInput)

    return {
      ...credentials,
      accessToken: newTokens.access_token || credentials.accessToken,
      refreshToken: newTokens.refresh_token || credentials.refreshToken,
      expiresAt: newTokens.expires_at || credentials.expiresAt,
    }
  }

  /**
   * Fetch transactions
   */
  async fetchTransactions(options: SyncOptions = {}): Promise<CanonicalTransaction[]> {
    if (!this.xero || !this.credentials) {
      throw new Error('Adapter not initialized')
    }

    const transactions: CanonicalTransaction[] = []
    const syncProgress: SyncProgress = {
      progress: 0,
      transactionsSynced: 0,
      totalEstimated: 1000,
      phase: 'initializing',
      message: 'Starting Xero data sync...',
      errors: [],
    }

    try {
      syncProgress.phase = 'fetching'
      syncProgress.message = 'Fetching invoices...'
      options.onProgress?.(syncProgress)

      // Fetch invoices
      const invoices = await this.fetchInvoices(options)
      transactions.push(...invoices)
      syncProgress.transactionsSynced = transactions.length
      syncProgress.progress = 25
      options.onProgress?.(syncProgress)

      // Fetch bills
      syncProgress.message = 'Fetching bills...'
      options.onProgress?.(syncProgress)
      const bills = await this.fetchBills(options)
      transactions.push(...bills)
      syncProgress.transactionsSynced = transactions.length
      syncProgress.progress = 50
      options.onProgress?.(syncProgress)

      // Fetch bank transactions
      syncProgress.message = 'Fetching bank transactions...'
      options.onProgress?.(syncProgress)
      const bankTransactions = await this.fetchBankTransactions(options)
      transactions.push(...bankTransactions)
      syncProgress.transactionsSynced = transactions.length
      syncProgress.progress = 75
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
   * Fetch Xero invoices and normalize
   */
  private async fetchInvoices(options: SyncOptions): Promise<CanonicalTransaction[]> {
    if (!this.xero || !this.credentials) return []

    const response = await withRetry(() =>
      this.xero!.accountingApi.getInvoices(
        this.credentials!.tenantId,
        undefined, // ifModifiedSince
        options.startDate, // where clause for date filtering
        undefined, // order
        undefined, // IDs
        undefined, // invoice numbers
        undefined, // contact IDs
        undefined, // statuses
        1,         // page
        true,      // includeArchived
        undefined, // createdByMyApp
        undefined, // unitdp
        undefined, // summaryOnly
        100        // pageSize
      )
    )

    const invoices = response.body.invoices || []
    return invoices.map((inv: Invoice) => this.normalizeXeroInvoice(inv))
  }

  /**
   * Fetch Xero bills (ACCPAY invoices)
   */
  private async fetchBills(options: SyncOptions): Promise<CanonicalTransaction[]> {
    if (!this.xero || !this.credentials) return []

    const response = await withRetry(() =>
      this.xero!.accountingApi.getInvoices(
        this.credentials!.tenantId,
        undefined,
        options.startDate ? `Type=="ACCPAY" AND Date >= DateTime(${options.startDate})` : 'Type=="ACCPAY"',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,         // page
        true,      // includeArchived
        undefined, // createdByMyApp
        undefined, // unitdp
        undefined, // summaryOnly
        100        // pageSize
      )
    )

    const bills = response.body.invoices || []
    return bills.map((bill: Invoice) => this.normalizeXeroInvoice(bill))
  }

  /**
   * Fetch Xero bank transactions
   */
  private async fetchBankTransactions(options: SyncOptions): Promise<CanonicalTransaction[]> {
    if (!this.xero || !this.credentials) return []

    const response = await withRetry(() =>
      this.xero!.accountingApi.getBankTransactions(
        this.credentials!.tenantId,
        undefined,
        options.startDate ? `Date >= DateTime(${options.startDate})` : undefined,
        undefined,
        1,
        100
      )
    )

    const bankTxns = response.body.bankTransactions || []
    return bankTxns.map((txn: BankTransaction) => this.normalizeXeroBankTransaction(txn))
  }

  /**
   * Normalize Xero invoice/bill to canonical format
   */
  private normalizeXeroInvoice(invoice: Invoice): CanonicalTransaction {
    const lineItems: CanonicalLineItem[] = (invoice.lineItems || []).map((line: XeroLineItem) => ({
      id: line.lineItemID,
      description: line.description || '',
      quantity: line.quantity || 1,
      unitPrice: line.unitAmount || 0,
      lineAmount: line.lineAmount || 0,
      taxAmount: line.taxAmount || 0,
      totalAmount: (line.lineAmount || 0) + (line.taxAmount || 0),
      accountCode: line.accountCode,
      taxType: line.taxType,
      taxRate: this.getTaxRate(line.taxType),
      itemCode: line.itemCode,
      tracking: (line.tracking || []).map((t: LineItemTracking) => ({
        category: t.name || '',
        option: t.option || '',
      })),
      metadata: { xeroLineItemID: line.lineItemID },
    }))

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineAmount, 0)
    const totalTax = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)

    return {
      id: invoice.invoiceID || '',
      platform: 'xero',
      type: this.mapXeroTypeToCanonical(invoice.type ? String(invoice.type) : ''),
      date: invoice.date || '',
      dueDate: invoice.dueDate,
      reference: invoice.invoiceNumber || invoice.reference,
      financialYear: getFinancialYearFromDate(new Date(invoice.date || '')),
      contact: invoice.contact ? this.normalizeXeroContact(invoice.contact) : undefined,
      lineItems,
      subtotal,
      totalTax,
      total: invoice.total || subtotal + totalTax,
      currency: invoice.currencyCode ? String(invoice.currencyCode) : 'AUD',
      exchangeRate: invoice.currencyRate,
      status: this.mapXeroStatusToCanonical(invoice.status ? String(invoice.status) : ''),
      isPaid: invoice.status ? String(invoice.status) === 'PAID' : false,
      paidDate: invoice.fullyPaidOnDate,
      hasAttachments: invoice.hasAttachments || false,
      attachmentCount: invoice.attachments?.length || 0,
      attachments: invoice.attachments?.map((att: XeroAttachment) => ({
        id: att.attachmentID || '',
        filename: att.fileName || '',
        mimeType: att.mimeType,
        size: att.contentLength,
        url: att.url,
      })),
      sourceUrl: `https://go.xero.com/app/!${invoice.type ? String(invoice.type) === 'ACCPAY' ? 'bills' : 'invoices' : 'invoices'}/${invoice.invoiceID}`,
      createdAt: invoice.updatedDateUTC?.toISOString(),
      updatedAt: invoice.updatedDateUTC?.toISOString(),
      rawData: invoice as unknown as Record<string, unknown>,
      metadata: {
        xeroInvoiceID: invoice.invoiceID,
        xeroInvoiceNumber: invoice.invoiceNumber,
      },
    }
  }

  /**
   * Normalize Xero bank transaction
   */
  private normalizeXeroBankTransaction(txn: BankTransaction): CanonicalTransaction {
    const lineItems: CanonicalLineItem[] = (txn.lineItems || []).map((line: XeroLineItem) => ({
      description: line.description || '',
      quantity: 1,
      unitPrice: line.lineAmount || 0,
      lineAmount: line.lineAmount || 0,
      taxAmount: line.taxAmount || 0,
      totalAmount: (line.lineAmount || 0) + (line.taxAmount || 0),
      accountCode: line.accountCode,
      taxType: line.taxType,
      taxRate: this.getTaxRate(line.taxType),
      metadata: {},
    }))

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineAmount, 0)
    const totalTax = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)

    return {
      id: txn.bankTransactionID || '',
      platform: 'xero',
      type: 'bank_transaction',
      date: txn.date || '',
      reference: txn.reference,
      financialYear: getFinancialYearFromDate(new Date(txn.date || '')),
      contact: txn.contact ? this.normalizeXeroContact(txn.contact) : undefined,
      lineItems,
      subtotal,
      totalTax,
      total: txn.total || subtotal + totalTax,
      currency: txn.currencyCode ? String(txn.currencyCode) : 'AUD',
      status: this.mapXeroStatusToCanonical(txn.status ? String(txn.status) : ''),
      isPaid: true,
      hasAttachments: txn.hasAttachments || false,
      attachmentCount: 0,
      sourceUrl: `https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=${txn.bankTransactionID}`,
      createdAt: txn.updatedDateUTC?.toISOString(),
      updatedAt: txn.updatedDateUTC?.toISOString(),
      rawData: txn as unknown as Record<string, unknown>,
      metadata: {
        xeroBankTransactionID: txn.bankTransactionID,
      },
    }
  }

  /**
   * Normalize Xero contact
   */
  private normalizeXeroContact(contact: XeroSDKContact): CanonicalContact {
    return {
      id: contact.contactID || '',
      name: contact.name || '',
      type: contact.isSupplier ? 'supplier' : contact.isCustomer ? 'customer' : 'other',
      email: contact.emailAddress,
      taxNumber: contact.taxNumber,
      address: contact.addresses?.[0] ? {
        line1: contact.addresses[0].addressLine1,
        line2: contact.addresses[0].addressLine2,
        city: contact.addresses[0].city,
        state: contact.addresses[0].region,
        postcode: contact.addresses[0].postalCode,
        country: contact.addresses[0].country,
      } : undefined,
      metadata: {
        xeroContactID: contact.contactID,
      },
    }
  }

  /**
   * Map Xero type to canonical type
   */
  private mapXeroTypeToCanonical(xeroType: string): TransactionType {
    const mapping: Record<string, TransactionType> = {
      'ACCREC': 'invoice',
      'ACCPAY': 'bill',
      'ACCRECPAYMENT': 'payment',
      'ACCPAYPAYMENT': 'payment',
    }
    return mapping[xeroType] || 'invoice'
  }

  /**
   * Map Xero status to canonical status
   */
  private mapXeroStatusToCanonical(xeroStatus: string): TransactionStatus {
    const mapping: Record<string, TransactionStatus> = {
      'DRAFT': 'draft',
      'SUBMITTED': 'submitted',
      'AUTHORISED': 'authorized',
      'PAID': 'paid',
      'VOIDED': 'voided',
      'DELETED': 'deleted',
    }
    return mapping[xeroStatus] || 'submitted'
  }

  /**
   * Get tax rate from tax type
   */
  private getTaxRate(taxType?: string): number | undefined {
    if (!taxType) return undefined

    const rates: Record<string, number> = {
      'OUTPUT2': 0.10, // GST 10%
      'INPUT2': 0.10,  // GST 10%
      'NONE': 0,
      'EXEMPTOUTPUT': 0,
      'EXEMPTINPUT': 0,
      'BASEXCLUDED': 0,
    }

    return rates[taxType]
  }

  /**
   * Fetch chart of accounts
   */
  async fetchAccounts(): Promise<CanonicalAccount[]> {
    if (!this.xero || !this.credentials) {
      throw new Error('Adapter not initialized')
    }

    const response = await withRetry(() =>
      this.xero!.accountingApi.getAccounts(this.credentials!.tenantId)
    )

    const accounts = response.body.accounts || []

    return accounts.map((acc) => ({
      code: acc.code || '',
      name: acc.name || '',
      type: this.mapXeroAccountType(acc.type ? String(acc.type) : undefined),
      class: acc._class ? String(acc._class) : undefined,
      taxType: acc.taxType ? String(acc.taxType) : undefined,
      isActive: acc.status ? String(acc.status) === 'ACTIVE' : false,
      description: acc.description,
      metadata: {
        xeroAccountID: acc.accountID,
      },
    }))
  }

  /**
   * Map Xero account type to canonical type
   */
  private mapXeroAccountType(xeroType?: string): 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' {
    if (!xeroType) return 'expense'

    const mapping: Record<string, 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'> = {
      'BANK': 'asset',
      'CURRENT': 'asset',
      'CURRLIAB': 'liability',
      'DEPRECIATN': 'expense',
      'DIRECTCOSTS': 'expense',
      'EQUITY': 'equity',
      'EXPENSE': 'expense',
      'FIXED': 'asset',
      'INVENTORY': 'asset',
      'LIABILITY': 'liability',
      'NONCURRENT': 'asset',
      'OTHERINCOME': 'revenue',
      'OVERHEADS': 'expense',
      'PREPAYMENT': 'asset',
      'REVENUE': 'revenue',
      'SALES': 'revenue',
      'TERMLIAB': 'liability',
      'PAYGLIABILITY': 'liability',
      'SUPERANNUATIONEXPENSE': 'expense',
      'SUPERANNUATIONLIABILITY': 'liability',
      'WAGESEXPENSE': 'expense',
    }

    return mapping[xeroType] || 'expense'
  }

  /**
   * Fetch report data
   */
  async fetchReport(
    reportType: 'profit_loss' | 'balance_sheet' | 'trial_balance',
    startDate: string,
    endDate: string
  ): Promise<CanonicalReportData> {
    if (!this.xero || !this.credentials) throw new Error('Adapter not initialized')

    const tenantId = this.credentials.tenantId

    const reportMap = {
      profit_loss: 'ProfitAndLoss',
      balance_sheet: 'BalanceSheet',
      trial_balance: 'TrialBalance',
    } as const

    const xeroReportId = reportMap[reportType]

    const response = await withRetry(() =>
      this.xero!.accountingApi.getReportProfitAndLoss(
        tenantId,
        startDate,
        endDate,
        undefined, // periods
        undefined, // timeframe
        undefined, // trackingCategoryID
        undefined, // trackingCategoryID2
        undefined, // trackingOptionID
        undefined, // trackingOptionID2
        undefined, // standardLayout
        undefined, // paymentsOnly
      )
    )

    const reports = response?.body?.reports
    const report = reports?.[0]

    if (!report?.rows) {
      return {
        type: reportType,
        startDate,
        endDate,
        financialYear: getFinancialYearFromDate(new Date(startDate)),
        sections: [],
        totals: {},
        metadata: { xeroReportId, note: 'No data returned from Xero' },
      }
    }

    // Parse Xero report rows into canonical sections
    const sections: CanonicalReportData['sections'] = []
    const totals: CanonicalReportData['totals'] = {}

    for (const row of report.rows) {
      if (String(row.rowType) === 'Section' && row.title) {
        const sectionRows = (row.rows ?? [])
          .filter((r) => String(r.rowType) === 'Row')
          .map((r) => {
            const cells = (r.cells as Array<{ value?: string }>) ?? []
            return {
              accountName: cells[0]?.value ?? '',
              amount: parseFloat(cells[1]?.value ?? '0') || 0,
            }
          })

        sections.push({
          title: row.title,
          rows: sectionRows,
          subtotal: sectionRows.reduce((sum: number, r: { amount: number }) => sum + r.amount, 0),
        })

        // Populate totals based on section titles
        const titleLower = row.title.toLowerCase()
        const sectionTotal = sectionRows.reduce((sum: number, r: { amount: number }) => sum + r.amount, 0)
        if (titleLower.includes('revenue') || titleLower.includes('income')) totals.revenue = sectionTotal
        else if (titleLower.includes('expense')) totals.expenses = sectionTotal
        else if (titleLower.includes('asset')) totals.assets = sectionTotal
        else if (titleLower.includes('liabilit')) totals.liabilities = sectionTotal
        else if (titleLower.includes('equity')) totals.equity = sectionTotal
      }
    }

    if (totals.revenue !== undefined && totals.expenses !== undefined) {
      totals.netProfit = totals.revenue - Math.abs(totals.expenses)
    }

    return {
      type: reportType,
      startDate,
      endDate,
      financialYear: getFinancialYearFromDate(new Date(startDate)),
      sections,
      totals,
      metadata: { xeroReportId, reportTitle: report.reportName },
    }
  }

  /**
   * Validate data
   */
  async validateData(transactions: CanonicalTransaction[]): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = []
    const warnings: ValidationResult['warnings'] = []

    for (const txn of transactions) {
      // Required field validation
      if (!txn.id) {
        errors.push({ field: 'id', message: 'Transaction ID is required', code: 'REQUIRED_FIELD' })
      }

      if (!txn.date) {
        errors.push({ field: 'date', message: 'Transaction date is required', code: 'REQUIRED_FIELD' })
      }

      if (txn.lineItems.length === 0) {
        warnings.push({ field: 'lineItems', message: 'Transaction has no line items', code: 'EMPTY_LINE_ITEMS' })
      }

      // Amount validation
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

    // Check for missing data
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

    // Check for invalid amounts
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
    if (!this.xero || !this.credentials) {
      throw new Error('Adapter not initialized')
    }

    const response = await this.xero.accountingApi.getOrganisations(this.credentials.tenantId)
    const org = response.body.organisations?.[0]

    if (!org) {
      throw new Error('Organization not found')
    }

    return {
      id: org.organisationID || '',
      name: org.name || '',
      taxNumber: org.taxNumber,
      currency: org.baseCurrency ? String(org.baseCurrency) : 'AUD',
      country: org.countryCode ? String(org.countryCode) : 'AU',
      fiscalYearEnd: org.financialYearEndMonth ? `${org.financialYearEndMonth}-${org.financialYearEndDay}` : undefined,
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
        reports: false, // Not yet implemented
        attachments: true,
        multiCurrency: true,
      },
    }
  }
}
