#!/usr/bin/env node
/**
 * Parallel AI Analysis Runner
 *
 * Runs multiple analysis batches concurrently to speed up processing.
 * Respects Gemini rate limits (15 requests/minute).
 *
 * Usage: node scripts/run-analysis-parallel.js
 */

const https = require('https');

const TENANT_ID = process.env.TENANT_ID || '8a8caf6c-614b-45a5-9e15-46375122407c';
const API_URL = process.env.API_URL || 'https://ato-blush.vercel.app';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);
const PARALLEL_BATCHES = parseInt(process.env.PARALLEL || '3', 10); // Run 3 batches concurrently
const DELAY_BETWEEN_ROUNDS = 5000; // 5 seconds between rounds of parallel batches

async function makeRequest(batch) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            tenantId: TENANT_ID,
            batch: batch,
            batchSize: BATCH_SIZE
        });

        const url = new URL(`${API_URL}/api/audit/analyze-chunk`);

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            },
            timeout: 120000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    result._batch = batch; // Track which batch this was
                    resolve(result);
                } catch (e) {
                    reject(new Error(`Batch ${batch}: Failed to parse - ${body.substring(0, 100)}`));
                }
            });
        });

        req.on('error', (e) => reject(new Error(`Batch ${batch}: ${e.message}`)));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Batch ${batch}: Timeout`));
        });

        req.write(data);
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

async function runParallelAnalysis() {
    console.log('='.repeat(60));
    console.log('Australian Tax Optimizer - PARALLEL Analysis Runner');
    console.log('='.repeat(60));
    console.log(`Tenant ID: ${TENANT_ID}`);
    console.log(`Batch Size: ${BATCH_SIZE} | Parallel Batches: ${PARALLEL_BATCHES}`);
    console.log('='.repeat(60));
    console.log('');

    let currentBatch = parseInt(process.env.BATCH_START || '0', 10);
    let totalTransactions = 0;
    let completedBatches = new Set();
    let startTime = Date.now();
    let lastAnalyzed = 0;

    // First, get total count
    try {
        const initial = await makeRequest(0);
        totalTransactions = initial.totalTransactions;
        console.log(`Total transactions to analyze: ${totalTransactions}`);
        console.log('');
    } catch (e) {
        console.error('Failed to get initial count:', e.message);
        process.exit(1);
    }

    const totalBatches = Math.ceil(totalTransactions / BATCH_SIZE);

    while (currentBatch < totalBatches) {
        // Calculate which batches to run in this round
        const batchesToRun = [];
        for (let i = 0; i < PARALLEL_BATCHES && currentBatch + i < totalBatches; i++) {
            const batchNum = currentBatch + i;
            if (!completedBatches.has(batchNum)) {
                batchesToRun.push(batchNum);
            }
        }

        if (batchesToRun.length === 0) {
            currentBatch += PARALLEL_BATCHES;
            continue;
        }

        // Run batches in parallel
        const promises = batchesToRun.map(b => makeRequest(b).catch(e => ({ error: e.message, _batch: b })));
        const results = await Promise.all(promises);

        let roundAnalyzed = 0;
        let errors = [];

        for (const result of results) {
            if (result.error) {
                errors.push(`Batch ${result._batch}: ${result.error}`);
            } else if (result.success) {
                completedBatches.add(result._batch);
                roundAnalyzed += result.analyzed;
                lastAnalyzed = Math.max(lastAnalyzed, result.totalAnalyzed);
            }
        }

        // Calculate progress
        const analyzed = completedBatches.size * BATCH_SIZE;
        const elapsed = Date.now() - startTime;
        const rate = analyzed / (elapsed / 1000 / 60);
        const remaining = totalTransactions - analyzed;
        const eta = rate > 0 ? remaining / rate : 0;

        const progressPercent = (analyzed / totalTransactions) * 100;
        const barWidth = 40;
        const filled = Math.round(barWidth * progressPercent / 100);
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

        process.stdout.write(`\r[${bar}] ${progressPercent.toFixed(1)}% | ${analyzed}/${totalTransactions} | ${rate.toFixed(0)} txn/min | ETA: ${formatDuration(eta * 60 * 1000)}    `);

        if (errors.length > 0) {
            console.log('');
            errors.forEach(e => console.error(`  [WARN] ${e}`));
        }

        // Check if complete
        if (completedBatches.size >= totalBatches) {
            console.log('\n\n' + '='.repeat(60));
            console.log('ANALYSIS COMPLETE!');
            console.log('='.repeat(60));
            console.log(`Total Transactions: ${totalTransactions}`);
            console.log(`Total Time: ${formatDuration(elapsed)}`);
            console.log(`Average Rate: ${rate.toFixed(0)} transactions/minute`);
            console.log('='.repeat(60));
            break;
        }

        currentBatch += PARALLEL_BATCHES;
        await sleep(DELAY_BETWEEN_ROUNDS);
    }
}

runParallelAnalysis().catch(console.error);
