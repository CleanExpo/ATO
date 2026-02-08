/**
 * Linear Orchestrator - Agent Task Management
 *
 * Provides automated Linear integration for the multi-agent framework.
 * Manages issue creation, status updates, dependency tracking, and reporting.
 */

import { LinearClient } from '@linear/sdk';

type IssueCreateInput = Parameters<LinearClient['createIssue']>[0];

// Types
export interface DeveloperRequest {
  project: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  type: 'feature' | 'bug' | 'research' | 'refactor';
  title: string;
  description: string;
  constraints?: string;
  successCriteria: string[];
}

export interface OrchestratorTask {
  id: string;
  specialist: 'A' | 'B' | 'C' | 'D' | 'tax-agent';
  title: string;
  objective: string;
  context: string;
  acceptanceCriteria: string[];
  deliverables: string[];
  priority: number;
  estimatedHours: number;
  dependsOn?: string[];
}

export interface LinearIssue {
  id: string;
  url: string;
  identifier: string;
}

export interface DailyReport {
  date: string;
  specialistCounts: Record<string, number>;
  completedToday: string[];
  blocked: Array<{ title: string; url: string }>;
  totalActive: number;
}

export type TaskStatus = 'pending' | 'in-progress' | 'blocked' | 'review' | 'done';

/**
 * Linear Orchestrator
 *
 * Automates Linear issue management for multi-agent workflows.
 */
export class LinearOrchestrator {
  private client: LinearClient;
  private teamId: string;
  private projectId: string;
  private teamUuid?: string;
  private projectUuid?: string;

  constructor() {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      throw new Error('LINEAR_API_KEY environment variable is required');
    }

    this.client = new LinearClient({ apiKey });
    this.teamId = process.env.LINEAR_TEAM_ID || 'unite-hub';
    // Project name
    this.projectId = process.env.LINEAR_PROJECT_NAME || 'ATO';
  }

  /**
   * Initialize team and project UUIDs
   */
  private async initialize(): Promise<void> {
    if (this.teamUuid && this.projectUuid) {
      return; // Already initialized
    }

    // Get team UUID
    const team = await this.client.team(this.teamId);
    if (!team) {
      throw new Error(`Team not found: ${this.teamId}`);
    }
    this.teamUuid = team.id;

    // Get project UUID
    const projects = await team.projects();

    // Match by project name (case-insensitive)
    const project = projects.nodes.find(p =>
      p.name.toLowerCase() === this.projectId.toLowerCase()
    );

    if (!project) {
      const availableProjects = projects.nodes.map(p => p.name).join(', ');
      throw new Error(`Project "${this.projectId}" not found. Available: ${availableProjects}`);
    }

    this.projectUuid = project.id;
  }

  /**
   * Create a parent issue from Developer request
   */
  async createParentIssue(request: DeveloperRequest): Promise<LinearIssue> {
    await this.initialize();

    const description = this.formatDeveloperRequest(request);
    const priority = this.mapPriority(request.priority);
    const labels = await this.getLabels(['agent:orchestrator', `type:${request.type}`]);

    const issuePayload: IssueCreateInput = {
      teamId: this.teamUuid!,
      projectId: this.projectUuid,
      title: request.title,
      description,
      priority,
      labelIds: labels,
    };

    const issueResult = await this.client.createIssue(issuePayload);
    const issue = await issueResult.issue;

    if (!issue) {
      throw new Error('Failed to create parent issue');
    }

    return {
      id: issue.id,
      url: issue.url,
      identifier: issue.identifier,
    };
  }

  /**
   * Decompose parent issue into specialist sub-tasks
   */
  async createSpecialistTasks(
    parentIssueId: string,
    tasks: OrchestratorTask[]
  ): Promise<LinearIssue[]> {
    await this.initialize();

    const subTasks: LinearIssue[] = [];

    for (const task of tasks) {
      const description = this.formatTaskAssignment(task);
      const agentLabel = task.specialist === 'tax-agent'
        ? 'agent:tax'
        : `agent:specialist-${task.specialist.toLowerCase()}`;
      const labels = await this.getLabels([agentLabel, 'status:pending']);

      const issuePayload: IssueCreateInput = {
        teamId: this.teamUuid!,
        projectId: this.projectUuid,
        parentId: parentIssueId,
        title: `[${task.specialist}] ${task.title}`,
        description,
        priority: task.priority,
        labelIds: labels,
        estimate: task.estimatedHours,
      };

      const issueResult = await this.client.createIssue(issuePayload);
      const issue = await issueResult.issue;

      if (!issue) {
        throw new Error(`Failed to create sub-task: ${task.title}`);
      }

      subTasks.push({
        id: issue.id,
        url: issue.url,
        identifier: issue.identifier,
      });

      // Create dependencies if specified
      if (task.dependsOn && task.dependsOn.length > 0) {
        for (const depId of task.dependsOn) {
          await this.client.createIssueRelation({
            issueId: issue.id,
            relatedIssueId: depId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- IssueRelationType enum doesn't accept string literals
            type: 'blocks' as any, // This task is blocked by dependency
          });
        }
      }
    }

    return subTasks;
  }

  /**
   * Update task status when agent state changes
   */
  async updateTaskStatus(
    issueId: string,
    status: TaskStatus,
    comment?: string
  ): Promise<void> {
    // Update labels
    const statusLabels = await this.getLabels([`status:${status}`]);

    await this.client.updateIssue(issueId, {
      labelIds: statusLabels,
    });

    // Add comment if provided
    if (comment) {
      await this.client.createComment({
        issueId,
        body: this.formatStatusComment(status, comment),
      });
    }

    // If status is 'done', mark issue as completed
    if (status === 'done') {
      const completedState = await this.getCompletedState();
      if (completedState) {
        await this.client.updateIssue(issueId, {
          stateId: completedState.id,
        });
      }
    }
  }

  /**
   * Add blocker comment with escalation
   */
  async reportBlocker(
    issueId: string,
    blockerDescription: string,
    proposedMitigation: string
  ): Promise<void> {
    await this.updateTaskStatus(issueId, 'blocked');

    const comment = `## 🚫 BLOCKER

**Description**: ${blockerDescription}

**Proposed Mitigation**: ${proposedMitigation}

**Status**: Escalated to Senior PM for resolution

cc: @senior-pm

---
*Reported: ${new Date().toISOString()}*`;

    await this.client.createComment({
      issueId,
      body: comment,
    });
  }

  /**
   * Generate daily status report across all active tasks
   */
  async generateDailyReport(): Promise<DailyReport> {
    // Fetch team to get proper ID
    const team = await this.client.team(this.teamId);
    if (!team) {
      throw new Error(`Team not found: ${this.teamId}`);
    }

    // Fetch all issues for the team
    const activeIssues = await this.client.issues({
      filter: {
        team: { id: { eq: team.id } },
      },
    });

    const specialists: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const completedToday: string[] = [];
    const blocked: Array<{ title: string; url: string }> = [];
    let totalActive = 0;

    for await (const issue of activeIssues.nodes) {
      const state = await issue.state;
      const isCompleted = state?.type === 'completed';

      // Count active (non-completed) issues
      if (!isCompleted) {
        totalActive++;

        // Count by specialist
        const labels = await issue.labels();
        const specialistLabel = labels.nodes.find(l => l.name.startsWith('agent:specialist-'));
        if (specialistLabel) {
          const specialist = specialistLabel.name.split('-')[2]?.toUpperCase();
          if (specialist && specialists[specialist] !== undefined) {
            specialists[specialist]++;
          }
        }

        // Check if blocked
        const isBlocked = labels.nodes.some(l => l.name === 'status:blocked');
        if (isBlocked) {
          blocked.push({ title: issue.title, url: issue.url });
        }
      }

      // Check if completed today (regardless of current state)
      if (issue.completedAt && this.isToday(new Date(issue.completedAt))) {
        completedToday.push(issue.title);
      }
    }

    return {
      date: new Date().toISOString(),
      specialistCounts: specialists,
      completedToday,
      blocked,
      totalActive,
    };
  }

  // Helper methods

  private formatDeveloperRequest(request: DeveloperRequest): string {
    return `## Developer Request
**Project:** ${request.project}
**Priority:** ${request.priority}
**Type:** ${request.type}

### Description
${request.description}

### Constraints
${request.constraints || 'None specified'}

### Success Criteria
${request.successCriteria.map(c => `- ${c}`).join('\n')}

---
*Created via Multi-Agent Framework*`;
  }

  private formatTaskAssignment(task: OrchestratorTask): string {
    return `## Task Assignment
**Task ID:** ${task.id}
**Assigned To:** Specialist ${task.specialist}
**Priority:** ${task.priority}
**Estimated Effort:** ${task.estimatedHours} hours

### Objective
${task.objective}

### Context
${task.context}

### Acceptance Criteria
${task.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')}

### Deliverables
${task.deliverables.map((d, i) => `${i + 1}. ${d}`).join('\n')}

${task.dependsOn && task.dependsOn.length > 0 ? `### Dependencies
- Blocked by: ${task.dependsOn.join(', ')}` : ''}

---
*Assigned via Orchestrator*`;
  }

  private formatStatusComment(status: TaskStatus, comment: string): string {
    const emoji: Record<TaskStatus, string> = {
      pending: '⏸️',
      'in-progress': '🚀',
      blocked: '🚫',
      review: '👀',
      done: '✅',
    };

    return `${emoji[status]} **Status Update: ${status.toUpperCase()}**

${comment}

---
*Updated: ${new Date().toISOString()}*`;
  }

  private mapPriority(priority: string): number {
    const map: Record<string, number> = {
      Critical: 1,
      High: 2,
      Medium: 3,
      Low: 4
    };
    return map[priority] || 3;
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  private async getLabels(labelNames: string[]): Promise<string[]> {
    try {
      const labels = await this.client.issueLabels();
      return labels.nodes
        .filter(l => labelNames.includes(l.name))
        .map(l => l.id);
    } catch (error) {
      console.error('Failed to fetch labels:', error);
      return [];
    }
  }

  private async getCompletedState() {
    try {
      const states = await this.client.workflowStates({
        filter: { name: { eq: 'Done' } }
      });
      return states.nodes[0] || null;
    } catch (error) {
      console.error('Failed to fetch completed state:', error);
      return null;
    }
  }

  /**
   * Extract issue ID from Linear URL
   */
  private extractIssueId(linearUrl: string): string {
    const match = linearUrl.match(/issue\/([A-Z]+-\d+)/);
    return match ? match[1] : '';
  }
}

/**
 * Create a singleton instance for use across the application
 */
export function createLinearOrchestrator(): LinearOrchestrator {
  return new LinearOrchestrator();
}
