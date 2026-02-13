-- Phase 1.1: Create Fixed Assets table for caching Xero asset data
-- ATODE Integration: Section 328-180 ITAA 1997 (Instant Asset Write-Off), Division 40 (Capital Allowances)

CREATE TABLE IF NOT EXISTS public.xero_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Asset identification
    asset_id TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    asset_number TEXT,

    -- Purchase details
    purchase_date DATE NOT NULL,
    purchase_price DECIMAL(15, 2) NOT NULL,

    -- Disposal details (if applicable)
    disposal_date DATE,
    disposal_price DECIMAL(15, 2),

    -- Classification
    asset_type TEXT NOT NULL DEFAULT 'Uncategorized',
    asset_status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Disposed', 'Draft'

    -- Depreciation settings
    depreciation_method TEXT NOT NULL DEFAULT 'None', -- 'Prime Cost', 'Diminishing Value', 'Full Depreciation', 'None'
    effective_life_years DECIMAL(5, 2), -- Effective life in years
    depreciation_rate DECIMAL(5, 4), -- Annual rate (e.g., 0.25 for 25%)

    -- Current values
    accumulated_depreciation DECIMAL(15, 2) NOT NULL DEFAULT 0,
    book_value DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- Tax pooling (for analysis engines)
    pool_type TEXT, -- 'Low-value pool', 'SB pool', null

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw Xero data (JSONB for future extensibility)
    raw_xero_data JSONB,

    -- Constraints
    UNIQUE(tenant_id, asset_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_xero_assets_tenant ON public.xero_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_assets_purchase_date ON public.xero_assets(purchase_date);
CREATE INDEX IF NOT EXISTS idx_xero_assets_status ON public.xero_assets(asset_status);
CREATE INDEX IF NOT EXISTS idx_xero_assets_type ON public.xero_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_xero_assets_book_value ON public.xero_assets(book_value) WHERE book_value > 0;

-- Enable Row Level Security
ALTER TABLE public.xero_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access assets for their connected Xero tenants
CREATE POLICY "Users can view their own organisation's assets"
    ON public.xero_assets
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_xero_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER xero_assets_updated_at
    BEFORE UPDATE ON public.xero_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_xero_assets_updated_at();

-- Comment on table
COMMENT ON TABLE public.xero_assets IS 'Cached fixed assets from Xero Asset Register. Used for instant asset write-off analysis (s 328-180), capital allowances (Division 40), and depreciation optimization.';
COMMENT ON COLUMN public.xero_assets.pool_type IS 'Tax pooling strategy: Low-value pool (<$1,000 opening balance), SB pool (small business), or null (individual depreciation)';
COMMENT ON COLUMN public.xero_assets.depreciation_method IS 'Prime Cost (straight-line) or Diminishing Value (reducing balance) as per Division 40 ITAA 1997';
