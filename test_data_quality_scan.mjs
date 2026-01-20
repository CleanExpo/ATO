import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo'
);

async function checkStatus() {
  console.log('📊 Data Quality Scan Test\n');
  console.log('='.repeat(60));

  // 1. Check Xero connections
  console.log('\n1. Checking Xero connections...');
  const { data: connections, error: connError } = await supabase
    .from('xero_connections')
    .select('tenant_id, tenant_name, created_at');

  if (connError) {
    console.log('   ❌ Error:', connError.message);
    return;
  }

  if (!connections || connections.length === 0) {
    console.log('   ⚠️  No Xero connections found. Connect to Xero first.');
    return;
  }

  console.log(`   ✅ Found ${connections.length} connection(s):`);
  connections.forEach(conn => {
    const shortId = conn.tenant_id.substring(0, 8);
    console.log(`      - ${conn.tenant_name} (${shortId}...)`);
  });

  const tenantId = connections[0].tenant_id;

  // 2. Check cached transactions
  console.log('\n2. Checking cached historical data...');
  const { data: cache, error: cacheError } = await supabase
    .from('historical_transactions_cache')
    .select('financial_year, transaction_id')
    .eq('tenant_id', tenantId);

  if (cacheError) {
    console.log('   ❌ Error:', cacheError.message);
    return;
  }

  if (!cache || cache.length === 0) {
    console.log('   ⚠️  No cached data. Run historical sync first:');
    console.log('      POST /api/xero/sync-historical');
    return;
  }

  // Count by FY
  const fyCount = {};
  cache.forEach(t => {
    fyCount[t.financial_year] = (fyCount[t.financial_year] || 0) + 1;
  });

  console.log(`   ✅ Found ${cache.length} cached transactions:`);
  Object.entries(fyCount).sort().forEach(([fy, count]) => {
    console.log(`      ${fy}: ${count} transactions`);
  });

  // 3. Check data quality scan status
  console.log('\n3. Checking data quality scan status...');
  const { data: scanStatus, error: scanError } = await supabase
    .from('data_quality_scan_status')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (scanError) {
    console.log('   ❌ Error:', scanError.message);
  } else if (!scanStatus) {
    console.log('   ℹ️  No scan performed yet');
  } else {
    console.log(`   Status: ${scanStatus.scan_status}`);
    console.log(`   Progress: ${scanStatus.scan_progress || 0}%`);
    console.log(`   Transactions scanned: ${scanStatus.transactions_scanned || 0}`);
    console.log(`   Issues found: ${scanStatus.issues_found || 0}`);
    console.log(`   Auto-corrected: ${scanStatus.issues_auto_corrected || 0}`);
    console.log(`   Pending review: ${scanStatus.issues_pending_review || 0}`);
  }

  // 4. Check existing issues
  console.log('\n4. Checking existing data quality issues...');
  const { data: issues, error: issuesError } = await supabase
    .from('data_quality_issues')
    .select('issue_type, severity, status')
    .eq('tenant_id', tenantId);

  if (issuesError) {
    console.log('   ❌ Error:', issuesError.message);
  } else if (!issues || issues.length === 0) {
    console.log('   ✅ No existing issues found');
  } else {
    console.log(`   ℹ️  Found ${issues.length} existing issue(s):`);
    const byType = {};
    issues.forEach(i => {
      if (!byType[i.issue_type]) byType[i.issue_type] = 0;
      byType[i.issue_type]++;
    });
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`      ${type}: ${count}`);
    });
  }

  // 5. Next steps
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Next Steps:');
  if (cache && cache.length > 0) {
    console.log('   ✅ Ready to run data quality scan!');
    console.log('\n   Start scan with:');
    console.log(`   POST http://localhost:3001/api/data-quality/scan`);
    console.log('   Body: {');
    console.log(`     "tenantId": "${tenantId}",`);
    console.log(`     "financialYears": ${JSON.stringify(Object.keys(fyCount).sort())},`);
    console.log('     "autoFixThreshold": 90,');
    console.log('     "applyCorrections": false');
    console.log('   }');
    console.log('\n   Or visit: http://localhost:3001/dashboard/data-quality');
  } else {
    console.log('   1. Run historical sync first');
    console.log('   2. Then run data quality scan');
  }
}

checkStatus().catch(err => {
  console.error('❌ Fatal error:', err.message);
});
