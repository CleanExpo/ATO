/**
 * Confidence Score Calculator API
 *
 * POST /api/accountant/confidence-score - Calculate AI confidence score
 *
 * Implements confidence scoring algorithm from:
 * docs/compliance/validated-calculation-formulas.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

interface LegislationRef {
  section: string
  title: string
  url: string
}

interface PrecedentCase {
  citation: string
  outcome: 'favorable' | 'unfavorable' | 'neutral'
}

interface ConfidenceFactor {
  factor: string
  impact: 'positive' | 'negative'
  weight: number
}

/**
 * POST /api/accountant/confidence-score
 *
 * Calculate confidence score for a finding
 *
 * Body:
 * - legislationRefs: array of LegislationRef (required)
 * - precedentCases: array of PrecedentCase (optional)
 * - documentationQuality: 'excellent' | 'good' | 'adequate' | 'poor' (required)
 * - dataCompleteness: number 0-100 (required)
 * - transactionRegularity: 'regular' | 'irregular' | 'unusual' (optional)
 *
 * Returns:
 * - score: number 0-100
 * - level: 'High' | 'Medium' | 'Low'
 * - factors: array of ConfidenceFactor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.legislationRefs || !Array.isArray(body.legislationRefs)) {
      return createValidationError('legislationRefs must be an array')
    }

    if (!body.documentationQuality) {
      return createValidationError('documentationQuality is required')
    }

    if (typeof body.dataCompleteness !== 'number') {
      return createValidationError('dataCompleteness must be a number')
    }

    // Validate enum values
    const validQualities = ['excellent', 'good', 'adequate', 'poor']
    if (!validQualities.includes(body.documentationQuality)) {
      return createValidationError(`documentationQuality must be one of: ${validQualities.join(', ')}`)
    }

    const validRegularities = ['regular', 'irregular', 'unusual']
    if (body.transactionRegularity && !validRegularities.includes(body.transactionRegularity)) {
      return createValidationError(`transactionRegularity must be one of: ${validRegularities.join(', ')}`)
    }

    // Calculate confidence score using validated algorithm
    const result = calculateConfidenceScore({
      legislationRefs: body.legislationRefs,
      precedentCases: body.precedentCases || [],
      documentationQuality: body.documentationQuality,
      dataCompleteness: body.dataCompleteness,
      transactionRegularity: body.transactionRegularity || 'regular',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Unexpected error in POST /api/accountant/confidence-score:', error)
    return createErrorResponse(error, { operation: 'calculate_confidence_score' }, 500)
  }
}

/**
 * Confidence Score Calculation Algorithm
 *
 * Based on Formula CONF-001 from docs/compliance/validated-calculation-formulas.md
 *
 * Confidence = (L × 0.4) + (P × 0.25) + (D × 0.2) + (C × 0.15)
 *
 * Where:
 * - L = Legislation Score (0-100)
 * - P = Precedent Score (0-100)
 * - D = Documentation Quality Score (0-100)
 * - C = Data Completeness Score (0-100)
 */
function calculateConfidenceScore(params: {
  legislationRefs: LegislationRef[]
  precedentCases: PrecedentCase[]
  documentationQuality: string
  dataCompleteness: number
  transactionRegularity: string
}): {
  score: number
  level: 'High' | 'Medium' | 'Low'
  factors: ConfidenceFactor[]
} {
  const factors: ConfidenceFactor[] = []

  // 1. Legislation Score (L) - 40% weight
  let legislationScore = 0
  if (params.legislationRefs.length === 0) {
    legislationScore = 0
    factors.push({
      factor: 'No legislation references provided',
      impact: 'negative',
      weight: 0.4,
    })
  } else if (params.legislationRefs.length === 1) {
    legislationScore = 70
    factors.push({
      factor: `1 legislation reference: ${params.legislationRefs[0].section}`,
      impact: 'positive',
      weight: 0.4,
    })
  } else if (params.legislationRefs.length === 2) {
    legislationScore = 85
    factors.push({
      factor: `2 legislation references supporting finding`,
      impact: 'positive',
      weight: 0.4,
    })
  } else {
    legislationScore = 95
    factors.push({
      factor: `${params.legislationRefs.length} legislation references with strong support`,
      impact: 'positive',
      weight: 0.4,
    })
  }

  // 2. Precedent Score (P) - 25% weight
  let precedentScore = 50 // Neutral if no precedents
  if (params.precedentCases.length > 0) {
    const favorableCount = params.precedentCases.filter((c) => c.outcome === 'favorable').length
    const unfavorableCount = params.precedentCases.filter((c) => c.outcome === 'unfavorable').length
    const neutralCount = params.precedentCases.filter((c) => c.outcome === 'neutral').length

    if (favorableCount > unfavorableCount) {
      precedentScore = 80 + (favorableCount - unfavorableCount) * 5
      precedentScore = Math.min(precedentScore, 100)
      factors.push({
        factor: `${favorableCount} favorable precedent cases`,
        impact: 'positive',
        weight: 0.25,
      })
    } else if (unfavorableCount > favorableCount) {
      precedentScore = 30 - (unfavorableCount - favorableCount) * 5
      precedentScore = Math.max(precedentScore, 0)
      factors.push({
        factor: `${unfavorableCount} unfavorable precedent cases`,
        impact: 'negative',
        weight: 0.25,
      })
    } else {
      precedentScore = 50
      factors.push({
        factor: `${neutralCount} neutral or mixed precedent cases`,
        impact: 'positive',
        weight: 0.25,
      })
    }
  }

  // 3. Documentation Quality Score (D) - 20% weight
  let documentationScore = 0
  switch (params.documentationQuality) {
    case 'excellent':
      documentationScore = 100
      factors.push({
        factor: 'Excellent documentation quality (all supporting documents present)',
        impact: 'positive',
        weight: 0.2,
      })
      break
    case 'good':
      documentationScore = 80
      factors.push({
        factor: 'Good documentation quality (key documents present)',
        impact: 'positive',
        weight: 0.2,
      })
      break
    case 'adequate':
      documentationScore = 60
      factors.push({
        factor: 'Adequate documentation quality (minimal documents present)',
        impact: 'positive',
        weight: 0.2,
      })
      break
    case 'poor':
      documentationScore = 30
      factors.push({
        factor: 'Poor documentation quality (missing key documents)',
        impact: 'negative',
        weight: 0.2,
      })
      break
  }

  // 4. Data Completeness Score (C) - 15% weight
  const completenessScore = Math.max(0, Math.min(100, params.dataCompleteness))
  if (completenessScore >= 90) {
    factors.push({
      factor: `${completenessScore}% data completeness (very complete)`,
      impact: 'positive',
      weight: 0.15,
    })
  } else if (completenessScore >= 70) {
    factors.push({
      factor: `${completenessScore}% data completeness (mostly complete)`,
      impact: 'positive',
      weight: 0.15,
    })
  } else {
    factors.push({
      factor: `${completenessScore}% data completeness (incomplete data)`,
      impact: 'negative',
      weight: 0.15,
    })
  }

  // 5. Transaction Regularity Modifier (bonus/penalty)
  let regularityModifier = 0
  if (params.transactionRegularity === 'irregular') {
    regularityModifier = -5
    factors.push({
      factor: 'Irregular transaction pattern detected',
      impact: 'negative',
      weight: 0.05,
    })
  } else if (params.transactionRegularity === 'unusual') {
    regularityModifier = -10
    factors.push({
      factor: 'Unusual transaction pattern - requires additional scrutiny',
      impact: 'negative',
      weight: 0.1,
    })
  }

  // Calculate weighted score
  let score =
    legislationScore * 0.4 +
    precedentScore * 0.25 +
    documentationScore * 0.2 +
    completenessScore * 0.15 +
    regularityModifier

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, Math.round(score)))

  // Determine level
  let level: 'High' | 'Medium' | 'Low'
  if (score >= 80) {
    level = 'High'
  } else if (score >= 60) {
    level = 'Medium'
  } else {
    level = 'Low'
  }

  return {
    score,
    level,
    factors,
  }
}
