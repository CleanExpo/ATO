/**
 * Cache Manager
 *
 * In-memory caching with TTL for API responses and computed results.
 * Uses Map for fast lookups with automatic expiration.
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('cache:manager')

interface CacheEntry<T> {
  data: T
  expiresAt: number
  createdAt: number
}

interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  size: number
  hitRate: number
}

class CacheManager {
  private cache: Map<string, CacheEntry<unknown>>
  private stats: {
    hits: number
    misses: number
    sets: number
    deletes: number
  }
  private cleanupInterval: NodeJS.Timeout | null

  constructor() {
    this.cache = new Map()
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    }
    this.cleanupInterval = null
    this.startCleanup()
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return entry.data as T
  }

  /**
   * Set value in cache with TTL (in seconds)
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    const now = Date.now()
    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + ttlSeconds * 1000,
      createdAt: now,
    }

    this.cache.set(key, entry)
    this.stats.sets++
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.stats.deletes++
    }
    return deleted
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.stats.deletes += this.cache.size
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Get or compute value (with caching)
   */
  async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Compute value
    const value = await computeFn()

    // Store in cache
    this.set(key, value, ttlSeconds)

    return value
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    let count = 0
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        count++
      }
    }

    this.stats.deletes += count
    return count
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    }
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired()
    }, 5 * 60 * 1000)
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      log.debug('Cleaned up expired cache entries', { count: cleaned })
    }
  }

  /**
   * Stop cleanup interval (for testing or shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Singleton instance
const cacheManager = new CacheManager()

export default cacheManager

/**
 * Cache key generators for different data types
 */
export const CacheKeys = {
  recommendations: (tenantId: string, priority?: string, taxArea?: string) => {
    const parts = ['recommendations', tenantId]
    if (priority) parts.push(`priority:${priority}`)
    if (taxArea) parts.push(`taxArea:${taxArea}`)
    return parts.join(':')
  },

  rndAnalysis: (tenantId: string, startYear?: string, endYear?: string) => {
    const parts = ['rnd-analysis', tenantId]
    if (startYear) parts.push(`start:${startYear}`)
    if (endYear) parts.push(`end:${endYear}`)
    return parts.join(':')
  },

  deductionAnalysis: (tenantId: string, startYear?: string, endYear?: string) => {
    const parts = ['deduction-analysis', tenantId]
    if (startYear) parts.push(`start:${startYear}`)
    if (endYear) parts.push(`end:${endYear}`)
    return parts.join(':')
  },

  lossAnalysis: (tenantId: string, startYear?: string, endYear?: string) => {
    const parts = ['loss-analysis', tenantId]
    if (startYear) parts.push(`start:${startYear}`)
    if (endYear) parts.push(`end:${endYear}`)
    return parts.join(':')
  },

  div7aAnalysis: (tenantId: string, startYear?: string, endYear?: string) => {
    const parts = ['div7a-analysis', tenantId]
    if (startYear) parts.push(`start:${startYear}`)
    if (endYear) parts.push(`end:${endYear}`)
    return parts.join(':')
  },

  analysisResults: (tenantId: string, financialYear?: string) => {
    const parts = ['analysis-results', tenantId]
    if (financialYear) parts.push(`fy:${financialYear}`)
    return parts.join(':')
  },

  costSummary: (tenantId: string) => {
    return `cost-summary:${tenantId}`
  },
}

/**
 * Cache TTL (Time To Live) in seconds
 */
export const CacheTTL = {
  // Analysis results (1 hour - changes rarely after completion)
  analysisResults: 60 * 60,

  // Recommendations (30 minutes - may be updated as status changes)
  recommendations: 30 * 60,

  // R&D/Deduction/Loss analysis (1 hour - computed data)
  taxAnalysis: 60 * 60,

  // Cost summary (5 minutes - updates frequently during analysis)
  costSummary: 5 * 60,

  // Sync/Analysis status (10 seconds - changes frequently)
  status: 10,

  // Reports (24 hours - rarely change after generation)
  reports: 24 * 60 * 60,
}

/**
 * Invalidate cache for a tenant (call after data changes)
 */
export function invalidateTenantCache(tenantId: string): number {
  const pattern = new RegExp(`^[^:]+:${tenantId}`)
  return cacheManager.invalidatePattern(pattern)
}
