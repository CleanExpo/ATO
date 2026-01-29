#!/usr/bin/env node
/**
 * Apply Migration 020: Add organization_id column to xero_connections
 *
 * This fixes the critical bug where OAuth connections fail to save because
 * the organization_id column doesn't exist in the database.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function applyMigration() {
  console.log('\n🔧 Applying Migration 020: Add organization_id column\n');

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '020_add_organization_id_to_xero_connections.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration SQL:');
  console.log(sql);
  console.log('\n⚠️  IMPORTANT: This migration needs to be run via Supabase Dashboard\n');
  console.log('Steps to apply:');
  console.log('1. Go to https://supabase.com/dashboard/project/xwqymjisxmtcmaebcehw/sql/new');
  console.log('2. Paste the SQL above');
  console.log('3. Click "Run"');
  console.log('\nAlternatively, if you have Supabase CLI installed:');
  console.log('  supabase db push\n');

  // Try to check if column already exists
  const { data, error } = await supabase
    .from('xero_connections')
    .select('organization_id')
    .limit(1);

  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('organization_id')) {
      console.log('✅ Confirmed: organization_id column DOES NOT exist (as expected)');
      console.log('   This is why OAuth connections are not saving!');
    } else {
      console.error('❌ Unexpected error checking column:', error.message);
    }
  } else {
    console.log('✅ Column organization_id already exists! Migration may have been applied.');
  }
}

applyMigration();
