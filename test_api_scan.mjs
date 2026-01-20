/**
 * Test data quality scan via HTTP API
 */

async function testScan() {
  const requestBody = {
    tenantId: '8a8caf6c-614b-45a5-9e15-46375122407c',
    financialYears: ['FY2024-25', 'FY2025-26'],
    autoFixThreshold: 90,
    applyCorrections: false // Don't auto-fix on first test run
  };

  console.log('🔍 Testing Data Quality Scan API');
  console.log('='.repeat(60));
  console.log('Endpoint: POST http://localhost:3003/api/data-quality/scan');
  console.log('Request:', JSON.stringify(requestBody, null, 2));
  console.log('');

  try {
    // Start scan
    console.log('📤 Starting scan...');
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
    console.log('Response:', JSON.stringify(result, null, 2));

    // Poll for status
    console.log('\n📊 Polling scan status...');
    const pollUrl = `http://localhost:3003/api/data-quality/scan?tenantId=${requestBody.tenantId}`;

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(pollUrl);
      if (!statusResponse.ok) {
        console.error(`❌ Status check failed: ${statusResponse.status}`);
        break;
      }

      const status = await statusResponse.json();
      const progress = status.progress || 0;

      console.log(`   ${status.status}: ${progress.toFixed(0)}% | ` +
                  `Scanned: ${status.transactionsScanned || 0} | ` +
                  `Issues: ${status.issuesFound || 0}`);

      if (status.status === 'complete') {
        console.log('\n' + '='.repeat(60));
        console.log('✅ SCAN COMPLETE!');
        console.log('='.repeat(60));
        console.log(`Transactions Scanned: ${status.transactionsScanned}`);
        console.log(`Issues Found: ${status.issuesFound}`);
        console.log(`Auto-Corrected: ${status.issuesAutoCorrected || 0}`);
        console.log(`Pending Review: ${status.issuesPendingReview || 0}`);

        if (status.issuesByType) {
          console.log('\n📋 Issues by Type:');
          Object.entries(status.issuesByType).forEach(([type, count]) => {
            if (count > 0) {
              console.log(`   ${type}: ${count}`);
            }
          });
        }

        console.log(`\nTotal Impact: $${(status.totalImpactAmount || 0).toLocaleString()}`);

        // Fetch actual issues
        console.log('\n📄 Fetching detailed issues...');
        const issuesResponse = await fetch(
          `http://localhost:3003/api/data-quality/issues?tenantId=${requestBody.tenantId}`
        );

        if (issuesResponse.ok) {
          const issuesData = await issuesResponse.json();
          console.log(`\nRetrieved ${issuesData.count} issue(s)`);

          if (issuesData.issues && issuesData.issues.length > 0) {
            console.log('\n🔝 Top 5 Issues:');
            issuesData.issues
              .sort((a, b) => b.confidence - a.confidence)
              .slice(0, 5)
              .forEach((issue, i) => {
                console.log(`\n   ${i + 1}. ${issue.issueType} (${issue.severity})`);
                console.log(`      Confidence: ${issue.confidence}%`);
                console.log(`      Status: ${issue.status}`);
                console.log(`      Impact: $${(issue.impactAmount || 0).toFixed(2)}`);
                if (issue.aiReasoning) {
                  const shortReason = issue.aiReasoning.substring(0, 80);
                  console.log(`      Reason: ${shortReason}...`);
                }
              });
          }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📱 View in dashboard:');
        console.log('   http://localhost:3003/dashboard/data-quality');
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
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testScan().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
