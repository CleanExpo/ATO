const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo'
);

async function checkStatus() {
  console.log('📊 Checking Xero data cache status...\n');
  
  // Check if tables exist
  const { data: tables, error: tablesError } = await supabase
    .from('historical_transactions_cache')
    .select('tenant_id, financial_year, count', { count: 'exact', head: true });
  
  if (tablesError) {
    console.log('❌ Error accessing cache:', tablesError.message);
    return;
  }
  
  // Get cached transactions grouped by tenant and FY
  const { data: cache, error: cacheError } = await supabase
    .from('historical_transactions_cache')
    .select('tenant_id, financial_year');
  
  if (cacheError) {
    console.log('❌ Error querying cache:', cacheError.message);
    return;
  }
  
  if (!cache || cache.length === 0) {
    console.log('⚠️  No cached historical data found.');
    console.log('   Run historical sync first: POST /api/xero/sync-historical');
    return;
  }
  
  // Group by tenant and FY
  const summary = {};
  cache.forEach(row => {
    if (!summary[row.tenant_id]) summary[row.tenant_id] = {};
    if (!summary[row.tenant_id][row.financial_year]) {
      summary[row.tenant_id][row.financial_year] = 0;
    }
    summary[row.tenant_id][row.financial_year]++;
  });
  
  console.log('✅ Cached data found:');
  for (const [tenantId, years] of Object.entries(summary)) {
    console.log(`\n  Tenant: ${tenantId}`);
    for (const [year, count] of Object.entries(years)) {
      console.log(`    ${year}: ${count} transactions`);
    }
  }
  
  // Check if data quality tables exist
  console.log('\n📋 Checking data quality tables...');
  const { data: dqIssues, error: dqError } = await supabase
    .from('data_quality_issues')
    .select('count', { count: 'exact', head: true });
  
  if (dqError) {
    console.log('❌ Data quality tables not found. Run migration 014 first.');
  } else {
    console.log('✅ Data quality tables ready');
  }
}

checkStatus().catch(console.error);
