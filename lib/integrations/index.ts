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

// Export adapters
export { XeroAdapter } from './adapters/xero-adapter'
export { MYOBAdapter } from './adapters/myob-adapter'

// Register adapters
import { adapterRegistry } from './adapter'
import { XeroAdapter } from './adapters/xero-adapter'
import { MYOBAdapter } from './adapters/myob-adapter'
import type { AuthCredentials } from './adapter'
import type { Platform } from './canonical-schema'

// Auto-register Xero adapter
adapterRegistry.register('xero', async (credentials: AuthCredentials) => {
  return new XeroAdapter()
})

// Auto-register MYOB adapter
adapterRegistry.register('myob', async (credentials: AuthCredentials) => {
  return new MYOBAdapter()
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
  return adapterRegistry.isSupported(platform as Platform)
}

/**
 * Get all supported platforms
 */
export function getSupportedPlatforms() {
  return adapterRegistry.getSupportedPlatforms()
}
