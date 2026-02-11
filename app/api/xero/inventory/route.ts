/**
 * GET /api/xero/inventory
 *
 * Fetch inventory items from Xero Accounting API.
 * Requires accounting.transactions.read OAuth scope (Phase 1.5 - ATODE Integration).
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - trackedOnly: boolean (optional, default: false) - Return only tracked inventory items
 *
 * Returns:
 * - Array of inventory items with quantities, cost prices, valuation methods
 * - Normalized to ATODE internal format
 *
 * Legislation: Trading stock adjustments (Section 70-35 ITAA 1997), Inventory valuation methods
 */

import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, type XeroItem, type NormalizedInventoryItem } from '@/lib/xero/client';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const trackedOnly = searchParams.get('trackedOnly') === 'true';

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
    xeroClient.setTokenSet({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expires_at: connection.expires_at,
    });

    // Fetch items from Xero Accounting API
    const response = await xeroClient.accountingApi.getItems(tenantId);

    // Extract items from response
    let xeroItems = (response.body.items || []) as XeroItem[];

    // Filter to tracked inventory only if requested
    if (trackedOnly) {
      xeroItems = xeroItems.filter(item => item.isTrackedAsInventory === true);
    }

    // Normalize to ATODE internal format
    const normalizedItems: NormalizedInventoryItem[] = xeroItems.map(item => normalizeInventoryItem(item));

    // Calculate statistics
    const trackedCount = normalizedItems.filter(i => i.is_tracked).length;
    const totalInventoryValue = normalizedItems
      .filter(i => i.is_tracked && i.total_cost_pool)
      .reduce((sum, i) => sum + (i.total_cost_pool || 0), 0);

    const soldCount = normalizedItems.filter(i => i.is_sold).length;
    const purchasedCount = normalizedItems.filter(i => i.is_purchased).length;

    return NextResponse.json({
      success: true,
      count: normalizedItems.length,
      tenantId,
      items: normalizedItems,
      statistics: {
        tracked_count: trackedCount,
        sold_count: soldCount,
        purchased_count: purchasedCount,
        total_inventory_value: totalInventoryValue.toFixed(2),
        tracked_percentage: normalizedItems.length > 0 ? ((trackedCount / normalizedItems.length) * 100).toFixed(1) + '%' : '0%',
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'xero_accounting_api',
        apiVersion: '2.0',
        trackedOnly,
      },
    });
  } catch (error) {
    console.error('Error fetching Xero inventory:', error);

    // Handle Xero API errors
    if (error instanceof Error && error.message.includes('accounting.transactions.read')) {
      return createErrorResponse(
        new Error(
          'Missing accounting.transactions.read OAuth scope. Please reconnect your Xero account to grant transactions access.'
        ),
        { operation: 'fetchInventory' },
        403
      );
    }

    return createErrorResponse(
      error,
      {
        operation: 'fetchInventory',
        endpoint: '/api/xero/inventory',
      },
      500
    );
  }
}

/**
 * Normalize Xero item to ATODE internal format
 */
function normalizeInventoryItem(xeroItem: XeroItem): NormalizedInventoryItem {
  return {
    item_id: xeroItem.itemID,
    item_code: xeroItem.code,
    item_name: xeroItem.name,
    description: xeroItem.description,
    is_tracked: xeroItem.isTrackedAsInventory === true,
    quantity_on_hand: xeroItem.quantityOnHand,
    cost_price: xeroItem.purchaseDetails?.unitPrice,
    sell_price: xeroItem.salesDetails?.unitPrice,
    total_cost_pool: xeroItem.totalCostPool,
    inventory_asset_account: xeroItem.inventoryAssetAccountCode,
    cogs_account: xeroItem.purchaseDetails?.accountCode,
    sales_account: xeroItem.salesDetails?.accountCode,
    purchase_tax_type: xeroItem.purchaseDetails?.taxType,
    sales_tax_type: xeroItem.salesDetails?.taxType,
    is_sold: xeroItem.isSold === true,
    is_purchased: xeroItem.isPurchased === true,
    status: 'active', // Xero doesn't have explicit active/inactive status for items
  };
}
