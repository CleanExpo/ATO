/**
 * GET /api/admin/accountant-applications
 *
 * List all accountant applications (admin only)
 *
 * Query params:
 * - status: Filter by status (optional)
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 *
 * Returns: Array of AccountantApplication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/api/errors';
import { requireAdminRole } from '@/lib/middleware/admin-role';
import type { AccountantApplication } from '@/lib/types/accountant';

export async function GET(request: NextRequest) {
  try {
    // Require admin role
    const adminCheck = await requireAdminRole();
    if (!adminCheck.isAdmin) {
      return adminCheck.response;
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get('status');
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50'),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate status if provided
    const validStatuses = [
      'pending',
      'under_review',
      'approved',
      'rejected',
      'suspended',
    ];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Build query
    let query = supabase
      .from('accountant_applications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Execute query
    const { data: applications, error, count } = await query;

    if (error) {
      console.error('Error fetching applications:', error);
      return createErrorResponse(
        new Error('Failed to fetch applications'),
        { status, limit, offset },
        500
      );
    }

    // Return paginated response
    return NextResponse.json({
      success: true,
      applications: applications as AccountantApplication[],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: count ? offset + limit < count : false,
      },
    });
  } catch (error) {
    console.error('Unexpected error fetching applications:', error);
    return createErrorResponse(
      error as Error,
      { operation: 'list_accountant_applications' },
      500
    );
  }
}
