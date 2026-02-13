/**
 * Type-Safe API Client
 *
 * Provides a fetch wrapper with:
 * - Automatic timeout protection
 * - Retry logic for network failures
 * - Type-safe responses
 * - Consistent error handling
 * - Request/response logging in development
 */

import type { ApiErrorResponse } from './errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:client')

export class ApiRequestError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly errorId?: string,
        public readonly context?: Record<string, unknown>
    ) {
        super(message)
        this.name = 'ApiRequestError'
    }
}

export interface ApiRequestOptions extends RequestInit {
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number
    /** Number of retry attempts for network failures (default: 2) */
    retries?: number
    /** Base delay between retries in milliseconds (default: 1000) */
    retryDelay?: number
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wrap fetch with timeout
 */
async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        })
        return response
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs}ms`)
        }
        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}

/**
 * Check if an error should trigger a retry
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase()
        return (
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('fetch failed') ||
            message.includes('econnrefused')
        )
    }
    return false
}

/**
 * Type-safe API request wrapper
 *
 * @param url - API endpoint URL (relative or absolute)
 * @param options - Fetch options with additional timeout and retry config
 * @returns Parsed JSON response
 * @throws ApiRequestError if request fails
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string
 *   name: string
 * }
 *
 * try {
 *   const user = await apiRequest<User>('/api/user/123')
 *   log.info(user.name)
 * } catch (error) {
 *   if (error instanceof ApiRequestError) {
 *     log.error(`API error (${error.status}): ${error.message}`)
 *     log.error(`Error ID: ${error.errorId}`)
 *   }
 * }
 * ```
 */
export async function apiRequest<T = unknown>(
    url: string,
    options: ApiRequestOptions = {}
): Promise<T> {
    const {
        timeout = 30000,
        retries = 2,
        retryDelay = 1000,
        ...fetchOptions
    } = options

    const isDevelopment = process.env.NODE_ENV === 'development'
    let lastError: unknown

    // Add default headers
    const headers = new Headers(fetchOptions.headers)
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }

    const requestOptions: RequestInit = {
        ...fetchOptions,
        headers,
    }

    // Log request in development
    if (isDevelopment) {
        log.debug('API request', { method: fetchOptions.method || 'GET', url })
    }

    // Retry loop
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, requestOptions, timeout)

            // Log response in development
            if (isDevelopment) {
                log.debug('API response', { url, status: response.status })
            }

            // Handle error responses
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as Partial<ApiErrorResponse>

                throw new ApiRequestError(
                    errorData.error || `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    errorData.errorId,
                    errorData.context
                )
            }

            // Parse and return successful response
            const data = await response.json()
            return data as T

        } catch (error) {
            lastError = error

            // Don't retry if it's not a retryable error or if it's the last attempt
            if (!isRetryableError(error) || attempt === retries) {
                break
            }

            // Calculate backoff delay with jitter
            const backoff = retryDelay * Math.pow(2, attempt)
            const jitter = Math.random() * 0.1 * backoff
            const delay = backoff + jitter

            if (isDevelopment) {
                console.warn(
                    `[API Retry] Attempt ${attempt + 1}/${retries} failed for ${url}. Retrying in ${Math.round(delay)}ms...`
                )
            }

            await sleep(delay)
        }
    }

    // All attempts failed
    if (lastError instanceof ApiRequestError) {
        throw lastError
    }

    if (lastError instanceof Error) {
        throw new ApiRequestError(
            lastError.message,
            0, // Unknown status
            undefined,
            { originalError: lastError.name }
        )
    }

    throw new ApiRequestError(
        'Unknown error occurred',
        0,
        undefined,
        { lastError }
    )
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
    get: <T = unknown>(url: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
        apiRequest<T>(url, { ...options, method: 'GET' }),

    post: <T = unknown>(url: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method'>) =>
        apiRequest<T>(url, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        }),

    put: <T = unknown>(url: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method'>) =>
        apiRequest<T>(url, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        }),

    delete: <T = unknown>(url: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
        apiRequest<T>(url, { ...options, method: 'DELETE' }),
}
