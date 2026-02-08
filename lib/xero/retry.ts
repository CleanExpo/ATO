/**
 * Retry Logic with Exponential Backoff
 *
 * Provides resilient API call handling with:
 * - Configurable retry attempts
 * - Exponential backoff between retries
 * - Timeout protection
 * - Detailed error logging
 */

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export interface RetryOptions {
  /** Maximum number of attempts (including the initial attempt) */
  maxAttempts?: number;
  /** Timeout in milliseconds for each attempt */
  timeoutMs?: number;
  /** Initial backoff delay in milliseconds */
  initialBackoffMs?: number;
  /** Maximum backoff delay in milliseconds */
  maxBackoffMs?: number;
  /** Callback invoked before each retry */
  onRetry?: (attempt: number, error: unknown) => void;
  /** Function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  timeoutMs: 30000, // 30 seconds
  initialBackoffMs: 1000, // 1 second
  maxBackoffMs: 10000, // 10 seconds
  onRetry: () => {},
  isRetryable: () => true,
};

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, initialMs: number, maxMs: number): number {
  const exponentialDelay = initialMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
  return Math.min(exponentialDelay + jitter, maxMs);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Check if an error is a network error that should be retried
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('fetch failed')
    );
  }
  return false;
}

/**
 * Check if an HTTP response status code is retryable
 */
function isRetryableStatusCode(status: number): boolean {
  // Retry on:
  // - 408: Request Timeout
  // - 429: Too Many Requests (rate limiting)
  // - 500: Internal Server Error
  // - 502: Bad Gateway
  // - 503: Service Unavailable
  // - 504: Gateway Timeout
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the function result
 * @throws RetryError if all attempts fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error('API error');
 *     return response.json();
 *   },
 *   {
 *     maxAttempts: 3,
 *     timeoutMs: 5000,
 *     onRetry: (attempt, error) => {
 *       log.info(`Retry attempt ${attempt}:`, error);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Execute with timeout
      const result = await withTimeout(fn(), opts.timeoutMs);
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isLastAttempt = attempt === opts.maxAttempts;
      const shouldRetry = opts.isRetryable(error) || isNetworkError(error);

      if (isLastAttempt || !shouldRetry) {
        // No more retries or error is not retryable
        break;
      }

      // Log retry attempt
      opts.onRetry(attempt, error);

      // Calculate backoff and wait
      const backoffMs = calculateBackoff(attempt, opts.initialBackoffMs, opts.maxBackoffMs);
      await sleep(backoffMs);
    }
  }

  // All attempts failed
  throw new RetryError(
    `Operation failed after ${opts.maxAttempts} attempts`,
    opts.maxAttempts,
    lastError
  );
}

/**
 * Specialized retry for fetch requests with HTTP status checking
 */
export async function withFetchRetry(
  fn: () => Promise<Response>,
  options: RetryOptions = {}
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fn();

      // Check if status code is retryable
      if (!response.ok && isRetryableStatusCode(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    },
    {
      ...options,
      isRetryable: (error) => {
        // Check if it's a network error or has a retryable status code
        if (isNetworkError(error)) return true;
        if (error instanceof Error && error.message.includes('HTTP')) {
          const statusMatch = error.message.match(/HTTP (\d+)/);
          if (statusMatch) {
            const status = parseInt(statusMatch[1], 10);
            return isRetryableStatusCode(status);
          }
        }
        return options.isRetryable ? options.isRetryable(error) : false;
      },
    }
  );
}
