-- Create xero_connections table
CREATE TABLE IF NOT EXISTS xero_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id TEXT UNIQUE NOT NULL,
    tenant_name TEXT,
    tenant_type TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    id_token TEXT,
    scope TEXT,
    organisation_name TEXT,
    organisation_type TEXT,
    country_code TEXT,
    base_currency TEXT,
    financial_year_end_day INTEGER,
    financial_year_end_month INTEGER,
    is_demo_company BOOLEAN DEFAULT FALSE,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on tenant_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_xero_connections_tenant_id ON xero_connections(tenant_id);
