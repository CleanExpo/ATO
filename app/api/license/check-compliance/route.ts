/**
 * License Compliance Check
 *
 * GET /api/license/check-compliance
 *
 * Checks if user has sufficient licenses for all connected organizations
 * Returns organization counts and whether additional licenses are needed
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkOrganizationLicenseCompliance } from '@/lib/middleware/license-verification';

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check license compliance
    const compliance = await checkOrganizationLicenseCompliance(user.id);

    // Return compliance with additional context
    return NextResponse.json({
      ...compliance,
      needsAdditionalLicenses: compliance.needsAdditionalLicenses || 0,
    });
  } catch (error) {
    console.error('Failed to check license compliance:', error);
    return NextResponse.json(
      {
        error: 'Failed to check license compliance',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
