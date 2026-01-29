import { NextResponse } from 'next/server'

// Simplified Xero auth initiation using SAME redirect URI as main app
export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const clientId = process.env.XERO_CLIENT_ID!
    const redirectUri = 'http://localhost:3000/api/auth/xero/callback' // Same as main app
    const scope = 'openid profile email accounting.settings.read accounting.transactions.read accounting.reports.read accounting.contacts.read accounting.attachments files offline_access'

    const authUrl = new URL('https://login.xero.com/identity/connect/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('state', 'test123')

    return NextResponse.redirect(authUrl.toString())
}
