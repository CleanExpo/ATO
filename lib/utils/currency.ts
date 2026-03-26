/**
 * Currency Formatting Utilities
 *
 * Jurisdiction-aware currency formatting for AU (AUD), NZ (NZD), and UK (GBP).
 * Uses Intl.NumberFormat for locale-correct output.
 */

import type { Jurisdiction, JurisdictionCurrency } from '@/lib/types/jurisdiction'
import { JURISDICTION_CONFIGS } from '@/lib/types/jurisdiction'

/**
 * Format a numeric amount as currency for the given jurisdiction
 *
 * @param amount - Amount in major currency units (dollars/pounds, not cents)
 * @param jurisdiction - 'AU' | 'NZ' | 'UK'
 * @param options - Optional Intl.NumberFormat options overrides
 * @returns Formatted currency string, e.g. "$1,234.56", "£1,234.56"
 *
 * @example
 * formatCurrency(1234.56, 'AU') // "$1,234.56"
 * formatCurrency(1234.56, 'UK') // "£1,234.56"
 * formatCurrency(1234.56, 'NZ') // "$1,234.56"
 */
export function formatCurrency(
  amount: number,
  jurisdiction: Jurisdiction,
  options?: Partial<Intl.NumberFormatOptions>
): string {
  const config = JURISDICTION_CONFIGS[jurisdiction]
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
}

/**
 * Format currency from cents/pence to major currency display
 *
 * @param amountInCents - Amount in minor currency units (cents/pence)
 * @param jurisdiction - 'AU' | 'NZ' | 'UK'
 * @returns Formatted currency string
 */
export function formatCurrencyFromCents(
  amountInCents: number,
  jurisdiction: Jurisdiction
): string {
  return formatCurrency(amountInCents / 100, jurisdiction)
}

/**
 * Get the currency code for a jurisdiction
 */
export function currencyForJurisdiction(jurisdiction: Jurisdiction): JurisdictionCurrency {
  return JURISDICTION_CONFIGS[jurisdiction].currency
}

/**
 * Format a compact currency display (e.g. "$1.2K", "£45K", "$1.5M")
 * Useful for dashboard displays where space is limited.
 */
export function formatCurrencyCompact(
  amount: number,
  jurisdiction: Jurisdiction
): string {
  const config = JURISDICTION_CONFIGS[jurisdiction]
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

/**
 * Parse a currency string back to a number
 * Strips currency symbols, commas, and whitespace
 */
export function parseCurrencyString(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}
