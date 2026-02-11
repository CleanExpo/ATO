-- Add slug column to organizations table if it doesn't exist
-- This supports URL-friendly organization identifiers

DO $$
BEGIN
    -- Check if slug column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'slug'
    ) THEN
        -- Add the slug column
        ALTER TABLE organizations 
        ADD COLUMN slug TEXT UNIQUE;
        
        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_organizations_slug 
        ON organizations(slug);
        
        -- Add comment for documentation
        COMMENT ON COLUMN organizations.slug IS 'URL-friendly identifier for the organization';
        
        RAISE NOTICE 'Added slug column to organizations table';
    ELSE
        RAISE NOTICE 'slug column already exists in organizations table';
    END IF;
END $$;
