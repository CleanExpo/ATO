#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('\n=== Checking organizations table schema ===\n');

  // Query information_schema to get actual columns
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error querying organizations:', error);
  } else {
    console.log('Query succeeded. Table exists.');
    console.log('Sample data (0 rows expected):', data);
  }

  // Try to insert a minimal organization
  console.log('\n=== Testing minimal insert ===\n');
  const { data: insertData, error: insertError } = await supabase
    .from('organizations')
    .insert({
      name: 'Test Organization',
      xero_tenant_id: 'test-' + Date.now(),
    })
    .select();

  if (insertError) {
    console.error('Insert error:', insertError.message);
    console.error('Details:', insertError);
  } else {
    console.log('✅ Insert succeeded!');
    console.log('Created organization:', insertData);

    // Clean up
    if (insertData && insertData[0]) {
      await supabase
        .from('organizations')
        .delete()
        .eq('id', insertData[0].id);
      console.log('Cleaned up test record');
    }
  }
})();
