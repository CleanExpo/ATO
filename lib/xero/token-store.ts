/**
 * Xero Token Store
 *
 * Centralised helper for reading and writing encrypted Xero OAuth tokens.
 * All token read/write operations should go through this module to ensure
 * tokens are always encrypted at rest.
 *
 * @module lib/xero/token-store
 */

import { encryptToken, decryptToken, isEncryptedToken } from '@/lib/crypto/token-encryption'

/**
 * Decrypt a token value read from the database.
 * Handles both encrypted and legacy plaintext tokens gracefully.
 *
 * @param value - The token value from the database (may be encrypted or plaintext)
 * @returns The decrypted plaintext token
 */
export function decryptStoredToken(value: string | null | undefined): string {
  if (!value) return ''

  // If the token looks encrypted, decrypt it
  if (isEncryptedToken(value)) {
    return decryptToken(value)
  }

  // Legacy plaintext token -- return as-is
  // This allows a graceful migration from unencrypted to encrypted storage
  return value
}

/**
 * Encrypt a token value before writing to the database.
 *
 * @param value - The plaintext token to encrypt
 * @returns The encrypted token string
 */
export function encryptTokenForStorage(value: string | null | undefined): string {
  if (!value) return ''
  return encryptToken(value)
}
