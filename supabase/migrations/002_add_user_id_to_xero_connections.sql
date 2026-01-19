-- Add user ownership to Xero connections
ALTER TABLE xero_connections
  ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'xero_connections_user_id_fkey'
  ) THEN
    ALTER TABLE xero_connections
      ADD CONSTRAINT xero_connections_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_xero_connections_user_id ON xero_connections(user_id);
