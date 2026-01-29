/**
 * Quick script to check what's in the database
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  console.log('Checking database...\n')

  // Check organizations table
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, xero_tenant_id, xero_connected, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('=== ORGANIZATIONS TABLE ===')
  if (orgsError) {
    console.error('Error:', orgsError.message)
  } else {
    console.log(`Found ${orgs.length} organizations:`)
    orgs.forEach(org => {
      console.log(`  - ${org.name} (ID: ${org.id})`)
      console.log(`    Xero Tenant: ${org.xero_tenant_id}`)
      console.log(`    Connected: ${org.xero_connected}`)
      console.log(`    Created: ${org.created_at}`)
    })
  }

  console.log('\n=== XERO_CONNECTIONS TABLE ===')
  const { data: connections, error: connError } = await supabase
    .from('xero_connections')
    .select('tenant_id, tenant_name, organisation_name, organization_id, connected_at')
    .order('connected_at', { ascending: false })
    .limit(10)

  if (connError) {
    console.error('Error:', connError.message)
  } else {
    console.log(`Found ${connections.length} xero connections:`)
    connections.forEach(conn => {
      console.log(`  - ${conn.organisation_name || conn.tenant_name}`)
      console.log(`    Tenant ID: ${conn.tenant_id}`)
      console.log(`    Org ID: ${conn.organization_id}`)
      console.log(`    Connected: ${conn.connected_at}`)
    })
  }
}

checkDatabase().then(() => {
  console.log('\nDone!')
  process.exit(0)
}).catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
