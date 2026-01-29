/**
 * GET /api/share/list
 *
 * List all share links for a tenant.
 *
 * Query params:
 * - tenantId: string (required)
 * - status?: 'active' | 'expired' | 'revoked' | 'all' (default: 'all')
 *
 * Response:
 * - links: ShareLinkListItem[]
 * - total: number
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { getShareLinkStatus } from '@/lib/types/shared-reports';
import type {
  ListShareLinksResponse,
  ShareLinkListItem,
  SharedReport,
  ShareLinkStatus,
} from '@/lib/types/shared-reports';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const statusFilter = searchParams.get('status') as ShareLinkStatus | 'all' | null;

    // Validate required fields
    if (!tenantId) {
      return createValidationError('tenantId query parameter is required');
    }

    const supabase = await createServiceClient();

    // Fetch all share links for tenant
    let query = supabase
      .from('shared_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Apply status filter at DB level where possible
    if (statusFilter === 'revoked') {
      query = query.eq('is_revoked', true);
    } else if (statusFilter === 'active') {
      query = query
        .eq('is_revoked', false)
        .gt('expires_at', new Date().toISOString());
    } else if (statusFilter === 'expired') {
      query = query
        .eq('is_revoked', false)
        .lt('expires_at', new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching share links:', error);
      return createErrorResponse(
        new Error('Failed to fetch share links'),
        { operation: 'listShareLinks', tenantId },
        500
      );
    }

    // Transform to list items
    const links: ShareLinkListItem[] = (data as SharedReport[]).map(share => ({
      id: share.id,
      token: share.token,
      title: share.title,
      reportType: share.report_type as ShareLinkListItem['reportType'],
      status: getShareLinkStatus(share),
      createdAt: share.created_at,
      expiresAt: share.expires_at,
      accessCount: share.access_count,
      lastAccessedAt: share.last_accessed_at,
      isPasswordProtected: !!share.password_hash,
    }));

    const response: ListShareLinksResponse = {
      links,
      total: links.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/share/list:', error);
    return createErrorResponse(
      error,
      { operation: 'listShareLinks' },
      500
    );
  }
}
