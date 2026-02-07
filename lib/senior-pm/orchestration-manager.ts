/**
 * Senior PM: Orchestration Manager
 *
 * Manages the multi-agent development workflow:
 * Developer → Senior PM → Orchestrator → Specialists → Senior PM → Developer
 *
 * Responsibilities:
 * - Receive developer requests
 * - Create Linear parent issues
 * - Assign Orchestrator for task decomposition
 * - Monitor specialist progress
 * - Escalate blockers to Developer
 * - Generate progress reports
 */

import { LinearOrchestrator } from '@/lib/linear/orchestrator';
import {
  AgentCommunicationBus,
  type AgentMessage,
  type MessagePriority,
} from '@/lib/agents/communication';
import { QualityGateEnforcer, type QualityGate } from '@/lib/agents/quality-gates';
import { createLogger } from '@/lib/logger';

const log = createLogger('senior-pm:orchestration');

// Developer request format
export interface DeveloperRequest {
  project: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  type: 'feature' | 'bug' | 'research' | 'refactor';
  title: string;
  description: string;
  constraints?: string;
  successCriteria: string[];
  deadline?: string; // ISO 8601
}

// Orchestrator task decomposition
export interface OrchestratorTask {
  id: string; // e.g., "ORCH-001"
  specialist: 'A' | 'B' | 'C' | 'D' | 'tax-agent';
  title: string;
  objective: string;
  context: string;
  acceptanceCriteria: string[];
  deliverables: string[];
  priority: number; // 1-5
  estimatedHours: number;
  dependsOn?: string[]; // Task IDs this depends on
}

// Progress tracking
export interface ProjectProgress {
  projectId: string;
  linearIssueUrl: string;
  status: 'planning' | 'in-progress' | 'review' | 'blocked' | 'complete';
  overallProgress: number; // 0-100
  specialists: {
    'specialist-a': SpecialistProgress;
    'specialist-b': SpecialistProgress;
    'specialist-c': SpecialistProgress;
    'specialist-d': SpecialistProgress;
  };
  blockers: Blocker[];
  qualityGatesPassed: QualityGate[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SpecialistProgress {
  tasksAssigned: number;
  tasksInProgress: number;
  tasksCompleted: number;
  currentTask?: {
    id: string;
    title: string;
    progress: number;
  };
  blockers: string[];
}

export interface Blocker {
  taskId: string;
  description: string;
  impact: string;
  proposedMitigation: string;
  reportedAt: string;
  resolvedAt?: string;
}

/**
 * Senior PM Orchestration Manager
 *
 * Coordinates multi-agent development workflow
 */
export class SeniorPMOrchestrationManager {
  private linear: LinearOrchestrator;
  private commBus: AgentCommunicationBus;
  private qualityGates: QualityGateEnforcer;
  private activeProjects: Map<string, ProjectProgress> = new Map();

  constructor(
    linearOrchestrator: LinearOrchestrator,
    communicationBus: AgentCommunicationBus,
    qualityGateEnforcer: QualityGateEnforcer
  ) {
    this.linear = linearOrchestrator;
    this.commBus = communicationBus;
    this.qualityGates = qualityGateEnforcer;
  }

  /**
   * PHASE 1: Receive Developer Request
   *
   * Developer provides a requirement → Senior PM creates Linear issue → Assigns Orchestrator
   */
  async receiveDeveloperRequest(request: DeveloperRequest): Promise<{
    status: 'accepted' | 'rejected';
    linearIssue?: { id: string; url: string; identifier: string };
    message: string;
  }> {
    log.info('Received developer request', { title: request.title });

    // Validate request
    if (!request.title || !request.description || !request.successCriteria.length) {
      return {
        status: 'rejected',
        message: 'Invalid request: Missing required fields (title, description, successCriteria)',
      };
    }

    try {
      // Create Linear parent issue
      const linearIssue = await this.linear.createParentIssue(request);

      log.info('Created Linear issue', { identifier: linearIssue.identifier, url: linearIssue.url });

      // Initialize project tracking
      const projectProgress: ProjectProgress = {
        projectId: linearIssue.id,
        linearIssueUrl: linearIssue.url,
        status: 'planning',
        overallProgress: 0,
        specialists: {
          'specialist-a': { tasksAssigned: 0, tasksInProgress: 0, tasksCompleted: 0, blockers: [] },
          'specialist-b': { tasksAssigned: 0, tasksInProgress: 0, tasksCompleted: 0, blockers: [] },
          'specialist-c': { tasksAssigned: 0, tasksInProgress: 0, tasksCompleted: 0, blockers: [] },
          'specialist-d': { tasksAssigned: 0, tasksInProgress: 0, tasksCompleted: 0, blockers: [] },
        },
        blockers: [],
        qualityGatesPassed: [],
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.activeProjects.set(linearIssue.id, projectProgress);

      // Send message to Orchestrator to start decomposition
      await this.commBus.sendMessage({
        from: 'senior-pm',
        to: 'orchestrator',
        type: 'task-assignment',
        priority: this.mapPriorityToMessage(request.priority),
        subject: `New Project: ${request.title}`,
        linearIssueUrl: linearIssue.url,
        content: `## Developer Request

**Project**: ${request.project}
**Priority**: ${request.priority}
**Type**: ${request.type}

### Description
${request.description}

${request.constraints ? `### Constraints\n${request.constraints}\n` : ''}

### Success Criteria
${request.successCriteria.map((c) => `- ${c}`).join('\n')}

${request.deadline ? `### Deadline\n${new Date(request.deadline).toLocaleString()}\n` : ''}

---

**Action Required**: Please decompose this into specialist tasks and create Linear sub-issues.`,
        actionRequired: [
          'Analyze requirements',
          'Decompose into specialist tasks',
          'Create Linear sub-issues with dependencies',
          'Assign specialists',
        ],
        deadline: request.deadline,
      });

      return {
        status: 'accepted',
        linearIssue: {
          id: linearIssue.id,
          url: linearIssue.url,
          identifier: linearIssue.identifier,
        },
        message: `Request accepted. Linear issue ${linearIssue.identifier} created. Orchestrator assigned for task decomposition.`,
      };
    } catch (error) {
      console.error('[Senior PM] Error creating Linear issue:', error);
      return {
        status: 'rejected',
        message: `Failed to create Linear issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * PHASE 2: Receive Orchestrator Task Decomposition
   *
   * Orchestrator decomposes → Senior PM approves → Orchestrator creates sub-issues
   */
  async receiveOrchestratorDecomposition(
    parentIssueId: string,
    tasks: OrchestratorTask[]
  ): Promise<{
    status: 'approved' | 'revision_required';
    message: string;
    linearSubIssues?: Array<{ id: string; url: string; identifier: string }>;
  }> {
    log.info('Reviewing orchestrator decomposition', { parentIssueId, taskCount: tasks.length });

    const progress = this.activeProjects.get(parentIssueId);
    if (!progress) {
      return {
        status: 'revision_required',
        message: 'Project not found in active tracking',
      };
    }

    // Validate decomposition
    const validation = this.validateDecomposition(tasks);
    if (!validation.valid) {
      return {
        status: 'revision_required',
        message: `Decomposition issues: ${validation.issues.join(', ')}`,
      };
    }

    try {
      // Create Linear sub-issues for each task
      const subIssues = await this.linear.createSpecialistTasks(parentIssueId, tasks);

      log.info('Created Linear sub-issues', { count: subIssues.length });

      // Update specialist task counts
      for (const task of tasks) {
        const specialistKey = this.getSpecialistKey(task.specialist);
        if (specialistKey && progress.specialists[specialistKey]) {
          progress.specialists[specialistKey].tasksAssigned++;
        }
      }

      progress.status = 'in-progress';
      progress.updatedAt = new Date().toISOString();

      // Send confirmation message to Orchestrator
      await this.commBus.sendMessage({
        from: 'senior-pm',
        to: 'orchestrator',
        type: 'status-update',
        priority: 'INFO',
        subject: 'Decomposition Approved',
        linearIssueUrl: progress.linearIssueUrl,
        content: `## Decomposition Approved

Reviewed ${tasks.length} tasks - all approved.

Linear sub-issues created:
${subIssues.map((issue) => `- ${issue.identifier}: ${issue.url}`).join('\n')}

**Next Steps**:
- Specialists will begin work on assigned tasks
- Monitor progress via Linear
- Escalate blockers to me if needed`,
      });

      return {
        status: 'approved',
        message: `Decomposition approved. ${subIssues.length} sub-issues created.`,
        linearSubIssues: subIssues,
      };
    } catch (error) {
      console.error('[Senior PM] Error creating sub-issues:', error);
      return {
        status: 'revision_required',
        message: `Failed to create sub-issues: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * PHASE 3: Monitor Specialist Progress
   *
   * Receive status updates from specialists → Track progress → Escalate if needed
   */
  async receiveSpecialistUpdate(message: AgentMessage): Promise<void> {
    log.info('Received specialist update', { from: message.from });

    // Extract project ID from Linear URL
    const projectId = this.extractProjectIdFromUrl(message.linearIssueUrl);
    if (!projectId) {
      console.warn('[Senior PM] Could not extract project ID from Linear URL');
      return;
    }

    const progress = this.activeProjects.get(projectId);
    if (!progress) {
      console.warn(`[Senior PM] Project ${projectId} not found in tracking`);
      return;
    }

    // Parse status update from message content
    const statusMatch = message.content.match(/\*\*Progress\*\*:\s*(\d+)%/);
    const blockersMatch = message.content.match(/\*\*Blockers\*\*:\s*([\s\S]*?)(?=\n\n|$)/);

    if (statusMatch) {
      const taskProgress = parseInt(statusMatch[1], 10);
      log.debug('Task progress update', { progress: taskProgress });

      // Update specialist progress
      const specialistKey = this.getSpecialistKeyFromRole(message.from);
      if (specialistKey && progress.specialists[specialistKey]) {
        if (taskProgress === 100) {
          progress.specialists[specialistKey].tasksCompleted++;
          progress.specialists[specialistKey].tasksInProgress--;
        } else if (taskProgress > 0 && !progress.specialists[specialistKey].currentTask) {
          progress.specialists[specialistKey].tasksInProgress++;
        }
      }
    }

    // Check for blockers
    if (blockersMatch && blockersMatch[1].includes('🚫')) {
      const blockerText = blockersMatch[1];
      console.warn(`[Senior PM] Blocker detected: ${blockerText}`);

      // Extract blocker details
      const blocker: Blocker = {
        taskId: message.linearIssueUrl || '',
        description: blockerText,
        impact: 'Blocking specialist progress',
        proposedMitigation: 'Requires investigation',
        reportedAt: new Date().toISOString(),
      };

      progress.blockers.push(blocker);
      progress.status = 'blocked';

      // Escalate to Developer if blocker is critical
      if (message.priority === 'CRITICAL' || message.priority === 'URGENT') {
        await this.escalateToDeveloper(progress, blocker);
      }
    }

    // Calculate overall progress
    progress.overallProgress = this.calculateOverallProgress(progress);
    progress.updatedAt = new Date().toISOString();
  }

  /**
   * PHASE 4: Quality Gate Monitoring
   *
   * Track quality gates passed → Update project status
   */
  async recordQualityGatePassed(projectId: string, gate: QualityGate): Promise<void> {
    log.info('Quality gate passed', { gate, projectId });

    const progress = this.activeProjects.get(projectId);
    if (!progress) {
      console.warn(`[Senior PM] Project ${projectId} not found`);
      return;
    }

    if (!progress.qualityGatesPassed.includes(gate)) {
      progress.qualityGatesPassed.push(gate);
      progress.updatedAt = new Date().toISOString();

      // Check if all gates passed
      const allGates: QualityGate[] = [
        'design-complete',
        'implementation-complete',
        'testing-complete',
        'documentation-complete',
        'integration-complete',
        'final-approval',
      ];

      if (allGates.every((g) => progress.qualityGatesPassed.includes(g))) {
        progress.status = 'complete';
        progress.completedAt = new Date().toISOString();

        await this.notifyDeveloperCompletion(progress);
      }
    }
  }

  /**
   * PHASE 5: Generate Progress Reports
   *
   * Daily/weekly reports for Developer visibility
   */
  async generateDailyReport(): Promise<string> {
    const activeCount = Array.from(this.activeProjects.values()).filter(
      (p) => p.status === 'in-progress' || p.status === 'blocked'
    ).length;

    const completedToday = Array.from(this.activeProjects.values()).filter(
      (p) => p.completedAt && this.isToday(new Date(p.completedAt))
    );

    const blockedProjects = Array.from(this.activeProjects.values()).filter(
      (p) => p.status === 'blocked'
    );

    let report = `# Senior PM Daily Report - ${new Date().toLocaleDateString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Active Projects**: ${activeCount}\n`;
    report += `- **Completed Today**: ${completedToday.length}\n`;
    report += `- **Blocked Projects**: ${blockedProjects.length}\n\n`;

    if (activeCount > 0) {
      report += `## Active Projects\n\n`;
      for (const [projectId, progress] of this.activeProjects.entries()) {
        if (progress.status === 'in-progress' || progress.status === 'blocked') {
          report += `### ${progress.linearIssueUrl}\n`;
          report += `- **Status**: ${progress.status}\n`;
          report += `- **Progress**: ${progress.overallProgress}%\n`;
          report += `- **Quality Gates**: ${progress.qualityGatesPassed.length}/6 passed\n\n`;

          // Specialist progress
          report += `**Specialists**:\n`;
          for (const [specialist, data] of Object.entries(progress.specialists)) {
            report += `- ${specialist}: ${data.tasksCompleted}/${data.tasksAssigned} completed`;
            if (data.tasksInProgress > 0) {
              report += ` (${data.tasksInProgress} in progress)`;
            }
            report += `\n`;
          }
          report += `\n`;
        }
      }
    }

    if (blockedProjects.length > 0) {
      report += `## Blockers\n\n`;
      for (const progress of blockedProjects) {
        report += `### ${progress.linearIssueUrl}\n`;
        for (const blocker of progress.blockers) {
          if (!blocker.resolvedAt) {
            report += `- **${blocker.description}**\n`;
            report += `  - Impact: ${blocker.impact}\n`;
            report += `  - Mitigation: ${blocker.proposedMitigation}\n\n`;
          }
        }
      }
    }

    if (completedToday.length > 0) {
      report += `## Completed Today\n\n`;
      for (const progress of completedToday) {
        report += `- ${progress.linearIssueUrl} (${progress.overallProgress}%)\n`;
      }
      report += `\n`;
    }

    return report;
  }

  /**
   * Get project status
   */
  getProjectStatus(projectId: string): ProjectProgress | undefined {
    return this.activeProjects.get(projectId);
  }

  /**
   * Get all active projects
   */
  getAllActiveProjects(): ProjectProgress[] {
    return Array.from(this.activeProjects.values()).filter(
      (p) => p.status !== 'complete'
    );
  }

  // Helper methods

  private validateDecomposition(tasks: OrchestratorTask[]): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (tasks.length === 0) {
      issues.push('No tasks provided');
    }

    // Check for circular dependencies
    const taskIds = new Set(tasks.map((t) => t.id));
    for (const task of tasks) {
      if (task.dependsOn) {
        for (const depId of task.dependsOn) {
          if (!taskIds.has(depId)) {
            issues.push(`Task ${task.id} depends on non-existent task ${depId}`);
          }
        }
      }
    }

    // Validate task IDs follow pattern
    for (const task of tasks) {
      if (!/^ORCH-\d+$/.test(task.id)) {
        issues.push(`Invalid task ID format: ${task.id} (expected ORCH-###)`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  private mapPriorityToMessage(priority: string): MessagePriority {
    const map: Record<string, MessagePriority> = {
      Critical: 'CRITICAL',
      High: 'URGENT',
      Medium: 'STANDARD',
      Low: 'INFO',
    };
    return map[priority] || 'STANDARD';
  }

  private getSpecialistKey(
    specialist: string
  ): keyof ProjectProgress['specialists'] | null {
    const map: Record<string, keyof ProjectProgress['specialists']> = {
      A: 'specialist-a',
      B: 'specialist-b',
      C: 'specialist-c',
      D: 'specialist-d',
    };
    return map[specialist] || null;
  }

  private getSpecialistKeyFromRole(role: string): keyof ProjectProgress['specialists'] | null {
    if (role.startsWith('specialist-')) {
      return role as keyof ProjectProgress['specialists'];
    }
    return null;
  }

  private extractProjectIdFromUrl(url?: string): string | null {
    if (!url) return null;
    // Extract Linear issue ID from URL
    const match = url.match(/issue\/([A-Z]+-\d+)/);
    return match ? match[1] : null;
  }

  private calculateOverallProgress(progress: ProjectProgress): number {
    let totalTasks = 0;
    let completedTasks = 0;

    for (const specialist of Object.values(progress.specialists)) {
      totalTasks += specialist.tasksAssigned;
      completedTasks += specialist.tasksCompleted;
    }

    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  }

  private async escalateToDeveloper(progress: ProjectProgress, blocker: Blocker): Promise<void> {
    log.info('Escalating blocker to Developer', { description: blocker.description });

    await this.commBus.sendMessage({
      from: 'senior-pm',
      to: 'developer',
      type: 'escalation',
      priority: 'URGENT',
      subject: `Blocker Requires Developer Decision`,
      linearIssueUrl: progress.linearIssueUrl,
      content: `## Blocker Escalation

**Project**: ${progress.linearIssueUrl}
**Status**: ${progress.status}
**Progress**: ${progress.overallProgress}%

### Blocker Details

**Description**: ${blocker.description}

**Impact**: ${blocker.impact}

**Proposed Mitigation**: ${blocker.proposedMitigation}

**Reported**: ${new Date(blocker.reportedAt).toLocaleString()}

---

**Action Required**: Please review and provide guidance on how to proceed.`,
      actionRequired: ['Review blocker', 'Provide decision/guidance', 'Authorize mitigation'],
    });
  }

  private async notifyDeveloperCompletion(progress: ProjectProgress): Promise<void> {
    log.info('Notifying Developer of project completion');

    await this.commBus.sendMessage({
      from: 'senior-pm',
      to: 'developer',
      type: 'status-update',
      priority: 'INFO',
      subject: `Project Complete: Ready for Review`,
      linearIssueUrl: progress.linearIssueUrl,
      content: `## Project Complete ✅

**Project**: ${progress.linearIssueUrl}
**Completed**: ${new Date(progress.completedAt!).toLocaleString()}
**Duration**: ${this.calculateDuration(progress.startedAt, progress.completedAt!)}

### Summary

- **Overall Progress**: ${progress.overallProgress}%
- **Quality Gates**: ${progress.qualityGatesPassed.length}/6 passed
- **Blockers**: ${progress.blockers.filter((b) => !b.resolvedAt).length} unresolved

### Specialist Contributions

${Object.entries(progress.specialists)
  .map(
    ([specialist, data]) =>
      `- **${specialist}**: ${data.tasksCompleted}/${data.tasksAssigned} tasks completed`
  )
  .join('\n')}

---

**Next Steps**: Please review the completed work and provide final approval for deployment.`,
    });
  }

  private calculateDuration(start: string, end: string): string {
    const durationMs = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
    }

    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }
}

/**
 * Create singleton instance
 */
export function createSeniorPMOrchestrationManager(
  linearOrchestrator: LinearOrchestrator,
  communicationBus: AgentCommunicationBus,
  qualityGateEnforcer: QualityGateEnforcer
): SeniorPMOrchestrationManager {
  return new SeniorPMOrchestrationManager(
    linearOrchestrator,
    communicationBus,
    qualityGateEnforcer
  );
}
