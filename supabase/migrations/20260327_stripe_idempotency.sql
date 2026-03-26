-- =============================================================================
-- Migration: Stripe Webhook Idempotency
-- Description: Prevents duplicate processing of Stripe webhook events
-- =============================================================================

-- Table to track processed Stripe webhook events
CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at
    ON public.stripe_processed_events(processed_at);

-- RLS: Only service role can read/write
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access only"
    ON public.stripe_processed_events
    FOR ALL
    USING (auth.role() = 'service_role');

-- Cleanup function: remove events older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_stripe_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.stripe_processed_events
    WHERE processed_at < now() - INTERVAL '30 days';
END;
$$;
