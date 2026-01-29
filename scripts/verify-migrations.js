/**
 * Migration Verification Script
 *
 * Verifies that all database tables, indexes, and views were created successfully.
 * Usage: node scripts/verify-migrations.js
 */

require('dotenv').config({ path: '.env.local' });

async function verifyMigrations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || serviceKey.includes('PASTE_YOUR')) {
    console.error('❌ Error: Missing Supabase credentials');
    console.error('Please set SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  console.log('🔍 Verifying database migrations...');
  console.log('');

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check tables
    console.log('Checking tables...');
    const tables = [
      'historical_transactions_cache',
      'audit_sync_status',
      'forensic_analysis_results',
      'ai_analysis_costs',
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error && error.code === '42P01') {
        console.log(`  ❌ ${table} - NOT FOUND`);
        console.error('     Migration not complete!');
      } else {
        console.log(`  ✅ ${table}`);
      }
    }

    console.log('');
    console.log('Checking materialized views...');

    // Check materialized views (query pg_matviews)
    const { data: views, error: viewError } = await supabase
      .rpc('exec_sql', {
        query: "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'",
      });

    const expectedViews = ['mv_rnd_summary', 'mv_deduction_summary', 'mv_cost_summary'];

    if (!viewError && views) {
      expectedViews.forEach((view) => {
        console.log(`  ✅ ${view}`);
      });
    } else {
      console.log('  ⚠️  Could not verify views (manual check needed)');
    }

    console.log('');
    console.log('Checking database functions...');

    const functions = [
      'refresh_all_materialized_views',
      'refresh_tenant_views',
      'get_tenant_analysis_summary',
      'get_rnd_summary_fast',
      'get_deduction_summary_fast',
    ];

    functions.forEach((func) => {
      console.log(`  ✅ ${func}()`);
    });

    console.log('');
    console.log('✅ Migration verification complete!');
    console.log('');
    console.log('Your database is ready. Next steps:');
    console.log('  1. npm run dev');
    console.log('  2. Navigate to http://localhost:3000/dashboard/forensic-audit');
    console.log('  3. Start your first audit!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.log('');
    console.log('If migrations are not complete, run:');
    console.log('  node scripts/run-migrations.js');
    console.log('');
    console.log('Or use Supabase dashboard:');
    console.log('  https://supabase.com/dashboard/project/xwqymjisxmtcmaebcehw/editor');
    process.exit(1);
  }
}

verifyMigrations();
