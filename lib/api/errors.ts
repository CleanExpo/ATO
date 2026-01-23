/**
 * Standardized API Error Handling
 *
 * Provides consistent error responses across all API routes with:
 * - Unique error IDs for debugging and log correlation
 * - Proper HTTP status codes
 * - Safe error messages (sanitized in production)
 * - Contextual information for troubleshooting
 */

import { NextResponse } from 'next/server'
import crypto from 'crypto'

export interface ApiErrorResponse {
    error: string
    errorId: string
    timestamp: string
    context?: Record<string, unknown>
}

/**
 * Generate a unique error ID for tracking and correlation
 */
function generateErrorId(): string {
    return crypto.randomBytes(8).toString('hex')
}

/**
 * Sanitize error message for production
 * Hides implementation details while keeping it helpful
 */
function sanitizeErrorMessage(message: string, isProduction: boolean): string {
    if (!isProduction) {
        return message
    }

    // Map detailed errors to user-friendly messages
    const errorMap: Record<string, string> = {
        'ECONNREFUSED': 'Service temporarily unavailable',
        'ETIMEDOUT': 'Request timed out',
        'ENOTFOUND': 'Service not found',
        'fetch failed': 'Network error occurred',
        'timeout': 'Request timed out',
        'GOOGLE_AI_API_KEY': 'AI service not configured. Please add GOOGLE_AI_API_KEY to Vercel environment variables.',
        'API key not valid': 'AI service API key is invalid. Please check GOOGLE_AI_API_KEY in Vercel.',
    }

    const lowerMessage = message.toLowerCase()
    for (const [key, userMessage] of Object.entries(errorMap)) {
        if (lowerMessage.includes(key.toLowerCase())) {
            return userMessage
        }
    }

    // Generic production message
    return 'An error occurred while processing your request'
}

/**
 * Create a standardized error response
 *
 * @param error - The error object (Error, string, or unknown)
 * @param context - Additional context for debugging
 * @param statusCode - HTTP status code (default: 500)
 * @returns NextResponse with error details
 *
 * @example
 * ```typescript
 * try {
 *   // ... some operation
 * } catch (error) {
 *   return createErrorResponse(error, { operation: 'fetchData', userId: '123' })
 * }
 * ```
 */
export function createErrorResponse(
    error: unknown,
    context?: Record<string, unknown>,
    statusCode: number = 500
): NextResponse<ApiErrorResponse> {
    const errorId = generateErrorId()
    const timestamp = new Date().toISOString()
    const isProduction = process.env.NODE_ENV === 'production'

    // Extract error message
    let message: string
    if (error instanceof Error) {
        message = error.message
    } else if (typeof error === 'string') {
        message = error
    } else {
        message = 'Unknown error occurred'
    }

    // Log full error details server-side (including stack trace)
    console.error(`[${errorId}] API Error:`, {
        message,
        stack: error instanceof Error ? error.stack : undefined,
        context,
        timestamp,
    })

    // Build response (sanitized for production)
    const response: ApiErrorResponse = {
        error: sanitizeErrorMessage(message, isProduction),
        errorId,
        timestamp,
    }

    // Include context only in development
    if (!isProduction && context) {
        response.context = context
    }

    return NextResponse.json(response, { status: statusCode })
}

/**
 * Create a validation error response (400 Bad Request)
 */
export function createValidationError(
    message: string,
    context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
    return createErrorResponse(
        new Error(message),
        { type: 'validation', ...context },
        400
    )
}

/**
 * Create an authentication error response (401 Unauthorized)
 */
export function createAuthError(
    message: string = 'Authentication required',
    context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
    return createErrorResponse(
        new Error(message),
        { type: 'authentication', ...context },
        401
    )
}

/**
 * Create a not found error response (404 Not Found)
 */
export function createNotFoundError(
    resource: string,
    context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
    return createErrorResponse(
        new Error(`${resource} not found`),
        { type: 'not_found', resource, ...context },
        404
    )
}

/**
 * Create a rate limit error response (429 Too Many Requests)
 */
export function createRateLimitError(
    retryAfter?: number,
    context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
    const response = createErrorResponse(
        new Error('Too many requests'),
        { type: 'rate_limit', retryAfter, ...context },
        429
    )

    if (retryAfter) {
        response.headers.set('Retry-After', retryAfter.toString())
    }

    return response
}

/**
 * Create a service unavailable error response (503 Service Unavailable)
 */
export function createServiceUnavailableError(
    service: string,
    context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
    return createErrorResponse(
        new Error(`${service} service unavailable`),
        { type: 'service_unavailable', service, ...context },
        503
    )
}
