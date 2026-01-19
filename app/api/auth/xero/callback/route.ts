import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient } from '@/lib/xero/client'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        // Handle OAuth errors
        if (error) {
            console.error('Xero OAuth error:', error)
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_BASE_URL}/auth/error?message=${encodeURIComponent(error)}`
            )
        }

        // Verify authorization code exists
        if (!code) {
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_BASE_URL}/auth/error?message=No authorization code received`
            )
        }

        // Verify state for CSRF protection
        const storedState = request.cookies.get('xero_oauth_state')?.value
        if (!storedState || storedState !== state) {
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_BASE_URL}/auth/error?message=Invalid state parameter`
            )
        }

        // Exchange code for tokens
        const client = createXeroClient()
        const tokenSet = await client.apiCallback(request.nextUrl.href)

        // Get connected tenants (organizations)
        await client.updateTenants()
        const tenants = client.tenants

        if (!tenants || tenants.length === 0) {
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_BASE_URL}/auth/error?message=No Xero organizations found`
            )
        }

        // Store connection in Supabase
        const supabase = await createServiceClient()

        // For each tenant, create or update connection
        for (const tenant of tenants) {
            // Get organization details
            client.setTokenSet(tokenSet)
            const orgResponse = await client.accountingApi.getOrganisation(tenant.tenantId)
            const org = orgResponse.body.organisations?.[0]

            // Upsert connection
            const { error: dbError } = await supabase
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
                }, {
                    onConflict: 'tenant_id'
                })

            if (dbError) {
                console.error('Failed to store Xero connection:', dbError)
            }
        }

        // Clear OAuth state cookie
        const response = NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?connected=true`
        )
        response.cookies.delete('xero_oauth_state')

        return response
    } catch (error) {
        console.error('Xero OAuth callback error:', error)
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL}/auth/error?message=Failed to complete Xero connection`
        )
    }
}
