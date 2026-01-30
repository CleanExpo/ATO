-- Phase 3.6: Create Questionnaire Responses table
-- Stores user answers to questionnaire questions

CREATE TABLE IF NOT EXISTS public.questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    questionnaire_id TEXT NOT NULL REFERENCES public.questionnaires(questionnaire_id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,

    -- Response data (JSONB to handle multiple types: string, number, boolean, array)
    response_value JSONB NOT NULL,

    -- Audit trail
    responded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: One response per question per questionnaire
    UNIQUE(questionnaire_id, question_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_questionnaire ON public.questionnaire_responses(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_user ON public.questionnaire_responses(responded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_time ON public.questionnaire_responses(responded_at DESC);

-- Index for JSONB response_value
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_value ON public.questionnaire_responses USING GIN (response_value);

-- Enable Row Level Security
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view responses for questionnaires in their connected tenants
CREATE POLICY "Users can view responses for their organisation's questionnaires"
    ON public.questionnaire_responses
    FOR SELECT
    USING (
        questionnaire_id IN (
            SELECT questionnaire_id
            FROM public.questionnaires
            WHERE tenant_id IN (
                SELECT tenant_id
                FROM public.xero_connections
                WHERE user_id = auth.uid()
            )
        )
    );

-- RLS Policy: Users can insert responses for their tenants
CREATE POLICY "Users can submit responses for their organisations"
    ON public.questionnaire_responses
    FOR INSERT
    WITH CHECK (
        questionnaire_id IN (
            SELECT questionnaire_id
            FROM public.questionnaires
            WHERE tenant_id IN (
                SELECT tenant_id
                FROM public.xero_connections
                WHERE user_id = auth.uid()
            )
        )
        AND responded_by_user_id = auth.uid()
    );

-- RLS Policy: Users can update their own responses
CREATE POLICY "Users can update their own responses"
    ON public.questionnaire_responses
    FOR UPDATE
    USING (
        responded_by_user_id = auth.uid()
        AND questionnaire_id IN (
            SELECT questionnaire_id
            FROM public.questionnaires
            WHERE tenant_id IN (
                SELECT tenant_id
                FROM public.xero_connections
                WHERE user_id = auth.uid()
            )
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.questionnaire_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questionnaire_responses_updated_at
    BEFORE UPDATE ON public.questionnaire_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.questionnaire_responses_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.questionnaire_responses IS 'User responses to questionnaire questions. Stored in JSONB to handle multiple data types (string, number, boolean, array for multiple_choice).';
COMMENT ON COLUMN public.questionnaire_responses.question_id IS 'Corresponds to Question.question_id in the questionnaire.questions JSONB array. Format examples: fuel_{transaction_id}_type, trust_{contact_id}_entity_type.';
COMMENT ON COLUMN public.questionnaire_responses.response_value IS 'JSONB value: string for text/single_choice, number for number_input/percentage_input, boolean for yes_no, array of strings for multiple_choice.';
COMMENT ON COLUMN public.questionnaire_responses.responded_by_user_id IS 'Which user submitted this response. Critical for audit trail and compliance tracking.';
