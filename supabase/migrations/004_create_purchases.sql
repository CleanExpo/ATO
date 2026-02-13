-- =====================================================================
-- Migration: 004_create_purchases
-- Description: Create purchases table for tracking Stripe payments
-- Date: 2026-01-29
-- =====================================================================

-- Create purchases table to track all payment transactions
CREATE TABLE IF NOT EXISTS purchases (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID, -- Will add foreign key constraint later if organizations table exists

    -- Stripe identifiers
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_customer_id TEXT NOT NULL,

    -- Product details
    product_type TEXT NOT NULL CHECK (product_type IN ('comprehensive', 'core', 'wholesale_accountant')),
    wholesale_tier TEXT CHECK (wholesale_tier IN ('standard', 'professional', 'enterprise')),

    -- Payment details
    amount_paid INTEGER NOT NULL, -- Amount in cents
    currency TEXT NOT NULL DEFAULT 'aud',
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    failure_reason TEXT,

    -- License details
    license_active BOOLEAN NOT NULL DEFAULT TRUE,
    license_expires_at TIMESTAMPTZ, -- NULL for one-time purchases

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_organization_id ON purchases(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session_id ON purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_payment_intent_id ON purchases(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_customer_id ON purchases(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON purchases(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchases_license_active ON purchases(license_active);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own purchases
CREATE POLICY "Users can view their own purchases"
    ON purchases
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Admins can view all purchases (only if profiles table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'profiles'
    ) THEN
        CREATE POLICY "Admins can view all purchases"
            ON purchases
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.is_admin = TRUE
                )
            );
    END IF;
END$$;

-- RLS Policy: Service role can insert purchases (for Stripe webhooks)
CREATE POLICY "Service role can insert purchases"
    ON purchases
    FOR INSERT
    WITH CHECK (TRUE);

-- RLS Policy: Service role can update purchases (for Stripe webhooks)
CREATE POLICY "Service role can update purchases"
    ON purchases
    FOR UPDATE
    USING (TRUE);

-- Add license fields to profiles table if it exists and fields don't exist
DO $$
BEGIN
    -- Check if profiles table exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'profiles'
    ) THEN
        -- Add license_type column
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'profiles'
            AND column_name = 'license_type'
        ) THEN
            ALTER TABLE profiles
            ADD COLUMN license_type TEXT CHECK (license_type IN ('comprehensive', 'core', 'wholesale_accountant'));
        END IF;

        -- Add license_active column
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'profiles'
            AND column_name = 'license_active'
        ) THEN
            ALTER TABLE profiles
            ADD COLUMN license_active BOOLEAN DEFAULT FALSE;
        END IF;

        -- Add license_activated_at column
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'profiles'
            AND column_name = 'license_activated_at'
        ) THEN
            ALTER TABLE profiles
            ADD COLUMN license_activated_at TIMESTAMPTZ;
        END IF;

        -- Create indexes if table exists
        CREATE INDEX IF NOT EXISTS idx_profiles_license_type ON profiles(license_type);
        CREATE INDEX IF NOT EXISTS idx_profiles_license_active ON profiles(license_active);
    ELSE
        RAISE NOTICE 'profiles table does not exist, skipping license fields addition';
    END IF;
END$$;

-- Comment on table
COMMENT ON TABLE purchases IS 'Tracks all payment transactions from Stripe, including one-time purchases and subscriptions';

-- Add foreign key constraint to organizations table if it exists
DO $$
BEGIN
    -- Check if organizations table exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'organizations'
        AND table_schema = 'public'
    ) THEN
        -- Add foreign key constraint
        ALTER TABLE purchases
        ADD CONSTRAINT fk_purchases_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE SET NULL;
    END IF;
END$$;

-- Comment on table
COMMENT ON TABLE purchases IS 'Tracks all payment transactions from Stripe, including one-time purchases and subscriptions';

-- Comment on columns
COMMENT ON COLUMN purchases.user_id IS 'User who made the purchase (references auth.users)';
COMMENT ON COLUMN purchases.organization_id IS 'Organization the purchase is for (optional, FK added if organizations table exists)';
COMMENT ON COLUMN purchases.stripe_session_id IS 'Stripe checkout session ID';
COMMENT ON COLUMN purchases.stripe_payment_intent_id IS 'Stripe payment intent ID';
COMMENT ON COLUMN purchases.stripe_customer_id IS 'Stripe customer ID';
COMMENT ON COLUMN purchases.product_type IS 'Type of product purchased (comprehensive, core, wholesale_accountant)';
COMMENT ON COLUMN purchases.wholesale_tier IS 'Wholesale tier for accountants (standard, professional, enterprise)';
COMMENT ON COLUMN purchases.amount_paid IS 'Amount paid in cents (e.g., 99500 = $995.00)';
COMMENT ON COLUMN purchases.currency IS 'Currency code (default: aud)';
COMMENT ON COLUMN purchases.payment_status IS 'Payment status (pending, completed, failed, refunded)';
COMMENT ON COLUMN purchases.license_active IS 'Whether the license from this purchase is currently active';
COMMENT ON COLUMN purchases.license_expires_at IS 'License expiration date (NULL for one-time purchases)';
COMMENT ON COLUMN purchases.created_at IS 'Timestamp when purchase record was created';
COMMENT ON COLUMN purchases.completed_at IS 'Timestamp when payment was completed';
COMMENT ON COLUMN purchases.refunded_at IS 'Timestamp when payment was refunded (if applicable)';
