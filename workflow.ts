#!/usr/bin/env tsx
/**
 * Workflow Command - Unified Idea Intake Interface
 *
 * Usage:
 *   npx tsx workflow.ts              # Show menu
 *   npx tsx workflow.ts capture      # Capture current idea
 *   npx tsx workflow.ts validate     # Validate pending items
 *   npx tsx workflow.ts process      # Process validated items
 *   npx tsx workflow.ts status       # Show queue status
 *   npx tsx workflow.ts stats        # Show statistics
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { validateQueueItem } from './lib/queue/pm-validator';
import { getNextPendingItem, markAsValidated } from './lib/queue/work-queue-manager';
import { createIssue } from './lib/linear/api-client';
import { buildIssueFromQueue } from './lib/linear/graphql-queries';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function showMenu() {
  console.log('\n🔄 Idea Intake Workflow\n');

  // Get queue statistics
  const { data: stats } = await supabase.rpc('get_queue_statistics');

  if (stats && stats.length > 0) {
    const s = stats[0];
    console.log('Current Queue Status:');
    console.log(`├─ Pending:    ${s.pending_count} items (awaiting validation)`);
    console.log(`├─ Validated:  ${s.validated_count} items (ready to process)`);
    console.log(`├─ Processing: ${s.processing_count} item${s.processing_count !== 1 ? 's' : ''}  (currently executing)`);
    console.log(`└─ Completed:  ${s.archived_count} items (archived)\n`);
  }

  console.log('Available Commands:');
  console.log('├─ npx tsx workflow.ts capture   - Capture an idea');
  console.log('├─ npx tsx workflow.ts validate  - Validate pending items');
  console.log('├─ npx tsx workflow.ts process   - Process validated items');
  console.log('├─ npx tsx workflow.ts status    - Show detailed status');
  console.log('└─ npx tsx workflow.ts stats     - Show statistics\n');

  console.log('💡 Quick Actions:');
  console.log('- Capture an idea: npx tsx workflow.ts capture "Your idea here"');
  console.log('- Process everything: npx tsx workflow.ts process\n');
}

async function showStatus() {
  console.log('\n📊 Queue Status\n');

  const statuses = ['pending', 'validating', 'validated', 'processing', 'complete', 'failed'];

  for (const status of statuses) {
    const { data, error } = await supabase
      .from('work_queue')
      .select('id, title, priority, complexity, created_at')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data && data.length > 0) {
      console.log(`\n${status.toUpperCase()} (${data.length} items):`);
      data.forEach((item: { title: string; priority?: string; complexity?: string }, i: number) => {
        const priority = item.priority ? `[${item.priority}]` : '';
        const complexity = item.complexity ? `(${item.complexity})` : '';
        console.log(`  ${i + 1}. ${item.title} ${priority} ${complexity}`);
      });
    }
  }

  console.log('');
}

async function captureIdea(idea: string) {
  console.log('\n📝 Capturing idea...\n');

  if (!idea || idea.trim().length === 0) {
    console.error('❌ Please provide an idea to capture');
    console.log('Usage: npx tsx workflow.ts capture "Your idea here"\n');
    process.exit(1);
  }

  // Auto-detect type
  const lowerIdea = idea.toLowerCase();
  let type = 'task';

  if (lowerIdea.includes('fix') || lowerIdea.includes('bug') || lowerIdea.includes('error')) {
    type = 'bug';
  } else if (lowerIdea.includes('add') || lowerIdea.includes('create') || lowerIdea.includes('new')) {
    type = 'feature';
  } else if (lowerIdea.includes('improve') || lowerIdea.includes('enhance') || lowerIdea.includes('optimize')) {
    type = 'improvement';
  }

  // Generate title (first 80 chars)
  let title = idea;
  if (title.length > 80) {
    title = title.substring(0, 77) + '...';
  }

  const { data, error } = await supabase
    .from('work_queue')
    .insert([{
      queue_item_type: type,
      title: title,
      description: idea,
      payload: {
        original_input: idea,
        captured_at: new Date().toISOString(),
      },
      status: 'pending',
    }])
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to capture idea:', error.message);
    process.exit(1);
  }

  console.log('✅ Idea captured successfully!\n');
  console.log(`**Title**: ${title}`);
  console.log(`**Type**: ${type}`);
  console.log(`**ID**: ${data.id}\n`);
  console.log('Next: Run `npx tsx workflow.ts validate` to validate this idea\n');
}

async function showStats() {
  console.log('\n📈 Workflow Statistics\n');

  const { data: stats } = await supabase.rpc('get_queue_statistics');

  if (stats && stats.length > 0) {
    const s = stats[0];

    console.log('Queue Metrics:');
    console.log(`├─ Total items:     ${s.total_items}`);
    console.log(`├─ Pending:         ${s.pending_count}`);
    console.log(`├─ Validated:       ${s.validated_count}`);
    console.log(`├─ Processing:      ${s.processing_count}`);
    console.log(`├─ Completed:       ${s.complete_count}`);
    console.log(`├─ Failed:          ${s.failed_count}`);
    console.log(`└─ Archived:        ${s.archived_count}\n`);

    if (s.avg_execution_time_seconds) {
      const avgMins = Math.round(s.avg_execution_time_seconds / 60);
      console.log(`Performance:`);
      console.log(`├─ Avg execution:   ${avgMins} minutes`);
    }

    if (s.total_token_usage) {
      console.log(`└─ Total tokens:    ${s.total_token_usage} PTS\n`);
    }

    const successRate = s.complete_count / Math.max(s.complete_count + s.failed_count, 1) * 100;
    console.log(`Success Rate: ${successRate.toFixed(1)}%\n`);
  }
}

async function validatePendingItems() {
  console.log('\n🔍 Senior PM Validation Starting...\n');

  // Get all pending items
  const { data: pendingItems, error } = await supabase
    .from('work_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to fetch pending items:', error.message);
    return;
  }

  if (!pendingItems || pendingItems.length === 0) {
    console.log('✅ No pending items to validate\n');
    return;
  }

  console.log(`Found ${pendingItems.length} pending item(s)\n`);

  let validated = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      console.log(`📋 Validating: ${item.title.substring(0, 60)}...`);

      // Mark as validating
      await supabase
        .from('work_queue')
        .update({ status: 'validating' })
        .eq('id', item.id);

      // Run PM validation
      const validationResult = await validateQueueItem(item);

      console.log(`   Priority: ${validationResult.priority}`);
      console.log(`   Complexity: ${validationResult.complexity}`);
      console.log(`   Agent: ${validationResult.assigned_agent}`);

      // Create Linear issue if not a duplicate
      let linearIssueId, linearIssueIdentifier, linearIssueUrl;

      if (!validationResult.is_duplicate) {
        try {
          const issueData = buildIssueFromQueue(
            process.env.LINEAR_TEAM_ID!,
            process.env.LINEAR_PROJECT_ID,
            {
              queueId: item.id,
              title: item.title,
              description: item.description,
              priority: validationResult.priority,
              complexity: validationResult.complexity,
              queueItemType: item.queue_item_type,
              assignedAgent: validationResult.assigned_agent,
              validationNotes: validationResult.notes,
            }
          );

          const linearIssue = await createIssue(issueData);
          linearIssueId = linearIssue.id;
          linearIssueIdentifier = linearIssue.identifier;
          linearIssueUrl = linearIssue.url;

          console.log(`   Linear: ${linearIssueIdentifier} ✅`);
        } catch (linearError: unknown) {
          console.log(`   Linear: Failed (${linearError instanceof Error ? linearError.message : String(linearError)})`);
          // Continue anyway - validation is still useful
        }
      } else {
        console.log(`   Duplicate: ${validationResult.duplicate_issue_id}`);
      }

      // Update queue item with validation results
      await supabase
        .from('work_queue')
        .update({
          status: validationResult.is_duplicate ? 'archived' : 'validated',
          validation_result: validationResult,
          complexity: validationResult.complexity,
          priority: validationResult.priority,
          assigned_agent: validationResult.assigned_agent,
          linear_issue_id: linearIssueId,
          linear_issue_identifier: linearIssueIdentifier,
          linear_issue_url: linearIssueUrl,
        })
        .eq('id', item.id);

      validated++;
      console.log(`   ✅ Validated\n`);

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: unknown) {
      console.error(`   ❌ Validation failed: ${error instanceof Error ? error.message : String(error)}\n`);

      // Mark as failed
      await supabase
        .from('work_queue')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq('id', item.id);

      failed++;
    }
  }

  console.log(`\n📊 Validation Complete`);
  console.log(`   ✅ Validated: ${validated}`);
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed}`);
  }
  console.log('');
}

async function processQueue() {
  console.log('\n⚙️  Work Queue Processor Starting...\n');

  // Get validated items (priority-sorted)
  const { data: validatedItems, error } = await supabase
    .from('work_queue')
    .select('*')
    .eq('status', 'validated')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to fetch validated items:', error.message);
    return;
  }

  if (!validatedItems || validatedItems.length === 0) {
    console.log('✅ No validated items to process\n');
    console.log('💡 Tip: Run `workflow validate` to validate pending items\n');
    return;
  }

  console.log(`Found ${validatedItems.length} validated item(s) ready for execution\n`);

  for (const item of validatedItems) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📋 ${item.title}\n`);
    console.log(`   Priority:    ${item.priority || 'N/A'}`);
    console.log(`   Complexity:  ${item.complexity || 'N/A'}`);
    console.log(`   Agent:       ${item.assigned_agent || 'general'}`);
    console.log(`   Linear:      ${item.linear_issue_identifier || 'N/A'}`);

    if (item.linear_issue_url) {
      console.log(`   URL:         ${item.linear_issue_url}`);
    }

    console.log('');

    // Show what would be executed based on complexity
    if (item.complexity === 'simple') {
      console.log('   Execution Strategy: DIRECT');
      console.log('   └─ Execute immediately without planning phase\n');
    } else if (item.complexity === 'medium') {
      console.log('   Execution Strategy: PLANNER → EXECUTOR');
      console.log('   ├─ Spawn PLANNER sub-agent');
      console.log('   ├─ Generate execution plan');
      console.log('   ├─ Spawn EXECUTOR sub-agent');
      console.log('   └─ Execute plan\n');
    } else if (item.complexity === 'complex') {
      console.log('   Execution Strategy: PLANNER → USER APPROVAL → EXECUTOR');
      console.log('   ├─ Spawn PLANNER sub-agent');
      console.log('   ├─ Generate execution plan');
      console.log('   ├─ Present plan to user');
      console.log('   ├─ Wait for user approval');
      console.log('   ├─ Spawn EXECUTOR sub-agent');
      console.log('   └─ Execute approved plan\n');
    }

    console.log('   Description:');
    console.log(`   ${item.description.substring(0, 200)}${item.description.length > 200 ? '...' : ''}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🚀 Ready to Execute\n');
  console.log(`   ${validatedItems.length} item(s) will be processed autonomously`);
  console.log(`   Each item gets a fresh sub-agent context (no pollution)\n`);

  console.log('⚠️  IMPLEMENTATION NOTE:\n');
  console.log('   Full autonomous execution requires agent orchestration.');
  console.log('   For now, you can:\n');
  console.log('   1. Use Claude Code directly to implement these items');
  console.log('   2. Reference the Linear issues (UNI-214, UNI-215)');
  console.log('   3. Update Linear status as you complete them\n');

  console.log('   The autonomous execution engine is coming in the next phase.');
  console.log('   It will spawn fresh sub-agents and execute these automatically.\n');

  console.log('📋 Next Actions:\n');
  console.log(`   • View in Linear: https://linear.app/unite-hub/team/UNI/active`);
  console.log(`   • Check queue: workflow status`);
  console.log(`   • Capture more: workflow capture "idea"\n`);
}

// Main command router
const command = process.argv[2] || 'menu';
const arg = process.argv.slice(3).join(' ');

(async () => {
  try {
    switch (command) {
      case 'menu':
      case 'help':
        await showMenu();
        break;

      case 'capture':
        await captureIdea(arg);
        break;

      case 'status':
        await showStatus();
        break;

      case 'stats':
        await showStats();
        break;

      case 'validate':
        await validatePendingItems();
        break;

      case 'process':
        await processQueue();
        break;

      default:
        console.log(`\n❌ Unknown command: ${command}\n`);
        await showMenu();
        process.exit(1);
    }
  } catch (error: unknown) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
