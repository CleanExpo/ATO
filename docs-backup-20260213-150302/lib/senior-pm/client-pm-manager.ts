/**
 * Client PM Assignment Manager
 *
 * Assigns a dedicated Senior Project Manager context to every client (organization).
 * Each client gets a persistent PM profile that tracks their analysis history,
 * priorities, compliance deadlines, and orchestrates work on their behalf.
 *
 * Architecture:
 * - One PM assignment per organization (1:1 mapping)
 * - Auto-created on first organization access or Xero connection
 * - PM context enriches queue validation with client-specific knowledge
 * - Tracks per-client compliance calendar, analysis cadence, and escalation preferences
 */

import { createServiceClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import type { Organization } from '@/lib/types/multi-tenant';

const log = createLogger('senior-pm:client-assignment');

// =====================================================
// Types
// =====================================================

export type PMAssignmentStatus = 'active' | 'paused' | 'archived';

export type AnalysisCadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'on_demand';

export type EscalationPreference = 'immediate' | 'daily_digest' | 'weekly_summary';

export interface ClientPMAssignment {
  id: string;
  organization_id: string;
  status: PMAssignmentStatus;

  // PM context for this client
  pm_context: PMContext;

  // Tracking
  last_validation_at?: string;
  total_items_validated: number;
  total_items_completed: number;
  total_savings_identified: number; // AUD cents (integer for precision)

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PMContext {
  // Client profile
  client_profile: {
    entity_type?: string;       // company, trust, individual, partnership, smsf
    industry?: string;
    annual_turnover_bracket?: string;  // '<2M' | '2M-10M' | '10M-50M' | '50M+'
    financial_year_end: string;        // 'June' or custom
    xero_connected: boolean;
    accounting_platforms: string[];    // ['xero', 'myob', 'quickbooks']
  };

  // Analysis preferences
  analysis_preferences: {
    cadence: AnalysisCadence;
    priority_engines: string[];     // e.g., ['rnd', 'deductions', 'div7a']
    excluded_engines: string[];     // engines the client opted out of
    auto_reanalyse_on_sync: boolean;
  };

  // Compliance tracking
  compliance_deadlines: ComplianceDeadline[];

  // Escalation settings
  escalation_preference: EscalationPreference;
  accountant_linked: boolean;
  accountant_email?: string;

  // Historical insights (updated after each validation cycle)
  insights_summary: {
    top_opportunities: string[];      // e.g., ['R&D offset: $43,500', 'Missed deductions: $12,300']
    risk_areas: string[];             // e.g., ['Division 7A non-compliance', 'FBT underreporting']
    last_analysis_confidence: number; // 0-100
    trend: 'improving' | 'stable' | 'declining';
  };
}

export interface ComplianceDeadline {
  id: string;
  obligation: string;          // e.g., 'BAS Q3', 'R&D Registration', 'FBT Return'
  due_date: string;            // ISO 8601
  status: 'upcoming' | 'due_soon' | 'overdue' | 'completed';
  reminder_sent: boolean;
  notes?: string;
}

export interface PMAssignmentSummary {
  organization_id: string;
  organization_name: string;
  status: PMAssignmentStatus;
  last_validation_at?: string;
  total_items_validated: number;
  total_savings_identified_aud: number;
  next_deadline?: ComplianceDeadline;
  insights_trend: string;
}

// =====================================================
// PM Assignment Operations
// =====================================================

/**
 * Get or create PM assignment for an organization
 *
 * Ensures every client has a dedicated PM context.
 * Creates one on first access (lazy initialization).
 */
export async function getOrCreatePMAssignment(
  organizationId: string
): Promise<ClientPMAssignment> {
  const supabase = await createServiceClient();

  // Try to find existing assignment
  const { data: existing, error: fetchError } = await supabase
    .from('client_pm_assignments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();

  if (fetchError) {
    log.error('Failed to fetch PM assignment', { organizationId, error: fetchError.message });
    throw new Error(`Failed to fetch PM assignment: ${fetchError.message}`);
  }

  if (existing) {
    return existing as ClientPMAssignment;
  }

  // Fetch organization details to build initial context
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  // Create new PM assignment with default context
  const defaultContext = buildDefaultPMContext(org as Organization | null);

  const { data: created, error: createError } = await supabase
    .from('client_pm_assignments')
    .insert({
      organization_id: organizationId,
      status: 'active',
      pm_context: defaultContext,
      total_items_validated: 0,
      total_items_completed: 0,
      total_savings_identified: 0,
    })
    .select()
    .single();

  if (createError) {
    log.error('Failed to create PM assignment', { organizationId, error: createError.message });
    throw new Error(`Failed to create PM assignment: ${createError.message}`);
  }

  log.info('Created PM assignment for organization', { organizationId });
  return created as ClientPMAssignment;
}

/**
 * Get PM assignment for an organization (without auto-creation)
 */
export async function getPMAssignment(
  organizationId: string
): Promise<ClientPMAssignment | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('client_pm_assignments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    log.error('Failed to fetch PM assignment', { organizationId, error: error.message });
    throw new Error(`Failed to fetch PM assignment: ${error.message}`);
  }

  return data as ClientPMAssignment | null;
}

/**
 * Update PM context for a client
 *
 * Used to update analysis preferences, escalation settings, etc.
 */
export async function updatePMContext(
  organizationId: string,
  contextUpdates: Partial<PMContext>
): Promise<ClientPMAssignment> {
  const supabase = await createServiceClient();

  // Fetch current assignment
  const current = await getOrCreatePMAssignment(organizationId);

  // Merge context updates
  const updatedContext: PMContext = {
    ...current.pm_context,
    ...contextUpdates,
    client_profile: {
      ...current.pm_context.client_profile,
      ...(contextUpdates.client_profile || {}),
    },
    analysis_preferences: {
      ...current.pm_context.analysis_preferences,
      ...(contextUpdates.analysis_preferences || {}),
    },
    insights_summary: {
      ...current.pm_context.insights_summary,
      ...(contextUpdates.insights_summary || {}),
    },
  };

  const { data, error } = await supabase
    .from('client_pm_assignments')
    .update({
      pm_context: updatedContext,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
    .select()
    .single();

  if (error) {
    log.error('Failed to update PM context', { organizationId, error: error.message });
    throw new Error(`Failed to update PM context: ${error.message}`);
  }

  log.info('Updated PM context', { organizationId });
  return data as ClientPMAssignment;
}

/**
 * Record validation activity for a client
 *
 * Called after Senior PM validates a queue item belonging to this organization.
 */
export async function recordValidationActivity(
  organizationId: string,
  activity: {
    items_validated: number;
    items_completed?: number;
    savings_identified_cents?: number;
    confidence_score?: number;
  }
): Promise<void> {
  const supabase = await createServiceClient();

  const assignment = await getOrCreatePMAssignment(organizationId);

  const updates: Record<string, unknown> = {
    last_validation_at: new Date().toISOString(),
    total_items_validated: assignment.total_items_validated + activity.items_validated,
    updated_at: new Date().toISOString(),
  };

  if (activity.items_completed) {
    updates.total_items_completed = assignment.total_items_completed + activity.items_completed;
  }

  if (activity.savings_identified_cents) {
    updates.total_savings_identified = assignment.total_savings_identified + activity.savings_identified_cents;
  }

  // Update confidence trend in context
  if (activity.confidence_score !== undefined) {
    const prevConfidence = assignment.pm_context.insights_summary.last_analysis_confidence;
    const trend = activity.confidence_score > prevConfidence
      ? 'improving'
      : activity.confidence_score < prevConfidence
        ? 'declining'
        : 'stable';

    const updatedContext = {
      ...assignment.pm_context,
      insights_summary: {
        ...assignment.pm_context.insights_summary,
        last_analysis_confidence: activity.confidence_score,
        trend,
      },
    };
    updates.pm_context = updatedContext;
  }

  const { error } = await supabase
    .from('client_pm_assignments')
    .update(updates)
    .eq('id', assignment.id);

  if (error) {
    log.error('Failed to record validation activity', { organizationId, error: error.message });
  }
}

/**
 * Update compliance deadlines for a client
 */
export async function updateComplianceDeadlines(
  organizationId: string,
  deadlines: ComplianceDeadline[]
): Promise<void> {
  const assignment = await getOrCreatePMAssignment(organizationId);

  await updatePMContext(organizationId, {
    compliance_deadlines: deadlines,
  });

  log.info('Updated compliance deadlines', {
    organizationId,
    deadlineCount: deadlines.length,
    assignmentId: assignment.id,
  });
}

/**
 * Get all active PM assignments (for admin dashboard)
 */
export async function getAllActivePMAssignments(): Promise<PMAssignmentSummary[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('client_pm_assignments')
    .select(`
      id,
      organization_id,
      status,
      last_validation_at,
      total_items_validated,
      total_savings_identified,
      pm_context,
      organizations!inner (
        name
      )
    `)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) {
    log.error('Failed to fetch active PM assignments', { error: error.message });
    throw new Error(`Failed to fetch PM assignments: ${error.message}`);
  }

  return (data || []).map((row: Record<string, unknown>) => {
    const context = row.pm_context as PMContext;
    const org = row.organizations as { name: string };

    // Find next upcoming deadline
    const upcomingDeadlines = (context.compliance_deadlines || [])
      .filter(d => d.status === 'upcoming' || d.status === 'due_soon')
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    return {
      organization_id: row.organization_id as string,
      organization_name: org.name,
      status: row.status as PMAssignmentStatus,
      last_validation_at: row.last_validation_at as string | undefined,
      total_items_validated: row.total_items_validated as number,
      total_savings_identified_aud: (row.total_savings_identified as number) / 100,
      next_deadline: upcomingDeadlines[0] || undefined,
      insights_trend: context.insights_summary?.trend || 'stable',
    };
  });
}

/**
 * Ensure all organizations have PM assignments
 *
 * Called during system initialization or admin action to backfill
 * PM assignments for any organizations that don't have one yet.
 */
export async function ensureAllOrganizationsHavePM(): Promise<{
  created: number;
  existing: number;
  errors: number;
}> {
  const supabase = await createServiceClient();

  // Get all active organizations
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null);

  if (orgError) {
    log.error('Failed to fetch organizations', { error: orgError.message });
    throw new Error(`Failed to fetch organizations: ${orgError.message}`);
  }

  // Get existing PM assignments
  const { data: assignments } = await supabase
    .from('client_pm_assignments')
    .select('organization_id')
    .eq('status', 'active');

  const assignedOrgIds = new Set((assignments || []).map(a => a.organization_id));

  let created = 0;
  let existing = 0;
  let errors = 0;

  for (const org of orgs || []) {
    if (assignedOrgIds.has(org.id)) {
      existing++;
      continue;
    }

    try {
      await getOrCreatePMAssignment(org.id);
      created++;
      log.info('Created PM assignment for organization', { orgId: org.id, orgName: org.name });
    } catch (err) {
      errors++;
      log.error('Failed to create PM assignment', {
        orgId: org.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  log.info('PM assignment backfill complete', { created, existing, errors });
  return { created, existing, errors };
}

/**
 * Pause PM assignment (e.g., when subscription expires)
 */
export async function pausePMAssignment(organizationId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('client_pm_assignments')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  if (error) {
    log.error('Failed to pause PM assignment', { organizationId, error: error.message });
    throw new Error(`Failed to pause PM assignment: ${error.message}`);
  }

  log.info('Paused PM assignment', { organizationId });
}

/**
 * Reactivate PM assignment
 */
export async function reactivatePMAssignment(organizationId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('client_pm_assignments')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('status', 'paused');

  if (error) {
    log.error('Failed to reactivate PM assignment', { organizationId, error: error.message });
    throw new Error(`Failed to reactivate PM assignment: ${error.message}`);
  }

  log.info('Reactivated PM assignment', { organizationId });
}

// =====================================================
// PM Context Enrichment for Validation
// =====================================================

/**
 * Get PM enrichment data for queue validation
 *
 * Called by the Senior PM validator to enrich validation
 * decisions with client-specific context.
 */
export async function getPMEnrichmentForValidation(
  organizationId: string
): Promise<{
  priority_boost: number;
  preferred_agents: string[];
  compliance_urgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
  client_tier: string;
  notes: string[];
}> {
  const assignment = await getPMAssignment(organizationId);

  if (!assignment) {
    return {
      priority_boost: 0,
      preferred_agents: [],
      compliance_urgency: 'none',
      client_tier: 'standard',
      notes: ['No PM assignment found - using default validation'],
    };
  }

  const context = assignment.pm_context;
  const notes: string[] = [];
  let priorityBoost = 0;

  // Check for upcoming compliance deadlines
  const now = new Date();
  const upcomingDeadlines = (context.compliance_deadlines || []).filter(d => {
    const dueDate = new Date(d.due_date);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue > 0 && daysUntilDue <= 30 && d.status !== 'completed';
  });

  let complianceUrgency: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
  if (upcomingDeadlines.length > 0) {
    const nearestDays = Math.min(
      ...upcomingDeadlines.map(d =>
        Math.ceil((new Date(d.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      )
    );

    if (nearestDays <= 3) {
      complianceUrgency = 'critical';
      priorityBoost = 2; // Boost by 2 priority levels
      notes.push(`CRITICAL: Compliance deadline in ${nearestDays} days`);
    } else if (nearestDays <= 7) {
      complianceUrgency = 'high';
      priorityBoost = 1;
      notes.push(`HIGH: Compliance deadline in ${nearestDays} days`);
    } else if (nearestDays <= 14) {
      complianceUrgency = 'medium';
      notes.push(`MEDIUM: Compliance deadline in ${nearestDays} days`);
    } else {
      complianceUrgency = 'low';
    }
  }

  // Risk areas inform agent routing
  if (context.insights_summary.risk_areas.length > 0) {
    notes.push(`Risk areas: ${context.insights_summary.risk_areas.join(', ')}`);
  }

  return {
    priority_boost: priorityBoost,
    preferred_agents: context.analysis_preferences.priority_engines.map(e => mapEngineToAgent(e)),
    compliance_urgency: complianceUrgency,
    client_tier: context.client_profile.annual_turnover_bracket || 'standard',
    notes,
  };
}

// =====================================================
// Helper Functions
// =====================================================

function buildDefaultPMContext(org: Organization | null): PMContext {
  return {
    client_profile: {
      entity_type: undefined,
      industry: org?.industry || undefined,
      annual_turnover_bracket: undefined,
      financial_year_end: org?.settings?.financialYearEnd || 'June',
      xero_connected: !!org?.xeroTenantId,
      accounting_platforms: org?.xeroTenantId ? ['xero'] : [],
    },
    analysis_preferences: {
      cadence: 'monthly',
      priority_engines: ['deductions', 'rnd', 'div7a', 'losses'],
      excluded_engines: [],
      auto_reanalyse_on_sync: true,
    },
    compliance_deadlines: [],
    escalation_preference: 'daily_digest',
    accountant_linked: false,
    insights_summary: {
      top_opportunities: [],
      risk_areas: [],
      last_analysis_confidence: 0,
      trend: 'stable',
    },
  };
}

function mapEngineToAgent(engine: string): string {
  const mapping: Record<string, string> = {
    rnd: 'rnd-tax-specialist',
    deductions: 'deduction-optimizer',
    div7a: 'loss-recovery-agent',
    losses: 'loss-recovery-agent',
    cgt: 'cgt-concession-planner',
    fbt: 'fbt-optimizer',
    trust: 'trust-distribution-analyzer',
    payroll: 'payroll-tax-optimizer',
    psi: 'psi-classifier',
    superannuation: 'superannuation-specialist',
    fuel: 'fuel-tax-credits-analyzer',
  };
  return mapping[engine] || 'general';
}
