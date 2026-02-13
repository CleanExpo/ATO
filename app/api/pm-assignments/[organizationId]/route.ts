/**
 * Per-Organization PM Assignment API
 *
 * GET   /api/pm-assignments/[organizationId]  - Get PM assignment for an organization
 * PATCH /api/pm-assignments/[organizationId]  - Update PM context (preferences, deadlines)
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  getOrCreatePMAssignment,
  updatePMContext,
  updateComplianceDeadlines,
  recordValidationActivity,
  pausePMAssignment,
  reactivatePMAssignment,
} from '@/lib/senior-pm/client-pm-manager';
import { createErrorResponse } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ organizationId: string }>;
}

/**
 * GET /api/pm-assignments/[organizationId]
 *
 * Returns the PM assignment for a specific organization.
 * Auto-creates if one doesn't exist yet.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const assignment = await getOrCreatePMAssignment(organizationId);

    return NextResponse.json({ assignment });
  } catch (error) {
    return createErrorResponse(error, { operation: 'getPMAssignment' }, 500);
  }
}

/**
 * PATCH /api/pm-assignments/[organizationId]
 *
 * Update PM context for an organization.
 *
 * Body can contain:
 * - action: 'update_context' | 'update_deadlines' | 'record_activity' | 'pause' | 'reactivate'
 * - data: Action-specific payload
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'update_context': {
        const updated = await updatePMContext(organizationId, data);
        return NextResponse.json({ assignment: updated });
      }

      case 'update_deadlines': {
        await updateComplianceDeadlines(organizationId, data.deadlines);
        const assignment = await getOrCreatePMAssignment(organizationId);
        return NextResponse.json({ assignment });
      }

      case 'record_activity': {
        await recordValidationActivity(organizationId, data);
        return NextResponse.json({ success: true });
      }

      case 'pause': {
        await pausePMAssignment(organizationId);
        return NextResponse.json({ success: true, status: 'paused' });
      }

      case 'reactivate': {
        await reactivatePMAssignment(organizationId);
        return NextResponse.json({ success: true, status: 'active' });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: update_context, update_deadlines, record_activity, pause, reactivate` },
          { status: 400 }
        );
    }
  } catch (error) {
    return createErrorResponse(error, { operation: 'updatePMAssignment' }, 500);
  }
}
