/**
 * GET /api/recommendations/status-summary
 *
 * Get status counts across all recommendations for a tenant.
 * Used for dashboard overview widget.
 *
 * Query params:
 * - tenantId: string (required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import type {
  RecommendationStatus,
  StatusSummary,
  StatusSummaryResponse,
} from '@/lib/types/recommendation-status';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return createValidationError('tenantId query parameter is required');
    }

    const supabase = await createServiceClient();

    // Get all unique recommendations from forensic analysis
    const { data: recommendations, error: recError } = await supabase
      .from('forensic_analysis_results')
      .select('id')
      .eq('tenant_id', tenantId);

    if (recError) {
      console.error('Error fetching recommendations:', recError);
      return createErrorResponse(new Error('Failed to fetch recommendations'), {}, 500);
    }

    const totalRecommendations = recommendations?.length || 0;

    if (totalRecommendations === 0) {
      const emptySummary: StatusSummary = {
        pending_review: 0,
        under_review: 0,
        needs_verification: 0,
        needs_clarification: 0,
        approved: 0,
        rejected: 0,
        implemented: 0,
        total: 0,
      };

      return NextResponse.json({ summary: emptySummary } as StatusSummaryResponse);
    }

    // Get the latest status for each recommendation using the view
    // If no status exists, it's pending_review
    const { data: statuses, error: statusError } = await supabase
      .from('recommendation_current_status')
      .select('recommendation_id, status, created_at')
      .eq('tenant_id', tenantId);

    if (statusError) {
      console.error('Error fetching statuses:', statusError);
      // If the view doesn't exist, fall back to manual query
      const { data: manualStatuses } = await supabase
        .from('recommendation_status')
        .select('recommendation_id, status, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // Group by recommendation_id to get latest
      const statusMap = new Map<string, string>();
      for (const s of manualStatuses || []) {
        if (!statusMap.has(s.recommendation_id)) {
          statusMap.set(s.recommendation_id, s.status);
        }
      }

      // Count statuses
      const summary: StatusSummary = {
        pending_review: 0,
        under_review: 0,
        needs_verification: 0,
        needs_clarification: 0,
        approved: 0,
        rejected: 0,
        implemented: 0,
        total: totalRecommendations,
      };

      const recommendationIds = new Set(recommendations?.map((r) => r.id));

      for (const recId of recommendationIds) {
        const status = (statusMap.get(recId) as RecommendationStatus) || 'pending_review';
        summary[status]++;
      }

      const lastUpdated = manualStatuses && manualStatuses.length > 0
        ? manualStatuses[0].created_at
        : undefined;

      return NextResponse.json({ summary, lastUpdated } as StatusSummaryResponse);
    }

    // Build status map from view results
    const statusMap = new Map<string, string>();
    for (const s of statuses || []) {
      statusMap.set(s.recommendation_id, s.status);
    }

    // Count statuses
    const summary: StatusSummary = {
      pending_review: 0,
      under_review: 0,
      needs_verification: 0,
      needs_clarification: 0,
      approved: 0,
      rejected: 0,
      implemented: 0,
      total: totalRecommendations,
    };

    const recommendationIds = new Set(recommendations?.map((r) => r.id));

    for (const recId of recommendationIds) {
      const status = (statusMap.get(recId) as RecommendationStatus) || 'pending_review';
      summary[status]++;
    }

    // Get last updated timestamp
    const lastUpdated = statuses && statuses.length > 0
      ? statuses.reduce((latest, s) => {
          return new Date(s.created_at) > new Date(latest) ? s.created_at : latest;
        }, statuses[0].created_at)
      : undefined;

    const response: StatusSummaryResponse = {
      summary,
      lastUpdated,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/recommendations/status-summary:', error);
    return createErrorResponse(error, {}, 500);
  }
}
