/**
 * Senior PM Validator
 *
 * Validation logic for the Senior PM Enhanced agent
 * Assesses feasibility, complexity, priority, and routes to domain agents
 *
 * Pattern: Called by Senior PM agent during validation phase
 */

import type { QueueItem, ValidationResult, Priority, Complexity } from './work-queue-manager';
import { searchIssues } from '@/lib/linear/api-client';
import { extractSearchKeywords, findPotentialDuplicates } from '@/lib/linear/graphql-queries';
import { getPMEnrichmentForValidation, recordValidationActivity } from '@/lib/senior-pm/client-pm-manager';

// =====================================================
// Feasibility Assessment
// =====================================================

/**
 * Assess feasibility of queue item
 *
 * Returns score 0-100 based on technical feasibility
 *
 * @param item - Queue item to assess
 * @returns Feasibility score and notes
 */
export async function assessFeasibility(item: QueueItem): Promise<{
  score: number;
  notes: string;
}> {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let score = 80; // Default: moderately feasible
  const notes: string[] = [];

  // Tax-related feasibility checks
  if (/r&d|research|development/i.test(text)) {
    if (/xero/i.test(text)) {
      score += 10;
      notes.push('Xero integration available for data extraction');
    }
    if (/division 355/i.test(text)) {
      score += 5;
      notes.push('R&D Tax Incentive specialist available');
    }
  }

  // Xero integration checks
  if (/xero|transaction|sync/i.test(text)) {
    score += 10;
    notes.push('Xero client and API integration already implemented');
  }

  // Database/schema changes
  if (/database|migration|schema/i.test(text)) {
    score -= 10;
    notes.push('Database changes require careful migration planning');
  }

  // UI/Frontend changes
  if (/ui|frontend|component|page/i.test(text)) {
    score += 5;
    notes.push('Frontend changes are straightforward with existing patterns');
  }

  // New integrations (lower feasibility)
  if (/api|integration|external/i.test(text) && !/xero|linear/i.test(text)) {
    score -= 15;
    notes.push('New external integration requires research and setup');
  }

  // Security concerns
  if (/security|vulnerability|auth|password/i.test(text)) {
    score -= 5;
    notes.push('Security-related changes require extra scrutiny');
  }

  // Compliance/legislation
  if (/legislation|ato|compliance|ruling/i.test(text)) {
    score += 5;
    notes.push('Tax law research capabilities available');
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    notes: notes.join('. ') || 'Standard feasibility assessment.',
  };
}

// =====================================================
// Complexity Assessment
// =====================================================

/**
 * Assess complexity of queue item
 *
 * @param item - Queue item to assess
 * @returns Complexity level
 */
export function assessComplexity(item: QueueItem): Complexity {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let complexityScore = 0;

  // Simple indicators
  if (/typo|fix text|update label|change color|adjust padding/i.test(text)) {
    return 'simple';
  }

  // Complexity indicators
  const complexityFactors: [RegExp, number, string][] = [
    [/migration|schema|database/i, 3, 'Database changes'],
    [/multi|multiple|several|all/i, 2, 'Multiple targets'],
    [/integration|api|external/i, 2, 'External integration'],
    [/agent|workflow|orchestrat/i, 3, 'Agent coordination'],
    [/refactor|restructure|redesign/i, 2, 'Structural changes'],
    [/test|validation|verificat/i, 1, 'Testing required'],
    [/security|auth|permission/i, 2, 'Security implications'],
    [/calculation|formula|algorithm/i, 2, 'Logic complexity'],
    [/report|document|export/i, 1, 'Report generation'],
  ];

  for (const [pattern, points, _reason] of complexityFactors) {
    if (pattern.test(text)) {
      complexityScore += points;
    }
  }

  // Determine complexity level
  if (complexityScore >= 5) {
    return 'complex';
  } else if (complexityScore >= 2) {
    return 'medium';
  } else {
    return 'simple';
  }
}

// =====================================================
// Priority Assessment
// =====================================================

/**
 * Assign priority to queue item
 *
 * @param item - Queue item to assess
 * @returns Priority level
 */
export function assignPriority(item: QueueItem): Priority {
  const text = `${item.title} ${item.description}`.toLowerCase();

  // P0 (Critical) triggers
  const p0Triggers = [
    /security|vulnerability|exploit/i,
    /production|blocker|critical|urgent/i,
    /data loss|corruption/i,
    /deadline.*\d+\s*day/i, // "deadline 3 days"
  ];

  for (const trigger of p0Triggers) {
    if (trigger.test(text)) {
      return 'P0';
    }
  }

  // P1 (High) triggers
  const p1Triggers = [
    /bug|error|broken|fail/i,
    /client|customer|user.*report/i,
    /compliance|ato.*deadline/i,
    /r&d.*registration/i,
    /amendment.*period/i,
  ];

  for (const trigger of p1Triggers) {
    if (trigger.test(text)) {
      return 'P1';
    }
  }

  // P3 (Low) triggers
  const p3Triggers = [
    /nice to have|polish|cosmetic/i,
    /documentation|comment|readme/i,
    /refactor|cleanup|tech debt/i,
    /internal.*only/i,
  ];

  for (const trigger of p3Triggers) {
    if (trigger.test(text)) {
      return 'P3';
    }
  }

  // Default: P2 (Medium)
  return 'P2';
}

// =====================================================
// Domain Routing
// =====================================================

/**
 * Determine which domain agent should handle this item
 *
 * @param item - Queue item to route
 * @returns Agent name
 */
export function determineAssignedAgent(item: QueueItem): string {
  const text = `${item.title} ${item.description}`.toLowerCase();

  // Agent routing matrix
  const agentRoutes: [RegExp, string][] = [
    [/r&d|research.*development|division 355/i, 'rnd-tax-specialist'],
    [/deduction|expense|section 8-1|claim/i, 'deduction-optimizer'],
    [/loss|carry.*forward|division 7a|loan/i, 'loss-recovery-agent'],
    [/xero|transaction|sync|connection/i, 'xero-auditor'],
    [/trust|distribution|upe|section 100a/i, 'trust-distribution-analyzer'],
    [/bad debt|write.*off|section 25-35/i, 'bad-debt-recovery-agent'],
    [/grant|incentive|government|subsidy/i, 'government-grants-finder'],
    [/cgt|capital gain|division 152/i, 'cgt-concession-planner'],
    [/fbt|fringe benefit/i, 'fbt-optimizer'],
    [/legislation|ruling|ato|compliance/i, 'tax-law-analyst'],
  ];

  for (const [pattern, agent] of agentRoutes) {
    if (pattern.test(text)) {
      return agent;
    }
  }

  // Default: general execution (no specialist needed)
  return 'general';
}

/**
 * Determine execution strategy
 *
 * @param complexity - Complexity level
 * @param assignedAgent - Assigned domain agent
 * @param priority - Priority level
 * @returns Execution strategy
 */
export function determineExecutionStrategy(
  complexity: Complexity,
  assignedAgent: string,
  priority: Priority
): 'direct' | 'requires_planning' | 'specialist_review' {
  // Complex items always need specialist review
  if (complexity === 'complex') {
    return 'specialist_review';
  }

  // P0 items need specialist review
  if (priority === 'P0') {
    return 'specialist_review';
  }

  // Specialist agents need planning
  if (assignedAgent !== 'general') {
    return 'requires_planning';
  }

  // Simple general items can execute directly
  if (complexity === 'simple') {
    return 'direct';
  }

  // Everything else needs planning
  return 'requires_planning';
}

// =====================================================
// Duplicate Detection
// =====================================================

/**
 * Check for duplicate issues in Linear
 *
 * @param item - Queue item to check
 * @returns Duplicate detection result
 */
export async function checkForDuplicates(item: QueueItem): Promise<{
  isDuplicate: boolean;
  duplicateIssueId?: string;
  duplicateIssueIdentifier?: string;
  duplicateIssueUrl?: string;
  similarityScore?: number;
  matchReason?: string;
}> {
  try {
    // Extract search keywords
    const keywords = extractSearchKeywords(item.title, item.description);

    // Search Linear
    const existingIssues = await searchIssues(keywords);

    if (!existingIssues || existingIssues.length === 0) {
      return { isDuplicate: false };
    }

    // Find potential duplicates
    const duplicates = findPotentialDuplicates(
      existingIssues,
      item.title,
      item.description,
      70 // 70% similarity threshold
    );

    if (duplicates.length === 0) {
      return { isDuplicate: false };
    }

    // Return highest similarity match
    const topMatch = duplicates[0];
    return {
      isDuplicate: true,
      duplicateIssueId: topMatch.issue.id,
      duplicateIssueIdentifier: topMatch.issue.identifier,
      duplicateIssueUrl: topMatch.issue.url,
      similarityScore: topMatch.similarityScore,
      matchReason: topMatch.matchReason,
    };
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    // On error, assume not duplicate and continue
    return { isDuplicate: false };
  }
}

// =====================================================
// Complete Validation Pipeline
// =====================================================

/**
 * Run complete validation pipeline for a queue item
 *
 * This is the main entry point for validation.
 * When an organizationId is available in the queue item payload,
 * the validation is enriched with client-specific PM context.
 *
 * @param item - Queue item to validate
 * @returns Complete validation result
 */
export async function validateQueueItem(item: QueueItem): Promise<ValidationResult> {
  // 0. Get client PM enrichment if organization context available
  const organizationId = (item.payload?.organizationId || item.payload?.organisation_id) as string | undefined;
  let pmEnrichment: Awaited<ReturnType<typeof getPMEnrichmentForValidation>> | null = null;

  if (organizationId) {
    try {
      pmEnrichment = await getPMEnrichmentForValidation(organizationId);
    } catch {
      // PM enrichment is optional - continue without it
    }
  }

  // 1. Assess feasibility
  const feasibility = await assessFeasibility(item);

  // 2. Assess complexity
  const complexity = assessComplexity(item);

  // 3. Check for duplicates
  const duplicateCheck = await checkForDuplicates(item);

  // 4. Assign priority (with PM boost if applicable)
  let priority = assignPriority(item);
  if (pmEnrichment && pmEnrichment.priority_boost > 0) {
    priority = boostPriority(priority, pmEnrichment.priority_boost);
  }

  // 5. Route to domain agent (prefer client's preferred agents)
  let assignedAgent = determineAssignedAgent(item);
  if (assignedAgent === 'general' && pmEnrichment && pmEnrichment.preferred_agents.length > 0) {
    // If no specialist detected by keywords but client has preferred agents, use the first match
    assignedAgent = pmEnrichment.preferred_agents[0];
  }

  // 6. Determine execution strategy
  const executionStrategy = determineExecutionStrategy(complexity, assignedAgent, priority);

  // 7. Calculate overall confidence
  const confidence = calculateConfidence(feasibility.score, complexity, duplicateCheck.isDuplicate);

  // 8. Build notes (include PM context)
  const pmNotes = pmEnrichment ? pmEnrichment.notes : [];
  const notes = buildValidationNotes(
    feasibility.notes,
    complexity,
    assignedAgent,
    executionStrategy,
    duplicateCheck,
    pmNotes
  );

  // 9. Record validation activity for the client PM
  if (organizationId) {
    try {
      await recordValidationActivity(organizationId, {
        items_validated: 1,
        confidence_score: confidence,
      });
    } catch {
      // Recording activity is non-critical
    }
  }

  return {
    feasible: feasibility.score >= 50,
    feasibility_score: feasibility.score,
    complexity,
    is_duplicate: duplicateCheck.isDuplicate,
    duplicate_issue_id: duplicateCheck.duplicateIssueId,
    priority,
    assigned_agent: assignedAgent,
    execution_strategy: executionStrategy,
    confidence,
    notes,
  };
}

/**
 * Boost priority level by N levels (P3 → P2 → P1 → P0)
 */
function boostPriority(current: Priority, boost: number): Priority {
  const levels: Priority[] = ['P3', 'P2', 'P1', 'P0'];
  const currentIdx = levels.indexOf(current);
  const boostedIdx = Math.min(currentIdx + boost, levels.length - 1);
  return levels[boostedIdx];
}

/**
 * Calculate overall confidence score
 *
 * @param feasibilityScore - Feasibility score (0-100)
 * @param complexity - Complexity level
 * @param isDuplicate - Whether duplicate detected
 * @returns Confidence score (0-100)
 */
function calculateConfidence(
  feasibilityScore: number,
  complexity: Complexity,
  isDuplicate: boolean
): number {
  let confidence = feasibilityScore;

  // Reduce confidence for complex items
  if (complexity === 'complex') {
    confidence -= 10;
  } else if (complexity === 'medium') {
    confidence -= 5;
  }

  // High confidence for duplicates (we know they exist)
  if (isDuplicate) {
    confidence = 95;
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Build human-readable validation notes
 *
 * @param feasibilityNotes - Feasibility assessment notes
 * @param complexity - Complexity level
 * @param assignedAgent - Assigned agent
 * @param executionStrategy - Execution strategy
 * @param duplicateCheck - Duplicate check result
 * @returns Combined notes string
 */
function buildValidationNotes(
  feasibilityNotes: string,
  complexity: Complexity,
  assignedAgent: string,
  executionStrategy: string,
  duplicateCheck: ReturnType<typeof checkForDuplicates> extends Promise<infer U> ? U : never,
  pmNotes: string[] = []
): string {
  const parts: string[] = [];

  // PM context (placed first for visibility)
  if (pmNotes.length > 0) {
    parts.push(`Client PM: ${pmNotes.join('. ')}`);
  }

  // Feasibility
  parts.push(`Feasibility: ${feasibilityNotes}`);

  // Complexity
  const complexityDesc: Record<string, string> = {
    simple: 'Single file change, straightforward implementation.',
    medium: 'Multiple files affected, moderate effort required.',
    complex: 'Significant architectural changes, requires careful planning.',
  };
  parts.push(`Complexity: ${complexityDesc[complexity] || complexity}`);

  // Agent routing
  if (assignedAgent !== 'general') {
    parts.push(`Routed to ${assignedAgent} for specialist handling.`);
  }

  // Execution strategy
  const strategyDesc: Record<string, string> = {
    direct: 'Can execute immediately without planning phase.',
    requires_planning: 'Requires planning sub-agent before execution.',
    specialist_review: 'Requires user approval before execution due to complexity or value.',
  };
  parts.push(`Execution: ${strategyDesc[executionStrategy] || executionStrategy}`);

  // Duplicate info
  if (duplicateCheck.isDuplicate) {
    parts.push(
      `Duplicate detected: ${duplicateCheck.duplicateIssueIdentifier} (${duplicateCheck.similarityScore}% match). ${duplicateCheck.matchReason}`
    );
  }

  return parts.join(' ');
}

// =====================================================
// Validation Statistics
// =====================================================

/**
 * Get validation statistics
 *
 * Useful for monitoring PM performance
 *
 * @returns Validation stats
 */
export interface ValidationStats {
  total_validated: number;
  by_complexity: Record<Complexity, number>;
  by_priority: Record<Priority, number>;
  by_agent: Record<string, number>;
  avg_feasibility_score: number;
  avg_confidence: number;
  duplicate_rate: number;
}

/**
 * Calculate validation statistics from queue items
 *
 * @param items - Array of validated queue items
 * @returns Validation statistics
 */
export function calculateValidationStats(items: QueueItem[]): ValidationStats {
  const stats: ValidationStats = {
    total_validated: items.length,
    by_complexity: { simple: 0, medium: 0, complex: 0 },
    by_priority: { P0: 0, P1: 0, P2: 0, P3: 0 },
    by_agent: {},
    avg_feasibility_score: 0,
    avg_confidence: 0,
    duplicate_rate: 0,
  };

  let totalFeasibility = 0;
  let totalConfidence = 0;
  let duplicateCount = 0;

  for (const item of items) {
    if (!item.validation_result) continue;

    const vr = item.validation_result;

    // Complexity
    if (vr.complexity) {
      stats.by_complexity[vr.complexity]++;
    }

    // Priority
    if (vr.priority) {
      stats.by_priority[vr.priority]++;
    }

    // Agent
    if (vr.assigned_agent) {
      stats.by_agent[vr.assigned_agent] = (stats.by_agent[vr.assigned_agent] || 0) + 1;
    }

    // Scores
    totalFeasibility += vr.feasibility_score;
    totalConfidence += vr.confidence;

    // Duplicates
    if (vr.is_duplicate) {
      duplicateCount++;
    }
  }

  if (items.length > 0) {
    stats.avg_feasibility_score = Math.round(totalFeasibility / items.length);
    stats.avg_confidence = Math.round(totalConfidence / items.length);
    stats.duplicate_rate = Math.round((duplicateCount / items.length) * 100);
  }

  return stats;
}
