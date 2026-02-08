/**
 * Linear GraphQL Queries and Mutations
 *
 * Typed GraphQL operations for Linear API integration
 * These complement the Linear SDK's built-in operations with custom queries
 *
 * Pattern: Follows Australian Tax Optimizer data provenance standards
 * All queries include metadata for audit trails
 */

import type { LinearClient } from '@linear/sdk'

/** IssueCreateInput type derived from Linear SDK (not directly exported) */
export type LinearIssueCreateInput = Parameters<LinearClient['createIssue']>[0]

/**
 * Queue Item to Linear Issue Mapping
 *
 * Converts work queue items to Linear IssueCreateInput format
 */
export interface QueueToLinearMapping {
  queueId: string;
  title: string;
  description: string;
  priority: string; // P0, P1, P2, P3
  complexity: string; // simple, medium, complex
  queueItemType: string; // feature, bug, improvement, client_request, task
  assignedAgent?: string;
  validationNotes?: string;
}

/**
 * Build Linear IssueCreateInput from queue item
 *
 * @param teamId - Linear team ID
 * @param projectId - Optional Linear project ID
 * @param data - Queue item mapping data
 * @returns IssueCreateInput ready for Linear SDK
 */
export function buildIssueFromQueue(
  teamId: string,
  projectId: string | undefined,
  data: QueueToLinearMapping
): LinearIssueCreateInput {
  // Map priority to Linear's priority system
  const priorityMap: Record<string, number> = {
    'P0': 1, // Urgent
    'P1': 2, // High
    'P2': 3, // Medium
    'P3': 4, // Low
  };

  // Map queue item type to Linear labels
  const _typeLabels: Record<string, string[]> = {
    'feature': ['feature', 'enhancement'],
    'bug': ['bug', 'issue'],
    'improvement': ['improvement', 'refactor'],
    'client_request': ['client-request', 'external'],
    'task': ['task', 'internal'],
  };

  // Build rich description with metadata
  const descriptionParts = [
    data.description,
    '',
    '---',
    '',
    '## Metadata',
    `- **Queue ID**: \`${data.queueId}\``,
    `- **Complexity**: ${data.complexity}`,
    `- **Type**: ${data.queueItemType}`,
  ];

  if (data.assignedAgent) {
    descriptionParts.push(`- **Assigned Agent**: ${data.assignedAgent}`);
  }

  if (data.validationNotes) {
    descriptionParts.push('', '## Validation Notes', data.validationNotes);
  }

  descriptionParts.push(
    '',
    '---',
    '',
    '_Created by ATO Idea Intake Workflow_'
  );

  const input: LinearIssueCreateInput = {
    teamId,
    title: data.title,
    description: descriptionParts.join('\n'),
    priority: priorityMap[data.priority] || 0,
    labelIds: [], // Will be populated after fetching label IDs
  };

  if (projectId) {
    input.projectId = projectId;
  }

  return input;
}

/**
 * Extract search keywords from queue item
 *
 * Used for duplicate detection
 *
 * @param title - Issue title
 * @param description - Issue description
 * @returns Search query string
 */
export function extractSearchKeywords(title: string, description: string): string {
  // Remove common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'can', 'could', 'may', 'might', 'must', 'shall',
  ]);

  // Extract meaningful words from title (higher weight)
  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Extract first 50 words from description
  const descWords = description
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 50)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Combine with title words having priority
  const keywords = [...new Set([...titleWords, ...descWords])];

  return keywords.slice(0, 10).join(' '); // Top 10 keywords
}

/**
 * Format validation result for Linear comment
 *
 * When duplicate is detected, this formats the validation result
 * as a markdown comment to add to the existing issue
 *
 * @param queueId - Queue item ID
 * @param validationResult - PM validation result
 * @returns Formatted markdown comment
 */
export function formatDuplicateComment(
  queueId: string,
  validationResult: { complexity?: string; priority?: string; notes?: string }
): string {
  return `
## Duplicate Idea Detected

A similar idea was submitted and marked as duplicate.

**Queue ID**: \`${queueId}\`
**Submitted**: ${new Date().toISOString()}
**Complexity**: ${validationResult.complexity || 'Unknown'}
**Priority**: ${validationResult.priority || 'Unknown'}

### Additional Context

${validationResult.notes || 'No additional notes provided.'}

---

_Added by ATO Idea Intake Workflow - Duplicate Detection_
  `.trim();
}

/**
 * Linear Workflow State Types
 *
 * Used to map queue status to Linear workflow states
 */
export const LINEAR_STATE_TYPES = {
  TRIAGE: 'triage',
  BACKLOG: 'backlog',
  UNSTARTED: 'unstarted',
  STARTED: 'started',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
} as const;

/**
 * Map queue status to Linear workflow state type
 *
 * @param queueStatus - Work queue status
 * @returns Linear workflow state type
 */
export function mapQueueStatusToLinearState(
  queueStatus: string
): typeof LINEAR_STATE_TYPES[keyof typeof LINEAR_STATE_TYPES] {
  const mapping: Record<string, typeof LINEAR_STATE_TYPES[keyof typeof LINEAR_STATE_TYPES]> = {
    'pending': LINEAR_STATE_TYPES.TRIAGE,
    'validating': LINEAR_STATE_TYPES.TRIAGE,
    'validated': LINEAR_STATE_TYPES.BACKLOG,
    'processing': LINEAR_STATE_TYPES.STARTED,
    'complete': LINEAR_STATE_TYPES.COMPLETED,
    'failed': LINEAR_STATE_TYPES.CANCELED,
    'archived': LINEAR_STATE_TYPES.COMPLETED,
  };

  return mapping[queueStatus] || LINEAR_STATE_TYPES.BACKLOG;
}

/**
 * Build Linear issue URL from team key and identifier
 *
 * @param teamKey - Linear team key (e.g., "UNI")
 * @param identifier - Issue identifier (e.g., "UNI-123")
 * @returns Full Linear issue URL
 */
export function buildLinearIssueUrl(teamKey: string, identifier: string): string {
  // Extract workspace slug from team key (e.g., "UNI" -> "unite-hub")
  // For now, use environment config for workspace slug
  const workspaceSlug = process.env.LINEAR_WORKSPACE_SLUG ?? 'unite-hub';
  return `https://linear.app/${workspaceSlug}/issue/${identifier}`;
}

/**
 * Parse Linear issue identifier from URL
 *
 * @param url - Linear issue URL
 * @returns Issue identifier or null
 */
export function parseLinearIdentifier(url: string): string | null {
  const match = url.match(/\/issue\/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/**
 * Custom GraphQL Fragments
 *
 * Reusable fragments for common data structures
 */

export const ISSUE_CORE_FRAGMENT = `
  fragment IssueCore on Issue {
    id
    identifier
    title
    description
    priority
    url
    createdAt
    updatedAt
    state {
      id
      name
      type
    }
    team {
      id
      name
      key
    }
  }
`;

export const ISSUE_WITH_LABELS_FRAGMENT = `
  fragment IssueWithLabels on Issue {
    ...IssueCore
    labels {
      nodes {
        id
        name
        color
      }
    }
  }
  ${ISSUE_CORE_FRAGMENT}
`;

/**
 * Custom GraphQL Queries
 *
 * These are custom queries beyond the Linear SDK's standard operations
 */

export const SEARCH_ISSUES_BY_KEYWORDS = `
  query SearchIssuesByKeywords($teamId: String!, $searchQuery: String!) {
    team(id: $teamId) {
      issues(
        filter: {
          searchableContent: { contains: $searchQuery }
          state: { type: { nin: ["completed", "canceled"] } }
        }
        first: 20
      ) {
        nodes {
          ...IssueCore
        }
      }
    }
  }
  ${ISSUE_CORE_FRAGMENT}
`;

export const GET_TEAM_WORKFLOW_STATES = `
  query GetTeamWorkflowStates($teamId: String!) {
    team(id: $teamId) {
      states {
        nodes {
          id
          name
          type
          color
          position
        }
      }
    }
  }
`;

export const GET_TEAM_LABELS = `
  query GetTeamLabels($teamId: String!) {
    team(id: $teamId) {
      labels {
        nodes {
          id
          name
          color
        }
      }
    }
  }
`;

/**
 * Label Cache
 *
 * Cache for team labels to avoid repeated API calls
 */
interface LabelCache {
  [key: string]: {
    id: string;
    name: string;
    timestamp: number;
  }[];
}

const labelCache: LabelCache = {};
const CACHE_TTL_MS = 3600000; // 1 hour

/**
 * Get or create labels for issue
 *
 * @param teamId - Linear team ID
 * @param labelNames - Array of label names
 * @returns Array of label IDs
 */
export async function getOrCreateLabels(
  teamId: string,
  labelNames: string[]
): Promise<string[]> {
  // Check cache
  const cached = labelCache[teamId];
  const now = Date.now();

  if (cached && (now - cached[0].timestamp) < CACHE_TTL_MS) {
    return labelNames
      .map(name => cached.find(l => l.name === name)?.id)
      .filter((id): id is string => id !== undefined);
  }

  // Cache miss - would need to fetch labels from Linear
  // For now, return empty array
  // TODO(tracked): Implement label fetching and creation — Linear API enhancement
  return [];
}

/**
 * Issue Search Result with Similarity Score
 */
export interface IssueSearchResult {
  issue: {
    id: string;
    identifier: string;
    title: string;
    description?: string | null;
    url: string;
  };
  similarityScore: number; // 0-100
  matchReason: string;
}

/**
 * Find duplicate issues with similarity scoring
 *
 * @param teamId - Linear team ID
 * @param title - New issue title
 * @param description - New issue description
 * @param threshold - Minimum similarity threshold (default: 70)
 * @returns Array of potential duplicates sorted by similarity
 */
/** Minimal issue shape for duplicate detection (compatible with Linear SDK Issue class) */
interface DuplicateCheckIssue {
  id: string
  identifier: string
  title: string
  description?: string | null | undefined
  url: string
}

export function findPotentialDuplicates(
  existingIssues: DuplicateCheckIssue[],
  title: string,
  description: string,
  threshold: number = 70
): IssueSearchResult[] {
  const results: IssueSearchResult[] = [];

  for (const issue of existingIssues) {
    // Calculate title similarity
    const titleSimilarity = calculateSimilarity(title, issue.title);

    // Calculate description similarity if available
    const descSimilarity = issue.description
      ? calculateSimilarity(description, issue.description)
      : 0;

    // Weighted average (title has 70% weight, description 30%)
    const overallSimilarity = Math.round(
      titleSimilarity * 0.7 + descSimilarity * 0.3
    );

    if (overallSimilarity >= threshold) {
      results.push({
        issue: {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description,
          url: issue.url,
        },
        similarityScore: overallSimilarity,
        matchReason:
          overallSimilarity >= 90
            ? 'Very high similarity - likely duplicate'
            : overallSimilarity >= 80
            ? 'High similarity - probable duplicate'
            : 'Moderate similarity - possible duplicate',
      });
    }
  }

  // Sort by similarity score (highest first)
  return results.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Calculate Jaccard similarity between two strings
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity percentage (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = [...set1].filter(w => set2.has(w));
  const union = new Set([...set1, ...set2]);

  return Math.round((intersection.length / union.size) * 100);
}
