/**
 * POST /api/share/revoke
 *
 * Revoke a share link to immediately disable access.
 *
 * Body:
 * - token?: string (share token)
 * - shareId?: string (share record ID)
 *
 * At least one of token or shareId must be provided.
 *
 * Response:
 * - success: boolean
 * - message: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import type { RevokeShareLinkRequest, RevokeShareLinkResponse } from '@/lib/types/shared-reports';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth

    const body = await request.json() as RevokeShareLinkRequest;

    // Validate at least one identifier provided
    if (!body.token && !body.shareId) {
      return createValidationError('Either token or shareId must be provided');
    }

    const supabase = await createServiceClient();

    // Build query based on provided identifier
    let query = supabase
      .from('shared_reports')
      .update({
        is_revoked: true,
      });

    if (body.shareId) {
      query = query.eq('id', body.shareId);
    } else if (body.token) {
      query = query.eq('token', body.token);
    }

    const { data, error } = await query.select('id, title').single();

    if (error || !data) {
      const response: RevokeShareLinkResponse = {
        success: false,
        message: 'Share link not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: RevokeShareLinkResponse = {
      success: true,
      message: `Share link "${data.title}" has been revoked`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in POST /api/share/revoke:', error);
    return createErrorResponse(
      error,
      { operation: 'revokeShareLink' },
      500
    );
  }
}
