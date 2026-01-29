/**
 * POST /api/share/create
 *
 * Create a new share link for accountant access to reports.
 *
 * Body:
 * - tenantId: string (required)
 * - reportType: 'full' | 'rnd' | 'deductions' | 'div7a' | 'losses' | 'custom'
 * - title: string (required)
 * - description?: string
 * - expiresInDays?: number (default: 7)
 * - password?: string (optional password protection)
 * - filters?: ShareReportFilters
 *
 * Response:
 * - success: true
 * - shareId: string
 * - token: string
 * - shareUrl: string
 * - expiresAt: string
 * - isPasswordProtected: boolean
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { generateShareToken, buildShareUrl, calculateExpiryDate } from '@/lib/share/token-generator';
import { hash } from 'bcryptjs';
import type {
  CreateShareLinkRequest,
  CreateShareLinkResponse,
  ShareableReportType,
} from '@/lib/types/shared-reports';

const VALID_REPORT_TYPES: ShareableReportType[] = ['full', 'rnd', 'deductions', 'div7a', 'losses', 'custom'];
const DEFAULT_EXPIRY_DAYS = 7;
const MAX_EXPIRY_DAYS = 365;
const MIN_PASSWORD_LENGTH = 6;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateShareLinkRequest;

    // Validate required fields
    if (!body.tenantId || typeof body.tenantId !== 'string') {
      return createValidationError('tenantId is required and must be a string');
    }

    if (!body.reportType || !VALID_REPORT_TYPES.includes(body.reportType)) {
      return createValidationError(
        `reportType must be one of: ${VALID_REPORT_TYPES.join(', ')}`
      );
    }

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return createValidationError('title is required and must be a non-empty string');
    }

    // Validate optional fields
    const expiresInDays = body.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
    if (expiresInDays < 1 || expiresInDays > MAX_EXPIRY_DAYS) {
      return createValidationError(`expiresInDays must be between 1 and ${MAX_EXPIRY_DAYS}`);
    }

    if (body.password && body.password.length < MIN_PASSWORD_LENGTH) {
      return createValidationError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    // Generate secure token
    const token = generateShareToken(32);
    const expiresAt = calculateExpiryDate(expiresInDays);

    // Hash password if provided
    let passwordHash: string | null = null;
    if (body.password) {
      passwordHash = await hash(body.password, 12);
    }

    // Create database record
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('shared_reports')
      .insert({
        tenant_id: body.tenantId,
        token,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        report_type: body.reportType,
        filters: body.filters || null,
        expires_at: expiresAt,
        password_hash: passwordHash,
        created_by: null, // TODO: Add user tracking when auth is available
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating share link:', error);
      return createErrorResponse(
        new Error('Failed to create share link'),
        { operation: 'createShareLink', tenantId: body.tenantId },
        500
      );
    }

    const shareUrl = buildShareUrl(token);

    const response: CreateShareLinkResponse = {
      success: true,
      shareId: data.id,
      token,
      shareUrl,
      expiresAt,
      isPasswordProtected: !!passwordHash,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in POST /api/share/create:', error);
    return createErrorResponse(
      error,
      { operation: 'createShareLink' },
      500
    );
  }
}
