/**
 * GET /api/xero/assets
 *
 * Fetch fixed assets from Xero Asset Register.
 * Requires assets.read OAuth scope (Phase 1.1 - ATODE Integration).
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - status: 'Draft' | 'Registered' | 'Disposed' (optional) - Filter by asset status
 *
 * Returns:
 * - Array of assets with depreciation details
 * - Normalized to ATODE internal format
 *
 * Legislation: Section 328-180 ITAA 1997 (Instant Asset Write-Off), Division 40 (Capital Allowances)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, type XeroAsset, type NormalizedAsset } from '@/lib/xero/client';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import { decryptStoredToken } from '@/lib/xero/token-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const statusFilter = searchParams.get('status') as 'Draft' | 'Registered' | 'Disposed' | null;

    // Validate required parameters
    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required');
    }

    // Get Xero connection from database
    const supabase = await createServiceClient();
    const { data: connection, error: dbError } = await supabase
      .from('xero_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('tenant_id', tenantId)
      .single();

    if (dbError || !connection) {
      return createErrorResponse(
        new Error('Xero connection not found. Please connect your Xero account first.'),
        { tenantId },
        404
      );
    }

    // Initialize Xero client
    const xeroClient = createXeroClient();
    await xeroClient.initialize();
    // Decrypt tokens from database (SEC-001)
    xeroClient.setTokenSet({
      access_token: decryptStoredToken(connection.access_token),
      refresh_token: decryptStoredToken(connection.refresh_token),
      expires_at: connection.expires_at,
    });

    // Fetch assets from Xero Assets API
    // Note: Xero Assets API is a separate API from Accounting API
    // Base URL: https://api.xero.com/assets.xro/1.0/
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Xero SDK AssetStatusQueryParam enum not assignable from string literal
    const response = await xeroClient.assetApi.getAssets(tenantId, (statusFilter || 'Registered') as any);

    // Extract assets from response
    const xeroAssets = (response.body.items || []) as unknown as XeroAsset[];

    // Normalize to ATODE internal format
    const normalizedAssets: NormalizedAsset[] = xeroAssets.map(asset => normalizeAsset(asset));

    return NextResponse.json({
      success: true,
      count: normalizedAssets.length,
      tenantId,
      assets: normalizedAssets,
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'xero_assets_api',
        apiVersion: '1.0',
        statusFilter: statusFilter || 'all',
      },
    });
  } catch (error) {
    console.error('Error fetching Xero assets:', error);

    // Handle Xero API errors
    if (error instanceof Error && error.message.includes('assets.read')) {
      return createErrorResponse(
        new Error(
          'Missing assets.read OAuth scope. Please reconnect your Xero account to grant asset access.'
        ),
        { operation: 'fetchAssets' },
        403
      );
    }

    return createErrorResponse(
      error,
      {
        operation: 'fetchAssets',
        endpoint: '/api/xero/assets',
      },
      500
    );
  }
}

/**
 * Normalize Xero asset to ATODE internal format
 */
function normalizeAsset(xeroAsset: XeroAsset): NormalizedAsset {
  const depreciationSettings = xeroAsset.bookDepreciationSettings;
  const depreciationDetail = xeroAsset.bookDepreciationDetail;

  // Map Xero depreciation methods to simplified format
  let depreciationMethod: NormalizedAsset['depreciation_method'] = 'None';
  if (depreciationSettings?.depreciationMethod) {
    switch (depreciationSettings.depreciationMethod) {
      case 'StraightLine':
        depreciationMethod = 'Prime Cost';
        break;
      case 'DiminishingValue100':
      case 'DiminishingValue150':
      case 'DiminishingValue200':
        depreciationMethod = 'Diminishing Value';
        break;
      case 'FullDepreciation':
        depreciationMethod = 'Full Depreciation';
        break;
      default:
        depreciationMethod = 'None';
    }
  }

  // Map asset status
  let status: NormalizedAsset['status'] = 'Active';
  switch (xeroAsset.assetStatus) {
    case 'Draft':
      status = 'Draft';
      break;
    case 'Registered':
      status = 'Active';
      break;
    case 'Disposed':
      status = 'Disposed';
      break;
  }

  return {
    asset_id: xeroAsset.assetId,
    asset_name: xeroAsset.assetName,
    asset_number: xeroAsset.assetNumber,
    purchase_date: xeroAsset.purchaseDate,
    purchase_price: xeroAsset.purchasePrice,
    disposal_date: xeroAsset.disposalDate,
    disposal_price: xeroAsset.disposalPrice,
    asset_type: xeroAsset.assetType?.assetTypeName || 'Uncategorized',
    depreciation_method: depreciationMethod,
    effective_life: depreciationSettings?.effectiveLifeYears,
    depreciation_rate: depreciationSettings?.depreciationRate,
    accumulated_depreciation: depreciationDetail?.currentAccumDepreciationAmount || 0,
    book_value: xeroAsset.accountingBookValue || 0,
    pool_type: undefined, // To be determined by analysis engine
    status,
  };
}
