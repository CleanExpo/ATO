/**
 * GET /api/audit/list-models
 *
 * List available Google AI models for debugging.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { optionalConfig } from '@/lib/config/env'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth(request, { skipTenantValidation: true })
        if (isErrorResponse(auth)) return auth

        if (!optionalConfig.googleAiApiKey) {
            return NextResponse.json({
                error: 'GOOGLE_AI_API_KEY not configured'
            }, { status: 500 })
        }

        const _genAI = new GoogleGenerativeAI(optionalConfig.googleAiApiKey)

        // Try to list models using fetch directly
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${optionalConfig.googleAiApiKey}`
        )

        if (!response.ok) {
            const errorText = await response.text()
            return NextResponse.json({
                error: `Failed to list models: ${response.status} ${response.statusText}`,
                details: errorText,
                hint: response.status === 403
                    ? 'API key may not have access to Generative Language API. Enable it at https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com'
                    : response.status === 401
                    ? 'API key is invalid'
                    : 'Unknown error'
            }, { status: response.status })
        }

        const data = await response.json()
        interface GeminiModel {
            name: string;
            displayName?: string;
            supportedGenerationMethods?: string[];
        }

        const models = (data.models as GeminiModel[] | undefined)?.map((m) => ({
            name: m.name,
            displayName: m.displayName,
            supportedMethods: m.supportedGenerationMethods
        })) || []

        return NextResponse.json({
            success: true,
            modelCount: models.length,
            models: models.slice(0, 20), // First 20 models
            hint: models.length > 0
                ? `Use one of these model names: ${models.slice(0, 5).map((m) => m.name.replace('models/', '')).join(', ')}`
                : 'No models available for this API key'
        })

    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
