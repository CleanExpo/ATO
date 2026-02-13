/**
 * QuickBooks Historical Data Fetcher
 *
 * Fetches and caches historical transaction data from QuickBooks Online.
 * Supports purchases, bills, invoices, and other transaction types.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { createQuickBooksClient } from './quickbooks-client'
import { createLogger } from '@/lib/logger'

const log = createLogger('integrations:quickbooks')

// ─── Types ───────────────────────────────────────────────────────────

export interface QuickBooksTransaction {
  // QuickBooks transaction structure
  Id: string
  TxnDate: string
  Line: Array<{
    Id: string
    Amount: number
    DetailType: string
    Description?: string
    AccountBasedExpenseLineDetail?: {
      AccountRef: {
        value: string
        name: string
      }
    }
  }>
  TotalAmt: number
  PrivateNote?: string

  // Entity references
  EntityRef?: {
    value: string
    name: string
  }

  // Purchase specific
  PaymentType?: string
  AccountRef?: {
    value: string
    name: string
  }

  // Invoice specific
  CustomerRef?: {
    value: string
    name: string
  }

  // Bill specific
  VendorRef?: {
    value: string
    name: string
  }

  // Metadata
  MetaData?: {
    CreateTime: string
    LastUpdatedTime: string
  }

  DocNumber?: string
  CurrencyRef?: {
    value: string
  }
}

export interface QuickBooksSyncStatus {
  tenant_id: string
  platform: 'quickbooks'
  last_sync_at: string
  status: 'idle' | 'syncing' | 'complete' | 'error'
  transactions_synced: number
  error_message?: string
}

// ─── Historical Data Fetching ────────────────────────────────────────

/**
 * Fetches purchases from QuickBooks
 */
async function fetchQuickBooksPurchases(
  client: Awaited<ReturnType<typeof createQuickBooksClient>>,
  startDate?: string,
  endDate?: string
): Promise<QuickBooksTransaction[]> {
  let query = "SELECT * FROM Purchase"

  const conditions: string[] = []
  if (startDate) {
    conditions.push(`TxnDate >= '${startDate}'`)
  }
  if (endDate) {
    conditions.push(`TxnDate <= '${endDate}'`)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' MAXRESULTS 1000'

  const response = await client.query<{ Purchase?: QuickBooksTransaction[] }>(query)
  return response.QueryResponse.Purchase || []
}

/**
 * Fetches bills from QuickBooks
 */
async function fetchQuickBooksBills(
  client: Awaited<ReturnType<typeof createQuickBooksClient>>,
  startDate?: string,
  endDate?: string
): Promise<QuickBooksTransaction[]> {
  let query = "SELECT * FROM Bill"

  const conditions: string[] = []
  if (startDate) {
    conditions.push(`TxnDate >= '${startDate}'`)
  }
  if (endDate) {
    conditions.push(`TxnDate <= '${endDate}'`)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' MAXRESULTS 1000'

  const response = await client.query<{ Bill?: QuickBooksTransaction[] }>(query)
  return response.QueryResponse.Bill || []
}

/**
 * Fetches invoices from QuickBooks (for revenue tracking)
 */
async function fetchQuickBooksInvoices(
  client: Awaited<ReturnType<typeof createQuickBooksClient>>,
  startDate?: string,
  endDate?: string
): Promise<QuickBooksTransaction[]> {
  let query = "SELECT * FROM Invoice"

  const conditions: string[] = []
  if (startDate) {
    conditions.push(`TxnDate >= '${startDate}'`)
  }
  if (endDate) {
    conditions.push(`TxnDate <= '${endDate}'`)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' MAXRESULTS 1000'

  const response = await client.query<{ Invoice?: QuickBooksTransaction[] }>(query)
  return response.QueryResponse.Invoice || []
}

/**
 * Fetches expenses from QuickBooks (direct expenses, different from purchases)
 */
async function fetchQuickBooksExpenses(
  client: Awaited<ReturnType<typeof createQuickBooksClient>>,
  startDate?: string,
  endDate?: string
): Promise<QuickBooksTransaction[]> {
  let query = "SELECT * FROM Expense"

  const conditions: string[] = []
  if (startDate) {
    conditions.push(`TxnDate >= '${startDate}'`)
  }
  if (endDate) {
    conditions.push(`TxnDate <= '${endDate}'`)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' MAXRESULTS 1000'

  const response = await client.query<{ Expense?: QuickBooksTransaction[] }>(query)
  return response.QueryResponse.Expense || []
}

/**
 * Fetches credit memos from QuickBooks (customer returns and credits)
 */
async function fetchQuickBooksCreditMemos(
  client: Awaited<ReturnType<typeof createQuickBooksClient>>,
  startDate?: string,
  endDate?: string
): Promise<QuickBooksTransaction[]> {
  let query = "SELECT * FROM CreditMemo"

  const conditions: string[] = []
  if (startDate) {
    conditions.push(`TxnDate >= '${startDate}'`)
  }
  if (endDate) {
    conditions.push(`TxnDate <= '${endDate}'`)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' MAXRESULTS 1000'

  const response = await client.query<{ CreditMemo?: QuickBooksTransaction[] }>(query)
  return response.QueryResponse.CreditMemo || []
}

/**
 * Fetches journal entries from QuickBooks (manual accounting entries)
 */
async function fetchQuickBooksJournalEntries(
  client: Awaited<ReturnType<typeof createQuickBooksClient>>,
  startDate?: string,
  endDate?: string
): Promise<QuickBooksTransaction[]> {
  let query = "SELECT * FROM JournalEntry"

  const conditions: string[] = []
  if (startDate) {
    conditions.push(`TxnDate >= '${startDate}'`)
  }
  if (endDate) {
    conditions.push(`TxnDate <= '${endDate}'`)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' MAXRESULTS 1000'

  const response = await client.query<{ JournalEntry?: QuickBooksTransaction[] }>(query)
  return response.QueryResponse.JournalEntry || []
}

/**
 * Fetches all historical transactions from QuickBooks (with optional organization filtering)
 */
export async function fetchQuickBooksHistoricalData(
  tenantId: string,
  options: {
    startDate?: string  // Format: YYYY-MM-DD
    endDate?: string    // Format: YYYY-MM-DD
    types?: ('purchases' | 'bills' | 'invoices' | 'expenses' | 'creditmemos' | 'journalentries')[]
    organizationId?: string  // For multi-org support
  } = {}
): Promise<{
  transactions: QuickBooksTransaction[]
  totalCount: number
}> {
  const client = await createQuickBooksClient(tenantId, options.organizationId)

  // Default: fetch all transaction types for complete tax analysis
  const transactionTypes = options.types || ['purchases', 'bills', 'invoices', 'expenses', 'creditmemos', 'journalentries']
  const allTransactions: QuickBooksTransaction[] = []

  // Fetch each transaction type
  if (transactionTypes.includes('purchases')) {
    log.info('Fetching QuickBooks purchases')
    const purchases = await fetchQuickBooksPurchases(client, options.startDate, options.endDate)
    allTransactions.push(...purchases)
    log.info('Fetched purchases', { count: purchases.length })
  }

  if (transactionTypes.includes('bills')) {
    log.info('Fetching QuickBooks bills')
    const bills = await fetchQuickBooksBills(client, options.startDate, options.endDate)
    allTransactions.push(...bills)
    log.info('Fetched bills', { count: bills.length })
  }

  if (transactionTypes.includes('invoices')) {
    log.info('Fetching QuickBooks invoices')
    const invoices = await fetchQuickBooksInvoices(client, options.startDate, options.endDate)
    allTransactions.push(...invoices)
    log.info('Fetched invoices', { count: invoices.length })
  }

  if (transactionTypes.includes('expenses')) {
    log.info('Fetching QuickBooks expenses')
    const expenses = await fetchQuickBooksExpenses(client, options.startDate, options.endDate)
    allTransactions.push(...expenses)
    log.info('Fetched expenses', { count: expenses.length })
  }

  if (transactionTypes.includes('creditmemos')) {
    log.info('Fetching QuickBooks credit memos')
    const creditMemos = await fetchQuickBooksCreditMemos(client, options.startDate, options.endDate)
    allTransactions.push(...creditMemos)
    log.info('Fetched credit memos', { count: creditMemos.length })
  }

  if (transactionTypes.includes('journalentries')) {
    log.info('Fetching QuickBooks journal entries')
    const journalEntries = await fetchQuickBooksJournalEntries(client, options.startDate, options.endDate)
    allTransactions.push(...journalEntries)
    log.info('Fetched journal entries', { count: journalEntries.length })
  }

  return {
    transactions: allTransactions,
    totalCount: allTransactions.length,
  }
}

// ─── Caching ─────────────────────────────────────────────────────────

/**
 * Stores QuickBooks transactions in cache
 */
export async function cacheQuickBooksTransactions(
  tenantId: string,
  transactions: QuickBooksTransaction[]
): Promise<void> {
  const supabase = await createServiceClient()

  const records = transactions.map(txn => ({
    tenant_id: tenantId,
    platform: 'quickbooks' as const,
    transaction_id: txn.Id,
    transaction_date: txn.TxnDate,
    financial_year: calculateFinancialYear(txn.TxnDate),
    amount: txn.TotalAmt,
    raw_data: txn,
    synced_at: new Date().toISOString(),
  }))

  // Batch insert in chunks of 500
  const chunkSize = 500
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)

    const { error } = await supabase
      .from('historical_transactions_cache')
      .upsert(chunk, {
        onConflict: 'tenant_id,transaction_id,platform',
        ignoreDuplicates: false,
      })

    if (error) {
      log.error('Error caching QuickBooks transactions', error instanceof Error ? error : undefined)
      throw new Error(`Failed to cache transactions: ${error.message}`)
    }

    log.debug('Cached chunk', { chunk: i / chunkSize + 1, totalChunks: Math.ceil(records.length / chunkSize) })
  }
}

/**
 * Gets cached QuickBooks transactions
 */
export async function getCachedQuickBooksTransactions(
  tenantId: string,
  financialYear?: string
): Promise<QuickBooksTransaction[]> {
  const supabase = await createServiceClient()

  let query = supabase
    .from('historical_transactions_cache')
    .select('raw_data')
    .eq('tenant_id', tenantId)
    .eq('platform', 'quickbooks')

  if (financialYear) {
    query = query.eq('financial_year', financialYear)
  }

  const { data, error } = await query

  if (error) {
    log.error('Error getting cached QuickBooks transactions', error instanceof Error ? error : undefined)
    throw new Error(`Failed to get cached transactions: ${error.message}`)
  }

  return data.map(record => record.raw_data as QuickBooksTransaction)
}

/**
 * Updates QuickBooks sync status
 */
export async function updateQuickBooksSyncStatus(
  tenantId: string,
  status: Partial<QuickBooksSyncStatus>
): Promise<void> {
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('audit_sync_status')
    .upsert({
      tenant_id: tenantId,
      platform: 'quickbooks',
      ...status,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tenant_id,platform',
    })

  if (error) {
    log.error('Error updating QuickBooks sync status', error instanceof Error ? error : undefined)
    throw new Error(`Failed to update sync status: ${error.message}`)
  }
}

/**
 * Gets QuickBooks sync status
 */
export async function getQuickBooksSyncStatus(
  tenantId: string
): Promise<QuickBooksSyncStatus | null> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('audit_sync_status')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('platform', 'quickbooks')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    log.error('Error getting QuickBooks sync status', error instanceof Error ? error : undefined)
    throw new Error(`Failed to get sync status: ${error.message}`)
  }

  return data as QuickBooksSyncStatus
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Calculates Australian financial year from date
 *
 * @example
 * calculateFinancialYear('2024-08-15') // Returns 'FY2024-25'
 * calculateFinancialYear('2024-03-20') // Returns 'FY2023-24'
 */
function calculateFinancialYear(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12

  // Australian FY starts July 1
  if (month >= 7) {
    return `FY${year}-${String(year + 1).slice(2)}`
  } else {
    return `FY${year - 1}-${String(year).slice(2)}`
  }
}

/**
 * Full sync: Fetch all historical data and cache it (with optional organization filtering)
 */
export async function syncQuickBooksHistoricalData(
  tenantId: string,
  options: {
    startDate?: string
    endDate?: string
    organizationId?: string
  } = {}
): Promise<{
  success: boolean
  transactionsSynced: number
  error?: string
}> {
  try {
    // Update status: syncing
    await updateQuickBooksSyncStatus(tenantId, {
      status: 'syncing',
      last_sync_at: new Date().toISOString(),
    })

    // Fetch transactions (with optional organization filtering)
    const { transactions, totalCount } = await fetchQuickBooksHistoricalData(
      tenantId,
      options
    )

    // Cache transactions
    if (transactions.length > 0) {
      await cacheQuickBooksTransactions(tenantId, transactions)
    }

    // Update status: complete
    await updateQuickBooksSyncStatus(tenantId, {
      status: 'complete',
      transactions_synced: totalCount,
      last_sync_at: new Date().toISOString(),
    })

    return {
      success: true,
      transactionsSynced: totalCount,
    }

  } catch (error) {
    log.error('QuickBooks sync error', error instanceof Error ? error : undefined, { tenantId })

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update status: error
    await updateQuickBooksSyncStatus(tenantId, {
      status: 'error',
      error_message: errorMessage,
    })

    return {
      success: false,
      transactionsSynced: 0,
      error: errorMessage,
    }
  }
}
