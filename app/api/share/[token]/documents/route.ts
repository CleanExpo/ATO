/**
 * GET/POST /api/share/[token]/documents
 *
 * Get or upload documents via share link.
 * Used by accountants without authentication.
 *
 * GET:
 *   Query: recommendationId (required)
 *   Returns: DocumentListResponse
 *
 * POST:
 *   Body (multipart/form-data): file, recommendationId, uploadedByName, description?
 *   Returns: DocumentUploadResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  rowToDocument,
  isAllowedFileType,
  isFileSizeValid,
  formatFileSize,
  MAX_FILE_SIZE_LABEL,
  ALLOWED_EXTENSIONS,
  type DocumentRow,
  type DocumentWithUrl,
  type DocumentListResponse,
  type DocumentUploadResponse,
  type DocumentErrorResponse,
} from '@/lib/types/recommendation-documents';

interface RouteContext {
  params: Promise<{ token: string }>;
}

/**
 * Validate share token and return share data
 */
async function validateShareToken(supabase: Awaited<ReturnType<typeof createServiceClient>>, token: string) {
  const { data: share, error } = await supabase
    .from('shared_reports')
    .select('id, tenant_id, is_revoked, expires_at')
    .eq('token', token)
    .single();

  if (error || !share) {
    return { valid: false, error: 'Invalid share token' };
  }

  if (share.is_revoked) {
    return { valid: false, error: 'Share link has been revoked' };
  }

  if (new Date(share.expires_at) < new Date()) {
    return { valid: false, error: 'Share link has expired' };
  }

  return { valid: true, share };
}

/**
 * GET /api/share/[token]/documents
 *
 * Get all documents for a recommendation via share link.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<DocumentListResponse | DocumentErrorResponse>> {
  try {
    const { token } = await context.params;
    const { searchParams } = new URL(request.url);
    const recommendationId = searchParams.get('recommendationId');

    if (!recommendationId) {
      return NextResponse.json(
        { success: false, error: 'recommendationId query parameter is required', code: 'UNAUTHORIZED' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Validate share token
    const tokenResult = await validateShareToken(supabase, token);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { success: false, error: tokenResult.error!, code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    const { share } = tokenResult;

    // Fetch documents for this recommendation
    const { data: rows, error } = await supabase
      .from('recommendation_documents')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('tenant_id', share!.tenant_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch documents:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents', code: 'SERVER_ERROR' },
        { status: 500 }
      );
    }

    // Generate signed URLs for each document
    const documents: DocumentWithUrl[] = await Promise.all(
      (rows as DocumentRow[]).map(async (row) => {
        const document = rowToDocument(row);

        // Generate signed URL (valid for 1 hour)
        const { data: signedData } = await supabase.storage
          .from('recommendation-documents')
          .createSignedUrl(document.storagePath, 3600);

        return {
          ...document,
          downloadUrl: signedData?.signedUrl || '',
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        };
      })
    );

    return NextResponse.json({
      success: true,
      documents,
      totalCount: documents.length,
    });
  } catch (error) {
    console.error('Error in GET /api/share/[token]/documents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/share/[token]/documents
 *
 * Upload a document via share link (accountant upload).
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<DocumentUploadResponse | DocumentErrorResponse>> {
  try {
    const { token } = await context.params;
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const recommendationId = formData.get('recommendationId') as string | null;
    const uploadedByName = formData.get('uploadedByName') as string | null;
    const description = formData.get('description') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required', code: 'UPLOAD_FAILED' },
        { status: 400 }
      );
    }

    if (!recommendationId) {
      return NextResponse.json(
        { success: false, error: 'recommendationId is required', code: 'UPLOAD_FAILED' },
        { status: 400 }
      );
    }

    if (!uploadedByName) {
      return NextResponse.json(
        { success: false, error: 'uploadedByName is required', code: 'UPLOAD_FAILED' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isAllowedFileType(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `File type "${file.type}" is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
          code: 'INVALID_FILE_TYPE',
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (!isFileSizeValid(file.size)) {
      return NextResponse.json(
        {
          success: false,
          error: `File size (${formatFileSize(file.size)}) exceeds maximum of ${MAX_FILE_SIZE_LABEL}`,
          code: 'FILE_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Validate share token
    const tokenResult = await validateShareToken(supabase, token);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { success: false, error: tokenResult.error!, code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    const { share } = tokenResult;

    // Generate unique storage path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${share!.tenant_id}/${recommendationId}/${timestamp}_${sanitizedName}`;

    // Upload file to storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('recommendation-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload file to storage:', uploadError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload file', code: 'UPLOAD_FAILED' },
        { status: 500 }
      );
    }

    // Create database record
    const { data: row, error: insertError } = await supabase
      .from('recommendation_documents')
      .insert({
        recommendation_id: recommendationId,
        share_id: share!.id,
        tenant_id: share!.tenant_id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
        uploaded_by_name: uploadedByName,
        uploaded_by_type: 'accountant',
        description: description || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create document record:', insertError);
      // Try to clean up uploaded file
      await supabase.storage.from('recommendation-documents').remove([storagePath]);
      return NextResponse.json(
        { success: false, error: 'Failed to save document record', code: 'UPLOAD_FAILED' },
        { status: 500 }
      );
    }

    const document = rowToDocument(row as DocumentRow);

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error('Error in POST /api/share/[token]/documents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
