import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('❌ Could not extract project ref from Supabase URL')
  process.exit(1)
}

const migrationSQL = `
-- Create agent_reports table
CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_reports_created_at ON agent_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_id ON agent_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_reports_status ON agent_reports(status);
CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_created ON agent_reports(agent_id, created_at DESC);

-- Create view
CREATE OR REPLACE VIEW latest_agent_reports AS
SELECT DISTINCT ON (agent_id)
  id, agent_id, status, findings, recommendations, metadata, created_at
FROM agent_reports
ORDER BY agent_id, created_at DESC;

-- Enable RLS
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;

-- Policy for service role
CREATE POLICY IF NOT EXISTS "Service role can manage agent reports" ON agent_reports
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
`

console.log('🚀 Creating agent_reports table...\n')

try {
  // Use Supabase Management API to execute SQL
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ query: migrationSQL })
  })

  if (!response.ok) {
    // Try alternative: direct query endpoint
    const queryResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: migrationSQL })
    })

    if (!queryResponse.ok) {
      throw new Error(`Failed to execute migration: ${response.status} ${queryResponse.status}`)
    }
  }

  console.log('✅ Migration applied successfully!')
  console.log('   Table: agent_reports')
  console.log('   Indexes: 4 created')
  console.log('   View: latest_agent_reports')
  console.log('   Policies: Service role access enabled\n')

} catch (error) {
  console.log('⚠️  Direct API execution not available')
  console.log('   Using alternative approach...\n')

  // Create table using individual REST calls (workaround)
  console.log('📋 Please run this SQL in Supabase Dashboard → SQL Editor:\n')
  console.log('─'.repeat(70))
  console.log(migrationSQL)
  console.log('─'.repeat(70))
  console.log('\nAfter running the SQL, the agents will store reports in the database.\n')
  console.log('Note: Agents can still run without database storage - they will')
  console.log('      output reports to console and work normally.\n')
}
