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
