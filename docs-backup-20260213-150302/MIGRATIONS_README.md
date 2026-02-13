# Database Migrations - Platform Columns

## Quick Start

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://app.supabase.com/project/_/sql

2. Copy and paste **Migration 1** into the SQL editor:
   - File: `supabase/migrations/20260128000008_add_platform_column.sql`
   - Click "Run"

3. Copy and paste **Migration 2** into the SQL editor:
   - File: `supabase/migrations/20260128000009_add_platform_to_analysis_tables.sql`
   - Click "Run"

4. Copy and paste **Migration 3** into the SQL editor:
   - File: `supabase/migrations/20260128000010_create_quickbooks_tokens_table.sql`
   - Click "Run"

### Option 2: Command Line (If you have psql)

```bash
# Set your database connection string
export DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Run migrations
psql $DATABASE_URL -f supabase/migrations/20260128000008_add_platform_column.sql
psql $DATABASE_URL -f supabase/migrations/20260128000009_add_platform_to_analysis_tables.sql
psql $DATABASE_URL -f supabase/migrations/20260128000010_create_quickbooks_tokens_table.sql
```

## What These Migrations Do

### Migration 1: `20260128000008_add_platform_column.sql`

Adds `platform` column to:
- `historical_transactions_cache` - stores which platform (xero/myob/quickbooks) the transaction came from
- `audit_sync_status` - tracks sync status per platform
- Updates unique constraint to `(tenant_id, platform)` allowing multiple platforms per tenant

### Migration 2: `20260128000009_add_platform_to_analysis_tables.sql`

Adds `platform` column to:
- `forensic_analysis_results` - tracks which platform each analysis result came from
- `ai_analysis_costs` - tracks AI costs by platform

### Migration 3: `20260128000010_create_quickbooks_tokens_table.sql`

Creates `quickbooks_tokens` table for:
- OAuth 2.0 token storage (access_token, refresh_token)
- QuickBooks Company ID (realm_id)
- RLS policies for tenant isolation

## Verification

After running migrations, verify they worked:

```sql
-- Verify platform columns (should return 4 rows)
SELECT
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE column_name = 'platform'
  AND table_name IN (
    'historical_transactions_cache',
    'audit_sync_status',
    'forensic_analysis_results',
    'ai_analysis_costs'
  )
ORDER BY table_name;

-- Verify QuickBooks tokens table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'quickbooks_tokens';
```

Expected output:
```
-- Platform columns:
table_name                      | column_name | data_type | column_default
--------------------------------|-------------|-----------|----------------
ai_analysis_costs               | platform    | text      | 'xero'::text
audit_sync_status               | platform    | text      | 'xero'::text
forensic_analysis_results       | platform    | text      | 'xero'::text
historical_transactions_cache   | platform    | text      | 'xero'::text

-- QuickBooks table:
table_name
------------------
quickbooks_tokens
```

## Troubleshooting

### "column already exists"
✅ Safe to ignore - column was already added

### "constraint already exists"
✅ Safe to ignore - constraint was already created

### "permission denied"
❌ Make sure you're logged in with admin/service role permissions

### "syntax error"
❌ Check that you copied the entire SQL file without truncation

## Rollback (If Needed)

To undo these migrations:

```sql
-- Remove platform columns
ALTER TABLE historical_transactions_cache DROP COLUMN IF EXISTS platform CASCADE;
ALTER TABLE audit_sync_status DROP COLUMN IF EXISTS platform CASCADE;
ALTER TABLE forensic_analysis_results DROP COLUMN IF EXISTS platform CASCADE;
ALTER TABLE ai_analysis_costs DROP COLUMN IF EXISTS platform CASCADE;

-- Restore original unique constraint on audit_sync_status
ALTER TABLE audit_sync_status
DROP CONSTRAINT IF EXISTS audit_sync_status_tenant_platform_unique;

ALTER TABLE audit_sync_status
ADD CONSTRAINT audit_sync_status_tenant_id_key UNIQUE(tenant_id);
```

## Impact

### Before Migrations
- All data was Xero-only
- Single platform per tenant
- No way to distinguish data source

### After Migrations
- Multi-platform support (Xero, MYOB, QuickBooks)
- Multiple platforms per tenant (user can have Xero + MYOB simultaneously)
- Platform-specific queries: `WHERE platform = 'myob'`
- Platform-specific cost tracking
- Existing Xero data automatically gets `platform='xero'`

## Next Steps

After migrations complete:
1. ✅ Test Xero functionality still works (should be unchanged)
2. ✅ Test MYOB sync (`POST /api/myob/sync`)
3. ✅ Test MYOB analysis (`POST /api/audit/analyze { platform: 'myob' }`)
4. ✅ Verify platform filtering in queries
