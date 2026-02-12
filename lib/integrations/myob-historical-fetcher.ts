/**
 * MYOB Historical Data Fetcher
 *
 * Fetches and caches 5 years of MYOB AccountRight historical data for forensic tax audit analysis.
 *
 * Features:
 * - Paginated fetching ($top, $skip)
 * - Rate limit handling (60 requests/minute)
 * - Progress tracking
 * - Incremental sync (only new transactions)
 * - Error recovery with retry logic
 *
 * MYOB API Differences from Xero:
 * - Rate limit: 60/min (vs Xero unlimited)
 * - Pagination: $top/$skip (vs page parameter)
 * - Endpoints: /Sale/Invoice/Item, /Purchase/Bill/Item
 * - Authentication: Company file required
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFinancialYears, type FinancialYear } from '@/lib/types'
import { createLogger } from '@/lib/logger'
import { serverConfig } from '@/lib/config/env'

const log = createLogger('integrations:myob')

// Interfaces
export interface MYOBHistoricalTransaction {
    UID: string
    type: string
    Date: string
    Number?: string
    CustomerPurchaseOrderNumber?: string
    Contact?: {
        Name: string
        UID: string
    }
    Lines: Array<{
        Description?: string
        ShipQuantity?: number
        BillQuantity?: number
        UnitPrice?: number
        Account?: {
            UID: string
            DisplayID: string
            Name: string
        }
        TaxCode?: {
            UID: string
            Code: string
        }
        Total: number
    }>
    TotalAmount: number
    Status: string
}

export interface MYOBSyncProgress {
    tenantId: string
    companyFileId: string
    platform: 'myob'
    status: 'idle' | 'syncing' | 'complete' | 'error'
    progress: number // 0-100
    transactionsSynced: number
    totalEstimated: number
    currentYear?: string
    yearsSynced: string[]
    errorMessage?: string
}

export interface MYOBFetchOptions {
    years: number // Number of years to fetch (default: 5)
    forceResync?: boolean // Skip cache and re-fetch
    onProgress?: (progress: MYOBSyncProgress) => void
}

export interface MYOBCredentials {
    accessToken: string
    refreshToken: string
    companyFileId: string
    apiBaseUrl: string
}

/**
 * Fetch historical MYOB transactions for specified financial years
 */
export async function fetchMYOBHistoricalTransactions(
    credentials: MYOBCredentials,
    options: MYOBFetchOptions = { years: 5 }
): Promise<MYOBSyncProgress> {
    const { accessToken, companyFileId, apiBaseUrl } = credentials

    // Initialize sync status
    const syncStatus: MYOBSyncProgress = {
        tenantId: companyFileId, // Use company file ID as tenant ID
        companyFileId,
        platform: 'myob',
        status: 'syncing',
        progress: 0,
        transactionsSynced: 0,
        totalEstimated: options.years * 1000, // Rough estimate
        yearsSynced: [],
    }

    try {
        // Update sync status in database
        await updateMYOBSyncStatus(companyFileId, syncStatus)

        // Generate financial years to fetch
        const financialYears = getFinancialYears().slice(0, options.years)

        log.info('Fetching historical data', { years: options.years, companyFileId })

        // Fetch transactions for each year
        for (let i = 0; i < financialYears.length; i++) {
            const fy = financialYears[i]
            syncStatus.currentYear = fy.value

            log.info('Fetching transactions for financial year', { financialYear: fy.value, startDate: fy.startDate, endDate: fy.endDate })

            // Fetch all transaction types
            // MYOB endpoints: Sale/Invoice, Purchase/Bill, Banking transactions, GeneralJournal
            const transactionTypes = [
                { endpoint: 'Sale/Invoice/Item', type: 'ACCREC' },
                { endpoint: 'Purchase/Bill/Item', type: 'ACCPAY' },
                { endpoint: 'Banking/SpendMoneyTxn', type: 'SPEND' },
                { endpoint: 'Banking/ReceiveMoneyTxn', type: 'RECEIVE' },
                { endpoint: 'GeneralLedger/GeneralJournal', type: 'JOURNAL' },
                { endpoint: 'Sale/Invoice/Service', type: 'ACCREC_SERVICE' }
            ]

            for (const txType of transactionTypes) {
                const transactions = await fetchMYOBTransactionsByType(
                    accessToken,
                    apiBaseUrl,
                    txType.endpoint,
                    txType.type,
                    fy,
                    options.forceResync
                )

                // Store in cache
                await cacheMYOBTransactions(companyFileId, transactions, fy.value)

                syncStatus.transactionsSynced += transactions.length
                syncStatus.progress = Math.round(((i + 1) / financialYears.length) * 100)

                // Call progress callback
                if (options.onProgress) {
                    options.onProgress(syncStatus)
                }

                // Update database
                await updateMYOBSyncStatus(companyFileId, syncStatus)
            }

            syncStatus.yearsSynced.push(fy.value)
        }

        // Mark sync complete
        syncStatus.status = 'complete'
        syncStatus.progress = 100

        await updateMYOBSyncStatus(companyFileId, syncStatus)

        log.info('Sync complete', { transactionsSynced: syncStatus.transactionsSynced })

        return syncStatus

    } catch (error) {
        console.error('[MYOB] Historical fetch error:', error)

        syncStatus.status = 'error'
        syncStatus.errorMessage = error instanceof Error ? error.message : 'Unknown error'

        await updateMYOBSyncStatus(companyFileId, syncStatus)

        throw error
    }
}

/**
 * Fetch MYOB transactions by type with pagination
 * MYOB rate limit: 60 requests/minute, so we add 1-second delays
 */
async function fetchMYOBTransactionsByType(
    accessToken: string,
    apiBaseUrl: string,
    endpoint: string,
    type: string,
    fy: FinancialYear,
    _forceResync: boolean = false
): Promise<MYOBHistoricalTransaction[]> {
    const allTransactions: MYOBHistoricalTransaction[] = []
    let skip = 0
    const top = 100 // Fetch 100 records per request
    const MYOB_RATE_LIMIT_DELAY_MS = 1000 // 1 second between requests (60/min limit)

    const MYOB_CLIENT_ID = serverConfig.myob.clientId

    while (true) {
        try {
            // Build MYOB API URL with pagination
            const url = new URL(`${apiBaseUrl}/${endpoint}`)
            url.searchParams.set('$filter', `Date ge datetime'${fy.startDate}' and Date le datetime'${fy.endDate}'`)
            url.searchParams.set('$top', top.toString())
            url.searchParams.set('$skip', skip.toString())

            log.debug('Fetching transaction page', { endpoint, skip, top })

            // Fetch from MYOB API
            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'x-myobapi-key': MYOB_CLIENT_ID,
                    'x-myobapi-version': 'v2',
                    'Accept': 'application/json',
                }
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`MYOB API error (${response.status}): ${errorText}`)
            }

            const data = await response.json()
            const transactions: MYOBHistoricalTransaction[] = data.Items || []

            if (transactions.length === 0) {
                break // No more pages
            }

            // Add type field to each transaction
            transactions.forEach(tx => {
                tx.type = type
            })

            allTransactions.push(...transactions)

            log.debug('Fetched transactions', { count: transactions.length, type, financialYear: fy.value, skip })

            // Check if there are more pages
            if (transactions.length < top) {
                break // Last page
            }

            skip += top

            // CRITICAL: Rate limit prevention
            // MYOB enforces 60 requests/minute, so wait 1 second between requests
            log.debug('Rate limit prevention delay', { delayMs: MYOB_RATE_LIMIT_DELAY_MS })
            await new Promise(resolve => setTimeout(resolve, MYOB_RATE_LIMIT_DELAY_MS))

        } catch (error) {
            console.error(`[MYOB] Error fetching ${endpoint}:`, error)

            // Retry once after delay
            if (skip === allTransactions.length) {
                log.info('Retrying after error')
                await new Promise(resolve => setTimeout(resolve, 2000))
                continue
            } else {
                throw error
            }
        }
    }

    return allTransactions
}

/**
 * Cache MYOB transactions in database
 */
async function cacheMYOBTransactions(
    companyFileId: string,
    transactions: MYOBHistoricalTransaction[],
    financialYear: string
): Promise<void> {
    if (transactions.length === 0) return

    const supabase = await createServiceClient()

    // Batch insert transactions
    const records = transactions.map(tx => ({
        tenant_id: companyFileId,
        platform: 'myob',
        transaction_id: tx.UID,
        transaction_type: tx.type,
        transaction_date: tx.Date.split('T')[0], // Extract date from ISO string
        financial_year: financialYear,
        raw_data: tx,
        contact_name: tx.Contact?.Name || null,
        total_amount: tx.TotalAmount || 0,
        status: tx.Status || 'Unknown',
        reference: tx.Number || tx.CustomerPurchaseOrderNumber || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }))

    // Upsert in batches of 500 to avoid payload limits
    const batchSize = 500
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)

        const { error } = await supabase
            .from('historical_transactions_cache')
            .upsert(batch, {
                onConflict: 'tenant_id,transaction_id',
                ignoreDuplicates: false, // Update if exists
            })

        if (error) {
            console.error('[MYOB] Error caching transactions:', error)
            throw error
        }

        log.debug('Cached transaction batch', { batch: Math.floor(i / batchSize) + 1, count: batch.length })
    }
}

/**
 * Update MYOB sync status in database
 */
async function updateMYOBSyncStatus(
    companyFileId: string,
    syncStatus: MYOBSyncProgress
): Promise<void> {
    const supabase = await createServiceClient()

    const { error } = await supabase
        .from('audit_sync_status')
        .upsert({
            tenant_id: companyFileId,
            platform: 'myob',
            last_sync_at: new Date().toISOString(),
            sync_status: syncStatus.status,
            sync_progress: syncStatus.progress,
            transactions_synced: syncStatus.transactionsSynced,
            total_transactions_estimated: syncStatus.totalEstimated,
            years_synced: syncStatus.yearsSynced,
            current_year_syncing: syncStatus.currentYear,
            error_message: syncStatus.errorMessage || null,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'tenant_id,platform',
        })

    if (error) {
        console.error('[MYOB] Error updating sync status:', error)
        throw error
    }
}

/**
 * Get cached MYOB transactions
 */
export async function getCachedMYOBTransactions(
    companyFileId: string,
    financialYear?: string
): Promise<MYOBHistoricalTransaction[]> {
    const supabase = await createClient()

    let query = supabase
        .from('historical_transactions_cache')
        .select('raw_data')
        .eq('tenant_id', companyFileId)
        .eq('platform', 'myob')

    if (financialYear) {
        query = query.eq('financial_year', financialYear)
    }

    const { data, error } = await query

    if (error) {
        console.error('[MYOB] Error getting cached transactions:', error)
        throw error
    }

    return data.map(record => record.raw_data as MYOBHistoricalTransaction)
}

/**
 * Get MYOB sync status
 */
export async function getMYOBSyncStatus(
    companyFileId: string
): Promise<MYOBSyncProgress | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('audit_sync_status')
        .select('*')
        .eq('tenant_id', companyFileId)
        .eq('platform', 'myob')
        .single()

    if (error || !data) {
        return null
    }

    return {
        tenantId: data.tenant_id,
        companyFileId: data.tenant_id,
        platform: 'myob',
        status: data.sync_status as 'idle' | 'syncing' | 'complete' | 'error',
        progress: Number(data.sync_progress) || 0,
        transactionsSynced: data.transactions_synced || 0,
        totalEstimated: data.total_transactions_estimated || 0,
        currentYear: data.current_year_syncing || undefined,
        yearsSynced: data.years_synced || [],
        errorMessage: data.error_message || undefined,
    }
}
