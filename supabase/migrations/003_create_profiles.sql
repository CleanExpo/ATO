-- =====================================================================
-- Migration: 003_create_profiles
-- Description: Create profiles table for user metadata
-- Date: 2026-01-29
-- =====================================================================

-- Create profiles table (extends auth.users with application-specific data)
CREATE TABLE IF NOT EXISTS profiles (
    -- Primary key (same as auth.users.id)
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- User metadata
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,

    -- Admin flag
    is_admin BOOLEAN DEFAULT FALSE,

    -- License information (will be populated by purchases migration)
    license_type TEXT CHECK (license_type IN ('comprehensive', 'core', 'wholesale_accountant')),
    license_active BOOLEAN DEFAULT FALSE,
    license_activated_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_license_type ON profiles(license_type);
CREATE INDEX IF NOT EXISTS idx_profiles_license_active ON profiles(license_active);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
    ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- RLS Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- RLS Policy: Service role can insert profiles (for new user creation)
CREATE POLICY "Service role can insert profiles"
    ON profiles
    FOR INSERT
    WITH CHECK (TRUE);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Comment on table
COMMENT ON TABLE profiles IS 'User profiles with application-specific metadata, extends auth.users';
COMMENT ON COLUMN profiles.is_admin IS 'Admin users can view all purchases and manage system settings';
COMMENT ON COLUMN profiles.license_type IS 'Type of license purchased (comprehensive, core, or wholesale_accountant)';
COMMENT ON COLUMN profiles.license_active IS 'Whether the user has an active license';
