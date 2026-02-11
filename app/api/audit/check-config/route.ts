/**
 * GET /api/audit/check-config
 *
 * Diagnostic endpoint to check if AI configuration is properly set up.
 */

import { NextRequest, NextResponse } from 'next/server'
import { optionalConfig } from '@/lib/config/env'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
    const auth = await requireAuth(request, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth

    const hasGoogleAiKey = Boolean(optionalConfig.googleAiApiKey)
    const keyLength = optionalConfig.googleAiApiKey?.length || 0
    const keyPrefix = optionalConfig.googleAiApiKey?.substring(0, 8) || 'NOT_SET'

    return NextResponse.json({
        aiConfigured: hasGoogleAiKey,
        keyLength,
        keyPrefix: hasGoogleAiKey ? `${keyPrefix}...` : 'NOT_SET',
        message: hasGoogleAiKey
            ? 'Google AI API key is configured'
            : 'GOOGLE_AI_API_KEY is not set. Please add it to Vercel environment variables and redeploy.'
    })
}
