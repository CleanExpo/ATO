/**
 * Database Migration Runner
 *
 * Runs all consolidated migrations against Supabase database.
 * Usage: node scripts/run-migrations.js
 */

const fs = require('fs');
const path = require('path');

async function runMigrations() {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || serviceKey.includes('PASTE_YOUR')) {
    console.error('❌ Error: Missing Supabase credentials in .env.local');
    console.error('');
    console.error('Please set:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL (already set)');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY (needs to be added)');
    console.error('');
    console.error('Get your keys from:');
    console.error(`  ${supabaseUrl}/project/_/settings/api`);
    process.exit(1);
  }

  console.log('🚀 Starting database migrations...');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log('');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'run-migrations-consolidated.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Loaded migration file (4 tables, 10+ indexes, 3 views, 5 functions)');
    console.log('');

    // Execute migration using Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Migration failed: ${error}`);
    }

    console.log('✅ Migrations completed successfully!');
    console.log('');
    console.log('Created:');
    console.log('  ✓ historical_transactions_cache table');
    console.log('  ✓ audit_sync_status table');
    console.log('  ✓ forensic_analysis_results table');
    console.log('  ✓ ai_analysis_costs table');
    console.log('  ✓ 10+ indexes for fast queries');
    console.log('  ✓ 3 materialized views (mv_rnd_summary, mv_deduction_summary, mv_cost_summary)');
    console.log('  ✓ 5 database functions');
    console.log('');
    console.log('🎉 Database is ready!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: npm run dev');
    console.log('  2. Navigate to: http://localhost:3000/dashboard/forensic-audit');
    console.log('  3. Click "Start Sync" to fetch 5 years of Xero data');
    console.log('  4. Click "Start Analysis" to run AI forensic analysis');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Try using the Supabase dashboard instead:');
    console.error('  1. Go to: https://supabase.com/dashboard/project/xwqymjisxmtcmaebcehw/editor');
    console.error('  2. Create new query');
    console.error('  3. Paste contents of: run-migrations-consolidated.sql');
    console.error('  4. Click Run');
    process.exit(1);
  }
}

runMigrations();
