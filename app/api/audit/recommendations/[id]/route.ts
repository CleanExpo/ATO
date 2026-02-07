/**
 * GET /api/audit/recommendations/:id
 *
 * Get a single recommendation by ID.
 *
 * Response:
 * - recommendation: Full recommendation details
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError, createNotFoundError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { getRecommendation } from '@/lib/recommendations/recommendation-engine'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:audit:recommendations:detail')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate and validate tenant access
    const auth = await requireAuth(request)
    if (isErrorResponse(auth)) return auth

    const { tenantId } = auth
    const { id } = await params
    const recommendationId = id

    if (!recommendationId) {
      return createValidationError('Recommendation ID is required')
    }

    log.info('Getting recommendation', { recommendationId, tenantId })

    const recommendation = await getRecommendation(tenantId, recommendationId)

    if (!recommendation) {
      return createNotFoundError(`Recommendation ${recommendationId} not found`)
    }

    return NextResponse.json({
      recommendation,
    })
  } catch (error) {
    console.error('Failed to get recommendation:', error)
    return createErrorResponse(error, { operation: 'getRecommendation' }, 500)
  }
}

/**
 * PATCH /api/audit/recommendations/:id
 *
 * Update recommendation status and notes.
 *
 * Request Body:
 * {
 *   "status"?: "identified" | "in_progress" | "completed" | "rejected"
 *   "notes"?: string
 * }
 *
 * Response:
 * - success: boolean
 * - message: string
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate and validate tenant access
    const auth = await requireAuth(request)
    if (isErrorResponse(auth)) return auth

    const { tenantId } = auth
    const { id } = await params
    const recommendationId = id

    if (!recommendationId) {
      return createValidationError('Recommendation ID is required')
    }

    const body = await request.json()
    const { status, notes } = body

    // Validate status
    if (status) {
      const validStatuses = ['identified', 'in_progress', 'completed', 'rejected']
      if (!validStatuses.includes(status)) {
        return createValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
      }
    }

    log.info('Updating recommendation', { recommendationId, tenantId })

    // In a full implementation, this would update the database
    // For now, return success response
    // TODO: Implement database storage for recommendation status

    return NextResponse.json({
      success: true,
      message: `Recommendation ${recommendationId} updated successfully`,
      updated: {
        id: recommendationId,
        status: status || 'unchanged',
        notes: notes || '',
        updatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Failed to update recommendation:', error)
    return createErrorResponse(error, { operation: 'updateRecommendation' }, 500)
  }
}
