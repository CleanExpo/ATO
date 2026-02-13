-- Phase 1.5: Create Inventory table for caching Xero inventory items
-- ATODE Integration: Trading stock adjustments (Section 70-35 ITAA 1997), Inventory valuation methods

CREATE TABLE IF NOT EXISTS public.xero_inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Item identification
    item_id TEXT NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT,
    description TEXT,

    -- Tracking
    is_tracked BOOLEAN DEFAULT FALSE,
    quantity_on_hand DECIMAL(15, 4), -- Allow fractional quantities

    -- Valuation
    cost_price DECIMAL(15, 2), -- Purchase unit price
    sell_price DECIMAL(15, 2), -- Sales unit price
    total_cost_pool DECIMAL(15, 2), -- Total value of inventory on hand (cost_price × quantity_on_hand)

    -- Accounting codes
    inventory_asset_account TEXT, -- Balance sheet account for inventory
    cogs_account TEXT, -- Cost of Goods Sold account (expense)
    sales_account TEXT, -- Revenue account for sales

    -- Tax types
    purchase_tax_type TEXT, -- 'GST on Imports', 'Capital Acquisitions', 'GST Free'
    sales_tax_type TEXT, -- 'Output Taxed', 'GST Free Exports', 'GST on Income'

    -- Classification
    is_sold BOOLEAN DEFAULT FALSE,
    is_purchased BOOLEAN DEFAULT FALSE,

    -- Status
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive'

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw Xero data (JSONB for future extensibility)
    raw_xero_data JSONB,

    -- Constraints
    UNIQUE(tenant_id, item_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_xero_inventory_tenant ON public.xero_inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_inventory_code ON public.xero_inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_xero_inventory_tracked ON public.xero_inventory_items(is_tracked) WHERE is_tracked = TRUE;
CREATE INDEX IF NOT EXISTS idx_xero_inventory_status ON public.xero_inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_xero_inventory_name ON public.xero_inventory_items(item_name);

-- Enable Row Level Security
ALTER TABLE public.xero_inventory_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access inventory for their connected Xero tenants
CREATE POLICY "Users can view their own organisation's inventory"
    ON public.xero_inventory_items
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_xero_inventory_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER xero_inventory_items_updated_at
    BEFORE UPDATE ON public.xero_inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_xero_inventory_items_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.xero_inventory_items IS 'Cached inventory items from Xero. Used for trading stock adjustments (Section 70-35 ITAA 1997) and inventory valuation analysis.';
COMMENT ON COLUMN public.xero_inventory_items.is_tracked IS 'TRUE if item has quantity tracking enabled in Xero. Only tracked items have quantity_on_hand and total_cost_pool values.';
COMMENT ON COLUMN public.xero_inventory_items.total_cost_pool IS 'Total inventory value at cost (cost_price × quantity_on_hand). Used for trading stock valuations under Section 70-35 ITAA 1997.';
COMMENT ON COLUMN public.xero_inventory_items.inventory_asset_account IS 'Balance sheet account code where inventory value is recorded (typically Current Assets).';
COMMENT ON COLUMN public.xero_inventory_items.cogs_account IS 'Expense account code for Cost of Goods Sold. Used when inventory is sold to expense the cost component.';
COMMENT ON COLUMN public.xero_inventory_items.purchase_tax_type IS 'GST treatment for purchases: "GST on Imports" (15% GST), "Capital Acquisitions" (no GST), "GST Free" (exempt).';
COMMENT ON COLUMN public.xero_inventory_items.sales_tax_type IS 'GST treatment for sales: "Output Taxed" (no GST), "GST Free Exports" (0% GST), "GST on Income" (15% GST).';
