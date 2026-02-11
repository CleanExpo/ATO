// One-time script: Create owner account and link to Xero orgs
const SUPABASE_URL = 'https://xwqymjisxmtcmaebcehw.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo';
const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  // 1. Create user
  console.log('Creating user...');
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      email: 'phill.mcgurk@gmail.com',
      password: 'q3XgPwyathfrSAgXwXTRPg',
      email_confirm: true,
      user_metadata: { full_name: 'Phill McGurk', role: 'owner' }
    })
  });
  const user = await userRes.json();
  if (user.id) {
    console.log(`User created: ${user.id} (${user.email})`);
  } else {
    console.log('User creation response:', JSON.stringify(user, null, 2));
    // If user already exists, try to find them
    if (user.msg && user.msg.includes('already')) {
      console.log('User may already exist, fetching...');
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, {
        headers: HEADERS,
      });
      const list = await listRes.json();
      const existing = list.users?.find(u => u.email === 'phill.mcgurk@gmail.com');
      if (existing) {
        console.log(`Found existing user: ${existing.id}`);
        user.id = existing.id;
      } else {
        console.error('Could not find or create user');
        return;
      }
    } else {
      return;
    }
  }

  const userId = user.id;

  // 2. Find all organizations
  console.log('\nFinding organizations...');
  const orgRes = await fetch(`${SUPABASE_URL}/rest/v1/organizations?select=id,name,xero_tenant_id`, {
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
  });
  const orgs = await orgRes.json();
  console.log(`Found ${orgs.length} organizations:`, orgs.map(o => o.name));

  // 3. Grant owner access to all organizations
  for (const org of orgs) {
    console.log(`\nGranting owner access to: ${org.name} (${org.id})`);

    // Check if access already exists
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_tenant_access?user_id=eq.${userId}&organization_id=eq.${org.id}`,
      { headers: HEADERS }
    );
    const existing = await checkRes.json();

    if (existing.length > 0) {
      console.log('  Access already exists, updating to owner...');
      await fetch(
        `${SUPABASE_URL}/rest/v1/user_tenant_access?user_id=eq.${userId}&organization_id=eq.${org.id}`,
        {
          method: 'PATCH',
          headers: { ...HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ role: 'owner' })
        }
      );
    } else {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_tenant_access`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          organization_id: org.id,
          tenant_id: org.xero_tenant_id,
          role: 'owner'
        })
      });
      const insertData = await insertRes.json();
      if (insertRes.ok) {
        console.log('  Access granted');
      } else {
        console.log('  Insert result:', JSON.stringify(insertData));
      }
    }
  }

  console.log('\n--- DONE ---');
  console.log(`Email: phill.mcgurk@gmail.com`);
  console.log(`Password: q3XgPwyathfrSAgXwXTRPg`);
  console.log(`User ID: ${userId}`);
  console.log(`Organizations linked: ${orgs.length}`);
}

main().catch(e => console.error('Fatal error:', e));
