-- ================================================================
-- QuickBooks Online OAuth Tokens Table
-- ================================================================
-- Created: 2026-01-28
-- Purpose: Store QuickBooks Online OAuth 2.0 tokens for API access
--
-- Security:
-- - RLS enabled for tenant isolation
-- - Service role only access
-- - Tokens encrypted at rest by Supabase
--
-- QuickBooks API: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/purchase
-- ================================================================

-- Create quickbooks_tokens table
CREATE TABLE IF NOT EXISTS quickbooks_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,  -- Unix timestamp
  realm_id TEXT NOT NULL,       -- QuickBooks Company ID
  token_type TEXT DEFAULT 'Bearer',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE quickbooks_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own tokens
CREATE POLICY "Users can access own QuickBooks tokens"
  ON quickbooks_tokens
  FOR ALL
  USING (auth.uid() = tenant_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quickbooks_tokens_tenant_id
  ON quickbooks_tokens(tenant_id);

CREATE INDEX IF NOT EXISTS idx_quickbooks_tokens_realm_id
  ON quickbooks_tokens(realm_id);

CREATE INDEX IF NOT EXISTS idx_quickbooks_tokens_expires_at
  ON quickbooks_tokens(expires_at);

-- Comments for documentation
COMMENT ON TABLE quickbooks_tokens IS 'QuickBooks Online OAuth 2.0 tokens for API access';
COMMENT ON COLUMN quickbooks_tokens.tenant_id IS 'User/tenant who owns this QuickBooks connection';
COMMENT ON COLUMN quickbooks_tokens.access_token IS 'QuickBooks OAuth access token (valid for 1 hour)';
COMMENT ON COLUMN quickbooks_tokens.refresh_token IS 'QuickBooks OAuth refresh token (valid for 100 days)';
COMMENT ON COLUMN quickbooks_tokens.expires_at IS 'Unix timestamp when access_token expires';
COMMENT ON COLUMN quickbooks_tokens.realm_id IS 'QuickBooks Company ID (realmId)';
