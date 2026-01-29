#!/usr/bin/env node
/**
 * Fix CARSI Connection
 *
 * Deletes the old CARSI connection with NULL organization_id
 * so the user can reconnect via OAuth flow and create proper organization record.
 *
 * SAFE TO RUN: Only deletes CARSI connection if organization_id is NULL
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CARSI_TENANT_ID = '9656b831-bb60-43db-8176-9f009903c1a8';

(async () => {
  console.log('\n=== Fixing CARSI Connection ===\n');

  // Check current state
  const { data: connection, error: fetchError } = await supabase
    .from('xero_connections')
    .select('*')
    .eq('tenant_id', CARSI_TENANT_ID)
    .single();

  if (fetchError || !connection) {
    console.log('❌ CARSI connection not found');
    console.log('   User can connect directly via OAuth');
    return;
  }

  console.log('Current CARSI connection:');
  console.log(`  Tenant ID: ${connection.tenant_id}`);
  console.log(`  Org ID: ${connection.organization_id || 'NULL'}`);
  console.log(`  Connected: ${connection.connected_at}`);

  if (connection.organization_id !== null) {
    console.log('\n✅ CARSI connection already has organization_id!');
    console.log('   No action needed.');
    return;
  }

  // Delete old connection
  console.log('\n🗑️  Deleting old CARSI connection with NULL organization_id...');

  const { error: deleteError } = await supabase
    .from('xero_connections')
    .delete()
    .eq('tenant_id', CARSI_TENANT_ID);

  if (deleteError) {
    console.error('❌ Failed to delete:', deleteError);
    return;
  }

  console.log('✅ Old CARSI connection deleted successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. User visits dashboard/connect page');
  console.log('   2. User clicks "Connect Xero"');
  console.log('   3. User logs in to Xero (will see all 3 organizations)');
  console.log('   4. User selects CARSI');
  console.log('   5. OAuth callback creates proper organization record');
  console.log('\n   Run: node scripts/check-db-simple.js to verify after reconnection');
})();
