import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient, type XeroOrganization, type XeroTenant } from '@/lib/xero/client'
import { createServiceClient } from '@/lib/supabase/server'

type TenantWithOrg = XeroTenant & { orgData?: XeroOrganization }

function buildErrorResponse(request: NextRequest, message: string, status: number, details?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ error: message, ...details }, { status })
    }

    const redirectUrl = new URL('/dashboard', request.nextUrl.origin)
    redirectUrl.searchParams.set('error', message)
    return NextResponse.redirect(redirectUrl.toString())
}

// GET /api/auth/xero/callback - Handle Xero OAuth callback
// Single-user mode: No authentication required
export async function GET(request: NextRequest) {
    console.log('=== Xero OAuth Callback Started ===')
    const baseUrl = request.nextUrl.origin

    // Wrap EVERYTHING in a try-catch that returns JSON for debugging
    try {
        const searchParams = request.nextUrl.searchParams
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        console.log('Params received:', { hasCode: !!code, hasState: !!state, error })

        // Handle OAuth errors from Xero
        if (error) {
            return buildErrorResponse(request, 'OAuth error from Xero', 400, {
                step: 'oauth_error',
                description: searchParams.get('error_description'),
                rawError: error
            })
        }

        if (!code) {
            return buildErrorResponse(request, 'No authorization code received', 400, {
                step: 'no_code'
            })
        }

        // Get stored state from cookie
        const storedState = request.cookies.get('xero_oauth_state')?.value
        console.log('State:', { stored: storedState, received: state, match: storedState === state })

        if (!storedState || storedState !== state) {
            return buildErrorResponse(request, 'OAuth state mismatch or missing cookie', 400, {
                step: 'state_mismatch'
            })
        }

        // Create client with state for validation
        console.log('Creating Xero client...')
        const client = createXeroClient({ state: storedState, baseUrl })

        // Initialize client (discovers Xero identity endpoints)
        console.log('Initializing client...')
        await client.initialize()
        console.log('Client initialized')

        // Exchange code for tokens - THIS IS WHERE IT FAILS
        console.log('Exchanging code for tokens...')
        console.log('Callback URL:', request.nextUrl.href)

        const tokenSet = await client.apiCallback(request.nextUrl.href)
        console.log('Token exchange successful!')

        // Get connected tenants
        console.log('Fetching tenants...')
        await client.updateTenants()
        const tenants = client.tenants

        if (!tenants || tenants.length === 0) {
            return buildErrorResponse(request, 'No Xero organizations found', 400, {
                step: 'no_tenants'
            })
        }

        // Store connections in Supabase
        const supabase = await createServiceClient()

        for (const tenant of tenants) {
            console.log('Processing tenant:', tenant.tenantName)

            try {
                const org = (tenant as TenantWithOrg).orgData

                // Single-user mode: Just upsert the connection
                await supabase
                    .from('xero_connections')
                    .upsert({
                        tenant_id: tenant.tenantId,
                        tenant_name: tenant.tenantName,
                        tenant_type: tenant.tenantType,
                        access_token: tokenSet.access_token,
                        refresh_token: tokenSet.refresh_token,
                        expires_at: tokenSet.expires_at,
                        id_token: tokenSet.id_token,
                        scope: tokenSet.scope,
                        organisation_name: org?.name,
                        organisation_type: org?.organisationType,
                        country_code: org?.countryCode,
                        base_currency: org?.baseCurrency,
                        financial_year_end_day: org?.financialYearEndDay,
                        financial_year_end_month: org?.financialYearEndMonth,
                        is_demo_company: org?.isDemoCompany || false,
                        connected_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'tenant_id' })
            } catch (tenantError: unknown) {
                const tenantMessage = tenantError instanceof Error ? tenantError.message : String(tenantError)
                console.error('Tenant error:', tenantMessage)
            }
        }

        // SUCCESS! Redirect to dashboard
        const response = NextResponse.redirect(`${baseUrl}/dashboard?connected=true`)
        response.cookies.delete('xero_oauth_state')
        return response

    } catch (err: unknown) {
        // CATCH ALL ERRORS AND RETURN JSON FOR DEBUGGING
        console.error('=== XERO CALLBACK ERROR ===')
        console.error('Error:', err)
        console.error('Error type:', typeof err)

        // Handle both Error objects and plain strings
        const errorMessage = err instanceof Error ? err.message : (typeof err === 'string' ? err : 'Unknown error')
        const errorType = err instanceof Error ? err.constructor.name : (typeof err === 'string' ? 'String' : 'Unknown')

        // Try to extract Xero-specific error details
        let xeroDetails: unknown = null
        if (err && typeof err === 'object') {
            const errResponse = err as { response?: { body?: unknown; data?: unknown } }
            if (errResponse.response?.body) {
                xeroDetails = errResponse.response.body
            } else if (errResponse.response?.data) {
                xeroDetails = errResponse.response.data
            }
        }

        return buildErrorResponse(request, 'Xero callback failed', 500, {
            type: errorType,
            message: errorMessage,
            rawError: err instanceof Error ? err.stack || err.message : (typeof err === 'string' ? err : JSON.stringify(err)),
            xeroDetails: xeroDetails,
        })
    }
}
