-- Phase 1.4: Create BAS (Business Activity Statement) table for caching Xero BAS report data
-- ATODE Integration: GST Act 1999, PAYG Withholding Schedule 1 TAA 1953, PAYG Instalments Division 45 Schedule 1 TAA 1953

CREATE TABLE IF NOT EXISTS public.xero_bas_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Report identification
    report_id TEXT NOT NULL,

    -- Period details
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    lodgement_date DATE,

    -- GST fields (G1-G11)
    g1_total_sales DECIMAL(15, 2), -- Total Sales (including GST)
    g2_export_sales DECIMAL(15, 2), -- Export Sales (GST-free)
    g3_other_gst_free_sales DECIMAL(15, 2), -- Other GST-free Sales
    g4_input_taxed_sales DECIMAL(15, 2), -- Input Taxed Sales
    g10_capital_purchases DECIMAL(15, 2), -- Capital Purchases (including GST)
    g11_non_capital_purchases DECIMAL(15, 2), -- Non-Capital Purchases (including GST)

    -- PAYG Withholding (W1-W2)
    w1_total_salary_wages DECIMAL(15, 2), -- Total Salary and Wages
    w2_withheld_amounts DECIMAL(15, 2), -- Amounts Withheld from wages

    -- PAYG Instalments (T1-T2)
    t1_instalment_income DECIMAL(15, 2), -- Instalment Income
    t2_instalment_amount DECIMAL(15, 2), -- Instalment Amount payable

    -- Calculated fields (for analysis)
    gst_on_sales DECIMAL(15, 2), -- G1 × 1/11
    gst_on_purchases DECIMAL(15, 2), -- (G10 + G11) × 1/11
    net_gst DECIMAL(15, 2), -- GST on Sales - GST on Purchases

    -- Status
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'lodged'

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw Xero data (JSONB for future extensibility)
    raw_xero_data JSONB,

    -- Constraints
    UNIQUE(tenant_id, period_start_date, period_end_date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_xero_bas_tenant ON public.xero_bas_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_bas_period ON public.xero_bas_reports(period_start_date, period_end_date);
CREATE INDEX IF NOT EXISTS idx_xero_bas_lodgement_date ON public.xero_bas_reports(lodgement_date);
CREATE INDEX IF NOT EXISTS idx_xero_bas_status ON public.xero_bas_reports(status);
CREATE INDEX IF NOT EXISTS idx_xero_bas_net_gst ON public.xero_bas_reports(net_gst) WHERE net_gst IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.xero_bas_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access BAS reports for their connected Xero tenants
CREATE POLICY "Users can view their own organisation's BAS reports"
    ON public.xero_bas_reports
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_xero_bas_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER xero_bas_reports_updated_at
    BEFORE UPDATE ON public.xero_bas_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_xero_bas_reports_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.xero_bas_reports IS 'Cached BAS (Business Activity Statement) reports from Xero. Used for GST reconciliation, PAYG withholding analysis, and PAYG instalment compliance.';
COMMENT ON COLUMN public.xero_bas_reports.g1_total_sales IS 'G1: Total Sales (including GST). Used to calculate GST liability (G1 × 1/11).';
COMMENT ON COLUMN public.xero_bas_reports.g10_capital_purchases IS 'G10: Capital Purchases (including GST). Used for instant asset write-off and capital allowance analysis.';
COMMENT ON COLUMN public.xero_bas_reports.g11_non_capital_purchases IS 'G11: Non-Capital Purchases (including GST). Used to calculate GST credits ((G10 + G11) × 1/11).';
COMMENT ON COLUMN public.xero_bas_reports.w1_total_salary_wages IS 'W1: Total Salary and Wages. Used for superannuation guarantee compliance (must pay 11.5% super on W1 from FY2024-25).';
COMMENT ON COLUMN public.xero_bas_reports.w2_withheld_amounts IS 'W2: Amounts Withheld from wages. Must match PAYG withholding liability.';
COMMENT ON COLUMN public.xero_bas_reports.t1_instalment_income IS 'T1: Instalment Income. Used to calculate PAYG instalments (T1 × instalment rate).';
COMMENT ON COLUMN public.xero_bas_reports.net_gst IS 'Calculated: GST on Sales - GST on Purchases. Positive = GST payable to ATO, Negative = GST refund from ATO.';
