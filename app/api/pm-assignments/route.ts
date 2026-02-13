/**
 * PM Assignments API
 *
 * GET  /api/pm-assignments          - List all active PM assignments (admin)
 * POST /api/pm-assignments          - Ensure all orgs have PM assignments (admin backfill)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  getAllActivePMAssignments,
  ensureAllOrganizationsHavePM,
} from '@/lib/senior-pm/client-pm-manager';
import { createErrorResponse } from '@/lib/api/errors';

/**
 * GET /api/pm-assignments
 *
 * Returns all active PM assignments with summary data.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const assignments = await getAllActivePMAssignments();

    return NextResponse.json({
      assignments,
      total: assignments.length,
    });
  } catch (error) {
    return createErrorResponse(error, { operation: 'listPMAssignments' }, 500);
  }
}

/**
 * POST /api/pm-assignments
 *
 * Backfill PM assignments for all organizations that don't have one.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const result = await ensureAllOrganizationsHavePM();

    return NextResponse.json({
      message: 'PM assignment backfill complete',
      created: result.created,
      existing: result.existing,
      errors: result.errors,
    });
  } catch (error) {
    return createErrorResponse(error, { operation: 'backfillPMAssignments' }, 500);
  }
}
