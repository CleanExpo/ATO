/**
 * Direct test of data quality scanner
 * Bypasses HTTP API to avoid Next.js cache issues
 */

import { scanForDataQualityIssues } from './lib/xero/data-quality-validator.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo'
);

async function testScan() {
  const tenantId = '8a8caf6c-614b-45a5-9e15-46375122407c';
  const financialYears = ['FY2024-25', 'FY2025-26'];

  console.log('🔍 Starting Data Quality Scan Test');
  console.log('='.repeat(60));
  console.log(`Tenant: ${tenantId}`);
  console.log(`Financial Years: ${financialYears.join(', ')}`);
  console.log('');

  try {
    // Fetch sample of cached transactions to scan
    console.log('📦 Fetching cached transactions...');
    const { data: transactions, error } = await supabase
      .from('historical_transactions_cache')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('financial_year', financialYears)
      .limit(50); // Test with first 50 transactions

    if (error) {
      console.error('❌ Error fetching transactions:', error.message);
      return;
    }

    if (!transactions || transactions.length === 0) {
      console.log('⚠️  No transactions found to scan');
      return;
    }

    console.log(`✅ Found ${transactions.length} transactions to scan\n`);

    // Run scan
    console.log('🔬 Running data quality analysis...');
    console.log('   Checking for:');
    console.log('   - Wrong account classifications');
    console.log('   - Tax classification errors');
    console.log('   - Duplicate transactions');
    console.log('   - Unreconciled bank transactions\n');

    const result = await scanForDataQualityIssues({
      tenantId,
      financialYears,
      issueTypes: ['wrong_account', 'tax_classification', 'duplicate', 'unreconciled'],
      autoFixThreshold: 90,
      onProgress: (progress, message) => {
        console.log(`   Progress: ${progress.toFixed(0)}% - ${message}`);
      }
    });

    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('📊 SCAN RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Transactions Scanned: ${result.transactionsScanned}`);
    console.log(`Issues Found: ${result.issuesFound}`);
    console.log(`High Confidence (>= 90%): ${result.highConfidenceCount}`);
    console.log(`Medium Confidence (70-89%): ${result.mediumConfidenceCount}`);
    console.log(`Low Confidence (< 70%): ${result.lowConfidenceCount}`);

    if (result.issues && result.issues.length > 0) {
      console.log('\n📋 Issues by Type:');
      const byType = {};
      result.issues.forEach(issue => {
        if (!byType[issue.issueType]) {
          byType[issue.issueType] = { count: 0, total: 0 };
        }
        byType[issue.issueType].count++;
        byType[issue.issueType].total += issue.impactAmount || 0;
      });

      Object.entries(byType).forEach(([type, stats]) => {
        console.log(`   ${type}: ${stats.count} issues ($${stats.total.toFixed(2)} impact)`);
      });

      console.log('\n🔝 Top 5 Issues:');
      result.issues
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .forEach((issue, i) => {
          console.log(`\n   ${i + 1}. ${issue.issueType} (${issue.severity})`);
          console.log(`      Confidence: ${issue.confidence}%`);
          console.log(`      Impact: $${(issue.impactAmount || 0).toFixed(2)}`);
          console.log(`      Transaction: ${issue.transactionId}`);
          if (issue.aiReasoning) {
            console.log(`      Reason: ${issue.aiReasoning.substring(0, 100)}...`);
          }
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Scan complete!');
    console.log('\nNext steps:');
    console.log('  1. Review issues in dashboard: http://localhost:3001/dashboard/data-quality');
    console.log('  2. Approve high-confidence corrections');
    console.log('  3. Review medium-confidence issues manually');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
  }
}

testScan().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
