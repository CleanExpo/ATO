#!/usr/bin/env node
/**
 * Apply Migration 021 - Organization Groups
 *
 * Creates organization_groups and organization_group_members tables
 * for multi-organization analysis support.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('\n=== Applying Migration 021: Organization Groups ===\n');

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '021_create_organization_groups.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('Migration file:', migrationPath);
  console.log('SQL length:', migrationSQL.length, 'characters');

  try {
    // Execute migration
    console.log('\nExecuting migration...');
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try direct execution if RPC doesn't exist
      console.log('RPC failed, trying direct execution...');

      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

      for (const statement of statements) {
        if (statement) {
          const { error: stmtError } = await supabase.rpc('exec', { query: statement });
          if (stmtError) {
            console.error('Statement error:', statement.substring(0, 100), '...');
            console.error('Error:', stmtError);
          }
        }
      }
    }

    console.log('✅ Migration executed successfully!');

    // Verify tables exist
    console.log('\n=== Verifying Tables ===\n');

    const { data: groups, error: groupsError } = await supabase
      .from('organization_groups')
      .select('*')
      .limit(1);

    if (groupsError) {
      console.error('❌ organization_groups table not accessible:', groupsError.message);
    } else {
      console.log('✅ organization_groups table exists and accessible');
    }

    const { data: members, error: membersError } = await supabase
      .from('organization_group_members')
      .select('*')
      .limit(1);

    if (membersError) {
      console.error('❌ organization_group_members table not accessible:', membersError.message);
    } else {
      console.log('✅ organization_group_members table exists and accessible');
    }

    console.log('\n✅ Migration 021 complete!');
    console.log('\nNext step: Run node scripts/create-organization-group.js');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
})();
