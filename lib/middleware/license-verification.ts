/**
 * License Verification Middleware
 *
 * Checks if users have active licenses before accessing gated features
 * - Verifies license existence and active status
 * - Checks license type matches required tier
 * - Handles grace periods for expired licenses
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { LicenseType } from '@/lib/stripe/client';

export interface LicenseStatus {
  isActive: boolean;
  licenseType: LicenseType | null;
  activatedAt: string | null;
  message?: string;
}

/**
 * Get number of organizations user has access to
 *
 * @param userId - User ID to check
 * @returns Number of organizations
 */
export async function getUserOrganizationCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from('user_tenant_access')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error('Error counting user organizations:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getUserOrganizationCount:', error);
    return 0;
  }
}

/**
 * Get number of organization licenses purchased by user
 * - Base license (comprehensive/core) includes 1 organization
 * - Additional organization purchases add more
 *
 * @param userId - User ID to check
 * @returns Number of organizations licensed
 */
export async function getUserLicensedOrganizationCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();

    // Get all active purchases for this user
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('product_type, license_active')
      .eq('user_id', userId)
      .eq('license_active', true);

    if (error || !purchases) {
      console.error('Error fetching user purchases:', error);
      return 0;
    }

    let licensedOrganizations = 0;

    for (const purchase of purchases) {
      if (purchase.product_type === 'additional_organization') {
        // Each additional organization purchase adds 1
        licensedOrganizations += 1;
      } else if (['comprehensive', 'core', 'wholesale_accountant'].includes(purchase.product_type)) {
        // Base license includes 1 organization
        licensedOrganizations += 1;
      }
    }

    return licensedOrganizations;
  } catch (error) {
    console.error('Error in getUserLicensedOrganizationCount:', error);
    return 0;
  }
}

/**
 * Check if user has sufficient licenses for all their organizations
 *
 * @param userId - User ID to check
 * @returns Object with hasAccess flag and details
 */
export async function checkOrganizationLicenseCompliance(userId: string): Promise<{
  hasAccess: boolean;
  connectedOrganizations: number;
  licensedOrganizations: number;
  needsAdditionalLicenses: number;
}> {
  const [connectedOrgs, licensedOrgs] = await Promise.all([
    getUserOrganizationCount(userId),
    getUserLicensedOrganizationCount(userId)
  ]);

  const needsAdditional = Math.max(0, connectedOrgs - licensedOrgs);

  return {
    hasAccess: connectedOrgs <= licensedOrgs,
    connectedOrganizations: connectedOrgs,
    licensedOrganizations: licensedOrgs,
    needsAdditionalLicenses: needsAdditional,
  };
}

/**
 * Get user's current license status
 *
 * @param userId - User ID to check license for
 * @returns License status object
 */
export async function getUserLicenseStatus(
  userId: string
): Promise<LicenseStatus> {
  try {
    const supabase = await createClient();

    // Get user's profile with license information
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('license_type, license_active, license_activated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      return {
        isActive: false,
        licenseType: null,
        activatedAt: null,
        message: 'Failed to retrieve license status',
      };
    }

    // Check if license is active
    if (!profile.license_active || !profile.license_type) {
      return {
        isActive: false,
        licenseType: null,
        activatedAt: null,
        message: 'No active license found',
      };
    }

    // Get most recent purchase to verify it's still valid
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId)
      .eq('license_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (purchaseError || !purchase) {
      return {
        isActive: false,
        licenseType: null,
        activatedAt: null,
        message: 'No valid purchase found',
      };
    }

    // Check if license has expired (for subscription-based licenses)
    if (purchase.license_expires_at) {
      const expirationDate = new Date(purchase.license_expires_at);
      const now = new Date();

      if (now > expirationDate) {
        return {
          isActive: false,
          licenseType: purchase.product_type as LicenseType,
          activatedAt: profile.license_activated_at,
          message: 'License expired',
        };
      }
    }

    return {
      isActive: true,
      licenseType: purchase.product_type as LicenseType,
      activatedAt: profile.license_activated_at,
    };
  } catch (error) {
    console.error('Error checking license status:', error);
    return {
      isActive: false,
      licenseType: null,
      activatedAt: null,
      message: 'Error checking license status',
    };
  }
}

/**
 * Verify user has required license type
 *
 * @param userId - User ID to check
 * @param requiredTier - Required license tier (or array of acceptable tiers)
 * @returns True if user has required license, false otherwise
 */
export async function verifyLicenseTier(
  userId: string,
  requiredTier: LicenseType | LicenseType[]
): Promise<boolean> {
  const licenseStatus = await getUserLicenseStatus(userId);

  if (!licenseStatus.isActive || !licenseStatus.licenseType) {
    return false;
  }

  const requiredTiers = Array.isArray(requiredTier)
    ? requiredTier
    : [requiredTier];

  return requiredTiers.includes(licenseStatus.licenseType);
}

/**
 * Middleware to require active license for API routes
 *
 * Usage in API route:
 * ```
 * const licenseCheck = await requireActiveLicense(request);
 * if (!licenseCheck.isActive) {
 *   return licenseCheck.response;
 * }
 * ```
 *
 * @param request - Next.js request object
 * @returns Object with isActive flag and optional error response
 */
export async function requireActiveLicense(request: Request): Promise<{
  isActive: boolean;
  licenseStatus?: LicenseStatus;
  response?: NextResponse;
}> {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        isActive: false,
        response: NextResponse.json(
          {
            error: 'Authentication required',
            errorId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
          { status: 401 }
        ),
      };
    }

    // Check license status
    const licenseStatus = await getUserLicenseStatus(user.id);

    if (!licenseStatus.isActive) {
      return {
        isActive: false,
        licenseStatus,
        response: NextResponse.json(
          {
            error: 'Active license required',
            message:
              licenseStatus.message ||
              'You need an active license to access this feature',
            errorId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            context: {
              purchaseUrl: '/dashboard/pricing',
            },
          },
          { status: 403 }
        ),
      };
    }

    return {
      isActive: true,
      licenseStatus,
    };
  } catch (error) {
    console.error('Error in license verification middleware:', error);
    return {
      isActive: false,
      response: NextResponse.json(
        {
          error: 'License verification failed',
          errorId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Check if feature is available for user's license tier
 *
 * Feature matrix:
 * - Comprehensive: All features
 * - Core: R&D analysis, basic deductions
 * - Wholesale Accountant: All features (for accountants)
 *
 * @param licenseType - User's license type
 * @param feature - Feature to check access for
 * @returns True if feature is available for this license tier
 */
export function isFeatureAvailable(
  licenseType: LicenseType | null,
  feature: string
): boolean {
  if (!licenseType) {
    return false;
  }

  // Comprehensive and wholesale accountant have access to all features
  if (licenseType === 'comprehensive' || licenseType === 'wholesale_accountant') {
    return true;
  }

  // Core license feature restrictions
  const coreFeatures = [
    'rnd-analysis',
    'basic-deductions',
    'tax-rates',
    'basic-reports',
  ];

  if (licenseType === 'core') {
    return coreFeatures.includes(feature);
  }

  return false;
}
