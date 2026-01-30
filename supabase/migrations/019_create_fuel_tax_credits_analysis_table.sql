-- Phase 2.2: Create Fuel Tax Credits Analysis table
-- ATODE Integration: Fuel Tax Act 2006, ATO Fuel Tax Credit Rates

CREATE TABLE IF NOT EXISTS public.fuel_tax_credit_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Period
    financial_year TEXT NOT NULL, -- "FY2024-25" format

    -- Purchase summary
    total_fuel_purchases INTEGER NOT NULL DEFAULT 0,
    total_fuel_expenditure DECIMAL(15, 2) NOT NULL DEFAULT 0,
    eligible_purchases INTEGER NOT NULL DEFAULT 0,
    ineligible_purchases INTEGER NOT NULL DEFAULT 0,

    -- Credits claimable
    total_credits_claimable DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- Fuel breakdown (JSONB)
    fuel_breakdown_by_type JSONB, -- Array of {fuel_type, litres, expenditure, credit_claimable}
    total_credits_by_quarter JSONB, -- Array of {quarter, credit_amount}

    -- Data quality
    data_quality_score INTEGER NOT NULL DEFAULT 0, -- 0-100
    missing_data_flags JSONB, -- Array of strings

    -- Detailed calculations (JSONB)
    calculations JSONB, -- Array of FuelTaxCreditCalculation objects

    -- Recommendations
    recommendations JSONB, -- Array of strings
    professional_review_required BOOLEAN DEFAULT FALSE,

    -- Compliance summary
    compliance_summary TEXT,

    -- Metadata
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(tenant_id, financial_year)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_fuel_analyses_tenant ON public.fuel_tax_credit_analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_analyses_fy ON public.fuel_tax_credit_analyses(financial_year);
CREATE INDEX IF NOT EXISTS idx_fuel_analyses_credits ON public.fuel_tax_credit_analyses(total_credits_claimable) WHERE total_credits_claimable > 0;
CREATE INDEX IF NOT EXISTS idx_fuel_analyses_data_quality ON public.fuel_tax_credit_analyses(data_quality_score);
CREATE INDEX IF NOT EXISTS idx_fuel_analyses_review ON public.fuel_tax_credit_analyses(professional_review_required) WHERE professional_review_required = TRUE;

-- Enable Row Level Security
ALTER TABLE public.fuel_tax_credit_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access analyses for their connected Xero tenants
CREATE POLICY "Users can view their own organisation's fuel tax credit analyses"
    ON public.fuel_tax_credit_analyses
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_fuel_tax_credit_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fuel_tax_credit_analyses_updated_at
    BEFORE UPDATE ON public.fuel_tax_credit_analyses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_fuel_tax_credit_analyses_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.fuel_tax_credit_analyses IS 'Fuel tax credit analysis results under Fuel Tax Act 2006. Identifies eligible fuel purchases and calculates claimable credits based on business use and fuel type.';
COMMENT ON COLUMN public.fuel_tax_credit_analyses.total_credits_claimable IS 'Total fuel tax credits claimable on BAS. Claim on GST/BAS form field 7D. Credits offset GST payable or generate refund.';
COMMENT ON COLUMN public.fuel_tax_credit_analyses.data_quality_score IS '0-100 score based on tax invoice availability (50%), fuel litres data completeness (30%), fuel type classification (20%). Score <70% requires verification before claiming.';
COMMENT ON COLUMN public.fuel_tax_credit_analyses.professional_review_required IS 'TRUE if total_credits_claimable >$10,000 or data_quality_score <70%. Recommend engaging tax advisor before lodging BAS.';
COMMENT ON COLUMN public.fuel_tax_credit_analyses.fuel_breakdown_by_type IS 'JSONB array of fuel type breakdown: {fuel_type: "diesel"|"petrol"|"lpg", litres, expenditure, credit_claimable}. Rates: Diesel $0.479/L, Petrol $0.479/L, LPG $0.198/L (FY2024-25).';
COMMENT ON COLUMN public.fuel_tax_credit_analyses.total_credits_by_quarter IS 'JSONB array of quarterly credits: {quarter: "Q1 FY2024-25", credit_amount}. Claim credits on BAS each quarter to accelerate cash flow.';
COMMENT ON COLUMN public.fuel_tax_credit_analyses.calculations IS 'JSONB array of detailed calculations per fuel purchase: transaction_id, fuel_litres, fuel_type, credit_rate, business_use_percentage, net_credit_claimable, confidence_level, ineligibility_reasons.';
