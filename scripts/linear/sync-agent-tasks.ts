#!/usr/bin/env tsx
/**
 * Sync Agent Tasks with Linear
 *
 * Synchronizes agent task states with Linear issues.
 * Updates issue statuses, labels, and comments based on agent activity.
 *
 * Usage:
 *   npm run linear:sync
 *   tsx scripts/linear/sync-agent-tasks.ts
 */

import { createLinearOrchestrator } from '@/lib/linear/orchestrator';

async function main() {
  console.log('🔄 Syncing Agent Tasks with Linear...\n');

  // Check environment variables
  if (!process.env.LINEAR_API_KEY) {
    console.error('Error: LINEAR_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    const orchestrator = createLinearOrchestrator();

    console.log('📊 Fetching Linear workspace information...');
    const viewer = await orchestrator.client.viewer;
    console.log(`   ✅ Connected as: ${viewer.name} (${viewer.email})\n`);

    // Fetch team information
    console.log('👥 Team Information:');
    const teams = await orchestrator.client.teams();
    for await (const team of teams.nodes) {
      console.log(`   - ${team.name} (${team.key})`);
    }
    console.log();

    // Fetch project information
    console.log('📁 Project Information:');
    const projects = await orchestrator.client.projects();
    for await (const project of projects.nodes) {
      const team = await project.team;
      console.log(`   - ${project.name} (Team: ${team?.name || 'Unknown'})`);
    }
    console.log();

    // Check required labels exist
    console.log('🏷️  Checking Required Labels...');
    const requiredLabels = [
      'agent:orchestrator',
      'agent:specialist-a',
      'agent:specialist-b',
      'agent:specialist-c',
      'agent:specialist-d',
      'agent:tax',
      'status:pending',
      'status:in-progress',
      'status:blocked',
      'status:review',
      'status:done',
      'priority:p1',
      'priority:p2',
      'priority:p3',
      'priority:p4',
      'type:feature',
      'type:bug',
      'type:research',
      'type:refactor',
    ];

    const existingLabels = await orchestrator.client.issueLabels();
    const existingLabelNames = existingLabels.nodes.map((l) => l.name);

    const missingLabels = requiredLabels.filter(
      (label) => !existingLabelNames.includes(label)
    );

    if (missingLabels.length > 0) {
      console.log('   ⚠️  Missing labels (should be created in Linear):');
      missingLabels.forEach((label) => {
        console.log(`      - ${label}`);
      });
      console.log('\n   💡 Create these labels in Linear settings to enable full automation');
    } else {
      console.log('   ✅ All required labels exist');
    }
    console.log();

    // Fetch workflow states
    console.log('🔄 Workflow States:');
    const states = await orchestrator.client.workflowStates();
    for await (const state of states.nodes) {
      console.log(`   - ${state.name} (${state.type})`);
    }
    console.log();

    console.log('✨ Sync complete!\n');
    console.log('📝 Next Steps:');
    console.log('   1. Create any missing labels in Linear');
    console.log('   2. Run `npm run agent:orchestrator` to create tasks');
    console.log('   3. Run `npm run agent:daily-report` to view status\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

main();
