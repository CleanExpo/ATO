import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createValidationError } from '@/lib/api/errors'
import { isSingleUserMode } from '@/lib/auth/single-user-check'

interface CachedTransaction {
  transaction_id: string
  total_amount: number | null
  transaction_date: string | null
  contact_name: string | null
  raw_data: Record<string, unknown> | null
}

export async function POST(request: NextRequest) {
  let tenantId: string

  if (isSingleUserMode()) {
    const body = await request.json()
    tenantId = body.tenantId || ''
    if (!tenantId) {
      return createValidationError('tenantId is required')
    }
  } else {
    return createValidationError('Multi-user mode not supported for backfill')
  }

  try {
    const supabase = createAdminClient()

    // Find forensic_analysis_results with NULL transaction_amount
    // and backfill from historical_transactions_cache
    const { data: nullRecords, error: countError } = await supabase
      .from('forensic_analysis_results')
      .select('id, transaction_id')
      .eq('tenant_id', tenantId)
      .is('transaction_amount', null)

    if (countError) {
      console.error('Error counting null records:', countError)
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    const nullCount = nullRecords?.length || 0

    if (nullCount === 0) {
      return NextResponse.json({
        status: 'no_action',
        message: 'All records already have transaction_amount populated',
        updated: 0
      })
    }

    // Get transaction amounts from cache in batches (Supabase URL length limit)
    const transactionIds = nullRecords!.map(r => r.transaction_id)
    const BATCH_SIZE = 25
    const cacheMap = new Map<string, CachedTransaction>()

    for (let i = 0; i < transactionIds.length; i += BATCH_SIZE) {
      const batch = transactionIds.slice(i, i + BATCH_SIZE)
      const { data: cached, error: cacheError } = await supabase
        .from('historical_transactions_cache')
        .select('transaction_id, total_amount, transaction_date, contact_name, raw_data')
        .eq('tenant_id', tenantId)
        .in('transaction_id', batch)

      if (cacheError) {
        console.error(`Error fetching cache batch ${i / BATCH_SIZE}:`, cacheError)
        continue
      }

      if (cached) {
        cached.forEach(c => cacheMap.set(c.transaction_id, c as CachedTransaction))
      }
    }

    if (cacheMap.size === 0) {
      return NextResponse.json({
        status: 'no_cache',
        message: 'No cached transactions found to backfill from',
        updated: 0
      })
    }

    // Update each record
    let updated = 0
    let errors = 0

    for (const record of nullRecords!) {
      const cachedTx = cacheMap.get(record.transaction_id)
      if (!cachedTx) continue

      // Extract data from raw_data as fallback when columns are NULL
      const rawData = cachedTx.raw_data

      // Amount: prefer column, fallback to raw_data.total
      const amount = cachedTx.total_amount
        ?? (rawData?.total != null ? parseFloat(String(rawData.total)) : null)

      // Date: prefer column, fallback to raw_data.date
      const txnDate = cachedTx.transaction_date
        ?? (rawData?.date ? String(rawData.date) : null)

      // Contact: prefer column, fallback to raw_data.contact.name
      const rawContact = rawData?.contact as Record<string, unknown> | undefined
      const contact = cachedTx.contact_name
        ?? (rawContact?.name ? String(rawContact.name) : null)

      // Description: try lineItems first, then reference
      let description = ''
      if (rawData) {
        const lineItems = rawData.lineItems as Array<{ description?: string }> | undefined
        if (lineItems?.[0]?.description) {
          description = lineItems[0].description
        } else if (rawData.reference) {
          description = String(rawData.reference)
        }
      }

      if (amount == null) continue // Skip if no amount available

      const { error: updateError } = await supabase
        .from('forensic_analysis_results')
        .update({
          transaction_amount: amount,
          transaction_date: txnDate,
          supplier_name: contact,
          transaction_description: description || null
        })
        .eq('id', record.id)

      if (updateError) {
        console.error(`Failed to update ${record.id}:`, updateError)
        errors++
      } else {
        updated++
      }
    }

    return NextResponse.json({
      status: 'complete',
      message: `Backfilled ${updated} records with transaction amounts`,
      nullRecordsBefore: nullCount,
      cachedTransactionsFound: cacheMap.size,
      updated,
      errors
    })
  } catch (error: unknown) {
    console.error('Backfill failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
