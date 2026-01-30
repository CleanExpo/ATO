-- Phase 3.6: Create Questionnaires table
-- Interactive Questionnaire System for collecting missing tax data

CREATE TABLE IF NOT EXISTS public.questionnaires (
    questionnaire_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Questionnaire metadata
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- 'fuel_tax_credits', 'trust_distributions', 'asset_classification', etc.

    -- Questions (JSONB array of Question objects)
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Priority and impact
    priority TEXT NOT NULL DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
    priority_score INTEGER NOT NULL DEFAULT 50, -- 0-100 for sorting
    estimated_completion_time_minutes INTEGER NOT NULL DEFAULT 10,
    potential_tax_benefit DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- State tracking
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped'
    created_from_analysis_id TEXT, -- Which analysis triggered this questionnaire

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_questionnaires_tenant ON public.questionnaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_category ON public.questionnaires(category);
CREATE INDEX IF NOT EXISTS idx_questionnaires_status ON public.questionnaires(status);
CREATE INDEX IF NOT EXISTS idx_questionnaires_priority ON public.questionnaires(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_questionnaires_pending ON public.questionnaires(tenant_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_questionnaires_analysis ON public.questionnaires(created_from_analysis_id) WHERE created_from_analysis_id IS NOT NULL;

-- Index for JSONB questions array
CREATE INDEX IF NOT EXISTS idx_questionnaires_questions ON public.questionnaires USING GIN (questions);

-- Enable Row Level Security
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access questionnaires for their connected Xero tenants
CREATE POLICY "Users can view their own organisation's questionnaires"
    ON public.questionnaires
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policy: Users can insert questionnaires for their tenants (via admin/automated systems)
CREATE POLICY "Users can create questionnaires for their organisations"
    ON public.questionnaires
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policy: Users can update questionnaires for their tenants
CREATE POLICY "Users can update their own organisation's questionnaires"
    ON public.questionnaires
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.questionnaires_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questionnaires_updated_at
    BEFORE UPDATE ON public.questionnaires
    FOR EACH ROW
    EXECUTE FUNCTION public.questionnaires_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.questionnaires IS 'Interactive questionnaires generated from tax analysis to collect missing data and improve confidence scores.';
COMMENT ON COLUMN public.questionnaires.category IS 'Tax analysis category: fuel_tax_credits, trust_distributions, asset_classification, contact_relationships, superannuation, deductions, rnd_eligibility.';
COMMENT ON COLUMN public.questionnaires.questions IS 'JSONB array of Question objects with question_id, question_type, question_text, help_text, required, options, validation_rules, context.';
COMMENT ON COLUMN public.questionnaires.priority IS 'Priority level based on potential tax benefit and compliance risk.';
COMMENT ON COLUMN public.questionnaires.priority_score IS 'Numeric score 0-100 for sorting. Higher = more important.';
COMMENT ON COLUMN public.questionnaires.potential_tax_benefit IS 'Estimated dollar value if questionnaire completed and applied. Used for ROI prioritization.';
COMMENT ON COLUMN public.questionnaires.status IS 'Workflow state: pending (not started), in_progress (user started answering), completed (submitted), skipped (user dismissed).';
COMMENT ON COLUMN public.questionnaires.created_from_analysis_id IS 'FK to the analysis that identified data gaps and triggered this questionnaire (e.g., fuel_tax_credits_analysis.id).';
