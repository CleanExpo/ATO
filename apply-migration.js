/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js')

// Read migration file
const fs = require('fs')
const path = require('path')

const migrationFile = path.join(__dirname, 'supabase', 'migrations', '20260211_add_slug_to_organizations.sql')
const sql = fs.readFileSync(migrationFile, 'utf8')

// Create Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
    console.log('Applying migration: Add slug column to organizations...')
    
    try {
        // Execute the SQL
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
        
        if (error) {
            // Try direct query if RPC fails
            console.log('RPC failed, trying direct query...')
            const { error: queryError } = await supabase.from('_temp_query').select('*').limit(1)
            
            // Use raw SQL via REST API
            const response = await fetch(`${supabaseUrl}/rest/v1/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey,
                    'Prefer': 'params=single-object'
                },
                body: JSON.stringify({ query: sql })
            })
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }
        }
        
        console.log('✅ Migration applied successfully!')
    } catch (err) {
        console.error('❌ Failed to apply migration:', err.message)
        console.log('\n⚠️  Please apply the migration manually:')
        console.log('1. Go to https://app.supabase.com/project/xwqymjisxmtcmaebcehw')
        console.log('2. Open the SQL Editor')
        console.log('3. Run the contents of: supabase/migrations/20260211_add_slug_to_organizations.sql')
        process.exit(1)
    }
}

applyMigration()
