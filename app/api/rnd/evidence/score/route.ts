/**
 * R&D Evidence Score API
 *
 * GET /api/rnd/evidence/score?tenantId=X&registrationId=Y&projectName=Z
 *
 * Calculates and returns evidence sufficiency scores for Division 355 four-element test.
 * Scores are calculated based on:
 * - Number of evidence items per element (0-3 = low, 4-6 = medium, 7+ = high)
 * - Document uploads (bonus points)
 * - Contemporaneous evidence (bonus points)
 * - Description quality (text length proxy)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import {
  type EvidenceElement,
  type RndEvidenceScore,
  EVIDENCE_ELEMENTS,
  getScoreLevel,
} from '@/lib/types/rnd-evidence'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:rnd:evidence:score')

// Score calculation constants
const MIN_EVIDENCE_FOR_LOW = 1
const MIN_EVIDENCE_FOR_MEDIUM = 4
const MIN_EVIDENCE_FOR_HIGH = 7

const BASE_SCORE_LOW = 25
const BASE_SCORE_MEDIUM = 50
const BASE_SCORE_HIGH = 75

const DOCUMENT_BONUS = 5      // Per document upload
const CONTEMPORANEOUS_BONUS = 10 // Per contemporaneous evidence
const DESCRIPTION_BONUS_MAX = 10 // For detailed descriptions

/**
 * GET /api/rnd/evidence/score
 *
 * Calculate and return evidence sufficiency scores.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - registrationId?: string (optional)
 * - projectName?: string (optional)
 * - recalculate?: boolean (optional, default: true)
 *
 * Response:
 * - scores: Array of RndEvidenceScore
 * - elementBreakdown: Per-element evidence details
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get('tenantId')
    const registrationId = searchParams.get('registrationId')
    const projectName = searchParams.get('projectName')
    const recalculate = searchParams.get('recalculate') !== 'false'

    if (!tenantId) {
      return createValidationError('tenantId is required')
    }

    log.info('Calculating scores', { tenantId })

    const supabase = await createServiceClient()

    // Fetch all evidence for the tenant/registration/project
    let evidenceQuery = supabase
      .from('rnd_evidence')
      .select('*')
      .eq('tenant_id', tenantId)

    if (registrationId) {
      evidenceQuery = evidenceQuery.eq('registration_id', registrationId)
    }

    if (projectName) {
      evidenceQuery = evidenceQuery.eq('project_name', projectName)
    }

    const { data: evidenceData, error: evidenceError } = await evidenceQuery

    if (evidenceError) {
      console.error('[R&D Evidence Score] Evidence fetch error:', evidenceError)
      return createErrorResponse(evidenceError, { operation: 'fetchEvidence' }, 500)
    }

    const evidence = evidenceData || []

    // Group evidence by project and element
    interface EvidenceStats {
      count: number
      documentCount: number
      contemporaneousCount: number
      totalDescriptionLength: number
    }

    interface ProjectScores {
      elements: Record<EvidenceElement, EvidenceStats>
      registrationId: string | null
    }

    const projectMap = new Map<string, ProjectScores>()

    evidence.forEach((e) => {
      const pName = e.project_name as string
      if (!projectMap.has(pName)) {
        projectMap.set(pName, {
          registrationId: e.registration_id as string | null,
          elements: {
            outcome_unknown: { count: 0, documentCount: 0, contemporaneousCount: 0, totalDescriptionLength: 0 },
            systematic_approach: { count: 0, documentCount: 0, contemporaneousCount: 0, totalDescriptionLength: 0 },
            new_knowledge: { count: 0, documentCount: 0, contemporaneousCount: 0, totalDescriptionLength: 0 },
            scientific_method: { count: 0, documentCount: 0, contemporaneousCount: 0, totalDescriptionLength: 0 },
          },
        })
      }

      const project = projectMap.get(pName)!
      const element = e.element as EvidenceElement
      const stats = project.elements[element]

      if (stats) {
        stats.count++
        if (e.evidence_type === 'document') {
          stats.documentCount++
        }
        if (e.is_contemporaneous) {
          stats.contemporaneousCount++
        }
        if (e.description) {
          stats.totalDescriptionLength += (e.description as string).length
        }
      }
    })

    // Calculate scores for each project
    const scores: Array<RndEvidenceScore & { elementBreakdown: Record<EvidenceElement, { score: number; level: string; evidenceCount: number }> }> = []

    for (const [pName, projectData] of projectMap.entries()) {
      const elementScores: Record<EvidenceElement, number> = {
        outcome_unknown: 0,
        systematic_approach: 0,
        new_knowledge: 0,
        scientific_method: 0,
      }

      const elementBreakdown: Record<EvidenceElement, { score: number; level: string; evidenceCount: number }> = {
        outcome_unknown: { score: 0, level: 'insufficient', evidenceCount: 0 },
        systematic_approach: { score: 0, level: 'insufficient', evidenceCount: 0 },
        new_knowledge: { score: 0, level: 'insufficient', evidenceCount: 0 },
        scientific_method: { score: 0, level: 'insufficient', evidenceCount: 0 },
      }

      EVIDENCE_ELEMENTS.forEach((element) => {
        const stats = projectData.elements[element]
        let score = 0

        // Base score from count
        if (stats.count >= MIN_EVIDENCE_FOR_HIGH) {
          score = BASE_SCORE_HIGH
        } else if (stats.count >= MIN_EVIDENCE_FOR_MEDIUM) {
          score = BASE_SCORE_MEDIUM
        } else if (stats.count >= MIN_EVIDENCE_FOR_LOW) {
          score = BASE_SCORE_LOW
        }

        // Bonus for document uploads (capped at 15 points)
        score += Math.min(stats.documentCount * DOCUMENT_BONUS, 15)

        // Bonus for contemporaneous evidence (capped at 20 points)
        score += Math.min(stats.contemporaneousCount * CONTEMPORANEOUS_BONUS, 20)

        // Bonus for detailed descriptions (based on average length)
        if (stats.count > 0) {
          const avgDescLength = stats.totalDescriptionLength / stats.count
          const descBonus = Math.min((avgDescLength / 200) * DESCRIPTION_BONUS_MAX, DESCRIPTION_BONUS_MAX)
          score += descBonus
        }

        // Cap score at 100
        score = Math.min(Math.round(score), 100)

        elementScores[element] = score
        elementBreakdown[element] = {
          score,
          level: getScoreLevel(score).level,
          evidenceCount: stats.count,
        }
      })

      // Calculate overall score (weighted average)
      const overallScore = Math.round(
        (elementScores.outcome_unknown +
          elementScores.systematic_approach +
          elementScores.new_knowledge +
          elementScores.scientific_method) /
          4
      )

      // Save or update scores in database if recalculate is true
      if (recalculate) {
        const scoreRecord = {
          tenant_id: tenantId,
          registration_id: projectData.registrationId,
          project_name: pName,
          outcome_unknown_score: elementScores.outcome_unknown,
          systematic_approach_score: elementScores.systematic_approach,
          new_knowledge_score: elementScores.new_knowledge,
          scientific_method_score: elementScores.scientific_method,
          overall_score: overallScore,
          last_calculated: new Date().toISOString(),
        }

        // Check if score record exists
        const { data: existingScore } = await supabase
          .from('rnd_evidence_scores')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('project_name', pName)
          .single()

        if (existingScore) {
          await supabase
            .from('rnd_evidence_scores')
            .update(scoreRecord)
            .eq('id', existingScore.id)
        } else {
          await supabase
            .from('rnd_evidence_scores')
            .insert(scoreRecord)
        }
      }

      scores.push({
        id: '', // Will be populated from DB or is temporary
        tenantId,
        registrationId: projectData.registrationId,
        projectName: pName,
        outcomeUnknownScore: elementScores.outcome_unknown,
        systematicApproachScore: elementScores.systematic_approach,
        newKnowledgeScore: elementScores.new_knowledge,
        scientificMethodScore: elementScores.scientific_method,
        overallScore,
        lastCalculated: new Date().toISOString(),
        elementBreakdown,
      })
    }

    // If no evidence found, return empty scores for the specified project
    if (scores.length === 0 && projectName) {
      const emptyBreakdown: Record<EvidenceElement, { score: number; level: string; evidenceCount: number }> = {
        outcome_unknown: { score: 0, level: 'insufficient', evidenceCount: 0 },
        systematic_approach: { score: 0, level: 'insufficient', evidenceCount: 0 },
        new_knowledge: { score: 0, level: 'insufficient', evidenceCount: 0 },
        scientific_method: { score: 0, level: 'insufficient', evidenceCount: 0 },
      }

      scores.push({
        id: '',
        tenantId,
        registrationId: registrationId || null,
        projectName,
        outcomeUnknownScore: 0,
        systematicApproachScore: 0,
        newKnowledgeScore: 0,
        scientificMethodScore: 0,
        overallScore: 0,
        lastCalculated: new Date().toISOString(),
        elementBreakdown: emptyBreakdown,
      })
    }

    return NextResponse.json({
      scores,
      summary: {
        totalProjects: scores.length,
        averageOverallScore:
          scores.length > 0
            ? Math.round(scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length)
            : 0,
        projectsBySufficiency: {
          insufficient: scores.filter((s) => s.overallScore <= 40).length,
          adequate: scores.filter((s) => s.overallScore > 40 && s.overallScore <= 70).length,
          strong: scores.filter((s) => s.overallScore > 70).length,
        },
      },
    })
  } catch (error) {
    console.error('[R&D Evidence Score] Error:', error)
    return createErrorResponse(error, { operation: 'calculateScore' }, 500)
  }
}
