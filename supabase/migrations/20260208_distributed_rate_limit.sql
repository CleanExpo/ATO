-- Migration: Distributed rate limiting via Supabase
-- Date: 2026-02-08
-- Purpose: Replace in-memory rate limiting (ineffective in serverless) with
--          database-backed atomic rate limiting using PostgreSQL.
-- Finding: B-7 in COMPLIANCE_RISK_ASSESSMENT.md

-- ============================================================
-- 1. Rate limit entries table
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_entries (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_expires ON rate_limit_entries(expires_at);

-- ============================================================
-- 2. Atomic check-and-increment function
-- Single INSERT ... ON CONFLICT ensures no race conditions.
-- Returns: allowed (bool), current_count (int), reset_at (timestamptz)
-- ============================================================
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_expires TIMESTAMPTZ := v_now + (p_window_seconds || ' seconds')::INTERVAL;
    v_count INTEGER;
    v_reset TIMESTAMPTZ;
BEGIN
    INSERT INTO rate_limit_entries (key, count, window_start, expires_at)
    VALUES (p_key, 1, v_now, v_expires)
    ON CONFLICT (key) DO UPDATE SET
        count = CASE
            WHEN rate_limit_entries.expires_at < v_now THEN 1
            ELSE rate_limit_entries.count + 1
        END,
        window_start = CASE
            WHEN rate_limit_entries.expires_at < v_now THEN v_now
            ELSE rate_limit_entries.window_start
        END,
        expires_at = CASE
            WHEN rate_limit_entries.expires_at < v_now THEN v_expires
            ELSE rate_limit_entries.expires_at
        END
    RETURNING rate_limit_entries.count, rate_limit_entries.expires_at
    INTO v_count, v_reset;

    RETURN QUERY SELECT v_count <= p_limit, v_count, v_reset;
END;
$$;

-- ============================================================
-- 3. Cleanup function (run periodically via pg_cron or manually)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limit_entries WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- ============================================================
-- 4. RLS: Service role only (no user-facing access)
-- ============================================================
ALTER TABLE rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- No user-facing policies — only service role can access.
-- API routes use createServiceClient() which bypasses RLS.
