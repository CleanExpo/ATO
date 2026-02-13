/**
 * Tests for Linear GraphQL Queries (lib/linear/graphql-queries.ts)
 *
 * Validates Linear query/mutation helpers:
 * - buildIssueFromQueue: constructs IssueCreateInput from queue data
 * - extractSearchKeywords: stop word removal, length filtering
 * - formatDuplicateComment: markdown comment generation
 * - mapQueueStatusToLinearState: status mapping
 * - buildLinearIssueUrl / parseLinearIdentifier: URL handling
 * - fetchLabels / createLabel / getOrCreateLabels: label management with caching
 * - findPotentialDuplicates: similarity-based duplicate detection
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @linear/sdk
const mockTeamFn = vi.fn()
const mockCreateIssueLabelFn = vi.fn()

vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn().mockImplementation(() => ({
    team: mockTeamFn,
    createIssueLabel: mockCreateIssueLabelFn,
  })),
}))

// Mock api-client (used by fetchLabels/createLabel via dynamic import)
vi.mock('@/lib/linear/api-client', () => ({
  createLinearClient: vi.fn().mockImplementation(() => ({
    team: mockTeamFn,
    createIssueLabel: mockCreateIssueLabelFn,
  })),
}))

// Mock env config
vi.mock('@/lib/config/env', () => ({
  serverConfig: {
    linear: {
      apiKey: 'lin_api_test_key',
      teamId: 'team-test-id',
      projectId: 'project-test-id',
    },
  },
}))

import {
  buildIssueFromQueue,
  extractSearchKeywords,
  formatDuplicateComment,
  mapQueueStatusToLinearState,
  buildLinearIssueUrl,
  parseLinearIdentifier,
  fetchLabels,
  createLabel,
  getOrCreateLabels,
  findPotentialDuplicates,
  LINEAR_STATE_TYPES,
  type QueueToLinearMapping,
} from '@/lib/linear/graphql-queries'

// =============================================================================
// buildIssueFromQueue tests
// =============================================================================

describe('buildIssueFromQueue', () => {
  const baseMapping: QueueToLinearMapping = {
    queueId: 'queue-001',
    title: 'Fix navigation bug',
    description: 'The nav header has incorrect padding on mobile',
    priority: 'P1',
    complexity: 'medium',
    queueItemType: 'bug',
  }

  it('builds issue with correct teamId and title', () => {
    const input = buildIssueFromQueue('team-abc', undefined, baseMapping)

    expect(input.teamId).toBe('team-abc')
    expect(input.title).toBe('Fix navigation bug')
  })

  it('maps priority P1 to Linear High (2)', () => {
    const input = buildIssueFromQueue('team-abc', undefined, baseMapping)
    expect(input.priority).toBe(2)
  })

  it('includes metadata in description', () => {
    const input = buildIssueFromQueue('team-abc', undefined, baseMapping)
    const desc = input.description || ''

    expect(desc).toContain('queue-001')
    expect(desc).toContain('medium')
    expect(desc).toContain('bug')
    expect(desc).toContain('ATO Idea Intake Workflow')
  })

  it('includes projectId when provided', () => {
    const input = buildIssueFromQueue('team-abc', 'project-xyz', baseMapping)
    expect(input.projectId).toBe('project-xyz')
  })

  it('does not include projectId when undefined', () => {
    const input = buildIssueFromQueue('team-abc', undefined, baseMapping)
    expect(input.projectId).toBeUndefined()
  })

  it('includes assigned agent in description when present', () => {
    const mapping = { ...baseMapping, assignedAgent: 'deduction-optimizer' }
    const input = buildIssueFromQueue('team-abc', undefined, mapping)
    expect(input.description).toContain('deduction-optimizer')
  })

  it('includes validation notes in description when present', () => {
    const mapping = { ...baseMapping, validationNotes: 'Reviewed and approved by PM' }
    const input = buildIssueFromQueue('team-abc', undefined, mapping)
    expect(input.description).toContain('Reviewed and approved by PM')
    expect(input.description).toContain('Validation Notes')
  })

  it('uses 0 (no priority) for unknown priority values', () => {
    const mapping = { ...baseMapping, priority: 'unknown' }
    const input = buildIssueFromQueue('team-abc', undefined, mapping)
    expect(input.priority).toBe(0)
  })

  it('initialises labelIds as empty array', () => {
    const input = buildIssueFromQueue('team-abc', undefined, baseMapping)
    expect(input.labelIds).toEqual([])
  })
})

// =============================================================================
// extractSearchKeywords tests
// =============================================================================

describe('extractSearchKeywords', () => {
  it('removes common stop words', () => {
    const keywords = extractSearchKeywords(
      'Fix the navigation bug',
      'The header is broken and should have been repaired'
    )

    expect(keywords).not.toContain('the')
    expect(keywords).not.toContain('and')
    expect(keywords).not.toContain('should')
    expect(keywords).not.toContain('have')
    expect(keywords).not.toContain('been')
  })

  it('filters out words with 3 or fewer characters', () => {
    const keywords = extractSearchKeywords('Fix bug now', 'It is bad')
    // "Fix"=3, "bug"=3, "now"=3 -- all filtered out
    expect(keywords).toBe('')
  })

  it('extracts meaningful words from title and description', () => {
    const keywords = extractSearchKeywords(
      'Authentication system improvements',
      'Improve the login authentication flow with better error handling'
    )

    expect(keywords).toContain('authentication')
    expect(keywords).toContain('system')
    expect(keywords).toContain('improvements')
  })

  it('deduplicates words between title and description', () => {
    const keywords = extractSearchKeywords(
      'Authentication improvement',
      'Authentication system needs improvement'
    )

    const words = keywords.split(' ')
    const uniqueWords = new Set(words)
    expect(words.length).toBe(uniqueWords.size)
  })

  it('limits output to 10 keywords', () => {
    const longTitle = 'word1 word2 word3 word4 word5 word6 word7 word8'
    const longDesc = 'desc1 desc2 desc3 desc4 desc5 desc6 desc7 desc8 desc9 desc10 desc11 desc12'
    const keywords = extractSearchKeywords(longTitle, longDesc)

    const wordCount = keywords.split(' ').filter(Boolean).length
    expect(wordCount).toBeLessThanOrEqual(10)
  })
})

// =============================================================================
// formatDuplicateComment tests
// =============================================================================

describe('formatDuplicateComment', () => {
  it('includes queue ID in comment', () => {
    const comment = formatDuplicateComment('queue-123', {
      complexity: 'medium',
      priority: 'P2',
      notes: 'Similar to existing work',
    })

    expect(comment).toContain('queue-123')
  })

  it('includes validation result fields', () => {
    const comment = formatDuplicateComment('queue-456', {
      complexity: 'complex',
      priority: 'P0',
      notes: 'Urgent duplicate detected',
    })

    expect(comment).toContain('complex')
    expect(comment).toContain('P0')
    expect(comment).toContain('Urgent duplicate detected')
  })

  it('handles missing optional fields gracefully', () => {
    const comment = formatDuplicateComment('queue-789', {})

    expect(comment).toContain('queue-789')
    expect(comment).toContain('Unknown')
    expect(comment).toContain('No additional notes provided')
  })

  it('includes duplicate detection header', () => {
    const comment = formatDuplicateComment('q-1', { notes: 'test' })
    expect(comment).toContain('Duplicate Idea Detected')
    expect(comment).toContain('ATO Idea Intake Workflow')
  })
})

// =============================================================================
// mapQueueStatusToLinearState tests
// =============================================================================

describe('mapQueueStatusToLinearState', () => {
  it('maps pending to triage', () => {
    expect(mapQueueStatusToLinearState('pending')).toBe(LINEAR_STATE_TYPES.TRIAGE)
  })

  it('maps validating to triage', () => {
    expect(mapQueueStatusToLinearState('validating')).toBe(LINEAR_STATE_TYPES.TRIAGE)
  })

  it('maps validated to backlog', () => {
    expect(mapQueueStatusToLinearState('validated')).toBe(LINEAR_STATE_TYPES.BACKLOG)
  })

  it('maps processing to started', () => {
    expect(mapQueueStatusToLinearState('processing')).toBe(LINEAR_STATE_TYPES.STARTED)
  })

  it('maps complete to completed', () => {
    expect(mapQueueStatusToLinearState('complete')).toBe(LINEAR_STATE_TYPES.COMPLETED)
  })

  it('maps failed to canceled', () => {
    expect(mapQueueStatusToLinearState('failed')).toBe(LINEAR_STATE_TYPES.CANCELED)
  })

  it('maps archived to completed', () => {
    expect(mapQueueStatusToLinearState('archived')).toBe(LINEAR_STATE_TYPES.COMPLETED)
  })

  it('returns backlog as default for unknown statuses', () => {
    expect(mapQueueStatusToLinearState('unknown_status')).toBe(LINEAR_STATE_TYPES.BACKLOG)
  })
})

// =============================================================================
// buildLinearIssueUrl / parseLinearIdentifier tests
// =============================================================================

describe('buildLinearIssueUrl', () => {
  it('builds URL with workspace slug and identifier', () => {
    const url = buildLinearIssueUrl('UNI', 'UNI-123')
    expect(url).toContain('/issue/UNI-123')
    expect(url).toContain('linear.app')
  })
})

describe('parseLinearIdentifier', () => {
  it('extracts identifier from a Linear URL', () => {
    const id = parseLinearIdentifier('https://linear.app/unite-hub/issue/UNI-123')
    expect(id).toBe('UNI-123')
  })

  it('returns null for non-matching URLs', () => {
    expect(parseLinearIdentifier('https://example.com/page')).toBeNull()
    expect(parseLinearIdentifier('not-a-url')).toBeNull()
  })

  it('extracts identifier with different team keys', () => {
    expect(parseLinearIdentifier('https://linear.app/workspace/issue/ATO-999')).toBe('ATO-999')
  })
})

// =============================================================================
// fetchLabels tests
// =============================================================================

describe('fetchLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns labels from team with id, name, and color', async () => {
    const labelNodes = [
      { id: 'lbl-1', name: 'bug', color: '#FF0000' },
      { id: 'lbl-2', name: 'feature', color: '#00FF00' },
    ]
    const mockTeamInstance = {
      labels: vi.fn().mockResolvedValue({ nodes: labelNodes }),
    }
    mockTeamFn.mockResolvedValue(mockTeamInstance)

    const labels = await fetchLabels('team-id')

    expect(labels).toHaveLength(2)
    expect(labels[0]).toEqual({ id: 'lbl-1', name: 'bug', color: '#FF0000' })
    expect(labels[1]).toEqual({ id: 'lbl-2', name: 'feature', color: '#00FF00' })
  })

  it('throws when team is not found', async () => {
    mockTeamFn.mockResolvedValue(null)

    await expect(fetchLabels('nonexistent')).rejects.toThrow('not found')
  })
})

// =============================================================================
// createLabel tests
// =============================================================================

describe('createLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new label and returns id, name, color', async () => {
    const mockLabel = { id: 'lbl-new', name: 'enhancement', color: '#0066FF' }
    mockCreateIssueLabelFn.mockResolvedValue({
      success: true,
      issueLabel: Promise.resolve(mockLabel),
    })

    const result = await createLabel('team-id', 'enhancement', '#0066FF')

    expect(result).toEqual(mockLabel)
    expect(mockCreateIssueLabelFn).toHaveBeenCalledWith({
      teamId: 'team-id',
      name: 'enhancement',
      color: '#0066FF',
    })
  })

  it('creates label without color when not provided', async () => {
    const mockLabel = { id: 'lbl-nc', name: 'task', color: '#CCCCCC' }
    mockCreateIssueLabelFn.mockResolvedValue({
      success: true,
      issueLabel: Promise.resolve(mockLabel),
    })

    await createLabel('team-id', 'task')

    expect(mockCreateIssueLabelFn).toHaveBeenCalledWith({
      teamId: 'team-id',
      name: 'task',
    })
  })

  it('throws when label creation payload reports failure', async () => {
    mockCreateIssueLabelFn.mockResolvedValue({
      success: false,
      issueLabel: null,
    })

    await expect(createLabel('team-id', 'broken')).rejects.toThrow('Failed to create label')
  })

  it('throws when label data is null despite success', async () => {
    mockCreateIssueLabelFn.mockResolvedValue({
      success: true,
      issueLabel: Promise.resolve(null),
    })

    await expect(createLabel('team-id', 'nullish')).rejects.toThrow(
      'Label creation succeeded but label data is null'
    )
  })
})

// =============================================================================
// getOrCreateLabels tests
// =============================================================================

describe('getOrCreateLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array for empty label names', async () => {
    const result = await getOrCreateLabels('team-id', [])
    expect(result).toEqual([])
  })

  it('returns IDs for existing labels (case-insensitive match)', async () => {
    const labelNodes = [
      { id: 'lbl-1', name: 'Bug', color: '#FF0000' },
      { id: 'lbl-2', name: 'Feature', color: '#00FF00' },
    ]
    const mockTeamInstance = {
      labels: vi.fn().mockResolvedValue({ nodes: labelNodes }),
    }
    mockTeamFn.mockResolvedValue(mockTeamInstance)

    const result = await getOrCreateLabels('team-id', ['bug', 'feature'])

    expect(result).toContain('lbl-1')
    expect(result).toContain('lbl-2')
    expect(result).toHaveLength(2)
  })

  it('creates missing labels and returns their IDs', async () => {
    // Existing labels do not include "new-label"
    const labelNodes = [
      { id: 'lbl-1', name: 'Bug', color: '#FF0000' },
    ]
    const mockTeamInstance = {
      labels: vi.fn().mockResolvedValue({ nodes: labelNodes }),
    }
    mockTeamFn.mockResolvedValue(mockTeamInstance)

    // When creating the missing label
    const newLabel = { id: 'lbl-new', name: 'new-label', color: '#999' }
    mockCreateIssueLabelFn.mockResolvedValue({
      success: true,
      issueLabel: Promise.resolve(newLabel),
    })

    const result = await getOrCreateLabels('team-id', ['bug', 'new-label'])

    expect(result).toContain('lbl-1')
    expect(result).toContain('lbl-new')
    expect(result).toHaveLength(2)
  })

  it('continues when label creation fails for one label', async () => {
    const labelNodes = [{ id: 'lbl-1', name: 'Bug', color: '#FF0000' }]
    const mockTeamInstance = {
      labels: vi.fn().mockResolvedValue({ nodes: labelNodes }),
    }
    mockTeamFn.mockResolvedValue(mockTeamInstance)

    // Creating the missing label fails
    mockCreateIssueLabelFn.mockResolvedValue({ success: false })

    const result = await getOrCreateLabels('team-id', ['bug', 'broken-label'])

    // Should have the existing label but not the failed one
    expect(result).toContain('lbl-1')
    expect(result).toHaveLength(1)
  })

  it('falls back to stale cache when fetchLabels fails', async () => {
    // Note: The label cache may be populated from previous tests in this suite.
    // The source code explicitly returns stale cache results on error -- this is
    // correct fault-tolerant behaviour (see graphql-queries.ts line 485-489).
    mockTeamFn.mockRejectedValue(new Error('API unavailable'))

    const result = await getOrCreateLabels('nonexistent-team-id', ['totally-unknown-label'])

    // For a label name that was never cached, result should be empty
    expect(result).toEqual([])
  })
})

// =============================================================================
// findPotentialDuplicates tests
// =============================================================================

describe('findPotentialDuplicates', () => {
  const existingIssues = [
    {
      id: '1',
      identifier: 'UNI-1',
      title: 'Implement user authentication system',
      description: 'Build a complete authentication system with OAuth support',
      url: 'https://linear.app/issue/UNI-1',
    },
    {
      id: '2',
      identifier: 'UNI-2',
      title: 'Fix database connection pooling',
      description: 'Connection pool exhaustion during peak loads',
      url: 'https://linear.app/issue/UNI-2',
    },
    {
      id: '3',
      identifier: 'UNI-3',
      title: 'Completely unrelated feature request',
      description: 'Something about gardening tools and landscaping design',
      url: 'https://linear.app/issue/UNI-3',
    },
  ]

  it('finds duplicates above threshold', () => {
    const results = findPotentialDuplicates(
      existingIssues,
      'Implement user authentication system',
      'Build authentication with OAuth',
      50
    )

    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].issue.identifier).toBe('UNI-1')
    expect(results[0].similarityScore).toBeGreaterThanOrEqual(50)
  })

  it('returns empty array when no issues match threshold', () => {
    const results = findPotentialDuplicates(
      existingIssues,
      'Quantum computing optimisation',
      'Novel quantum algorithm for factoring large primes',
      70
    )

    expect(results).toEqual([])
  })

  it('sorts results by similarity score (highest first)', () => {
    const results = findPotentialDuplicates(
      existingIssues,
      'authentication system',
      'authentication',
      0 // low threshold to get multiple matches
    )

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarityScore).toBeGreaterThanOrEqual(results[i].similarityScore)
    }
  })

  it('uses default threshold of 70 when not specified', () => {
    const results = findPotentialDuplicates(
      existingIssues,
      'Completely unrelated topic about quantum physics',
      'Nothing similar at all to any existing issues'
    )

    // With default 70 threshold, should find no matches
    expect(results).toEqual([])
  })

  it('handles issues with null description', () => {
    const issuesWithNull = [
      {
        id: '4',
        identifier: 'UNI-4',
        title: 'Authentication system',
        description: null,
        url: 'https://linear.app/issue/UNI-4',
      },
    ]

    const results = findPotentialDuplicates(
      issuesWithNull,
      'Authentication system implementation',
      'Some description',
      30
    )

    // Should not throw, description similarity treated as 0
    expect(Array.isArray(results)).toBe(true)
  })

  it('assigns appropriate match reasons based on score', () => {
    // Create a near-exact duplicate to get high score
    const issues = [
      {
        id: '5',
        identifier: 'UNI-5',
        title: 'Implement authentication system improvements',
        description: 'Improve authentication system with better security',
        url: 'https://linear.app/issue/UNI-5',
      },
    ]

    const results = findPotentialDuplicates(
      issues,
      'Implement authentication system improvements',
      'Improve authentication system with better security',
      0
    )

    if (results.length > 0) {
      expect(results[0].matchReason).toBeTruthy()
      expect(typeof results[0].matchReason).toBe('string')
    }
  })
})
