#!/usr/bin/env node
/**
 * Sync All Xero Organisations
 *
 * Syncs historical data for all 3 connected Xero organisations.
 */

const https = require('https');

const ORGANISATIONS = [
  { id: '9656b831-bb60-43db-8176-9f009903c1a8', name: 'CARSI (Trust)' },
  { id: 'fc010696-d9f1-482e-ab43-aa0c13ee27fa', name: 'Disaster Recovery Pty Ltd' },
  { id: '8a8caf6c-614b-45a5-9e15-46375122407c', name: 'Disaster Recovery Qld Pty Ltd' }
];

const API_URL = process.env.API_URL || 'https://ato-blush.vercel.app';

async function syncChunk(tenantId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ tenantId });
    const url = new URL(`${API_URL}/api/audit/sync-chunk`);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: 60000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse: ${body.substring(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncOrganisation(org) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Syncing: ${org.name}`);
  console.log(`Tenant ID: ${org.id}`);
  console.log('='.repeat(50));

  let totalFetched = 0;
  let iterations = 0;
  const maxIterations = 200; // Safety limit

  while (iterations < maxIterations) {
    try {
      const result = await syncChunk(org.id);

      totalFetched += result.fetched || 0;
      iterations++;

      const year = result.currentProgress?.year || 'N/A';
      const type = result.currentProgress?.type || 'N/A';

      process.stdout.write(`\r  [${iterations}] Fetched: ${totalFetched} | Year: ${year} | Type: ${type}    `);

      if (result.allComplete) {
        console.log(`\n  COMPLETE! Total transactions: ${totalFetched}`);
        break;
      }

      // Small delay between chunks
      await sleep(500);
    } catch (error) {
      console.error(`\n  Error: ${error.message}`);
      await sleep(2000);
    }
  }

  return totalFetched;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Australian Tax Optimizer - Multi-Organisation Sync');
  console.log('='.repeat(60));

  const results = {};

  for (const org of ORGANISATIONS) {
    results[org.name] = await syncOrganisation(org);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SYNC SUMMARY');
  console.log('='.repeat(60));
  for (const [name, count] of Object.entries(results)) {
    console.log(`  ${name}: ${count} transactions`);
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
