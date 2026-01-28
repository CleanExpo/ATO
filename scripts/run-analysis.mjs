/**
 * Run Forensic Tax Analysis
 * 
 * This script runs the AI forensic analysis on all transactions.
 * It calls the analyze-chunk endpoint repeatedly until complete.
 * 
 * Usage: node scripts/run-analysis.mjs
 */

const BASE_URL = process.env.BASE_URL || 'https://ato-blush.vercel.app';

// Both businesses
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
let notDeductible = 0;

async function analyzeOneBusiness(business) {
    console.log('\n' + '═'.repeat(70));
    console.log(`🔍 ANALYZING: ${business.name}`);
    console.log('═'.repeat(70));
    
    let allComplete = false;
    let batchCount = 0;
    const startTime = Date.now();
    
    while (!allComplete) {
        batchCount++;
        
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
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.allComplete) {
                allComplete = true;
                console.log(`\n✅ ANALYSIS COMPLETE for ${business.name}`);
                continue;
            }
            
            // Track findings
            totalAnalyzed++;
            if (result.analysis.isRndCandidate) rndCandidates++;
            if (result.analysis.division7aRisk) division7aRisks++;
            if (result.analysis.fbtImplications) fbtImplications++;
            if (!result.analysis.isFullyDeductible) notDeductible++;
            
            // Progress display
            const pct = result.progress.percentComplete;
            const remaining = result.progress.remaining;
            const txn = result.transactionAnalyzed;
            
            process.stdout.write(`\r  [${pct}%] ${txn.description?.slice(0, 40).padEnd(40)} | $${txn.amount.toFixed(0).padStart(8)} | R&D:${result.analysis.isRndCandidate ? '✓' : '✗'} Div7A:${result.analysis.division7aRisk ? '⚠' : '✓'} | ${remaining} left     `);
            
            // Small delay
            await new Promise(r => setTimeout(r, 100));
            
        } catch (error) {
            console.error(`\n  Error: ${error.message}`);
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n  Time: ${elapsed} minutes`);
}

async function runFullAnalysis() {
    console.clear();
    console.log('═'.repeat(70));
    console.log('🔍 FORENSIC TAX AUDIT - AI ANALYSIS');
    console.log('═'.repeat(70));
    console.log('Model: Gemini 2.0 Flash Exp (FREE)');
    console.log('Temperature: 0.1 (Maximum Accuracy)');
    console.log(`Target: $165,000 tax debt recovery`);
    console.log('');
    console.log('Analysis includes:');
    console.log('  • Division 355 R&D Tax Incentive (43.5% refundable)');
    console.log('  • Division 8 General Deductions');
    console.log('  • Division 7A Compliance (Shareholder loans)');
    console.log('  • FBT (Fringe Benefits Tax) implications');
    console.log('');
    
    const startTime = Date.now();
    
    for (const business of BUSINESSES) {
        await analyzeOneBusiness(business);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 ANALYSIS COMPLETE - SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Total Transactions Analyzed: ${totalAnalyzed}`);
    console.log(`Total Time: ${totalTime} minutes`);
    console.log('');
    console.log('🔍 KEY FINDINGS:');
    console.log(`  • R&D Candidates: ${rndCandidates} transactions`);
    console.log(`  • Division 7A Risks: ${division7aRisks} transactions`);
    console.log(`  • FBT Implications: ${fbtImplications} transactions`);
    console.log(`  • Non-Deductible Items: ${notDeductible} transactions`);
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('  1. View recommendations: /dashboard/forensic-audit/recommendations');
    console.log('  2. R&D Tax Credits: /dashboard/forensic-audit/rnd');
    console.log('  3. Generate Report: /api/audit/reports/generate');
    console.log('');
    console.log('🎯 Visit: https://ato-blush.vercel.app/dashboard');
}

// Run
runFullAnalysis().catch(console.error);
