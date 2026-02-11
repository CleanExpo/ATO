/**
 * Accountant Findings API
 *
 * GET /api/accountant/findings - List all findings with filters
 * POST /api/accountant/findings - Create new finding
 *
 * Implements OpenAPI spec from docs/api-specs/accountant-workflow.yaml
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/accountant/findings
 *
 * List all findings with optional filters
 *
 * Query params:
 * - workflowArea: sundries | deductions | fbt | div7a | documents | reconciliation
 * - confidenceLevel: High | Medium | Low
 * - status: pending | approved | rejected | deferred
 * - minBenefit: number (minimum estimated benefit in dollars)
 * - financialYear: string (e.g., "FY2024-25")
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const supabase = await createServiceClient()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const workflowArea = searchParams.get('workflowArea')
    const confidenceLevel = searchParams.get('confidenceLevel')
    const status = searchParams.get('status')
    const minBenefit = searchParams.get('minBenefit')
    const financialYear = searchParams.get('financialYear')

    // Build query
    let query = supabase
      .from('accountant_findings')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (workflowArea) {
      const validAreas = ['sundries', 'deductions', 'fbt', 'div7a', 'documents', 'reconciliation']
      if (!validAreas.includes(workflowArea)) {
        return createValidationError(`workflowArea must be one of: ${validAreas.join(', ')}`)
      }
      query = query.eq('workflow_area', workflowArea)
    }

    if (confidenceLevel) {
      const validLevels = ['High', 'Medium', 'Low']
      if (!validLevels.includes(confidenceLevel)) {
        return createValidationError(`confidenceLevel must be one of: ${validLevels.join(', ')}`)
      }
      query = query.eq('confidence_level', confidenceLevel)
    }

    if (status) {
      const validStatuses = ['pending', 'approved', 'rejected', 'deferred']
      if (!validStatuses.includes(status)) {
        return createValidationError(`status must be one of: ${validStatuses.join(', ')}`)
      }
      query = query.eq('status', status)
    }

    if (minBenefit) {
      const benefitNum = parseInt(minBenefit, 10)
      if (isNaN(benefitNum) || benefitNum < 0) {
        return createValidationError('minBenefit must be a non-negative number')
      }
      query = query.gte('estimated_benefit', benefitNum)
    }

    if (financialYear) {
      query = query.eq('financial_year', financialYear)
    }

    // Execute query
    const { data: findings, error } = await query

    if (error) {
      console.error('Error fetching findings:', error)
      return createErrorResponse(error, {
        operation: 'fetch_accountant_findings',
        workflowArea,
      }, 500)
    }

    // Transform data to match API spec
    const transformedFindings = findings.map((finding) => ({
      id: finding.id,
      transactionId: finding.transaction_id,
      date: finding.transaction_date,
      description: finding.description,
      amount: finding.amount,
      currentClassification: finding.current_classification,
      suggestedClassification: finding.suggested_classification,
      suggestedAction: finding.suggested_action,
      confidence: {
        score: finding.confidence_score,
        level: finding.confidence_level,
        factors: finding.confidence_factors || [],
      },
      legislationRefs: finding.legislation_refs || [],
      reasoning: finding.reasoning,
      financialYear: finding.financial_year,
      estimatedBenefit: finding.estimated_benefit,
      status: finding.status,
      createdAt: finding.created_at,
      updatedAt: finding.updated_at,
    }))

    return NextResponse.json({
      findings: transformedFindings,
      total: transformedFindings.length,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/accountant/findings:', error)
    return createErrorResponse(error, { operation: 'fetch_accountant_findings' }, 500)
  }
}

/**
 * POST /api/accountant/findings
 *
 * Create a new finding (used by forensic audit system)
 *
 * Body:
 * - workflowArea: string (required)
 * - transactionId: string (required)
 * - transactionDate: string (required, ISO 8601)
 * - description: string (required)
 * - amount: number (required)
 * - currentClassification: string (optional)
 * - suggestedClassification: string (optional)
 * - suggestedAction: string (optional)
 * - confidenceScore: number (required, 0-100)
 * - confidenceLevel: 'High' | 'Medium' | 'Low' (required)
 * - confidenceFactors: array (optional)
 * - legislationRefs: array (optional)
 * - reasoning: string (required)
 * - financialYear: string (required, e.g., "FY2024-25")
 * - estimatedBenefit: number (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth

    const supabase = await createServiceClient()
    const body = await request.json()

    // Validate required fields
    const required = [
      'workflowArea',
      'transactionId',
      'transactionDate',
      'description',
      'amount',
      'confidenceScore',
      'confidenceLevel',
      'reasoning',
      'financialYear',
    ]

    for (const field of required) {
      if (!body[field] && body[field] !== 0) {
        return createValidationError(`${field} is required`)
      }
    }

    // Validate workflowArea
    const validAreas = ['sundries', 'deductions', 'fbt', 'div7a', 'documents', 'reconciliation']
    if (!validAreas.includes(body.workflowArea)) {
      return createValidationError(`workflowArea must be one of: ${validAreas.join(', ')}`)
    }

    // Validate confidenceLevel
    const validLevels = ['High', 'Medium', 'Low']
    if (!validLevels.includes(body.confidenceLevel)) {
      return createValidationError(`confidenceLevel must be one of: ${validLevels.join(', ')}`)
    }

    // Validate confidenceScore
    if (body.confidenceScore < 0 || body.confidenceScore > 100) {
      return createValidationError('confidenceScore must be between 0 and 100')
    }

    // Insert finding
    const { data: finding, error } = await supabase
      .from('accountant_findings')
      .insert({
        workflow_area: body.workflowArea,
        transaction_id: body.transactionId,
        transaction_date: body.transactionDate,
        description: body.description,
        amount: body.amount,
        current_classification: body.currentClassification,
        suggested_classification: body.suggestedClassification,
        suggested_action: body.suggestedAction,
        confidence_score: body.confidenceScore,
        confidence_level: body.confidenceLevel,
        confidence_factors: body.confidenceFactors || [],
        legislation_refs: body.legislationRefs || [],
        reasoning: body.reasoning,
        financial_year: body.financialYear,
        estimated_benefit: body.estimatedBenefit || 0,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating finding:', error)
      return createErrorResponse(error, {
        operation: 'create_accountant_finding',
        workflowArea: body.workflowArea,
      }, 500)
    }

    return NextResponse.json(
      {
        id: finding.id,
        message: 'Finding created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error in POST /api/accountant/findings:', error)
    return createErrorResponse(error, { operation: 'create_accountant_finding' }, 500)
  }
}
