/**
 * Sentry Error Tracking Integration
 *
 * Centralizes error reporting to Sentry for production monitoring
 * - Automatically captures errors and exceptions
 * - Includes user context and metadata
 * - Only active when SENTRY_DSN is configured
 */

/**
 * Initialize Sentry (call this in app initialization)
 *
 * To activate Sentry error tracking:
 * 1. Install @sentry/nextjs:
 *    npm install @sentry/nextjs
 *
 * 2. Set environment variables:
 *    NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
 *    SENTRY_AUTH_TOKEN=your_auth_token (optional, for source maps)
 *
 * 3. Sentry will automatically initialize and capture errors
 */

/**
 * Report error to Sentry
 *
 * @param error - Error object to report
 * @param context - Additional context about the error
 */
export function reportError(
  error: Error,
  context?: {
    user?: { id: string; email?: string };
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  // Only report errors in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', error);
    if (context) {
      console.error('[ERROR CONTEXT]', context);
    }
    return;
  }

  // Check if Sentry is configured
  const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!sentryDSN) {
    console.warn('[SENTRY] NEXT_PUBLIC_SENTRY_DSN not configured. Error not reported to Sentry.');
    console.error('[ERROR]', error);
    return;
  }

  try {
    // Dynamic import to avoid errors if @sentry/nextjs is not installed
    // @ts-ignore - Package may not be installed
    import('@sentry/nextjs').then((Sentry) => {
      // Set user context if provided
      if (context?.user) {
        Sentry.setUser({
          id: context.user.id,
          email: context.user.email,
        });
      }

      // Set tags if provided
      if (context?.tags) {
        Sentry.setTags(context.tags);
      }

      // Set extra context if provided
      if (context?.extra) {
        Sentry.setExtras(context.extra);
      }

      // Capture the error
      Sentry.captureException(error);

      console.log('[SENTRY] Error reported:', error.message);
    }).catch((importError) => {
      console.error('[SENTRY] Failed to import Sentry. Install @sentry/nextjs:', importError);
      console.error('[ERROR]', error);
    });
  } catch (err) {
    console.error('[SENTRY] Error reporting to Sentry:', err);
    console.error('[ORIGINAL ERROR]', error);
  }
}

/**
 * Report message to Sentry
 *
 * @param message - Message to report
 * @param level - Severity level (info, warning, error)
 * @param context - Additional context
 */
export function reportMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: {
    user?: { id: string; email?: string };
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  // Only report in production
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${level.toUpperCase()}]`, message);
    return;
  }

  const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!sentryDSN) {
    return;
  }

  try {
    // @ts-ignore - Package may not be installed
    import('@sentry/nextjs').then((Sentry) => {
      if (context?.user) {
        Sentry.setUser({
          id: context.user.id,
          email: context.user.email,
        });
      }

      if (context?.tags) {
        Sentry.setTags(context.tags);
      }

      if (context?.extra) {
        Sentry.setExtras(context.extra);
      }

      Sentry.captureMessage(message, level);
    }).catch((importError) => {
      console.error('[SENTRY] Failed to import Sentry:', importError);
    });
  } catch (err) {
    console.error('[SENTRY] Error reporting message:', err);
  }
}

/**
 * Check if Sentry is configured and available
 *
 * @returns True if Sentry is configured
 */
export function isSentryConfigured(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    !!process.env.NEXT_PUBLIC_SENTRY_DSN
  );
}
