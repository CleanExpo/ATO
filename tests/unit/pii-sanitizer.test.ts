/**
 * Tests for PII Sanitizer (lib/ai/pii-sanitizer.ts)
 *
 * Validates APP 8 data minimisation compliance:
 * - Supplier names are anonymised before cross-border AI processing
 * - Same supplier always maps to same token within a batch
 * - Case-insensitive normalisation
 * - Edge cases: empty, undefined, unknown
 */

import { describe, it, expect } from 'vitest'
import { createSupplierAnonymiser } from '@/lib/ai/pii-sanitizer'

describe('PII Sanitizer — createSupplierAnonymiser', () => {
  it('should anonymise a supplier name to Supplier_N format', () => {
    const { anonymise } = createSupplierAnonymiser()
    const result = anonymise('Bunnings Warehouse')
    expect(result).toBe('Supplier_1')
  })

  it('should return same token for same supplier (consistency)', () => {
    const { anonymise } = createSupplierAnonymiser()
    const first = anonymise('Bunnings Warehouse')
    const second = anonymise('Bunnings Warehouse')
    expect(first).toBe(second)
    expect(first).toBe('Supplier_1')
  })

  it('should assign different tokens to different suppliers', () => {
    const { anonymise } = createSupplierAnonymiser()
    const a = anonymise('Bunnings Warehouse')
    const b = anonymise('Officeworks')
    const c = anonymise('JB Hi-Fi')
    expect(a).toBe('Supplier_1')
    expect(b).toBe('Supplier_2')
    expect(c).toBe('Supplier_3')
  })

  it('should be case-insensitive', () => {
    const { anonymise } = createSupplierAnonymiser()
    const lower = anonymise('bunnings warehouse')
    const upper = anonymise('BUNNINGS WAREHOUSE')
    const mixed = anonymise('Bunnings Warehouse')
    expect(lower).toBe(upper)
    expect(upper).toBe(mixed)
    expect(lower).toBe('Supplier_1')
  })

  it('should trim whitespace', () => {
    const { anonymise } = createSupplierAnonymiser()
    const trimmed = anonymise('  Bunnings  ')
    const normal = anonymise('Bunnings')
    expect(trimmed).toBe(normal)
  })

  it('should return "Unknown" for undefined supplier', () => {
    const { anonymise } = createSupplierAnonymiser()
    expect(anonymise(undefined)).toBe('Unknown')
  })

  it('should return "Unknown" for empty string', () => {
    const { anonymise } = createSupplierAnonymiser()
    expect(anonymise('')).toBe('Unknown')
  })

  it('should return "Unknown" for whitespace-only string', () => {
    const { anonymise } = createSupplierAnonymiser()
    expect(anonymise('   ')).toBe('Unknown')
  })

  it('should return "Unknown" for "unknown" (case-insensitive)', () => {
    const { anonymise } = createSupplierAnonymiser()
    expect(anonymise('unknown')).toBe('Unknown')
    expect(anonymise('Unknown')).toBe('Unknown')
    expect(anonymise('UNKNOWN')).toBe('Unknown')
  })

  it('should return a copy of the mapping via getMapping()', () => {
    const { anonymise, getMapping } = createSupplierAnonymiser()
    anonymise('Bunnings')
    anonymise('Officeworks')

    const mapping = getMapping()
    expect(mapping.size).toBe(2)
    expect(mapping.get('bunnings')).toBe('Supplier_1')
    expect(mapping.get('officeworks')).toBe('Supplier_2')

    // Verify it's a copy (modifying returned map doesn't affect anonymiser)
    mapping.set('hacked', 'Supplier_999')
    const freshMapping = getMapping()
    expect(freshMapping.has('hacked')).toBe(false)
  })

  it('should handle many suppliers without collision', () => {
    const { anonymise } = createSupplierAnonymiser()
    const suppliers = Array.from({ length: 100 }, (_, i) => `Supplier Company ${i}`)
    const tokens = suppliers.map(s => anonymise(s))

    // All tokens should be unique
    const uniqueTokens = new Set(tokens)
    expect(uniqueTokens.size).toBe(100)

    // All should follow Supplier_N format
    tokens.forEach((token, i) => {
      expect(token).toBe(`Supplier_${i + 1}`)
    })
  })

  it('should create independent anonymisers', () => {
    const anon1 = createSupplierAnonymiser()
    const anon2 = createSupplierAnonymiser()

    anon1.anonymise('Bunnings')
    anon1.anonymise('Officeworks')

    // anon2 should start fresh
    const result = anon2.anonymise('Officeworks')
    expect(result).toBe('Supplier_1') // Not Supplier_2
  })
})
