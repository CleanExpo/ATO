#!/usr/bin/env ts-node
/**
 * Run database migration for work_queue table
 */

import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runMigration() {
  console.log('🔄 Running work_queue migration...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: 'public',
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  try {
    // Read migration file
    const migrationSQL = readFileSync(
      'supabase/migrations/20260129_create_work_queue.sql',
      'utf-8'
    );

    console.log('📄 Migration file loaded');
    console.log('📊 Executing SQL...\n');

    // Execute migration using RPC
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL,
    });

    if (error) {
      // If RPC doesn't exist, try direct execution (may not work due to permissions)
      console.log('⚠️  RPC method not available. Trying alternative approach...\n');

      // Split by statement and execute individually
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('CREATE TABLE') ||
            statement.includes('CREATE INDEX') ||
            statement.includes('CREATE OR REPLACE FUNCTION') ||
            statement.includes('ALTER TABLE')) {
          console.log(`Executing: ${statement.substring(0, 50)}...`);

          // This won't work with Supabase client - need direct postgres access
          console.log('❌ Direct SQL execution requires postgres CLI access\n');
          console.log('Please run migration manually:');
          console.log('1. Go to Supabase Dashboard > SQL Editor');
          console.log('2. Copy contents of supabase/migrations/20260129_create_work_queue.sql');
          console.log('3. Execute the SQL');
          console.log('\nOr use Supabase CLI: supabase db push\n');
          process.exit(1);
        }
      }
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
