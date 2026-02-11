import { LinearClient } from '@linear/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function getLinearApiKey() {
  const envPath = resolve(import.meta.dirname || '.', '.env.local');
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

const COMMIT = '88056e8';

const issues = [
  {
    title: 'Update .env.example with all production environment variables',
    priority: 3,
    labels: ['documentation'],
    description: `Added 10 missing environment variables to \`.env.example\` with descriptions and groupings:\n\n- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET\n- TOKEN_ENCRYPTION_KEY\n- NEXT_PUBLIC_APP_URL\n- CRON_SECRET\n- SLACK_WEBHOOK_URL\n- ABR_GUID\n- AI_COST_LIMIT_USD\n- LINEAR_WORKSPACE_SLUG\n\nAll grouped logically with comments. Commit: ${COMMIT}`
  },
  {
    title: 'FBT engine: implement car benefit valuation and otherwise deductible rule',
    priority: 2,
    labels: ['enhancement', 'tax-compliance'],
    description: `**Car Benefit Valuation** (Division 2 FBTAA 1986):\n- Statutory formula method (s 9, 20% flat fraction)\n- Operating cost method (s 10, requires log book per s 10A)\n- New \`CarBenefitDetail\` interface with both method results\n- \`calculateCarBenefit()\` using Decimal.js\n\n**Otherwise Deductible Rule** (s 24 FBTAA):\n- Keyword-based classification (work travel 100%, professional dev 100%, laptop/tools 100%, mobile 75%)\n- Applied as reduction before gross-up calculation\n- New \`OtherwiseDeductibleResult\` interface\n- \`applyOtherwiseDeductibleRule()\` function\n\n**Integration**: Steps 5 (car benefit) and 6 (ODR) added to \`classifyAndCalculateFBT()\`.\nNew summary fields: carBenefitCount, carBenefitTotalSavings, odrAppliedCount, odrTotalReduction.\n\nFile: \`lib/analysis/fbt-engine.ts\` (+401 lines)\nCommit: ${COMMIT}`
  },
  {
    title: 'Deduction engine: entertainment classification, historical thresholds, prepaid expenses',
    priority: 2,
    labels: ['enhancement', 'tax-compliance'],
    description: `Three deduction engine improvements:\n\n**1. Entertainment Classification** (6 categories replacing flat 50%):\n- Seminar/conference: 100% deductible\n- Taxi travel: 100%\n- Client business development: 50%\n- Recreational: 0%\n- Meal with election: 50%\n- Meal without election: 0%\n\n**2. Historical Instant Asset Write-Off Thresholds**:\n- COVID full expensing FY2020-23: unlimited\n- $150K threshold FY2019-20\n- $20K threshold FY2023-26\n- New \`getWriteOffThreshold(financialYear)\` function\n\n**3. Prepaid Expense Detection** (s 82KZM ITAA 1936):\n- Keyword detection for insurance, rent, subscriptions\n- Apportionment warning for periods >12 months\n- SBE exemption handling\n- New \`PrepaidExpenseCheck\` interface\n\nFile: \`lib/analysis/deduction-engine.ts\` (+397 lines)\nCommit: ${COMMIT}`
  },
  {
    title: 'Div7A part-year loans, CGT event interactions, super FY-aware caps',
    priority: 2,
    labels: ['enhancement', 'tax-compliance'],
    description: `Three cross-engine improvements:\n\n**Div7A Part-Year Loans** (s 109E(5) ITAA 1936):\n- Proportional minimum repayment: fullYear × daysRemaining/365\n- \`loanStartDate\` field on \`ShareholderLoan\` interface\n- Decimal.js for all monetary arithmetic\n\n**CGT Event Interactions** (s 112-30 ITAA 1997):\n- Prior CGT events modify cost base of subsequent events on same asset\n- \`adjustCostBaseForPriorEvents()\` groups by asset, sorts chronologically\n- \`priorEventWarning\` field on \`CGTEvent\`\n\n**Super FY-Aware Caps**:\n- Concessional/non-concessional caps per FY (FY2018-19 through FY2025-26)\n- \`getSuperCaps(financialYear)\` with fallback warnings\n- Replaces hardcoded cap values throughout\n\nFiles: \`div7a-engine.ts\`, \`cgt-engine.ts\`, \`superannuation-cap-analyzer.ts\`\nCommit: ${COMMIT}`
  },
  {
    title: 'Implement data retention lifecycle (s 262A ITAA 1936)',
    priority: 2,
    labels: ['enhancement', 'compliance'],
    description: `New data retention system per s 262A ITAA 1936 (5-year minimum):\n\n**Retention Policies** (6 tiers):\n- Transaction cache: 90 days\n- Rate limit records: 7 days\n- Audit logs: 2 years\n- Analysis results: 5 years\n- Security events: 5 years\n- Data breaches: 7 years\n\n**Safety Guards**:\n- Cannot delete records <5 years old on long-retention tables\n- Dry-run mode available\n- Per-table status reporting for admin dashboard\n\n**Admin API**:\n- GET /api/admin/data-retention — retention status\n- POST /api/admin/data-retention — trigger enforcement\n- Uses requireAuth, rate limiting, force-dynamic\n\nFiles created:\n- \`lib/data-retention/retention-policy.ts\`\n- \`lib/data-retention/retention-enforcer.ts\`\n- \`app/api/admin/data-retention/route.ts\`\n\nCommit: ${COMMIT}`
  },
  {
    title: 'Resolve 6 tracked TODOs across codebase',
    priority: 3,
    labels: ['cleanup', 'technical-debt'],
    description: `Resolved all 6 tracked TODO items:\n\n1. **Linear label fetching** — \`lib/linear/graphql-queries.ts\`: Implemented real \`fetchLabels()\` and \`createLabel()\` functions with cache, case-insensitive matching, graceful fallback\n\n2. **Dashboard org groups** — \`app/dashboard/page.tsx\`: Wired up \`/api/organizations/groups\` API with \`orgGroupMap\` state and parallel fetch\n\n3. **Slack daily summary** — \`app/api/slack/daily-summary/route.ts\`: Added Stripe integration (charges, subscriptions, cancellations) and error tracking via \`security_events\` table\n\n4. **MYOB callback** — \`app/api/auth/myob/callback/route.ts\`: Enhanced design note for future company file selection UI, added multi-file logging\n\n5. **Members route** — \`app/api/organizations/[id]/members/route.ts\`: Added \`last_sign_in_at\` from Supabase auth to member response\n\n6. **Div7A test mock fix** — \`tests/unit/analysis/div7a-engine.test.ts\`: Added \`getFinancialYearForDate\` and \`getFYEndDate\` to mock\n\nCommit: ${COMMIT}`
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

  // Get project
  const projects = await client.projects();
  const atoProject = projects.nodes.find(p =>
    p.name.toLowerCase().includes('ato') || (p.slugId && p.slugId.includes('ato'))
  );
  const projectId = atoProject ? atoProject.id : undefined;
  if (atoProject) {
    console.log(`Found project: ${atoProject.name} (${atoProject.id})`);
  }

  // Get existing labels
  const existingLabels = await client.issueLabels();
  const labelMap = {};
  for (const label of existingLabels.nodes) {
    labelMap[label.name.toLowerCase()] = label.id;
  }

  let successCount = 0;
  let failCount = 0;

  for (const issue of issues) {
    try {
      // Resolve label IDs
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

      // Rate limit pause
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
