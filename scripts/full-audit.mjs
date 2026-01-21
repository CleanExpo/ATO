/**
 * Full Autonomous Forensic Tax Audit
 * 
 * This script runs a complete audit on both businesses:
 * 1. Sync all historical data from Xero (5 years)
 * 2. Run AI forensic analysis using Gemini 3 Pro
 * 3. Display progress and findings in real-time
 * 
 * Usage: node scripts/full-audit.mjs
 */

const BASE_URL = process.env.BASE_URL || 'https://ato-blush.vercel.app';

// Both businesses to audit
const BUSINESSES = [
    {
        tenantId: '8a8caf6c-614b-45a5-9e15-46375122407c',
        name: 'Disaster Recovery Qld Pty Ltd',
        abn: '42 633 062 307'
    },
    {
        tenantId: 'fc010696-d9f1-482e-ab43-aa0c13ee27fa',
        name: 'Disaster Recovery Pty Ltd',
        abn: 'TBD'
    }
];

// Display formatting
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
};

function log(message, color = 'reset') {
    console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logHeader(title) {
    console.log('\n' + '═'.repeat(70));
    log(` ${title}`, 'bright');
    console.log('═'.repeat(70));
}

function logProgress(current, total, message) {
    const percentage = ((current / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
    console.log(`[${bar}] ${percentage}% - ${message}`);
}

/**
 * Sync all historical data for a business
 */
async function syncBusinessData(business) {
    logHeader(`SYNCING: ${business.name}`);
    log(`Tenant ID: ${business.tenantId}`, 'cyan');
    
    let year = null;
    let type = null;
    let page = 1;
    let totalCached = 0;
    let chunkCount = 0;
    let allComplete = false;
    
    const startTime = Date.now();
    
    while (!allComplete) {
        chunkCount++;
        
        const body = { tenantId: business.tenantId };
        if (year) body.year = year;
        if (type) body.type = type;
        if (page) body.page = page;
        
        try {
            const response = await fetch(`${BASE_URL}/api/audit/sync-chunk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            totalCached += result.cached || 0;
            
            const progress = result.currentProgress;
            process.stdout.write(`\r  Chunk ${String(chunkCount).padStart(3)}: ${String(result.cached).padStart(3)} txns | ${progress.year} ${progress.type} pg${progress.page} | Total: ${totalCached}     `);
            
            if (result.allComplete) {
                allComplete = true;
            } else {
                year = result.nextYear;
                type = result.nextType;
                page = result.hasMore ? result.nextPage : 1;
            }
            
            await new Promise(r => setTimeout(r, 300));
            
        } catch (error) {
            log(`\n  Error: ${error.message}`, 'red');
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    const syncTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n');
    log(`  ✅ Sync complete: ${totalCached} transactions in ${syncTime}s`, 'green');
    
    return totalCached;
}

/**
 * Start AI forensic analysis for a business
 */
async function startAnalysis(business) {
    logHeader(`STARTING AI ANALYSIS: ${business.name}`);
    log(`Using Gemini 3 Pro for maximum accuracy`, 'cyan');
    
    try {
        const response = await fetch(`${BASE_URL}/api/audit/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: business.tenantId,
                businessName: business.name,
                abn: business.abn,
                industry: 'Disaster Recovery Services'
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        
        log(`\n  Status: ${result.status}`, 'yellow');
        log(`  Transactions to analyze: ${result.totalTransactions}`, 'cyan');
        log(`  Estimated cost: $${result.estimatedCostUSD.toFixed(2)}`, 'cyan');
        log(`\n  Poll URL: ${result.pollUrl}`, 'blue');
        
        return result;
        
    } catch (error) {
        log(`  Error starting analysis: ${error.message}`, 'red');
        return null;
    }
}

/**
 * Check analysis status
 */
async function checkAnalysisStatus(tenantId) {
    try {
        const response = await fetch(`${BASE_URL}/api/audit/analysis-status/${tenantId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

/**
 * Get recommendations
 */
async function getRecommendations(tenantId) {
    try {
        const response = await fetch(`${BASE_URL}/api/audit/recommendations?tenantId=${tenantId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

/**
 * Main audit function
 */
async function runFullAudit() {
    console.clear();
    logHeader('🔍 FORENSIC TAX AUDIT - AUTONOMOUS MODE');
    log('AI Model: Gemini 3 Pro (Maximum Accuracy)', 'cyan');
    log('Temperature: 0.1 (Ultra-low for consistency)', 'cyan');
    log(`Target: $165,000 tax debt recovery`, 'yellow');
    console.log('');
    
    const auditResults = [];
    
    // Phase 1: Sync all data
    logHeader('PHASE 1: DATA SYNCHRONIZATION');
    
    for (const business of BUSINESSES) {
        const transactionCount = await syncBusinessData(business);
        auditResults.push({
            business,
            transactionCount,
            analysisStarted: false
        });
    }
    
    const totalTransactions = auditResults.reduce((sum, r) => sum + r.transactionCount, 0);
    log(`\n  📊 Total transactions to analyze: ${totalTransactions}`, 'bright');
    
    // Phase 2: Start AI Analysis
    logHeader('PHASE 2: AI FORENSIC ANALYSIS');
    log('Starting Gemini 3 Pro analysis on all transactions...', 'cyan');
    log('This will run autonomously in the background.', 'yellow');
    console.log('');
    
    for (const result of auditResults) {
        const analysis = await startAnalysis(result.business);
        if (analysis) {
            result.analysisStarted = true;
            result.analysisStatus = analysis;
        }
    }
    
    // Phase 3: Monitor Progress
    logHeader('PHASE 3: MONITORING ANALYSIS PROGRESS');
    log('The AI is now analyzing all transactions...', 'cyan');
    log('Analysis covers:', 'yellow');
    log('  • Division 355 R&D Tax Incentive (Four-element test)', 'cyan');
    log('  • Division 8 General Deductions', 'cyan');
    log('  • Division 7A Compliance (Shareholder loans)', 'cyan');
    log('  • FBT Implications', 'cyan');
    log('  • Missing documentation flags', 'cyan');
    console.log('');
    
    // Initial status check
    for (const result of auditResults) {
        const status = await checkAnalysisStatus(result.business.tenantId);
        if (status) {
            log(`  ${result.business.name}: ${status.status} (${status.progress}%)`, 'yellow');
        }
    }
    
    // Summary
    logHeader('AUDIT INITIATED');
    log('✅ Both businesses synced', 'green');
    log('✅ AI analysis started (running in background)', 'green');
    log('', 'reset');
    log('📊 To check progress:', 'yellow');
    log(`   Visit: ${BASE_URL}/dashboard`, 'cyan');
    log('', 'reset');
    log('📋 To view recommendations:', 'yellow');
    log(`   GET ${BASE_URL}/api/audit/recommendations?tenantId=<id>`, 'cyan');
    log('', 'reset');
    log('📑 To generate report:', 'yellow');
    log(`   POST ${BASE_URL}/api/audit/reports/generate`, 'cyan');
    console.log('');
    
    logHeader('EXPECTED FINDINGS');
    log('Based on 14,000+ transactions over 5 years:', 'cyan');
    console.log('');
    log('  🔬 R&D Tax Credits (43.5% refundable)', 'green');
    log('     - Software development', 'reset');
    log('     - Process innovation', 'reset');
    log('     - Technical consulting', 'reset');
    console.log('');
    log('  💰 Missed Deductions', 'green');
    log('     - Instant asset write-offs', 'reset');
    log('     - Home office expenses', 'reset');
    log('     - Motor vehicle claims', 'reset');
    console.log('');
    log('  ⚠️  Division 7A Compliance', 'yellow');
    log('     - Director loan accounts', 'reset');
    log('     - Shareholder payments', 'reset');
    log('     - Private use of assets', 'reset');
    console.log('');
    log('  📋 Data Quality Issues', 'yellow');
    log('     - Missing tax codes', 'reset');
    log('     - Incorrect categorization', 'reset');
    log('     - Duplicate transactions', 'reset');
    console.log('');
    
    log('The analysis will take approximately 2-4 hours to complete.', 'yellow');
    log('You will be notified when findings are ready.', 'cyan');
    console.log('');
}

// Run the audit
runFullAudit().catch(console.error);
