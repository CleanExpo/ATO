/**
 * Fast Transaction Analysis using Direct Anthropic API
 * 
 * Uses concurrent requests with rate limiting for faster processing.
 * 
 * Usage: node scripts/fast-analysis.mjs
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONCURRENT_REQUESTS = 10; // Anthropic allows ~40 RPM on lower tiers
const DELAY_BETWEEN_BATCHES = 15000; // 15 seconds between batches

const BUSINESSES = [
    { tenantId: '8a8caf6c-614b-45a5-9e15-46375122407c', name: 'Disaster Recovery Qld Pty Ltd', abn: '42 633 062 307' },
    { tenantId: 'fc010696-d9f1-482e-ab43-aa0c13ee27fa', name: 'Disaster Recovery Pty Ltd', abn: 'TBD' }
];

const ANALYSIS_PROMPT = `Analyze this Australian business transaction. Return ONLY valid JSON:
{
  "category": "string",
  "isRndCandidate": boolean,
  "division7aRisk": boolean,
  "fbtImplications": boolean,
  "isFullyDeductible": boolean,
  "confidence": 0-100
}

Transaction: {transaction}
Business: {businessName}`;

async function analyzeTransaction(txn, businessName) {
    const description = txn.raw_data?.reference || txn.raw_data?.narration || 
        txn.raw_data?.lineItems?.[0]?.description || 'No description';
    
    const info = `Date: ${txn.transaction_date}, Amount: $${txn.amount}, Desc: ${description}`;
    
    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 500,
            messages: [{
                role: 'user',
                content: ANALYSIS_PROMPT.replace('{transaction}', info).replace('{businessName}', businessName)
            }]
        });
        
        const text = response.content[0].text;
        return JSON.parse(text);
    } catch (e) {
        return { error: e.message, isRndCandidate: false, division7aRisk: false };
    }
}

async function processTransactions() {
    console.log('═'.repeat(60));
    console.log('🚀 FAST ANALYSIS - Direct API with Concurrent Requests');
    console.log('═'.repeat(60));
    console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`);
    console.log(`Delay between batches: ${DELAY_BETWEEN_BATCHES / 1000}s\n`);
    
    const startTime = Date.now();
    let totalAnalyzed = 0;
    let rndCount = 0;
    let div7aCount = 0;
    
    for (const business of BUSINESSES) {
        console.log(`\n📊 Processing: ${business.name}`);
        
        // Get unanalyzed transactions
        const { data: transactions, error } = await supabase
            .from('historical_transactions_cache')
            .select('*')
            .eq('tenant_id', business.tenantId)
            .is('analysis_complete', null)
            .limit(500); // Process 500 at a time
        
        if (error) {
            console.log('   Error fetching:', error.message);
            continue;
        }
        
        console.log(`   Found ${transactions?.length || 0} unanalyzed transactions`);
        
        if (!transactions?.length) continue;
        
        // Process in batches
        for (let i = 0; i < transactions.length; i += CONCURRENT_REQUESTS) {
            const batch = transactions.slice(i, i + CONCURRENT_REQUESTS);
            
            // Analyze concurrently
            const results = await Promise.all(
                batch.map(txn => analyzeTransaction(txn, business.name))
            );
            
            // Save results
            for (let j = 0; j < batch.length; j++) {
                const txn = batch[j];
                const analysis = results[j];
                
                if (!analysis.error) {
                    if (analysis.isRndCandidate) rndCount++;
                    if (analysis.division7aRisk) div7aCount++;
                    
                    await supabase
                        .from('historical_transactions_cache')
                        .update({
                            analysis_complete: true,
                            analysis_result: analysis,
                            analyzed_at: new Date().toISOString()
                        })
                        .eq('transaction_id', txn.transaction_id);
                }
                
                totalAnalyzed++;
            }
            
            process.stdout.write(`\r   Analyzed: ${i + batch.length}/${transactions.length} | R&D: ${rndCount} | Div7A: ${div7aCount}`);
            
            // Rate limit delay
            if (i + CONCURRENT_REQUESTS < transactions.length) {
                await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
            }
        }
        
        console.log(`\n   ✅ Complete for ${business.name}`);
    }
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ANALYSIS COMPLETE');
    console.log('═'.repeat(60));
    console.log(`Total Analyzed: ${totalAnalyzed}`);
    console.log(`Time: ${elapsed} minutes`);
    console.log(`R&D Candidates: ${rndCount}`);
    console.log(`Division 7A Risks: ${div7aCount}`);
    console.log('\n🎯 View: https://ato-blush.vercel.app/dashboard/forensic-audit');
}

processTransactions().catch(console.error);
