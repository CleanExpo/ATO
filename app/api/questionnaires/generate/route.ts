/**
 * POST /api/questionnaires/generate
 *
 * Generate questionnaires from analysis results to fill data gaps.
 * Called automatically after analysis completion or manually by user.
 *
 * Body:
 * - tenantId: string (required) - Xero tenant/organisation ID
 * - analysisId: string (required) - ID of analysis that identified data gaps
 * - analysisType: string (required) - Type of analysis (fuel_tax_credits, trust_distributions, etc.)
 * - dataGaps: object (required) - Analysis-specific data gap information
 *
 * Returns:
 * - Generated questionnaires with priority ordering
 * - Insertion confirmation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import {
  generateFuelTaxCreditQuestionnaire,
  generateTrustDistributionQuestionnaire,
  generateAssetClassificationQuestionnaire,
  generateContactRelationshipsQuestionnaire,
  generateSuperannuationQuestionnaire,
  generateDeductionQuestionnaire,
  generateRndEligibilityQuestionnaire,
  prioritizeQuestionnaires,
  type Questionnaire,
} from '@/lib/questionnaire/questionnaire-generator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, analysisId, analysisType, dataGaps } = body;

    // Validate required parameters
    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required and must be a string');
    }

    if (!analysisId || typeof analysisId !== 'string') {
      return createValidationError('analysisId is required and must be a string');
    }

    if (!analysisType || typeof analysisType !== 'string') {
      return createValidationError('analysisType is required and must be a string');
    }

    if (!dataGaps || typeof dataGaps !== 'object') {
      return createValidationError('dataGaps is required and must be an object');
    }

    // Get Supabase client
    const supabase = await createServiceClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return createErrorResponse(
        new Error('Unauthorized'),
        { operation: 'generateQuestionnaires' },
        401
      );
    }

    // Generate questionnaires based on analysis type
    const questionnaires: Questionnaire[] = [];

    switch (analysisType) {
      case 'fuel_tax_credits':
        if (dataGaps.lowConfidenceTransactions && dataGaps.lowConfidenceTransactions.length > 0) {
          const questionnaire = generateFuelTaxCreditQuestionnaire(
            tenantId,
            analysisId,
            dataGaps.missingDataFlags || [],
            dataGaps.lowConfidenceTransactions
          );
          questionnaires.push(questionnaire);
        }
        break;

      case 'trust_distributions':
        if (dataGaps.beneficiaries && dataGaps.beneficiaries.length > 0) {
          const questionnaire = generateTrustDistributionQuestionnaire(
            tenantId,
            analysisId,
            dataGaps.beneficiaries
          );
          questionnaires.push(questionnaire);
        }
        break;

      case 'asset_classification':
        if (dataGaps.assets && dataGaps.assets.length > 0) {
          const questionnaire = generateAssetClassificationQuestionnaire(
            tenantId,
            analysisId,
            dataGaps.assets
          );
          questionnaires.push(questionnaire);
        }
        break;

      case 'contact_relationships':
        if (dataGaps.contacts && dataGaps.contacts.length > 0) {
          const questionnaire = generateContactRelationshipsQuestionnaire(
            tenantId,
            analysisId,
            dataGaps.contacts
          );
          questionnaires.push(questionnaire);
        }
        break;

      case 'superannuation':
        if (dataGaps.employees && dataGaps.employees.length > 0) {
          const questionnaire = generateSuperannuationQuestionnaire(
            tenantId,
            analysisId,
            dataGaps.employees
          );
          questionnaires.push(questionnaire);
        }
        break;

      case 'deductions':
        if (dataGaps.expenses && dataGaps.expenses.length > 0) {
          const questionnaire = generateDeductionQuestionnaire(
            tenantId,
            analysisId,
            dataGaps.expenses
          );
          questionnaires.push(questionnaire);
        }
        break;

      case 'rnd_eligibility':
        if (dataGaps.activities && dataGaps.activities.length > 0) {
          const questionnaire = generateRndEligibilityQuestionnaire(
            tenantId,
            analysisId,
            dataGaps.activities
          );
          questionnaires.push(questionnaire);
        }
        break;

      default:
        return createValidationError(
          `Unsupported analysis type: ${analysisType}. Supported types: fuel_tax_credits, trust_distributions, asset_classification, contact_relationships, superannuation, deductions, rnd_eligibility`
        );
    }

    // If no questionnaires generated, return early
    if (questionnaires.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No questionnaires needed - analysis has sufficient data quality',
        questionnaires_generated: 0,
        metadata: {
          generatedAt: new Date().toISOString(),
          tenantId,
          analysisType,
          analysisId,
        },
      });
    }

    // Prioritize questionnaires
    const prioritizedQuestionnaires = prioritizeQuestionnaires(questionnaires);

    // Calculate priority scores (0-100) based on priority level and tax benefit
    const questionnairesWithScores = prioritizedQuestionnaires.map((q) => {
      let baseScore = 50;
      if (q.priority === 'critical') baseScore = 90;
      else if (q.priority === 'high') baseScore = 70;
      else if (q.priority === 'medium') baseScore = 50;
      else if (q.priority === 'low') baseScore = 30;

      // Adjust score based on tax benefit (normalize to 0-10 bonus)
      const benefitBonus = Math.min(10, Math.floor(q.potential_tax_benefit / 1000));

      return {
        ...q,
        priority_score: baseScore + benefitBonus,
      };
    });

    // Insert questionnaires into database
    const { error: insertError } = await supabase
      .from('questionnaires')
      .insert(questionnairesWithScores);

    if (insertError) {
      throw insertError;
    }

    // Calculate summary statistics
    const totalQuestions = questionnairesWithScores.reduce(
      (sum, q) => sum + q.questions.length,
      0
    );
    const totalPotentialBenefit = questionnairesWithScores.reduce(
      (sum, q) => sum + q.potential_tax_benefit,
      0
    );
    const totalEstimatedTime = questionnairesWithScores.reduce(
      (sum, q) => sum + q.estimated_completion_time_minutes,
      0
    );

    return NextResponse.json({
      success: true,
      questionnaires_generated: questionnairesWithScores.length,
      questionnaires: questionnairesWithScores.map((q) => ({
        questionnaire_id: q.questionnaire_id,
        title: q.title,
        priority: q.priority,
        priority_score: q.priority_score,
        question_count: q.questions.length,
        potential_tax_benefit: q.potential_tax_benefit,
        estimated_time_minutes: q.estimated_completion_time_minutes,
      })),
      summary: {
        total_questions: totalQuestions,
        total_potential_benefit: totalPotentialBenefit,
        total_estimated_time_minutes: totalEstimatedTime,
        avg_questions_per_questionnaire: Math.round(
          totalQuestions / questionnairesWithScores.length
        ),
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        tenantId,
        analysisType,
        analysisId,
        generatedBy: user.id,
      },
    });
  } catch (error) {
    console.error('Error generating questionnaires:', error);

    return createErrorResponse(
      error,
      {
        operation: 'generateQuestionnaires',
        endpoint: '/api/questionnaires/generate',
      },
      500
    );
  }
}
