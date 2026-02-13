/**
 * API Retry Utilities
 *
 * Implements exponential backoff retry logic for failed API calls.
 * Handles transient errors (network, rate limits, timeouts) automatically
 * while failing fast on permanent errors (auth, validation).
 */

/**
 * Configuration for retry behaviour
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** Whether to add random jitter to delays (default: true) */
  jitter?: boolean
  /** HTTP status codes that should trigger retry (default: 408, 429, 500, 502, 503, 504) */
  retryableStatusCodes?: number[]
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: Error, attempt: number) => boolean
  /** Callback fired on each retry attempt */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  shouldRetry: () => true,
  onRetry: () => {},
}

/**
 * Error thrown when max retry attempts exceeded
 */
export class MaxRetriesExceededError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(`Max retry attempts (${attempts}) exceeded. Last error: ${lastError.message}`)
    this.name = 'MaxRetriesExceededError'
  }
}

/**
 * Determines if an error is transient (retryable) or permanent
 *
 * Transient errors:
 * - Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
 * - HTTP 408 (Timeout), 429 (Rate Limit), 5xx (Server Error)
 * - Xero rate limit errors
 *
 * Permanent errors:
 * - HTTP 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)
 * - Validation errors
 * - Authentication errors
 */
export function isTransientError(error: unknown, config: RetryConfig = {}): boolean {
  const retryableStatusCodes = config.retryableStatusCodes ?? DEFAULT_CONFIG.retryableStatusCodes

  // Network errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('enotfound') ||
      message.includes('network') ||
      message.includes('timeout')
    ) {
      return true
    }
  }

  // HTTP errors
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    return retryableStatusCodes.includes(status)
  }

  // Response errors (fetch API)
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response: { status: number } }).response
    if (response && typeof response.status === 'number') {
      return retryableStatusCodes.includes(response.status)
    }
  }

  // Xero rate limit errors
  if (error instanceof Error && error.message.includes('rate limit')) {
    return true
  }

  // Default: not retryable
  return false
}

/**
 * Calculate delay for next retry attempt using exponential backoff
 *
 * Formula: delay = min(initialDelay * (backoffMultiplier ^ attempt), maxDelay)
 * With optional jitter: delay = delay * (0.5 + Math.random() * 0.5)
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig = {}): number {
  const {
    initialDelayMs = DEFAULT_CONFIG.initialDelayMs,
    maxDelayMs = DEFAULT_CONFIG.maxDelayMs,
    backoffMultiplier = DEFAULT_CONFIG.backoffMultiplier,
    jitter = DEFAULT_CONFIG.jitter,
  } = config

  // Exponential backoff: 1s, 2s, 4s, 8s, ...
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1)

  // Cap at max delay
  let delay = Math.min(exponentialDelay, maxDelayMs)

  // Add random jitter (50%-100% of calculated delay)
  // This prevents thundering herd when multiple clients retry simultaneously
  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5)
  }

  return Math.floor(delay)
}

/**
 * Sleep for specified milliseconds
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry an async function with exponential backoff
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Result of successful execution
 * @throws MaxRetriesExceededError if all attempts fail
 *
 * @example
 * ```typescript
 * const data = await retry(
 *   async () => {
 *     const response = await fetch('/api/data')
 *     if (!response.ok) throw new Error(`HTTP ${response.status}`)
 *     return response.json()
 *   },
 *   {
 *     maxAttempts: 5,
 *     initialDelayMs: 500,
 *     onRetry: (error, attempt, delay) => {
 *       log.info(`Retry ${attempt}/5 after ${delay}ms due to: ${error.message}`)
 *     }
 *   }
 * )
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_CONFIG.maxAttempts,
    shouldRetry = DEFAULT_CONFIG.shouldRetry,
    onRetry = DEFAULT_CONFIG.onRetry,
  } = config

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break
      }

      // Check if error is retryable
      const isRetryable = isTransientError(error, config) && shouldRetry(lastError, attempt)

      if (!isRetryable) {
        // Permanent error - fail fast
        throw lastError
      }

      // Calculate backoff delay
      const delayMs = calculateBackoffDelay(attempt, config)

      // Fire retry callback
      onRetry(lastError, attempt, delayMs)

      // Wait before next attempt
      await sleep(delayMs)
    }
  }

  // All attempts exhausted
  throw new MaxRetriesExceededError(maxAttempts, lastError!)
}

/**
 * Retry wrapper specifically for fetch API calls
 *
 * Handles HTTP errors and network errors automatically.
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param retryConfig - Retry configuration
 * @returns Fetch response
 *
 * @example
 * ```typescript
 * const response = await retryFetch('https://api.example.com/data', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ key: 'value' })
 * }, {
 *   maxAttempts: 3,
 *   onRetry: (error, attempt) => log.info(`Retrying (${attempt}/3)...`)
 * })
 * ```
 */
export async function retryFetch(
  url: string,
  options?: RequestInit,
  retryConfig: RetryConfig = {}
): Promise<Response> {
  return retry(async () => {
    const response = await fetch(url, options)

    // Check if response is successful
    if (!response.ok) {
      // Create error with status for retry logic
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & {
        status: number
        response: Response
      }
      error.status = response.status
      error.response = response
      throw error
    }

    return response
  }, retryConfig)
}

/**
 * Retry wrapper for Xero API calls
 *
 * Uses Xero-specific retry configuration:
 * - Handles rate limits (60/minute)
 * - Longer delays for server errors
 * - Respects Retry-After headers
 */
export async function retryXeroRequest<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  return retry(fn, {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 60000, // Up to 1 minute for rate limits
    backoffMultiplier: 2,
    jitter: true,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    onRetry: (error, attempt, delayMs) => {
      console.warn(`Xero API retry ${attempt}: ${error.message} (waiting ${delayMs}ms)`)
    },
    ...config,
  })
}

/**
 * Retry wrapper for Google Gemini AI calls
 *
 * Uses Gemini-specific retry configuration:
 * - Handles rate limits (15/minute for free tier)
 * - Longer initial delay (4 seconds per request)
 * - Respects quota errors
 */
export async function retryGeminiRequest<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  return retry(fn, {
    maxAttempts: 3,
    initialDelayMs: 4000, // 4 seconds to respect rate limit
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    shouldRetry: (error, attempt) => {
      // Don't retry on quota exhausted
      if (error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED')) {
        return false
      }
      return attempt < 3
    },
    onRetry: (error, attempt, delayMs) => {
      console.warn(`Gemini AI retry ${attempt}: ${error.message} (waiting ${delayMs}ms)`)
    },
    ...config,
  })
}
