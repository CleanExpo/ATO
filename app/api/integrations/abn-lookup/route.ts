/**
 * POST /api/integrations/abn-lookup
 *
 * Look up an ABN from the Australian Business Register.
 *
 * Body:
 * - abn: string (required) - 11-digit ABN to look up
 * - tenantId: string (optional) - for cache scoping
 *
 * Returns: ABNLookupResult with entity details, GST status
 *
 * GET /api/integrations/abn-lookup?abn=12345678901
 *
 * Alternative GET endpoint for simple lookups.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { lookupABN, searchABNByName, checkSupplierGSTStatus } from '@/lib/integrations/abn-lookup'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { abn, tenantId, action, name, state } = body

    if (action === 'search' && name) {
      // Search by name
      const result = await searchABNByName(name, state)
      return NextResponse.json(result)
    }

    if (action === 'gst-check' && abn) {
      // GST status check
      const result = await checkSupplierGSTStatus(abn)
      return NextResponse.json(result)
    }

    // Default: ABN lookup
    if (!abn || typeof abn !== 'string') {
      return createValidationError('abn is required (11-digit string)')
    }

    const result = await lookupABN(abn, tenantId)
    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'abnLookup' }, 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const abn = searchParams.get('abn')

    if (!abn) {
      return createValidationError('abn query parameter is required')
    }

    const result = await lookupABN(abn)
    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'abnLookupGET' }, 500)
  }
}
