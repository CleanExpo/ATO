import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo'
)

console.log('=== Checking database state ===\n')

// 1. Check if user_tenant_access table exists
console.log('--- user_tenant_access table ---')
const { data: uta, error: utaErr } = await supabase.from('user_tenant_access').select('*').limit(5)
if (utaErr) {
  console.log('ERROR:', utaErr.message)
} else {
  console.log('Rows:', uta?.length || 0)
  if (uta?.length > 0) console.log(JSON.stringify(uta, null, 2))
}

// 2. Check if organizations table exists
console.log('\n--- organizations table ---')
const { data: orgs, error: orgErr } = await supabase.from('organizations').select('*').limit(10)
if (orgErr) {
  console.log('ERROR:', orgErr.message)
} else {
  console.log('Rows:', orgs?.length || 0)
  if (orgs?.length > 0) console.log(JSON.stringify(orgs.map(o => ({ id: o.id, name: o.name, xero_tenant_id: o.xero_tenant_id })), null, 2))
}

// 3. Check xero_connections table
console.log('\n--- xero_connections table ---')
const { data: xc, error: xcErr } = await supabase.from('xero_connections').select('id, tenant_id, tenant_name, organisation_name, organization_id, user_id').limit(10)
if (xcErr) {
  console.log('ERROR:', xcErr.message)
} else {
  console.log('Rows:', xc?.length || 0)
  if (xc?.length > 0) console.log(JSON.stringify(xc, null, 2))
}

// 4. Check get_user_organizations RPC
console.log('\n--- get_user_organizations RPC ---')
const { data: rpc, error: rpcErr } = await supabase.rpc('get_user_organizations', {
  p_user_id: '29234f85-0f46-4979-8c07-1a5c5912e0b3'
})
if (rpcErr) {
  console.log('ERROR:', rpcErr.message)
} else {
  console.log('Rows:', rpc?.length || 0)
  if (rpc?.length > 0) console.log(JSON.stringify(rpc, null, 2))
}

// 5. Check auth user
console.log('\n--- auth user ---')
const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 5 })
if (usersErr) {
  console.log('ERROR:', usersErr.message)
} else {
  console.log('Users:', users?.length || 0)
  users?.forEach(u => console.log(`  ${u.id} - ${u.email}`))
}
