import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo',
  { db: { schema: 'public' } }
)

// Fix the RPC function via SQL
const fixSQL = `
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  xero_connected BOOLEAN,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    uta.role,
    (o.xero_tenant_id IS NOT NULL) AS xero_connected,
    (SELECT COUNT(*) FROM user_tenant_access uta2 WHERE uta2.organization_id = o.id) AS member_count
  FROM organizations o
  INNER JOIN user_tenant_access uta ON uta.organization_id = o.id
  WHERE uta.user_id = p_user_id
  ORDER BY o.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`

// Execute via Supabase Management API
const projectRef = 'xwqymjisxmtcmaebcehw'
const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/`, {
  method: 'POST',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo',
    'Content-Type': 'application/json'
  }
})
console.log('Direct RPC approach status:', res.status)

// Try via supabase-js - use pg_dump style
// Actually, let's try using the SQL editor API
const sqlRes = await fetch(`https://${projectRef}.supabase.co/pg/query`, {
  method: 'POST',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: fixSQL })
})
console.log('SQL editor status:', sqlRes.status)
const sqlData = await sqlRes.text()
console.log('SQL result:', sqlData.substring(0, 500))

// Test if it works now
console.log('\n--- Testing fixed RPC ---')
const { data: rpc, error: rpcErr } = await supabase.rpc('get_user_organizations', {
  p_user_id: '29234f85-0f46-4979-8c07-1a5c5912e0b3'
})
if (rpcErr) {
  console.log('RPC still fails:', rpcErr.message)
} else {
  console.log('RPC success! Rows:', rpc?.length)
  console.log(JSON.stringify(rpc, null, 2))
}
