/**
 * AI Configuration Health Check
 *
 * Validates that AI configuration is correct before accepting analysis jobs.
 * Prevents silent failures due to invalid model names or API keys.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { optionalConfig } from '@/lib/config/env'

export interface HealthCheckResult {
    valid: boolean
    errors: string[]
    warnings: string[]
    details: {
        apiKeyConfigured: boolean
        modelName: string
        modelAccessible: boolean
        testResponseReceived: boolean
    }
}

/**
 * Validates that AI configuration is correct
 */
export async function validateAIConfiguration(): Promise<HealthCheckResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const details = {
        apiKeyConfigured: false,
        modelName: 'gemini-2.0-flash-exp',
        modelAccessible: false,
        testResponseReceived: false
    }

    // Check if API key exists
    if (!optionalConfig.googleAiApiKey) {
        errors.push('GOOGLE_AI_API_KEY environment variable not set')
        return { valid: false, errors, warnings, details }
    }

    details.apiKeyConfigured = true

    // Check if model is accessible
    try {
        const genAI = new GoogleGenerativeAI(optionalConfig.googleAiApiKey)
        const model = genAI.getGenerativeModel({ model: details.modelName })

        // Try a minimal test request
        const result = await model.generateContent('test')
        const response = await result.response
        const text = response.text()

        if (text && text.length > 0) {
            details.modelAccessible = true
            details.testResponseReceived = true
        } else {
            errors.push(`Model ${details.modelName} returned empty response`)
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            errors.push(`AI model '${details.modelName}' does not exist or is not accessible`)
            errors.push('Available free models: gemini-2.0-flash-exp (experimental)')
            errors.push('Gemini 3 models require Vertex AI (paid)')
        } else if (errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('403')) {
            errors.push('GOOGLE_AI_API_KEY is invalid or lacks permissions')
        } else {
            errors.push(`Failed to access model: ${errorMessage}`)
        }
    }

    // Check cost budget configuration
    if (!process.env.MAX_AI_COST_USD) {
        warnings.push('MAX_AI_COST_USD not set - no spending limit configured')
    }

    // Check Supabase configuration (needed to store results)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        warnings.push('Supabase not configured - analysis results cannot be stored')
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        details
    }
}

/**
 * Quick health check (doesn't make API call, just checks config)
 */
export function quickHealthCheck(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!optionalConfig.googleAiApiKey) {
        errors.push('GOOGLE_AI_API_KEY not configured')
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        errors.push('NEXT_PUBLIC_SUPABASE_URL not configured')
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        errors.push('SUPABASE_SERVICE_ROLE_KEY not configured')
    }

    return {
        valid: errors.length === 0,
        errors
    }
}

/**
 * Get model information
 */
export function getModelInfo() {
    return {
        model: 'gemini-2.0-flash-exp',
        provider: 'Google AI (Free API)',
        description: 'Gemini 2.0 Flash Experimental - Fast, FREE during preview period',
        pricing: 'FREE (experimental period)',
        limitations: [
            'Experimental model - may change without notice',
            'Not suitable for production workloads requiring stability',
            'Rate limited to 60 requests/minute',
            'For stable production use, consider Vertex AI'
        ],
        alternatives: {
            vertexAI: {
                models: ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
                note: 'Requires Google Cloud account and Vertex AI setup',
                pricing: 'Paid per token'
            }
        }
    }
}
