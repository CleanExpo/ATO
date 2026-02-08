/**
 * Inter-Agent Communication Protocol
 *
 * Standardized message formats and routing for agent communication.
 * Implements priority-based routing, message history, and Linear integration.
 */

import { LinearOrchestrator } from '@/lib/linear/orchestrator';
import { createLogger } from '@/lib/logger';

const log = createLogger('agents:communication');

// Agent role definitions
export type AgentRole =
  | 'developer'
  | 'senior-pm'
  | 'orchestrator'
  | 'specialist-a-architect'
  | 'specialist-b-developer'
  | 'specialist-c-tester'
  | 'specialist-d-reviewer'
  | 'tax-agent'; // Any of the 18 tax domain agents

// Message priority levels with SLA implications
export type MessagePriority = 'CRITICAL' | 'URGENT' | 'STANDARD' | 'INFO';

// Message types for different communication patterns
export type MessageType =
  | 'task-assignment'
  | 'status-update'
  | 'blocker-report'
  | 'handoff'
  | 'escalation'
  | 'quality-review';

// Core message structure
export interface AgentMessage {
  messageId: string;
  threadId?: string; // For conversation continuity
  timestamp: string; // ISO 8601
  from: AgentRole;
  to: AgentRole;
  type: MessageType;
  priority: MessagePriority;
  subject: string;
  linearIssueUrl?: string;
  content: string;
  actionRequired?: string[];
  deadline?: string; // ISO 8601
  attachments?: MessageAttachment[];
}

// Message attachments (files, code, diagrams, reports)
export interface MessageAttachment {
  type: 'file' | 'code' | 'diagram' | 'report';
  name: string;
  path: string;
  description?: string;
}

/**
 * Agent Communication Bus
 *
 * Central message routing and history management for inter-agent communication.
 */
export class AgentCommunicationBus {
  private messageLog: AgentMessage[] = [];
  private linearOrchestrator: LinearOrchestrator;

  constructor(linearOrchestrator: LinearOrchestrator) {
    this.linearOrchestrator = linearOrchestrator;
  }

  /**
   * Send a message from one agent to another
   *
   * @param message - Message to send (without messageId and timestamp)
   * @returns Message ID for tracking
   */
  async sendMessage(message: Omit<AgentMessage, 'messageId' | 'timestamp'>): Promise<string> {
    const fullMessage: AgentMessage = {
      ...message,
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString(),
    };

    // Log message in history
    this.messageLog.push(fullMessage);

    // If priority is CRITICAL or URGENT, also post to Linear
    if (['CRITICAL', 'URGENT'].includes(message.priority) && message.linearIssueUrl) {
      const issueId = this.extractIssueId(message.linearIssueUrl);
      if (issueId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Linear SDK private property access
        await (this.linearOrchestrator as any).client.createComment({
          issueId,
          body: this.formatMessageForLinear(fullMessage),
        });
      }
    }

    // Route message to recipient (in production, this would trigger agent execution)
    await this.routeMessage(fullMessage);

    return fullMessage.messageId;
  }

  /**
   * Create a task assignment message (Orchestrator → Specialist)
   */
  createTaskAssignment(
    from: 'orchestrator',
    to: AgentRole,
    taskId: string,
    linearIssueUrl: string,
    taskDetails: {
      objective: string;
      acceptanceCriteria: string[];
      deliverables: string[];
      deadline?: string;
    }
  ): Omit<AgentMessage, 'messageId' | 'timestamp'> {
    return {
      from,
      to,
      type: 'task-assignment',
      priority: 'STANDARD',
      subject: `Task Assignment: ${taskId}`,
      linearIssueUrl,
      content: `## Task Assignment

**Objective**: ${taskDetails.objective}

**Acceptance Criteria**:
${taskDetails.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')}

**Deliverables**:
${taskDetails.deliverables.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Please review the full task details in Linear and begin work when ready.`,
      actionRequired: ['Review task', 'Begin work', 'Update status to in-progress'],
      deadline: taskDetails.deadline,
    };
  }

  /**
   * Create a status update message (Specialist → Orchestrator/PM)
   */
  createStatusUpdate(
    from: AgentRole,
    to: 'orchestrator' | 'senior-pm',
    linearIssueUrl: string,
    status: {
      progress: number; // 0-100
      completed: string[];
      inProgress: string[];
      blockers?: string[];
    }
  ): Omit<AgentMessage, 'messageId' | 'timestamp'> {
    const hasBlockers = status.blockers && status.blockers.length > 0;

    return {
      from,
      to,
      type: 'status-update',
      priority: hasBlockers ? 'URGENT' : 'INFO',
      subject: `Status Update: ${status.progress}% Complete`,
      linearIssueUrl,
      content: `## Status Update

**Progress**: ${status.progress}%

**Completed**:
${status.completed.length > 0 ? status.completed.map(c => `- ✅ ${c}`).join('\n') : '- None yet'}

**In Progress**:
${status.inProgress.length > 0 ? status.inProgress.map(c => `- 🚀 ${c}`).join('\n') : '- None'}

${hasBlockers ? `**Blockers**:
${status.blockers!.map(b => `- 🚫 ${b}`).join('\n')}` : ''}`,
    };
  }

  /**
   * Create an escalation message (Any → Orchestrator/PM/Developer)
   */
  createEscalation(
    from: AgentRole,
    to: 'orchestrator' | 'senior-pm' | 'developer',
    linearIssueUrl: string,
    escalationDetails: {
      issue: string;
      impact: string;
      proposedSolution: string;
      urgency: 'high' | 'medium';
    }
  ): Omit<AgentMessage, 'messageId' | 'timestamp'> {
    return {
      from,
      to,
      type: 'escalation',
      priority: escalationDetails.urgency === 'high' ? 'URGENT' : 'STANDARD',
      subject: `Escalation: ${escalationDetails.issue}`,
      linearIssueUrl,
      content: `## Escalation Required

**Issue**: ${escalationDetails.issue}

**Impact**: ${escalationDetails.impact}

**Proposed Solution**: ${escalationDetails.proposedSolution}

**Decision Needed**: Please review and provide guidance.`,
      actionRequired: ['Review escalation', 'Provide decision', 'Unblock work'],
    };
  }

  /**
   * Create a handoff message between specialists
   */
  createHandoff(
    from: AgentRole,
    to: AgentRole,
    linearIssueUrl: string,
    handoffDetails: {
      workSummary: string;
      keyDecisions: string[];
      artifacts: MessageAttachment[];
      assumptions: string[];
      openQuestions?: string[];
      nextPhaseContext: string;
    }
  ): Omit<AgentMessage, 'messageId' | 'timestamp'> {
    const hasOpenQuestions = handoffDetails.openQuestions && handoffDetails.openQuestions.length > 0;

    return {
      from,
      to,
      type: 'handoff',
      priority: 'STANDARD',
      subject: `Handoff: ${from} → ${to}`,
      linearIssueUrl,
      content: `## Context Handoff

**Work Summary**: ${handoffDetails.workSummary}

**Key Decisions**:
${handoffDetails.keyDecisions.map(d => `- ${d}`).join('\n')}

**Artifacts Created**:
${handoffDetails.artifacts.map(a => `- ${a.type}: ${a.name} (${a.path})`).join('\n')}

**Assumptions**:
${handoffDetails.assumptions.map(a => `- ${a}`).join('\n')}

${hasOpenQuestions ? `**Open Questions**:
${handoffDetails.openQuestions!.map(q => `- ❓ ${q}`).join('\n')}` : ''}

**Context for Next Phase**: ${handoffDetails.nextPhaseContext}`,
      attachments: handoffDetails.artifacts,
      actionRequired: ['Review handoff context', 'Begin next phase'],
    };
  }

  /**
   * Create a quality review message (Reviewer → Original Author)
   */
  createQualityReview(
    from: 'specialist-d-reviewer' | 'orchestrator',
    to: AgentRole,
    linearIssueUrl: string,
    reviewDetails: {
      reviewType: 'code-review' | 'documentation-review' | 'quality-gate';
      approved: boolean;
      score?: number; // 0-100
      findings: Array<{
        severity: 'critical' | 'major' | 'minor' | 'suggestion';
        category: 'functional' | 'technical' | 'documentation' | 'testing';
        description: string;
      }>;
      recommendations?: string[];
    }
  ): Omit<AgentMessage, 'messageId' | 'timestamp'> {
    const hasCritical = reviewDetails.findings.some(f => f.severity === 'critical');
    const status = reviewDetails.approved ? '✅ APPROVED' : '❌ REVISIONS REQUIRED';

    return {
      from,
      to,
      type: 'quality-review',
      priority: hasCritical ? 'URGENT' : 'STANDARD',
      subject: `Quality Review: ${status}`,
      linearIssueUrl,
      content: `## Quality Review Results

**Review Type**: ${reviewDetails.reviewType}
**Status**: ${status}
${reviewDetails.score !== undefined ? `**Score**: ${reviewDetails.score}%` : ''}

### Findings

${reviewDetails.findings.map(f => {
  const icon = {
    critical: '🔴',
    major: '🟠',
    minor: '🟡',
    suggestion: '💡',
  }[f.severity];
  return `${icon} **${f.severity.toUpperCase()}** (${f.category})
${f.description}`;
}).join('\n\n')}

${reviewDetails.recommendations && reviewDetails.recommendations.length > 0 ? `### Recommendations

${reviewDetails.recommendations.map(r => `- ${r}`).join('\n')}` : ''}`,
      actionRequired: reviewDetails.approved
        ? ['Proceed to next phase']
        : ['Address findings', 'Request re-review'],
    };
  }

  /**
   * Get message history for a specific Linear issue
   */
  getMessageHistory(linearIssueUrl: string): AgentMessage[] {
    return this.messageLog.filter(m => m.linearIssueUrl === linearIssueUrl);
  }

  /**
   * Get all messages involving a specific agent
   */
  getAgentMessages(agentRole: AgentRole): AgentMessage[] {
    return this.messageLog.filter(m => m.from === agentRole || m.to === agentRole);
  }

  /**
   * Get messages by priority level
   */
  getMessagesByPriority(priority: MessagePriority): AgentMessage[] {
    return this.messageLog.filter(m => m.priority === priority);
  }

  /**
   * Get messages in a specific thread
   */
  getThread(threadId: string): AgentMessage[] {
    return this.messageLog.filter(m => m.threadId === threadId);
  }

  /**
   * Get unresolved urgent/critical messages
   */
  getUnresolvedUrgent(): AgentMessage[] {
    return this.messageLog.filter(m =>
      ['CRITICAL', 'URGENT'].includes(m.priority) &&
      m.actionRequired &&
      m.actionRequired.length > 0
    );
  }

  // Helper methods

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractIssueId(linearUrl: string): string | null {
    // Extract issue ID from Linear URL
    // Example: https://linear.app/unite-hub/issue/ATO-123/... → ATO-123
    const match = linearUrl.match(/issue\/([A-Z]+-\d+)/);
    return match ? match[1] : null;
  }

  private formatMessageForLinear(message: AgentMessage): string {
    const priorityEmoji: Record<MessagePriority, string> = {
      CRITICAL: '🔴',
      URGENT: '🟠',
      STANDARD: '🟡',
      INFO: '🔵',
    };

    const emoji = priorityEmoji[message.priority];

    return `${emoji} **${message.subject}**

**From**: ${message.from}
**To**: ${message.to}
**Type**: ${message.type}
**Priority**: ${message.priority}

${message.content}

${message.actionRequired && message.actionRequired.length > 0 ? `**Action Required**:
${message.actionRequired.map(a => `- [ ] ${a}`).join('\n')}` : ''}

${message.deadline ? `**Deadline**: ${new Date(message.deadline).toLocaleString()}` : ''}

${message.attachments && message.attachments.length > 0 ? `**Attachments**:
${message.attachments.map(a => `- ${a.type}: ${a.name} (${a.path})`).join('\n')}` : ''}

---
*Message ID: ${message.messageId} | Sent: ${new Date(message.timestamp).toLocaleString()}*`;
  }

  private async routeMessage(message: AgentMessage): Promise<void> {
    // In a real implementation, this would:
    // 1. Notify the recipient agent (e.g., via webhook, queue, or event bus)
    // 2. Potentially trigger agent execution based on message type
    // 3. Update agent state/context with new information

    log.info('Routing message', { priority: message.priority, messageId: message.messageId, from: message.from, to: message.to });

    // Log different routing strategies based on priority
    switch (message.priority) {
      case 'CRITICAL':
        log.info('CRITICAL message - immediate notification required');
        break;
      case 'URGENT':
        log.info('URGENT message - notification within 1 hour');
        break;
      case 'STANDARD':
        log.debug('STANDARD message - notification within 4 hours');
        break;
      case 'INFO':
        log.debug('INFO message - notification within 24 hours');
        break;
    }
  }
}

/**
 * Create a singleton communication bus instance
 */
export function createAgentCommunicationBus(
  linearOrchestrator: LinearOrchestrator
): AgentCommunicationBus {
  return new AgentCommunicationBus(linearOrchestrator);
}

/**
 * Priority-based SLA definitions
 */
export const MESSAGE_SLA: Record<MessagePriority, { responseTime: string; description: string }> = {
  CRITICAL: {
    responseTime: 'Immediate',
    description: 'Production down, security breach, data loss',
  },
  URGENT: {
    responseTime: '< 1 hour',
    description: 'Blocking issue, deadline at risk, quality gate failure',
  },
  STANDARD: {
    responseTime: '< 4 hours',
    description: 'Normal task communication, handoffs, status updates',
  },
  INFO: {
    responseTime: '< 24 hours',
    description: 'Status updates, FYI messages, low-priority notifications',
  },
};
