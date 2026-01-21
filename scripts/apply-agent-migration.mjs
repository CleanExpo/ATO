import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Read migration file
const migrationSQL = readFileSync(
  resolve(__dirname, '../supabase/migrations/20260121_agent_reports.sql'),
  'utf-8'
)

console.log('🚀 Applying agent_reports table migration...\n')

try {
  // Execute the migration SQL
  // Note: Supabase JS client doesn't support raw SQL execution directly
  // We need to use the REST API or split into individual statements

  // For now, let's check if the table already exists
  const { data: tables, error: checkError } = await supabase
    .from('agent_reports')
    .select('id')
    .limit(1)

  if (!checkError) {
    console.log('✅ Table agent_reports already exists')
    console.log('   Migration likely already applied\n')
  } else if (checkError.code === 'PGRST204') {
    console.log('❌ Table agent_reports does not exist')
    console.log('\n📋 Manual migration required:')
    console.log('   1. Go to Supabase Dashboard')
    console.log('   2. Navigate to: SQL Editor')
    console.log('   3. Paste and run the following SQL:\n')
    console.log('─'.repeat(60))
    console.log(migrationSQL)
    console.log('─'.repeat(60))
    console.log('\nOr use the Supabase CLI:')
    console.log('   supabase db push\n')
  } else {
    console.error('❌ Error checking table:', checkError.message)
    console.log('\n📋 Manual migration required (see instructions above)\n')
  }

} catch (error) {
  console.error('❌ Migration failed:', error.message)
  console.log('\n📋 Please apply migration manually via Supabase Dashboard\n')
  process.exit(1)
}
