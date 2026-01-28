/**
 * Run Forensic Tax Analysis - PARALLEL PROCESSING
 * 
 * Runs multiple concurrent analysis requests to speed up processing.
 * 
 * Usage: node scripts/run-analysis-parallel.mjs
 */

const BASE_URL = process.env.BASE_URL || 'https://ato-blush.vercel.app';
const PARALLEL_REQUESTS = 3; // Reduced for rate limits (Gemini free tier: 15 RPM)

const BUSINESSES = [
    {
        tenantId: '8a8caf6c-614b-45a5-9e15-46375122407c',
        name: 'Disaster Recovery Qld Pty Ltd',
        abn: '42 633 062 307',
        industry: 'Disaster Recovery Services'
    },
    {
        tenantId: 'fc010696-d9f1-482e-ab43-aa0c13ee27fa',
        name: 'Disaster Recovery Pty Ltd',
        abn: 'TBD',
        industry: 'Disaster Recovery Services'
    }
];

// Tracking
let totalAnalyzed = 0;
let rndCandidates = 0;
let division7aRisks = 0;
let fbtImplications = 0;
let errors = 0;

async function analyzeOne(business) {
    try {
        const response = await fetch(`${BASE_URL}/api/audit/analyze-chunk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: business.tenantId,
                businessName: business.name,
                abn: business.abn,
                industry: business.industry
            })
        });
        
        if (!response.ok) {
            errors++;
            return { error: true, status: response.status };
        }
        
        const result = await response.json();
        
        if (result.allComplete) {
            return { allComplete: true };
        }
        
        totalAnalyzed++;
        if (result.analysis?.isRndCandidate) rndCandidates++;
        if (result.analysis?.division7aRisk) division7aRisks++;
        if (result.analysis?.fbtImplications) fbtImplications++;
        
        return result;
    } catch (error) {
        errors++;
        return { error: true, message: error.message };
    }
}

async function analyzeBusinessParallel(business) {
    console.log('\n' + '═'.repeat(70));
    console.log(`🚀 PARALLEL ANALYSIS: ${business.name}`);
    console.log(`   Concurrent Requests: ${PARALLEL_REQUESTS}`);
    console.log('═'.repeat(70));
    
    let allComplete = false;
    const startTime = Date.now();
    let lastProgress = null;
    
    while (!allComplete) {
        // Launch parallel requests
        const promises = Array(PARALLEL_REQUESTS).fill().map(() => analyzeOne(business));
        const results = await Promise.all(promises);
        
        // Check if complete
        if (results.some(r => r.allComplete)) {
            allComplete = true;
            continue;
        }
        
        // Get progress from last successful result
        const successfulResult = results.find(r => r.progress);
        if (successfulResult) {
            lastProgress = successfulResult.progress;
            const pct = lastProgress.percentComplete;
            const remaining = lastProgress.remaining;
            const txn = successfulResult.transactionAnalyzed;
            
            process.stdout.write(`\r  [${pct}%] Analyzed: ${lastProgress.analyzed} | Remaining: ${remaining} | R&D: ${rndCandidates} | Errors: ${errors}     `);
        }
        
        // Small delay between batches
        await new Promise(r => setTimeout(r, 500));
    }
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n\n✅ COMPLETE for ${business.name} in ${elapsed} minutes`);
}

async function runParallelAnalysis() {
    console.clear();
    console.log('═'.repeat(70));
    console.log('🚀 FORENSIC TAX AUDIT - PARALLEL PROCESSING');
    console.log('═'.repeat(70));
    console.log(`Concurrent Requests: ${PARALLEL_REQUESTS}`);
    console.log('Model: Gemini 2.0 Flash Exp');
    console.log('Target: $165,000 tax debt recovery');
    console.log('');
    
    const startTime = Date.now();
    
    for (const business of BUSINESSES) {
        await analyzeBusinessParallel(business);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '═'.repeat(70));
    console.log('📊 ANALYSIS COMPLETE');
    console.log('═'.repeat(70));
    console.log(`Total Analyzed: ${totalAnalyzed}`);
    console.log(`Total Time: ${totalTime} minutes`);
    console.log(`R&D Candidates: ${rndCandidates}`);
    console.log(`Division 7A Risks: ${division7aRisks}`);
    console.log(`FBT Implications: ${fbtImplications}`);
    console.log(`Errors (retried): ${errors}`);
    console.log('\n🎯 Visit: https://ato-blush.vercel.app/dashboard');
}

runParallelAnalysis().catch(console.error);
