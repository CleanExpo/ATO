/**
 * Validation Middleware for API Routes
 *
 * Provides reusable middleware functions for validating request bodies and query params
 * using Zod schemas. Standardises error responses for validation failures.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { createValidationError } from '@/lib/api/errors'
import {
  formatValidationErrors,
  safeValidateBody,
  validateQueryParams,
} from '@/lib/validation/schemas'

/**
 * Result type for validated requests
 */
export type ValidatedRequest<T> = {
  success: true
  data: T
  request: NextRequest
}

export type ValidationError = {
  success: false
  response: NextResponse
}

export type ValidationResult<T> = ValidatedRequest<T> | ValidationError

/**
 * Validate request body against Zod schema
 *
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Validated data or error response
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const validation = await validateRequestBody(request, analyzeRequestSchema)
 *   if (!validation.success) return validation.response
 *
 *   const { data } = validation
 *   // data is now typed and validated
 * }
 * ```
 */
export async function validateRequestBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const body = await request.json()
    const result = safeValidateBody(body, schema)

    if (!result.success) {
      return {
        success: false,
        response: createValidationError(formatValidationErrors(result.error)),
      }
    }

    return {
      success: true,
      data: result.data,
      request,
    }
  } catch (error) {
    // JSON parse error
    if (error instanceof SyntaxError) {
      return {
        success: false,
        response: createValidationError('Invalid JSON in request body'),
      }
    }

    // Re-throw unexpected errors
    throw error
  }
}

/**
 * Validate request query parameters against Zod schema
 *
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Validated data or error response
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const validation = validateRequestQuery(request, xeroTransactionsQuerySchema)
 *   if (!validation.success) return validation.response
 *
 *   const { data } = validation
 *   // data.tenantId, data.page, data.pageSize are now validated
 * }
 * ```
 */
export function validateRequestQuery<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): ValidationResult<z.infer<T>> {
  try {
    // Pass URLSearchParams directly to validateQueryParams
    const result = validateQueryParams(request.nextUrl.searchParams, schema)

    return {
      success: true,
      data: result,
      request,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        response: createValidationError(formatValidationErrors(error)),
      }
    }

    // Re-throw unexpected errors
    throw error
  }
}

/**
 * Higher-order function to wrap API route handlers with validation
 *
 * @param schema - Zod schema for request body
 * @param handler - API route handler that receives validated data
 * @returns Wrapped route handler with automatic validation
 *
 * @example
 * ```typescript
 * export const POST = withBodyValidation(
 *   analyzeRequestSchema,
 *   async (request, data) => {
 *     // data is validated and typed
 *     const { tenantId, batchSize } = data
 *     // ... business logic
 *     return NextResponse.json({ success: true })
 *   }
 * )
 * ```
 */
export function withBodyValidation<T extends z.ZodTypeAny>(
  schema: T,
  handler: (request: NextRequest, data: z.infer<T>) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const validation = await validateRequestBody(request, schema)

    if (!validation.success) {
      return validation.response
    }

    return handler(request, validation.data)
  }
}

/**
 * Higher-order function to wrap API route handlers with query validation
 *
 * @param schema - Zod schema for query parameters
 * @param handler - API route handler that receives validated data
 * @returns Wrapped route handler with automatic validation
 *
 * @example
 * ```typescript
 * export const GET = withQueryValidation(
 *   xeroTransactionsQuerySchema,
 *   async (request, data) => {
 *     const { tenantId, page, pageSize } = data
 *     // ... business logic
 *     return NextResponse.json({ results: [] })
 *   }
 * )
 * ```
 */
export function withQueryValidation<T extends z.ZodTypeAny>(
  schema: T,
  handler: (request: NextRequest, data: z.infer<T>) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const validation = validateRequestQuery(request, schema)

    if (!validation.success) {
      return validation.response
    }

    return handler(request, validation.data)
  }
}

/**
 * Combine multiple validation steps
 *
 * Useful when you need to validate both body and query params,
 * or apply custom validation logic after schema validation.
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   // Validate body
 *   const bodyValidation = await validateRequestBody(request, analyzeRequestSchema)
 *   if (!bodyValidation.success) return bodyValidation.response
 *
 *   // Validate query params
 *   const queryValidation = validateRequestQuery(request, paginationSchema)
 *   if (!queryValidation.success) return queryValidation.response
 *
 *   // Custom business logic validation
 *   if (bodyValidation.data.batchSize > 100) {
 *     return createValidationError('Batch size too large for your plan')
 *   }
 *
 *   // All validations passed
 *   const body = bodyValidation.data
 *   const query = queryValidation.data
 * }
 * ```
 */
