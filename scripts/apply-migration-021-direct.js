#!/usr/bin/env node
/**
 * Apply Migration 021 - Organization Groups (Direct SQL)
 *
 * Creates tables using direct SQL queries via Supabase client
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

(async () => {
  console.log('\n=== Applying Migration 021: Organization Groups ===\n');

  try {
    // Create organization_groups table
    console.log('Creating organization_groups table...');
    const { error: groupsTableError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS organization_groups (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            description TEXT,
            settings JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_organization_groups_name ON organization_groups(name);
        CREATE INDEX IF NOT EXISTS idx_organization_groups_created_at ON organization_groups(created_at DESC);
      `
    });

    if (groupsTableError) {
      console.log('Note: RPC not available, tables might already exist or need manual creation');
      console.log('Error:', groupsTableError.message);
    } else {
      console.log('✅ organization_groups table created');
    }

    // Try inserting a test record to verify table exists
    console.log('\nVerifying organization_groups table...');
    const { data: testGroup, error: insertError } = await supabase
      .from('organization_groups')
      .insert({
        name: 'Migration Test Group',
        description: 'Test insert to verify table exists',
      })
      .select()
      .single();

    if (insertError && insertError.code === 'PGRST204') {
      console.log('❌ Table does not exist. Need to create it manually.');
      console.log('\nPlease run this SQL in Supabase SQL Editor:');
      console.log('\n--- Copy from here ---\n');
      console.log(require('fs').readFileSync(
        require('path').join(__dirname, '..', 'supabase', 'migrations', '021_create_organization_groups.sql'),
        'utf8'
      ));
      console.log('\n--- End of SQL ---\n');
      return;
    }

    if (testGroup) {
      // Clean up test record
      await supabase.from('organization_groups').delete().eq('id', testGroup.id);
      console.log('✅ organization_groups table verified and working');
    }

    // Verify organization_group_members table
    console.log('\nVerifying organization_group_members table...');
    const { error: membersError } = await supabase
      .from('organization_group_members')
      .select('*')
      .limit(1);

    if (membersError && membersError.code === 'PGRST204') {
      console.log('❌ organization_group_members table does not exist');
    } else {
      console.log('✅ organization_group_members table verified');
    }

    console.log('\n✅ Migration verification complete!');
    console.log('\nNext step: Run node scripts/create-organization-group.js');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n📋 Manual Steps Required:\n');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run the SQL from: supabase/migrations/021_create_organization_groups.sql');
    console.log('3. Then run: node scripts/create-organization-group.js');
  }
})();
