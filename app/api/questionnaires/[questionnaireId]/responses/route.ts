/**
 * POST /api/questionnaires/[questionnaireId]/responses
 *
 * Submit responses to a questionnaire and trigger re-analysis.
 *
 * Body:
 * - responses: Array<{question_id: string, response_value: any}>
 *
 * Returns:
 * - Updated questionnaire status
 * - Re-analysis trigger confirmation
 * - Updated confidence scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { questionnaireId: string } }
) {
  try {
    const { questionnaireId } = params;
    const body = await request.json();
    const { responses } = body;

    // Validate required parameters
    if (!responses || !Array.isArray(responses)) {
      return createValidationError('responses array is required');
    }

    // Get Supabase client
    const supabase = createServiceClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return createErrorResponse(
        new Error('Unauthorized'),
        { operation: 'submitResponses' },
        401
      );
    }

    // Fetch questionnaire
    const { data: questionnaire, error: questionnaireError } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('questionnaire_id', questionnaireId)
      .single();

    if (questionnaireError || !questionnaire) {
      return createErrorResponse(
        new Error('Questionnaire not found'),
        { questionnaireId },
        404
      );
    }

    // Insert responses
    const responseRecords = responses.map((r: any) => ({
      questionnaire_id: questionnaireId,
      question_id: r.question_id,
      response_value: r.response_value,
      responded_by_user_id: user.id,
      responded_at: new Date().toISOString(),
    }));

    const { error: responsesError } = await supabase
      .from('questionnaire_responses')
      .insert(responseRecords);

    if (responsesError) {
      throw responsesError;
    }

    // Update questionnaire status to completed
    const { error: updateError } = await supabase
      .from('questionnaires')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('questionnaire_id', questionnaireId);

    if (updateError) {
      throw updateError;
    }

    // Apply responses to source data
    // This updates the original transactions/contacts/assets with the collected information
    await applyResponsesToSourceData(supabase, questionnaire, responses);

    // Trigger re-analysis
    const reanalysisResult = await triggerReanalysis(
      supabase,
      questionnaire.tenant_id,
      questionnaire.category,
      questionnaire.created_from_analysis_id
    );

    return NextResponse.json({
      success: true,
      questionnaire_id: questionnaireId,
      responses_saved: responses.length,
      questionnaire_status: 'completed',
      reanalysis_triggered: reanalysisResult.triggered,
      reanalysis_id: reanalysisResult.analysis_id,
      message: 'Responses saved successfully. Re-analysis in progress.',
      metadata: {
        completedAt: new Date().toISOString(),
        completedBy: user.id,
      },
    });
  } catch (error) {
    console.error('Error submitting questionnaire responses:', error);

    return createErrorResponse(
      error,
      {
        operation: 'submitResponses',
        endpoint: '/api/questionnaires/[id]/responses',
      },
      500
    );
  }
}

/**
 * Apply questionnaire responses to source data
 * Updates transactions/contacts/assets with collected information
 */
async function applyResponsesToSourceData(
  supabase: any,
  questionnaire: any,
  responses: any[]
): Promise<void> {
  const category = questionnaire.category;

  for (const response of responses) {
    const questionId = response.question_id;
    const value = response.response_value;

    // Extract context from question ID
    // Format: {category}_{entity_id}_{field}
    const parts = questionId.split('_');

    if (category === 'fuel_tax_credits' && parts[0] === 'fuel') {
      const transactionId = parts[1];
      const field = parts.slice(2).join('_');

      // Update xero_transactions with fuel data
      const updateData: any = {};

      if (field === 'type') {
        // Store fuel type in raw_xero_data or description
        updateData.description = `${value} fuel`; // Append to description
      } else if (field === 'litres') {
        // Store litres in raw_xero_data JSONB
        updateData.raw_xero_data = { fuel_litres: value };
      } else if (field === 'business_use') {
        updateData.raw_xero_data = { business_use_percentage: value };
      } else if (field === 'off_road') {
        updateData.raw_xero_data = { is_off_road_use: value };
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('xero_transactions')
          .update(updateData)
          .eq('transaction_id', transactionId);
      }
    } else if (category === 'trust_distributions' && parts[0] === 'trust') {
      const contactId = parts[1];
      const field = parts.slice(2).join('_');

      // Update xero_contacts with relationship data
      const updateData: any = {};

      if (field === 'entity_type') {
        updateData.entity_type = value;
      } else if (field === 'related_party') {
        // Multiple choice - check if 'none' is NOT selected
        const relationships = Array.isArray(value) ? value : [value];
        updateData.is_related_party = !relationships.includes('none');
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('xero_contacts')
          .update(updateData)
          .eq('contact_id', contactId);
      }
    } else if (category === 'asset_classification' && parts[0] === 'asset') {
      const assetId = parts[1];
      const field = parts.slice(2).join('_');

      // Update xero_assets with depreciation preferences
      const updateData: any = {};

      if (field === 'instant_writeoff' && value === true) {
        updateData.depreciation_method = 'Full Depreciation'; // Instant write-off
      } else if (field === 'depreciation_method') {
        updateData.depreciation_method =
          value === 'diminishing_value' ? 'Diminishing Value' : 'Prime Cost';
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('xero_assets')
          .update(updateData)
          .eq('asset_id', assetId);
      }
    }
  }
}

/**
 * Trigger re-analysis after questionnaire completion
 */
async function triggerReanalysis(
  supabase: any,
  tenantId: string,
  category: string,
  originalAnalysisId?: string
): Promise<{ triggered: boolean; analysis_id?: string }> {
  // Based on category, call the appropriate analysis API endpoint
  // This would typically be done via a background job or webhook
  // For now, we'll just flag it for re-analysis

  // Insert re-analysis request into queue
  const { data, error } = await supabase
    .from('analysis_queue')
    .insert({
      tenant_id: tenantId,
      analysis_type: category,
      priority: 'high', // Questionnaire-triggered = high priority
      status: 'pending',
      created_at: new Date().toISOString(),
      triggered_by: 'questionnaire_completion',
      previous_analysis_id: originalAnalysisId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error queueing re-analysis:', error);
    return { triggered: false };
  }

  return {
    triggered: true,
    analysis_id: data.id,
  };
}
