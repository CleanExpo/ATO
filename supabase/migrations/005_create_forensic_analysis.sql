-- Forensic analysis results from AI-powered transaction analysis
-- Stores deep analysis of every transaction for tax optimization

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Store AI analysis results for each transaction
CREATE TABLE IF NOT EXISTS forensic_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    financial_year TEXT NOT NULL,

    -- AI Analysis Results
    primary_category TEXT, -- 'R&D', 'Marketing', 'Professional Fees', etc.
    secondary_categories TEXT[], -- Additional applicable categories
    category_confidence INTEGER CHECK (category_confidence >= 0 AND category_confidence <= 100),

    -- R&D Assessment (Division 355)
    is_rnd_candidate BOOLEAN DEFAULT FALSE,
    meets_div355_criteria BOOLEAN DEFAULT FALSE,
    rnd_activity_type TEXT CHECK (rnd_activity_type IN ('core_rnd', 'supporting_rnd', 'not_eligible', NULL)),
    rnd_confidence INTEGER CHECK (rnd_confidence >= 0 AND rnd_confidence <= 100),
    rnd_reasoning TEXT,

    -- Division 355 Four-Element Test
    outcome_unknown BOOLEAN,
    systematic_approach BOOLEAN,
    new_knowledge BOOLEAN,
    scientific_method BOOLEAN,

    -- Deduction Analysis (Division 8)
    is_fully_deductible BOOLEAN DEFAULT TRUE,
    deduction_type TEXT, -- 'Section 8-1', 'Division 40', 'Instant write-off', etc.
    claimable_amount DECIMAL(15,2),
    deduction_restrictions TEXT[],
    deduction_confidence INTEGER CHECK (deduction_confidence >= 0 AND deduction_confidence <= 100),

    -- Compliance Flags
    requires_documentation BOOLEAN DEFAULT FALSE,
    fbt_implications BOOLEAN DEFAULT FALSE,
    division7a_risk BOOLEAN DEFAULT FALSE,
    compliance_notes TEXT[],

    -- Metadata
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    ai_model TEXT, -- 'gemini-pro', 'gemini-1.5-flash', etc.
    analysis_version TEXT, -- Track analysis algorithm version

    -- Ensure uniqueness per tenant and transaction
    UNIQUE(tenant_id, transaction_id)
);

-- Indexes for fast querying
CREATE INDEX idx_forensic_analysis_tenant_fy
    ON forensic_analysis_results(tenant_id, financial_year);

CREATE INDEX idx_forensic_analysis_rnd
    ON forensic_analysis_results(tenant_id, is_rnd_candidate)
    WHERE is_rnd_candidate = TRUE;

CREATE INDEX idx_forensic_analysis_deductions
    ON forensic_analysis_results(tenant_id, is_fully_deductible);

CREATE INDEX idx_forensic_analysis_category
    ON forensic_analysis_results(tenant_id, primary_category);

CREATE INDEX idx_forensic_analysis_compliance
    ON forensic_analysis_results(tenant_id)
    WHERE fbt_implications = TRUE OR division7a_risk = TRUE;

-- Store actionable recommendations
CREATE TABLE IF NOT EXISTS tax_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,

    -- Recommendation Details
    priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')) NOT NULL,
    tax_area TEXT CHECK (tax_area IN ('rnd', 'deductions', 'losses', 'div7a')) NOT NULL,
    financial_year TEXT NOT NULL,

    -- Financial Impact
    estimated_benefit DECIMAL(15,2) NOT NULL,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100) NOT NULL,
    adjusted_benefit DECIMAL(15,2), -- benefit × (confidence / 100)

    -- Action Required
    action TEXT NOT NULL,
    ato_forms TEXT[], -- ['Schedule 16N', 'Company Tax Return']
    deadline DATE,
    amendment_window TEXT CHECK (amendment_window IN ('open', 'closing_soon', 'closed')),

    -- Details
    description TEXT,
    legislative_reference TEXT,
    supporting_evidence TEXT[],
    documentation_required TEXT[],

    -- Implementation
    estimated_accounting_cost DECIMAL(15,2),
    net_benefit DECIMAL(15,2), -- benefit - accounting cost

    -- Related Transactions
    transaction_ids TEXT[],
    transaction_count INTEGER,

    -- Status
    status TEXT CHECK (status IN ('identified', 'in_progress', 'completed', 'rejected')) DEFAULT 'identified',
    notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for recommendations
CREATE INDEX idx_tax_recommendations_tenant
    ON tax_recommendations(tenant_id);

CREATE INDEX idx_tax_recommendations_priority
    ON tax_recommendations(tenant_id, priority);

CREATE INDEX idx_tax_recommendations_fy
    ON tax_recommendations(tenant_id, financial_year);

CREATE INDEX idx_tax_recommendations_status
    ON tax_recommendations(tenant_id, status);

CREATE INDEX idx_tax_recommendations_deadline
    ON tax_recommendations(deadline)
    WHERE deadline IS NOT NULL AND status != 'completed';

-- Track API costs for Google AI usage
CREATE TABLE IF NOT EXISTS ai_analysis_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,

    -- Cost Tracking
    analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transactions_analyzed INTEGER NOT NULL,
    api_calls_made INTEGER NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    estimated_cost_usd DECIMAL(10,4),

    -- Model Info
    ai_model TEXT NOT NULL,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cost tracking
CREATE INDEX idx_ai_analysis_costs_tenant_date
    ON ai_analysis_costs(tenant_id, analysis_date);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_tax_recommendations_modtime
    BEFORE UPDATE ON tax_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Comments
COMMENT ON TABLE forensic_analysis_results IS 'AI-powered deep analysis of every transaction for tax optimization';
COMMENT ON TABLE tax_recommendations IS 'Actionable recommendations with financial impact and deadlines';
COMMENT ON TABLE ai_analysis_costs IS 'Tracks Google AI API usage costs';
COMMENT ON COLUMN forensic_analysis_results.rnd_activity_type IS 'core_rnd = eligible for R&D offset, supporting_rnd = indirect support, not_eligible = not R&D';
COMMENT ON COLUMN forensic_analysis_results.outcome_unknown IS 'Division 355 element 1: Could outcome be known in advance?';
COMMENT ON COLUMN forensic_analysis_results.systematic_approach IS 'Division 355 element 2: Planned and executed systematically?';
COMMENT ON COLUMN forensic_analysis_results.new_knowledge IS 'Division 355 element 3: Generates new knowledge?';
COMMENT ON COLUMN forensic_analysis_results.scientific_method IS 'Division 355 element 4: Based on established science?';
COMMENT ON COLUMN tax_recommendations.adjusted_benefit IS 'Confidence-adjusted benefit = estimated_benefit × (confidence / 100)';
