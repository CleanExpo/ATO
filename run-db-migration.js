#!/usr/bin/env node
/**
 * Run work_queue database migration
 * Uses Supabase REST API to execute raw SQL
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const https = require('https');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🔄 Running work_queue migration...\n');

// Read migration file
const migrationSQL = fs.readFileSync(
  'supabase/migrations/20260129_create_work_queue.sql',
  'utf-8'
);

console.log('📄 Migration file loaded (261 lines)');
console.log('🔗 Connecting to Supabase...\n');

// Extract project ref from URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
const dbUrl = `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`;

// Try using Supabase REST API
const postData = JSON.stringify({
  sql: migrationSQL
});

const url = new URL(dbUrl);
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`
  }
};

console.log('⚠️  Note: Supabase REST API may not support raw SQL execution.');
console.log('If this fails, use the Supabase Dashboard SQL Editor instead.\n');
console.log('📊 Attempting migration...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Migration executed successfully!\n');
      console.log('Created:');
      console.log('  ├─ work_queue table');
      console.log('  ├─ 8 indexes');
      console.log('  ├─ 3 helper functions');
      console.log('  └─ Row-level security policies\n');

      console.log('🧪 Verify with: npx tsx test-setup.ts');
      process.exit(0);
    } else {
      console.error(`❌ Migration failed (HTTP ${res.statusCode})\n`);
      console.error('Response:', data.substring(0, 200));
      console.log('\n💡 Alternative: Use Supabase Dashboard SQL Editor\n');
      showManualInstructions();
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.log('\n💡 Use Supabase Dashboard instead:\n');
  showManualInstructions();
  process.exit(1);
});

req.write(postData);
req.end();

function showManualInstructions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 MANUAL MIGRATION INSTRUCTIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('1. Open Supabase Dashboard:');
  console.log(`   ${SUPABASE_URL.replace('/rest/v1', '')}\n`);

  console.log('2. Navigate to: SQL Editor (left sidebar)\n');

  console.log('3. Click: "New Query" button\n');

  console.log('4. Copy the migration file:');
  console.log('   File: supabase/migrations/20260129_create_work_queue.sql\n');

  console.log('5. Paste the SQL into the editor\n');

  console.log('6. Click: "Run" button\n');

  console.log('7. Verify: Check "Tables" sidebar for "work_queue"\n');

  console.log('8. Test: Run `npx tsx test-setup.ts`\n');

  console.log('═══════════════════════════════════════════════════════════');
}
