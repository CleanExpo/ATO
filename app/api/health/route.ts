/**
 * GET /api/health
 *
 * Lightweight health check endpoint for uptime monitors.
 * No authentication required. Returns basic status, version, and uptime.
 * Checks Supabase connectivity with a simple query.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { rateLimit, createRateLimitResponse } from '@/lib/middleware/rate-limit'

export const dynamic = 'force-dynamic'

// Read version once at module load time
const APP_VERSION = process.env.npm_package_version || '0.1.0'

/**
 * Extract client IP using rightmost X-Forwarded-For (B-5 pattern)
 */
function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim())
    return ips[ips.length - 1] || 'unknown'
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function GET(request: NextRequest) {
  // Rate limit: 60 requests/minute per IP
  const ip = getClientIp(request)
  const rateLimitResult = rateLimit({
    identifier: `health:${ip}`,
    limit: 60,
    windowSeconds: 60,
  })

  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  const timestamp = new Date().toISOString()

  // Check Supabase connectivity with a simple query
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.rpc('version' as never)

    // If the RPC doesn't exist, try a simple FROM query as fallback
    if (error) {
      // Attempt a lightweight query instead
      const { error: fallbackError } = await supabase
        .from('xero_connections')
        .select('tenant_id')
        .limit(1)

      if (fallbackError) {
        return NextResponse.json(
          {
            status: 'degraded',
            error: 'Database unreachable',
            timestamp,
            version: APP_VERSION,
            uptime: process.uptime(),
          },
          { status: 200 }
        )
      }
    }

    return NextResponse.json({
      status: 'ok',
      timestamp,
      version: APP_VERSION,
      uptime: process.uptime(),
    })
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        error: 'Database unreachable',
        timestamp,
        version: APP_VERSION,
        uptime: process.uptime(),
      },
      { status: 200 }
    )
  }
}
