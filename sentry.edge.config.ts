/**
 * Sentry Edge Runtime Configuration
 *
 * Error tracking for Edge Runtime (middleware, edge functions)
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  // Sentry DSN from environment variable
  dsn: process.env.SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Lower sample rate for edge (high volume)
  tracesSampleRate: 0.05,

  // Sample rate for error tracking
  sampleRate: 1.0,

  // Don't send errors in development
  beforeSend(event) {
    if (process.env.NODE_ENV !== 'production') {
      return null
    }
    return event
  },

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,
})
