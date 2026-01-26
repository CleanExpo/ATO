/**
 * Reconciliation Analysis Engine
 *
 * Read-only analysis that identifies reconciliation issues:
 * 1. Unreconciled bank transactions (status !== 'AUTHORISED')
 * 2. Suggested matches between bank items and invoices
 * 3. Duplicate transaction detection
 * 4. Missing transactions (invoices with no bank entry)
 * 5. Account misallocation flags
 *
 * No data is modified - generates recommendations only.
 */

import { createServiceClient } from '@/lib/supabase/server'

// Match scoring weights
const MATCH_WEIGHTS = {
  exactAmount: 40,
  nearAmount: 20,       // within 1% tolerance
  sameContact: 25,
  dateProximity: 15,     // within 7 days
  referenceMatch: 20,    // reference/description overlap
}

const DUPLICATE_DATE_TOLERANCE_DAYS = 3
const MATCH_DATE_TOLERANCE_DAYS = 7
const AMOUNT_TOLERANCE_PERCENT = 0.01 // 1%
const MIN_MATCH_SCORE = 50

// Xero bank transaction types (getBankTransactions returns these, NOT 'BANK')
const BANK_TRANSACTION_TYPES = [
  'RECEIVE',
  'SPEND',
  'RECEIVE-TRANSFER',
  'SPEND-TRANSFER',
  'RECEIVE-OVERPAYMENT',
  'SPEND-OVERPAYMENT',
  'RECEIVE-PREPAYMENT',
  'SPEND-PREPAYMENT',
]

// All invoice types
const INVOICE_TYPES = ['ACCPAY', 'ACCREC']

// ─── Types ───────────────────────────────────────────────────────────

export interface ReconciliationSummary {
  tenantId: string
  analysedAt: string
  totalBankTransactions: number
  totalInvoices: number
  unreconciledItems: UnreconciledItem[]
  unreconciledCount: number
  unreconciledAmount: number
  suggestedMatches: SuggestedMatch[]
  matchCount: number
  matchAmount: number
  duplicates: DuplicateGroup[]
  duplicateCount: number
  duplicateExposure: number
  missingEntries: MissingEntry[]
  missingCount: number
  missingAmount: number
  byAccount: AccountReconciliation[]
  byFinancialYear: Record<string, YearReconciliation>
}

export interface UnreconciledItem {
  transactionId: string
  transactionType: string
  transactionDate: string
  contactName: string | null
  description: string | null
  amount: number
  accountCode: string | null
  financialYear: string
  daysPending: number
  status: string
}

export interface SuggestedMatch {
  bankTransaction: TransactionRef
  matchedTransaction: TransactionRef
  matchScore: number
  matchReasons: string[]
  amountDifference: number
  dateDifference: number
}

export interface TransactionRef {
  transactionId: string
  transactionType: string
  transactionDate: string
  contactName: string | null
  description: string | null
  amount: number
  reference: string | null
  accountCode: string | null
}

export interface DuplicateGroup {
  duplicateType: 'exact' | 'probable' | 'possible'
  confidence: number
  totalExposure: number
  matchReasons: string[]
  transactions: TransactionRef[]
}

export interface MissingEntry {
  invoice: TransactionRef
  expectedType: 'bank_payment' | 'bank_receipt'
  reason: string
  daysSinceInvoice: number
}

export interface AccountReconciliation {
  accountCode: string
  accountName: string | null
  unreconciledCount: number
  unreconciledAmount: number
  duplicateCount: number
  matchedCount: number
}

export interface YearReconciliation {
  financialYear: string
  unreconciledCount: number
  unreconciledAmount: number
  suggestedMatches: number
  duplicates: number
  missingEntries: number
}

// ─── Main Analysis Function ──────────────────────────────────────────

/**
 * Run full reconciliation analysis for a tenant.
 * Read-only: queries cached transaction data, produces recommendations.
 */
export async function analyzeReconciliation(
  tenantId: string,
  options?: {
    financialYears?: string[]
    includeAllStatuses?: boolean
  }
): Promise<ReconciliationSummary> {
  const supabase = await createServiceClient()

  // Fetch all cached transactions for this tenant
  // Note: Xero bank transactions are stored with types like RECEIVE, SPEND, etc. (NOT 'BANK')
  let bankQuery = supabase
    .from('historical_transactions_cache')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('transaction_type', BANK_TRANSACTION_TYPES)
    .order('transaction_date', { ascending: false })

  let invoiceQuery = supabase
    .from('historical_transactions_cache')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('transaction_type', INVOICE_TYPES)
    .order('transaction_date', { ascending: false })

  // Also check for any transactions stored with 'BANK' type (legacy)
  let legacyBankQuery = supabase
    .from('historical_transactions_cache')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('transaction_type', 'BANK')
    .order('transaction_date', { ascending: false })

  if (options?.financialYears && options.financialYears.length > 0) {
    bankQuery = bankQuery.in('financial_year', options.financialYears)
    invoiceQuery = invoiceQuery.in('financial_year', options.financialYears)
    legacyBankQuery = legacyBankQuery.in('financial_year', options.financialYears)
  }

  const [bankResult, invoiceResult, legacyBankResult] = await Promise.all([
    bankQuery,
    invoiceQuery,
    legacyBankQuery,
  ])

  if (bankResult.error) {
    throw new Error(`Failed to fetch bank transactions: ${bankResult.error.message}`)
  }
  if (invoiceResult.error) {
    throw new Error(`Failed to fetch invoices: ${invoiceResult.error.message}`)
  }

  // Merge bank transactions from both typed and legacy queries (deduplicate by ID)
  const bankIds = new Set<string>()
  const allBankRaw = [...(bankResult.data || []), ...(legacyBankResult.data || [])]
  const bankTransactions = allBankRaw.filter((tx) => {
    if (bankIds.has(tx.transaction_id)) return false
    bankIds.add(tx.transaction_id)
    return true
  })
  const invoices = invoiceResult.data || []

  // Ensure amounts are extracted properly (fallback to raw_data if total_amount is null/0)
  for (const tx of [...bankTransactions, ...invoices]) {
    tx.total_amount = extractAmount(tx)
  }

  if (bankTransactions.length === 0 && invoices.length === 0) {
    return createEmptyReconciliation(tenantId)
  }

  // Run all analyses
  const unreconciledItems = findUnreconciledItems(bankTransactions)
  const suggestedMatches = findSuggestedMatches(bankTransactions, invoices)
  const duplicates = findDuplicates([...bankTransactions, ...invoices])
  const missingEntries = findMissingEntries(invoices, bankTransactions)
  const byAccount = buildAccountBreakdown(unreconciledItems, duplicates, suggestedMatches)
  const byFinancialYear = buildYearBreakdown(
    unreconciledItems,
    suggestedMatches,
    duplicates,
    missingEntries
  )

  const unreconciledAmount = unreconciledItems.reduce((sum, item) => sum + Math.abs(item.amount), 0)
  const matchAmount = suggestedMatches.reduce(
    (sum, m) => sum + Math.abs(m.bankTransaction.amount),
    0
  )
  const duplicateExposure = duplicates.reduce((sum, d) => sum + d.totalExposure, 0)
  const missingAmount = missingEntries.reduce((sum, m) => sum + Math.abs(m.invoice.amount), 0)

  return {
    tenantId,
    analysedAt: new Date().toISOString(),
    totalBankTransactions: bankTransactions.length,
    totalInvoices: invoices.length,
    unreconciledItems,
    unreconciledCount: unreconciledItems.length,
    unreconciledAmount: roundTo2(unreconciledAmount),
    suggestedMatches,
    matchCount: suggestedMatches.length,
    matchAmount: roundTo2(matchAmount),
    duplicates,
    duplicateCount: duplicates.length,
    duplicateExposure: roundTo2(duplicateExposure),
    missingEntries,
    missingCount: missingEntries.length,
    missingAmount: roundTo2(missingAmount),
    byAccount,
    byFinancialYear,
  }
}

// ─── Unreconciled Detection ──────────────────────────────────────────

function findUnreconciledItems(bankTransactions: CachedTransaction[]): UnreconciledItem[] {
  const now = new Date()

  return bankTransactions
    .filter((tx) => {
      const rawData = tx.raw_data as RawTransactionData
      // Bank transactions use isReconciled flag; invoices use status
      if (rawData?.isReconciled === false) return true
      if (rawData?.status === 'DRAFT' || rawData?.status === 'SUBMITTED') return true
      return false
    })
    .map((tx) => {
      const rawData = tx.raw_data as RawTransactionData
      const txDate = new Date(tx.transaction_date)
      const daysPending = Math.floor(
        (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      return {
        transactionId: tx.transaction_id,
        transactionType: tx.transaction_type,
        transactionDate: tx.transaction_date,
        contactName: tx.contact_name,
        description: extractDescription(rawData),
        amount: parseFloat(String(tx.total_amount)) || 0,
        accountCode: extractAccountCode(rawData),
        financialYear: tx.financial_year,
        daysPending,
        status: rawData?.isReconciled === false ? 'UNRECONCILED' : (rawData?.status || 'UNKNOWN'),
      }
    })
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}

// ─── Suggested Match Finding ─────────────────────────────────────────

function findSuggestedMatches(
  bankTransactions: CachedTransaction[],
  invoices: CachedTransaction[]
): SuggestedMatch[] {
  const matches: SuggestedMatch[] = []
  const usedInvoiceIds = new Set<string>()

  // Only try to match unreconciled bank transactions
  const unreconciled = bankTransactions.filter((tx) => {
    const rawData = tx.raw_data as RawTransactionData
    return rawData?.status !== 'AUTHORISED'
  })

  for (const bankTx of unreconciled) {
    let bestMatch: SuggestedMatch | null = null
    let bestScore = 0

    for (const invoice of invoices) {
      if (usedInvoiceIds.has(invoice.transaction_id)) continue

      const result = scoreMatch(bankTx, invoice)
      if (result.score > bestScore && result.score >= MIN_MATCH_SCORE) {
        bestScore = result.score
        bestMatch = {
          bankTransaction: toTransactionRef(bankTx),
          matchedTransaction: toTransactionRef(invoice),
          matchScore: result.score,
          matchReasons: result.reasons,
          amountDifference: result.amountDiff,
          dateDifference: result.dateDiff,
        }
      }
    }

    if (bestMatch) {
      matches.push(bestMatch)
      usedInvoiceIds.add(bestMatch.matchedTransaction.transactionId)
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore)
}

function scoreMatch(
  bankTx: CachedTransaction,
  invoice: CachedTransaction
): { score: number; reasons: string[]; amountDiff: number; dateDiff: number } {
  let score = 0
  const reasons: string[] = []

  const bankAmount = Math.abs(parseFloat(String(bankTx.total_amount)) || 0)
  const invoiceAmount = Math.abs(parseFloat(String(invoice.total_amount)) || 0)
  const amountDiff = Math.abs(bankAmount - invoiceAmount)

  // Amount matching
  if (amountDiff === 0) {
    score += MATCH_WEIGHTS.exactAmount
    reasons.push('exact_amount')
  } else if (bankAmount > 0 && amountDiff / bankAmount <= AMOUNT_TOLERANCE_PERCENT) {
    score += MATCH_WEIGHTS.nearAmount
    reasons.push('near_amount')
  }

  // Contact matching
  if (
    bankTx.contact_name &&
    invoice.contact_name &&
    normaliseString(bankTx.contact_name) === normaliseString(invoice.contact_name)
  ) {
    score += MATCH_WEIGHTS.sameContact
    reasons.push('same_contact')
  }

  // Date proximity
  const bankDate = new Date(bankTx.transaction_date)
  const invoiceDate = new Date(invoice.transaction_date)
  const dateDiff = Math.abs(
    Math.floor((bankDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
  )
  if (dateDiff <= MATCH_DATE_TOLERANCE_DAYS) {
    const dateScore =
      MATCH_WEIGHTS.dateProximity * (1 - dateDiff / MATCH_DATE_TOLERANCE_DAYS)
    score += Math.round(dateScore)
    reasons.push(`date_within_${dateDiff}_days`)
  }

  // Reference matching
  const bankRef = bankTx.reference?.toLowerCase() || ''
  const invoiceRef = invoice.reference?.toLowerCase() || ''
  if (bankRef && invoiceRef && (bankRef.includes(invoiceRef) || invoiceRef.includes(bankRef))) {
    score += MATCH_WEIGHTS.referenceMatch
    reasons.push('reference_match')
  }

  return { score: Math.min(score, 100), reasons, amountDiff, dateDiff }
}

// ─── Duplicate Detection ─────────────────────────────────────────────

function findDuplicates(transactions: CachedTransaction[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const processed = new Set<string>()

  for (let i = 0; i < transactions.length; i++) {
    if (processed.has(transactions[i].transaction_id)) continue

    const dupes: CachedTransaction[] = [transactions[i]]

    for (let j = i + 1; j < transactions.length; j++) {
      if (processed.has(transactions[j].transaction_id)) continue
      if (isDuplicate(transactions[i], transactions[j])) {
        dupes.push(transactions[j])
        processed.add(transactions[j].transaction_id)
      }
    }

    if (dupes.length > 1) {
      processed.add(transactions[i].transaction_id)

      const { type, confidence, reasons } = classifyDuplicate(dupes)
      const amount = Math.abs(parseFloat(String(dupes[0].total_amount)) || 0)

      groups.push({
        duplicateType: type,
        confidence,
        totalExposure: roundTo2(amount * (dupes.length - 1)), // excess copies
        matchReasons: reasons,
        transactions: dupes.map(toTransactionRef),
      })
    }
  }

  return groups.sort((a, b) => b.totalExposure - a.totalExposure)
}

function isDuplicate(a: CachedTransaction, b: CachedTransaction): boolean {
  const amountA = Math.abs(parseFloat(String(a.total_amount)) || 0)
  const amountB = Math.abs(parseFloat(String(b.total_amount)) || 0)

  // Must have same amount
  if (amountA !== amountB) return false

  // Must be within date tolerance
  const dateA = new Date(a.transaction_date)
  const dateB = new Date(b.transaction_date)
  const daysDiff = Math.abs(
    Math.floor((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24))
  )
  if (daysDiff > DUPLICATE_DATE_TOLERANCE_DAYS) return false

  // Must have same contact or same type
  if (
    a.contact_name &&
    b.contact_name &&
    normaliseString(a.contact_name) === normaliseString(b.contact_name)
  ) {
    return true
  }

  // Same reference is a strong signal
  if (a.reference && b.reference && a.reference === b.reference) {
    return true
  }

  return false
}

function classifyDuplicate(
  dupes: CachedTransaction[]
): { type: 'exact' | 'probable' | 'possible'; confidence: number; reasons: string[] } {
  const reasons: string[] = []

  const allSameDate = dupes.every((d) => d.transaction_date === dupes[0].transaction_date)
  const allSameContact =
    dupes[0].contact_name &&
    dupes.every(
      (d) =>
        d.contact_name &&
        normaliseString(d.contact_name) === normaliseString(dupes[0].contact_name!)
    )
  const allSameRef =
    dupes[0].reference && dupes.every((d) => d.reference === dupes[0].reference)

  if (allSameDate) reasons.push('same_date')
  if (allSameContact) reasons.push('same_contact')
  if (allSameRef) reasons.push('same_reference')
  reasons.push('same_amount')

  if (allSameDate && allSameContact && allSameRef) {
    return { type: 'exact', confidence: 95, reasons }
  }
  if (allSameDate && allSameContact) {
    return { type: 'probable', confidence: 85, reasons }
  }
  return { type: 'possible', confidence: 65, reasons }
}

// ─── Missing Entry Detection ─────────────────────────────────────────

function findMissingEntries(
  invoices: CachedTransaction[],
  bankTransactions: CachedTransaction[]
): MissingEntry[] {
  const missing: MissingEntry[] = []
  const now = new Date()

  // Build a set of bank amounts+contacts for quick lookup
  const bankSignatures = new Set(
    bankTransactions.map((tx) => {
      const amount = Math.abs(parseFloat(String(tx.total_amount)) || 0)
      const contact = normaliseString(tx.contact_name || '')
      return `${amount}|${contact}`
    })
  )

  for (const invoice of invoices) {
    const rawData = invoice.raw_data as RawTransactionData
    const status = rawData?.status || invoice.status

    // Only check paid/authorised invoices that should have bank entries
    if (status !== 'PAID' && status !== 'AUTHORISED') continue

    const amount = Math.abs(parseFloat(String(invoice.total_amount)) || 0)
    const contact = normaliseString(invoice.contact_name || '')
    const signature = `${amount}|${contact}`

    // Check if there's a corresponding bank transaction
    if (!bankSignatures.has(signature)) {
      const invoiceDate = new Date(invoice.transaction_date)
      const daysSince = Math.floor(
        (now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Only flag if invoice is older than 30 days (give time for bank processing)
      if (daysSince > 30) {
        const expectedType =
          invoice.transaction_type === 'ACCPAY' ? 'bank_payment' : 'bank_receipt'

        missing.push({
          invoice: toTransactionRef(invoice),
          expectedType,
          reason: `${expectedType === 'bank_payment' ? 'Payment' : 'Receipt'} not found in bank for ${invoice.contact_name || 'unknown contact'} ($${amount.toFixed(2)})`,
          daysSinceInvoice: daysSince,
        })
      }
    }
  }

  return missing.sort((a, b) => Math.abs(b.invoice.amount) - Math.abs(a.invoice.amount))
}

// ─── Breakdown Builders ──────────────────────────────────────────────

function buildAccountBreakdown(
  unreconciled: UnreconciledItem[],
  duplicates: DuplicateGroup[],
  matches: SuggestedMatch[]
): AccountReconciliation[] {
  const accountMap = new Map<string, AccountReconciliation>()

  const getOrCreate = (code: string): AccountReconciliation => {
    if (!accountMap.has(code)) {
      accountMap.set(code, {
        accountCode: code,
        accountName: null,
        unreconciledCount: 0,
        unreconciledAmount: 0,
        duplicateCount: 0,
        matchedCount: 0,
      })
    }
    return accountMap.get(code)!
  }

  for (const item of unreconciled) {
    const acc = getOrCreate(item.accountCode || 'unknown')
    acc.unreconciledCount++
    acc.unreconciledAmount += Math.abs(item.amount)
  }

  for (const group of duplicates) {
    for (const tx of group.transactions) {
      const acc = getOrCreate(tx.accountCode || 'unknown')
      acc.duplicateCount++
    }
  }

  for (const match of matches) {
    const acc = getOrCreate(match.bankTransaction.accountCode || 'unknown')
    acc.matchedCount++
  }

  return Array.from(accountMap.values()).sort(
    (a, b) => b.unreconciledAmount - a.unreconciledAmount
  )
}

function buildYearBreakdown(
  unreconciled: UnreconciledItem[],
  matches: SuggestedMatch[],
  duplicates: DuplicateGroup[],
  missing: MissingEntry[]
): Record<string, YearReconciliation> {
  const yearMap: Record<string, YearReconciliation> = {}

  const getOrCreate = (fy: string): YearReconciliation => {
    if (!yearMap[fy]) {
      yearMap[fy] = {
        financialYear: fy,
        unreconciledCount: 0,
        unreconciledAmount: 0,
        suggestedMatches: 0,
        duplicates: 0,
        missingEntries: 0,
      }
    }
    return yearMap[fy]
  }

  for (const item of unreconciled) {
    const yr = getOrCreate(item.financialYear)
    yr.unreconciledCount++
    yr.unreconciledAmount += Math.abs(item.amount)
  }

  for (const match of matches) {
    // Derive FY from bank transaction date
    const fy = deriveFY(match.bankTransaction.transactionDate)
    const yr = getOrCreate(fy)
    yr.suggestedMatches++
  }

  for (const group of duplicates) {
    if (group.transactions.length > 0) {
      const fy = deriveFY(group.transactions[0].transactionDate)
      const yr = getOrCreate(fy)
      yr.duplicates++
    }
  }

  for (const entry of missing) {
    const fy = deriveFY(entry.invoice.transactionDate)
    const yr = getOrCreate(fy)
    yr.missingEntries++
  }

  return yearMap
}

// ─── Helpers ─────────────────────────────────────────────────────────

interface CachedTransaction {
  transaction_id: string
  tenant_id: string
  transaction_type: string
  transaction_date: string
  financial_year: string
  raw_data: unknown
  contact_name: string | null
  total_amount: number | string
  status: string | null
  reference: string | null
}

interface RawTransactionData {
  status?: string
  total?: number
  subTotal?: number
  totalTax?: number
  amountDue?: number
  amountPaid?: number
  lineItems?: Array<{
    description?: string
    accountCode?: string
    lineAmount?: number
    unitAmount?: number
    quantity?: number
  }>
  contact?: {
    name?: string
    contactID?: string
  }
  reference?: string
  invoiceNumber?: string
  bankAccount?: {
    accountID?: string
    name?: string
  }
  isReconciled?: boolean
}

function toTransactionRef(tx: CachedTransaction): TransactionRef {
  const rawData = tx.raw_data as RawTransactionData
  return {
    transactionId: tx.transaction_id,
    transactionType: tx.transaction_type,
    transactionDate: tx.transaction_date,
    contactName: tx.contact_name,
    description: extractDescription(rawData),
    amount: parseFloat(String(tx.total_amount)) || 0,
    reference: tx.reference,
    accountCode: extractAccountCode(rawData),
  }
}

/**
 * Extract amount from a cached transaction.
 * Falls back to raw_data fields if total_amount column is null/0.
 */
function extractAmount(tx: CachedTransaction): number {
  // First try the database column
  const dbAmount = parseFloat(String(tx.total_amount ?? 0))
  if (dbAmount !== 0) return dbAmount

  // Fallback: extract from raw_data JSON
  const raw = tx.raw_data as RawTransactionData | null
  if (!raw) return 0

  // Try various amount fields in raw_data
  if (typeof raw.total === 'number' && raw.total !== 0) return raw.total
  if (typeof raw.subTotal === 'number' && raw.subTotal !== 0) return raw.subTotal
  if (typeof raw.amountDue === 'number' && raw.amountDue !== 0) return raw.amountDue
  if (typeof raw.amountPaid === 'number' && raw.amountPaid !== 0) return raw.amountPaid

  // Last resort: sum line items
  if (raw.lineItems && raw.lineItems.length > 0) {
    const lineTotal = raw.lineItems.reduce((sum, li) => {
      const lineAmt = li.lineAmount ?? (li.unitAmount ?? 0) * (li.quantity ?? 1)
      return sum + (lineAmt || 0)
    }, 0)
    if (lineTotal !== 0) return lineTotal
  }

  return 0
}

function extractDescription(rawData: RawTransactionData | null): string | null {
  if (!rawData?.lineItems || rawData.lineItems.length === 0) return null
  return rawData.lineItems[0]?.description || null
}

function extractAccountCode(rawData: RawTransactionData | null): string | null {
  if (!rawData?.lineItems || rawData.lineItems.length === 0) return null
  return rawData.lineItems[0]?.accountCode || null
}

function normaliseString(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100
}

function deriveFY(dateStr: string): string {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = d.getMonth() + 1 // 1-12
  if (month >= 7) {
    return `FY${year}-${String(year + 1).slice(2)}`
  }
  return `FY${year - 1}-${String(year).slice(2)}`
}

function createEmptyReconciliation(tenantId: string): ReconciliationSummary {
  return {
    tenantId,
    analysedAt: new Date().toISOString(),
    totalBankTransactions: 0,
    totalInvoices: 0,
    unreconciledItems: [],
    unreconciledCount: 0,
    unreconciledAmount: 0,
    suggestedMatches: [],
    matchCount: 0,
    matchAmount: 0,
    duplicates: [],
    duplicateCount: 0,
    duplicateExposure: 0,
    missingEntries: [],
    missingCount: 0,
    missingAmount: 0,
    byAccount: [],
    byFinancialYear: {},
  }
}
