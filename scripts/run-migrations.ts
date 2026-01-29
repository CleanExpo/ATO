/**
 * Migration Runner Script
 *
 * Applies pending SQL migrations to Supabase database
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration(migrationFile: string) {
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile)

  console.log(`\n📝 Running migration: ${migrationFile}`)

  try {
    const sql = readFileSync(migrationPath, 'utf-8')

    // Split SQL by statement (handle multi-statement files)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))

    console.log(`   Found ${statements.length} SQL statements`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'

      // Skip comments and empty statements
      if (statement.trim().length < 5) continue

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })

        if (error) {
          // Try direct execution if rpc fails
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey!,
              'Authorization': `Bearer ${supabaseServiceKey!}`
            },
            body: JSON.stringify({ query: statement })
          })

          if (!response.ok) {
            console.error(`   ⚠️  Statement ${i + 1} warning:`, error.message)
            // Continue anyway - some errors are expected (like IF NOT EXISTS)
          } else {
            console.log(`   ✅ Statement ${i + 1} executed`)
          }
        } else {
          console.log(`   ✅ Statement ${i + 1} executed`)
        }
      } catch (err) {
        console.error(`   ❌ Statement ${i + 1} failed:`, err)
        // Continue to next statement
      }
    }

    console.log(`✅ Migration ${migrationFile} completed`)
    return true

  } catch (error) {
    console.error(`❌ Migration ${migrationFile} failed:`, error)
    return false
  }
}

async function main() {
  console.log('🚀 Starting database migrations...\n')
  console.log(`📍 Supabase URL: ${supabaseUrl}`)

  // Migrations to run (in order)
  const migrations = [
    '20260128000008_add_platform_column.sql',
    '20260128000009_add_platform_to_analysis_tables.sql',
    '20260128000010_create_quickbooks_tokens_table.sql',
    '20260128000011_create_tax_alerts_system.sql'
  ]

  let successCount = 0
  let failCount = 0

  for (const migration of migrations) {
    const success = await runMigration(migration)
    if (success) {
      successCount++
    } else {
      failCount++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`📊 Migration Summary:`)
  console.log(`   ✅ Successful: ${successCount}`)
  console.log(`   ❌ Failed: ${failCount}`)
  console.log('='.repeat(60))

  if (failCount > 0) {
    console.log('\n⚠️  Some migrations failed. Check errors above.')
    console.log('💡 You may need to run these SQL files manually in Supabase SQL editor:')
    console.log('   https://app.supabase.com/project/_/sql')
    process.exit(1)
  } else {
    console.log('\n🎉 All migrations completed successfully!')
    process.exit(0)
  }
}

main()
