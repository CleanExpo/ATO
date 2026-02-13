// Fix the RPC function via Supabase Management API

const projectRef = 'xwqymjisxmtcmaebcehw'
const accessToken = 'sbp_7379588c7fb9fcdb4f19c8199ee6f7bebd72dbe7'

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

// Use the Management API SQL endpoint
const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: fixSQL })
})

console.log('Status:', res.status)
const data = await res.text()
console.log('Response:', data.substring(0, 500))

if (res.ok) {
  // Test the fixed function
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    'https://xwqymjisxmtcmaebcehw.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo'
  )

  const { data: rpc, error: rpcErr } = await supabase.rpc('get_user_organizations', {
    p_user_id: '29234f85-0f46-4979-8c07-1a5c5912e0b3'
  })
  console.log('\nRPC test:', rpcErr ? `ERROR: ${rpcErr.message}` : `SUCCESS - ${rpc?.length} orgs`)
  if (rpc) console.log(JSON.stringify(rpc, null, 2))
}
