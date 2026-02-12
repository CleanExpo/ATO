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

const COMMIT = 'e1da63d';

const issues = [
  {
    title: 'Remove hardcoded API keys from Linear scripts',
    priority: 1,
    labels: ['bug', 'cleanup'],
    description: `**Security fix**: Removed hardcoded Linear API key from two scripts that had \`lin_api_...\` in plain text.\n\nBoth scripts now use a \`getLinearApiKey()\` function that reads from \`.env.local\` with fallback to \`process.env.LINEAR_API_KEY\`.\n\nFiles modified:\n- \`scripts/close-linear-issues.mjs\`\n- \`scripts/update-linear-tech-debt.mjs\`\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Fix || true logic bug in AccountantReportView tab rendering',
    priority: 1,
    labels: ['bug'],
    description: `**Bug fix**: \`components/share/AccountantReportView.tsx\` had \`|| true\` on three tab conditionals (lines 157, 217, 248), causing ALL tabs to render to DOM simultaneously regardless of activeTab state.\n\nThis caused:\n- Unnecessary DOM rendering (performance)\n- Screen readers seeing hidden content (accessibility)\n- Potential duplicate content in print mode\n\nFixed by removing \`|| true\` from all three lines. Only the active tab now renders.\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Replace hardcoded FY2024-25 with dynamic getCurrentFinancialYear()',
    priority: 2,
    labels: ['enhancement'],
    description: `Replaced hardcoded "FY2024-25" strings across 6 dashboard pages with dynamic \`getCurrentFinancialYear()\` from \`lib/utils/financial-year.ts\`.\n\nWithout this fix, all FY labels would show the wrong year after 1 July 2025.\n\nPages updated:\n- \`app/dashboard/losses/page.tsx\` — FY selector now generates current + 4 prior FYs dynamically\n- \`app/dashboard/accountant/div7a/page.tsx\` — benchmark rate label\n- \`app/dashboard/accountant/fbt/page.tsx\` — FBT rate label\n- \`app/dashboard/overview/page.tsx\` — Div7A rate display\n- \`app/dashboard/page.tsx\` — data quality scan title\n- \`app/dashboard/strategies/grant-accelerator/page.tsx\` — document label\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Add force-dynamic to 122 API routes missing it',
    priority: 2,
    labels: ['bug'],
    description: `Added \`export const dynamic = 'force-dynamic'\` to 122 API route files that were missing the declaration but return tenant-specific or user-specific data.\n\nWithout this, Next.js could incorrectly cache responses from these routes in production, serving stale or wrong-tenant data.\n\n33 routes already had the declaration and were left untouched. Total routes with force-dynamic after change: 155.\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Delete 20 stale one-off scripts and 2 duplicate page files',
    priority: 3,
    labels: ['cleanup'],
    description: `Removed dead code:\n\n**20 stale scripts deleted** (old CommonJS .js files with newer .mjs/.ts equivalents):\napply-migration-020.js, apply-migration-021.js, apply-migration-021-direct.js, check-cache-status.js, check-connections.js, check-db.js, check-db-simple.js, check-org-schema.js, check-rls2.mjs, create-linear-issues.js, create-organization-group.js, deploy-enhanced-dashboards.js, fix-carsi-connection.js, generate-pdf-report.js, run-analysis.js, run-analysis-parallel.js, run-migrations.js, sync-all-orgs.js, test-db.js, verify-migrations.js\n\n**2 duplicate dashboard pages deleted:**\n- \`app/dashboard/page-enhanced.tsx\` (581 lines)\n- \`app/dashboard/data-quality/page-enhanced.tsx\` (533 lines)\n\nNet reduction: ~2,900 lines.\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Remove console.log from production components and fix instrumentation TODO',
    priority: 3,
    labels: ['cleanup'],
    description: `Minor cleanup:\n\n**Removed console.log from 2 production components:**\n- \`components/dashboard/PlatformSyncButton.tsx\` — 2 debug log calls removed\n- \`components/rnd/EvidenceWizard.tsx\` — 1 debug log call removed\n\n**Replaced tracked TODO in instrumentation.ts:**\nChanged \`// TODO(tracked): Initialize error tracking service\` to documentation comment explaining errors are logged to console and security_events table, with instructions for adding Sentry.\n\nCommit: ${COMMIT}`
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
