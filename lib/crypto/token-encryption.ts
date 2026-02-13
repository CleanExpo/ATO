/**
 * Token Encryption Module
 *
 * Provides AES-256-GCM encryption for sensitive OAuth tokens.
 * Tokens are encrypted at rest in the database.
 *
 * @module lib/crypto/token-encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { optionalConfig } from '@/lib/config/env'

/**
 * Production guard (SEC-010): Validated lazily in getEncryptionKey().
 * Cannot throw at module load time because Next.js build runs with NODE_ENV=production.
 */

/**
 * Encryption configuration
 */
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32 // 256 bits

/**
 * Get the encryption key from environment or throw error
 */
function getEncryptionKey(): Buffer {
  // Check process.env directly first — reEncryptToken() temporarily mutates it
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY || optionalConfig.tokenEncryptionKey

  if (!keyHex) {
    // In development, use a derived key (NOT for production)
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'TOKEN_ENCRYPTION_KEY not set. Using derived key for development only.'
      )
      // VULN-5 fix: Use a fixed dev-only constant instead of SUPABASE_SERVICE_ROLE_KEY.
      // Tokens encrypted with this key are NOT portable to production.
      const DEV_ONLY_SECRET = 'ato-dev-encryption-key-not-for-production'
      return scryptSync(DEV_ONLY_SECRET, 'ato-dev-salt', 32)
    }

    throw new Error(
      'TOKEN_ENCRYPTION_KEY environment variable is required. ' +
        'Generate with: openssl rand -hex 32'
    )
  }

  // Validate key length (32 bytes = 64 hex characters)
  if (keyHex.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex characters). ' +
        'Generate with: openssl rand -hex 32'
    )
  }

  return Buffer.from(keyHex, 'hex')
}

/**
 * Encrypted token format
 *
 * Format: base64(salt + iv + authTag + ciphertext)
 */
export interface EncryptedToken {
  encrypted: string
  version: 1 // For future migration support
}

/**
 * Encrypt a token using AES-256-GCM
 *
 * @param token - The plaintext token to encrypt
 * @returns Base64-encoded encrypted token
 *
 * @example
 * ```typescript
 * const encrypted = encryptToken('xero_access_token_here')
 * // Store encrypted in database
 * ```
 */
export function encryptToken(token: string): string {
  if (!token) {
    throw new Error('Token cannot be empty')
  }

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const salt = randomBytes(SALT_LENGTH)

  // Derive a unique key for this encryption using the salt
  const derivedKey = scryptSync(key, salt, 32)

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv)

  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted])

  return combined.toString('base64')
}

/**
 * Decrypt a token encrypted with encryptToken
 *
 * @param encryptedToken - Base64-encoded encrypted token
 * @returns The decrypted plaintext token
 *
 * @example
 * ```typescript
 * const plaintext = decryptToken(encrypted)
 * // Use plaintext token for Xero API
 * ```
 */
export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) {
    throw new Error('Encrypted token cannot be empty')
  }

  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedToken, 'base64')

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  )
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

  // Derive the same key using the salt
  const derivedKey = scryptSync(key, salt, 32)

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

/**
 * Safely truncate a token for logging (first 8 chars only)
 *
 * @param token - The token to truncate
 * @returns Truncated token safe for logging
 */
export function truncateTokenForLogging(token: string): string {
  if (!token || token.length < 8) {
    return '****'
  }
  return `${token.slice(0, 8)}...`
}

/**
 * Check if a string appears to be an encrypted token
 *
 * Validates the format without attempting decryption.
 */
export function isEncryptedToken(value: string): boolean {
  if (!value) return false

  try {
    const decoded = Buffer.from(value, 'base64')
    // Minimum length: salt (32) + iv (16) + authTag (16) + at least 1 byte ciphertext
    return decoded.length > SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  } catch {
    return false
  }
}

/**
 * Re-encrypt a token with a new key
 *
 * Useful for key rotation.
 *
 * @param encryptedToken - Token encrypted with old key
 * @param oldKeyHex - The old encryption key (hex)
 * @param newKeyHex - The new encryption key (hex)
 * @returns Token encrypted with new key
 */
export function reEncryptToken(
  encryptedToken: string,
  oldKeyHex: string,
  newKeyHex: string
): string {
  // Temporarily set old key
  const originalKey = process.env.TOKEN_ENCRYPTION_KEY
  process.env.TOKEN_ENCRYPTION_KEY = oldKeyHex

  // Decrypt with old key
  const plaintext = decryptToken(encryptedToken)

  // Set new key
  process.env.TOKEN_ENCRYPTION_KEY = newKeyHex

  // Encrypt with new key
  const newEncrypted = encryptToken(plaintext)

  // Restore original key
  process.env.TOKEN_ENCRYPTION_KEY = originalKey

  return newEncrypted
}

/**
 * Generate a new encryption key
 *
 * @returns A cryptographically secure 32-byte hex key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}
