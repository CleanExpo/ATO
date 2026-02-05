/**
 * GET /api/questionnaires
 *
 * Retrieve pending questionnaires for a tenant.
 * Returns prioritized list of questionnaires generated from analysis data gaps.
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - status: 'pending' | 'in_progress' | 'completed' | 'skipped' (optional)
 * - category: QuestionCategory (optional) - Filter by category
 *
 * Returns:
 * - Array of questionnaires with questions
 * - Priority ordering (critical/high first)
 * - Potential tax benefit estimates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    // Validate required parameters
    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required');
    }

    // Get Supabase client
    const supabase = await createServiceClient();

    // Fetch questionnaires
    let query = supabase
      .from('questionnaires')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('priority_score', { ascending: false }) // Highest priority first
      .order('potential_tax_benefit', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: questionnaires, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate summary statistics
    const totalQuestionnaires = questionnaires?.length || 0;
    const pendingCount = questionnaires?.filter(q => q.status === 'pending').length || 0;
    const totalPotentialBenefit = questionnaires?.reduce(
      (sum, q) => sum + (q.potential_tax_benefit || 0),
      0
    ) || 0;

    return NextResponse.json({
      success: true,
      count: totalQuestionnaires,
      questionnaires: questionnaires || [],
      summary: {
        total: totalQuestionnaires,
        pending: pendingCount,
        in_progress: questionnaires?.filter(q => q.status === 'in_progress').length || 0,
        completed: questionnaires?.filter(q => q.status === 'completed').length || 0,
        total_potential_benefit: totalPotentialBenefit,
      },
      metadata: {
        retrievedAt: new Date().toISOString(),
        tenantId,
      },
    });
  } catch (error) {
    console.error('Error fetching questionnaires:', error);

    return createErrorResponse(
      error,
      {
        operation: 'fetchQuestionnaires',
        endpoint: '/api/questionnaires',
      },
      500
    );
  }
}
