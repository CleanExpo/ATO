import { NextRequest, NextResponse } from 'next/server'

// Comprehensive Xero diagnostic endpoint
export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const clientId = process.env.XERO_CLIENT_ID
    const clientSecretLength = process.env.XERO_CLIENT_SECRET?.length || 0
    const baseUrl = request.nextUrl.origin

    // Build the exact redirect URI the app is using
    const redirectUri = `${baseUrl}/api/auth/xero/callback`

    // Build the exact authorization URL the app will redirect to
    const scopes = [
        'offline_access',
        'openid',
        'profile',
        'email',
        'accounting.settings.read',
        'accounting.transactions.read',
        'accounting.reports.read',
        'accounting.contacts.read',
    ].join(' ')

    const authUrl = new URL('https://login.xero.com/identity/connect/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId || '')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('state', 'diagnostic-test')

    return NextResponse.json({
        status: 'DIAGNOSTIC REPORT',
        timestamp: new Date().toISOString(),

        credentials: {
            clientId: clientId,
            clientIdLength: clientId?.length,
            clientSecretConfigured: clientSecretLength > 0,
            clientSecretLength: clientSecretLength,
        },

        redirectUri: {
            configured: redirectUri,
            message: 'THIS EXACT URI must be in your Xero app Redirect URIs list'
        },

        authorizationUrl: authUrl.toString(),

        checklist: [
            `1. Go to Xero Developer Portal`,
            `2. Open the app with Client ID: ${clientId}`,
            `3. In Redirect URIs, ensure this EXACT string exists:`,
            `   ${redirectUri}`,
            `4. The URI must be EXACTLY the same - no trailing slash, no missing /callback`,
            `5. Click Save in Xero if you made changes`,
            `6. Then try connecting again`,
        ]
    }, { status: 200 })
}
