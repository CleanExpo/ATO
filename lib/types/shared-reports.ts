/**
 * Shared Reports Types
 *
 * Types for secure report sharing with accountants via time-limited tokens.
 * Supports password protection, access logging, and revocation.
 */

/**
 * Report types that can be shared
 */
export type ShareableReportType =
  | 'full'         // Complete forensic audit report
  | 'rnd'          // R&D Tax Incentive findings only
  | 'deductions'   // Unclaimed deductions only
  | 'div7a'        // Division 7A loan analysis only
  | 'losses'       // Tax loss carry-forward analysis
  | 'custom';      // Custom filtered report

/**
 * Share link status
 */
export type ShareLinkStatus = 'active' | 'expired' | 'revoked';

/**
 * Filters that can be applied to a shared report
 */
export interface ShareReportFilters {
  financialYears?: string[];           // e.g., ['FY2023-24', 'FY2024-25']
  categories?: string[];               // Transaction categories
  minimumAmount?: number;              // Filter by minimum transaction amount
  confidenceLevel?: 'high' | 'medium' | 'low' | 'all';
  includeTransactionDetails?: boolean; // Whether to include raw transaction data
  includeRecommendations?: boolean;    // Whether to include action recommendations
}

/**
 * Database record for a shared report link
 */
export interface SharedReport {
  id: string;                          // UUID
  tenant_id: string;                   // Xero tenant ID
  token: string;                       // Unique access token (URL-safe)
  title: string;                       // Human-readable title
  description: string | null;          // Optional description
  report_type: ShareableReportType;    // Type of report being shared
  filters: ShareReportFilters | null;  // Optional filters applied
  created_by: string | null;           // User who created the link
  created_at: string;                  // ISO timestamp
  expires_at: string;                  // ISO timestamp
  is_revoked: boolean;                 // Whether link has been revoked
  access_count: number;                // Number of times accessed
  last_accessed_at: string | null;     // ISO timestamp of last access
  last_accessed_ip: string | null;     // IP address of last access
  password_hash: string | null;        // bcrypt hash if password protected
}

/**
 * Request to create a new share link
 */
export interface CreateShareLinkRequest {
  tenantId: string;
  reportType: ShareableReportType;
  title: string;
  description?: string;
  expiresInDays?: number;              // Default: 7
  password?: string;                   // Optional password protection
  filters?: ShareReportFilters;
}

/**
 * Response after creating a share link
 */
export interface CreateShareLinkResponse {
  success: true;
  shareId: string;
  token: string;
  shareUrl: string;
  expiresAt: string;
  isPasswordProtected: boolean;
}

/**
 * Error response for share operations
 */
export interface ShareLinkError {
  success: false;
  error: string;
  code: 'INVALID_TOKEN' | 'EXPIRED' | 'REVOKED' | 'PASSWORD_REQUIRED' | 'INVALID_PASSWORD' | 'NOT_FOUND' | 'SERVER_ERROR';
}

/**
 * Request to access a shared report
 */
export interface AccessShareLinkRequest {
  token: string;
  password?: string;                   // Required if password protected
}

/**
 * Successful access response with report data
 */
export interface AccessShareLinkResponse {
  success: true;
  title: string;
  description: string | null;
  reportType: ShareableReportType;
  organisationName: string;
  generatedAt: string;                 // When report data was generated
  expiresAt: string;
  data: SharedReportData;
}

/**
 * The actual report data returned to accountants
 */
export interface SharedReportData {
  executiveSummary: ExecutiveSummary;
  findings: ReportFinding[];
  transactions?: TransactionSample[];  // If includeTransactionDetails
  recommendations?: Recommendation[];   // If includeRecommendations
  metadata: ReportMetadata;
}

/**
 * Executive summary section
 */
export interface ExecutiveSummary {
  totalTransactionsAnalysed: number;
  periodCovered: string;               // e.g., "FY2023-24 to FY2024-25"
  totalPotentialBenefit: number;
  highPriorityItems: number;
  keyFindings: string[];               // Top 3-5 bullet points
}

/**
 * Individual finding in the report
 */
export interface ReportFinding {
  id: string;
  category: string;                    // R&D, Deduction, Div7A, Loss
  title: string;
  description: string;
  potentialBenefit: number;
  confidence: 'high' | 'medium' | 'low';
  priority: 'high' | 'medium' | 'low';
  legislativeReference: string;        // e.g., "Division 355 ITAA 1997"
  actionRequired: string;
  deadline?: string;                   // For time-sensitive items
}

/**
 * Sample transaction for accountant review
 */
export interface TransactionSample {
  date: string;
  description: string;
  amount: number;
  category: string;
  classification: string;
  confidence: number;
}

/**
 * Action recommendation
 */
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  estimatedBenefit: number;
  effort: 'low' | 'medium' | 'high';
  deadline?: string;
  steps: string[];
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  generatedAt: string;
  generatedBy: string;                 // "ATO Tax Optimizer"
  version: string;
  disclaimer: string;
}

/**
 * Access log entry for audit trail
 */
export interface AccessLogEntry {
  id: string;
  share_id: string;
  accessed_at: string;
  ip_address: string;
  user_agent: string | null;
  successful: boolean;
  failure_reason?: string;
}

/**
 * List of share links for management UI
 */
export interface ShareLinkListItem {
  id: string;
  token: string;
  title: string;
  reportType: ShareableReportType;
  status: ShareLinkStatus;
  createdAt: string;
  expiresAt: string;
  accessCount: number;
  lastAccessedAt: string | null;
  isPasswordProtected: boolean;
}

/**
 * Response for listing share links
 */
export interface ListShareLinksResponse {
  links: ShareLinkListItem[];
  total: number;
}

/**
 * Request to revoke a share link
 */
export interface RevokeShareLinkRequest {
  token?: string;
  shareId?: string;
}

/**
 * Response after revoking
 */
export interface RevokeShareLinkResponse {
  success: boolean;
  message: string;
}

/**
 * Helper to get status from a SharedReport
 */
export function getShareLinkStatus(report: SharedReport): ShareLinkStatus {
  if (report.is_revoked) return 'revoked';
  if (new Date(report.expires_at) < new Date()) return 'expired';
  return 'active';
}

/**
 * Helper to format expiry options
 */
export const EXPIRY_OPTIONS = [
  { label: '24 hours', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

/**
 * Report type labels for UI
 */
export const REPORT_TYPE_LABELS: Record<ShareableReportType, string> = {
  full: 'Full Forensic Audit Report',
  rnd: 'R&D Tax Incentive Analysis',
  deductions: 'Unclaimed Deductions Report',
  div7a: 'Division 7A Loan Analysis',
  losses: 'Tax Loss Carry-Forward Analysis',
  custom: 'Custom Filtered Report',
};
