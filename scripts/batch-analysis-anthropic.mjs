/**
 * Batch Analysis using Anthropic Message Batches API
 * 
 * Processes ALL transactions in ~1 hour instead of 90+ hours!
 * 
 * Usage: node scripts/batch-analysis-anthropic.mjs
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

console.log('Supabase URL:', SUPABASE_URL ? 'Found' : 'Missing');
console.log('Anthropic Key:', ANTHROPIC_KEY ? 'Found' : 'Missing');

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
    console.error('Missing required environment variables!');
    process.exit(1);
}

// Initialize clients
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Businesses
const BUSINESSES = [
    { tenantId: '8a8caf6c-614b-45a5-9e15-46375122407c', name: 'Disaster Recovery Qld Pty Ltd', abn: '42 633 062 307' },
    { tenantId: 'fc010696-d9f1-482e-ab43-aa0c13ee27fa', name: 'Disaster Recovery Pty Ltd', abn: 'TBD' }
];

// Analysis prompt
const ANALYSIS_PROMPT = `You are a forensic tax accountant analyzing Australian business transactions. Analyze this transaction and return ONLY a JSON object with this structure:

{
  "categories": { "primary": "string", "secondary": [], "confidence": 0-100 },
  "rndAssessment": {
    "isRndCandidate": boolean,
    "meetsDiv355Criteria": boolean,
    "activityType": "core_rnd" | "supporting_rnd" | "not_eligible",
    "confidence": 0-100,
    "reasoning": "string"
  },
  "deductionEligibility": {
    "isFullyDeductible": boolean,
    "deductionType": "Section 8-1" | "Division 40" | "Instant write-off" | "Other",
    "claimableAmount": number,
    "restrictions": []
  },
  "complianceFlags": {
    "requiresDocumentation": boolean,
    "fbtImplications": boolean,
    "division7aRisk": boolean,
    "notes": []
  }
}

Transaction: {transaction}
Business: {businessName} (ABN: {abn})`;

async function getUnanalyzedTransactions(tenantId) {
    const { data, error } = await supabase
        .from('historical_transactions_cache')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('analysis_complete', null)
        .limit(10000); // Max batch size
    
    if (error) throw error;
    return data || [];
}

async function createBatchRequests(transactions, businessName, abn) {
    return transactions.map((txn, index) => {
        const rawData = txn.raw_data || {};
        const description = rawData.reference || rawData.narration || 
            (rawData.lineItems?.[0]?.description) || 'No description';
        
        const transactionInfo = `Date: ${txn.transaction_date}, Amount: $${txn.amount}, Description: ${description}, Type: ${txn.transaction_type}`;
        
        return {
            custom_id: txn.transaction_id,
            params: {
                model: 'claude-3-haiku-20240307', // Fastest, cheapest for bulk
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: ANALYSIS_PROMPT
                        .replace('{transaction}', transactionInfo)
                        .replace('{businessName}', businessName)
                        .replace('{abn}', abn)
                }]
            }
        };
    });
}

async function submitBatch(requests) {
    console.log(`Submitting batch with ${requests.length} requests...`);
    
    const batch = await anthropic.messages.batches.create({
        requests: requests
    });
    
    console.log(`Batch created: ${batch.id}`);
    return batch;
}

async function waitForBatch(batchId) {
    console.log('Waiting for batch to complete...');
    let lastStatus = '';
    
    while (true) {
        const batch = await anthropic.messages.batches.retrieve(batchId);
        
        if (batch.processing_status !== lastStatus) {
            lastStatus = batch.processing_status;
            console.log(`Status: ${batch.processing_status} (${batch.request_counts.succeeded || 0}/${batch.request_counts.processing || 0} processed)`);
        }
        
        if (batch.processing_status === 'ended') {
            return batch;
        }
        
        // Wait 30 seconds before checking again
        await new Promise(r => setTimeout(r, 30000));
    }
}

async function processResults(batchId, tenantId) {
    console.log('Processing results...');
    
    const results = [];
    for await (const result of anthropic.messages.batches.results(batchId)) {
        results.push(result);
    }
    
    console.log(`Processing ${results.length} results...`);
    
    let successCount = 0;
    let errorCount = 0;
    let rndCandidates = 0;
    let division7aRisks = 0;
    
    for (const result of results) {
        try {
            if (result.result.type === 'succeeded') {
                const content = result.result.message.content[0].text;
                const analysis = JSON.parse(content);
                
                // Track findings
                if (analysis.rndAssessment?.isRndCandidate) rndCandidates++;
                if (analysis.complianceFlags?.division7aRisk) division7aRisks++;
                
                // Update database
                await supabase
                    .from('historical_transactions_cache')
                    .update({
                        analysis_complete: true,
                        analysis_result: analysis,
                        analyzed_at: new Date().toISOString()
                    })
                    .eq('tenant_id', tenantId)
                    .eq('transaction_id', result.custom_id);
                
                successCount++;
            } else {
                errorCount++;
            }
        } catch (e) {
            errorCount++;
        }
    }
    
    return { successCount, errorCount, rndCandidates, division7aRisks };
}

async function runBatchAnalysis() {
    console.log('');
    console.log('═'.repeat(70));
    console.log('🚀 BATCH ANALYSIS - ANTHROPIC MESSAGE BATCHES API');
    console.log('═'.repeat(70));
    console.log('Expected completion: ~1 hour for all transactions');
    console.log('');
    
    const startTime = Date.now();
    let totalProcessed = 0;
    let totalRnD = 0;
    let totalDiv7a = 0;
    
    for (const business of BUSINESSES) {
        console.log(`\n📊 Processing: ${business.name}`);
        
        // Get unanalyzed transactions
        const transactions = await getUnanalyzedTransactions(business.tenantId);
        console.log(`   Found ${transactions.length} unanalyzed transactions`);
        
        if (transactions.length === 0) {
            console.log('   No transactions to analyze');
            continue;
        }
        
        // Create batch requests
        const requests = await createBatchRequests(transactions, business.name, business.abn);
        
        // Submit batch
        const batch = await submitBatch(requests);
        
        // Wait for completion
        await waitForBatch(batch.id);
        
        // Process results
        const results = await processResults(batch.id, business.tenantId);
        
        totalProcessed += results.successCount;
        totalRnD += results.rndCandidates;
        totalDiv7a += results.division7aRisks;
        
        console.log(`   ✅ Completed: ${results.successCount} analyzed, ${results.rndCandidates} R&D candidates, ${results.division7aRisks} Div7A risks`);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '═'.repeat(70));
    console.log('📊 BATCH ANALYSIS COMPLETE');
    console.log('═'.repeat(70));
    console.log(`Total Processed: ${totalProcessed} transactions`);
    console.log(`Total Time: ${totalTime} minutes`);
    console.log(`R&D Candidates Found: ${totalRnD}`);
    console.log(`Division 7A Risks Found: ${totalDiv7a}`);
    console.log('');
    console.log('🎯 View results: https://ato-blush.vercel.app/dashboard/forensic-audit');
}

runBatchAnalysis().catch(console.error);
