import { createClient } from '@supabase/supabase-js'

const anonClient = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTE3MjksImV4cCI6MjA4NDM2NzcyOX0.7BUiIFURS9QclDEY5kYgahba6I6yQpmQKwJ2Xk2SetE'
)

// Sign in
const { data: auth, error: authErr } = await anonClient.auth.signInWithPassword({
  email: 'phill.mcgurk@gmail.com',
  password: 'q3XgPwyathfrSAgXwXTRPg'
})
console.log('Auth:', auth?.user?.id || authErr?.message)

if (!auth?.user) process.exit(1)

const { data: uta, error: utaErr } = await anonClient
  .from('user_tenant_access')
  .select('organization_id, tenant_id, role')
  .eq('user_id', auth.user.id)
console.log('user_tenant_access:', uta?.length ?? 0, 'rows', utaErr?.message || '')
if (uta?.length > 0) console.log(JSON.stringify(uta, null, 2))

const { data: orgs, error: orgsErr } = await anonClient
  .from('organizations')
  .select('id, name')
console.log('\norganizations:', orgs?.length ?? 0, 'rows', orgsErr?.message || '')
if (orgs?.length > 0) console.log(JSON.stringify(orgs, null, 2))
