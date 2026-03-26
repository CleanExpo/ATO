/**
 * Base Tax Engine — Multi-Jurisdiction Foundation
 *
 * Abstract base class providing jurisdiction-aware tax rate access,
 * financial year calculations, and common engine utilities.
 *
 * All new NZ and UK engines extend this base. Existing AU engines
 * are not required to extend it (backward compatibility preserved).
 *
 * Usage:
 *   class NZGSTEngine extends BaseTaxEngine {
 *     constructor() { super('NZ') }
 *     async analyze(tenantId, fy, options?) { ... }
 *   }
 */

import { createClient } from '@/lib/supabase/server'
import Decimal from 'decimal.js'
import type { Jurisdiction, JurisdictionTaxRate } from '@/lib/types/jurisdiction'
import { JURISDICTION_CONFIGS, getJurisdictionConfig } from '@/lib/types/jurisdiction'
import { getFinancialYearForJurisdiction } from '@/lib/utils/financial-year'

// ─── Common Types ────────────────────────────────────────────────────

export interface EngineResult<T> {
  success: boolean
  data?: T
  error?: string
  jurisdiction: Jurisdiction
  financialYear: string
  engineName: string
  confidence: number
  legislativeReferences: string[]
  warnings: string[]
  executionTimeMs: number
}

export interface EngineOptions {
  financialYear?: string
  forceRefresh?: boolean
  includeRecommendations?: boolean
  confidenceThreshold?: number
}

// ─── Base Engine Class ───────────────────────────────────────────────

export abstract class BaseTaxEngine {
  protected readonly jurisdiction: Jurisdiction
  protected readonly config: ReturnType<typeof getJurisdictionConfig>
  protected cachedRates: Map<string, number> = new Map()

  constructor(jurisdiction: Jurisdiction) {
    this.jurisdiction = jurisdiction
    this.config = getJurisdictionConfig(jurisdiction)
  }

  /**
   * Get the current financial year for this engine's jurisdiction
   */
  public getCurrentFinancialYear(referenceDate?: Date): string {
    return getFinancialYearForJurisdiction(referenceDate || new Date(), this.jurisdiction)
  }

  /**
   * Get a tax rate from the jurisdiction_tax_rates table
   *
   * @param rateType - Category of rate (e.g. 'income_tax', 'gst', 'vat')
   * @param rateKey - Specific rate identifier (e.g. 'basic_rate', 'standard_rate')
   * @returns Rate value or null if not found
   */
  public async getTaxRate(rateType: string, rateKey: string): Promise<number | null> {
    const cacheKey = `${this.jurisdiction}:${rateType}:${rateKey}`
    if (this.cachedRates.has(cacheKey)) {
      return this.cachedRates.get(cacheKey)!
    }

    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('jurisdiction_tax_rates')
        .select('rate_value')
        .eq('jurisdiction', this.jurisdiction)
        .eq('rate_type', rateType)
        .eq('rate_key', rateKey)
        .is('effective_to', null)
        .order('effective_from', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) return null

      const rate = Number(data.rate_value)
      this.cachedRates.set(cacheKey, rate)
      return rate
    } catch {
      return null
    }
  }

  /**
   * Get a tax rate with fallback value if not found in database
   */
  public async getTaxRateWithFallback(
    rateType: string,
    rateKey: string,
    fallback: number
  ): Promise<number> {
    const rate = await this.getTaxRate(rateType, rateKey)
    return rate ?? fallback
  }

  /**
   * Get all rates of a given type (e.g. all income tax brackets)
   */
  public async getTaxRatesByType(rateType: string): Promise<JurisdictionTaxRate[]> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('jurisdiction_tax_rates')
        .select('*')
        .eq('jurisdiction', this.jurisdiction)
        .eq('rate_type', rateType)
        .is('effective_to', null)
        .order('rate_key', { ascending: true })

      if (error || !data) return []

      return data.map((row) => ({
        id: row.id,
        jurisdiction: row.jurisdiction as Jurisdiction,
        rateType: row.rate_type,
        rateKey: row.rate_key,
        rateValue: Number(row.rate_value),
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
        sourceUrl: row.source_url,
        legislativeRef: row.legislative_ref,
        metadata: row.metadata,
      }))
    } catch {
      return []
    }
  }

  /**
   * Decimal.js helper for precise financial calculations
   */
  public decimal(value: number | string): Decimal {
    return new Decimal(value)
  }

  /**
   * Round to 2 decimal places (standard currency rounding)
   */
  public roundCurrency(value: Decimal): number {
    return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
  }

  /**
   * Calculate percentage of an amount
   */
  public percentage(amount: number, rate: number): number {
    return this.roundCurrency(this.decimal(amount).mul(this.decimal(rate).div(100)))
  }

  /**
   * Get the currency symbol for this jurisdiction
   */
  public get currencySymbol(): string {
    return this.config.currencySymbol
  }

  /**
   * Get the currency code for this jurisdiction
   */
  public get currencyCode(): string {
    return this.config.currency
  }

  /**
   * Get the tax authority abbreviation for this jurisdiction
   */
  public get taxAuthority(): string {
    return this.config.taxAuthorityAbbrev
  }

  /**
   * Create a timed engine result wrapper
   */
  public createResult<T>(
    engineName: string,
    startTime: number,
    data: T,
    confidence: number,
    legislativeReferences: string[],
    warnings: string[] = []
  ): EngineResult<T> {
    return {
      success: true,
      data,
      jurisdiction: this.jurisdiction,
      financialYear: this.getCurrentFinancialYear(),
      engineName,
      confidence,
      legislativeReferences,
      warnings,
      executionTimeMs: Date.now() - startTime,
    }
  }

  /**
   * Create an error result
   */
  public createErrorResult<T>(
    engineName: string,
    startTime: number,
    error: string
  ): EngineResult<T> {
    return {
      success: false,
      error,
      jurisdiction: this.jurisdiction,
      financialYear: this.getCurrentFinancialYear(),
      engineName,
      confidence: 0,
      legislativeReferences: [],
      warnings: [],
      executionTimeMs: Date.now() - startTime,
    }
  }
}
