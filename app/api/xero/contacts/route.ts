/**
 * GET /api/xero/contacts
 *
 * Fetch contacts from Xero Accounting API with enhanced data.
 * Requires accounting.contacts.read OAuth scope (Phase 1.3 - ATODE Integration).
 *
 * Query Parameters:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - includeArchived: boolean (optional, default: false) - Include archived contacts
 * - contactType: 'customer' | 'supplier' | 'both' (optional) - Filter by contact type
 *
 * Returns:
 * - Array of contacts with ABN, address, tax type, balances
 * - Normalized to ATODE internal format
 *
 * Legislation: Trust distribution analysis (Section 100A ITAA 1936), Related party detection (Division 7A)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, type XeroContact, type NormalizedContact } from '@/lib/xero/client';
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
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const contactTypeFilter = searchParams.get('contactType') as 'customer' | 'supplier' | 'both' | null;

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

    // Fetch contacts from Xero Accounting API
    // includeArchived: Controls whether to return archived contacts
    const response = await xeroClient.accountingApi.getContacts(
      tenantId,
      undefined, // modifiedAfter
      undefined, // where clause
      undefined, // order
      undefined, // IDs
      undefined, // page
      includeArchived // includeArchived
    );

    // Extract contacts from response
    let xeroContacts = (response.body.contacts || []) as XeroContact[];

    // Filter by contact type if requested
    if (contactTypeFilter) {
      if (contactTypeFilter === 'customer') {
        xeroContacts = xeroContacts.filter(c => c.isCustomer === true);
      } else if (contactTypeFilter === 'supplier') {
        xeroContacts = xeroContacts.filter(c => c.isSupplier === true);
      } else if (contactTypeFilter === 'both') {
        xeroContacts = xeroContacts.filter(c => c.isCustomer === true && c.isSupplier === true);
      }
    }

    // Normalize to ATODE internal format
    const normalizedContacts: NormalizedContact[] = xeroContacts.map(contact => normalizeContact(contact));

    // Calculate statistics
    const customerCount = normalizedContacts.filter(c => c.contact_type === 'customer' || c.contact_type === 'both').length;
    const supplierCount = normalizedContacts.filter(c => c.contact_type === 'supplier' || c.contact_type === 'both').length;
    const withABN = normalizedContacts.filter(c => c.abn).length;

    return NextResponse.json({
      success: true,
      count: normalizedContacts.length,
      tenantId,
      contacts: normalizedContacts,
      statistics: {
        customer_count: customerCount,
        supplier_count: supplierCount,
        with_abn: withABN,
        abn_coverage: normalizedContacts.length > 0 ? ((withABN / normalizedContacts.length) * 100).toFixed(1) + '%' : '0%',
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'xero_accounting_api',
        apiVersion: '2.0',
        includeArchived,
        contactTypeFilter: contactTypeFilter || 'all',
      },
    });
  } catch (error) {
    console.error('Error fetching Xero contacts:', error);

    // Handle Xero API errors
    if (error instanceof Error && error.message.includes('accounting.contacts.read')) {
      return createErrorResponse(
        new Error(
          'Missing accounting.contacts.read OAuth scope. Please reconnect your Xero account to grant contact access.'
        ),
        { operation: 'fetchContacts' },
        403
      );
    }

    return createErrorResponse(
      error,
      {
        operation: 'fetchContacts',
        endpoint: '/api/xero/contacts',
      },
      500
    );
  }
}

/**
 * Normalize Xero contact to ATODE internal format
 */
function normalizeContact(xeroContact: XeroContact): NormalizedContact {
  // Determine contact type
  let contactType: NormalizedContact['contact_type'] = 'other';
  if (xeroContact.isCustomer && xeroContact.isSupplier) {
    contactType = 'both';
  } else if (xeroContact.isCustomer) {
    contactType = 'customer';
  } else if (xeroContact.isSupplier) {
    contactType = 'supplier';
  }

  // Extract primary address (prefer STREET over POBOX)
  const streetAddress = xeroContact.addresses?.find(a => a.addressType === 'STREET');
  const primaryAddress = streetAddress || xeroContact.addresses?.[0];

  // Extract primary phone (prefer MOBILE over DEFAULT)
  const mobilePhone = xeroContact.phones?.find(p => p.phoneType === 'MOBILE');
  const defaultPhone = xeroContact.phones?.find(p => p.phoneType === 'DEFAULT');

  // Infer entity type from ABN structure (simplified logic)
  // Real ABN validation would require checksum verification
  let entityType: NormalizedContact['entity_type'] | undefined;
  if (xeroContact.taxNumber && xeroContact.taxNumber.length >= 9) {
    // ABN is 11 digits in Australia
    // First 2 digits indicate entity type (simplified):
    // - 51-53: Company
    // - 00-50: Individual/Trust/Partnership (requires deeper analysis)
    const abn = xeroContact.taxNumber.replace(/\s/g, '');
    if (abn.length === 11) {
      const prefix = parseInt(abn.substring(0, 2));
      if (prefix >= 51 && prefix <= 53) {
        entityType = 'company';
      } else {
        // Default to individual for now; trust/partnership detection requires additional data
        entityType = 'individual';
      }
    }
  }

  return {
    contact_id: xeroContact.contactID,
    name: xeroContact.name,
    first_name: xeroContact.firstName,
    last_name: xeroContact.lastName,
    email: xeroContact.emailAddress,
    abn: xeroContact.taxNumber,
    contact_type: contactType,
    entity_type: entityType,
    address_line1: primaryAddress?.addressLine1,
    address_line2: primaryAddress?.addressLine2,
    city: primaryAddress?.city,
    state: primaryAddress?.region,
    postcode: primaryAddress?.postalCode,
    country: primaryAddress?.country,
    phone: defaultPhone?.phoneNumber,
    mobile: mobilePhone?.phoneNumber,
    status: xeroContact.contactStatus === 'ACTIVE' ? 'active' : 'archived',
    accounts_receivable_balance: xeroContact.balances?.accountsReceivable?.outstanding,
    accounts_payable_balance: xeroContact.balances?.accountsPayable?.outstanding,
    is_related_party: false, // Will be flagged by trust/Division 7A analysis engines
  };
}
