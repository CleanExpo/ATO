/**
 * Tax Data Cache Manager
 *
 * Caches tax rates for 24 hours to reduce API calls
 * Stores in database with TTL (time-to-live)
 */

import { createClient } from '../supabase/server'
import { getRatesFetcher, TaxRates } from './rates-fetcher'
import { createLogger } from '@/lib/logger'

const log = createLogger('tax-data:cache-manager')

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface CachedTaxRates extends TaxRates {
  cacheHit: boolean
  cacheAge?: number // milliseconds
}

export class TaxDataCacheManager {
  /**
   * Get current tax rates (from cache or fresh fetch)
   *
   * @param forceRefresh - Force refresh even if cache is valid
   * @returns Current tax rates
   */
  async getRates(forceRefresh = false): Promise<CachedTaxRates> {
    if (!forceRefresh) {
      // Try to get from cache first
      const cached = await this.getCachedRates()
      if (cached) {
        return cached
      }
    }

    // Cache miss or force refresh - fetch fresh data
    log.info('Cache miss - fetching fresh tax rates')
    return await this.fetchAndCache()
  }

  /**
   * Get rates from cache if available and not expired
   */
  private async getCachedRates(): Promise<CachedTaxRates | null> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('tax_rates_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        log.debug('No cached tax rates found')
        return null
      }

      const cacheAge = Date.now() - new Date(data.created_at).getTime()

      // Check if cache is expired
      if (cacheAge > CACHE_TTL_MS) {
        log.debug('Cache expired', { ageHours: Math.round(cacheAge / 1000 / 60 / 60) })
        return null
      }

      log.info('Using cached tax rates', { ageMinutes: Math.round(cacheAge / 1000 / 60) })

      return {
        ...data.rates,
        cacheHit: true,
        cacheAge,
      }
    } catch (error: unknown) {
      console.error('Failed to get cached rates:', error instanceof Error ? error.message : String(error))
      return null
    }
  }

  /**
   * Fetch fresh rates and cache them
   */
  private async fetchAndCache(): Promise<CachedTaxRates> {
    const fetcher = getRatesFetcher()
    const rates = await fetcher.fetchAllRates()

    // Store in database cache
    await this.cacheRates(rates)

    return {
      ...rates,
      cacheHit: false,
    }
  }

  /**
   * Store rates in database cache
   */
  private async cacheRates(rates: TaxRates): Promise<void> {
    try {
      const supabase = await createClient()

      const { error } = await supabase.from('tax_rates_cache').insert({
        rates: rates as unknown as Record<string, unknown>, // Store entire rates object as JSONB
        created_at: new Date().toISOString(),
      })

      if (error) {
        console.error('Failed to cache rates:', error.message)
      } else {
        log.info('Tax rates cached successfully')
      }
    } catch (error: unknown) {
      console.error('Error caching rates:', error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Clear all cached rates
   */
  async clearCache(): Promise<void> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('tax_rates_cache')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (error) {
        console.error('Failed to clear cache:', error.message)
      } else {
        log.info('Cache cleared')
      }
    } catch (error: unknown) {
      console.error('Error clearing cache:', error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    hasCachedData: boolean
    cacheAge?: number
    expiresIn?: number
  }> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('tax_rates_cache')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return { hasCachedData: false }
      }

      const cacheAge = Date.now() - new Date(data.created_at).getTime()
      const expiresIn = CACHE_TTL_MS - cacheAge

      return {
        hasCachedData: true,
        cacheAge,
        expiresIn: expiresIn > 0 ? expiresIn : 0,
      }
    } catch (error: unknown) {
      console.error('Failed to get cache stats:', error instanceof Error ? error.message : String(error))
      return { hasCachedData: false }
    }
  }
}

// Singleton instance
let cacheManager: TaxDataCacheManager | null = null

/**
 * Get or create cache manager instance
 */
export function getCacheManager(): TaxDataCacheManager {
  if (!cacheManager) {
    cacheManager = new TaxDataCacheManager()
  }
  return cacheManager
}

/**
 * Quick helper to get current tax rates (most common use case)
 */
export async function getCurrentTaxRates(
  forceRefresh = false
): Promise<CachedTaxRates> {
  const manager = getCacheManager()
  return manager.getRates(forceRefresh)
}
