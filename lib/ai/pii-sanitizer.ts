/**
 * PII Sanitizer — Supplier Name Anonymisation
 *
 * Replaces supplier names with anonymous tokens (Supplier_1, Supplier_2, etc.)
 * before sending transaction data to external AI services (Google Gemini).
 *
 * Required by Privacy Act 1988 APP 8 — data minimisation before cross-border disclosure.
 * Supplier names may be personal information for sole traders and contractors.
 */

/**
 * Creates a per-batch anonymiser. Same supplier always maps to the same token
 * within one analysis run, preserving Gemini's ability to detect patterns
 * (e.g. "3 payments to Supplier_4").
 */
export function createSupplierAnonymiser(): {
  anonymise: (supplierName: string | undefined) => string
  getMapping: () => Map<string, string>
} {
  const mapping = new Map<string, string>()
  let counter = 0

  function anonymise(supplierName: string | undefined): string {
    if (!supplierName || supplierName.trim() === '' || supplierName.toLowerCase() === 'unknown') {
      return 'Unknown'
    }

    // Case-insensitive normalisation so "BUNNINGS" and "Bunnings" get the same token
    const normalised = supplierName.trim().toLowerCase()

    const existing = mapping.get(normalised)
    if (existing) {
      return existing
    }

    counter++
    const token = `Supplier_${counter}`
    mapping.set(normalised, token)
    return token
  }

  function getMapping(): Map<string, string> {
    return new Map(mapping)
  }

  return { anonymise, getMapping }
}
