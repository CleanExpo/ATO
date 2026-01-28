/**
 * Platform Adapter Interface
 *
 * Defines the contract for all accounting platform integrations.
 * Each platform (Xero, MYOB, QuickBooks) implements this interface.
 */

import type {
  CanonicalTransaction,
  CanonicalAccount,
  CanonicalReportData,
  ValidationResult,
  DataQualityMetrics,
  Platform,
} from './canonical-schema'

/**
 * Authentication credentials (platform-specific)
 */
export interface AuthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tenantId: string
  [key: string]: unknown // Platform-specific fields
}

/**
 * Sync options
 */
export interface SyncOptions {
  /** Start date for data fetch (ISO 8601) */
  startDate?: string

  /** End date for data fetch (ISO 8601) */
  endDate?: string

  /** Financial years to fetch (e.g., ['FY2023-24', 'FY2024-25']) */
  financialYears?: string[]

  /** Maximum number of transactions to fetch */
  limit?: number

  /** Force re-sync (ignore cache) */
  forceResync?: boolean

  /** Transaction types to fetch */
  transactionTypes?: string[]

  /** Progress callback */
  onProgress?: (progress: SyncProgress) => void
}

/**
 * Sync progress
 */
export interface SyncProgress {
  /** Current progress (0-100) */
  progress: number

  /** Total transactions synced */
  transactionsSynced: number

  /** Total estimated transactions */
  totalEstimated: number

  /** Current phase */
  phase: 'initializing' | 'fetching' | 'normalizing' | 'validating' | 'storing' | 'complete' | 'error'

  /** Phase message */
  message: string

  /** Errors encountered */
  errors: Array<{
    code: string
    message: string
    timestamp: string
  }>
}

/**
 * Platform Adapter Interface
 *
 * All platform adapters must implement this interface
 */
export interface PlatformAdapter {
  /** Platform identifier */
  readonly platform: Platform

  /** Platform display name */
  readonly platformName: string

  /** Platform API version */
  readonly apiVersion: string

  /**
   * Initialize the adapter with credentials
   */
  initialize(credentials: AuthCredentials): Promise<void>

  /**
   * Test connection to platform
   */
  testConnection(): Promise<boolean>

  /**
   * Refresh access token if needed
   */
  refreshToken(credentials: AuthCredentials): Promise<AuthCredentials>

  /**
   * Fetch transactions and normalize to canonical format
   */
  fetchTransactions(options: SyncOptions): Promise<CanonicalTransaction[]>

  /**
   * Fetch chart of accounts
   */
  fetchAccounts(): Promise<CanonicalAccount[]>

  /**
   * Fetch report data (P&L, balance sheet, etc.)
   */
  fetchReport(
    reportType: 'profit_loss' | 'balance_sheet' | 'trial_balance',
    startDate: string,
    endDate: string
  ): Promise<CanonicalReportData>

  /**
   * Validate normalized data
   */
  validateData(transactions: CanonicalTransaction[]): Promise<ValidationResult>

  /**
   * Calculate data quality metrics
   */
  calculateQualityMetrics(transactions: CanonicalTransaction[]): Promise<DataQualityMetrics>

  /**
   * Get organization/company details
   */
  getOrganizationInfo(): Promise<{
    id: string
    name: string
    taxNumber?: string
    currency: string
    country: string
    fiscalYearEnd?: string
  }>

  /**
   * Get platform-specific metadata
   */
  getMetadata(): Record<string, unknown>
}

/**
 * Adapter factory function type
 */
export type AdapterFactory = (credentials: AuthCredentials) => Promise<PlatformAdapter>

/**
 * Adapter registry
 */
class AdapterRegistry {
  private adapters: Map<Platform, AdapterFactory> = new Map()

  /**
   * Register an adapter factory
   */
  register(platform: Platform, factory: AdapterFactory): void {
    this.adapters.set(platform, factory)
  }

  /**
   * Get adapter for platform
   */
  async getAdapter(platform: Platform, credentials: AuthCredentials): Promise<PlatformAdapter> {
    const factory = this.adapters.get(platform)

    if (!factory) {
      throw new Error(`No adapter registered for platform: ${platform}`)
    }

    const adapter = await factory(credentials)
    await adapter.initialize(credentials)

    return adapter
  }

  /**
   * Check if platform is supported
   */
  isSupported(platform: Platform): boolean {
    return this.adapters.has(platform)
  }

  /**
   * Get all supported platforms
   */
  getSupportedPlatforms(): Platform[] {
    return Array.from(this.adapters.keys())
  }
}

// Export singleton registry
export const adapterRegistry = new AdapterRegistry()

/**
 * Normalization error
 */
export class NormalizationError extends Error {
  constructor(
    message: string,
    public readonly platform: Platform,
    public readonly originalData: unknown,
    public readonly field?: string
  ) {
    super(message)
    this.name = 'NormalizationError'
  }
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: ValidationResult['errors']
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
