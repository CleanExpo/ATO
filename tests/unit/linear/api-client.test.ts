/**
 * Tests for Linear API Client (lib/linear/api-client.ts)
 *
 * Validates Linear SDK integration:
 * - createLinearClient: API key handling, error on missing key
 * - createIssue: success, SDK error, null issue data
 * - searchIssues: team lookup, filtering, results
 * - updateIssue: success, failure
 * - addComment: success, failure
 * - getTeam / getWorkflowStates: team validation
 * - mapPriorityToLinear: P0-P3 mapping
 * - calculateSimilarity: Jaccard similarity scoring
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted so mock references are available in vi.mock factories
const { mockCreateIssue, mockUpdateIssue, mockCreateComment, mockTeam } = vi.hoisted(() => ({
  mockCreateIssue: vi.fn(),
  mockUpdateIssue: vi.fn(),
  mockCreateComment: vi.fn(),
  mockTeam: vi.fn(),
}))

vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn().mockImplementation(() => ({
    createIssue: mockCreateIssue,
    updateIssue: mockUpdateIssue,
    createComment: mockCreateComment,
    team: mockTeam,
  })),
}))

// Mock env config
vi.mock('@/lib/config/env', () => ({
  serverConfig: {
    linear: {
      apiKey: 'lin_api_test_key_12345',
      teamId: 'team-test-id',
      projectId: 'project-test-id',
    },
  },
}))

// Mock retry to execute immediately (no delays)
vi.mock('@/lib/api/retry', () => ({
  retry: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => {
    return fn()
  }),
}))

import {
  createLinearClient,
  createIssue,
  searchIssues,
  updateIssue,
  addComment,
  getTeam,
  getWorkflowStates,
  mapPriorityToLinear,
  calculateSimilarity,
} from '@/lib/linear/api-client'
import { serverConfig } from '@/lib/config/env'

// =============================================================================
// createLinearClient tests
// =============================================================================

describe('createLinearClient', () => {
  it('creates a LinearClient instance with API key', () => {
    const client = createLinearClient()
    expect(client).toBeDefined()
    expect(client.createIssue).toBeDefined()
  })

  it('throws when LINEAR_API_KEY is not configured', () => {
    // Temporarily override the config
    const original = serverConfig.linear.apiKey
    Object.defineProperty(serverConfig.linear, 'apiKey', { value: '', writable: true })

    try {
      expect(() => createLinearClient()).toThrow('Linear client initialization failed')
    } finally {
      // Restore apiKey regardless of test result
      Object.defineProperty(serverConfig.linear, 'apiKey', { value: original, writable: true })
    }
  })
})

// =============================================================================
// createIssue tests
// =============================================================================

describe('createIssue', () => {
  beforeEach(() => {
    mockCreateIssue.mockReset()
    mockUpdateIssue.mockReset()
    mockCreateComment.mockReset()
    mockTeam.mockReset()
  })

  it('creates an issue with correct fields and returns issue data', async () => {
    const mockIssue = {
      id: 'issue-123',
      identifier: 'UNI-42',
      title: 'Test issue',
      url: 'https://linear.app/test/issue/UNI-42',
    }

    mockCreateIssue.mockResolvedValue({
      success: true,
      issue: Promise.resolve(mockIssue),
    })

    const result = await createIssue({
      teamId: 'team-test-id',
      title: 'Test issue',
      description: 'Test description',
      priority: 2,
    })

    expect(result).toEqual(mockIssue)
    expect(mockCreateIssue).toHaveBeenCalledWith({
      teamId: 'team-test-id',
      title: 'Test issue',
      description: 'Test description',
      priority: 2,
    })
  })

  it('throws when issue creation payload reports failure', async () => {
    mockCreateIssue.mockResolvedValue({
      success: false,
      issue: null,
    })

    await expect(
      createIssue({ teamId: 'team-id', title: 'Failing issue' })
    ).rejects.toThrow('Failed to create Linear issue')
  })

  it('throws when issue data is null despite success', async () => {
    mockCreateIssue.mockResolvedValue({
      success: true,
      issue: Promise.resolve(null),
    })

    await expect(
      createIssue({ teamId: 'team-id', title: 'Null issue' })
    ).rejects.toThrow('Issue creation succeeded but issue data is null')
  })
})

// =============================================================================
// searchIssues tests
// =============================================================================

describe('searchIssues', () => {
  beforeEach(() => {
    mockCreateIssue.mockReset()
    mockUpdateIssue.mockReset()
    mockCreateComment.mockReset()
    mockTeam.mockReset()
  })

  it('searches for issues filtering active states', async () => {
    const mockIssues = {
      nodes: [
        { id: '1', title: 'Bug fix needed', identifier: 'UNI-10' },
        { id: '2', title: 'Bug in payments', identifier: 'UNI-11' },
      ],
    }
    const mockTeamInstance = {
      issues: vi.fn().mockResolvedValue(mockIssues),
    }
    mockTeam.mockResolvedValue(mockTeamInstance)

    const results = await searchIssues('bug fix')

    expect(results).toHaveLength(2)
    expect(results[0].title).toBe('Bug fix needed')
    expect(mockTeamInstance.issues).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({
          searchableContent: { contains: 'bug fix' },
          state: { type: { nin: ['completed', 'canceled'] } },
        }),
        first: 20,
      })
    )
  })

  it('throws when team is not found', async () => {
    mockTeam.mockResolvedValue(null)

    await expect(searchIssues('test')).rejects.toThrow('not found')
  })
})

// =============================================================================
// updateIssue tests
// =============================================================================

describe('updateIssue', () => {
  beforeEach(() => {
    mockCreateIssue.mockReset()
    mockUpdateIssue.mockReset()
    mockCreateComment.mockReset()
    mockTeam.mockReset()
  })

  it('updates an issue and returns updated data', async () => {
    const mockIssue = {
      id: 'issue-123',
      identifier: 'UNI-42',
      title: 'Updated title',
      url: 'https://linear.app/test/issue/UNI-42',
    }

    mockUpdateIssue.mockResolvedValue({
      success: true,
      issue: Promise.resolve(mockIssue),
    })

    const result = await updateIssue('issue-123', { title: 'Updated title' })

    expect(result).toEqual(mockIssue)
    expect(mockUpdateIssue).toHaveBeenCalledWith('issue-123', { title: 'Updated title' })
  })

  it('throws when update payload reports failure', async () => {
    mockUpdateIssue.mockResolvedValue({
      success: false,
      issue: null,
    })

    await expect(
      updateIssue('issue-123', { title: 'Fail' })
    ).rejects.toThrow('Failed to update Linear issue issue-123')
  })

  it('throws when updated issue data is null', async () => {
    mockUpdateIssue.mockResolvedValue({
      success: true,
      issue: Promise.resolve(null),
    })

    await expect(
      updateIssue('issue-123', { title: 'Null result' })
    ).rejects.toThrow('Issue update succeeded but issue data is null')
  })
})

// =============================================================================
// addComment tests
// =============================================================================

describe('addComment', () => {
  beforeEach(() => {
    mockCreateIssue.mockReset()
    mockUpdateIssue.mockReset()
    mockCreateComment.mockReset()
    mockTeam.mockReset()
  })

  it('adds a comment to an issue successfully', async () => {
    mockCreateComment.mockResolvedValue({ success: true })

    await expect(
      addComment('issue-123', 'This is a comment')
    ).resolves.not.toThrow()

    expect(mockCreateComment).toHaveBeenCalledWith({
      issueId: 'issue-123',
      body: 'This is a comment',
    })
  })

  it('throws when comment creation fails', async () => {
    mockCreateComment.mockResolvedValue({ success: false })

    await expect(
      addComment('issue-123', 'Failing comment')
    ).rejects.toThrow('Failed to add comment to Linear issue issue-123')
  })
})

// =============================================================================
// getTeam tests
// =============================================================================

describe('getTeam', () => {
  beforeEach(() => {
    mockCreateIssue.mockReset()
    mockUpdateIssue.mockReset()
    mockCreateComment.mockReset()
    mockTeam.mockReset()
  })

  it('returns team details when team exists', async () => {
    const mockTeamData = {
      id: 'team-test-id',
      name: 'Test Team',
      key: 'UNI',
    }
    mockTeam.mockResolvedValue(mockTeamData)

    const team = await getTeam()

    expect(team).toEqual(mockTeamData)
  })

  it('throws when team is not found', async () => {
    mockTeam.mockResolvedValue(null)

    await expect(getTeam()).rejects.toThrow('not found')
  })
})

// =============================================================================
// getWorkflowStates tests
// =============================================================================

describe('getWorkflowStates', () => {
  beforeEach(() => {
    mockCreateIssue.mockReset()
    mockUpdateIssue.mockReset()
    mockCreateComment.mockReset()
    mockTeam.mockReset()
  })

  it('returns workflow state nodes for the team', async () => {
    const stateNodes = [
      { id: 's1', name: 'Triage', type: 'triage', color: '#ccc', position: 0 },
      { id: 's2', name: 'In Progress', type: 'started', color: '#0f0', position: 1 },
      { id: 's3', name: 'Done', type: 'completed', color: '#00f', position: 2 },
    ]
    const mockTeamInstance = {
      states: vi.fn().mockResolvedValue({ nodes: stateNodes }),
    }
    mockTeam.mockResolvedValue(mockTeamInstance)

    const states = await getWorkflowStates()

    expect(states).toHaveLength(3)
    expect(states[0].name).toBe('Triage')
    expect(states[2].type).toBe('completed')
  })

  it('throws when team is not found', async () => {
    mockTeam.mockResolvedValue(null)

    await expect(getWorkflowStates()).rejects.toThrow('not found')
  })
})

// =============================================================================
// mapPriorityToLinear tests
// =============================================================================

describe('mapPriorityToLinear', () => {
  it('maps P0 to Linear Urgent (1)', () => {
    expect(mapPriorityToLinear('P0')).toBe(1)
  })

  it('maps P1 to Linear High (2)', () => {
    expect(mapPriorityToLinear('P1')).toBe(2)
  })

  it('maps P2 to Linear Medium (3)', () => {
    expect(mapPriorityToLinear('P2')).toBe(3)
  })

  it('maps P3 to Linear Low (4)', () => {
    expect(mapPriorityToLinear('P3')).toBe(4)
  })

  it('returns 0 (No priority) for unknown priority strings', () => {
    expect(mapPriorityToLinear('P5')).toBe(0)
    expect(mapPriorityToLinear('unknown')).toBe(0)
    expect(mapPriorityToLinear('')).toBe(0)
  })
})

// =============================================================================
// calculateSimilarity tests
// =============================================================================

describe('calculateSimilarity', () => {
  it('returns 100 for identical strings', () => {
    expect(calculateSimilarity('hello world test', 'hello world test')).toBe(100)
  })

  it('returns 0 when strings share no words longer than 3 chars', () => {
    expect(calculateSimilarity('the a an', 'is was be')).toBe(0)
  })

  it('returns 0 for empty strings', () => {
    expect(calculateSimilarity('', '')).toBe(0)
    expect(calculateSimilarity('hello world', '')).toBe(0)
  })

  it('calculates partial similarity (Jaccard coefficient)', () => {
    const score = calculateSimilarity(
      'implement user authentication system',
      'implement authentication module with tokens'
    )
    // Shared: "implement", "authentication" (2)
    // Union: "implement", "user", "authentication", "system", "module", "with", "tokens" -> depends on length filter
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })

  it('is case-insensitive', () => {
    const s1 = calculateSimilarity('Hello World Test', 'hello world test')
    expect(s1).toBe(100)
  })

  it('filters out short words (3 chars or less)', () => {
    // All words are 3 chars or less
    const score = calculateSimilarity('the fox ran', 'the fox ran')
    // "the" = 3 chars, "fox" = 3 chars, "ran" = 3 chars -- all filtered
    expect(score).toBe(0)
  })
})
