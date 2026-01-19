import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient } from '@/lib/xero/client'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    console.log('=== Xero OAuth Callback Started ===')

    // Wrap EVERYTHING in a try-catch that returns JSON for debugging
    try {
        const searchParams = request.nextUrl.searchParams
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        console.log('Params received:', { hasCode: !!code, hasState: !!state, error })

        // Handle OAuth errors from Xero
        if (error) {
            return NextResponse.json({
                step: 'oauth_error',
                error: error,
                description: searchParams.get('error_description')
            }, { status: 400 })
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

        if (!code) {
            return NextResponse.json({
                step: 'no_code',
                error: 'No authorization code received'
            }, { status: 400 })
        }

        // Get stored state from cookie
        const storedState = request.cookies.get('xero_oauth_state')?.value
        console.log('State:', { stored: storedState, received: state, match: storedState === state })

        // Create client with state for validation
        console.log('Creating Xero client...')
        const client = createXeroClient(storedState)

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
            return NextResponse.json({
                step: 'no_tenants',
                error: 'No Xero organizations found'
            }, { status: 400 })
        }

        // Store connections in Supabase
        const supabase = await createServiceClient()

        for (const tenant of tenants) {
            console.log('Processing tenant:', tenant.tenantName)

            try {
                client.setTokenSet(tokenSet)
                const orgResponse = await client.accountingApi.getOrganisations(tenant.tenantId)
                const org = orgResponse.body.organisations?.[0]

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
            } catch (tenantError: any) {
                console.error('Tenant error:', tenantError.message)
            }
        }

        // SUCCESS! Redirect to dashboard
        const response = NextResponse.redirect(`${baseUrl}/dashboard?connected=true`)
        response.cookies.delete('xero_oauth_state')
        return response

    } catch (err: any) {
        // CATCH ALL ERRORS AND RETURN JSON FOR DEBUGGING
        console.error('=== XERO CALLBACK ERROR ===')
        console.error('Error type:', err.constructor?.name)
        console.error('Error message:', err.message)
        console.error('Error stack:', err.stack)

        // Try to extract Xero-specific error details
        let xeroDetails = null
        try {
            if (err.response?.body) {
                xeroDetails = err.response.body
            } else if (err.response?.data) {
                xeroDetails = err.response.data
            }
        } catch (e) { }

        return NextResponse.json({
            error: 'Xero callback failed',
            type: err.constructor?.name || 'Unknown',
            message: err.message,
            xeroDetails: xeroDetails,
            stack: err.stack?.split('\n').slice(0, 5),
        }, { status: 500 })
    }
}
