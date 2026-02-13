import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient, type XeroOrganization, type XeroTenant } from '@/lib/xero/client'
import { createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'
import { encryptTokenForStorage } from '@/lib/xero/token-store'

export const dynamic = 'force-dynamic'

const log = createLogger('api:auth:xero-callback')

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
    log.info('Xero OAuth callback started')
    const baseUrl = request.nextUrl.origin

    // Wrap EVERYTHING in a try-catch that returns JSON for debugging
    try {
        const searchParams = request.nextUrl.searchParams
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        log.debug('Params received', { hasCode: !!code, hasState: !!state, error })

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
        log.debug('State verification', { stored: storedState, received: state, match: storedState === state })

        if (!storedState || storedState !== state) {
            return buildErrorResponse(request, 'OAuth state mismatch or missing cookie', 400, {
                step: 'state_mismatch'
            })
        }

        // Create client with state for validation
        log.info('Creating Xero client')
        const client = createXeroClient({ state: storedState, baseUrl })

        // Initialize client (discovers Xero identity endpoints)
        log.info('Initializing client')
        await client.initialize()
        log.info('Client initialized')

        // Exchange code for tokens - THIS IS WHERE IT FAILS
        log.info('Exchanging code for tokens')
        log.debug('Callback URL', { url: request.nextUrl.href })

        const tokenSet = await client.apiCallback(request.nextUrl.href)
        log.info('Token exchange successful')

        // Get connected tenants
        log.info('Fetching tenants')
        await client.updateTenants()
        const tenants = client.tenants

        if (!tenants || tenants.length === 0) {
            return buildErrorResponse(request, 'No Xero organizations found', 400, {
                step: 'no_tenants'
            })
        }

        // Store connections in Supabase
        const supabase = await createServiceClient()

        // Get authenticated user (optional for backward compatibility)
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id

        // Track failed tenants for partial success handling
        const failedTenants: Array<{name: string; reason: string}> = []

        for (const tenant of tenants) {
            log.info('Processing tenant', { tenantName: tenant.tenantName })

            try {
                const org = (tenant as TenantWithOrg).orgData

                // Multi-org support: Find or create organization for this Xero tenant
                let organizationId: string | null = null

                // Check if organization already exists for this Xero tenant
                const { data: existingOrg } = await supabase
                    .from('organizations')
                    .select('id')
                    .eq('xero_tenant_id', tenant.tenantId)
                    .single()

                if (existingOrg) {
                    organizationId = existingOrg.id
                    log.info('Found existing organization', { organizationId })
                } else {
                    // Create new organization for this Xero tenant
                    const { data: newOrg, error: orgError} = await supabase
                        .from('organizations')
                        .insert({
                            name: org?.name || tenant.tenantName || 'My Organisation',
                            xero_tenant_id: tenant.tenantId,
                            settings: {},
                            xero_connected: true,
                        })
                        .select('id')
                        .single()

                    if (orgError) {
                        console.error('[CRITICAL] Organization creation failed:', {
                            tenant: tenant.tenantName,
                            tenantId: tenant.tenantId,
                            error: orgError.message,
                            code: orgError.code,
                            details: orgError.details,
                            timestamp: new Date().toISOString()
                        })

                        failedTenants.push({
                            name: tenant.tenantName,
                            reason: orgError.message
                        })
                        continue // Skip this tenant
                    }

                    if (!newOrg || !newOrg.id) {
                        console.error('[CRITICAL] Organization created but no ID returned')
                        failedTenants.push({
                            name: tenant.tenantName,
                            reason: 'Organization ID missing after creation'
                        })
                        continue // Skip this tenant
                    }

                    organizationId = newOrg.id
                    log.info('Created new organization', { organizationId })

                    // Grant user owner access to this organization (if user exists)
                    if (userId) {
                        await supabase.from('user_tenant_access').insert({
                            user_id: userId,
                            organization_id: organizationId,
                            tenant_id: tenant.tenantId,
                            role: 'owner',
                        })
                        log.info('Granted owner access to user')
                    }
                }

                // Encrypt tokens before storage (SEC-001)
                const encryptedAccessToken = encryptTokenForStorage(tokenSet.access_token)
                const encryptedRefreshToken = encryptTokenForStorage(tokenSet.refresh_token)

                // Upsert the Xero connection with organization_id
                const { error: connectionError } = await supabase
                    .from('xero_connections')
                    .upsert({
                        tenant_id: tenant.tenantId,
                        tenant_name: tenant.tenantName,
                        tenant_type: tenant.tenantType,
                        access_token: encryptedAccessToken,
                        refresh_token: encryptedRefreshToken,
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
                        organization_id: organizationId,
                        connected_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'tenant_id' })

                if (connectionError) {
                    console.error('Failed to save Xero connection:', {
                        error: connectionError,
                        tenantId: tenant.tenantId,
                        tenantName: tenant.tenantName,
                        organizationId,
                        timestamp: new Date().toISOString(),
                        step: 'database_upsert'
                    })
                    
                    failedTenants.push({
                        name: tenant.tenantName,
                        reason: `Database error: ${connectionError.message}`
                    })
                    continue // Skip this tenant but continue with others
                }

                // Update organization connection status
                if (organizationId) {
                    await supabase
                        .from('organizations')
                        .update({
                            xero_connected: true,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', organizationId)
                }
            } catch (tenantError: unknown) {
                const tenantMessage = tenantError instanceof Error ? tenantError.message : String(tenantError)
                console.error('Tenant processing error:', {
                    tenantId: tenant.tenantId,
                    tenantName: tenant.tenantName,
                    error: tenantMessage,
                    timestamp: new Date().toISOString(),
                    step: 'tenant_processing'
                })
                
                failedTenants.push({
                    name: tenant.tenantName,
                    reason: `Processing error: ${tenantMessage}`
                })
            }
        }

        // Check for partial failures
        if (failedTenants.length > 0 && failedTenants.length === tenants.length) {
            // ALL tenants failed
            return buildErrorResponse(request, 'Failed to connect any organizations', 500, {
                step: 'all_tenants_failed',
                failedTenants,
                count: failedTenants.length
            })
        }

        // SUCCESS (full or partial)! Redirect to dashboard
        const params = new URLSearchParams()

        if (failedTenants.length === 0) {
            params.set('connected', 'true')
        } else {
            // Partial success
            params.set('connected', 'partial')
            params.set('failed', failedTenants.map(t => t.name).join(', '))
            params.set('error', `${failedTenants.length} organization(s) failed to connect`)
        }

        const response = NextResponse.redirect(`${baseUrl}/dashboard?${params}`)
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
