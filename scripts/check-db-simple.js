require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  console.log('\\n=== Checking xero_connections table ===');
  const { data, error } = await supabase
    .from('xero_connections')
    .select('tenant_id, organisation_name, tenant_name, connected_at, organization_id')
    .order('connected_at', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(`Found ${data.length} Xero connections:\\n`);
    if (data.length === 0) {
      console.log('  (No connections found - this is the problem!)');
    } else {
      data.forEach(c => {
        console.log(`  - ${c.organisation_name || c.tenant_name}`);
        console.log(`    Tenant ID: ${c.tenant_id}`);
        console.log(`    Org ID: ${c.organization_id || 'NULL'}`);
        console.log(`    Connected: ${c.connected_at}`);
        console.log('');
      });
    }
  }

  console.log('\\n=== Checking organizations table ===');
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, xero_tenant_id, xero_connected, created_at')
    .order('created_at', { ascending: false });

  if (orgError) {
    console.error('Error:', orgError.message);
  } else {
    console.log(`Found ${orgs.length} organizations:\\n`);
    if (orgs.length === 0) {
      console.log('  (No organizations found - this is the problem!)');
    } else {
      orgs.forEach(o => {
        console.log(`  - ${o.name}`);
        console.log(`    ID: ${o.id}`);
        console.log(`    Xero Tenant: ${o.xero_tenant_id || 'NULL'}`);
        console.log(`    Connected: ${o.xero_connected}`);
        console.log(`    Created: ${o.created_at}`);
        console.log('');
      });
    }
  }

  console.log('\\n=== Summary ===');
  console.log(`Xero Connections: ${data?.length || 0}`);
  console.log(`Organizations: ${orgs?.length || 0}`);
  console.log('\\nIf both are 0, OAuth is completing but not saving to database.');
})();
