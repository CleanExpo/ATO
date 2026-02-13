import { config } from 'dotenv';
config({ path: '.env.production.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

async function main() {
  // Check audit_sync_status
  const syncRes = await fetch(
    `${url}/rest/v1/audit_sync_status?select=*&tenant_id=eq.9656b831-bb60-43db-8176-9f009903c1a8`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const syncData = await syncRes.json();
  console.log('=== audit_sync_status ===');
  console.log(JSON.stringify(syncData, null, 2));

  // Check historical_transactions_cache count
  const cacheRes = await fetch(
    `${url}/rest/v1/historical_transactions_cache?select=count&tenant_id=eq.9656b831-bb60-43db-8176-9f009903c1a8`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' } }
  );
  const cacheCount = cacheRes.headers.get('content-range');
  console.log('\n=== historical_transactions_cache count ===');
  console.log('Content-Range:', cacheCount);

  // Check all sync statuses
  const allSyncRes = await fetch(
    `${url}/rest/v1/audit_sync_status?select=tenant_id,platform,sync_status,sync_progress,transactions_synced,error_message`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const allSyncData = await allSyncRes.json();
  console.log('\n=== All audit_sync_status rows ===');
  console.log(JSON.stringify(allSyncData, null, 2));
}

main().catch(console.error);
