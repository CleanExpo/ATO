/**
 * Recommendation Documents API
 *
 * Endpoints for managing documents attached to recommendations.
 * Requires tenantId for authentication (owner access).
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
import { scanFile } from '@/lib/uploads/file-scanner';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recommendations/[id]/documents
 *
 * Get all documents for a recommendation.
 * Query params:
 * - tenantId: string (required)
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<DocumentListResponse | DocumentErrorResponse>> {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth as NextResponse<DocumentErrorResponse>

    const { id: recommendationId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const supabase = await createServiceClient();

    // Fetch documents for this recommendation
    const { data: rows, error } = await supabase
      .from('recommendation_documents')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('tenant_id', tenantId)
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
    console.error('Error in GET /api/recommendations/[id]/documents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recommendations/[id]/documents
 *
 * Upload a document for a recommendation.
 * Body (multipart/form-data):
 * - file: File (required)
 * - tenantId: string (required)
 * - uploadedByName: string (required)
 * - description: string (optional)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<DocumentUploadResponse | DocumentErrorResponse>> {
  try {
    // tenantId is in form data (not JSON body), so skip tenant validation here
    // and let the existing tenantId check below handle it
    const auth = await requireAuth(request, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth as NextResponse<DocumentErrorResponse>

    const { id: recommendationId } = await params;
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const tenantId = formData.get('tenantId') as string | null;
    const uploadedByName = formData.get('uploadedByName') as string | null;
    const description = formData.get('description') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required', code: 'UPLOAD_FAILED' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required', code: 'UNAUTHORIZED' },
        { status: 401 }
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

    // Scan file content for safety (B-3: file upload scanning)
    const fileBuffer = await file.arrayBuffer();
    const scanResult = scanFile(file.name, file.type, fileBuffer);
    if (!scanResult.safe) {
      return NextResponse.json(
        {
          success: false,
          error: `File rejected: ${scanResult.reason}`,
          code: 'INVALID_FILE_TYPE',
        },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Generate unique storage path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${tenantId}/${recommendationId}/${timestamp}_${sanitizedName}`;
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
        tenant_id: tenantId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
        uploaded_by_name: uploadedByName,
        uploaded_by_type: 'owner',
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
    console.error('Error in POST /api/recommendations/[id]/documents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/recommendations/[id]/documents
 *
 * Delete a document.
 * Query params:
 * - tenantId: string (required)
 * - docId: string (required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<{ success: true } | DocumentErrorResponse>> {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth as NextResponse<DocumentErrorResponse>

    const { id: recommendationId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const docId = searchParams.get('docId');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (!docId) {
      return NextResponse.json(
        { success: false, error: 'docId is required', code: 'NOT_FOUND' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Fetch document to get storage path
    const { data: row, error: fetchError } = await supabase
      .from('recommendation_documents')
      .select('*')
      .eq('id', docId)
      .eq('recommendation_id', recommendationId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !row) {
      return NextResponse.json(
        { success: false, error: 'Document not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const document = rowToDocument(row as DocumentRow);

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('recommendation-documents')
      .remove([document.storagePath]);

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
      // Continue to delete database record anyway
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('recommendation_documents')
      .delete()
      .eq('id', docId);

    if (deleteError) {
      console.error('Failed to delete document record:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete document', code: 'SERVER_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/recommendations/[id]/documents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
