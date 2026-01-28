/**
 * Data Validation Utilities
 *
 * Validators for canonical schema data
 */

import type {
  CanonicalTransaction,
  CanonicalLineItem,
  ValidationResult,
} from './canonical-schema'

/**
 * Validate canonical transaction
 */
export function validateTransaction(transaction: CanonicalTransaction): ValidationResult {
  const errors: ValidationResult['errors'] = []
  const warnings: ValidationResult['warnings'] = []

  // Required fields
  if (!transaction.id) {
    errors.push({
      field: 'id',
      message: 'Transaction ID is required',
      code: 'REQUIRED_FIELD',
    })
  }

  if (!transaction.platform) {
    errors.push({
      field: 'platform',
      message: 'Platform is required',
      code: 'REQUIRED_FIELD',
    })
  }

  if (!transaction.type) {
    errors.push({
      field: 'type',
      message: 'Transaction type is required',
      code: 'REQUIRED_FIELD',
    })
  }

  if (!transaction.date) {
    errors.push({
      field: 'date',
      message: 'Transaction date is required',
      code: 'REQUIRED_FIELD',
    })
  }

  // Date format validation
  if (transaction.date && !isValidISO8601Date(transaction.date)) {
    errors.push({
      field: 'date',
      message: 'Date must be in ISO 8601 format (YYYY-MM-DD)',
      code: 'INVALID_FORMAT',
    })
  }

  if (transaction.dueDate && !isValidISO8601Date(transaction.dueDate)) {
    errors.push({
      field: 'dueDate',
      message: 'Due date must be in ISO 8601 format (YYYY-MM-DD)',
      code: 'INVALID_FORMAT',
    })
  }

  // Amount validation
  if (transaction.total < 0 && transaction.type !== 'credit_note') {
    warnings.push({
      field: 'total',
      message: `Negative total amount (${transaction.total}) for non-credit-note transaction`,
      code: 'NEGATIVE_AMOUNT',
    })
  }

  // Line items validation
  if (!transaction.lineItems || transaction.lineItems.length === 0) {
    warnings.push({
      field: 'lineItems',
      message: 'Transaction has no line items',
      code: 'EMPTY_LINE_ITEMS',
    })
  } else {
    // Validate each line item
    transaction.lineItems.forEach((item, index) => {
      const lineErrors = validateLineItem(item)
      lineErrors.forEach((error) => {
        errors.push({
          field: `lineItems[${index}].${error.field}`,
          message: error.message,
          code: error.code,
        })
      })
    })

    // Validate subtotal calculation
    const calculatedSubtotal = transaction.lineItems.reduce(
      (sum, item) => sum + item.lineAmount,
      0
    )

    if (Math.abs(calculatedSubtotal - transaction.subtotal) > 0.01) {
      errors.push({
        field: 'subtotal',
        message: `Subtotal mismatch: expected ${calculatedSubtotal.toFixed(2)}, got ${transaction.subtotal.toFixed(2)}`,
        code: 'AMOUNT_MISMATCH',
      })
    }

    // Validate total tax calculation
    const calculatedTax = transaction.lineItems.reduce(
      (sum, item) => sum + item.taxAmount,
      0
    )

    if (Math.abs(calculatedTax - transaction.totalTax) > 0.01) {
      errors.push({
        field: 'totalTax',
        message: `Tax total mismatch: expected ${calculatedTax.toFixed(2)}, got ${transaction.totalTax.toFixed(2)}`,
        code: 'AMOUNT_MISMATCH',
      })
    }

    // Validate grand total
    const calculatedTotal = calculatedSubtotal + calculatedTax
    if (Math.abs(calculatedTotal - transaction.total) > 0.01) {
      errors.push({
        field: 'total',
        message: `Total mismatch: expected ${calculatedTotal.toFixed(2)}, got ${transaction.total.toFixed(2)}`,
        code: 'AMOUNT_MISMATCH',
      })
    }
  }

  // Currency validation
  if (!transaction.currency) {
    warnings.push({
      field: 'currency',
      message: 'Currency code is missing (defaulting to AUD)',
      code: 'MISSING_CURRENCY',
    })
  } else if (!isValidCurrencyCode(transaction.currency)) {
    warnings.push({
      field: 'currency',
      message: `Invalid currency code: ${transaction.currency}`,
      code: 'INVALID_CURRENCY',
    })
  }

  // Financial year validation
  if (!transaction.financialYear) {
    warnings.push({
      field: 'financialYear',
      message: 'Financial year is missing',
      code: 'MISSING_FY',
    })
  } else if (!isValidFinancialYear(transaction.financialYear)) {
    warnings.push({
      field: 'financialYear',
      message: `Invalid financial year format: ${transaction.financialYear}`,
      code: 'INVALID_FY_FORMAT',
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate line item
 */
function validateLineItem(
  item: CanonicalLineItem
): Array<{ field: string; message: string; code: string }> {
  const errors: Array<{ field: string; message: string; code: string }> = []

  // Quantity validation
  if (item.quantity <= 0) {
    errors.push({
      field: 'quantity',
      message: `Invalid quantity: ${item.quantity}`,
      code: 'INVALID_QUANTITY',
    })
  }

  // Amount calculations
  const expectedLineAmount = item.quantity * item.unitPrice
  if (Math.abs(expectedLineAmount - item.lineAmount) > 0.01) {
    errors.push({
      field: 'lineAmount',
      message: `Line amount mismatch: expected ${expectedLineAmount.toFixed(2)}, got ${item.lineAmount.toFixed(2)}`,
      code: 'AMOUNT_MISMATCH',
    })
  }

  const expectedTotal = item.lineAmount + item.taxAmount
  if (Math.abs(expectedTotal - item.totalAmount) > 0.01) {
    errors.push({
      field: 'totalAmount',
      message: `Total amount mismatch: expected ${expectedTotal.toFixed(2)}, got ${item.totalAmount.toFixed(2)}`,
      code: 'AMOUNT_MISMATCH',
    })
  }

  // Tax rate validation
  if (item.taxRate !== undefined) {
    if (item.taxRate < 0 || item.taxRate > 1) {
      errors.push({
        field: 'taxRate',
        message: `Tax rate must be between 0 and 1, got ${item.taxRate}`,
        code: 'INVALID_TAX_RATE',
      })
    }

    // Validate tax calculation
    const expectedTaxAmount = item.lineAmount * item.taxRate
    if (Math.abs(expectedTaxAmount - item.taxAmount) > 0.01) {
      errors.push({
        field: 'taxAmount',
        message: `Tax amount mismatch for rate ${item.taxRate}: expected ${expectedTaxAmount.toFixed(2)}, got ${item.taxAmount.toFixed(2)}`,
        code: 'TAX_CALCULATION_ERROR',
      })
    }
  }

  return errors
}

/**
 * Check if date is valid ISO 8601 format
 */
function isValidISO8601Date(date: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/
  return iso8601Regex.test(date)
}

/**
 * Check if currency code is valid ISO 4217
 */
function isValidCurrencyCode(code: string): boolean {
  const validCurrencies = [
    'AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD', 'JPY', 'CNY', 'SGD', 'HKD',
    // Add more as needed
  ]
  return validCurrencies.includes(code.toUpperCase())
}

/**
 * Check if financial year format is valid (FY2023-24)
 */
function isValidFinancialYear(fy: string): boolean {
  const fyRegex = /^FY\d{4}-\d{2}$/
  return fyRegex.test(fy)
}

/**
 * Batch validation for multiple transactions
 */
export function validateTransactions(
  transactions: CanonicalTransaction[]
): ValidationResult {
  const allErrors: ValidationResult['errors'] = []
  const allWarnings: ValidationResult['warnings'] = []

  transactions.forEach((txn, index) => {
    const result = validateTransaction(txn)

    result.errors.forEach((error) => {
      allErrors.push({
        ...error,
        field: `transactions[${index}].${error.field}`,
      })
    })

    result.warnings.forEach((warning) => {
      allWarnings.push({
        ...warning,
        field: `transactions[${index}].${warning.field}`,
      })
    })
  })

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  }
}
