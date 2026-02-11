/**
 * Rate Limiter with Exponential Backoff
 *
 * Handles API rate limits for AI providers (Gemini, OpenRouter, etc.)
 * Implements retry logic with exponential backoff and jitter
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('ai:rate-limiter')

export interface RetryConfig {
    maxAttempts: number
    initialDelayMs: number
    maxDelayMs: number
    backoffMultiplier: number
    jitter: boolean
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitter: true,
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase()
        return (
            message.includes('rate limit') ||
            message.includes('rate_limit') ||
            message.includes('too many requests') ||
            message.includes('429') ||
            message.includes('quota exceeded') ||
            message.includes('resource exhausted') ||
            message.includes('limit resets')
        )
    }
    return false
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: initialDelay * (multiplier ^ attempt)
    let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1)
    
    // Cap at max delay
    delay = Math.min(delay, config.maxDelayMs)
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
        const jitter = Math.random() * 0.3 * delay // ±30% jitter
        delay = delay + jitter - (0.15 * delay) // Center around the delay
    }
    
    return Math.round(delay)
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic for rate limits
 */
export async function withRateLimitRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
    
    for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
        try {
            return await operation()
        } catch (error) {
            const isRateLimit = isRateLimitError(error)
            
            if (!isRateLimit || attempt === fullConfig.maxAttempts) {
                // Not a rate limit error or last attempt - throw
                if (isRateLimit) {
                    log.error(`Rate limit persisted after ${fullConfig.maxAttempts} attempts for ${operationName}`, {
                        operationName,
                        attempts: attempt,
                        error: error instanceof Error ? error.message : String(error)
                    })
                }
                throw error
            }
            
            // Calculate delay and wait
            const delay = calculateDelay(attempt, fullConfig)
            
            log.warn(`Rate limit hit for ${operationName}, retrying in ${delay}ms (attempt ${attempt}/${fullConfig.maxAttempts})`, {
                operationName,
                attempt,
                maxAttempts: fullConfig.maxAttempts,
                delayMs: delay
            })
            
            await sleep(delay)
        }
    }
    
    // Should never reach here
    throw new Error(`Unexpected exit from retry loop for ${operationName}`)
}

/**
 * Rate limit status tracking for queue-based systems
 */
export class RateLimitTracker {
    private limits = new Map<string, { resetAt: number; remaining: number }>()
    
    /**
     * Record a rate limit response from an API
     */
    recordLimit(provider: string, resetAt: number, remaining: number): void {
        this.limits.set(provider, { resetAt, remaining })
        
        log.info(`Rate limit recorded for ${provider}`, {
            provider,
            resetAt: new Date(resetAt).toISOString(),
            remaining
        })
    }
    
    /**
     * Check if we should wait before making a request to a provider
     */
    shouldWait(provider: string): { shouldWait: boolean; waitMs: number } {
        const limit = this.limits.get(provider)
        
        if (!limit) {
            return { shouldWait: false, waitMs: 0 }
        }
        
        const now = Date.now()
        
        if (limit.remaining > 0) {
            return { shouldWait: false, waitMs: 0 }
        }
        
        if (now >= limit.resetAt) {
            // Reset time has passed, clear the limit
            this.limits.delete(provider)
            return { shouldWait: false, waitMs: 0 }
        }
        
        const waitMs = limit.resetAt - now
        return { shouldWait: true, waitMs }
    }
    
    /**
     * Wait if necessary before making a request
     */
    async waitIfNeeded(provider: string): Promise<void> {
        const { shouldWait, waitMs } = this.shouldWait(provider)
        
        if (shouldWait) {
            log.info(`Waiting ${waitMs}ms for ${provider} rate limit reset`, {
                provider,
                waitMs
            })
            await sleep(waitMs + 100) // Add 100ms buffer
        }
    }
}

// Global rate limit tracker instance
export const rateLimitTracker = new RateLimitTracker()
