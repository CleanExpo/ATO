import { LinearClient } from '@linear/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function getLinearApiKey() {
  const envPath = resolve(import.meta.dirname || '.', '..', '.env.local');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^LINEAR_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch {}

  if (process.env.LINEAR_API_KEY) return process.env.LINEAR_API_KEY;

  console.error('LINEAR_API_KEY not found in .env.local or environment');
  process.exit(1);
}

const LINEAR_API_KEY = getLinearApiKey();
const client = new LinearClient({ apiKey: LINEAR_API_KEY });

const COMMIT = 'd5f3bdb';

const issues = [
  {
    title: 'Add 13 composite database indexes for query performance',
    priority: 2,
    labels: ['enhancement'],
    description: `Created migration \`20260212_composite_indexes.sql\` with 13 composite indexes across 11 tables.\n\nKey indexes:\n- \`historical_transactions_cache\`: (tenant_id, created_at DESC), (tenant_id, status)\n- \`tax_recommendations\`: (tenant_id, created_at DESC)\n- \`forensic_analysis_results\`: (tenant_id, analyzed_at DESC)\n- \`security_events\`: (event_type, created_at DESC), (ip_address, created_at DESC)\n- \`notifications\`: (user_id, created_at DESC)\n- \`analysis_queue\`: (tenant_id, status)\n- Plus indexes on accountant_findings, cgt_events, fbt_items, generated_reports, organization_activity_log\n\nAll use CREATE INDEX IF NOT EXISTS for idempotency.\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Create /api/health endpoint for uptime monitoring',
    priority: 2,
    labels: ['enhancement'],
    description: `New endpoint at \`app/api/health/route.ts\`:\n\n- GET — returns status, timestamp, version, uptime\n- Checks Supabase connectivity via createAdminClient()\n- Returns \`status: 'ok'\` or \`status: 'degraded'\` with error detail\n- No authentication required (for external uptime monitors)\n- Rate limited at 60 req/min per IP\n- force-dynamic enabled\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Add Cache-Control headers to read-only API endpoints',
    priority: 3,
    labels: ['enhancement'],
    description: `Added caching headers to 6 GET endpoints:\n\n**1-hour public cache:**\n- \`/api/tax-data/rates\` — tax rates are same for all users\n- \`/api/tax-obligations\` — deadline data is stable\n\n**5-minute private cache:**\n- \`/api/audit/analysis-results\` — tenant-specific\n- \`/api/audit/recommendations\` — tenant-specific (all 3 return paths)\n- \`/api/organizations\` — GET only\n- \`/api/audit/cost-stats\` — aggregated tenant data\n\nAll use stale-while-revalidate for smooth cache transitions. Error responses intentionally not cached.\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Configure bundle analyzer and pnpm analyze script',
    priority: 3,
    labels: ['enhancement'],
    description: `Added \`@next/bundle-analyzer\` for client bundle size tracking:\n\n- Installed as devDependency\n- Wrapped next.config.ts export with \`withBundleAnalyzer()\`\n- Activated via \`ANALYZE=true\` env var\n- Added \`pnpm analyze\` script to package.json\n- Documented in .env.example\n\nRun \`pnpm analyze\` to generate interactive treemap.\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Optimise CI/CD pipeline with parallel jobs and caching',
    priority: 2,
    labels: ['enhancement'],
    description: `Optimised all 3 GitHub Actions workflows:\n\n**test.yml** (main CI):\n- Restructured to 3 parallel jobs: typecheck, unit-tests, e2e-tests\n- TypeScript check is now a hard failure (was continue-on-error)\n- Switched from npm to pnpm with store caching\n- Added Playwright browser caching via actions/cache\n- Removed redundant build job (covered by Vercel)\n\n**critical-tests.yml + comprehensive-tests.yml:**\n- Migrated from npm ci to pnpm install --frozen-lockfile\n- Added pnpm store caching\n- Added Playwright browser caching for E2E shards\n\nCommit: ${COMMIT}`
  },
];

async function main() {
  console.log('Finding UNI team and workflow states...');

  const teams = await client.teams();
  const uniTeam = teams.nodes.find(t => t.key === 'UNI');
  if (!uniTeam) {
    console.error('ERROR: Could not find team with key UNI');
    process.exit(1);
  }
  console.log(`Found team: ${uniTeam.name} (${uniTeam.id})`);

  const states = await uniTeam.states();
  const doneState = states.nodes.find(s => s.name === 'Done');
  if (!doneState) {
    console.error('ERROR: Could not find "Done" state');
    process.exit(1);
  }
  console.log(`Using "Done" state: ${doneState.id}`);

  const projects = await client.projects();
  const atoProject = projects.nodes.find(p =>
    p.name.toLowerCase().includes('ato') || (p.slugId && p.slugId.includes('ato'))
  );
  const projectId = atoProject ? atoProject.id : undefined;
  if (atoProject) {
    console.log(`Found project: ${atoProject.name} (${atoProject.id})`);
  }

  const existingLabels = await client.issueLabels();
  const labelMap = {};
  for (const label of existingLabels.nodes) {
    labelMap[label.name.toLowerCase()] = label.id;
  }

  let successCount = 0;
  let failCount = 0;

  for (const issue of issues) {
    try {
      const labelIds = [];
      for (const labelName of issue.labels) {
        if (labelMap[labelName.toLowerCase()]) {
          labelIds.push(labelMap[labelName.toLowerCase()]);
        }
      }

      const input = {
        teamId: uniTeam.id,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        stateId: doneState.id,
        labelIds,
      };
      if (projectId) {
        input.projectId = projectId;
      }

      const result = await client.createIssue(input);
      if (result.success) {
        const created = await result.issue;
        console.log(`OK: ${created.identifier} - "${created.title}" -> Done`);
        successCount++;
      } else {
        console.error(`FAIL: "${issue.title}" - issue creation unsuccessful`);
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`FAIL: "${issue.title}" - ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed:  ${failCount}`);
  console.log(`Total:   ${issues.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
