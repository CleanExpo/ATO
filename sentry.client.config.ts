/**
 * Sentry Client-Side Configuration
 *
 * Error tracking and performance monitoring for browser environment
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  // Sentry DSN from environment variable
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Sample rate for performance monitoring (10% of transactions)
  tracesSampleRate: 0.1,

  // Sample rate for error tracking (100% of errors)
  sampleRate: 1.0,

  // Don't send errors in development
  beforeSend(event, hint) {
    // Filter out development errors
    if (process.env.NODE_ENV !== 'production') {
      return null
    }
    return event
  },

  // Integrations
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Privacy settings for session replay
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Session replay sampling (10% of sessions)
  replaysSessionSampleRate: 0.1,

  // Replay all sessions with errors
  replaysOnErrorSampleRate: 1.0,

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Random plugins/extensions
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    // Network errors (handled separately)
    'NetworkError',
    'Failed to fetch',
    // ResizeObserver loop errors (benign)
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
  ],
})
