/**
 * Comprehensive Data Quality Scan Test
 * Tests AI-powered account classification and tax error detection
 */

async function runComprehensiveScan() {
  const requestBody = {
    tenantId: '8a8caf6c-614b-45a5-9e15-46375122407c',
    financialYears: ['FY2024-25', 'FY2025-26'],
    issueTypes: ['wrong_account', 'tax_classification', 'duplicate', 'unreconciled'],
    autoFixThreshold: 90,
    applyCorrections: false
  };

  console.log('🔍 COMPREHENSIVE DATA QUALITY SCAN');
  console.log('='.repeat(80));
  console.log('This scan will:');
  console.log('  ✓ Use AI to detect wrong account classifications');
  console.log('  ✓ Validate GST/tax codes');
  console.log('  ✓ Find duplicate transactions');
  console.log('  ✓ Identify unreconciled bank transactions');
  console.log('');
  console.log('⚠️  Note: This may take 10-15 minutes due to AI analysis');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Start scan
    console.log('📤 Starting comprehensive scan...');
    const response = await fetch('http://localhost:3003/api/data-quality/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ HTTP ${response.status}: ${text}`);
      return;
    }

    const result = await response.json();
    console.log('✅ Scan started successfully!');
    console.log(`Poll URL: ${result.pollUrl}`);
    console.log('');

    // Poll for status with detailed progress
    const pollUrl = `http://localhost:3003/api/data-quality/scan?tenantId=${requestBody.tenantId}`;
    let attempts = 0;
    const maxAttempts = 180; // 15 minutes max
    let lastProgress = -1;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(pollUrl);
      if (!statusResponse.ok) {
        console.error(`❌ Status check failed: ${statusResponse.status}`);
        break;
      }

      const status = await statusResponse.json();
      const progress = status.progress || 0;

      // Only log when progress changes
      if (Math.floor(progress / 5) !== Math.floor(lastProgress / 5)) {
        const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        console.log(`📊 [${bar}] ${progress.toFixed(0)}% | ` +
                    `Scanned: ${status.transactionsScanned || 0} | ` +
                    `Issues: ${status.issuesFound || 0}`);
        lastProgress = progress;
      }

      if (status.status === 'complete') {
        console.log('');
        console.log('='.repeat(80));
        console.log('✅ COMPREHENSIVE SCAN COMPLETE!');
        console.log('='.repeat(80));
        console.log('');

        // Summary statistics
        console.log('📈 SCAN STATISTICS');
        console.log('-'.repeat(80));
        console.log(`Total Transactions Scanned: ${status.transactionsScanned}`);
        console.log(`Total Issues Found: ${status.issuesFound}`);
        console.log(`Auto-Corrected (>= 90% confidence): ${status.issuesAutoCorrected || 0}`);
        console.log(`Pending Review (70-89% confidence): ${status.issuesPendingReview || 0}`);
        console.log(`Total Financial Impact: $${(status.totalImpactAmount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
        console.log('');

        // Issues by type
        if (status.issuesByType) {
          console.log('📋 ISSUES BY TYPE');
          console.log('-'.repeat(80));
          const types = {
            wrongAccount: 'Wrong Account Classifications (AI-detected)',
            taxClassification: 'Tax Classification Errors',
            duplicate: 'Duplicate Transactions',
            unreconciled: 'Unreconciled Bank Transactions',
            misallocated: 'Misallocated Payments'
          };

          Object.entries(types).forEach(([key, label]) => {
            const count = status.issuesByType[key] || 0;
            if (count > 0) {
              console.log(`  ${label.padEnd(45)} ${count.toString().padStart(4)}`);
            }
          });
        }
        console.log('');

        // Fetch detailed issues
        console.log('📄 Fetching detailed issue analysis...');
        const issuesResponse = await fetch(
          `http://localhost:3003/api/data-quality/issues?tenantId=${requestBody.tenantId}`
        );

        if (issuesResponse.ok) {
          const issuesData = await issuesResponse.json();
          console.log('');
          console.log('='.repeat(80));
          console.log('🔍 DETAILED ANALYSIS');
          console.log('='.repeat(80));

          // Group by issue type
          const byType = {};
          issuesData.issues.forEach(issue => {
            if (!byType[issue.issueType]) {
              byType[issue.issueType] = [];
            }
            byType[issue.issueType].push(issue);
          });

          // Show top issues per type
          Object.entries(byType).forEach(([type, issues]) => {
            console.log('');
            console.log(`\n📌 ${type.toUpperCase()} (${issues.length} issues found)`);
            console.log('-'.repeat(80));

            // Sort by confidence desc
            const topIssues = issues
              .sort((a, b) => b.confidence - a.confidence)
              .slice(0, 3);

            topIssues.forEach((issue, i) => {
              console.log(`\n  ${i + 1}. Transaction: ${issue.transactionId}`);
              console.log(`     Severity: ${issue.severity.toUpperCase()} | Confidence: ${issue.confidence}%`);
              console.log(`     Financial Impact: $${(issue.impactAmount || 0).toFixed(2)}`);

              if (type === 'wrong_account') {
                console.log(`     Current Account: ${issue.currentState?.accountCode} - ${issue.currentState?.accountName}`);
                console.log(`     Suggested Fix: ${issue.suggestedFix?.accountCode} - ${issue.suggestedFix?.accountName}`);
              }

              if (issue.aiReasoning) {
                const shortReason = issue.aiReasoning.substring(0, 150);
                console.log(`     AI Analysis: ${shortReason}${issue.aiReasoning.length > 150 ? '...' : ''}`);
              }
            });

            if (issues.length > 3) {
              console.log(`\n     ... and ${issues.length - 3} more issues of this type`);
            }
          });
        }

        console.log('');
        console.log('='.repeat(80));
        console.log('📱 NEXT STEPS');
        console.log('='.repeat(80));
        console.log('1. Review issues in dashboard:');
        console.log('   http://localhost:3003/dashboard/data-quality');
        console.log('');
        console.log('2. High-confidence issues (>=90%) can be auto-corrected');
        console.log('3. Medium-confidence issues (70-89%) need manual review');
        console.log('4. All corrections are reversible via audit log');
        console.log('');
        console.log('='.repeat(80));
        break;
      }

      if (status.status === 'error') {
        console.error(`\n❌ Scan failed: ${status.errorMessage || 'Unknown error'}`);
        break;
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.log('\n⏱️  Timeout reached. Scan may still be running.');
      console.log('   Check status: ' + pollUrl);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

console.log('');
runComprehensiveScan().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
