import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BATCH_ID = 'msgbatch_01CnGTVn8WA1rFBpbnUSbHGy';

async function checkBatch() {
    console.log('Checking batch status...\n');
    
    try {
        const batch = await anthropic.messages.batches.retrieve(BATCH_ID);
        
        console.log('═'.repeat(50));
        console.log('BATCH STATUS');
        console.log('═'.repeat(50));
        console.log('Batch ID:', batch.id);
        console.log('Status:', batch.processing_status);
        console.log('Created:', batch.created_at);
        console.log('Expires:', batch.expires_at);
        console.log('\nRequest Counts:');
        console.log('  Processing:', batch.request_counts?.processing || 0);
        console.log('  Succeeded:', batch.request_counts?.succeeded || 0);
        console.log('  Errored:', batch.request_counts?.errored || 0);
        console.log('  Expired:', batch.request_counts?.expired || 0);
        console.log('  Canceled:', batch.request_counts?.canceled || 0);
        
        if (batch.processing_status === 'ended') {
            console.log('\n✅ BATCH COMPLETE! Ready to retrieve results.');
        } else {
            console.log('\n⏳ Batch still processing...');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkBatch();
