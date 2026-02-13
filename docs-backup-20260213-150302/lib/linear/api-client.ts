import { LinearClient } from '@linear/sdk';
import { serverConfig } from '@/lib/config/env';
import { retry } from '@/lib/api/retry';

/**
 * Linear API Client for Australian Tax Optimizer
 *
 * Provides typed access to Linear's GraphQL API for:
 * - Creating issues from queue items
 * - Searching for duplicate issues
 * - Updating issue status and metadata
 * - Managing project assignments
 *
 * Pattern: Follows lib/xero/client.ts OAuth pattern but adapted for API key authentication
 */

// Create Linear client instance with API key authentication
export function createLinearClient(): LinearClient {
  try {
    if (!serverConfig.linear.apiKey) {
      throw new Error('LINEAR_API_KEY is not configured');
    }

    return new LinearClient({
      apiKey: serverConfig.linear.apiKey,
    });
  } catch (error) {
    console.error('Failed to create Linear client:', error);
    throw new Error(
      'Linear client initialization failed. Please check your LINEAR_API_KEY environment variable.'
    );
  }
}

/**
 * Create a Linear issue from queue item data
 *
 * @param data - Issue creation input
 * @returns Created issue with ID and URL
 */
/** Issue type inferred from Linear SDK */
type LinearIssue = NonNullable<Awaited<Awaited<ReturnType<LinearClient['createIssue']>>['issue']>>

export async function createIssue(data: Parameters<LinearClient['createIssue']>[0]): Promise<LinearIssue> {
  return retry(
    async () => {
      const client = createLinearClient();
      const issuePayload = await client.createIssue(data);

      if (!issuePayload.success) {
        throw new Error('Failed to create Linear issue');
      }

      const issue = await issuePayload.issue;
      if (!issue) {
        throw new Error('Issue creation succeeded but issue data is null');
      }

      return issue;
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      onRetry: (error, attempt, _delayMs) => {
        console.warn(`Retrying Linear issue creation (attempt ${attempt}):`, error);
      },
    }
  );
}

/**
 * Search for issues by query string
 *
 * Used for duplicate detection before creating new issues
 *
 * @param query - Search query (title keywords, description text)
 * @returns Array of matching issues
 */
export async function searchIssues(query: string): Promise<LinearIssue[]> {
  return retry(
    async () => {
      const client = createLinearClient();
      const team = await client.team(serverConfig.linear.teamId);

      if (!team) {
        throw new Error(`Team ${serverConfig.linear.teamId} not found`);
      }

      // Search active issues only (exclude archived/completed)
      const issues = await team.issues({
        filter: {
          searchableContent: { contains: query },
          state: {
            type: { nin: ['completed', 'canceled'] }
          }
        },
        first: 20, // Limit to top 20 matches
      });

      return issues.nodes;
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      onRetry: (error, attempt, _delayMs) => {
        console.warn(`Retrying Linear issue search (attempt ${attempt}):`, error);
      },
    }
  );
}

/**
 * Update an existing issue
 *
 * @param issueId - Linear issue ID
 * @param updates - Fields to update
 * @returns Updated issue
 */
export async function updateIssue(
  issueId: string,
  updates: Parameters<LinearClient['updateIssue']>[1]
): Promise<LinearIssue> {
  return retry(
    async () => {
      const client = createLinearClient();
      const updatePayload = await client.updateIssue(issueId, updates);

      if (!updatePayload.success) {
        throw new Error(`Failed to update Linear issue ${issueId}`);
      }

      const issue = await updatePayload.issue;
      if (!issue) {
        throw new Error('Issue update succeeded but issue data is null');
      }

      return issue;
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      onRetry: (error, attempt, _delayMs) => {
        console.warn(`Retrying Linear issue update (attempt ${attempt}):`, error);
      },
    }
  );
}

/**
 * Add a comment to an issue
 *
 * Used when duplicate is detected to add context to existing issue
 *
 * @param issueId - Linear issue ID
 * @param body - Comment markdown text
 * @returns Created comment
 */
export async function addComment(issueId: string, body: string): Promise<void> {
  return retry(
    async () => {
      const client = createLinearClient();
      const commentPayload = await client.createComment({
        issueId,
        body,
      });

      if (!commentPayload.success) {
        throw new Error(`Failed to add comment to Linear issue ${issueId}`);
      }
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      onRetry: (error, attempt, _delayMs) => {
        console.warn(`Retrying Linear comment creation (attempt ${attempt}):`, error);
      },
    }
  );
}

/**
 * Get team information
 *
 * Used to validate team configuration on startup
 *
 * @returns Team details
 */
/** Team type inferred from Linear SDK */
type LinearTeam = Awaited<ReturnType<LinearClient['team']>>

export async function getTeam(): Promise<LinearTeam> {
  const client = createLinearClient();
  const team = await client.team(serverConfig.linear.teamId);

  if (!team) {
    throw new Error(`Team ${serverConfig.linear.teamId} not found`);
  }

  return team;
}

/**
 * Get available workflow states for the team
 *
 * Used to map queue status to Linear workflow states
 *
 * @returns Array of workflow states
 */
/** WorkflowState type inferred from Linear SDK */
type LinearWorkflowStateNode = Awaited<ReturnType<Awaited<ReturnType<LinearClient['team']>>['states']>>['nodes'][number]

export async function getWorkflowStates(): Promise<LinearWorkflowStateNode[]> {
  const client = createLinearClient();
  const team = await client.team(serverConfig.linear.teamId);

  if (!team) {
    throw new Error(`Team ${serverConfig.linear.teamId} not found`);
  }

  const states = await team.states();
  return states.nodes;
}

// TypeScript interfaces for Linear data structures

export interface LinearIssueData {
  id: string;
  identifier: string; // e.g., "UNI-123"
  title: string;
  description?: string;
  url: string;
  priority: number;
  state: {
    id: string;
    name: string;
    type: string;
  };
  team: {
    id: string;
    name: string;
    key: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface LinearTeamInfo {
  id: string;
  name: string;
  key: string;
}

export interface LinearWorkflowState {
  id: string;
  name: string;
  type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
  position: number;
}

/**
 * Priority mapping
 *
 * Maps internal priority (P0-P3) to Linear priority (0-4)
 * Linear: 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
 */
export function mapPriorityToLinear(priority: string): number {
  const mapping: Record<string, number> = {
    'P0': 1, // Urgent
    'P1': 2, // High
    'P2': 3, // Medium
    'P3': 4, // Low
  };
  return mapping[priority] || 0; // Default: No priority
}

/**
 * Calculate similarity score between two strings
 *
 * Used for duplicate detection
 * Simple implementation based on word overlap
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0-100)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = [...set1].filter(w => set2.has(w));
  const union = new Set([...set1, ...set2]);

  // Jaccard similarity coefficient
  return Math.round((intersection.length / union.size) * 100);
}
