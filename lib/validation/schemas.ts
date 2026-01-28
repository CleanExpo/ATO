/**
 * Zod Validation Schemas
 *
 * Provides runtime type validation for API requests and data.
 * All schemas are designed with Australian tax context in mind.
 *
 * @module lib/validation/schemas
 */

import { z } from 'zod'

// =============================================================================
// Common Schemas
// =============================================================================

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format')

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
})

/**
 * Australian Financial Year format (e.g., FY2024-25)
 */
export const financialYearSchema = z
  .string()
  .regex(
    /^FY\d{4}-\d{2}$/,
    'Invalid financial year format. Expected: FY2024-25'
  )

/**
 * Parse and validate financial year, returning start/end dates
 */
export function parseFinancialYear(fy: string): {
  startDate: Date
  endDate: Date
  startYear: number
  endYear: number
} {
  const parsed = financialYearSchema.safeParse(fy)
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }

  const match = fy.match(/^FY(\d{4})-(\d{2})$/)
  if (!match) {
    throw new Error('Invalid financial year format')
  }

  const startYear = parseInt(match[1], 10)
  const endYear = 2000 + parseInt(match[2], 10)

  // Australian FY runs July 1 to June 30
  return {
    startDate: new Date(startYear, 6, 1), // July 1
    endDate: new Date(endYear, 5, 30), // June 30
    startYear,
    endYear
  }
}

/**
 * Tenant ID validation (Xero organisation ID)
 */
export const tenantIdSchema = z
  .string()
  .min(1, 'tenantId is required')
  .max(100, 'tenantId too long')

// Alias for query parameters (backwards compatibility)
export const tenantIdQuerySchema = z.object({
  tenantId: tenantIdSchema
})

// =============================================================================
// Xero Data Schemas
// =============================================================================

/**
 * Xero connection request
 */
export const xeroConnectSchema = z.object({
  returnUrl: z.string().url().optional()
})

/**
 * Xero transaction query parameters
 */
export const xeroTransactionsQuerySchema = z.object({
  tenantId: tenantIdSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  financialYear: financialYearSchema.optional(),
  accountId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

// =============================================================================
// Audit Schemas
// =============================================================================

/**
 * Start AI analysis request
 */
export const analyzeRequestSchema = z.object({
  tenantId: tenantIdSchema,
  platform: z.enum(['xero', 'myob', 'quickbooks']).optional(),
  businessName: z.string().optional(),
  industry: z.string().optional(),
  abn: z.string().optional(),
  batchSize: z.coerce.number().int().min(1).max(100).default(50),
  financialYears: z.array(financialYearSchema).optional(),
  analysisTypes: z
    .array(z.enum(['rnd', 'deductions', 'losses', 'div7a', 'fbt']))
    .optional()
})

/**
 * Analysis results query
 */
export const analysisResultsQuerySchema = z.object({
  tenantId: tenantIdSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(10000).default(100),
  financialYear: financialYearSchema.optional(),
  category: z
    .enum([
      'rnd_candidate',
      'deduction_opportunity',
      'loss_recovery',
      'div7a_compliance',
      'fbt_implication',
      'misclassification'
    ])
    .optional(),
  minConfidence: z.coerce.number().min(0).max(100).optional()
})

/**
 * Recommendation status update
 */
export const recommendationStatusSchema = z.object({
  status: z.enum(['identified', 'in_progress', 'completed', 'rejected']),
  notes: z.string().max(1000).optional()
})

// =============================================================================
// Tax Calculation Schemas
// =============================================================================

/**
 * R&D Tax Incentive calculation
 */
export const rndCalculationSchema = z.object({
  eligibleExpenditure: z.number().min(0),
  turnover: z.number().min(0),
  financialYear: financialYearSchema
})

/**
 * Division 7A loan calculation
 */
export const div7aCalculationSchema = z.object({
  loanAmount: z.number().min(0),
  loanDate: z.string().datetime(),
  financialYear: financialYearSchema,
  priorRepayments: z.number().min(0).default(0)
})

/**
 * Tax loss carry-forward calculation
 */
export const lossCalculationSchema = z.object({
  revenueLosses: z.number().min(0),
  capitalLosses: z.number().min(0),
  financialYear: financialYearSchema,
  entityType: z.enum(['company', 'trust', 'partnership', 'individual'])
})

// =============================================================================
// Report Schemas
// =============================================================================

/**
 * PDF report generation request
 */
export const reportGenerationSchema = z.object({
  tenantId: tenantIdSchema,
  reportType: z.enum(['full_audit', 'rnd_assessment', 'deduction_summary', 'executive_summary']),
  financialYears: z.array(financialYearSchema).min(1),
  includeRecommendations: z.boolean().default(true),
  includeDisclaimer: z.boolean().default(true)
})

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate request body against a schema
 *
 * @param body - The request body to validate
 * @param schema - The Zod schema to validate against
 * @returns Validated data or throws ZodError
 */
export function validateBody<T extends z.ZodTypeAny>(
  body: unknown,
  schema: T
): z.infer<T> {
  return schema.parse(body)
}

/**
 * Safely validate request body (returns result object)
 *
 * @param body - The request body to validate
 * @param schema - The Zod schema to validate against
 * @returns SafeParseReturnType with success/error
 */
export function safeValidateBody<T extends z.ZodTypeAny>(
  body: unknown,
  schema: T
): z.SafeParseReturnType<unknown, z.infer<T>> {
  return schema.safeParse(body)
}

/**
 * Format Zod errors for API response
 */
export function formatValidationErrors(error: z.ZodError): string {
  return error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join('; ')
}

/**
 * Validate query parameters from URLSearchParams
 */
export function validateQueryParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params: Record<string, string | string[]> = {}

  searchParams.forEach((value, key) => {
    const existing = params[key]
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        params[key] = [existing, value]
      }
    } else {
      params[key] = value
    }
  })

  return schema.parse(params)
}

// =============================================================================
// Type Exports
// =============================================================================

export type Pagination = z.infer<typeof paginationSchema>
export type XeroTransactionsQuery = z.infer<typeof xeroTransactionsQuerySchema>
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>
export type AnalysisResultsQuery = z.infer<typeof analysisResultsQuerySchema>
export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>
export type RndCalculation = z.infer<typeof rndCalculationSchema>
export type Div7aCalculation = z.infer<typeof div7aCalculationSchema>
export type LossCalculation = z.infer<typeof lossCalculationSchema>
export type ReportGeneration = z.infer<typeof reportGenerationSchema>
