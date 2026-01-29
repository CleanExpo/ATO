/**
 * Recommendation Documents Types
 *
 * Types for document storage and management attached to recommendations.
 * Supports both owner and accountant document uploads.
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Maximum file size in human-readable format
 */
export const MAX_FILE_SIZE_LABEL = '10MB';

/**
 * Allowed file types with their MIME types
 */
export const ALLOWED_FILE_TYPES = {
  'application/pdf': { extension: '.pdf', label: 'PDF Document', icon: '📄' },
  'image/jpeg': { extension: '.jpg', label: 'JPEG Image', icon: '🖼️' },
  'image/png': { extension: '.png', label: 'PNG Image', icon: '🖼️' },
  'application/msword': { extension: '.doc', label: 'Word Document', icon: '📝' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: '.docx',
    label: 'Word Document',
    icon: '📝',
  },
  'application/vnd.ms-excel': { extension: '.xls', label: 'Excel Spreadsheet', icon: '📊' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extension: '.xlsx',
    label: 'Excel Spreadsheet',
    icon: '📊',
  },
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_FILE_TYPES;

/**
 * List of allowed MIME types for validation
 */
export const ALLOWED_MIME_TYPES = Object.keys(ALLOWED_FILE_TYPES) as AllowedMimeType[];

/**
 * List of allowed extensions for display
 */
export const ALLOWED_EXTENSIONS = Object.values(ALLOWED_FILE_TYPES).map((t) => t.extension);

// ============================================================================
// Core Types
// ============================================================================

/**
 * Uploader type - who uploaded the document
 */
export type DocumentUploaderType = 'owner' | 'accountant';

/**
 * Document record stored in database
 */
export interface RecommendationDocument {
  id: string;
  recommendationId: string;
  shareId: string | null;
  tenantId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  uploadedByName: string;
  uploadedByType: DocumentUploaderType;
  description: string | null;
  createdAt: string;
}

/**
 * Document with download URL for client display
 */
export interface DocumentWithUrl extends RecommendationDocument {
  downloadUrl: string;
  expiresAt: string;
}

/**
 * Database row format (snake_case)
 */
export interface DocumentRow {
  id: string;
  recommendation_id: string;
  share_id: string | null;
  tenant_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  uploaded_by_name: string;
  uploaded_by_type: string;
  description: string | null;
  created_at: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request to upload a document
 */
export interface DocumentUploadRequest {
  recommendationId: string;
  file: File;
  description?: string;
  uploadedByName: string;
}

/**
 * Response after successful upload
 */
export interface DocumentUploadResponse {
  success: true;
  document: RecommendationDocument;
}

/**
 * Response with list of documents
 */
export interface DocumentListResponse {
  success: true;
  documents: DocumentWithUrl[];
  totalCount: number;
}

/**
 * Response for document counts per recommendation
 */
export interface DocumentCountsResponse {
  success: true;
  counts: Record<string, number>;
}

/**
 * Error response for document operations
 */
export interface DocumentErrorResponse {
  success: false;
  error: string;
  code: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'SERVER_ERROR';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a MIME type is allowed
 */
export function isAllowedFileType(mimeType: string): mimeType is AllowedMimeType {
  return mimeType in ALLOWED_FILE_TYPES;
}

/**
 * Check if file size is within limit
 */
export function isFileSizeValid(sizeInBytes: number): boolean {
  return sizeInBytes > 0 && sizeInBytes <= MAX_FILE_SIZE;
}

/**
 * Get file type info from MIME type
 */
export function getFileTypeInfo(mimeType: string): (typeof ALLOWED_FILE_TYPES)[AllowedMimeType] | null {
  if (isAllowedFileType(mimeType)) {
    return ALLOWED_FILE_TYPES[mimeType];
  }
  return null;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get icon for file type
 */
export function getFileIcon(mimeType: string): string {
  const info = getFileTypeInfo(mimeType);
  return info?.icon || '📎';
}

/**
 * Convert database row to document object
 */
export function rowToDocument(row: DocumentRow): RecommendationDocument {
  return {
    id: row.id,
    recommendationId: row.recommendation_id,
    shareId: row.share_id,
    tenantId: row.tenant_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    storagePath: row.storage_path,
    uploadedByName: row.uploaded_by_name,
    uploadedByType: row.uploaded_by_type as DocumentUploaderType,
    description: row.description,
    createdAt: row.created_at,
  };
}

/**
 * Validate a file before upload
 */
export function validateFile(file: File): { valid: true } | { valid: false; error: string; code: DocumentErrorResponse['code'] } {
  if (!isAllowedFileType(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
      code: 'INVALID_FILE_TYPE',
    };
  }

  if (!isFileSizeValid(file.size)) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${MAX_FILE_SIZE_LABEL}`,
      code: 'FILE_TOO_LARGE',
    };
  }

  return { valid: true };
}

// ============================================================================
// Document Category Suggestions
// ============================================================================

/**
 * Suggested document types per recommendation category
 */
export const DOCUMENT_SUGGESTIONS: Record<string, string[]> = {
  rnd: [
    'R&D project documentation',
    'Technical specifications',
    'Experiment logs',
    'Software development records',
    'Technical feasibility reports',
  ],
  deduction: [
    'Tax invoices',
    'Receipts',
    'Bank statements',
    'Contracts',
    'Purchase orders',
  ],
  div7a: [
    'Loan agreements',
    'Repayment schedules',
    'Bank statements showing repayments',
    'Board minutes',
    'Interest calculations',
  ],
  loss: [
    'Share register',
    'Ownership certificates',
    'Financial statements',
    'Same business test documentation',
    'Continuity of ownership records',
  ],
  reconciliation: [
    'Bank statements',
    'Reconciliation reports',
    'GL reports',
    'Transaction records',
  ],
};

/**
 * Get suggested documents for a recommendation category
 */
export function getDocumentSuggestions(category: string): string[] {
  const key = category.toLowerCase();
  return DOCUMENT_SUGGESTIONS[key] || DOCUMENT_SUGGESTIONS.deduction;
}
