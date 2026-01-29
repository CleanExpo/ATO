/**
 * MYOB Connections Table
 *
 * Stores MYOB AccountRight OAuth connections and company file information
 */

-- Create MYOB connections table
CREATE TABLE IF NOT EXISTS public.myob_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_file_id TEXT NOT NULL,
    company_file_name TEXT NOT NULL,

    -- OAuth tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,

    -- Company file details
    api_base_url TEXT NOT NULL,
    country_code TEXT DEFAULT 'AU',
    currency_code TEXT DEFAULT 'AUD',

    -- Metadata
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(user_id, company_file_id)
);

-- Create indexes
CREATE INDEX idx_myob_connections_user_id ON public.myob_connections(user_id);
CREATE INDEX idx_myob_connections_company_file_id ON public.myob_connections(company_file_id);
CREATE INDEX idx_myob_connections_expires_at ON public.myob_connections(expires_at);

-- Enable Row Level Security
ALTER TABLE public.myob_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own MYOB connections"
    ON public.myob_connections
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own MYOB connections"
    ON public.myob_connections
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own MYOB connections"
    ON public.myob_connections
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own MYOB connections"
    ON public.myob_connections
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can manage all connections (for OAuth callback)
CREATE POLICY "Service role can manage all MYOB connections"
    ON public.myob_connections
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment
COMMENT ON TABLE public.myob_connections IS 'Stores MYOB AccountRight OAuth connections for users';
