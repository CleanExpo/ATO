#!/usr/bin/env tsx
/**
 * Run Orchestrator CLI
 *
 * Command-line interface for running the orchestrator agent to decompose
 * and distribute development tasks.
 *
 * Usage:
 *   npm run agent:orchestrator -- --task "Feature description"
 *   tsx scripts/agents/run-orchestrator.ts --help
 */

import { createLinearOrchestrator, type DeveloperRequest, type OrchestratorTask } from '@/lib/linear/orchestrator';
import { createAgentCommunicationBus } from '@/lib/agents/communication';

interface CliArgs {
  task?: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  type?: 'feature' | 'bug' | 'research' | 'refactor';
  help?: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--task' || arg === '-t') {
      parsed.task = args[++i];
    } else if (arg === '--priority' || arg === '-p') {
      parsed.priority = args[++i] as CliArgs['priority'];
    } else if (arg === '--type') {
      parsed.type = args[++i] as CliArgs['type'];
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`
Run Orchestrator CLI

USAGE:
  npm run agent:orchestrator -- [OPTIONS]

OPTIONS:
  -t, --task <description>    Task description (required)
  -p, --priority <level>      Priority: Critical, High, Medium, Low (default: Medium)
  --type <type>              Type: feature, bug, research, refactor (default: feature)
  -h, --help                 Show this help message

EXAMPLES:
  npm run agent:orchestrator -- --task "Add R&D eligibility checker API" --priority High
  npm run agent:orchestrator -- --task "Fix authentication bug" --type bug --priority Critical

ENVIRONMENT VARIABLES:
  LINEAR_API_KEY             Linear API key (required)
  LINEAR_TEAM_ID            Linear team ID (default: unite-hub)
  LINEAR_PROJECT_ID         Linear project ID (default: ato-3f31f766c467)
  `);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.task) {
    console.error('Error: --task is required');
    printHelp();
    process.exit(1);
  }

  // Check environment variables
  if (!process.env.LINEAR_API_KEY) {
    console.error('Error: LINEAR_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting Orchestrator...\n');

    // Create Linear orchestrator
    const orchestrator = createLinearOrchestrator();
    const commBus = createAgentCommunicationBus(orchestrator);

    // Create developer request
    const request: DeveloperRequest = {
      project: 'ATO',
      priority: args.priority || 'Medium',
      type: args.type || 'feature',
      title: args.task,
      description: args.task,
      successCriteria: [
        'Implementation complete',
        'Tests pass',
        'Documentation updated',
      ],
    };

    console.log('📝 Developer Request:');
    console.log(`   Title: ${request.title}`);
    console.log(`   Priority: ${request.priority}`);
    console.log(`   Type: ${request.type}\n`);

    // Create parent Linear issue
    console.log('📊 Creating parent Linear issue...');
    const parentIssue = await orchestrator.createParentIssue(request);
    console.log(`   ✅ Created: ${parentIssue.identifier}`);
    console.log(`   🔗 URL: ${parentIssue.url}\n`);

    // Example: Create specialist tasks (in production, orchestrator would analyze and decompose)
    console.log('🔨 Decomposing into specialist tasks...');
    const tasks: OrchestratorTask[] = [
      {
        id: 'ORCH-001',
        specialist: 'A',
        title: 'Design system architecture',
        objective: 'Create architecture design for the feature',
        context: 'Initial design phase',
        acceptanceCriteria: ['ADR created', 'Diagrams complete'],
        deliverables: ['ADR document', 'System diagrams'],
        priority: 2,
        estimatedHours: 4,
      },
      {
        id: 'ORCH-002',
        specialist: 'B',
        title: 'Implement feature',
        objective: 'Write production code',
        context: 'Based on architecture design',
        acceptanceCriteria: ['Code compiles', 'Linting passes'],
        deliverables: ['Production code'],
        priority: 2,
        estimatedHours: 8,
        dependsOn: ['ORCH-001'],
      },
      {
        id: 'ORCH-003',
        specialist: 'C',
        title: 'Write tests',
        objective: 'Achieve ≥80% coverage',
        context: 'Test implementation',
        acceptanceCriteria: ['All tests pass', 'Coverage ≥80%'],
        deliverables: ['Test files'],
        priority: 2,
        estimatedHours: 4,
        dependsOn: ['ORCH-002'],
      },
      {
        id: 'ORCH-004',
        specialist: 'D',
        title: 'Document feature',
        objective: 'Create technical documentation',
        context: 'Final documentation phase',
        acceptanceCriteria: ['API docs complete', 'Changelog updated'],
        deliverables: ['Documentation'],
        priority: 2,
        estimatedHours: 2,
        dependsOn: ['ORCH-003'],
      },
    ];

    const subTasks = await orchestrator.createSpecialistTasks(parentIssue.id, tasks);
    console.log(`   ✅ Created ${subTasks.length} specialist sub-tasks:\n`);

    for (let i = 0; i < subTasks.length; i++) {
      const task = tasks[i];
      const issue = subTasks[i];
      console.log(`   ${i + 1}. [${task.specialist}] ${task.title}`);
      console.log(`      ${issue.identifier} - ${issue.url}`);
    }

    console.log('\n✨ Orchestration complete!');
    console.log(`\n📊 View in Linear: ${parentIssue.url}`);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
