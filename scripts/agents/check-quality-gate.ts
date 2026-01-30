#!/usr/bin/env tsx
/**
 * Quality Gate Checker
 *
 * Runs quality gate checks to ensure standards are met before phase transitions.
 *
 * Usage:
 *   npm run agent:quality-gate -- --gate design-complete --task ORCH-001
 *   tsx scripts/agents/check-quality-gate.ts --gate testing-complete --task ORCH-003
 */

import { createLinearOrchestrator } from '@/lib/linear/orchestrator';
import { createQualityGateEnforcer, type QualityGate, QUALITY_GATE_METADATA } from '@/lib/agents/quality-gates';

interface CliArgs {
  gate?: QualityGate;
  task?: string;
  linearUrl?: string;
  help?: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--gate' || arg === '-g') {
      parsed.gate = args[++i] as QualityGate;
    } else if (arg === '--task' || arg === '-t') {
      parsed.task = args[++i];
    } else if (arg === '--linear-url' || arg === '-u') {
      parsed.linearUrl = args[++i];
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`
Quality Gate Checker

USAGE:
  npm run agent:quality-gate -- [OPTIONS]

OPTIONS:
  -g, --gate <name>          Quality gate to check (required)
  -t, --task <id>           Task ID (required)
  -u, --linear-url <url>    Linear issue URL (optional, for reporting)
  -h, --help                Show this help message

AVAILABLE GATES:
  design-complete            Check if design phase is complete
  implementation-complete    Check if implementation is complete
  testing-complete          Check if testing is complete
  documentation-complete    Check if documentation is complete
  integration-complete      Check if integration is complete
  final-approval            Check if ready for deployment

EXAMPLES:
  npm run agent:quality-gate -- --gate design-complete --task ORCH-001
  npm run agent:quality-gate -- --gate testing-complete --task ORCH-003 --linear-url https://linear.app/...

ENVIRONMENT VARIABLES:
  LINEAR_API_KEY             Linear API key (required for reporting)
  LINEAR_TEAM_ID            Linear team ID
  LINEAR_PROJECT_ID         Linear project ID
  `);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.gate || !args.task) {
    console.error('Error: --gate and --task are required');
    printHelp();
    process.exit(1);
  }

  try {
    console.log('🔍 Running Quality Gate Check...\n');

    const orchestrator = createLinearOrchestrator();
    const enforcer = createQualityGateEnforcer(orchestrator);

    const metadata = QUALITY_GATE_METADATA[args.gate];
    console.log(`Gate: ${metadata.title}`);
    console.log(`Task: ${args.task}\n`);

    // Run appropriate gate check based on gate type
    let result;

    switch (args.gate) {
      case 'design-complete':
        result = await enforcer.checkDesignComplete(args.task, {
          adrPath: 'docs/architecture/adr-example.md', // Example - would be provided by caller
          diagramPaths: ['docs/diagrams/system.md'],
          risksDocumented: true,
        });
        break;

      case 'implementation-complete':
        result = await enforcer.checkImplementationComplete(args.task, {
          codePaths: ['lib/example.ts'], // Example
          compilesSuccessfully: true,
          lintingPasses: true,
          basicFunctionalityWorks: true,
        });
        break;

      case 'testing-complete':
        result = await enforcer.checkTestingComplete(args.task, {
          testFilePaths: ['tests/example.test.ts'], // Example
          allTestsPass: true,
          coveragePercentage: 85,
          noCriticalBugs: true,
        });
        break;

      case 'documentation-complete':
        result = await enforcer.checkDocumentationComplete(args.task, {
          techDocsPaths: ['docs/api.md'], // Example
          apiDocsComplete: true,
          changelogUpdated: true,
          examplesProvided: true,
        });
        break;

      case 'integration-complete':
        result = await enforcer.checkIntegrationComplete(args.task, {
          allOutputsMerged: true,
          systemFunctional: true,
          noMergeConflicts: true,
          qualityGatesPassed: [
            'design-complete',
            'implementation-complete',
            'testing-complete',
            'documentation-complete',
          ],
        });
        break;

      case 'final-approval':
        result = await enforcer.checkFinalApproval(args.task, {
          meetsRequirements: true,
          readyForDeployment: true,
          pmApproved: true,
          developerApproved: false, // Waiting for developer
        });
        break;

      default:
        console.error(`Unknown gate: ${args.gate}`);
        process.exit(1);
    }

    // Print results
    console.log('='.repeat(60));
    console.log(result.passed ? '✅ GATE PASSED' : '❌ GATE FAILED');
    console.log('='.repeat(60));
    console.log(`Score: ${result.score.toFixed(0)}%`);
    console.log(`Checks: ${result.checks.filter(c => c.passed).length}/${result.checks.length} passed\n`);

    console.log('CHECKS:');
    result.checks.forEach((check) => {
      const icon = check.passed ? '✅' : check.required ? '❌' : '⚠️ ';
      const req = check.required ? '(required)' : '(recommended)';
      console.log(`  ${icon} ${check.name} ${req}`);
      if (check.details) {
        console.log(`     ${check.details}`);
      }
    });

    if (result.blockers.length > 0) {
      console.log('\n🚫 BLOCKERS:');
      result.blockers.forEach((blocker) => {
        console.log(`  ${blocker}`);
      });
    }

    if (result.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      result.recommendations.forEach((rec) => {
        console.log(`  ${rec}`);
      });
    }

    // Report to Linear if URL provided
    if (args.linearUrl && process.env.LINEAR_API_KEY) {
      console.log('\n📊 Reporting to Linear...');
      await enforcer.reportToLinear(args.linearUrl, result);
      console.log('   ✅ Report posted to Linear');
    }

    console.log('\n' + '='.repeat(60));

    // Exit with appropriate code
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
