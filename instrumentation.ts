/**
 * Instrumentation Hook
 *
 * This file is called during Next.js initialization (server-side only).
 * It's used for startup validation and configuration checks.
 *
 * Requires `experimental.instrumentationHook = true` in next.config.ts
 */

export async function register() {
    // Only run on Node.js runtime (server-side)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Error tracking (e.g. Sentry) not configured. Errors are logged to console and security_events table.
        // To enable Sentry: install @sentry/nextjs, configure DSN, and call Sentry.init() here.

        const { validateConfiguration, logConfigurationStatus } = await import('@/lib/config/env')

        console.log('\n🚀 Starting ATO Application...\n')

        // Validate configuration at startup
        const validation = validateConfiguration()

        // Log configuration status
        logConfigurationStatus()

        // In production, fail fast if configuration is invalid
        if (!validation.valid && process.env.NODE_ENV === 'production') {
            console.error('\n❌ FATAL: Invalid configuration detected in production')
            console.error('The application cannot start with missing or invalid environment variables.\n')
            console.error('Errors:')
            validation.errors.forEach(error => console.error(`  - ${error}`))
            console.error('\nPlease fix these issues in your Vercel dashboard and redeploy.\n')

            // In production, we want to fail the build/startup
            process.exit(1)
        }

        if (validation.warnings.length > 0) {
            console.warn('\n⚠️  Configuration warnings detected:')
            validation.warnings.forEach(warning => console.warn(`  - ${warning}`))
            console.warn('')
        }

        if (validation.valid) {
            console.log('✅ Configuration validated successfully\n')
        }
    }
}
