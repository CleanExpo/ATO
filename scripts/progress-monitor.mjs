/**
 * Progress Monitor - Real-time analysis progress display
 * 
 * Shows a live updating progress bar for the forensic audit
 * 
 * Usage: node scripts/progress-monitor.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_IDS = [
    '8a8caf6c-614b-45a5-9e15-46375122407c',
    'fc010696-d9f1-482e-ab43-aa0c13ee27fa'
];

function createProgressBar(progress, width = 40) {
    const filled = Math.round(progress * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}]`;
}

async function getProgress() {
    let totalAnalyzed = 0;
    let totalTransactions = 0;
    let rndCandidates = 0;
    let div7aRisks = 0;
    
    for (const tenantId of TENANT_IDS) {
        // Get total count
        const { count: total } = await supabase
            .from('historical_transactions_cache')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId);
        
        // Get analyzed count
        const { count: analyzed } = await supabase
            .from('historical_transactions_cache')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .not('analysis_complete', 'is', null);
        
        // Get R&D candidates
        const { data: rnd } = await supabase
            .from('historical_transactions_cache')
            .select('analysis_result')
            .eq('tenant_id', tenantId)
            .not('analysis_result', 'is', null);
        
        totalTransactions += total || 0;
        totalAnalyzed += analyzed || 0;
        
        if (rnd) {
            for (const t of rnd) {
                if (t.analysis_result?.isRndCandidate) rndCandidates++;
                if (t.analysis_result?.division7aRisk) div7aRisks++;
            }
        }
    }
    
    return { totalAnalyzed, totalTransactions, rndCandidates, div7aRisks };
}

async function displayProgress() {
    console.clear();
    
    const { totalAnalyzed, totalTransactions, rndCandidates, div7aRisks } = await getProgress();
    const progress = totalTransactions > 0 ? totalAnalyzed / totalTransactions : 0;
    const percent = (progress * 100).toFixed(1);
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          🔍 FORENSIC TAX AUDIT - LIVE PROGRESS             ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║                                                            ║');
    console.log(`║  Progress: ${createProgressBar(progress)} ${percent.padStart(5)}%  ║`);
    console.log('║                                                            ║');
    console.log(`║  📊 Analyzed:     ${totalAnalyzed.toString().padStart(5)} / ${totalTransactions}                       ║`);
    console.log(`║  📋 Remaining:    ${(totalTransactions - totalAnalyzed).toString().padStart(5)}                               ║`);
    console.log('║                                                            ║');
    console.log('║  ────────────────────────────────────────────────────────  ║');
    console.log('║  KEY FINDINGS                                              ║');
    console.log('║  ────────────────────────────────────────────────────────  ║');
    console.log(`║  🔬 R&D Tax Candidates:    ${rndCandidates.toString().padStart(4)} transactions              ║`);
    console.log(`║  ⚠️  Division 7A Risks:     ${div7aRisks.toString().padStart(4)} transactions              ║`);
    console.log('║                                                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  🎯 Dashboard: https://ato-blush.vercel.app/dashboard      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  Press Ctrl+C to exit. Refreshing every 30 seconds...');
}

// Initial display
displayProgress();

// Update every 30 seconds
setInterval(displayProgress, 30000);
