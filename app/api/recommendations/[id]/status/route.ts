/**
 * GET/POST /api/recommendations/[id]/status
 *
 * Get or update the status of a recommendation.
 * Owner access requires tenantId.
 *
 * GET:
 *   Query: tenantId (required)
 *   Returns: StatusHistory with current status and history
 *
 * POST:
 *   Body: { tenantId, status, updatedByName, notes? }
 *   Returns: UpdateStatusResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import type {
  RecommendationStatus,
  StatusUpdate,
  StatusHistory,
  UpdateStatusResponse,
} from '@/lib/types/recommendation-status';
import { STATUS_CONFIG, isValidTransition } from '@/lib/types/recommendation-status';

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { id: recommendationId } = await context.params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return createValidationError('tenantId query parameter is required');
    }

    const supabase = await createServiceClient();

    // Get all status updates for this recommendation
    const { data: updates, error } = await supabase
      .from('recommendation_status')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching status:', error);
      return createErrorResponse(new Error('Failed to fetch status'), {}, 500);
    }

    // Map to StatusUpdate format
    const history: StatusUpdate[] = (updates || []).map((u) => ({
      id: u.id,
      recommendationId: u.recommendation_id,
      shareId: u.share_id,
      tenantId: u.tenant_id,
      status: u.status as RecommendationStatus,
      updatedByName: u.updated_by_name,
      updatedByType: u.updated_by_type as 'owner' | 'accountant',
      notes: u.notes,
      createdAt: u.created_at,
    }));

    // Current status is the most recent
    const currentStatus: RecommendationStatus =
      history.length > 0 ? history[0].status : 'pending_review';

    const response: StatusHistory = {
      recommendationId,
      currentStatus,
      history,
      lastUpdatedAt: history.length > 0 ? history[0].createdAt : undefined,
      lastUpdatedBy: history.length > 0 ? history[0].updatedByName : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/recommendations/[id]/status:', error);
    return createErrorResponse(error, {}, 500);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const { id: recommendationId } = await context.params;
    const body = await request.json();

    const { tenantId, status, updatedByName, notes } = body;

    // Validate required fields
    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required');
    }
    if (!status || typeof status !== 'string') {
      return createValidationError('status is required');
    }
    if (!updatedByName || typeof updatedByName !== 'string') {
      return createValidationError('updatedByName is required');
    }

    // Validate status is valid
    if (!STATUS_CONFIG[status as RecommendationStatus]) {
      return createValidationError(`Invalid status: ${status}`);
    }

    // Check if owner can set this status
    const statusConfig = STATUS_CONFIG[status as RecommendationStatus];
    if (!statusConfig.ownerAllowed) {
      return createValidationError(`Owners cannot set status to: ${status}`);
    }

    const supabase = await createServiceClient();

    // Get current status for validation
    const { data: currentUpdates } = await supabase
      .from('recommendation_status')
      .select('status')
      .eq('recommendation_id', recommendationId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);

    const currentStatus: RecommendationStatus =
      currentUpdates && currentUpdates.length > 0
        ? (currentUpdates[0].status as RecommendationStatus)
        : 'pending_review';

    // Validate transition (skip if first status or same status)
    if (currentStatus !== status && currentStatus !== 'pending_review') {
      if (!isValidTransition(currentStatus, status as RecommendationStatus, 'owner')) {
        return createValidationError(
          `Cannot transition from ${currentStatus} to ${status}`
        );
      }
    }

    // Create new status record
    const { data: newUpdate, error } = await supabase
      .from('recommendation_status')
      .insert({
        recommendation_id: recommendationId,
        tenant_id: tenantId,
        status,
        updated_by_name: updatedByName,
        updated_by_type: 'owner',
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating status:', error);
      return createErrorResponse(new Error('Failed to update status'), {}, 500);
    }

    const update: StatusUpdate = {
      id: newUpdate.id,
      recommendationId: newUpdate.recommendation_id,
      shareId: newUpdate.share_id,
      tenantId: newUpdate.tenant_id,
      status: newUpdate.status as RecommendationStatus,
      updatedByName: newUpdate.updated_by_name,
      updatedByType: newUpdate.updated_by_type as 'owner' | 'accountant',
      notes: newUpdate.notes,
      createdAt: newUpdate.created_at,
    };

    const response: UpdateStatusResponse = {
      success: true,
      update,
      currentStatus: status as RecommendationStatus,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in POST /api/recommendations/[id]/status:', error);
    return createErrorResponse(error, {}, 500);
  }
}
