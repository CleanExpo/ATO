/**
 * Test Analysis Runner
 * Runs a complete forensic analysis with real Xero data
 */

const BASE_URL = 'http://localhost:3000';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkHealth() {
    console.log('🔍 Checking system health...\n');
    try {
        const response = await fetch(`${BASE_URL}/api/health`);
        const data = await response.json();

        console.log('Health Status:', data.status);
        console.log('- Environment:', data.checks.environment?.status);
        console.log('- Database:', data.checks.database?.status);
        console.log('- AI Model:', data.checks.aiModel?.status);
        if (data.checks.aiModel?.modelName) {
            console.log('  Model:', data.checks.aiModel.modelName);
        }
        console.log('');

        return data.status === 'healthy';
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        return false;
    }
}

async function getTenantId() {
    console.log('🔍 Getting Xero tenant ID...\n');
    try {
        const response = await fetch(`${BASE_URL}/api/xero/organizations`);
        const data = await response.json();

        if (data.error) {
            console.error('❌ Error:', data.error);
            return null;
        }

        if (data.organisations && data.organisations.length > 0) {
            const org = data.organisations[0];
            console.log('✅ Connected to:', org.name);
            console.log('   Tenant ID:', org.tenantId);
            console.log('');
            return org.tenantId;
        }

        console.error('❌ No Xero organizations found');
        return null;
    } catch (error) {
        console.error('❌ Failed to get tenant ID:', error.message);
        return null;
    }
}

async function startHistoricalSync(tenantId) {
    console.log('🔄 Starting 5-year historical sync...\n');
    try {
        const response = await fetch(`${BASE_URL}/api/audit/sync-historical`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, years: 5 })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Sync failed:', data.error || data.message);
            return false;
        }

        console.log('✅ Historical sync started');
        console.log('');
        return true;
    } catch (error) {
        console.error('❌ Failed to start sync:', error.message);
        return false;
    }
}

async function waitForSync(tenantId) {
    console.log('⏳ Waiting for sync to complete...\n');

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(`${BASE_URL}/api/audit/sync-status/${tenantId}`);
            const data = await response.json();

            const status = data.syncStatus?.status || data.status;
            const progress = data.syncStatus?.progress || data.progress || 0;
            const synced = data.syncStatus?.transactionsSynced || data.transactionsSynced || 0;
            const total = data.syncStatus?.totalTransactions || data.totalTransactions || 0;

            console.log(`  Status: ${status} | Progress: ${progress.toFixed(1)}% | Transactions: ${synced}/${total}`);

            if (status === 'complete') {
                console.log('\n✅ Sync complete!');
                console.log(`   Total transactions synced: ${synced}\n`);
                return true;
            }

            if (status === 'error') {
                console.error('\n❌ Sync failed with error');
                return false;
            }

            await sleep(5000); // Check every 5 seconds
            attempts++;
        } catch (error) {
            console.error('❌ Error checking sync status:', error.message);
            return false;
        }
    }

    console.error('\n❌ Sync timeout (5 minutes)');
    return false;
}

async function startAnalysis(tenantId) {
    console.log('🧠 Starting AI forensic analysis...\n');
    try {
        const response = await fetch(`${BASE_URL}/api/audit/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Analysis failed:', data.error || data.message);
            return false;
        }

        console.log('✅ AI analysis started');
        console.log('   Using model: gemini-2.0-flash-exp (FREE)');
        console.log('');
        return true;
    } catch (error) {
        console.error('❌ Failed to start analysis:', error.message);
        return false;
    }
}

async function waitForAnalysis(tenantId) {
    console.log('⏳ Waiting for analysis to complete...\n');

    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(`${BASE_URL}/api/audit/analysis-status/${tenantId}`);
            const data = await response.json();

            const status = data.analysisStatus?.status || data.status;
            const progress = data.analysisStatus?.progress || data.progress || 0;
            const analyzed = data.analysisStatus?.transactionsAnalyzed || data.transactionsAnalyzed || 0;
            const total = data.analysisStatus?.totalTransactions || data.totalTransactions || 0;

            console.log(`  Status: ${status} | Progress: ${progress.toFixed(1)}% | Analyzed: ${analyzed}/${total}`);

            if (status === 'complete') {
                console.log('\n✅ Analysis complete!');
                console.log(`   Total transactions analyzed: ${analyzed}\n`);
                return true;
            }

            if (status === 'error') {
                console.error('\n❌ Analysis failed with error');
                return false;
            }

            await sleep(5000); // Check every 5 seconds
            attempts++;
        } catch (error) {
            console.error('❌ Error checking analysis status:', error.message);
            return false;
        }
    }

    console.error('\n❌ Analysis timeout (10 minutes)');
    return false;
}

async function getResults(tenantId) {
    console.log('📊 Fetching analysis results...\n');
    try {
        const response = await fetch(`${BASE_URL}/api/audit/recommendations?tenantId=${tenantId}`);
        const data = await response.json();

        if (data.summary) {
            console.log('═══════════════════════════════════════════════════════');
            console.log('                    RESULTS SUMMARY');
            console.log('═══════════════════════════════════════════════════════\n');

            console.log(`💰 Total Tax Opportunity: $${data.summary.totalAdjustedBenefit.toLocaleString()}`);
            console.log('');

            console.log('By Tax Area:');
            console.log(`  🧪 R&D Tax Incentive:  $${data.summary.byTaxArea.rnd.toLocaleString()}`);
            console.log(`  📉 Deductions:         $${data.summary.byTaxArea.deductions.toLocaleString()}`);
            console.log(`  💸 Losses:             $${data.summary.byTaxArea.losses.toLocaleString()}`);
            console.log(`  🏦 Div 7A:             $${data.summary.byTaxArea.div7a.toLocaleString()}`);
            console.log('');

            console.log('By Priority:');
            console.log(`  🔴 Critical: ${data.summary.byPriority.critical}`);
            console.log(`  🟠 High:     ${data.summary.byPriority.high}`);
            console.log(`  🟡 Medium:   ${data.summary.byPriority.medium}`);
            console.log(`  🟢 Low:      ${data.summary.byPriority.low}`);
            console.log('');

            if (data.summary.criticalRecommendations?.length > 0) {
                console.log('Critical Recommendations:');
                data.summary.criticalRecommendations.forEach((rec, i) => {
                    console.log(`  ${i + 1}. ${rec.action} - $${rec.adjustedBenefit.toLocaleString()}`);
                });
                console.log('');
            }

            console.log('═══════════════════════════════════════════════════════\n');
        }

        // Get R&D candidates count
        const analysisResponse = await fetch(`${BASE_URL}/api/audit/analysis-results?tenantId=${tenantId}&isRndCandidate=true`);
        const analysisData = await analysisResponse.json();

        if (analysisData.results) {
            console.log(`🧪 R&D Candidates Found: ${analysisData.results.length} transactions`);
            console.log('');

            if (analysisData.results.length > 0) {
                console.log('Sample R&D Candidates:');
                analysisData.results.slice(0, 5).forEach((result, i) => {
                    console.log(`  ${i + 1}. ${result.primary_category} - Confidence: ${result.rnd_confidence}%`);
                });
                console.log('');
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to get results:', error.message);
        return false;
    }
}

// Main execution
async function main() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║       ATO TAX FORENSIC ANALYSIS - TEST RUN           ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    // Step 1: Health check
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        console.error('❌ System is not healthy. Aborting test.\n');
        process.exit(1);
    }

    // Step 2: Get tenant ID
    const tenantId = await getTenantId();
    if (!tenantId) {
        console.error('❌ Could not get Xero tenant ID. Make sure you are connected to Xero.\n');
        console.log('💡 Visit: http://localhost:3000/api/auth/xero to connect\n');
        process.exit(1);
    }

    // Step 3: Start historical sync
    const syncStarted = await startHistoricalSync(tenantId);
    if (!syncStarted) {
        console.error('❌ Failed to start historical sync\n');
        process.exit(1);
    }

    // Step 4: Wait for sync
    const syncCompleted = await waitForSync(tenantId);
    if (!syncCompleted) {
        console.error('❌ Historical sync did not complete successfully\n');
        process.exit(1);
    }

    // Step 5: Start AI analysis
    const analysisStarted = await startAnalysis(tenantId);
    if (!analysisStarted) {
        console.error('❌ Failed to start AI analysis\n');
        process.exit(1);
    }

    // Step 6: Wait for analysis
    const analysisCompleted = await waitForAnalysis(tenantId);
    if (!analysisCompleted) {
        console.error('❌ AI analysis did not complete successfully\n');
        process.exit(1);
    }

    // Step 7: Get and display results
    await getResults(tenantId);

    console.log('✅ Test analysis complete!\n');
    console.log('📊 View full results: http://localhost:3000/dashboard/forensic-audit\n');
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
