import { NextResponse } from 'next/server'
import { validateConfiguration } from '@/lib/config/env'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: string
    checks: {
        environment: {
            status: 'pass' | 'fail'
            errors?: string[]
            warnings?: string[]
        }
        database: {
            status: 'pass' | 'fail'
            message?: string
        }
    }
    version?: string
}

/**
 * GET /api/health - Health check endpoint
 *
 * Returns the health status of the application including:
 * - Environment variable validation
 * - Database connectivity
 * - Overall system status
 */
export async function GET() {
    const result: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
            environment: {
                status: 'pass',
            },
            database: {
                status: 'pass',
            },
        },
    }

    // Check environment configuration
    try {
        const envValidation = validateConfiguration()

        if (!envValidation.valid) {
            result.checks.environment.status = 'fail'
            result.checks.environment.errors = envValidation.errors
            result.status = 'unhealthy'
        } else if (envValidation.warnings.length > 0) {
            result.checks.environment.warnings = envValidation.warnings
            result.status = 'degraded'
        }
    } catch (error) {
        result.checks.environment.status = 'fail'
        result.checks.environment.errors = [
            error instanceof Error ? error.message : 'Environment validation failed'
        ]
        result.status = 'unhealthy'
    }

    // Check database connectivity
    try {
        const supabase = await createServiceClient()
        const { error } = await supabase
            .from('xero_connections')
            .select('tenant_id')
            .limit(1)

        if (error) {
            result.checks.database.status = 'fail'
            result.checks.database.message = 'Database query failed'
            result.status = 'unhealthy'
        } else {
            result.checks.database.message = 'Connected'
        }
    } catch (error) {
        result.checks.database.status = 'fail'
        result.checks.database.message = error instanceof Error ? error.message : 'Unknown error'
        result.status = 'unhealthy'
    }

    // Set appropriate status code
    const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503

    return NextResponse.json(result, { status: statusCode })
}
