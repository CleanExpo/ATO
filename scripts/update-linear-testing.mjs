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

const COMMIT = 'd687886';

const issues = [
  {
    title: 'Add unit tests for 7 untested modules (232 tests)',
    priority: 2,
    labels: ['enhancement'],
    description: `Added comprehensive unit tests for critical modules with zero coverage:\n\n- **token-encryption** (32 tests): encrypt/decrypt roundtrip, error handling, dev fallback, key rotation\n- **retention-policy** (30 tests): cutoff dates, retention periods, policy validation\n- **security-event-logger** (29 tests): event logging, anomaly thresholds, convenience functions\n- **file-scanner** (33 tests): magic numbers, executable detection, double extensions, null bytes\n- **rate-limit** (18 tests): limit enforcement, window reset, 429 responses\n- **pii-sanitizer** (19 tests): anonymisation, consistency, edge cases\n- **financial-year** (+16 tests): BAS quarters, FY end dates, amendment periods\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Add API integration tests for 6 critical routes (62 tests)',
    priority: 2,
    labels: ['enhancement'],
    description: `Added API route tests for critical endpoints:\n\n- **health** (9 tests): ok/degraded status, rate limiting, response shape\n- **share** (12 tests): create/list, validation (tenantId, reportType, password), auth\n- **organizations** (12 tests): GET/POST, validation (name, ABN, businessSize), Cache-Control\n- **analysis** (9 tests): CGT POST, optional params, error handling\n- **recommendations** (9 tests): summary, priority/taxArea filtering, Cache-Control\n- **data-retention** (11 tests): GET status, POST enforcement, auth, rate limiting\n\nAll tests mock Supabase and auth dependencies. Total test count: 62 files, 1,660 tests.\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Integrate Sentry error tracking (optional, DSN-gated)',
    priority: 2,
    labels: ['enhancement'],
    description: `Added @sentry/nextjs integration that activates only when NEXT_PUBLIC_SENTRY_DSN is set:\n\n- sentry.client.config.ts: 10% traces, 100% replay on error\n- sentry.server.config.ts: 10% traces for Node.js runtime\n- sentry.edge.config.ts: 10% traces for edge runtime\n- instrumentation.ts: imports Sentry configs per runtime\n- next.config.ts: conditional withSentryConfig wrapper\n- global-error.tsx: captures exceptions to Sentry\n- CSP updated to allow Sentry ingest domain\n- .env.example updated with Sentry variables\n\nApp works identically without Sentry configured.\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Add E2E mobile viewport tests and accessibility CI',
    priority: 2,
    labels: ['enhancement'],
    description: `**Mobile E2E Tests:**\n- Pixel 5 and iPhone 13 viewports in playwright.config.ts\n- Activated via MOBILE_TESTS=true (not in default CI run)\n- Added \`pnpm test:e2e:mobile\` script\n\n**Accessibility CI:**\n- Installed @axe-core/playwright\n- Created tests/e2e/accessibility.spec.ts with WCAG 2.0 AA checks\n- Tests landing page, dashboard, and shared reports for critical violations\n- Added to CI pipeline (continue-on-error for gradual adoption)\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Generate OpenAPI 3.0.3 spec for all 145 API endpoints',
    priority: 3,
    labels: ['documentation'],
    description: `Created docs/openapi.yaml covering all API routes:\n\n- 145 endpoint handlers across 133 route files\n- 22 tags (auth, xero, audit, analysis, reports, share, rnd, admin, etc.)\n- Reusable schemas: ErrorResponse, ValidationError, AuthError, XeroConnection\n- Security: Bearer token (Supabase JWT), public endpoints marked\n- Servers: localhost:3000 (dev), ato-app.vercel.app (prod)\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Fix mobile responsiveness and re-enable data-quality navigation',
    priority: 3,
    labels: ['enhancement'],
    description: `**Mobile fixes:**\n- ApplicationForm: 3 grids changed from grid-cols-2 to grid-cols-1 sm:grid-cols-2\n- Audit table: added overflow-x-auto for horizontal scroll on mobile\n- Charts: verified all use ResponsiveContainer (no changes needed)\n\n**Navigation:**\n- Data Quality page re-enabled in desktop nav (showInDesktop: true)\n- Page has full content: AI scanning, KPIs, remediation stream, sentinel config\n- Mobile nav unchanged (covered under Forensic Audit umbrella)\n\nCommit: ${COMMIT}`
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
