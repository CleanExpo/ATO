import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo'
)

// Check RLS status on tables
console.log('=== Checking RLS policies ===\n')

// Check if RLS is enabled on user_tenant_access
const { data: policies } = await supabase
  .from('user_tenant_access')
  .select('*')
  .limit(1)
console.log('user_tenant_access (service role):', policies?.length, 'rows')

// Check if RLS is enabled on organizations
const { data: orgs } = await supabase
  .from('organizations')
  .select('*')
  .limit(1)
console.log('organizations (service role):', orgs?.length, 'rows')

// Now test with anon key (simulating authenticated user)
const anonClient = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTE3MjksImV4cCI6MjA4NDM2NzcyOX0.jm5ky50bLMsslRe3mRn6JknG6sMGMi_tRTJiKmaki6c'
)

// Sign in as the user
const { data: auth } = await anonClient.auth.signInWithPassword({
  email: 'phill.mcgurk@gmail.com',
  password: 'q3XgPwyathfrSAgXwXTRPg'
})
console.log('\nAuth:', auth?.user?.id ? 'OK' : 'FAILED')

const { data: utaAuth, error: utaErr } = await anonClient
  .from('user_tenant_access')
  .select('*')
  .eq('user_id', auth?.user?.id)
console.log('user_tenant_access (auth user):', utaAuth?.length ?? 0, 'rows', utaErr?.message || '')

const { data: orgsAuth, error: orgsErr } = await anonClient
  .from('organizations')
  .select('*')
console.log('organizations (auth user):', orgsAuth?.length ?? 0, 'rows', orgsErr?.message || '')
