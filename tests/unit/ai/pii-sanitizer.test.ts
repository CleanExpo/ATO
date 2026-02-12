/**
 * Tests for PII Sanitizer (lib/ai/pii-sanitizer.ts)
 *
 * Validates APP 8 data minimisation compliance:
 * - Supplier names are anonymised before cross-border AI processing
 * - Same supplier always maps to same token within a batch
 * - Case-insensitive normalisation
 * - Edge cases: empty, undefined, unknown, whitespace
 * - Independent anonymiser instances
 * - Mapping retrieval and isolation
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { createSupplierAnonymiser } from '@/lib/ai/pii-sanitizer'

// =============================================================================
// Core anonymisation behaviour
// =============================================================================

describe('PII Sanitizer -- createSupplierAnonymiser', () => {
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

  it('should increment token counter sequentially', () => {
    const { anonymise } = createSupplierAnonymiser()
    for (let i = 1; i <= 10; i++) {
      const result = anonymise(`Supplier Company ${i}`)
      expect(result).toBe(`Supplier_${i}`)
    }
  })
})

// =============================================================================
// Case-insensitive normalisation
// =============================================================================

describe('PII Sanitizer -- Case insensitivity', () => {
  it('should treat different cases as same supplier', () => {
    const { anonymise } = createSupplierAnonymiser()
    const lower = anonymise('bunnings warehouse')
    const upper = anonymise('BUNNINGS WAREHOUSE')
    const mixed = anonymise('Bunnings Warehouse')
    expect(lower).toBe(upper)
    expect(upper).toBe(mixed)
    expect(lower).toBe('Supplier_1')
  })

  it('should handle all-uppercase names', () => {
    const { anonymise } = createSupplierAnonymiser()
    const result = anonymise('ACME CORP PTY LTD')
    expect(result).toBe('Supplier_1')
    expect(anonymise('acme corp pty ltd')).toBe('Supplier_1')
  })
})

// =============================================================================
// Whitespace handling
// =============================================================================

describe('PII Sanitizer -- Whitespace handling', () => {
  it('should trim leading/trailing whitespace', () => {
    const { anonymise } = createSupplierAnonymiser()
    const trimmed = anonymise('  Bunnings  ')
    const normal = anonymise('Bunnings')
    expect(trimmed).toBe(normal)
  })

  it('should return "Unknown" for whitespace-only string', () => {
    const { anonymise } = createSupplierAnonymiser()
    expect(anonymise('   ')).toBe('Unknown')
    expect(anonymise('\t')).toBe('Unknown')
    expect(anonymise('\n')).toBe('Unknown')
  })
})

// =============================================================================
// Edge cases: empty, undefined, unknown
// =============================================================================

describe('PII Sanitizer -- Edge cases', () => {
  it('should return "Unknown" for undefined supplier', () => {
    const { anonymise } = createSupplierAnonymiser()
    expect(anonymise(undefined)).toBe('Unknown')
  })

  it('should return "Unknown" for empty string', () => {
    const { anonymise } = createSupplierAnonymiser()
    expect(anonymise('')).toBe('Unknown')
  })

  it('should return "Unknown" for "unknown" (case-insensitive)', () => {
    const { anonymise } = createSupplierAnonymiser()
    expect(anonymise('unknown')).toBe('Unknown')
    expect(anonymise('Unknown')).toBe('Unknown')
    expect(anonymise('UNKNOWN')).toBe('Unknown')
  })

  it('should not count "Unknown" inputs towards the counter', () => {
    const { anonymise } = createSupplierAnonymiser()
    anonymise(undefined)
    anonymise('')
    anonymise('unknown')
    // First real supplier should be Supplier_1, not Supplier_4
    expect(anonymise('Bunnings')).toBe('Supplier_1')
  })
})

// =============================================================================
// Mapping retrieval
// =============================================================================

describe('PII Sanitizer -- getMapping', () => {
  it('should return a copy of the mapping via getMapping()', () => {
    const { anonymise, getMapping } = createSupplierAnonymiser()
    anonymise('Bunnings')
    anonymise('Officeworks')

    const mapping = getMapping()
    expect(mapping.size).toBe(2)
    expect(mapping.get('bunnings')).toBe('Supplier_1')
    expect(mapping.get('officeworks')).toBe('Supplier_2')
  })

  it('should return a defensive copy (modifying returned map does not affect anonymiser)', () => {
    const { anonymise, getMapping } = createSupplierAnonymiser()
    anonymise('Bunnings')

    const mapping = getMapping()
    mapping.set('hacked', 'Supplier_999')

    const freshMapping = getMapping()
    expect(freshMapping.has('hacked')).toBe(false)
    expect(freshMapping.size).toBe(1)
  })

  it('should return empty mapping when no suppliers anonymised', () => {
    const { getMapping } = createSupplierAnonymiser()
    expect(getMapping().size).toBe(0)
  })

  it('should not include "Unknown" entries in the mapping', () => {
    const { anonymise, getMapping } = createSupplierAnonymiser()
    anonymise(undefined)
    anonymise('')
    anonymise('unknown')

    const mapping = getMapping()
    expect(mapping.size).toBe(0)
  })
})

// =============================================================================
// Instance independence
// =============================================================================

describe('PII Sanitizer -- Instance independence', () => {
  it('should create independent anonymisers with separate counters', () => {
    const anon1 = createSupplierAnonymiser()
    const anon2 = createSupplierAnonymiser()

    anon1.anonymise('Bunnings')
    anon1.anonymise('Officeworks')

    // anon2 should start fresh at Supplier_1
    const result = anon2.anonymise('Officeworks')
    expect(result).toBe('Supplier_1') // Not Supplier_2
  })

  it('should have separate mappings between instances', () => {
    const anon1 = createSupplierAnonymiser()
    const anon2 = createSupplierAnonymiser()

    anon1.anonymise('Bunnings')
    const map1 = anon1.getMapping()

    anon2.anonymise('Officeworks')
    const map2 = anon2.getMapping()

    expect(map1.has('bunnings')).toBe(true)
    expect(map1.has('officeworks')).toBe(false)
    expect(map2.has('officeworks')).toBe(true)
    expect(map2.has('bunnings')).toBe(false)
  })
})

// =============================================================================
// Scale test
// =============================================================================

describe('PII Sanitizer -- Scale', () => {
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

  it('should handle repeated lookups efficiently', () => {
    const { anonymise } = createSupplierAnonymiser()
    // Add 50 suppliers
    for (let i = 0; i < 50; i++) {
      anonymise(`Company ${i}`)
    }
    // Re-lookup all 50 - should return same tokens
    for (let i = 0; i < 50; i++) {
      expect(anonymise(`Company ${i}`)).toBe(`Supplier_${i + 1}`)
    }
  })
})
