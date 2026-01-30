/**
 * Quality Gates Enforcement
 *
 * Automated checks to ensure quality standards before allowing phase transitions.
 * Implements 6 quality gates: design, implementation, testing, documentation, integration, final approval.
 */

import { promises as fs } from 'fs';
import { LinearOrchestrator } from '@/lib/linear/orchestrator';

// Quality gate types
export type QualityGate =
  | 'design-complete'
  | 'implementation-complete'
  | 'testing-complete'
  | 'documentation-complete'
  | 'integration-complete'
  | 'final-approval';

// Quality gate result
export interface QualityGateResult {
  gate: QualityGate;
  passed: boolean;
  score: number; // 0-100
  checks: QualityCheck[];
  blockers: string[];
  recommendations: string[];
  timestamp: string;
}

// Individual quality check
export interface QualityCheck {
  category: 'functional' | 'technical' | 'documentation' | 'testing';
  name: string;
  required: boolean;
  passed: boolean;
  details?: string;
}

/**
 * Quality Gate Enforcer
 *
 * Validates quality standards before allowing phase transitions.
 */
export class QualityGateEnforcer {
  private linearOrchestrator: LinearOrchestrator;

  constructor(linearOrchestrator: LinearOrchestrator) {
    this.linearOrchestrator = linearOrchestrator;
  }

  /**
   * Gate 1: Check if design phase is complete and ready for implementation
   *
   * Required: ADR, system diagrams, risks documented
   * Optional: API spec, ERD
   */
  async checkDesignComplete(
    taskId: string,
    artifacts: {
      adrPath?: string;
      diagramPaths?: string[];
      apiSpecPath?: string;
      erdPath?: string;
      risksDocumented?: boolean;
    }
  ): Promise<QualityGateResult> {
    const checks: QualityCheck[] = [];

    // Required checks
    checks.push({
      category: 'documentation',
      name: 'Architecture Decision Record (ADR) exists',
      required: true,
      passed: !!artifacts.adrPath && (await this.fileExists(artifacts.adrPath)),
      details: artifacts.adrPath,
    });

    checks.push({
      category: 'documentation',
      name: 'System diagrams complete',
      required: true,
      passed: !!artifacts.diagramPaths && artifacts.diagramPaths.length > 0,
      details: `${artifacts.diagramPaths?.length || 0} diagrams provided`,
    });

    checks.push({
      category: 'documentation',
      name: 'Risks documented with mitigations',
      required: true,
      passed: !!artifacts.risksDocumented,
    });

    // Optional but recommended checks
    checks.push({
      category: 'technical',
      name: 'API specification provided',
      required: false,
      passed: !!artifacts.apiSpecPath && (await this.fileExists(artifacts.apiSpecPath)),
      details: artifacts.apiSpecPath,
    });

    checks.push({
      category: 'technical',
      name: 'Database ERD provided',
      required: false,
      passed: !!artifacts.erdPath && (await this.fileExists(artifacts.erdPath)),
      details: artifacts.erdPath,
    });

    return this.evaluateGate('design-complete', checks);
  }

  /**
   * Gate 2: Check if implementation is complete and ready for testing
   *
   * Required: Code files, compiles successfully, linting passes, basic functionality works
   */
  async checkImplementationComplete(
    taskId: string,
    artifacts: {
      codePaths: string[];
      compilesSuccessfully: boolean;
      lintingPasses: boolean;
      basicFunctionalityWorks: boolean;
    }
  ): Promise<QualityGateResult> {
    const checks: QualityCheck[] = [];

    checks.push({
      category: 'technical',
      name: 'Code files created',
      required: true,
      passed: artifacts.codePaths.length > 0,
      details: `${artifacts.codePaths.length} files`,
    });

    checks.push({
      category: 'technical',
      name: 'Code compiles without errors',
      required: true,
      passed: artifacts.compilesSuccessfully,
    });

    checks.push({
      category: 'technical',
      name: 'Linting passes',
      required: true,
      passed: artifacts.lintingPasses,
    });

    checks.push({
      category: 'functional',
      name: 'Basic functionality verified',
      required: true,
      passed: artifacts.basicFunctionalityWorks,
    });

    // Verify files exist
    for (const codePath of artifacts.codePaths) {
      const exists = await this.fileExists(codePath);
      checks.push({
        category: 'technical',
        name: `File exists: ${codePath}`,
        required: false,
        passed: exists,
        details: codePath,
      });
    }

    return this.evaluateGate('implementation-complete', checks);
  }

  /**
   * Gate 3: Check if testing is complete and ready for documentation
   *
   * Required: Test files, all tests pass, coverage ≥80%, no critical bugs
   */
  async checkTestingComplete(
    taskId: string,
    artifacts: {
      testFilePaths: string[];
      allTestsPass: boolean;
      coveragePercentage: number;
      noCriticalBugs: boolean;
    }
  ): Promise<QualityGateResult> {
    const checks: QualityCheck[] = [];

    checks.push({
      category: 'testing',
      name: 'Test files created',
      required: true,
      passed: artifacts.testFilePaths.length > 0,
      details: `${artifacts.testFilePaths.length} test files`,
    });

    checks.push({
      category: 'testing',
      name: 'All tests passing',
      required: true,
      passed: artifacts.allTestsPass,
    });

    checks.push({
      category: 'testing',
      name: 'Code coverage ≥ 80%',
      required: true,
      passed: artifacts.coveragePercentage >= 80,
      details: `${artifacts.coveragePercentage.toFixed(1)}% coverage`,
    });

    checks.push({
      category: 'functional',
      name: 'No critical bugs',
      required: true,
      passed: artifacts.noCriticalBugs,
    });

    // Verify test files exist
    for (const testPath of artifacts.testFilePaths) {
      const exists = await this.fileExists(testPath);
      checks.push({
        category: 'testing',
        name: `Test file exists: ${testPath}`,
        required: false,
        passed: exists,
        details: testPath,
      });
    }

    return this.evaluateGate('testing-complete', checks);
  }

  /**
   * Gate 4: Check if documentation is complete
   *
   * Required: Technical docs, API docs, changelog updated
   * Optional: Examples provided
   */
  async checkDocumentationComplete(
    taskId: string,
    artifacts: {
      techDocsPaths: string[];
      apiDocsComplete: boolean;
      changelogUpdated: boolean;
      examplesProvided: boolean;
    }
  ): Promise<QualityGateResult> {
    const checks: QualityCheck[] = [];

    checks.push({
      category: 'documentation',
      name: 'Technical documentation written',
      required: true,
      passed: artifacts.techDocsPaths.length > 0,
      details: `${artifacts.techDocsPaths.length} documentation files`,
    });

    checks.push({
      category: 'documentation',
      name: 'API documentation complete',
      required: true,
      passed: artifacts.apiDocsComplete,
    });

    checks.push({
      category: 'documentation',
      name: 'Changelog updated',
      required: true,
      passed: artifacts.changelogUpdated,
    });

    checks.push({
      category: 'documentation',
      name: 'Examples provided',
      required: false,
      passed: artifacts.examplesProvided,
    });

    // Verify docs files exist
    for (const docPath of artifacts.techDocsPaths) {
      const exists = await this.fileExists(docPath);
      checks.push({
        category: 'documentation',
        name: `Documentation file exists: ${docPath}`,
        required: false,
        passed: exists,
        details: docPath,
      });
    }

    return this.evaluateGate('documentation-complete', checks);
  }

  /**
   * Gate 5: Check if all outputs are integrated and system is functional
   *
   * Required: All outputs merged, system functional, no merge conflicts, prior gates passed
   */
  async checkIntegrationComplete(
    taskId: string,
    artifacts: {
      allOutputsMerged: boolean;
      systemFunctional: boolean;
      noMergeConflicts: boolean;
      qualityGatesPassed: QualityGate[];
    }
  ): Promise<QualityGateResult> {
    const checks: QualityCheck[] = [];

    checks.push({
      category: 'technical',
      name: 'All specialist outputs merged',
      required: true,
      passed: artifacts.allOutputsMerged,
    });

    checks.push({
      category: 'functional',
      name: 'Integrated system functional',
      required: true,
      passed: artifacts.systemFunctional,
    });

    checks.push({
      category: 'technical',
      name: 'No merge conflicts',
      required: true,
      passed: artifacts.noMergeConflicts,
    });

    const priorGatesRequired: QualityGate[] = [
      'design-complete',
      'implementation-complete',
      'testing-complete',
      'documentation-complete',
    ];

    const allPriorGatesPassed = priorGatesRequired.every((gate) =>
      artifacts.qualityGatesPassed.includes(gate)
    );

    checks.push({
      category: 'functional',
      name: 'All prior quality gates passed',
      required: true,
      passed: allPriorGatesPassed,
      details: `Passed: ${artifacts.qualityGatesPassed.join(', ')}`,
    });

    // Check each prior gate individually
    for (const gate of priorGatesRequired) {
      checks.push({
        category: 'functional',
        name: `Quality gate "${gate}" passed`,
        required: false,
        passed: artifacts.qualityGatesPassed.includes(gate),
      });
    }

    return this.evaluateGate('integration-complete', checks);
  }

  /**
   * Gate 6: Final approval gate before deployment
   *
   * Required: Meets requirements, ready for deployment, PM approved, Developer approved
   */
  async checkFinalApproval(
    taskId: string,
    artifacts: {
      meetsRequirements: boolean;
      readyForDeployment: boolean;
      pmApproved: boolean;
      developerApproved: boolean;
    }
  ): Promise<QualityGateResult> {
    const checks: QualityCheck[] = [];

    checks.push({
      category: 'functional',
      name: 'Meets original requirements',
      required: true,
      passed: artifacts.meetsRequirements,
    });

    checks.push({
      category: 'technical',
      name: 'Ready for deployment',
      required: true,
      passed: artifacts.readyForDeployment,
    });

    checks.push({
      category: 'functional',
      name: 'Senior PM approval',
      required: true,
      passed: artifacts.pmApproved,
    });

    checks.push({
      category: 'functional',
      name: 'Developer approval',
      required: true,
      passed: artifacts.developerApproved,
    });

    return this.evaluateGate('final-approval', checks);
  }

  /**
   * Report quality gate result to Linear
   */
  async reportToLinear(linearIssueUrl: string, result: QualityGateResult): Promise<void> {
    const issueId = this.extractIssueId(linearIssueUrl);
    if (!issueId) {
      console.error('Invalid Linear URL:', linearIssueUrl);
      return;
    }

    const emoji = result.passed ? '✅' : '❌';
    const status = result.passed ? 'PASSED' : 'FAILED';
    const gateTitle = result.gate
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const comment = `${emoji} **Quality Gate: ${gateTitle} - ${status}**

**Score**: ${result.score.toFixed(0)}% (${result.checks.filter((c) => c.passed).length}/${
      result.checks.length
    } checks passed)

### Checks
${result.checks
  .map((c) => {
    const icon = c.passed ? '✅' : c.required ? '❌' : '⚠️ ';
    const req = c.required ? '(required)' : '(recommended)';
    return `${icon} ${c.name} ${req}${c.details ? ` - ${c.details}` : ''}`;
  })
  .join('\n')}

${
  result.blockers.length > 0
    ? `### Blockers
${result.blockers.join('\n')}

**Action Required**: Fix blockers before proceeding to next phase.`
    : ''
}

${
  result.recommendations.length > 0
    ? `### Recommendations
${result.recommendations.join('\n')}`
    : ''
}

---
*Quality gate evaluated: ${new Date(result.timestamp).toLocaleString()}*`;

    await this.linearOrchestrator.client.commentCreate({
      issueId,
      body: comment,
    });

    // If failed, update status to blocked
    if (!result.passed) {
      await this.linearOrchestrator.updateTaskStatus(
        issueId,
        'blocked',
        'Quality gate failed - see blockers above'
      );
    }
  }

  /**
   * Evaluate a quality gate and return result
   */
  private evaluateGate(gate: QualityGate, checks: QualityCheck[]): QualityGateResult {
    const requiredChecks = checks.filter((c) => c.required);
    const passedRequiredChecks = requiredChecks.filter((c) => c.passed);
    const passedAllChecks = checks.filter((c) => c.passed);

    const passed = passedRequiredChecks.length === requiredChecks.length;
    const score = (passedAllChecks.length / checks.length) * 100;

    const blockers = checks.filter((c) => c.required && !c.passed).map((c) => `❌ ${c.name}`);

    const recommendations = checks
      .filter((c) => !c.required && !c.passed)
      .map((c) => `⚠️  ${c.name} (recommended)`);

    return {
      gate,
      passed,
      score,
      checks,
      blockers,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  // Helper methods

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private extractIssueId(linearUrl: string): string | null {
    const match = linearUrl.match(/issue\/([A-Z]+-\d+)/);
    return match ? match[1] : null;
  }
}

/**
 * Create a singleton quality gate enforcer instance
 */
export function createQualityGateEnforcer(
  linearOrchestrator: LinearOrchestrator
): QualityGateEnforcer {
  return new QualityGateEnforcer(linearOrchestrator);
}

/**
 * Quality gate metadata - defines gate order and dependencies
 */
export const QUALITY_GATE_METADATA: Record<
  QualityGate,
  {
    order: number;
    title: string;
    blocksPhases: string[];
    requiresGates: QualityGate[];
  }
> = {
  'design-complete': {
    order: 1,
    title: 'Design Complete',
    blocksPhases: ['implementation'],
    requiresGates: [],
  },
  'implementation-complete': {
    order: 2,
    title: 'Implementation Complete',
    blocksPhases: ['testing'],
    requiresGates: ['design-complete'],
  },
  'testing-complete': {
    order: 3,
    title: 'Testing Complete',
    blocksPhases: ['documentation'],
    requiresGates: ['implementation-complete'],
  },
  'documentation-complete': {
    order: 4,
    title: 'Documentation Complete',
    blocksPhases: ['integration'],
    requiresGates: ['testing-complete'],
  },
  'integration-complete': {
    order: 5,
    title: 'Integration Complete',
    blocksPhases: ['final-approval'],
    requiresGates: [
      'design-complete',
      'implementation-complete',
      'testing-complete',
      'documentation-complete',
    ],
  },
  'final-approval': {
    order: 6,
    title: 'Final Approval',
    blocksPhases: ['deployment'],
    requiresGates: ['integration-complete'],
  },
};
