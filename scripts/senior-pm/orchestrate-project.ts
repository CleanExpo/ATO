#!/usr/bin/env tsx

/**
 * Senior PM: Orchestrate Project
 *
 * Receive a developer request and initiate the multi-agent workflow:
 * Developer → Senior PM → Linear → Orchestrator → Specialists
 *
 * Usage:
 *   npm run senior-pm:orchestrate -- --title "Add feature" --description "..." --priority High
 */

import { createLinearOrchestrator } from '@/lib/linear/orchestrator';
import { createAgentCommunicationBus } from '@/lib/agents/communication';
import { createQualityGateEnforcer } from '@/lib/agents/quality-gates';
import {
  createSeniorPMOrchestrationManager,
  type DeveloperRequest,
} from '@/lib/senior-pm/orchestration-manager';

interface Args {
  title: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  type?: 'feature' | 'bug' | 'research' | 'refactor';
  project?: string;
  constraints?: string;
  successCriteria?: string[];
  deadline?: string;
}

async function main() {
  const args = parseArgs();

  if (!args) {
    printUsage();
    process.exit(1);
  }

  console.log('🎯 Senior PM: Orchestration Manager\n');
  console.log(`Receiving developer request: ${args.title}\n`);

  // Initialize components
  const linearOrchestrator = createLinearOrchestrator();
  const commBus = createAgentCommunicationBus(linearOrchestrator);
  const qualityGates = createQualityGateEnforcer(linearOrchestrator);
  const seniorPM = createSeniorPMOrchestrationManager(
    linearOrchestrator,
    commBus,
    qualityGates
  );

  // Build developer request
  const request: DeveloperRequest = {
    project: args.project || 'Australian Tax Optimizer',
    priority: args.priority,
    type: args.type || 'feature',
    title: args.title,
    description: args.description,
    constraints: args.constraints,
    successCriteria: args.successCriteria || [
      'Functionality works as described',
      'Tests pass with ≥80% coverage',
      'Documentation complete',
    ],
    deadline: args.deadline,
  };

  try {
    // PHASE 1: Senior PM receives developer request
    console.log('📋 Phase 1: Processing Developer Request\n');
    const result = await seniorPM.receiveDeveloperRequest(request);

    if (result.status === 'rejected') {
      console.error(`❌ Request Rejected: ${result.message}\n`);
      process.exit(1);
    }

    console.log(`✅ Request Accepted\n`);
    console.log(`Linear Issue: ${result.linearIssue?.identifier}`);
    console.log(`URL: ${result.linearIssue?.url}\n`);
    console.log(`📨 Message sent to Orchestrator for task decomposition\n`);

    // PHASE 2: Wait for orchestrator decomposition (in real system, this would be async)
    console.log('⏳ Waiting for Orchestrator to decompose tasks...\n');
    console.log(
      '💡 The Orchestrator will analyze the requirements and create specialized tasks for:\n'
    );
    console.log('   - 🏗️  Specialist A (Architecture): System design, API schemas, ERDs');
    console.log('   - 💻 Specialist B (Developer): Production code implementation');
    console.log('   - 🧪 Specialist C (Tester): Unit/integration/E2E tests');
    console.log('   - 📚 Specialist D (Reviewer): Code review, documentation\n');

    console.log('📊 Progress Tracking\n');
    console.log(
      'You can monitor progress in Linear or use:\n  npm run senior-pm:daily-report\n'
    );

    console.log('✨ Multi-agent workflow initiated successfully!\n');

    return {
      success: true,
      linearIssue: result.linearIssue,
      message: result.message,
    };
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function parseArgs(): Args | null {
  const args = process.argv.slice(2);

  let title: string | undefined;
  let description: string | undefined;
  let priority: Args['priority'] = 'Medium';
  let type: Args['type'] = 'feature';
  let project: string | undefined;
  let constraints: string | undefined;
  let successCriteria: string[] = [];
  let deadline: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--title':
      case '-t':
        title = nextArg;
        i++;
        break;
      case '--description':
      case '-d':
        description = nextArg;
        i++;
        break;
      case '--priority':
      case '-p':
        if (['Critical', 'High', 'Medium', 'Low'].includes(nextArg)) {
          priority = nextArg as Args['priority'];
        }
        i++;
        break;
      case '--type':
        if (['feature', 'bug', 'research', 'refactor'].includes(nextArg)) {
          type = nextArg as Args['type'];
        }
        i++;
        break;
      case '--project':
        project = nextArg;
        i++;
        break;
      case '--constraints':
        constraints = nextArg;
        i++;
        break;
      case '--success-criteria':
        successCriteria = nextArg.split(',').map((s) => s.trim());
        i++;
        break;
      case '--deadline':
        deadline = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        return null;
    }
  }

  if (!title || !description) {
    return null;
  }

  return {
    title,
    description,
    priority,
    type,
    project,
    constraints,
    successCriteria,
    deadline,
  };
}

function printUsage() {
  console.log(`
🎯 Senior PM: Orchestrate Project

Initiate a multi-agent development workflow for a new project.

USAGE:
  npm run senior-pm:orchestrate -- --title "..." --description "..." [options]

REQUIRED:
  --title, -t <string>              Project title
  --description, -d <string>        Detailed description

OPTIONS:
  --priority, -p <level>            Priority: Critical, High, Medium, Low (default: Medium)
  --type <type>                     Type: feature, bug, research, refactor (default: feature)
  --project <name>                  Project name (default: Australian Tax Optimizer)
  --constraints <text>              Technical or business constraints
  --success-criteria <list>         Comma-separated success criteria
  --deadline <date>                 ISO 8601 deadline (e.g., 2026-02-15T00:00:00Z)

EXAMPLES:
  # Simple feature request
  npm run senior-pm:orchestrate -- \\
    --title "Add R&D eligibility checker API" \\
    --description "Create endpoint to validate R&D activities" \\
    --priority High

  # Complex project with constraints
  npm run senior-pm:orchestrate -- \\
    --title "Implement FBT optimizer" \\
    --description "Build FBT calculation and optimization engine" \\
    --priority Critical \\
    --type feature \\
    --constraints "Must integrate with Xero, comply with FBTAA 1986" \\
    --success-criteria "API functional,Tests ≥80%,Documentation complete" \\
    --deadline 2026-02-28T00:00:00Z

WORKFLOW:
  Developer → Senior PM → Linear Issue → Orchestrator → Specialists

  The Senior PM will:
  1. Create a Linear parent issue
  2. Send task to Orchestrator for decomposition
  3. Monitor specialist progress
  4. Escalate blockers
  5. Generate daily reports
  `);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as orchestrateProject };
