#!/usr/bin/env node
/**
 * Parallel AI analysis runner.
 * Calls /api/audit/analyze-chunk repeatedly for each org IN PARALLEL.
 */

const BASE = process.env.BASE_URL || 'https://ato-ai.app';
const BATCH_SIZE = 25; // 5 concurrent Gemini calls per batch

const orgs = [
  { id: '9656b831-bb60-43db-8176-9f009903c1a8', name: 'CARSI' },
  { id: 'fc010696-d9f1-482e-ab43-aa0c13ee27fa', name: 'DR Pty Ltd' },
  { id: '8a8caf6c-614b-45a5-9e15-46375122407c', name: 'DR Qld' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ts() {
  return new Date().toLocaleTimeString('en-AU', { hour12: false });
}

async function analyzeOrg(org) {
  let batch = 0;
  let totalAnalyzed = 0;
  let totalTransactions = 0;
  let retries = 0;
  const MAX_RETRIES = 5;

  console.log(`[${ts()}] ${org.name}: Starting analysis`);

  while (true) {
    const startTime = Date.now();

    try {
      const r = await fetch(`${BASE}/api/audit/analyze-chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: org.id, batch, batchSize: BATCH_SIZE }),
      });

      if (r.status === 504) {
        retries++;
        if (retries > MAX_RETRIES) {
          console.log(`[${ts()}] ${org.name}: Too many timeouts, stopping.`);
          break;
        }
        console.log(`[${ts()}] ${org.name}: Batch ${batch} TIMEOUT, retry ${retries}/${MAX_RETRIES}...`);
        await sleep(10000);
        continue;
      }

      if (!r.ok) {
        const text = await r.text();
        retries++;
        if (retries > MAX_RETRIES) {
          console.log(`[${ts()}] ${org.name}: Too many errors, stopping. Last: ${text.slice(0, 100)}`);
          break;
        }
        console.log(`[${ts()}] ${org.name}: Batch ${batch} HTTP ${r.status}, retry ${retries}/${MAX_RETRIES}`);
        await sleep(5000);
        continue;
      }

      // Success - reset retry counter
      retries = 0;

      const d = await r.json();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

      totalAnalyzed = d.totalAnalyzed || 0;
      totalTransactions = d.totalTransactions || 0;
      const pct = d.progress?.toFixed(1) || '0.0';

      console.log(
        `[${ts()}] ${org.name.padEnd(12)} Batch ${String(batch).padStart(3)}: ` +
        `${String(totalAnalyzed).padStart(5)}/${totalTransactions} (${pct.padStart(5)}%) ${elapsed}s`
      );

      if (d.allComplete || !d.hasMore) {
        console.log(`[${ts()}] ${org.name}: COMPLETE - ${totalAnalyzed} transactions analyzed`);
        break;
      }

      batch = d.nextBatch;
      await sleep(500); // Brief pause between batches

    } catch (error) {
      retries++;
      if (retries > MAX_RETRIES) {
        console.log(`[${ts()}] ${org.name}: Too many errors, stopping. Last: ${error.message}`);
        break;
      }
      console.log(`[${ts()}] ${org.name}: Batch ${batch} ERROR: ${error.message}, retry ${retries}/${MAX_RETRIES}`);
      await sleep(10000);
    }
  }

  return { name: org.name, totalAnalyzed, totalTransactions };
}

// Main - run ALL orgs in parallel
const startAll = Date.now();
console.log(`[${ts()}] Starting parallel analysis for ${orgs.length} orgs (batchSize=${BATCH_SIZE})\n`);

const results = await Promise.all(orgs.map(org => analyzeOrg(org)));

const totalTime = ((Date.now() - startAll) / 1000 / 60).toFixed(1);

console.log(`\n${'='.repeat(60)}`);
console.log(`[${ts()}] ALL COMPLETE`);
console.log('='.repeat(60));
for (const r of results) {
  console.log(`  ${r.name.padEnd(14)} ${r.totalAnalyzed}/${r.totalTransactions}`);
}
console.log(`\nTotal time: ${totalTime} minutes`);
