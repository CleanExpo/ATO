/**
 * Secure Token Generator for Shared Reports
 *
 * Generates cryptographically secure, URL-safe tokens for share links.
 * Uses Web Crypto API for randomness.
 */

import { randomBytes } from 'crypto';

/**
 * Character set for URL-safe tokens
 * Excludes ambiguous characters: 0, O, I, l, 1
 */
const URL_SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * Generate a cryptographically secure, URL-safe token
 *
 * @param length - Token length (default: 32 characters)
 * @returns URL-safe random token
 */
export function generateShareToken(length: number = 32): string {
  // Use rejection sampling to avoid modulo bias.
  // 256 % 56 !== 0, so simple modulo would make chars 0-31 ~1.6% more likely.
  // Rejection threshold: largest multiple of charset length that fits in a byte.
  const charsetLen = URL_SAFE_CHARS.length; // 56
  const maxUnbiased = Math.floor(256 / charsetLen) * charsetLen; // 224

  let token = '';
  while (token.length < length) {
    const bytes = randomBytes(length - token.length + 16); // over-request to reduce loops
    for (let i = 0; i < bytes.length && token.length < length; i++) {
      if (bytes[i] < maxUnbiased) {
        token += URL_SAFE_CHARS[bytes[i] % charsetLen];
      }
      // else: reject this byte (> 224) to eliminate bias
    }
  }

  return token;
}

/**
 * Generate a short token for display purposes (e.g., last 6 chars)
 *
 * @param token - Full token
 * @param displayLength - Number of characters to show
 * @returns Truncated token for display
 */
export function getDisplayToken(token: string, displayLength: number = 6): string {
  if (token.length <= displayLength) return token;
  return `...${token.slice(-displayLength)}`;
}

/**
 * Build the full share URL from a token
 *
 * @param token - Share token
 * @param baseUrl - Base URL (defaults to NEXT_PUBLIC_APP_URL or localhost)
 * @returns Full share URL
 */
export function buildShareUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/share/${token}`;
}

/**
 * Validate token format
 *
 * @param token - Token to validate
 * @returns Whether token has valid format
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  if (token.length < 16 || token.length > 64) return false;

  // Check all characters are in our allowed set
  for (const char of token) {
    if (!URL_SAFE_CHARS.includes(char)) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate expiry date from days
 *
 * @param days - Number of days until expiry
 * @returns ISO timestamp string
 */
export function calculateExpiryDate(days: number): string {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate.toISOString();
}

/**
 * Check if a date is expired
 *
 * @param expiresAt - Expiry date as ISO string
 * @returns Whether the date has passed
 */
export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Format remaining time until expiry
 *
 * @param expiresAt - Expiry date as ISO string
 * @returns Human-readable time remaining or 'Expired'
 */
export function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining`;
  }

  if (diffHours > 0) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} remaining`;
  }

  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} remaining`;
}
