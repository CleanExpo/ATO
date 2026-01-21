/**
 * Tax Rates Cache Statistics API
 *
 * GET - Get cache statistics (age, expiry, etc.)
 */

import { NextResponse } from 'next/server'
import { getCacheManager } from '@/lib/tax-data/cache-manager'

export async function GET(request: Request) {
  try {
    const cacheManager = getCacheManager()
    const stats = await cacheManager.getCacheStats()

    return NextResponse.json({
      success: true,
      data: {
        hasCachedData: stats.hasCachedData,
        cacheAge: stats.cacheAge,
        cacheAgeMinutes: stats.cacheAge ? Math.round(stats.cacheAge / 1000 / 60) : null,
        cacheAgeHours: stats.cacheAge ? Math.round(stats.cacheAge / 1000 / 60 / 60) : null,
        expiresIn: stats.expiresIn,
        expiresInMinutes: stats.expiresIn ? Math.round(stats.expiresIn / 1000 / 60) : null,
        expiresInHours: stats.expiresIn ? Math.round(stats.expiresIn / 1000 / 60 / 60) : null,
        isExpired: stats.expiresIn === 0,
      },
    })
  } catch (error: any) {
    console.error('Failed to get cache stats:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get cache statistics',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
