/**
 * Canonical Transaction Schema
 *
 * Platform-agnostic transaction schema that normalizes data from:
 * - Xero
 * - MYOB AccountRight
 * - QuickBooks Online
 *
 * This schema represents the "single source of truth" for all tax analysis.
 */

export type Platform = 'xero' | 'myob' | 'quickbooks'

export type TransactionType =
  | 'invoice'
  | 'bill'
  | 'payment'
  | 'bank_transaction'
  | 'credit_note'
  | 'journal_entry'
  | 'purchase_order'
  | 'quote'
  | 'transfer'

export type TransactionStatus = 'draft' | 'submitted' | 'authorized' | 'paid' | 'voided' | 'deleted'

export type ContactType = 'customer' | 'supplier' | 'employee' | 'other'

/**
 * Canonical Contact
 */
export interface CanonicalContact {
  /** Internal contact ID (platform-specific) */
  id: string

  /** Contact name */
  name: string

  /** Contact type */
  type: ContactType

  /** Email address */
  email?: string

  /** Tax number (ABN for AU, TIN for US) */
  taxNumber?: string

  /** Physical address */
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
  }

  /** Metadata for platform-specific fields */
  metadata?: Record<string, unknown>
}

/**
 * Canonical Line Item
 */
export interface CanonicalLineItem {
  /** Line item ID (if available) */
  id?: string

  /** Description of the line item */
  description?: string

  /** Quantity */
  quantity: number

  /** Unit price (excluding tax) */
  unitPrice: number

  /** Total line amount (quantity × unitPrice) */
  lineAmount: number

  /** Tax amount for this line */
  taxAmount: number

  /** Total including tax */
  totalAmount: number

  /** Account code (chart of accounts) */
  accountCode?: string

  /** Account name */
  accountName?: string

  /** Tax rate code (e.g., 'GST', 'INPUT2', 'NONE') */
  taxType?: string

  /** Tax rate percentage (e.g., 0.10 for 10% GST) */
  taxRate?: number

  /** Item code/SKU (if applicable) */
  itemCode?: string

  /** Tracking categories (departments, projects, etc.) */
  tracking?: Array<{
    category: string
    option: string
  }>

  /** Metadata for platform-specific fields */
  metadata?: Record<string, unknown>
}

/**
 * Canonical Transaction
 *
 * The universal transaction format used throughout the application
 */
export interface CanonicalTransaction {
  /** Unique transaction ID (platform-specific) */
  id: string

  /** Source platform */
  platform: Platform

  /** Transaction type */
  type: TransactionType

  /** Transaction date (ISO 8601) */
  date: string

  /** Due date (ISO 8601) for invoices/bills */
  dueDate?: string

  /** Transaction reference/number */
  reference?: string

  /** Financial year (FY format: FY2023-24) */
  financialYear: string

  /** Contact/counterparty */
  contact?: CanonicalContact

  /** Line items */
  lineItems: CanonicalLineItem[]

  /** Subtotal (sum of line amounts, excluding tax) */
  subtotal: number

  /** Total tax amount */
  totalTax: number

  /** Total amount (including tax) */
  total: number

  /** Currency code (ISO 4217) */
  currency: string

  /** Exchange rate (if multi-currency) */
  exchangeRate?: number

  /** Transaction status */
  status: TransactionStatus

  /** Whether transaction has been paid */
  isPaid: boolean

  /** Payment date (if paid) */
  paidDate?: string

  /** Whether transaction has attachments */
  hasAttachments: boolean

  /** Attachment count */
  attachmentCount: number

  /** Attachment URLs (if available) */
  attachments?: Array<{
    id: string
    filename: string
    mimeType?: string
    size?: number
    url?: string
  }>

  /** URL to view transaction in source platform */
  sourceUrl?: string

  /** Created date in source platform */
  createdAt?: string

  /** Last modified date in source platform */
  updatedAt?: string

  /** Raw data from source platform (for debugging) */
  rawData?: Record<string, unknown>

  /** Metadata for platform-specific fields */
  metadata?: Record<string, unknown>
}

/**
 * Canonical Account (Chart of Accounts)
 */
export interface CanonicalAccount {
  /** Account code */
  code: string

  /** Account name */
  name: string

  /** Account type (Asset, Liability, Equity, Revenue, Expense) */
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

  /** Account class (Current, Fixed, etc.) */
  class?: string

  /** Tax type */
  taxType?: string

  /** Whether account is enabled */
  isActive: boolean

  /** Account description */
  description?: string

  /** Parent account code (for sub-accounts) */
  parentCode?: string

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Canonical Report Data
 */
export interface CanonicalReportData {
  /** Report type */
  type: 'profit_loss' | 'balance_sheet' | 'trial_balance' | 'aged_receivables' | 'aged_payables'

  /** Report period start date */
  startDate: string

  /** Report period end date */
  endDate: string

  /** Financial year */
  financialYear: string

  /** Report sections/rows */
  sections: Array<{
    title: string
    rows: Array<{
      accountCode?: string
      accountName: string
      amount: number
      percentage?: number
    }>
    subtotal?: number
  }>

  /** Report totals */
  totals: {
    revenue?: number
    expenses?: number
    netProfit?: number
    assets?: number
    liabilities?: number
    equity?: number
  }

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Validation result for canonical data
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean

  /** Validation errors */
  errors: Array<{
    field: string
    message: string
    code: string
  }>

  /** Validation warnings (non-fatal) */
  warnings: Array<{
    field: string
    message: string
    code: string
  }>
}

/**
 * Data quality metrics
 */
export interface DataQualityMetrics {
  /** Total transactions */
  totalTransactions: number

  /** Transactions with missing data */
  missingDataCount: number

  /** Transactions with invalid data */
  invalidDataCount: number

  /** Data completeness score (0-100) */
  completenessScore: number

  /** Data accuracy score (0-100) */
  accuracyScore: number

  /** Overall quality score (0-100) */
  overallScore: number

  /** Issues breakdown */
  issues: Array<{
    type: string
    count: number
    severity: 'critical' | 'warning' | 'info'
    affectedTransactionIds: string[]
  }>
}
