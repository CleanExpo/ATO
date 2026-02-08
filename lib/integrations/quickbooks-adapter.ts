/**
 * QuickBooks Data Adapter
 *
 * Normalizes QuickBooks transaction data into a common format for AI analysis.
 * Maps QuickBooks-specific field names and structures to platform-agnostic format.
 */

import type { QuickBooksTransaction } from './quickbooks-historical-fetcher'

// ─── Normalized Transaction Format ───────────────────────────────────

export interface NormalizedTransaction {
  // Identity
  transactionId: string
  platform: 'quickbooks'

  // Core fields
  date: string             // ISO date
  description: string
  amount: number
  type: string            // Purchase, Bill, Invoice, etc.

  // Entity/contact
  contact?: {
    name: string
    id: string
  }

  // Line items
  lineItems?: Array<{
    description?: string
    amount: number
    accountCode?: string
    accountName?: string
  }>

  // Metadata
  reference?: string
  currencyCode?: string
  createdDate?: string
  updatedDate?: string

  // Raw data for reference
  rawData: QuickBooksTransaction
}

// ─── Adapter Functions ───────────────────────────────────────────────

/**
 * Normalizes QuickBooks transaction to common format
 */
export function normalizeQuickBooksTransaction(
  qbTxn: QuickBooksTransaction
): NormalizedTransaction {
  // Determine contact (vendor, customer, or entity)
  const contact = extractContact(qbTxn)

  // Extract line items
  const lineItems = qbTxn.Line?.map(line => ({
    description: line.Description || '',
    amount: line.Amount || 0,
    accountCode: line.AccountBasedExpenseLineDetail?.AccountRef?.value,
    accountName: line.AccountBasedExpenseLineDetail?.AccountRef?.name,
  }))

  // Build description from available fields
  const description = buildDescription(qbTxn, contact)

  // Determine transaction type
  const type = determineTransactionType(qbTxn)

  return {
    transactionId: qbTxn.Id,
    platform: 'quickbooks',
    date: qbTxn.TxnDate,
    description,
    amount: qbTxn.TotalAmt,
    type,
    contact,
    lineItems,
    reference: qbTxn.DocNumber,
    currencyCode: qbTxn.CurrencyRef?.value || 'USD',
    createdDate: qbTxn.MetaData?.CreateTime,
    updatedDate: qbTxn.MetaData?.LastUpdatedTime,
    rawData: qbTxn,
  }
}

/**
 * Extracts contact information from QuickBooks transaction
 */
function extractContact(qbTxn: QuickBooksTransaction): { name: string; id: string } | undefined {
  // Check vendor (for bills and purchases)
  if (qbTxn.VendorRef) {
    return {
      name: qbTxn.VendorRef.name,
      id: qbTxn.VendorRef.value,
    }
  }

  // Check customer (for invoices)
  if (qbTxn.CustomerRef) {
    return {
      name: qbTxn.CustomerRef.name,
      id: qbTxn.CustomerRef.value,
    }
  }

  // Check entity (generic reference)
  if (qbTxn.EntityRef) {
    return {
      name: qbTxn.EntityRef.name,
      id: qbTxn.EntityRef.value,
    }
  }

  return undefined
}

/**
 * Builds a descriptive string from QuickBooks transaction
 */
function buildDescription(
  qbTxn: QuickBooksTransaction,
  contact?: { name: string; id: string }
): string {
  const parts: string[] = []

  // Add document number if available
  if (qbTxn.DocNumber) {
    parts.push(`#${qbTxn.DocNumber}`)
  }

  // Add contact name
  if (contact) {
    parts.push(contact.name)
  }

  // Add private note if available
  if (qbTxn.PrivateNote) {
    parts.push(qbTxn.PrivateNote)
  }

  // Add line item descriptions
  const lineDescriptions = qbTxn.Line
    ?.map(line => line.Description)
    .filter((desc): desc is string => Boolean(desc))
    .slice(0, 2) // Limit to first 2 line items

  if (lineDescriptions && lineDescriptions.length > 0) {
    parts.push(...lineDescriptions)
  }

  // Add payment type if available
  if (qbTxn.PaymentType) {
    parts.push(`via ${qbTxn.PaymentType}`)
  }

  return parts.join(' - ') || 'No description'
}

/**
 * Determines transaction type from QuickBooks data
 */
function determineTransactionType(qbTxn: QuickBooksTransaction): string {
  // QuickBooks responses may include extra fields not in our base type.
  // Use a Record cast to check for those extended fields safely.
  const extendedData = qbTxn as unknown as Record<string, unknown>

  // Check for explicit type in metadata or domain
  if (typeof extendedData.domain === 'string') {
    if (extendedData.domain === 'Expense') return 'Expense';
    if (extendedData.domain === 'CreditMemo') return 'CreditMemo';
    if (extendedData.domain === 'JournalEntry') return 'JournalEntry';
    if (extendedData.domain === 'Purchase') return 'Purchase';
    if (extendedData.domain === 'Bill') return 'Bill';
    if (extendedData.domain === 'Invoice') return 'Invoice';
  }

  // Check for type indicators in the raw data structure
  if (qbTxn.VendorRef) {
    if (qbTxn.PaymentType) {
      return 'Purchase'
    }
    return 'Bill'
  }

  if (qbTxn.CustomerRef) {
    // CreditMemos also have CustomerRef, check for specific fields
    if (extendedData.RemainingCredit !== undefined || extendedData.Balance === 0) {
      return 'CreditMemo';
    }
    return 'Invoice'
  }

  // Journal entries typically have no vendor/customer reference
  if (extendedData.Adjustment || (qbTxn.Line && qbTxn.Line.length > 1 && !qbTxn.VendorRef && !qbTxn.CustomerRef)) {
    return 'JournalEntry';
  }

  if (qbTxn.AccountRef) {
    return 'Expense'
  }

  return 'Transaction'
}

/**
 * Converts QuickBooks date to ISO format
 */
export function normalizeQuickBooksDate(qbDate: string): string {
  // QuickBooks dates are typically in YYYY-MM-DD format already
  return qbDate
}

/**
 * Batch normalizes multiple QuickBooks transactions
 */
export function normalizeQuickBooksTransactions(
  qbTransactions: QuickBooksTransaction[]
): NormalizedTransaction[] {
  return qbTransactions.map(normalizeQuickBooksTransaction)
}

/**
 * Extracts transaction IDs from QuickBooks transactions
 */
export function extractQuickBooksTransactionIds(
  qbTransactions: QuickBooksTransaction[]
): string[] {
  return qbTransactions.map(txn => txn.Id)
}

/**
 * Filters QuickBooks transactions by date range
 */
export function filterQuickBooksByDateRange(
  qbTransactions: QuickBooksTransaction[],
  startDate: string,
  endDate: string
): QuickBooksTransaction[] {
  return qbTransactions.filter(txn => {
    const txnDate = txn.TxnDate
    return txnDate >= startDate && txnDate <= endDate
  })
}

/**
 * Groups QuickBooks transactions by financial year
 */
export function groupQuickBooksByFinancialYear(
  qbTransactions: QuickBooksTransaction[]
): Record<string, QuickBooksTransaction[]> {
  const grouped: Record<string, QuickBooksTransaction[]> = {}

  for (const txn of qbTransactions) {
    const fy = calculateFinancialYear(txn.TxnDate)
    if (!grouped[fy]) {
      grouped[fy] = []
    }
    grouped[fy].push(txn)
  }

  return grouped
}

/**
 * Calculates Australian financial year from date
 */
function calculateFinancialYear(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  if (month >= 7) {
    return `FY${year}-${String(year + 1).slice(2)}`
  } else {
    return `FY${year - 1}-${String(year).slice(2)}`
  }
}
