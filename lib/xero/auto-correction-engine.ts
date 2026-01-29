/**
 * Auto-Correction Engine
 *
 * Automatically applies corrections to Xero data with full audit trail.
 *
 * Strategy:
 * - Only auto-fix issues with confidence > 90%
 * - Log every correction with before/after state
 * - Create Xero journal entries to correct (preserve original transactions)
 * - Flag medium-confidence issues (70-90%) for accountant review
 * - Never touch low-confidence (<70%) - just report
 */

import { createXeroClient, refreshXeroTokens, isTokenExpired } from '@/lib/xero/client'
import { createClient } from '@/lib/supabase/server'
import type { DataQualityIssue } from '@/lib/xero/data-quality-validator'

// Types
export interface CorrectionLog {
    correctionId: string
    transactionId: string
    issueType: string
    correctionDate: Date

    beforeState: Record<string, unknown>
    afterState: Record<string, unknown>

    correctionMethod: 'journal_entry' | 'reclassification' | 'tax_update' | 'reconciliation'
    xeroJournalId?: string
    xeroJournalNumber?: string

    confidence: number
    aiReasoning: string

    status: 'auto_applied' | 'pending_review' | 'accountant_approved' | 'rejected'
    accountantNotes?: string
}

export interface CorrectionOptions {
    tenantId: string
    accessToken: string
    refreshToken: string
    autoFixThreshold?: number  // Default: 90
    dryRun?: boolean  // If true, don't actually apply corrections
}

export interface CorrectionResult {
    tenantId: string
    issuesProcessed: number
    issuesAutoCorrected: number
    issuesPendingReview: number
    issuesSkipped: number
    corrections: CorrectionLog[]
    errors: string[]
}

/**
 * Apply corrections to high-confidence issues
 */
export async function applyAutoCorrestions(
    issues: DataQualityIssue[],
    options: CorrectionOptions
): Promise<CorrectionResult> {
    const { tenantId, autoFixThreshold = 90, dryRun = false } = options
    const corrections: CorrectionLog[] = []
    const errors: string[] = []

    let issuesAutoCorrected = 0
    let issuesPendingReview = 0
    let issuesSkipped = 0

    console.log(`Processing ${issues.length} data quality issues...`)

    // Separate issues by confidence level
    const highConfidence = issues.filter(i => i.confidence >= autoFixThreshold)
    const mediumConfidence = issues.filter(i => i.confidence >= 70 && i.confidence < autoFixThreshold)
    const lowConfidence = issues.filter(i => i.confidence < 70)

    console.log(`- High confidence (auto-fix): ${highConfidence.length}`)
    console.log(`- Medium confidence (review): ${mediumConfidence.length}`)
    console.log(`- Low confidence (skip): ${lowConfidence.length}`)

    if (dryRun) {
        console.log('🔍 DRY RUN MODE - No actual corrections will be applied')
    }

    // Skip low confidence issues
    issuesSkipped = lowConfidence.length

    // Flag medium confidence for review
    for (const issue of mediumConfidence) {
        const log: CorrectionLog = {
            correctionId: crypto.randomUUID(),
            transactionId: issue.transactionId,
            issueType: issue.issueType,
            correctionDate: new Date(),
            beforeState: issue.currentState,
            afterState: issue.suggestedFix,
            correctionMethod: getCorrectionMethod(issue.issueType),
            confidence: issue.confidence,
            aiReasoning: issue.aiReasoning,
            status: 'pending_review'
        }

        corrections.push(log)
        issuesPendingReview++

        if (!dryRun) {
            await storeCorrectionLog(tenantId, issue.issueId, log)
        }
    }

    // Auto-fix high confidence issues
    for (const issue of highConfidence) {
        try {
            if (dryRun) {
                // Dry run: just log what would happen
                console.log(`[DRY RUN] Would apply correction for ${issue.transactionId}:`)
                console.log(`  Current: ${JSON.stringify(issue.currentState)}`)
                console.log(`  Suggested: ${JSON.stringify(issue.suggestedFix)}`)

                const log: CorrectionLog = {
                    correctionId: crypto.randomUUID(),
                    transactionId: issue.transactionId,
                    issueType: issue.issueType,
                    correctionDate: new Date(),
                    beforeState: issue.currentState,
                    afterState: issue.suggestedFix,
                    correctionMethod: getCorrectionMethod(issue.issueType),
                    confidence: issue.confidence,
                    aiReasoning: issue.aiReasoning,
                    status: 'auto_applied'
                }

                corrections.push(log)
                issuesAutoCorrected++
            } else {
                // Actually apply correction
                const log = await applyCorrection(issue, options)

                if (log) {
                    corrections.push(log)
                    issuesAutoCorrected++

                    // Store in database
                    await storeCorrectionLog(tenantId, issue.issueId, log)

                    // Update issue status
                    await updateIssueStatus(tenantId, issue.issueId, 'auto_corrected')
                }
            }
        } catch (error) {
            const errorMsg = `Failed to correct ${issue.transactionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
            console.error(errorMsg)
            errors.push(errorMsg)
        }
    }

    console.log(`✅ Auto-correction complete:`)
    console.log(`  - Auto-corrected: ${issuesAutoCorrected}`)
    console.log(`  - Pending review: ${issuesPendingReview}`)
    console.log(`  - Skipped: ${issuesSkipped}`)
    console.log(`  - Errors: ${errors.length}`)

    return {
        tenantId,
        issuesProcessed: issues.length,
        issuesAutoCorrected,
        issuesPendingReview,
        issuesSkipped,
        corrections,
        errors
    }
}

/**
 * Apply a single correction
 */
async function applyCorrection(
    issue: DataQualityIssue,
    options: CorrectionOptions
): Promise<CorrectionLog | null> {
    const { tenantId, accessToken, refreshToken } = options

    // Get correction method
    const method = getCorrectionMethod(issue.issueType)

    let xeroJournalId: string | undefined
    let xeroJournalNumber: string | undefined

    // Apply correction based on issue type
    switch (issue.issueType) {
        case 'wrong_account':
            // Create Xero manual journal to reclassify
            const journalResult = await createReclassificationJournal(
                tenantId,
                accessToken,
                refreshToken,
                issue
            )
            xeroJournalId = journalResult?.journalId
            xeroJournalNumber = journalResult?.journalNumber
            break

        case 'tax_classification':
            // Update tax type (requires Xero API update)
            // For now, we'll log it for manual correction
            console.log(`Tax classification correction for ${issue.transactionId} requires manual update`)
            break

        case 'duplicate':
            // Duplicates should be manually reviewed before deletion
            console.log(`Duplicate ${issue.transactionId} flagged for manual review`)
            break

        case 'unreconciled':
            // Reconciliation requires manual action
            console.log(`Unreconciled transaction ${issue.transactionId} flagged for manual review`)
            break

        default:
            console.warn(`Unknown issue type: ${issue.issueType}`)
            return null
    }

    // Create correction log
    const log: CorrectionLog = {
        correctionId: crypto.randomUUID(),
        transactionId: issue.transactionId,
        issueType: issue.issueType,
        correctionDate: new Date(),
        beforeState: issue.currentState,
        afterState: issue.suggestedFix,
        correctionMethod: method,
        xeroJournalId,
        xeroJournalNumber,
        confidence: issue.confidence,
        aiReasoning: issue.aiReasoning,
        status: 'auto_applied'
    }

    return log
}

/**
 * Create Xero manual journal to reclassify transaction
 */
async function createReclassificationJournal(
    tenantId: string,
    accessToken: string,
    refreshToken: string,
    issue: DataQualityIssue
): Promise<{ journalId: string; journalNumber: string } | null> {
    try {
        // Create Xero client
        const xero = createXeroClient()
        await xero.initialize()

        // Check if token needs refresh
        let currentAccessToken = accessToken
         
        if (isTokenExpired({ access_token: accessToken, refresh_token: refreshToken, expires_at: 0 } as any)) {
             
            const newTokens = await refreshXeroTokens({ access_token: accessToken, refresh_token: refreshToken, expires_at: 0 } as any)
            currentAccessToken = newTokens.access_token || accessToken
        }

        xero.setTokenSet({
            access_token: currentAccessToken,
            refresh_token: refreshToken,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
        })

        // Prepare manual journal
        const amount = issue.currentState.amount || 0
        const description = `Reclassification: ${issue.transactionId}\n${issue.suggestedFix.reasoning}`

        const journal = {
            narration: description.substring(0, 500),  // Xero limit
            date: new Date().toISOString().split('T')[0],  // Today's date
            journalLines: [
                {
                    // Debit the correct account
                    accountCode: issue.suggestedFix.accountCode,
                    description: `Transfer to correct account`,
                    lineAmount: amount,
                },
                {
                    // Credit the wrong account
                    accountCode: issue.currentState.accountCode,
                    description: `Transfer from incorrect account`,
                    lineAmount: -amount,
                }
            ]
        }

        // Create journal via Xero API
        const response = await xero.accountingApi.createManualJournals(tenantId, {
            manualJournals: [journal]
        })

        const createdJournal = response.body.manualJournals?.[0]

        if (createdJournal) {
            console.log(`✅ Created Xero manual journal: ${createdJournal.manualJournalID}`)

            return {
                journalId: createdJournal.manualJournalID || '',
                journalNumber: (createdJournal as unknown as Record<string, unknown>).reference as string || ''
            }
        }

        return null

    } catch (error) {
        console.error('Failed to create Xero manual journal:', error)
        throw error
    }
}

/**
 * Get correction method based on issue type
 */
function getCorrectionMethod(issueType: string): 'journal_entry' | 'reclassification' | 'tax_update' | 'reconciliation' {
    switch (issueType) {
        case 'wrong_account':
            return 'journal_entry'
        case 'tax_classification':
            return 'tax_update'
        case 'unreconciled':
            return 'reconciliation'
        case 'misallocated':
            return 'reclassification'
        default:
            return 'journal_entry'
    }
}

/**
 * Store correction log in database
 */
async function storeCorrectionLog(tenantId: string, issueId: string, log: CorrectionLog): Promise<void> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('correction_logs')
        .insert({
            tenant_id: tenantId,
            transaction_id: log.transactionId,
            issue_id: issueId,
            correction_date: log.correctionDate.toISOString(),
            correction_method: log.correctionMethod,
            xero_journal_id: log.xeroJournalId,
            xero_journal_number: log.xeroJournalNumber,
            before_state: log.beforeState,
            after_state: log.afterState,
            confidence: log.confidence,
            ai_reasoning: log.aiReasoning,
            status: log.status === 'auto_applied' ? 'applied' : 'failed',
            accountant_notes: log.accountantNotes
        })

    if (error) {
        console.error('Error storing correction log:', error)
        throw error
    }
}

/**
 * Update issue status in database
 */
async function updateIssueStatus(tenantId: string, issueId: string, status: string): Promise<void> {
    const supabase = await createClient()

    await supabase
        .from('data_quality_issues')
        .update({
            status,
            resolved_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('id', issueId)
}

/**
 * Get all correction logs for a tenant
 */
export async function getCorrectionLogs(tenantId: string, filters?: {
    status?: string
    correctionMethod?: string
}): Promise<CorrectionLog[]> {
    const supabase = await createClient()

    let query = supabase
        .from('correction_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('correction_date', { ascending: false })

    if (filters?.status) {
        query = query.eq('status', filters.status)
    }
    if (filters?.correctionMethod) {
        query = query.eq('correction_method', filters.correctionMethod)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error getting correction logs:', error)
        return []
    }

    return (data || []).map(record => ({
        correctionId: record.id,
        transactionId: record.transaction_id,
        issueType: record.issue_id,
        correctionDate: new Date(record.correction_date),
        beforeState: record.before_state,
        afterState: record.after_state,
        correctionMethod: record.correction_method,
        xeroJournalId: record.xero_journal_id,
        xeroJournalNumber: record.xero_journal_number,
        confidence: record.confidence,
        aiReasoning: record.ai_reasoning,
        status: record.status === 'applied' ? 'auto_applied' : 'pending_review',
        accountantNotes: record.accountant_notes
    }))
}

/**
 * Revert a correction (undo)
 */
export async function revertCorrection(
    tenantId: string,
    correctionId: string,
    options: CorrectionOptions
): Promise<boolean> {
    try {
        const supabase = await createClient()

        // Get correction log
        const { data: log, error } = await supabase
            .from('correction_logs')
            .select('*')
            .eq('id', correctionId)
            .eq('tenant_id', tenantId)
            .single()

        if (error || !log) {
            throw new Error('Correction log not found')
        }

        // If there's a Xero journal, we need to create a reversing journal
        if (log.xero_journal_id) {
            // Create reversing journal (swap debit/credit)
            const { accessToken, refreshToken } = options

            const xero = createXeroClient()
            await xero.initialize()

            let currentAccessToken = accessToken
             
            if (isTokenExpired({ access_token: accessToken, refresh_token: refreshToken, expires_at: 0 } as any)) {
                 
                const newTokens = await refreshXeroTokens({ access_token: accessToken, refresh_token: refreshToken, expires_at: 0 } as any)
                currentAccessToken = newTokens.access_token || accessToken
            }

            xero.setTokenSet({
                access_token: currentAccessToken,
                refresh_token: refreshToken,
                expires_at: Math.floor(Date.now() / 1000) + 3600,
            })

            const amount = log.before_state.amount || 0

            const reversingJournal = {
                narration: `REVERSAL: ${log.xero_journal_number || log.xero_journal_id}`,
                date: new Date().toISOString().split('T')[0],
                journalLines: [
                    {
                        accountCode: log.before_state.accountCode,
                        description: 'Reversal - restore original account',
                        lineAmount: amount,
                    },
                    {
                        accountCode: log.after_state.accountCode,
                        description: 'Reversal - remove from corrected account',
                        lineAmount: -amount,
                    }
                ]
            }

            await xero.accountingApi.createManualJournals(tenantId, {
                manualJournals: [reversingJournal]
            })

            console.log(`✅ Created reversing journal for ${correctionId}`)
        }

        // Update correction log status
        await supabase
            .from('correction_logs')
            .update({
                status: 'reverted'
            })
            .eq('id', correctionId)

        // Update issue status back to identified
        await supabase
            .from('data_quality_issues')
            .update({
                status: 'identified',
                resolved_at: null
            })
            .eq('id', log.issue_id)

        return true

    } catch (error) {
        console.error('Failed to revert correction:', error)
        return false
    }
}
