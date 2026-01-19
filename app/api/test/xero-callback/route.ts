import { NextRequest, NextResponse } from 'next/server'

// Simplified Xero callback that uses direct API calls instead of SDK
export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
        return NextResponse.json({ error, description: searchParams.get('error_description') })
    }

    if (!code) {
        return NextResponse.json({ error: 'No code received' })
    }

    // Direct token exchange using fetch
    const clientId = process.env.XERO_CLIENT_ID!
    const clientSecret = process.env.XERO_CLIENT_SECRET!
    const redirectUri = 'http://localhost:3000/api/test/xero-callback'

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    try {
        const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
            }).toString(),
        })

        const tokenData = await tokenResponse.json()

        if (!tokenResponse.ok) {
            return NextResponse.json({
                error: 'Token exchange failed',
                status: tokenResponse.status,
                details: tokenData
            })
        }

        return NextResponse.json({
            success: true,
            message: 'Token exchange successful!',
            tokenData: {
                access_token: tokenData.access_token?.substring(0, 50) + '...',
                refresh_token: tokenData.refresh_token?.substring(0, 20) + '...',
                expires_in: tokenData.expires_in,
                token_type: tokenData.token_type
            }
        })
    } catch (err: unknown) {
        return NextResponse.json({
            error: 'Fetch failed',
            message: err instanceof Error ? err.message : String(err)
        })
    }
}
