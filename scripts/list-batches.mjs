import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function listBatches() {
    console.log('Listing all batches...\n');
    
    try {
        const batches = await anthropic.messages.batches.list({ limit: 10 });
        
        console.log('═'.repeat(60));
        console.log('ALL BATCHES');
        console.log('═'.repeat(60));
        
        for (const batch of batches.data) {
            console.log(`\nBatch: ${batch.id}`);
            console.log(`  Status: ${batch.processing_status}`);
            console.log(`  Created: ${batch.created_at}`);
            console.log(`  Processing: ${batch.request_counts?.processing || 0}`);
            console.log(`  Succeeded: ${batch.request_counts?.succeeded || 0}`);
            console.log(`  Errored: ${batch.request_counts?.errored || 0}`);
        }
        
        if (batches.data.length === 0) {
            console.log('No batches found.');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.status) {
            console.error('Status:', error.status);
        }
    }
}

listBatches();
