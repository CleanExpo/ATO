/**
 * Tests for Token Encryption Module (lib/crypto/token-encryption.ts)
 *
 * Validates AES-256-GCM encryption/decryption for OAuth tokens at rest.
 * Covers: encryptToken, decryptToken, isEncryptedToken, truncateTokenForLogging,
 * generateEncryptionKey, reEncryptToken
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encryptToken,
  decryptToken,
  isEncryptedToken,
  truncateTokenForLogging,
  generateEncryptionKey,
  reEncryptToken,
} from '@/lib/crypto/token-encryption'

// TOKEN_ENCRYPTION_KEY is set in tests/setup.ts as 'a'.repeat(64)

describe('encryptToken', () => {
  it('should return a non-empty base64 string', () => {
    const encrypted = encryptToken('my-secret-token')
    expect(encrypted).toBeTruthy()
    expect(typeof encrypted).toBe('string')
    // base64 characters only
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('should produce different ciphertexts for the same plaintext (due to random IV/salt)', () => {
    const token = 'same-token-every-time'
    const enc1 = encryptToken(token)
    const enc2 = encryptToken(token)
    expect(enc1).not.toBe(enc2)
  })

  it('should throw on empty string', () => {
    expect(() => encryptToken('')).toThrow('Token cannot be empty')
  })

  it('should encrypt tokens of varying lengths', () => {
    const short = encryptToken('x')
    const medium = encryptToken('a'.repeat(100))
    const long = encryptToken('b'.repeat(10000))
    expect(short).toBeTruthy()
    expect(medium).toBeTruthy()
    expect(long).toBeTruthy()
  })

  it('should encrypt tokens with special characters', () => {
    const token = 'token/with+special=chars&more!'
    const encrypted = encryptToken(token)
    expect(encrypted).toBeTruthy()
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(token)
  })

  it('should encrypt tokens with unicode characters', () => {
    const token = 'token-with-unicode-\u00e9\u00e0\u00fc-\u{1F600}'
    const encrypted = encryptToken(token)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(token)
  })
})

describe('decryptToken', () => {
  it('should decrypt an encrypted token back to original plaintext', () => {
    const original = 'xero_access_token_abc123def456'
    const encrypted = encryptToken(original)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(original)
  })

  it('should throw on empty string', () => {
    expect(() => decryptToken('')).toThrow('Encrypted token cannot be empty')
  })

  it('should throw on invalid base64 / tampered ciphertext', () => {
    const encrypted = encryptToken('valid-token')
    // Tamper with the ciphertext by flipping a character
    const tampered = encrypted.slice(0, -2) + 'XX'
    expect(() => decryptToken(tampered)).toThrow()
  })

  it('should throw on random gibberish base64', () => {
    // Valid base64 but not a properly encrypted token
    const gibberish = Buffer.from('this-is-not-encrypted-data-just-some-random-text-padding-more').toString('base64')
    expect(() => decryptToken(gibberish)).toThrow()
  })

  it('should roundtrip a very long token', () => {
    const longToken = 'x'.repeat(5000)
    const encrypted = encryptToken(longToken)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(longToken)
  })
})

describe('encryptToken + decryptToken roundtrip', () => {
  it('should preserve the exact original token through encrypt/decrypt cycle', () => {
    const tokens = [
      'simple-token',
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      'token with spaces',
      '{"json":"value","nested":{"key":123}}',
      '',
    ]

    for (const token of tokens) {
      if (!token) continue // skip empty
      const encrypted = encryptToken(token)
      const decrypted = decryptToken(encrypted)
      expect(decrypted).toBe(token)
    }
  })
})

describe('isEncryptedToken', () => {
  it('should return true for a properly encrypted token', () => {
    const encrypted = encryptToken('test-token')
    expect(isEncryptedToken(encrypted)).toBe(true)
  })

  it('should return false for empty string', () => {
    expect(isEncryptedToken('')).toBe(false)
  })

  it('should return false for a plaintext token', () => {
    // Short plaintext won't have enough bytes after base64 decode
    expect(isEncryptedToken('short-plaintext')).toBe(false)
  })

  it('should return false for null/undefined cast to string', () => {
    expect(isEncryptedToken(null as unknown as string)).toBe(false)
    expect(isEncryptedToken(undefined as unknown as string)).toBe(false)
  })

  it('should return false for a base64 string that is too short', () => {
    // salt(32) + iv(16) + authTag(16) = 64 bytes minimum, need > 64
    const shortBase64 = Buffer.alloc(64).toString('base64')
    expect(isEncryptedToken(shortBase64)).toBe(false)
  })

  it('should return true for base64 with length > salt+iv+authTag', () => {
    // 65 bytes in base64 should pass the length check
    const longEnoughBase64 = Buffer.alloc(65).toString('base64')
    expect(isEncryptedToken(longEnoughBase64)).toBe(true)
  })
})

describe('truncateTokenForLogging', () => {
  it('should return first 8 chars followed by ellipsis for long tokens', () => {
    expect(truncateTokenForLogging('abcdefghijklmnop')).toBe('abcdefgh...')
  })

  it('should return "****" for tokens shorter than 8 chars', () => {
    expect(truncateTokenForLogging('abc')).toBe('****')
    expect(truncateTokenForLogging('1234567')).toBe('****')
  })

  it('should return "****" for empty string', () => {
    expect(truncateTokenForLogging('')).toBe('****')
  })

  it('should return first 8 chars for exactly 8-char token', () => {
    expect(truncateTokenForLogging('12345678')).toBe('12345678...')
  })

  it('should handle undefined/null gracefully', () => {
    expect(truncateTokenForLogging(undefined as unknown as string)).toBe('****')
    expect(truncateTokenForLogging(null as unknown as string)).toBe('****')
  })
})

describe('generateEncryptionKey', () => {
  it('should return a 64-character hex string (32 bytes)', () => {
    const key = generateEncryptionKey()
    expect(key).toHaveLength(64)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('should generate unique keys', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 20; i++) {
      keys.add(generateEncryptionKey())
    }
    expect(keys.size).toBe(20)
  })

  it('should produce a key usable for encryption', () => {
    const key = generateEncryptionKey()
    const originalKey = process.env.TOKEN_ENCRYPTION_KEY
    process.env.TOKEN_ENCRYPTION_KEY = key

    const token = 'test-with-generated-key'
    const encrypted = encryptToken(token)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(token)

    // Restore
    process.env.TOKEN_ENCRYPTION_KEY = originalKey
  })
})

describe('reEncryptToken', () => {
  it('should re-encrypt a token from old key to new key', () => {
    const oldKey = generateEncryptionKey()
    const newKey = generateEncryptionKey()
    const plaintext = 'my-oauth-refresh-token'

    // Encrypt with old key
    const originalEnvKey = process.env.TOKEN_ENCRYPTION_KEY
    process.env.TOKEN_ENCRYPTION_KEY = oldKey
    const encryptedWithOldKey = encryptToken(plaintext)
    process.env.TOKEN_ENCRYPTION_KEY = originalEnvKey

    // Re-encrypt
    const reEncrypted = reEncryptToken(encryptedWithOldKey, oldKey, newKey)

    // Verify: decrypt with new key
    process.env.TOKEN_ENCRYPTION_KEY = newKey
    const decrypted = decryptToken(reEncrypted)
    expect(decrypted).toBe(plaintext)

    // Restore
    process.env.TOKEN_ENCRYPTION_KEY = originalEnvKey
  })

  it('should produce different ciphertext from original (different key)', () => {
    const oldKey = generateEncryptionKey()
    const newKey = generateEncryptionKey()

    const originalEnvKey = process.env.TOKEN_ENCRYPTION_KEY
    process.env.TOKEN_ENCRYPTION_KEY = oldKey
    const encrypted = encryptToken('token-data')
    process.env.TOKEN_ENCRYPTION_KEY = originalEnvKey

    const reEncrypted = reEncryptToken(encrypted, oldKey, newKey)
    expect(reEncrypted).not.toBe(encrypted)
  })

  it('should restore the original environment key after re-encryption', () => {
    const originalKey = process.env.TOKEN_ENCRYPTION_KEY
    const oldKey = generateEncryptionKey()
    const newKey = generateEncryptionKey()

    process.env.TOKEN_ENCRYPTION_KEY = oldKey
    const encrypted = encryptToken('test')
    process.env.TOKEN_ENCRYPTION_KEY = originalKey

    reEncryptToken(encrypted, oldKey, newKey)

    // The env var should be restored to what it was before reEncryptToken call
    expect(process.env.TOKEN_ENCRYPTION_KEY).toBe(originalKey)
  })
})

describe('getEncryptionKey edge cases', () => {
  it('should throw if TOKEN_ENCRYPTION_KEY is set but wrong length', () => {
    const originalKey = process.env.TOKEN_ENCRYPTION_KEY
    process.env.TOKEN_ENCRYPTION_KEY = 'tooshort'
    expect(() => encryptToken('test')).toThrow('must be 32 bytes')
    process.env.TOKEN_ENCRYPTION_KEY = originalKey
  })

  it('should use dev fallback when NODE_ENV is development and key not set', () => {
    const originalKey = process.env.TOKEN_ENCRYPTION_KEY
    const originalEnv = process.env.NODE_ENV
    delete process.env.TOKEN_ENCRYPTION_KEY
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'

    // Should not throw; uses dev-derived key
    const encrypted = encryptToken('dev-test-token')
    expect(encrypted).toBeTruthy()
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe('dev-test-token')

    process.env.TOKEN_ENCRYPTION_KEY = originalKey
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalEnv
  })

  it('should throw in production when TOKEN_ENCRYPTION_KEY is not set', () => {
    const originalKey = process.env.TOKEN_ENCRYPTION_KEY
    const originalEnv = process.env.NODE_ENV
    delete process.env.TOKEN_ENCRYPTION_KEY
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

    expect(() => encryptToken('test')).toThrow('TOKEN_ENCRYPTION_KEY environment variable is required')

    process.env.TOKEN_ENCRYPTION_KEY = originalKey
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalEnv
  })
})
