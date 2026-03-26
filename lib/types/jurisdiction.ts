/**
 * Multi-Jurisdiction Type Definitions
 *
 * Supports AU (ATO), NZ (IRD), and UK (HMRC) tax jurisdictions.
 * Used across tax engines, rate fetchers, compliance calendar,
 * and organisation configuration.
 */

// ─── Core Types ──────────────────────────────────────────────────────

export type Jurisdiction = 'AU' | 'NZ' | 'UK'

export type JurisdictionCurrency = 'AUD' | 'NZD' | 'GBP'

// ─── Jurisdiction Configuration ──────────────────────────────────────

export interface JurisdictionConfig {
  code: Jurisdiction
  name: string
  currency: JurisdictionCurrency
  currencySymbol: string
  locale: string
  taxAuthority: string
  taxAuthorityAbbrev: string
  taxAuthorityUrl: string
  financialYearStart: { month: number; day: number }
  financialYearEnd: { month: number; day: number }
  financialYearFormat: string // e.g. 'FY2024-25', 'NZ2024-25', 'UK2025-26'
  entityTypes: string[]
  timezone: string
}

export const JURISDICTION_CONFIGS: Record<Jurisdiction, JurisdictionConfig> = {
  AU: {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    currencySymbol: '$',
    locale: 'en-AU',
    taxAuthority: 'Australian Taxation Office',
    taxAuthorityAbbrev: 'ATO',
    taxAuthorityUrl: 'https://www.ato.gov.au',
    financialYearStart: { month: 7, day: 1 },
    financialYearEnd: { month: 6, day: 30 },
    financialYearFormat: 'FY',
    entityTypes: [
      'company',
      'trust',
      'partnership',
      'individual',
      'smsf',
      'non_profit',
      'foreign_company',
    ],
    timezone: 'Australia/Sydney',
  },
  NZ: {
    code: 'NZ',
    name: 'New Zealand',
    currency: 'NZD',
    currencySymbol: '$',
    locale: 'en-NZ',
    taxAuthority: 'Inland Revenue Department',
    taxAuthorityAbbrev: 'IRD',
    taxAuthorityUrl: 'https://www.ird.govt.nz',
    financialYearStart: { month: 4, day: 1 },
    financialYearEnd: { month: 3, day: 31 },
    financialYearFormat: 'NZ',
    entityTypes: [
      'company',
      'partnership',
      'sole_trader',
      'trust',
      'look_through_company',
      'charitable_trust',
    ],
    timezone: 'Pacific/Auckland',
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    locale: 'en-GB',
    taxAuthority: 'HM Revenue & Customs',
    taxAuthorityAbbrev: 'HMRC',
    taxAuthorityUrl: 'https://www.gov.uk/government/organisations/hm-revenue-customs',
    financialYearStart: { month: 4, day: 6 },
    financialYearEnd: { month: 4, day: 5 },
    financialYearFormat: 'UK',
    entityTypes: [
      'limited_company',
      'llp',
      'sole_trader',
      'partnership',
      'cic',
      'charity',
      'plc',
    ],
    timezone: 'Europe/London',
  },
}

// ─── Tax Rate Types ──────────────────────────────────────────────────

export interface JurisdictionTaxRate {
  id?: string
  jurisdiction: Jurisdiction
  rateType: string
  rateKey: string
  rateValue: number
  effectiveFrom: string // ISO date
  effectiveTo?: string | null // ISO date, null = current
  sourceUrl?: string
  legislativeRef?: string
  metadata?: Record<string, unknown>
}

export interface TaxBracket {
  min: number
  max: number | null // null = no upper limit
  rate: number
  label?: string
}

// ─── Compliance Calendar Types ───────────────────────────────────────

export interface ComplianceDeadline {
  id?: string
  jurisdiction: Jurisdiction
  deadlineType: string
  deadlineName: string
  description?: string
  entityTypes: string[]
  dueDate: string // ISO date
  financialYear: string
  legislativeRef?: string
  notificationSent: boolean
}

// ─── Rate Change Types ───────────────────────────────────────────────

export interface RateChangeEvent {
  jurisdiction: Jurisdiction
  rateType: string
  rateKey: string
  oldValue: number
  newValue: number
  changeDetectedAt: string // ISO datetime
  sourceUrl?: string
  notificationSent: boolean
}

// ─── Utility Functions ───────────────────────────────────────────────

/**
 * Get jurisdiction configuration by code
 */
export function getJurisdictionConfig(jurisdiction: Jurisdiction): JurisdictionConfig {
  return JURISDICTION_CONFIGS[jurisdiction]
}

/**
 * Get currency symbol for a jurisdiction
 */
export function getCurrencySymbol(jurisdiction: Jurisdiction): string {
  return JURISDICTION_CONFIGS[jurisdiction].currencySymbol
}

/**
 * Get currency code for a jurisdiction
 */
export function getCurrencyCode(jurisdiction: Jurisdiction): JurisdictionCurrency {
  return JURISDICTION_CONFIGS[jurisdiction].currency
}

/**
 * Validate jurisdiction code
 */
export function isValidJurisdiction(code: string): code is Jurisdiction {
  return code === 'AU' || code === 'NZ' || code === 'UK'
}

/**
 * Get all supported jurisdictions
 */
export function getSupportedJurisdictions(): Jurisdiction[] {
  return ['AU', 'NZ', 'UK']
}
