/**
 * Reconciliation Engine Tests
 *
 * @vitest-environment node
 *
 * Tests for lib/analysis/reconciliation-engine.ts
 * Covers: analyzeReconciliation, unreconciled detection, suggested matches,
 * duplicate detection, missing entries, account/year breakdowns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock infrastructure
// ---------------------------------------------------------------------------

/**
 * Creates a chainable Supabase query mock that resolves to the given value.
 * Supports .select().eq().in().order() chaining as used by the engine.
 */
function createChainableMock(resolvedValue: { data: any; error: any }) {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.single = vi.fn().mockResolvedValue(resolvedValue)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue)
  // When awaited directly the chain itself resolves (Promise.all in the engine)
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(resolvedValue).then(resolve, reject)
  return chain
}

/**
 * Build a full Supabase client mock where `.from()` returns different data
 * depending on the query chain.
 *
 * The reconciliation engine issues three parallel queries against the same
 * table (`historical_transactions_cache`) distinguished by `.in('transaction_type', ...)`
 * and `.eq('transaction_type', 'BANK')`.  We intercept the `.in()` / `.eq()` calls
 * to decide which dataset to return.
 */
function buildSupabaseMock(
  bankData: any[] = [],
  invoiceData: any[] = [],
  legacyBankData: any[] = [],
) {
  const fromMock = vi.fn().mockImplementation(() => {
    // Each call to .from() gets its own chain so that the three parallel
    // queries are independent.  We track which .in() / .eq() was called
    // to decide the resolved value after the chain settles.
    let resolvedData: any[] = []
    let queryType: 'bank' | 'invoice' | 'legacy' | 'unknown' = 'unknown'

    const chain: any = {}

    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn((_col: string, val: string) => {
      if (_col === 'tenant_id') return chain
      if (_col === 'transaction_type' && val === 'BANK') {
        queryType = 'legacy'
        resolvedData = legacyBankData
      }
      return chain
    })
    chain.in = vi.fn((_col: string, vals: string[]) => {
      if (_col === 'transaction_type') {
        // Bank transaction types include RECEIVE, SPEND, etc.
        if (vals.includes('RECEIVE')) {
          queryType = 'bank'
          resolvedData = bankData
        } else if (vals.includes('ACCPAY')) {
          queryType = 'invoice'
          resolvedData = invoiceData
        }
      }
      // financial_year filter -- just pass through
      return chain
    })
    chain.order = vi.fn(() => chain)
    // Make the chain thenable so it works with Promise.all
    chain.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: resolvedData, error: null }).then(resolve, reject)

    return chain
  })

  return { from: fromMock }
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

// Import after mock declaration
import { analyzeReconciliation } from '@/lib/analysis/reconciliation-engine'
import type {
  ReconciliationSummary,
  UnreconciledItem,
  SuggestedMatch,
  DuplicateGroup,
  MissingEntry,
  AccountReconciliation,
  YearReconciliation,
} from '@/lib/analysis/reconciliation-engine'
import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-test-001'

function makeBankTx(overrides: Record<string, any> = {}) {
  return {
    transaction_id: overrides.transaction_id ?? 'bank-tx-1',
    tenant_id: TENANT_ID,
    transaction_type: overrides.transaction_type ?? 'RECEIVE',
    transaction_date: overrides.transaction_date ?? '2024-09-15',
    financial_year: overrides.financial_year ?? 'FY2024-25',
    raw_data: 'raw_data' in overrides ? overrides.raw_data : { isReconciled: false, status: 'ACTIVE' },
    contact_name: overrides.contact_name ?? 'Acme Pty Ltd',
    total_amount: overrides.total_amount ?? 1000,
    status: overrides.status ?? null,
    reference: overrides.reference ?? null,
  }
}

function makeInvoice(overrides: Record<string, any> = {}) {
  return {
    transaction_id: overrides.transaction_id ?? 'inv-1',
    tenant_id: TENANT_ID,
    transaction_type: overrides.transaction_type ?? 'ACCREC',
    transaction_date: overrides.transaction_date ?? '2024-09-15',
    financial_year: overrides.financial_year ?? 'FY2024-25',
    raw_data: overrides.raw_data ?? { status: 'PAID' },
    contact_name: overrides.contact_name ?? 'Acme Pty Ltd',
    total_amount: overrides.total_amount ?? 1000,
    status: overrides.status ?? 'PAID',
    reference: overrides.reference ?? 'INV-001',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyzeReconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Freeze Date.now so daysPending / daysSinceInvoice are deterministic
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-02-11T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -----------------------------------------------------------------------
  // 1. ReconciliationSummary structure
  // -----------------------------------------------------------------------
  it('returns a ReconciliationSummary with all expected fields', async () => {
    const supabase = buildSupabaseMock(
      [makeBankTx()],
      [makeInvoice()],
    )
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result).toMatchObject({
      tenantId: TENANT_ID,
      analysedAt: expect.any(String),
      totalBankTransactions: expect.any(Number),
      totalInvoices: expect.any(Number),
      unreconciledItems: expect.any(Array),
      unreconciledCount: expect.any(Number),
      unreconciledAmount: expect.any(Number),
      suggestedMatches: expect.any(Array),
      matchCount: expect.any(Number),
      matchAmount: expect.any(Number),
      duplicates: expect.any(Array),
      duplicateCount: expect.any(Number),
      duplicateExposure: expect.any(Number),
      missingEntries: expect.any(Array),
      missingCount: expect.any(Number),
      missingAmount: expect.any(Number),
      byAccount: expect.any(Array),
      byFinancialYear: expect.any(Object),
    })
  })

  // -----------------------------------------------------------------------
  // 2. Empty data returns clean summary
  // -----------------------------------------------------------------------
  it('returns an empty/clean summary when no transactions exist', async () => {
    const supabase = buildSupabaseMock([], [], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.tenantId).toBe(TENANT_ID)
    expect(result.totalBankTransactions).toBe(0)
    expect(result.totalInvoices).toBe(0)
    expect(result.unreconciledItems).toEqual([])
    expect(result.unreconciledCount).toBe(0)
    expect(result.unreconciledAmount).toBe(0)
    expect(result.suggestedMatches).toEqual([])
    expect(result.duplicates).toEqual([])
    expect(result.missingEntries).toEqual([])
    expect(result.byAccount).toEqual([])
    expect(result.byFinancialYear).toEqual({})
  })

  // -----------------------------------------------------------------------
  // 3. Unreconciled item detection
  // -----------------------------------------------------------------------
  it('detects unreconciled bank transactions (isReconciled=false)', async () => {
    const unreconciledTx = makeBankTx({
      transaction_id: 'bank-unrec-1',
      total_amount: 5000,
      raw_data: { isReconciled: false },
    })

    const supabase = buildSupabaseMock([unreconciledTx], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.unreconciledCount).toBeGreaterThanOrEqual(1)
    const item = result.unreconciledItems.find(
      (u) => u.transactionId === 'bank-unrec-1',
    )
    expect(item).toBeDefined()
    expect(item!.status).toBe('UNRECONCILED')
    expect(item!.amount).toBe(5000)
  })

  it('flags transactions with missing raw_data as UNKNOWN', async () => {
    const noRawTx = makeBankTx({
      transaction_id: 'bank-no-raw',
      total_amount: 200,
      raw_data: null,
    })

    const supabase = buildSupabaseMock([noRawTx], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    const item = result.unreconciledItems.find(
      (u) => u.transactionId === 'bank-no-raw',
    )
    expect(item).toBeDefined()
    expect(item!.status).toBe('UNKNOWN')
  })

  it('flags DRAFT status bank transactions as unreconciled', async () => {
    const draftTx = makeBankTx({
      transaction_id: 'bank-draft',
      total_amount: 750,
      raw_data: { status: 'DRAFT' },
    })

    const supabase = buildSupabaseMock([draftTx], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    const item = result.unreconciledItems.find(
      (u) => u.transactionId === 'bank-draft',
    )
    expect(item).toBeDefined()
    expect(item!.status).toBe('DRAFT')
  })

  // -----------------------------------------------------------------------
  // 4. All transactions reconciled
  // -----------------------------------------------------------------------
  it('returns zero unreconciled items when all transactions are reconciled', async () => {
    const reconciledTx = makeBankTx({
      transaction_id: 'bank-ok',
      raw_data: { isReconciled: true, status: 'AUTHORISED' },
    })

    const supabase = buildSupabaseMock([reconciledTx], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.unreconciledCount).toBe(0)
    expect(result.unreconciledItems).toEqual([])
  })

  // -----------------------------------------------------------------------
  // 5. Suggested match detection
  // -----------------------------------------------------------------------
  it('finds suggested matches between unreconciled bank transactions and invoices', async () => {
    // Bank tx and invoice have same amount, same contact, close date => high match score
    const bankTx = makeBankTx({
      transaction_id: 'bank-match-1',
      total_amount: 3300,
      transaction_date: '2024-10-01',
      contact_name: 'Widget Corp Pty Ltd',
      raw_data: { isReconciled: false, status: 'ACTIVE' },
      reference: 'REF-123',
    })

    const invoice = makeInvoice({
      transaction_id: 'inv-match-1',
      total_amount: 3300,
      transaction_date: '2024-10-02',
      contact_name: 'Widget Corp Pty Ltd',
      raw_data: { status: 'PAID' },
      reference: 'REF-123',
    })

    const supabase = buildSupabaseMock([bankTx], [invoice])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.matchCount).toBeGreaterThanOrEqual(1)
    const match = result.suggestedMatches[0]
    expect(match).toBeDefined()
    expect(match.bankTransaction.transactionId).toBe('bank-match-1')
    expect(match.matchedTransaction.transactionId).toBe('inv-match-1')
    expect(match.matchScore).toBeGreaterThanOrEqual(50) // MIN_MATCH_SCORE
    expect(match.matchReasons.length).toBeGreaterThan(0)
    expect(match.amountDifference).toBe(0) // exact amount match
  })

  it('includes match reasons such as exact_amount and same_contact', async () => {
    const bankTx = makeBankTx({
      transaction_id: 'bank-reasons',
      total_amount: 2500,
      transaction_date: '2024-11-10',
      contact_name: 'Alpha Services',
      raw_data: { isReconciled: false },
    })

    const invoice = makeInvoice({
      transaction_id: 'inv-reasons',
      total_amount: 2500,
      transaction_date: '2024-11-12',
      contact_name: 'Alpha Services',
    })

    const supabase = buildSupabaseMock([bankTx], [invoice])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.matchCount).toBe(1)
    const match = result.suggestedMatches[0]
    expect(match.matchReasons).toContain('exact_amount')
    expect(match.matchReasons).toContain('same_contact')
  })

  // -----------------------------------------------------------------------
  // 6. Duplicate detection
  // -----------------------------------------------------------------------
  it('detects duplicate transactions with same amount, date, and contact', async () => {
    const tx1 = makeBankTx({
      transaction_id: 'dup-1',
      total_amount: 4400,
      transaction_date: '2024-08-20',
      contact_name: 'Supplier X Pty Ltd',
      raw_data: { isReconciled: true, status: 'AUTHORISED' },
    })

    const tx2 = makeBankTx({
      transaction_id: 'dup-2',
      total_amount: 4400,
      transaction_date: '2024-08-20',
      contact_name: 'Supplier X Pty Ltd',
      raw_data: { isReconciled: true, status: 'AUTHORISED' },
    })

    const supabase = buildSupabaseMock([tx1, tx2], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.duplicateCount).toBeGreaterThanOrEqual(1)
    const group = result.duplicates[0]
    expect(group.transactions.length).toBe(2)
    expect(group.totalExposure).toBe(4400) // one excess copy
    expect(group.matchReasons).toContain('same_amount')
    expect(group.matchReasons).toContain('same_date')
    expect(group.matchReasons).toContain('same_contact')
  })

  it('classifies exact duplicates with high confidence', async () => {
    const tx1 = makeBankTx({
      transaction_id: 'exact-1',
      total_amount: 100,
      transaction_date: '2024-12-01',
      contact_name: 'Beta Co',
      reference: 'REF-SAME',
      raw_data: { isReconciled: true, status: 'AUTHORISED' },
    })
    const tx2 = makeBankTx({
      transaction_id: 'exact-2',
      total_amount: 100,
      transaction_date: '2024-12-01',
      contact_name: 'Beta Co',
      reference: 'REF-SAME',
      raw_data: { isReconciled: true, status: 'AUTHORISED' },
    })

    const supabase = buildSupabaseMock([tx1, tx2], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.duplicateCount).toBe(1)
    const group = result.duplicates[0]
    expect(group.duplicateType).toBe('exact')
    expect(group.confidence).toBe(95)
  })

  // -----------------------------------------------------------------------
  // 7. Missing entries detection
  // -----------------------------------------------------------------------
  it('detects missing bank entries for paid invoices older than 30 days', async () => {
    // Invoice is PAID, dated > 30 days ago, no matching bank transaction
    const paidInvoice = makeInvoice({
      transaction_id: 'inv-missing',
      total_amount: 7500,
      transaction_date: '2024-06-01', // > 30 days from our frozen time (2025-02-11)
      contact_name: 'Gamma Ltd',
      transaction_type: 'ACCPAY',
      raw_data: { status: 'PAID' },
    })

    const supabase = buildSupabaseMock([], [paidInvoice])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.missingCount).toBeGreaterThanOrEqual(1)
    const entry = result.missingEntries.find(
      (m) => m.invoice.transactionId === 'inv-missing',
    )
    expect(entry).toBeDefined()
    expect(entry!.expectedType).toBe('bank_payment') // ACCPAY => bank_payment
    expect(entry!.daysSinceInvoice).toBeGreaterThan(30)
    expect(entry!.reason).toContain('Gamma Ltd')
  })

  it('does not flag invoices younger than 30 days as missing', async () => {
    // Invoice is PAID but only 10 days old -- should NOT be flagged
    const recentInvoice = makeInvoice({
      transaction_id: 'inv-recent',
      total_amount: 500,
      transaction_date: '2025-02-05', // ~6 days from frozen time
      contact_name: 'Delta Services',
      transaction_type: 'ACCPAY',
      raw_data: { status: 'PAID' },
    })

    const supabase = buildSupabaseMock([], [recentInvoice])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.missingCount).toBe(0)
  })

  // -----------------------------------------------------------------------
  // 8. Year-over-year (byFinancialYear) reconciliation
  // -----------------------------------------------------------------------
  it('breaks down reconciliation issues by financial year', async () => {
    const fy2425Tx = makeBankTx({
      transaction_id: 'fy2425-tx',
      financial_year: 'FY2024-25',
      transaction_date: '2024-10-15',
      raw_data: { isReconciled: false },
      total_amount: 1200,
    })

    const fy2324Tx = makeBankTx({
      transaction_id: 'fy2324-tx',
      financial_year: 'FY2023-24',
      transaction_date: '2023-11-15',
      raw_data: { isReconciled: false },
      total_amount: 800,
    })

    const supabase = buildSupabaseMock([fy2425Tx, fy2324Tx], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    const fy2425 = result.byFinancialYear['FY2024-25']
    const fy2324 = result.byFinancialYear['FY2023-24']

    expect(fy2425).toBeDefined()
    expect(fy2425.unreconciledCount).toBeGreaterThanOrEqual(1)
    expect(fy2324).toBeDefined()
    expect(fy2324.unreconciledCount).toBeGreaterThanOrEqual(1)
  })

  // -----------------------------------------------------------------------
  // 9. Account reconciliation (byAccount) structure
  // -----------------------------------------------------------------------
  it('populates byAccount breakdown with correct structure', async () => {
    const tx = makeBankTx({
      transaction_id: 'acct-tx',
      total_amount: 3000,
      raw_data: {
        isReconciled: false,
        lineItems: [{ accountCode: '200', description: 'Sales' }],
      },
    })

    const supabase = buildSupabaseMock([tx], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.byAccount.length).toBeGreaterThanOrEqual(1)
    const acct = result.byAccount.find((a) => a.accountCode === '200')
    expect(acct).toBeDefined()
    expect(acct!.unreconciledCount).toBeGreaterThanOrEqual(1)
    expect(acct!.unreconciledAmount).toBeGreaterThanOrEqual(3000)
  })

  // -----------------------------------------------------------------------
  // 10. Single transaction -- no duplicates possible
  // -----------------------------------------------------------------------
  it('produces zero duplicates when only a single transaction exists', async () => {
    const singleTx = makeBankTx({
      transaction_id: 'solo-tx',
      total_amount: 9999,
      raw_data: { isReconciled: true, status: 'AUTHORISED' },
    })

    const supabase = buildSupabaseMock([singleTx], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.duplicateCount).toBe(0)
    expect(result.duplicates).toEqual([])
  })

  // -----------------------------------------------------------------------
  // 11. Large discrepancy amounts
  // -----------------------------------------------------------------------
  it('handles large amounts and calculates unreconciledAmount correctly', async () => {
    const bigTx1 = makeBankTx({
      transaction_id: 'big-1',
      total_amount: 500000,
      raw_data: { isReconciled: false },
    })
    const bigTx2 = makeBankTx({
      transaction_id: 'big-2',
      total_amount: 250000,
      raw_data: { isReconciled: false },
    })

    const supabase = buildSupabaseMock([bigTx1, bigTx2], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.unreconciledAmount).toBe(750000)
    expect(result.unreconciledCount).toBe(2)
  })

  // -----------------------------------------------------------------------
  // 12. Financial year filter option
  // -----------------------------------------------------------------------
  it('passes financialYears option through to the Supabase queries', async () => {
    const supabase = buildSupabaseMock([], [], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    await analyzeReconciliation(TENANT_ID, {
      financialYears: ['FY2024-25'],
    })

    // Verify .in() was called with 'financial_year' at least once per query chain
    const fromCalls = supabase.from.mock.results
    for (const call of fromCalls) {
      const chain = call.value
      const inCalls = chain.in.mock.calls as any[][]
      const fyCall = inCalls.find(
        (args: any[]) => args[0] === 'financial_year',
      )
      expect(fyCall).toBeDefined()
      expect(fyCall![1]).toContain('FY2024-25')
    }
  })

  // -----------------------------------------------------------------------
  // 13. Duplicate exposure calculation (excess copies * amount)
  // -----------------------------------------------------------------------
  it('calculates duplicateExposure as sum of excess copies times amount', async () => {
    // Three identical transactions => 2 excess copies => exposure = 2 * 1500 = 3000
    const txs = [
      makeBankTx({
        transaction_id: 'trip-1',
        total_amount: 1500,
        transaction_date: '2024-09-01',
        contact_name: 'Triplicate Inc',
        raw_data: { isReconciled: true, status: 'AUTHORISED' },
      }),
      makeBankTx({
        transaction_id: 'trip-2',
        total_amount: 1500,
        transaction_date: '2024-09-01',
        contact_name: 'Triplicate Inc',
        raw_data: { isReconciled: true, status: 'AUTHORISED' },
      }),
      makeBankTx({
        transaction_id: 'trip-3',
        total_amount: 1500,
        transaction_date: '2024-09-01',
        contact_name: 'Triplicate Inc',
        raw_data: { isReconciled: true, status: 'AUTHORISED' },
      }),
    ]

    const supabase = buildSupabaseMock(txs, [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    expect(result.duplicateCount).toBe(1)
    expect(result.duplicateExposure).toBe(3000) // (3-1) * 1500
  })

  // -----------------------------------------------------------------------
  // 14. Missing entry expectedType mapping
  // -----------------------------------------------------------------------
  it('maps ACCREC invoice to bank_receipt expected type', async () => {
    const accrecInvoice = makeInvoice({
      transaction_id: 'inv-accrec',
      total_amount: 2000,
      transaction_date: '2024-05-01', // older than 30 days
      contact_name: 'Receiver Co',
      transaction_type: 'ACCREC',
      raw_data: { status: 'PAID' },
    })

    const supabase = buildSupabaseMock([], [accrecInvoice])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    const entry = result.missingEntries.find(
      (m) => m.invoice.transactionId === 'inv-accrec',
    )
    expect(entry).toBeDefined()
    expect(entry!.expectedType).toBe('bank_receipt') // ACCREC => bank_receipt
  })

  // -----------------------------------------------------------------------
  // 15. Amount extraction fallback from raw_data
  // -----------------------------------------------------------------------
  it('extracts amount from raw_data.total when total_amount is zero', async () => {
    const txWithRawAmount = makeBankTx({
      transaction_id: 'raw-amount-tx',
      total_amount: 0, // database column is zero
      raw_data: {
        isReconciled: false,
        total: 8888,
      },
    })

    const supabase = buildSupabaseMock([txWithRawAmount], [])
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await analyzeReconciliation(TENANT_ID)

    // The engine should have used the raw_data.total fallback
    const item = result.unreconciledItems.find(
      (u) => u.transactionId === 'raw-amount-tx',
    )
    expect(item).toBeDefined()
    expect(item!.amount).toBe(8888)
  })
})
