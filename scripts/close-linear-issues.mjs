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

const issues = [
  { id: 'UNI-488', summary: 'Fix GOOGLE_AI_MODEL default value', commits: '34418e9' },
  { id: 'UNI-489', summary: 'Delete duplicate dashboard pages', commits: '34418e9' },
  { id: 'UNI-490', summary: 'Fix hardcoded empty state on Projections page', commits: '34418e9' },
  { id: 'UNI-491', summary: 'Resolve disabled navigation items', commits: '34418e9' },
  { id: 'UNI-492', summary: 'Remove Help Center stub page', commits: '34418e9' },
  { id: 'UNI-493', summary: 'Expand mobile navigation coverage', commits: '34418e9' },
  { id: 'UNI-494', summary: 'Add breadcrumb navigation to sub-pages', commits: '7ca82b3' },
  { id: 'UNI-495', summary: 'Standardize loading states with skeleton loaders', commits: '7ca82b3, 521060c' },
  { id: 'UNI-496', summary: 'Standardize error states with retry buttons', commits: '7ca82b3, 521060c' },
  { id: 'UNI-497', summary: 'Add empty states with CTAs for new users', commits: '7ca82b3, 521060c' },
  { id: 'UNI-498', summary: 'Add sorting and pagination to transaction table', commits: '570526d' },
  { id: 'UNI-499', summary: 'Add required field indicators to Application Form', commits: '34418e9' },
  { id: 'UNI-500', summary: 'Add keyboard navigation to data tables', commits: '570526d' },
  { id: 'UNI-501', summary: 'Fix color-only status indicators', commits: '521060c' },
  { id: 'UNI-502', summary: 'Update .env.example with all environment variables', commits: '34418e9' },
  { id: 'UNI-503', summary: 'Migrate inline styles to Tailwind', commits: '521060c' },
];

async function main() {
  // Step 1: Get the team and find the "Done" state
  console.log('Finding UNI team and workflow states...');
  
  const teams = await client.teams();
  const uniTeam = teams.nodes.find(t => t.key === 'UNI');
  if (!uniTeam) {
    console.error('ERROR: Could not find team with key UNI');
    process.exit(1);
  }
  console.log(`Found team: ${uniTeam.name} (${uniTeam.id})`);

  const states = await uniTeam.states();
  console.log('Available workflow states:');
  for (const state of states.nodes) {
    console.log(`  - ${state.name} (${state.id}) [type: ${state.type}]`);
  }

  const doneState = states.nodes.find(s => s.name === 'Done');
  if (!doneState) {
    console.error('ERROR: Could not find "Done" state');
    console.error('Available states:', states.nodes.map(s => s.name).join(', '));
    process.exit(1);
  }
  console.log(`\nUsing "Done" state: ${doneState.id}\n`);

  // Step 2: Process each issue
  let successCount = 0;
  let failCount = 0;

  for (const issue of issues) {
    try {
      // Find the issue by identifier
      const searchResult = await client.issues({
        filter: {
          team: { key: { eq: 'UNI' } },
          number: { eq: parseInt(issue.id.split('-')[1]) },
        },
      });

      const linearIssue = searchResult.nodes[0];
      if (!linearIssue) {
        console.error(`FAIL: ${issue.id} - Issue not found in Linear`);
        failCount++;
        continue;
      }

      // Update state to Done
      await linearIssue.update({ stateId: doneState.id });

      // Add completion comment
      const comment = `Implementation complete and committed.\n\n` +
        `**Summary:** ${issue.summary}\n` +
        `**Commits:** ${issue.commits}\n\n` +
        `All changes have been verified and merged. Marking as Done.`;
      
      await client.createComment({
        issueId: linearIssue.id,
        body: comment,
      });

      console.log(`OK: ${issue.id} - "${linearIssue.title}" -> Done`);
      successCount++;
    } catch (err) {
      console.error(`FAIL: ${issue.id} - ${err.message}`);
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
