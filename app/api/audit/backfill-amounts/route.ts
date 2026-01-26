import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createValidationError } from '@/lib/api/errors'

const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true' || true

export async function POST(request: NextRequest) {
  let tenantId: string

  if (SINGLE_USER_MODE) {
    const body = await request.json()
    tenantId = body.tenantId || ''
    if (!tenantId) {
      return createValidationError('tenantId is required')
    }
  } else {
    return createValidationError('Multi-user mode not supported for backfill')
  }

  try {
    const supabase = await createServiceClient()

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

    // Get transaction amounts from cache
    const transactionIds = nullRecords!.map(r => r.transaction_id)

    const { data: cached, error: cacheError } = await supabase
      .from('historical_transactions_cache')
      .select('transaction_id, total_amount, transaction_date, contact_name, raw_data')
      .eq('tenant_id', tenantId)
      .in('transaction_id', transactionIds)

    if (cacheError) {
      console.error('Error fetching cached transactions:', cacheError)
      return NextResponse.json({ error: cacheError.message }, { status: 500 })
    }

    if (!cached || cached.length === 0) {
      return NextResponse.json({
        status: 'no_cache',
        message: 'No cached transactions found to backfill from',
        updated: 0
      })
    }

    // Build lookup map
    const cacheMap = new Map(cached.map(c => [c.transaction_id, c]))

    // Update each record
    let updated = 0
    let errors = 0

    for (const record of nullRecords!) {
      const cachedTx = cacheMap.get(record.transaction_id)
      if (!cachedTx) continue

      // Extract description from raw_data
      const rawData = cachedTx.raw_data as Record<string, unknown> | null
      let description = ''
      if (rawData) {
        // Try lineItems first, then reference
        const lineItems = rawData.lineItems as Array<{ description?: string }> | undefined
        if (lineItems?.[0]?.description) {
          description = lineItems[0].description
        } else if (rawData.reference) {
          description = String(rawData.reference)
        }
      }

      const { error: updateError } = await supabase
        .from('forensic_analysis_results')
        .update({
          transaction_amount: cachedTx.total_amount,
          transaction_date: cachedTx.transaction_date,
          supplier_name: cachedTx.contact_name,
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
      cachedTransactionsFound: cached.length,
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
