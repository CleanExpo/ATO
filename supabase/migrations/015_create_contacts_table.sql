-- Phase 1.3: Create Contacts table for caching enhanced Xero contact data
-- ATODE Integration: Trust distribution analysis (Section 100A ITAA 1936), Related party detection (Division 7A ITAA 1936)

CREATE TABLE IF NOT EXISTS public.xero_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Contact identification
    contact_id TEXT NOT NULL,
    name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,

    -- Tax details
    abn TEXT, -- Australian Business Number
    entity_type TEXT, -- 'individual', 'company', 'trust', 'partnership'

    -- Contact classification
    contact_type TEXT NOT NULL DEFAULT 'other', -- 'customer', 'supplier', 'both', 'other'
    is_related_party BOOLEAN DEFAULT FALSE, -- Flagged by trust/Division 7A analysis

    -- Address details
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT, -- Australian state/territory
    postcode TEXT,
    country TEXT,

    -- Contact details
    phone TEXT,
    mobile TEXT,

    -- Status and balances
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'archived'
    accounts_receivable_balance DECIMAL(15, 2) DEFAULT 0,
    accounts_payable_balance DECIMAL(15, 2) DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw Xero data (JSONB for future extensibility)
    raw_xero_data JSONB,

    -- Constraints
    UNIQUE(tenant_id, contact_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_xero_contacts_tenant ON public.xero_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_contacts_type ON public.xero_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_xero_contacts_abn ON public.xero_contacts(abn) WHERE abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_xero_contacts_entity_type ON public.xero_contacts(entity_type);
CREATE INDEX IF NOT EXISTS idx_xero_contacts_related_party ON public.xero_contacts(is_related_party) WHERE is_related_party = TRUE;
CREATE INDEX IF NOT EXISTS idx_xero_contacts_status ON public.xero_contacts(status);
CREATE INDEX IF NOT EXISTS idx_xero_contacts_name ON public.xero_contacts(name);

-- Enable Row Level Security
ALTER TABLE public.xero_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access contacts for their connected Xero tenants
CREATE POLICY "Users can view their own organisation's contacts"
    ON public.xero_contacts
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_xero_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER xero_contacts_updated_at
    BEFORE UPDATE ON public.xero_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_xero_contacts_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.xero_contacts IS 'Cached contacts from Xero with enhanced data (ABN, entity type, address). Used for trust distribution analysis (Section 100A), related party detection (Division 7A), and beneficiary mapping.';
COMMENT ON COLUMN public.xero_contacts.abn IS 'Australian Business Number. Required for trust distribution analysis and related party detection. 11-digit identifier.';
COMMENT ON COLUMN public.xero_contacts.entity_type IS 'Entity classification: individual (ABN 00-50), company (ABN 51-53), trust, partnership. Inferred from ABN structure and contact data.';
COMMENT ON COLUMN public.xero_contacts.is_related_party IS 'Flagged TRUE by trust/Division 7A analysis engines when contact is identified as related party (director, shareholder, family member, associated entity).';
COMMENT ON COLUMN public.xero_contacts.contact_type IS 'Customer = AP transactions only, Supplier = AR transactions only, Both = mixed transactions, Other = no transaction history.';
