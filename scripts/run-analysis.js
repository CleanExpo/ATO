#!/usr/bin/env node
/**
 * Automated AI Analysis Runner
 *
 * Runs the chunked analysis API repeatedly until all transactions are processed.
 *
 * Usage: node scripts/run-analysis.js
 *
 * Environment:
 * - TENANT_ID: Xero tenant ID (required)
 * - API_URL: Base URL (default: https://ato-blush.vercel.app)
 * - BATCH_SIZE: Transactions per batch (default: 5)
 */

const https = require('https');

const TENANT_ID = process.env.TENANT_ID || '8a8caf6c-614b-45a5-9e15-46375122407c';
const API_URL = process.env.API_URL || 'https://ato-blush.vercel.app';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

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
            timeout: 120000 // 2 minute timeout
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${body.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
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

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

async function runAnalysis() {
    console.log('='.repeat(60));
    console.log('Australian Tax Optimizer - AI Analysis Runner');
    console.log('='.repeat(60));
    console.log(`Tenant ID: ${TENANT_ID}`);
    console.log(`API URL: ${API_URL}`);
    console.log(`Batch Size: ${BATCH_SIZE}`);
    console.log('='.repeat(60));
    console.log('');

    let batch = 0;
    let totalAnalyzed = 0;
    let totalTransactions = 0;
    let startTime = Date.now();
    let retryCount = 0;
    const maxRetries = 3;

    while (true) {
        try {
            const result = await makeRequest(batch);
            retryCount = 0; // Reset retry count on success

            if (!result.success) {
                console.error(`\n[ERROR] Batch ${batch} failed: ${result.error}`);
                if (result.hint) {
                    console.error(`Hint: ${result.hint}`);
                }

                // Wait and retry
                retryCount++;
                if (retryCount <= maxRetries) {
                    console.log(`Retrying in 10 seconds... (${retryCount}/${maxRetries})`);
                    await sleep(10000);
                    continue;
                } else {
                    console.error('Max retries exceeded. Exiting.');
                    process.exit(1);
                }
            }

            totalAnalyzed = result.totalAnalyzed;
            totalTransactions = result.totalTransactions;

            const elapsed = Date.now() - startTime;
            const rate = totalAnalyzed / (elapsed / 1000 / 60); // transactions per minute
            const remaining = totalTransactions - totalAnalyzed;
            const eta = remaining / rate; // minutes remaining

            // Progress bar
            const progressPercent = result.progress;
            const barWidth = 40;
            const filled = Math.round(barWidth * progressPercent / 100);
            const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

            // Clear line and print progress
            process.stdout.write(`\r[${bar}] ${progressPercent.toFixed(1)}% | ${totalAnalyzed}/${totalTransactions} | ${rate.toFixed(1)} txn/min | ETA: ${formatDuration(eta * 60 * 1000)}    `);

            if (result.allComplete) {
                console.log('\n');
                console.log('='.repeat(60));
                console.log('ANALYSIS COMPLETE!');
                console.log('='.repeat(60));
                console.log(`Total Transactions Analyzed: ${totalAnalyzed}`);
                console.log(`Total Time: ${formatDuration(elapsed)}`);
                console.log(`Average Rate: ${rate.toFixed(1)} transactions/minute`);
                console.log('='.repeat(60));
                break;
            }

            batch = result.nextBatch;
            await sleep(DELAY_BETWEEN_BATCHES);

        } catch (error) {
            console.error(`\n[ERROR] Batch ${batch}: ${error.message}`);

            retryCount++;
            if (retryCount <= maxRetries) {
                console.log(`Retrying in 10 seconds... (${retryCount}/${maxRetries})`);
                await sleep(10000);
            } else {
                console.error('Max retries exceeded. Exiting.');
                console.log(`\nTo resume, run: BATCH_START=${batch} node scripts/run-analysis.js`);
                process.exit(1);
            }
        }
    }
}

// Allow starting from a specific batch
const startBatch = parseInt(process.env.BATCH_START || '0', 10);
if (startBatch > 0) {
    console.log(`Resuming from batch ${startBatch}...`);
}

runAnalysis().catch(console.error);
