-- Historical transaction cache for 5-year forensic audit
-- Stores raw Xero data for fast re-analysis without repeated API calls

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cache raw Xero transaction data
CREATE TABLE IF NOT EXISTS historical_transactions_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    transaction_type TEXT, -- 'ACCPAY', 'ACCREC', 'BANK', etc.
    transaction_date DATE NOT NULL,
    financial_year TEXT NOT NULL, -- 'FY2024-25'

    -- Store complete Xero API response for full fidelity
    raw_data JSONB NOT NULL,

    -- Extracted fields for quick querying (denormalized)
    contact_name TEXT,
    total_amount DECIMAL(15,2),
    status TEXT,
    reference TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure uniqueness per tenant and transaction
    UNIQUE(tenant_id, transaction_id)
);

-- Indexes for fast querying
CREATE INDEX idx_historical_transactions_tenant_fy
    ON historical_transactions_cache(tenant_id, financial_year);

CREATE INDEX idx_historical_transactions_date
    ON historical_transactions_cache(transaction_date);

CREATE INDEX idx_historical_transactions_type
    ON historical_transactions_cache(tenant_id, transaction_type);

-- Track sync status per organization
CREATE TABLE IF NOT EXISTS audit_sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL UNIQUE,

    -- Sync progress
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT CHECK (sync_status IN ('idle', 'syncing', 'complete', 'error')),
    sync_progress DECIMAL(5,2) DEFAULT 0, -- 0-100%

    -- Transaction counts
    transactions_synced INTEGER DEFAULT 0,
    total_transactions_estimated INTEGER DEFAULT 0,

    -- Years synced
    years_synced TEXT[], -- ['FY2024-25', 'FY2023-24', ...]
    current_year_syncing TEXT,

    -- Error handling
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    last_error_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for tenant lookups
CREATE INDEX idx_audit_sync_status_tenant
    ON audit_sync_status(tenant_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_historical_transactions_cache_modtime
    BEFORE UPDATE ON historical_transactions_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_audit_sync_status_modtime
    BEFORE UPDATE ON audit_sync_status
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Comments
COMMENT ON TABLE historical_transactions_cache IS 'Caches 5 years of Xero transactions for forensic tax audit analysis';
COMMENT ON TABLE audit_sync_status IS 'Tracks historical data sync progress per organization';
COMMENT ON COLUMN historical_transactions_cache.raw_data IS 'Complete Xero API response stored as JSONB for full fidelity';
COMMENT ON COLUMN audit_sync_status.sync_progress IS 'Percentage complete (0-100)';
