/**
 * Historical Data Fetcher
 *
 * Fetches and caches 5 years of Xero historical data for forensic tax audit analysis.
 *
 * Features:
 * - Paginated fetching (100 items per page)
 * - Rate limit handling with exponential backoff
 * - Progress tracking
 * - Incremental sync (only new transactions)
 * - Error recovery
 */

import { XeroClient } from 'xero-node'
import { createXeroClient, refreshXeroTokens, isTokenExpired, type TokenSetInput } from '@/lib/xero/client'
import { withRetry } from '@/lib/xero/retry'
import { createAdminClient, createServiceClient } from '@/lib/supabase/server'
import { getFinancialYears, type FinancialYear } from '@/lib/types'
import { createLogger } from '@/lib/logger'

const log = createLogger('xero:historical-fetcher')

// Interfaces
export interface HistoricalTransaction {
    transactionID: string
    type: string
    date: string
    reference?: string
    contact?: {
        name: string
        contactID: string
    }
    lineItems: Array<{
        description?: string
        quantity?: number
        unitAmount?: number
        accountCode?: string
        taxType?: string
        lineAmount: number
    }>
    total: number
    status: string
}

export interface SyncProgress {
    tenantId: string
    status: 'idle' | 'syncing' | 'complete' | 'error'
    progress: number // 0-100
    transactionsSynced: number
    totalEstimated: number
    currentYear?: string
    yearsSynced: string[]
    errorMessage?: string
}

export interface FetchOptions {
    years: number // Number of years to fetch (default: 5)
    forceResync?: boolean // Skip cache and re-fetch
    onProgress?: (progress: SyncProgress) => void
}

/**
 * Fetch historical transactions for specified financial years
 */
export async function fetchHistoricalTransactions(
    tenantId: string,
    accessToken: string,
    refreshToken: string,
    options: FetchOptions = { years: 5 }
): Promise<SyncProgress> {
    // Initialize sync status
    const syncStatus: SyncProgress = {
        tenantId,
        status: 'syncing',
        progress: 0,
        transactionsSynced: 0,
        totalEstimated: options.years * 1000, // Rough estimate
        yearsSynced: [],
    }

    try {
        // Update sync status in database
        await updateSyncStatus(tenantId, syncStatus)

        // Generate financial years to fetch
        const financialYears = getFinancialYears().slice(0, options.years)

        log.info('Fetching historical data', { tenantId, years: options.years })

        // Create Xero client
        const xero = createXeroClient()
        await xero.initialize()

        // Check if token needs refresh
        let currentAccessToken = accessToken
         
        if (isTokenExpired({ access_token: accessToken, refresh_token: refreshToken, expires_at: 0 } as TokenSetInput)) {
             
            const newTokens = await refreshXeroTokens({ access_token: accessToken, refresh_token: refreshToken, expires_at: 0 } as TokenSetInput)
            currentAccessToken = newTokens.access_token || accessToken
        }

        xero.setTokenSet({
            access_token: currentAccessToken,
            refresh_token: refreshToken,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
        })

        // Fetch transactions for each year
        for (let i = 0; i < financialYears.length; i++) {
            const fy = financialYears[i]
            syncStatus.currentYear = fy.value

            log.info('Fetching transactions for financial year', { fy: fy.value, startDate: fy.startDate, endDate: fy.endDate })

            // Fetch all transaction types
            const transactionTypes = ['ACCPAY', 'ACCREC', 'BANK'] // Accounts Payable, Accounts Receivable, Bank Transactions

            for (const type of transactionTypes) {
                const transactions = await fetchTransactionsByType(
                    xero,
                    tenantId,
                    type,
                    fy,
                    options.forceResync
                )

                // Store in cache
                await cacheTransactions(tenantId, transactions, fy.value)

                syncStatus.transactionsSynced += transactions.length
                syncStatus.progress = ((i + 1) / financialYears.length) * 100

                // Call progress callback
                if (options.onProgress) {
                    options.onProgress(syncStatus)
                }

                // Update database
                await updateSyncStatus(tenantId, syncStatus)
            }

            syncStatus.yearsSynced.push(fy.value)
        }

        // Mark sync complete
        syncStatus.status = 'complete'
        syncStatus.progress = 100

        await updateSyncStatus(tenantId, syncStatus)

        log.info('Sync complete', { transactionsSynced: syncStatus.transactionsSynced })

        return syncStatus

    } catch (error) {
        log.error('Historical fetch error', error instanceof Error ? error : undefined, { tenantId })

        syncStatus.status = 'error'
        syncStatus.errorMessage = error instanceof Error ? error.message : 'Unknown error'

        await updateSyncStatus(tenantId, syncStatus)

        throw error
    }
}

/**
 * Fetch transactions by type with pagination
 * Includes rate limit prevention with inter-request delays
 */
async function fetchTransactionsByType(
    xero: XeroClient,
    tenantId: string,
    type: string,
    fy: FinancialYear,
    _forceResync: boolean = false
): Promise<HistoricalTransaction[]> {
    const allTransactions: HistoricalTransaction[] = []
    let page = 1
    const pageSize = 100 // Xero API max page size
    const INTER_REQUEST_DELAY_MS = 1000 // 1 second delay between requests to prevent rate limiting

    while (true) {
        const transactions = await withRetry(
            async () => {
                // Construct where clause for date range
                const where = `Date >= DateTime(${fy.startDate.replace(/-/g, ',')}) AND Date <= DateTime(${fy.endDate.replace(/-/g, ',')})`

                // Fetch page from Xero
                 
                switch (type) {
                    case 'ACCPAY':
                    case 'ACCREC': {
                        const invResponse = await xero.accountingApi.getInvoices(tenantId, undefined, where, undefined, undefined, undefined, undefined, undefined, page)
                        return (invResponse.body.invoices || []) as unknown as HistoricalTransaction[]
                    }
                    case 'BANK': {
                        const bankResponse = await xero.accountingApi.getBankTransactions(tenantId, undefined, where, undefined, page)
                        return (bankResponse.body.bankTransactions || []) as unknown as HistoricalTransaction[]
                    }
                    default:
                        return []
                }
            },
            {
                maxAttempts: 3,
                timeoutMs: 30000,
                initialBackoffMs: 1000,
                onRetry: (attempt, error) => {
                    log.warn('Retrying fetch', { type, page, attempt, error: error instanceof Error ? error.message : String(error) })
                },
            }
        )

        if (transactions.length === 0) {
            break // No more pages
        }

        allTransactions.push(...transactions)

        log.info('Fetched transactions page', { type, fy: fy.value, page, count: transactions.length })

        // Check if there are more pages
        if (transactions.length < pageSize) {
            break // Last page
        }

        page++

        // Rate limit prevention: Add delay before next request
        if (page > 1) {  // Don't delay on first request
            log.debug('Rate limit prevention delay', { delayMs: INTER_REQUEST_DELAY_MS, nextPage: page })
            await new Promise(resolve => setTimeout(resolve, INTER_REQUEST_DELAY_MS))
        }
    }

    return allTransactions
}

/**
 * Cache transactions in database
 */
async function cacheTransactions(
    tenantId: string,
    transactions: HistoricalTransaction[],
    financialYear: string
): Promise<void> {
    if (transactions.length === 0) return

    const supabase = createAdminClient()

    // Batch insert transactions
    // Filter out transactions without IDs and map to cache records
    const cacheRecords = transactions
        .map(txn => {
            // Extract transaction ID based on type
            // Xero uses different ID fields for different transaction types
            const txnRecord = txn as unknown as Record<string, unknown>
            const transactionId = txnRecord.bankTransactionID ||
                                  txnRecord.invoiceID ||
                                  txnRecord.transactionID ||
                                  txn.transactionID

            // Debug logging for transactions without IDs
            if (!transactionId) {
                log.warn('Transaction without ID found', {
                    type: txn.type,
                    date: txn.date,
                    total: txn.total,
                    availableKeys: Object.keys(txn).filter(k => k.toLowerCase().includes('id'))
                })
            }

            return {
                tenant_id: tenantId,
                transaction_id: transactionId,
                transaction_type: txn.type,
                transaction_date: txn.date,
                financial_year: financialYear,
                platform: 'xero',
                raw_data: txn,
                // Re-enabled after schema cache reload (migration 013)
                contact_name: txn.contact?.name || null,
                total_amount: txn.total || null,
                status: txn.status || null,
                reference: txn.reference || null,
            }
        })
        .filter(record => {
            // Skip transactions without valid IDs
            if (!record.transaction_id || record.transaction_id === 'null' || record.transaction_id === null) {
                log.warn('Skipping transaction without valid ID', { type: record.transaction_type, date: record.transaction_date })
                return false
            }
            return true
        })

    // Insert with ON CONFLICT DO UPDATE (upsert)
    const { error } = await supabase
        .from('historical_transactions_cache')
        .upsert(cacheRecords, {
            onConflict: 'tenant_id,transaction_id',
            ignoreDuplicates: false,
        })

    if (error) {
        log.error('Error caching transactions', error instanceof Error ? error : undefined)
        throw error
    }

    const skippedCount = transactions.length - cacheRecords.length
    if (skippedCount > 0) {
        log.warn('Cached transactions with skips', { cached: cacheRecords.length, total: transactions.length, financialYear, skippedCount })
    } else {
        log.info('Cached transactions', { count: cacheRecords.length, financialYear })
    }
}

/**
 * Update sync status in database
 */
async function updateSyncStatus(tenantId: string, status: SyncProgress): Promise<void> {
    const supabase = createAdminClient()

    const { error } = await supabase
        .from('audit_sync_status')
        .upsert({
            tenant_id: tenantId,
            platform: 'xero',
            last_sync_at: new Date().toISOString(),
            sync_status: status.status,
            sync_progress: status.progress,
            transactions_synced: status.transactionsSynced,
            total_transactions_estimated: status.totalEstimated, // Re-enabled after schema cache reload (migration 013)
            years_synced: status.yearsSynced,
            current_year_syncing: status.currentYear,
            error_message: status.errorMessage,
            error_count: status.errorMessage ? 1 : 0,
            last_error_at: status.errorMessage ? new Date().toISOString() : null,
        }, {
            onConflict: 'tenant_id,platform',
        })

    if (error) {
        log.error('Error updating sync status', error instanceof Error ? error : undefined)
        throw error
    }
}

/**
 * Get sync status for a tenant
 */
export async function getSyncStatus(tenantId: string): Promise<SyncProgress | null> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('audit_sync_status')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

    if (error) {
        if (error.code === 'PGRST116') {
            // No status record yet
            return null
        }
        log.error('Error getting sync status', error instanceof Error ? error : undefined)
        throw error
    }

    return {
        tenantId: data.tenant_id,
        status: data.sync_status as 'idle' | 'syncing' | 'complete' | 'error',
        progress: parseFloat(data.sync_progress),
        transactionsSynced: data.transactions_synced,
        totalEstimated: data.total_transactions_estimated || (data.transactions_synced > 0 ? data.transactions_synced : 5000), // Fallback estimate
        currentYear: data.current_year_syncing,
        yearsSynced: data.years_synced || [],
        errorMessage: data.error_message,
    }
}

/**
 * Get cached transactions from database
 */
export async function getCachedTransactions(
    tenantId: string,
    financialYear?: string
): Promise<HistoricalTransaction[]> {
    // Use admin client to bypass RLS for server-side operations
    const supabase = createAdminClient()

    // Supabase has a default 1000 row limit - we need to paginate to get all records
    const allRecords: HistoricalTransaction[] = []
    const pageSize = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
        let query = supabase
            .from('historical_transactions_cache')
            .select('raw_data')
            .eq('tenant_id', tenantId)
            .range(offset, offset + pageSize - 1)
            .order('created_at', { ascending: true })

        if (financialYear) {
            query = query.eq('financial_year', financialYear)
        }

        const { data, error } = await query

        if (error) {
            log.error('Error getting cached transactions', error instanceof Error ? error : undefined)
            throw error
        }

        if (data && data.length > 0) {
            allRecords.push(...data.map(record => record.raw_data as HistoricalTransaction))
            offset += pageSize
            hasMore = data.length === pageSize // If we got a full page, there might be more
        } else {
            hasMore = false
        }
    }

    log.info('Retrieved cached transactions', { tenantId, count: allRecords.length })
    return allRecords
}

/**
 * Calculate financial year from date
 */
export function calculateFinancialYear(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const year = d.getFullYear()
    const month = d.getMonth() + 1 // 0-indexed

    // Australian FY runs July 1 - June 30
    if (month >= 7) {
        return `FY${year}-${String(year + 1).slice(2)}`
    } else {
        return `FY${year - 1}-${String(year).slice(2)}`
    }
}
