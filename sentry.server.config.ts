/**
 * Sentry Server-Side Configuration
 *
 * Error tracking and performance monitoring for Node.js server environment
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  // Sentry DSN from environment variable
  dsn: process.env.SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Sample rate for performance monitoring (20% of transactions on server)
  tracesSampleRate: 0.2,

  // Sample rate for error tracking (100% of errors)
  sampleRate: 1.0,

  // Don't send errors in development
  beforeSend(event, hint) {
    // Filter out development errors
    if (process.env.NODE_ENV !== 'production') {
      return null
    }

    // Sanitize sensitive data
    if (event.request) {
      // Remove authorization headers
      if (event.request.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }

      // Remove sensitive query parameters
      if (event.request.query_string) {
        const params = new URLSearchParams(event.request.query_string)
        params.delete('api_key')
        params.delete('token')
        params.delete('secret')
        event.request.query_string = params.toString()
      }
    }

    return event
  },

  // Integrations
  integrations: [
    // Automatic instrumentation
    ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
  ],

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Server-specific configuration
  maxBreadcrumbs: 50,
  attachStacktrace: true,

  // Ignore specific errors
  ignoreErrors: [
    // Database connection errors (handled separately)
    'ECONNREFUSED',
    'ENOTFOUND',
    // Supabase auth errors (expected)
    'AuthApiError',
    'AuthRetryableFetchError',
  ],
})
