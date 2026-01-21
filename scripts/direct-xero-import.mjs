#!/usr/bin/env node

/**
 * Direct Xero Import Script
 *
 * Bypasses the broken sync process and directly imports transactions from Xero
 * into the database for analysis.
 *
 * Usage:
 *   node scripts/direct-xero-import.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env.local')

config({ path: envPath })

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

// Default tenant (can be overridden via command line)
const TENANT_ID = process.argv[2] || '8a8caf6c-614b-45a5-9e15-46375122407c'
const START_YEAR = parseInt(process.argv[3]) || 2020
const END_YEAR = parseInt(process.argv[4]) || 2025

console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║       Direct Xero Transaction Import Script              ║')
console.log('╚═══════════════════════════════════════════════════════════╝\n')

console.log(`Configuration:`)
console.log(`  Tenant ID: ${TENANT_ID}`)
console.log(`  Year Range: ${START_YEAR} - ${END_YEAR}`)
console.log(`  Supabase URL: ${SUPABASE_URL?.substring(0, 30)}...`)
console.log(`  API Base URL: ${BASE_URL}\n`)

// Validate environment
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Missing environment variables')
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * Fetch all transactions from Xero API with pagination
 */
async function fetchAllXeroTransactions() {
  console.log('\n📥 Fetching transactions from Xero API...\n')

  let allTransactions = []
  let page = 1
  const pageSize = 100 // Xero returns 100 per page max
  let hasMore = true

  while (hasMore) {
    try {
      const url = `${BASE_URL}/api/xero/transactions?tenantId=${TENANT_ID}&page=${page}&pageSize=${pageSize}`

      console.log(`   Page ${page}: Fetching...`)
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.transactions && data.transactions.length > 0) {
        allTransactions = allTransactions.concat(data.transactions)
        console.log(`   Page ${page}: ✅ Got ${data.transactions.length} transactions (Total: ${allTransactions.length})`)

        // Check if there are more pages
        hasMore = data.transactions.length === pageSize
        page++

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        hasMore = false
        console.log(`   Page ${page}: No more transactions`)
      }
    } catch (error) {
      console.error(`   Page ${page}: ❌ Error - ${error.message}`)
      hasMore = false
    }
  }

  console.log(`\n✅ Total transactions fetched: ${allTransactions.length}\n`)
  return allTransactions
}

/**
 * Transform Xero transaction to database format
 * Maps to actual database column names from migration 004_create_historical_cache.sql
 */
function transformTransaction(tx, tenantId) {
  const date = new Date(tx.date)
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  // Calculate financial year (July 1 - June 30 in Australia)
  let financialYear
  if (month >= 7) {
    financialYear = `FY${year}-${String(year + 1).slice(2)}`
  } else {
    financialYear = `FY${year - 1}-${String(year).slice(2)}`
  }

  // Column names from migration: transaction_amount (not total_amount!)
  return {
    tenant_id: tenantId,
    transaction_id: tx.id,
    transaction_type: tx.type,
    transaction_date: tx.date,
    transaction_amount: tx.total,        // ✅ Correct: transaction_amount
    financial_year: financialYear,
    raw_data: tx
  }
}

/**
 * Clear existing cached data for tenant
 */
async function clearExistingCache() {
  console.log('🗑️  Clearing existing cached data...\n')

  try {
    const { error } = await supabase
      .from('historical_transactions_cache')
      .delete()
      .eq('tenant_id', TENANT_ID)

    if (error) {
      console.error(`   ❌ Error clearing cache: ${error.message}`)
      return false
    }

    console.log('   ✅ Cache cleared\n')
    return true
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
    return false
  }
}

/**
 * Insert transactions into database in batches
 */
async function insertTransactions(transactions) {
  console.log(`📝 Inserting ${transactions.length} transactions into database...\n`)

  const batchSize = 100
  let inserted = 0
  let errors = 0

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(transactions.length / batchSize)

    try {
      console.log(`   Batch ${batchNum}/${totalBatches}: Inserting ${batch.length} transactions...`)

      const transformed = batch.map(tx => transformTransaction(tx, TENANT_ID))

      const { data, error } = await supabase
        .from('historical_transactions_cache')
        .insert(transformed)
        .select()

      if (error) {
        console.error(`   Batch ${batchNum}/${totalBatches}: ❌ Error - ${error.message}`)
        errors += batch.length
      } else {
        inserted += data?.length || batch.length
        console.log(`   Batch ${batchNum}/${totalBatches}: ✅ Inserted ${data?.length || batch.length} transactions`)
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      console.error(`   Batch ${batchNum}/${totalBatches}: ❌ Error - ${error.message}`)
      errors += batch.length
    }
  }

  console.log(`\n📊 Import Summary:`)
  console.log(`   ✅ Successfully inserted: ${inserted}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log(`   📈 Success rate: ${((inserted / transactions.length) * 100).toFixed(1)}%\n`)

  return { inserted, errors }
}

/**
 * Update sync status to show completion
 */
async function updateSyncStatus(transactionCount) {
  console.log('📝 Updating sync status...\n')

  try {
    const { error } = await supabase
      .from('audit_sync_status')
      .upsert({
        tenant_id: TENANT_ID,
        sync_status: 'complete',
        transactions_synced: transactionCount,
        total_transactions: transactionCount,
        current_year: `FY${END_YEAR}-${String(END_YEAR + 1).slice(2)}`,
        years_synced: Array.from(
          { length: END_YEAR - START_YEAR + 1 },
          (_, i) => `FY${START_YEAR + i}-${String(START_YEAR + i + 1).slice(2)}`
        ),
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id'
      })

    if (error) {
      console.error(`   ❌ Error updating sync status: ${error.message}\n`)
      return false
    }

    console.log('   ✅ Sync status updated\n')
    return true
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`)
    return false
  }
}

/**
 * Verify the import
 */
async function verifyImport() {
  console.log('🔍 Verifying import...\n')

  try {
    // Count total transactions
    const { count: totalCount, error: countError } = await supabase
      .from('historical_transactions_cache')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID)

    if (countError) {
      console.error(`   ❌ Error counting transactions: ${countError.message}`)
      return
    }

    console.log(`   📊 Total transactions in database: ${totalCount}`)

    // Get transactions by year
    const { data: byYear, error: yearError } = await supabase
      .from('historical_transactions_cache')
      .select('financial_year')
      .eq('tenant_id', TENANT_ID)

    if (!yearError && byYear) {
      const yearCounts = byYear.reduce((acc, row) => {
        acc[row.financial_year] = (acc[row.financial_year] || 0) + 1
        return acc
      }, {})

      console.log('\n   📅 Transactions by Financial Year:')
      Object.entries(yearCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([year, count]) => {
          console.log(`      ${year}: ${count.toLocaleString()} transactions`)
        })
    }

    // Get sample transaction
    const { data: sample, error: sampleError } = await supabase
      .from('historical_transactions_cache')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .limit(1)

    if (!sampleError && sample && sample.length > 0) {
      console.log('\n   📝 Sample Transaction:')
      console.log(`      ID: ${sample[0].transaction_id}`)
      console.log(`      Date: ${sample[0].date}`)
      console.log(`      Type: ${sample[0].type}`)
      console.log(`      Amount: $${sample[0].total}`)
      console.log(`      Year: ${sample[0].financial_year}`)
    }

    console.log('')
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`)
  }
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now()

  try {
    // Step 1: Clear existing cache
    const cleared = await clearExistingCache()
    if (!cleared) {
      console.log('⚠️  Warning: Could not clear cache, continuing anyway...\n')
    }

    // Step 2: Fetch all transactions from Xero
    const transactions = await fetchAllXeroTransactions()

    if (transactions.length === 0) {
      console.log('⚠️  No transactions found. Exiting.\n')
      return
    }

    // Step 3: Insert into database
    const { inserted, errors } = await insertTransactions(transactions)

    // Step 4: Update sync status
    await updateSyncStatus(inserted)

    // Step 5: Verify the import
    await verifyImport()

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('╔═══════════════════════════════════════════════════════════╗')
    console.log('║                    Import Complete!                       ║')
    console.log('╚═══════════════════════════════════════════════════════════╝\n')

    console.log(`✅ Successfully imported ${inserted} transactions in ${duration} seconds`)
    console.log(`⏱️  Average: ${(inserted / parseFloat(duration)).toFixed(1)} transactions/second\n`)

    if (errors > 0) {
      console.log(`⚠️  ${errors} transactions had errors\n`)
    }

    console.log('🎯 Next Steps:')
    console.log('   1. Visit http://localhost:3000/dashboard/forensic-audit')
    console.log('   2. Click "Start AI Analysis (FREE)"')
    console.log('   3. Wait for analysis to complete (~1-2 hours)')
    console.log('   4. Test the download buttons\n')

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the script
main()
  .then(() => {
    console.log('✅ Script completed successfully\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message)
    process.exit(1)
  })
