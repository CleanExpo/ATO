-- ================================================================
-- GOVERNMENT REFERENCE VALUES
-- ================================================================
-- Stores official ATO/government rates, thresholds, and citations

-- Ensure helper exists for updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS government_reference_values (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_ref_key ON government_reference_values(key);
CREATE INDEX IF NOT EXISTS idx_gov_ref_effective_from ON government_reference_values(effective_from);

ALTER TABLE government_reference_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access" ON government_reference_values FOR ALL USING (true);

CREATE TRIGGER update_government_reference_values_updated_at
  BEFORE UPDATE ON government_reference_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
