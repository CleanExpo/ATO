# Manual Migration Instructions

If the automated migration script fails, you can apply migrations manually through the Supabase SQL editor.

## Steps

1. **Open Supabase SQL Editor**
   - Go to: https://app.supabase.com/project/_/sql
   - Or navigate to your project → SQL Editor

2. **Run Migration 1: Add Platform Column**

   Copy and paste the contents of:
   ```
   supabase/migrations/20260128000008_add_platform_column.sql
   ```

   Click "Run" to execute.

3. **Run Migration 2: Add Platform to Analysis Tables**

   Copy and paste the contents of:
   ```
   supabase/migrations/20260128000009_add_platform_to_analysis_tables.sql
   ```

   Click "Run" to execute.

## Verify Migrations

After running both migrations, verify they worked:

```sql
-- Check historical_transactions_cache has platform column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'historical_transactions_cache'
  AND column_name = 'platform';

-- Check audit_sync_status has platform column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'audit_sync_status'
  AND column_name = 'platform';

-- Check forensic_analysis_results has platform column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'forensic_analysis_results'
  AND column_name = 'platform';

-- Check ai_analysis_costs has platform column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ai_analysis_costs'
  AND column_name = 'platform';
```

## Expected Results

All queries should return a row with:
- `column_name`: platform
- `data_type`: text
- `column_default`: 'xero'::text

## Troubleshooting

### Error: "constraint already exists"
This is fine - means the constraint was already applied.

### Error: "column already exists"
This is fine - means the column was already added.

### Error: "permission denied"
Make sure you're using the service role key (admin permissions).

## Rollback (if needed)

If you need to undo these migrations:

```sql
-- Remove platform column from historical_transactions_cache
ALTER TABLE historical_transactions_cache DROP COLUMN IF EXISTS platform;

-- Remove platform column from audit_sync_status
ALTER TABLE audit_sync_status DROP COLUMN IF EXISTS platform;

-- Remove platform column from forensic_analysis_results
ALTER TABLE forensic_analysis_results DROP COLUMN IF EXISTS platform;

-- Remove platform column from ai_analysis_costs
ALTER TABLE ai_analysis_costs DROP COLUMN IF EXISTS platform;
```
