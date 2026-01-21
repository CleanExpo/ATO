/**
 * Sync All Historical Data Script
 * 
 * This script calls the chunked sync API repeatedly to fetch all 5 years
 * of Xero transaction data.
 * 
 * Usage: node scripts/sync-all-data.mjs
 */

const BASE_URL = process.env.BASE_URL || 'https://ato-blush.vercel.app';
const TENANT_ID = process.env.TENANT_ID || '8a8caf6c-614b-45a5-9e15-46375122407c';

async function syncAllData() {
    console.log('='.repeat(60));
    console.log('ATO Tax Optimizer - Full Historical Data Sync');
    console.log('='.repeat(60));
    console.log(`URL: ${BASE_URL}`);
    console.log(`Tenant: ${TENANT_ID}`);
    console.log('');

    let year = null;
    let type = null;
    let page = 1;
    let totalCached = 0;
    let chunkCount = 0;
    let allComplete = false;

    const startTime = Date.now();

    while (!allComplete) {
        chunkCount++;
        
        const body = { tenantId: TENANT_ID };
        if (year) body.year = year;
        if (type) body.type = type;
        if (page) body.page = page;

        try {
            const response = await fetch(`${BASE_URL}/api/audit/sync-chunk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            totalCached += result.cached || 0;
            
            const progress = result.currentProgress;
            console.log(
                `Chunk ${String(chunkCount).padStart(3)}: ` +
                `${String(result.cached).padStart(3)} cached | ` +
                `${progress.year} ${progress.type} page ${progress.page} | ` +
                `${result.timing.totalMs}ms`
            );

            // Update for next iteration
            if (result.allComplete) {
                allComplete = true;
            } else {
                year = result.nextYear;
                type = result.nextType;
                page = result.hasMore ? result.nextPage : 1;
            }

            // Small delay to be nice to the API
            await new Promise(r => setTimeout(r, 500));

        } catch (error) {
            console.error(`Error on chunk ${chunkCount}:`, error.message);
            // Wait a bit and retry
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('='.repeat(60));
    console.log('SYNC COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total Chunks: ${chunkCount}`);
    console.log(`Total Cached: ${totalCached} transactions`);
    console.log(`Total Time: ${totalTime} seconds`);
    console.log('');
    console.log('Your 5 years of historical data is now cached and ready for analysis!');
    console.log('Visit: https://ato-blush.vercel.app/dashboard');
}

// Run the sync
syncAllData().catch(console.error);
