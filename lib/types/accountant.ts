/**
 * Accountant Vetting System Types
 *
 * Type definitions for the accountant application and vetting workflow
 */

// =====================================================
// ENUMS
// =====================================================

export type CredentialType =
  | 'CPA'        // Certified Practising Accountant
  | 'CA'         // Chartered Accountant
  | 'RTA'        // Registered Tax Agent
  | 'BAS_AGENT'  // BAS Agent
  | 'FTA'        // Fellow Tax Agent
  | 'OTHER';     // Other professional designation

export type ApplicationStatus =
  | 'pending'       // Submitted, awaiting review
  | 'under_review'  // Admin is reviewing
  | 'approved'      // Approved and account created
  | 'rejected'      // Application declined
  | 'suspended';    // Account suspended after approval

// =====================================================
// ACCOUNTANT APPLICATION
// =====================================================

export interface AccountantApplication {
  id: string;

  // Contact Details
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;

  // Firm Details
  firm_name: string;
  firm_abn?: string;
  firm_website?: string;
  firm_address?: string;

  // Professional Credentials
  credential_type: CredentialType;
  credential_number: string;
  credential_issuing_body?: string;
  credential_expiry?: string;
  years_experience?: number;

  // Additional Information
  specializations?: string[];
  client_count?: number;
  referral_source?: string;

  // Application Status
  status: ApplicationStatus;

  // Vetting Information
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  internal_notes?: string;

  // Account Linking
  user_id?: string;
  approved_organization_id?: string;

  // Full Application Data
  application_data: Record<string, unknown>;

  // Metadata
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// APPLICATION FORM DATA
// =====================================================

export interface AccountantApplicationFormData {
  // Step 1: Personal Details
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;

  // Step 2: Firm Details
  firm_name: string;
  firm_abn?: string;
  firm_website?: string;
  firm_address?: string;

  // Step 3: Professional Credentials
  credential_type: CredentialType;
  credential_number: string;
  credential_issuing_body?: string;
  credential_expiry?: string;
  years_experience?: number;

  // Step 4: Additional Information
  specializations?: string[];
  client_count?: number;
  referral_source?: string;

  // Terms & Conditions
  agreed_to_terms: boolean;
  agreed_to_privacy: boolean;
}

// =====================================================
// VETTED ACCOUNTANT
// =====================================================

export interface VettedAccountant {
  id: string;

  // User Reference
  user_id: string;
  application_id: string;
  organization_id: string;

  // Quick Access Fields
  email: string;
  full_name: string;
  firm_name: string;
  credential_type: CredentialType;
  credential_number: string;

  // Status Management
  is_active: boolean;
  suspended_at?: string;
  suspension_reason?: string;
  suspended_by?: string;

  // Benefits & Pricing
  wholesale_discount_rate: number; // 0.5 = 50% off
  lifetime_discount: boolean;
  special_pricing_note?: string;

  // Engagement Metrics
  last_login_at?: string;
  total_reports_generated: number;
  total_clients_onboarded: number;

  // Metadata
  created_at: string;
  updated_at: string;
}

// =====================================================
// ACTIVITY LOG
// =====================================================

export interface AccountantActivityLog {
  id: string;

  // Target
  accountant_id?: string;
  application_id?: string;

  // Action Details
  action: string;
  actor_id?: string;
  actor_role?: 'admin' | 'system' | 'self';

  // Context
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;

  // Timestamp
  created_at: string;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApplicationSubmissionResponse {
  success: boolean;
  application_id: string;
  message: string;
  estimated_review_time?: string; // e.g., "24-48 hours"
}

export interface ApplicationStatusResponse {
  application: AccountantApplication;
  status_message: string;
  next_steps?: string;
}

export interface ApprovalResponse {
  success: boolean;
  accountant_id: string;
  user_id: string;
  organization_id: string;
  magic_link?: string;
  message: string;
}

export interface RejectionResponse {
  success: boolean;
  message: string;
  can_reapply: boolean;
  reapply_after?: string; // ISO date
}

export interface AccountantPricingResponse {
  is_vetted: boolean;
  discount_rate: number;
  final_price: number;
  standard_price: number;
  message?: string;
}

// =====================================================
// APPLICATION STATISTICS
// =====================================================

export interface ApplicationStatistics {
  total_applications: number;
  pending_count: number;
  under_review_count: number;
  approved_count: number;
  rejected_count: number;
  suspended_count: number;
  total_vetted_accountants: number;
  active_accountants: number;
}

// =====================================================
// ADMIN REVIEW DATA
// =====================================================

export interface AdminReviewDecision {
  application_id: string;
  action: 'approve' | 'reject';
  internal_notes?: string;
  rejection_reason?: string; // Required if action = 'reject'
}

// =====================================================
// CREDENTIAL VALIDATION RESULT
// =====================================================

export interface CredentialValidationResult {
  is_valid: boolean;
  credential_type: CredentialType;
  credential_number: string;
  issuing_body?: string;
  expiry_date?: string;
  is_expired: boolean;
  validation_source: 'manual' | 'api' | 'database';
  validation_notes?: string;
}
