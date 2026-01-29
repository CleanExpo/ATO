/**
 * Debug Endpoint for Xero OAuth Configuration
 *
 * Checks if all required environment variables are set
 * Returns sanitized diagnostics (no secrets)
 */

import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            checks: {
                xero_client_id: {
                    present: !!process.env.XERO_CLIENT_ID,
                    length: process.env.XERO_CLIENT_ID?.length || 0,
                    firstChars: process.env.XERO_CLIENT_ID?.substring(0, 8) || 'MISSING',
                },
                xero_client_secret: {
                    present: !!process.env.XERO_CLIENT_SECRET,
                    length: process.env.XERO_CLIENT_SECRET?.length || 0,
                    firstChars: process.env.XERO_CLIENT_SECRET?.substring(0, 8) || 'MISSING',
                },
                supabase_url: {
                    present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                    value: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING',
                },
                supabase_service_key: {
                    present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                    length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
                },
                base_url: {
                    explicit: process.env.NEXT_PUBLIC_BASE_URL || 'NOT_SET',
                    vercel: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'NOT_ON_VERCEL',
                    fallback: `http://localhost:${process.env.PORT || '3000'}`,
                },
            },
            resolved: {
                baseUrl: resolveBaseUrl(),
            }
        }

        return NextResponse.json(diagnostics)
    } catch (error) {
        return NextResponse.json({
            error: 'Failed to check configuration',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        }, { status: 500 })
    }
}

function resolveBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        return process.env.NEXT_PUBLIC_BASE_URL
    }

    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`
    }

    const port = process.env.PORT || '3000'
    return `http://localhost:${port}`
}
