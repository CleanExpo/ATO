-- Phase 3.6: Create Analysis Queue table
-- Background job queue for re-running analysis after questionnaire completion

CREATE TABLE IF NOT EXISTS public.analysis_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Analysis configuration
    analysis_type TEXT NOT NULL, -- 'fuel_tax_credits', 'trust_distributions', 'superannuation_caps', etc.
    priority TEXT NOT NULL DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'

    -- Queue state
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'

    -- Execution tracking
    triggered_by TEXT, -- 'questionnaire_completion', 'manual_request', 'scheduled_refresh'
    previous_analysis_id TEXT, -- ID of original analysis that triggered questionnaire
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Result tracking
    new_analysis_id TEXT, -- ID of re-analysis result after processing
    improvement_summary JSONB, -- Before/after comparison: confidence_increased, new_findings, etc.

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Retry tracking
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    last_retry_at TIMESTAMPTZ
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_analysis_queue_tenant ON public.analysis_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_status ON public.analysis_queue(status);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_type ON public.analysis_queue(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_priority ON public.analysis_queue(priority);

-- Index for queue workers: pending jobs ordered by priority and creation time
CREATE INDEX IF NOT EXISTS idx_analysis_queue_pending ON public.analysis_queue(created_at ASC)
    WHERE status = 'pending';

-- Index for high-priority pending jobs
CREATE INDEX IF NOT EXISTS idx_analysis_queue_priority_pending ON public.analysis_queue(created_at ASC)
    WHERE status = 'pending' AND priority IN ('critical', 'high');

-- Index for failed jobs that can be retried
CREATE INDEX IF NOT EXISTS idx_analysis_queue_failed_retryable ON public.analysis_queue(created_at ASC)
    WHERE status = 'failed' AND retry_count < max_retries;

-- Index for JSONB improvement_summary
CREATE INDEX IF NOT EXISTS idx_analysis_queue_improvements ON public.analysis_queue USING GIN (improvement_summary);

-- Enable Row Level Security
ALTER TABLE public.analysis_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view queue jobs for their tenants
CREATE POLICY "Users can view queue jobs for their organisations"
    ON public.analysis_queue
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policy: Users can insert queue jobs for their tenants
CREATE POLICY "Users can create queue jobs for their organisations"
    ON public.analysis_queue
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policy: Service role can update queue jobs (for background workers)
-- Note: Background workers will use service role bypass RLS
CREATE POLICY "Service role can update queue jobs"
    ON public.analysis_queue
    FOR UPDATE
    USING (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.analysis_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analysis_queue_updated_at
    BEFORE UPDATE ON public.analysis_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.analysis_queue_updated_at();

-- Trigger to automatically mark old pending jobs as stale (24 hours)
CREATE OR REPLACE FUNCTION public.analysis_queue_mark_stale()
RETURNS void AS $$
BEGIN
    UPDATE public.analysis_queue
    SET status = 'cancelled',
        error_message = 'Job stale: exceeded 24-hour pending timeout'
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE public.analysis_queue IS 'Background job queue for re-running tax analysis after questionnaire completion. Enables improved confidence scores with collected data.';
COMMENT ON COLUMN public.analysis_queue.analysis_type IS 'Type of analysis to run: fuel_tax_credits, trust_distributions, superannuation_caps, asset_classification, etc. Maps to specific analyzer functions.';
COMMENT ON COLUMN public.analysis_queue.priority IS 'Job priority. Critical/high priority jobs run first. Set by questionnaire.priority or manual override.';
COMMENT ON COLUMN public.analysis_queue.status IS 'Queue state: pending (waiting), processing (running), completed (success), failed (error), cancelled (timeout/manual).';
COMMENT ON COLUMN public.analysis_queue.triggered_by IS 'What triggered this re-analysis: questionnaire_completion (most common), manual_request, scheduled_refresh.';
COMMENT ON COLUMN public.analysis_queue.previous_analysis_id IS 'ID of original analysis that identified data gaps and created questionnaire. Used to compare before/after confidence.';
COMMENT ON COLUMN public.analysis_queue.new_analysis_id IS 'ID of new analysis result after processing queue job. NULL until completed.';
COMMENT ON COLUMN public.analysis_queue.improvement_summary IS 'JSONB summary: {confidence_before: 60, confidence_after: 90, new_findings_count: 5, additional_benefit: 12500}. Shows impact of questionnaire.';
COMMENT ON COLUMN public.analysis_queue.retry_count IS 'Number of retry attempts. Max 3 by default. Failed jobs can be retried automatically.';
