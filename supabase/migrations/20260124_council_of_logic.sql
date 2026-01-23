-- Council of Logic Database Schema
--
-- Supporting tables for the meta-orchestration system with 4 advisors:
-- - Alan Turing (algorithmic efficiency)
-- - John von Neumann (game theory/conversion)
-- - Pierre Bezier (animation physics)
-- - Claude Shannon (information theory)

-- =============================================================================
-- COUNCIL SESSIONS
-- Records each time the council convenes to make a decision
-- =============================================================================
CREATE TABLE IF NOT EXISTS council_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Context of the decision
  context JSONB NOT NULL DEFAULT '{}',

  -- Individual advisor recommendations
  advisor_recommendations JSONB NOT NULL DEFAULT '[]',

  -- Final synthesised decision
  final_decision TEXT,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for organisation lookups
CREATE INDEX IF NOT EXISTS idx_council_sessions_org
  ON council_sessions(organisation_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_council_sessions_started
  ON council_sessions(started_at DESC);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_council_sessions_user
  ON council_sessions(user_id)
  WHERE user_id IS NOT NULL;

-- =============================================================================
-- CONVERSION EVENTS
-- Tracks user journey through the conversion funnel (von Neumann advisor)
-- =============================================================================
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Conversion funnel stage
  stage TEXT NOT NULL CHECK (stage IN (
    'awareness',
    'interest',
    'decision',
    'action',
    'retention'
  )),

  -- Specific action taken
  action TEXT NOT NULL,

  -- Monetary value (if applicable)
  value DECIMAL(12,2),

  -- Additional context
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for organisation + stage queries
CREATE INDEX IF NOT EXISTS idx_conversion_events_org_stage
  ON conversion_events(organisation_id, stage);

-- Index for user journey analysis
CREATE INDEX IF NOT EXISTS idx_conversion_events_user
  ON conversion_events(user_id, created_at DESC);

-- Index for time-based funnel analysis
CREATE INDEX IF NOT EXISTS idx_conversion_events_time
  ON conversion_events(organisation_id, created_at DESC);

-- =============================================================================
-- ADVISOR METRICS
-- Performance tracking for each advisor
-- =============================================================================
CREATE TABLE IF NOT EXISTS advisor_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which advisor generated this metric
  advisor TEXT NOT NULL CHECK (advisor IN (
    'turing',
    'von-neumann',
    'bezier',
    'shannon'
  )),

  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Metric name and value
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(12,4) NOT NULL,

  -- When recorded
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for advisor performance queries
CREATE INDEX IF NOT EXISTS idx_advisor_metrics_org_advisor
  ON advisor_metrics(organisation_id, advisor);

-- Index for time-series analysis
CREATE INDEX IF NOT EXISTS idx_advisor_metrics_time
  ON advisor_metrics(organisation_id, recorded_at DESC);

-- Composite index for specific metric queries
CREATE INDEX IF NOT EXISTS idx_advisor_metrics_lookup
  ON advisor_metrics(organisation_id, advisor, metric_name, recorded_at DESC);

-- =============================================================================
-- FUNNEL STAGE TRANSITIONS
-- Tracks when users move between funnel stages
-- =============================================================================
CREATE TABLE IF NOT EXISTS funnel_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Stage movement
  from_stage TEXT NOT NULL CHECK (from_stage IN (
    'awareness', 'interest', 'decision', 'action', 'retention'
  )),
  to_stage TEXT NOT NULL CHECK (to_stage IN (
    'awareness', 'interest', 'decision', 'action', 'retention'
  )),

  -- Time spent in previous stage (seconds)
  time_in_stage INTEGER,

  -- What triggered the transition
  trigger_action TEXT,

  -- Timing
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for funnel analysis
CREATE INDEX IF NOT EXISTS idx_funnel_transitions_org
  ON funnel_transitions(organisation_id, transitioned_at DESC);

-- Index for user journey tracking
CREATE INDEX IF NOT EXISTS idx_funnel_transitions_user
  ON funnel_transitions(user_id, transitioned_at DESC);

-- =============================================================================
-- ALGORITHMIC ANALYSIS CACHE (Turing advisor)
-- Caches complexity analysis results to avoid recomputation
-- =============================================================================
CREATE TABLE IF NOT EXISTS algorithmic_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Operation identifier (hash of the operation context)
  operation_hash TEXT NOT NULL,

  -- Analysis results
  time_complexity TEXT NOT NULL,
  space_complexity TEXT NOT NULL,
  bottlenecks JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',

  -- Cache validity
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_algorithmic_cache_lookup
  ON algorithmic_cache(organisation_id, operation_hash);

-- Index for cache expiry cleanup
CREATE INDEX IF NOT EXISTS idx_algorithmic_cache_expiry
  ON algorithmic_cache(expires_at);

-- =============================================================================
-- ANIMATION CONFIGS (Bezier advisor)
-- Stores validated animation configurations
-- =============================================================================
CREATE TABLE IF NOT EXISTS animation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Configuration details
  name TEXT NOT NULL,
  element_type TEXT NOT NULL,
  animation_type TEXT NOT NULL,

  -- Physics configuration
  config JSONB NOT NULL,

  -- Validation status
  physics_valid BOOLEAN NOT NULL DEFAULT true,
  fps60_compatible BOOLEAN NOT NULL DEFAULT true,
  performance_impact TEXT CHECK (performance_impact IN ('minimal', 'moderate', 'significant')),

  -- Usage tracking
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for config lookups
CREATE INDEX IF NOT EXISTS idx_animation_configs_lookup
  ON animation_configs(organisation_id, element_type, animation_type);

-- =============================================================================
-- TOKEN USAGE TRACKING (Shannon advisor)
-- Tracks token consumption for cost optimisation
-- =============================================================================
CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Model and operation
  model_tier TEXT NOT NULL CHECK (model_tier IN ('haiku', 'sonnet', 'opus')),
  operation_type TEXT NOT NULL,

  -- Token counts
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,

  -- Efficiency metrics
  efficiency_score DECIMAL(3,2) CHECK (efficiency_score >= 0 AND efficiency_score <= 1),
  compression_ratio DECIMAL(5,2),

  -- Cost (USD)
  estimated_cost DECIMAL(10,6),

  -- Timing
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for usage analysis
CREATE INDEX IF NOT EXISTS idx_token_usage_org
  ON token_usage(organisation_id, recorded_at DESC);

-- Index for model-specific analysis
CREATE INDEX IF NOT EXISTS idx_token_usage_model
  ON token_usage(organisation_id, model_tier, recorded_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE council_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithmic_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE animation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for council_sessions
CREATE POLICY "Users can view their organisation's council sessions"
  ON council_sessions FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage council sessions"
  ON council_sessions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for conversion_events
CREATE POLICY "Users can view their organisation's conversion events"
  ON conversion_events FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage conversion events"
  ON conversion_events FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for advisor_metrics
CREATE POLICY "Users can view their organisation's advisor metrics"
  ON advisor_metrics FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage advisor metrics"
  ON advisor_metrics FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for funnel_transitions
CREATE POLICY "Users can view their organisation's funnel transitions"
  ON funnel_transitions FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage funnel transitions"
  ON funnel_transitions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for algorithmic_cache
CREATE POLICY "Users can view their organisation's algorithmic cache"
  ON algorithmic_cache FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage algorithmic cache"
  ON algorithmic_cache FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for animation_configs
CREATE POLICY "Users can view their organisation's animation configs"
  ON animation_configs FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage animation configs"
  ON animation_configs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for token_usage
CREATE POLICY "Users can view their organisation's token usage"
  ON token_usage FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage token usage"
  ON token_usage FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to calculate conversion rate between stages
CREATE OR REPLACE FUNCTION calculate_conversion_rate(
  p_organisation_id UUID,
  p_from_stage TEXT,
  p_to_stage TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DECIMAL AS $$
DECLARE
  from_count INTEGER;
  to_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO from_count
  FROM conversion_events
  WHERE organisation_id = p_organisation_id
    AND stage = p_from_stage
    AND created_at BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(*) INTO to_count
  FROM conversion_events
  WHERE organisation_id = p_organisation_id
    AND stage = p_to_stage
    AND created_at BETWEEN p_start_date AND p_end_date;

  IF from_count = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND(to_count::DECIMAL / from_count::DECIMAL, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get advisor performance summary
CREATE OR REPLACE FUNCTION get_advisor_performance(
  p_organisation_id UUID,
  p_advisor TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  avg_confidence DECIMAL,
  total_recommendations INTEGER,
  latest_recorded_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG(metric_value)::DECIMAL, 4) as avg_confidence,
    COUNT(*)::INTEGER as total_recommendations,
    MAX(recorded_at) as latest_recorded_at
  FROM advisor_metrics
  WHERE organisation_id = p_organisation_id
    AND advisor = p_advisor
    AND metric_name = 'confidence'
    AND recorded_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- CLEANUP JOBS (for expired cache entries)
-- =============================================================================

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM algorithmic_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE council_sessions IS 'Records each Council of Logic decision session';
COMMENT ON TABLE conversion_events IS 'User conversion funnel events (von Neumann advisor)';
COMMENT ON TABLE advisor_metrics IS 'Performance tracking for individual advisors';
COMMENT ON TABLE funnel_transitions IS 'Stage-to-stage transitions in conversion funnel';
COMMENT ON TABLE algorithmic_cache IS 'Cache for Turing advisor complexity analysis';
COMMENT ON TABLE animation_configs IS 'Validated animation configurations (Bezier advisor)';
COMMENT ON TABLE token_usage IS 'Token consumption tracking (Shannon advisor)';
