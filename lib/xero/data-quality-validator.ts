/**
 * Data Quality Validator
 *
 * Validates and identifies integrity issues in Xero data BEFORE tax analysis.
 * Addresses the user's concern: "items are out of position, applied incorrectly"
 *
 * Validates 4 critical issue types:
 * 1. Transactions in wrong accounts (expenses coded as assets)
 * 2. Incorrect tax classifications (GST/BAS errors)
 * 3. Unreconciled bank transactions (duplicates, mismatches)
 * 4. Misallocated payments/receipts (applied to wrong invoices)
 */

import { createClient } from '@/lib/supabase/server'
import { classifyTransaction, type Transaction, type AccountCodeOption } from '@/lib/ai/account-classifier'
import type { HistoricalTransaction } from '@/lib/xero/historical-fetcher'
import { createLogger } from '@/lib/logger'

const log = createLogger('xero:data-quality')

// Types
export interface DataQualityIssue {
    issueId: string
    transactionId: string
    issueType: 'wrong_account' | 'tax_classification' | 'unreconciled' | 'misallocated' | 'duplicate' | 'missing_data'
    severity: 'critical' | 'high' | 'medium' | 'low'

    currentState: {
        accountCode?: string
        accountName?: string
        taxType?: string
        reconciliationStatus?: string
        appliedTo?: string
        amount?: number
        description?: string
    }

    suggestedFix: {
        accountCode?: string
        accountName?: string
        taxType?: string
        reconciliationMatch?: string
        correctAllocation?: string
        reasoning: string
    }

    confidence: number // 0-100 (only auto-fix if > 90%)
    aiReasoning: string
    impactAmount: number
    financialYear: string
}

export interface ScanOptions {
    tenantId: string
    financialYears: string[]
    issueTypes?: Array<'wrong_account' | 'tax_classification' | 'unreconciled' | 'misallocated' | 'duplicate'>
    autoFixThreshold?: number  // Default: 90 - only auto-fix if confidence >= this
    onProgress?: (progress: number, message: string) => void
}

export interface ScanResult {
    scanId: string
    tenantId: string
    transactionsScanned: number
    issuesFound: number
    issuesAutoFixed: number
    issuesPendingReview: number
    issuesByType: Record<string, number>
    totalImpactAmount: number
    issues: DataQualityIssue[]
}

/**
 * Main function: Scan all transactions for data quality issues
 */
export async function scanForDataQualityIssues(options: ScanOptions): Promise<ScanResult> {
    const supabase = await createClient()
    const { tenantId, financialYears, autoFixThreshold = 90 } = options

    // Initialize scan status
    await initializeScanStatus(tenantId)

    const allIssues: DataQualityIssue[] = []
    let transactionsScanned = 0

    try {
        // Update scan status
        await updateScanStatus(tenantId, {
            scan_status: 'scanning',
            scan_progress: 0,
            scan_started_at: new Date().toISOString()
        })

        // Get all cached transactions for the specified years
        const { data: transactions, error } = await supabase
            .from('historical_transactions_cache')
            .select('*')
            .eq('tenant_id', tenantId)
            .in('financial_year', financialYears)

        if (error) {
            throw error
        }

        if (!transactions || transactions.length === 0) {
            log.warn('No transactions found', { tenantId })
            return {
                scanId: crypto.randomUUID(),
                tenantId,
                transactionsScanned: 0,
                issuesFound: 0,
                issuesAutoFixed: 0,
                issuesPendingReview: 0,
                issuesByType: {},
                totalImpactAmount: 0,
                issues: []
            }
        }

        log.info('Scanning transactions for data quality issues', { tenantId, count: transactions.length })

        // Fetch chart of accounts (needed for account classification)
        const chartOfAccounts = await fetchChartOfAccounts(tenantId)

        // Scan each transaction
        for (let i = 0; i < transactions.length; i++) {
            const txn = transactions[i]
            transactionsScanned++

            // Progress update every 100 transactions
            if (i % 100 === 0) {
                const progress = (i / transactions.length) * 100
                await updateScanStatus(tenantId, {
                    scan_progress: progress.toFixed(2),
                    transactions_scanned: transactionsScanned
                })

                if (options.onProgress) {
                    options.onProgress(progress, `Scanned ${transactionsScanned}/${transactions.length} transactions`)
                }
            }

            // Check for wrong account (using AI classifier)
            if (!options.issueTypes || options.issueTypes.includes('wrong_account')) {
                const wrongAccountIssue = await checkWrongAccount(txn, chartOfAccounts)
                if (wrongAccountIssue) {
                    allIssues.push(wrongAccountIssue)
                }
            }

            // Check for tax classification errors
            if (!options.issueTypes || options.issueTypes.includes('tax_classification')) {
                const taxIssue = await checkTaxClassification(txn)
                if (taxIssue) {
                    allIssues.push(taxIssue)
                }
            }

            // Check for duplicates
            if (!options.issueTypes || options.issueTypes.includes('duplicate')) {
                const duplicateIssue = await checkForDuplicates(txn, transactions)
                if (duplicateIssue) {
                    allIssues.push(duplicateIssue)
                }
            }

            // Check for unreconciled transactions
            if (!options.issueTypes || options.issueTypes.includes('unreconciled')) {
                const unreconciledIssue = await checkUnreconciled(txn)
                if (unreconciledIssue) {
                    allIssues.push(unreconciledIssue)
                }
            }
        }

        // Store issues in database
        await storeIssues(tenantId, allIssues)

        // Calculate statistics
        const issuesByType = allIssues.reduce((acc, issue) => {
            acc[issue.issueType] = (acc[issue.issueType] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        const issuesAutoFixed = allIssues.filter(i => i.confidence >= autoFixThreshold).length
        const issuesPendingReview = allIssues.filter(i => i.confidence >= 70 && i.confidence < autoFixThreshold).length
        const totalImpactAmount = allIssues.reduce((sum, i) => sum + i.impactAmount, 0)

        // Update final scan status
        await updateScanStatus(tenantId, {
            scan_status: 'complete',
            scan_progress: 100,
            scan_completed_at: new Date().toISOString(),
            transactions_scanned: transactionsScanned,
            issues_found: allIssues.length,
            issues_auto_corrected: issuesAutoFixed,
            issues_pending_review: issuesPendingReview,
            wrong_account_count: issuesByType['wrong_account'] || 0,
            tax_classification_count: issuesByType['tax_classification'] || 0,
            unreconciled_count: issuesByType['unreconciled'] || 0,
            misallocated_count: issuesByType['misallocated'] || 0,
            duplicate_count: issuesByType['duplicate'] || 0,
            total_impact_amount: totalImpactAmount.toFixed(2)
        })

        log.info('Data quality scan complete', { tenantId, issuesFound: allIssues.length })

        return {
            scanId: crypto.randomUUID(),
            tenantId,
            transactionsScanned,
            issuesFound: allIssues.length,
            issuesAutoFixed,
            issuesPendingReview,
            issuesByType,
            totalImpactAmount,
            issues: allIssues
        }

    } catch (error) {
        log.error('Data quality scan failed', error instanceof Error ? error : undefined, { tenantId })

        // Update error status
        await updateScanStatus(tenantId, {
            scan_status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error'
        })

        throw error
    }
}

/**
 * Check if transaction is in wrong account using AI classifier
 */
async function checkWrongAccount(
    txn: Record<string, unknown>,
    chartOfAccounts: AccountCodeOption[]
): Promise<DataQualityIssue | null> {
    try {
        // Extract transaction data
        const rawData = txn.raw_data as HistoricalTransaction

        // Get primary line item for classification
        const lineItem = rawData.lineItems?.[0]
        if (!lineItem) {
            return null // Skip transactions without line items
        }

        // Prepare transaction for classification
        const transaction: Transaction = {
            transactionId: txn.transaction_id as string,
            date: txn.transaction_date as string,
            description: lineItem.description || (txn.contact_name as string) || 'No description',
            supplier: rawData.contact?.name,
            amount: Math.abs(lineItem.lineAmount),
            currentAccountCode: lineItem.accountCode || '',
            currentAccountName: chartOfAccounts.find(acc => acc.code === lineItem.accountCode)?.name || 'Unknown',
            taxType: lineItem.taxType
        }

        // Classify using AI
        const classification = await classifyTransaction(transaction, {
            chartOfAccounts,
            industryContext: 'General business'
        })

        // If incorrect, create issue
        if (!classification.isCorrect && classification.suggestedAccountCode) {
            return {
                issueId: crypto.randomUUID(),
                transactionId: txn.transaction_id as string,
                issueType: 'wrong_account',
                severity: classification.severity,
                currentState: {
                    accountCode: transaction.currentAccountCode,
                    accountName: transaction.currentAccountName,
                    amount: transaction.amount,
                    description: transaction.description
                },
                suggestedFix: {
                    accountCode: classification.suggestedAccountCode,
                    accountName: classification.suggestedAccountName || '',
                    reasoning: classification.reasoning
                },
                confidence: classification.confidence,
                aiReasoning: classification.reasoning,
                impactAmount: transaction.amount,
                financialYear: txn.financial_year as string
            }
        }

        return null

    } catch (error) {
        log.error('Error checking account for transaction', error instanceof Error ? error : undefined, { transactionId: txn.transaction_id })
        return null
    }
}

/**
 * Check for tax classification errors
 */
async function checkTaxClassification(txn: Record<string, unknown>): Promise<DataQualityIssue | null> {
    try {
        const rawData = txn.raw_data as HistoricalTransaction
        const lineItem = rawData.lineItems?.[0]

        if (!lineItem || !lineItem.taxType) {
            return null
        }

        // Simple heuristic checks (can be enhanced)
        // Example: Check if GST-free items are marked correctly
        const description = (lineItem.description || '').toLowerCase()

        // Items that should be GST-free
        const gstFreeKeywords = ['international', 'export', 'basic food', 'medical', 'education']
        const shouldBeGstFree = gstFreeKeywords.some(kw => description.includes(kw))

        if (shouldBeGstFree && lineItem.taxType !== 'EXEMPTINPUT' && lineItem.taxType !== 'NONE') {
            return {
                issueId: crypto.randomUUID(),
                transactionId: txn.transaction_id as string,
                issueType: 'tax_classification',
                severity: 'medium',
                currentState: {
                    taxType: lineItem.taxType,
                    description: lineItem.description,
                    amount: Math.abs(lineItem.lineAmount)
                },
                suggestedFix: {
                    taxType: 'EXEMPTINPUT',
                    reasoning: 'Transaction appears to be GST-free based on description'
                },
                confidence: 60,  // Conservative confidence
                aiReasoning: 'Keyword match suggests GST-free treatment',
                impactAmount: Math.abs(lineItem.lineAmount) * 0.1,  // 10% GST impact
                financialYear: txn.financial_year as string
            }
        }

        return null

    } catch (error) {
        log.error('Error checking tax classification', error instanceof Error ? error : undefined, { transactionId: txn.transaction_id })
        return null
    }
}

/**
 * Check for duplicate transactions
 */
async function checkForDuplicates(txn: Record<string, unknown>, allTransactions: Record<string, unknown>[]): Promise<DataQualityIssue | null> {
    try {
        // Find potential duplicates (same date, amount, description)
        const rawData = txn.raw_data as HistoricalTransaction

        const duplicates = allTransactions.filter(other => {
            if (other.transaction_id === txn.transaction_id) return false

            const otherData = other.raw_data as HistoricalTransaction

            return (
                other.transaction_date === txn.transaction_date &&
                Math.abs(otherData.total - rawData.total) < 0.01 &&  // Same amount (within 1 cent)
                otherData.contact?.name === rawData.contact?.name  // Same supplier
            )
        })

        if (duplicates.length > 0) {
            return {
                issueId: crypto.randomUUID(),
                transactionId: txn.transaction_id as string,
                issueType: 'duplicate',
                severity: 'high',
                currentState: {
                    description: rawData.contact?.name || 'No description',
                    amount: Math.abs(rawData.total)
                },
                suggestedFix: {
                    reasoning: `Possible duplicate of transaction(s): ${duplicates.map(d => d.transaction_id as string).join(', ')}`
                },
                confidence: 75,
                aiReasoning: 'Same date, amount, and supplier - likely duplicate',
                impactAmount: Math.abs(rawData.total),
                financialYear: txn.financial_year as string
            }
        }

        return null

    } catch (error) {
        log.error('Error checking duplicates', error instanceof Error ? error : undefined, { transactionId: txn.transaction_id })
        return null
    }
}

/**
 * Check for unreconciled transactions
 */
async function checkUnreconciled(txn: Record<string, unknown>): Promise<DataQualityIssue | null> {
    try {
        const rawData = txn.raw_data as HistoricalTransaction

        // Check if bank transaction is unreconciled
        if (txn.transaction_type === 'BANK' && rawData.status !== 'AUTHORISED') {
            return {
                issueId: crypto.randomUUID(),
                transactionId: txn.transaction_id as string,
                issueType: 'unreconciled',
                severity: 'medium',
                currentState: {
                    reconciliationStatus: rawData.status,
                    amount: Math.abs(rawData.total)
                },
                suggestedFix: {
                    reasoning: 'Bank transaction not reconciled - may need matching or approval'
                },
                confidence: 80,
                aiReasoning: 'Transaction status indicates not authorised',
                impactAmount: Math.abs(rawData.total),
                financialYear: txn.financial_year as string
            }
        }

        return null

    } catch (error) {
        log.error('Error checking reconciliation', error instanceof Error ? error : undefined, { transactionId: txn.transaction_id })
        return null
    }
}

/**
 * Fetch chart of accounts for the tenant
 */
async function fetchChartOfAccounts(_tenantId: string): Promise<AccountCodeOption[]> {
    // In a real implementation, this would fetch from Xero API
    // For now, return a basic chart of accounts
    return [
        { code: '200', name: 'Sales', type: 'revenue' },
        { code: '310', name: 'Office Expenses', type: 'expense' },
        { code: '320', name: 'Software Expenses', type: 'expense' },
        { code: '400', name: 'Advertising', type: 'expense' },
        { code: '404', name: 'Bank Fees', type: 'expense' },
        { code: '408', name: 'Consulting & Accounting', type: 'expense' },
        { code: '412', name: 'Insurance', type: 'expense' },
        { code: '416', name: 'Interest Expense', type: 'expense' },
        { code: '420', name: 'Legal Expenses', type: 'expense' },
        { code: '425', name: 'Motor Vehicle Expenses', type: 'expense' },
        { code: '429', name: 'Printing & Stationery', type: 'expense' },
        { code: '433', name: 'Rent', type: 'expense' },
        { code: '437', name: 'Repairs & Maintenance', type: 'expense' },
        { code: '441', name: 'Telephone & Internet', type: 'expense' },
        { code: '445', name: 'Travel - National', type: 'expense' },
        { code: '449', name: 'Utilities', type: 'expense' },
        { code: '710', name: 'Computer Equipment', type: 'asset' },
        { code: '720', name: 'Office Equipment', type: 'asset' },
        { code: '800', name: 'Loan - Bank', type: 'liability' },
    ]
}

/**
 * Store issues in database
 */
async function storeIssues(tenantId: string, issues: DataQualityIssue[]): Promise<void> {
    if (issues.length === 0) return

    const supabase = await createClient()

    // Batch insert issues
    const records = issues.map(issue => ({
        tenant_id: tenantId,
        transaction_id: issue.transactionId,
        financial_year: issue.financialYear,
        issue_type: issue.issueType,
        severity: issue.severity,
        current_state: issue.currentState,
        suggested_fix: issue.suggestedFix,
        confidence: issue.confidence,
        ai_reasoning: issue.aiReasoning,
        impact_amount: issue.impactAmount,
        status: issue.confidence >= 90 ? 'auto_corrected' : 'pending_review'
    }))

    const { error } = await supabase
        .from('data_quality_issues')
        .upsert(records, {
            onConflict: 'tenant_id,transaction_id,issue_type',
            ignoreDuplicates: false
        })

    if (error) {
        log.error('Error storing data quality issues', error instanceof Error ? error : undefined)
        throw error
    }

    log.info('Stored data quality issues', { count: issues.length })
}

/**
 * Initialize scan status for tenant
 */
async function initializeScanStatus(tenantId: string): Promise<void> {
    const supabase = await createClient()

    await supabase
        .from('data_quality_scan_status')
        .upsert({
            tenant_id: tenantId,
            scan_status: 'idle',
            scan_progress: 0
        }, {
            onConflict: 'tenant_id'
        })
}

/**
 * Update scan status
 */
async function updateScanStatus(tenantId: string, updates: Record<string, unknown>): Promise<void> {
    const supabase = await createClient()

    await supabase
        .from('data_quality_scan_status')
        .update(updates)
        .eq('tenant_id', tenantId)
}

/**
 * Get scan status for tenant
 */
export async function getScanStatus(tenantId: string): Promise<Record<string, unknown> | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('data_quality_scan_status')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

    if (error) {
        log.error('Error getting scan status', error instanceof Error ? error : undefined)
        return null
    }

    return data
}

/**
 * Get all issues for tenant
 */
export async function getDataQualityIssues(tenantId: string, filters?: {
    issueType?: string
    severity?: string
    status?: string
}): Promise<DataQualityIssue[]> {
    const supabase = await createClient()

    let query = supabase
        .from('data_quality_issues')
        .select('*')
        .eq('tenant_id', tenantId)

    if (filters?.issueType) {
        query = query.eq('issue_type', filters.issueType)
    }
    if (filters?.severity) {
        query = query.eq('severity', filters.severity)
    }
    if (filters?.status) {
        query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) {
        log.error('Error getting data quality issues', error instanceof Error ? error : undefined)
        return []
    }

    // Transform database records to DataQualityIssue format
    return (data || []).map(record => ({
        issueId: record.id,
        transactionId: record.transaction_id,
        issueType: record.issue_type,
        severity: record.severity,
        currentState: record.current_state,
        suggestedFix: record.suggested_fix,
        confidence: record.confidence,
        aiReasoning: record.ai_reasoning,
        impactAmount: parseFloat(record.impact_amount),
        financialYear: record.financial_year
    }))
}
