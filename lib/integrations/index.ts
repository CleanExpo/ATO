/**
 * Data Normalization Platform
 *
 * Exports for the canonical schema and platform adapters
 */

// Export canonical schema types
export type {
  Platform,
  TransactionType,
  TransactionStatus,
  ContactType,
  CanonicalContact,
  CanonicalLineItem,
  CanonicalTransaction,
  CanonicalAccount,
  CanonicalReportData,
  ValidationResult,
  DataQualityMetrics,
} from './canonical-schema'

// Export adapter types and interfaces
export type {
  AuthCredentials,
  SyncOptions,
  SyncProgress,
  PlatformAdapter,
  AdapterFactory,
} from './adapter'

export {
  adapterRegistry,
  NormalizationError,
  ValidationError,
} from './adapter'

// Export Xero adapter
export { XeroAdapter } from './adapters/xero-adapter'

// Register Xero adapter
import { adapterRegistry } from './adapter'
import { XeroAdapter } from './adapters/xero-adapter'
import type { AuthCredentials } from './adapter'

// Auto-register Xero adapter
adapterRegistry.register('xero', async (credentials: AuthCredentials) => {
  return new XeroAdapter()
})

/**
 * Helper function to get an adapter for a platform
 */
export async function getAdapter(
  platform: 'xero' | 'myob' | 'quickbooks',
  credentials: AuthCredentials
) {
  return adapterRegistry.getAdapter(platform, credentials)
}

/**
 * Helper function to check if a platform is supported
 */
export function isPlatformSupported(platform: string): boolean {
  return adapterRegistry.isSupported(platform as any)
}

/**
 * Get all supported platforms
 */
export function getSupportedPlatforms() {
  return adapterRegistry.getSupportedPlatforms()
}
