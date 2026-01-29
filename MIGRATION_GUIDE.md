# Database Migration Guide - 5 Minute Setup

## Quick Method (Recommended)

### Step 1: Open Supabase Dashboard

Click this link: **https://xwqymjisxmtcmaebcehw.supabase.co**

### Step 2: Navigate to SQL Editor

1. Look in the left sidebar
2. Click **"SQL Editor"** (icon looks like a database)

### Step 3: Create New Query

1. Click the **"New Query"** button (top right)
2. This opens an empty SQL editor

### Step 4: Copy the Migration SQL

**Option A - Use PowerShell (Fast)**
```powershell
Get-Content "supabase\migrations\20260129_create_work_queue.sql" | Set-Clipboard
```
Then just paste in the SQL Editor (Ctrl+V)

**Option B - Manual Copy**
1. Open: `supabase\migrations\20260129_create_work_queue.sql`
2. Select all (Ctrl+A)
3. Copy (Ctrl+C)
4. Paste in SQL Editor (Ctrl+V)

### Step 5: Run the Migration

1. Click the **"Run"** button (or press Ctrl+Enter)
2. Wait 2-3 seconds for execution

### Step 6: Verify Success

You should see:
```
Success. No rows returned
```

And a notice:
```
Work queue system created successfully!
Tables: work_queue
Functions: get_next_pending_queue_item, get_next_validated_queue_item, get_queue_statistics
Indexes: 8 indexes for performance optimization
```

### Step 7: Check Tables

1. Look in left sidebar under **"Tables"**
2. You should see **"work_queue"** in the list
3. Click it to see the schema

### Step 8: Test Connection

Run this command to verify everything works:
```bash
npx tsx test-setup.ts
```

Expected output:
```
✅ Supabase connected, work_queue table exists
✅ Linear connected as: Phill McGurk
✅ Team found: Unite-Hub (UNI)
✅ All tests passed!
```

---

## What This Creates

### 1. `work_queue` Table
- 20+ columns for tracking ideas through their lifecycle
- Status workflow: pending → validating → validated → processing → complete → archived
- Full metadata: Linear integration, complexity, priority, agent routing

### 2. Performance Indexes (8 total)
- `idx_work_queue_status` - Fast status filtering
- `idx_work_queue_created_at` - Chronological sorting
- `idx_work_queue_priority` - Priority-based queries
- `idx_work_queue_assigned_agent` - Agent routing
- `idx_work_queue_linear_issue_id` - Linear sync
- `idx_work_queue_processing` - Active item tracking
- Plus 2 GIN indexes for JSON search

### 3. Helper Functions (3 total)
- `get_next_pending_queue_item()` - PM validation queue
- `get_next_validated_queue_item()` - Execution queue (priority-sorted)
- `get_queue_statistics()` - Dashboard metrics

### 4. Row-Level Security
- Service role: Full access
- Authenticated users: Read + Insert only
- Anon users: No access

---

## Troubleshooting

### Error: "relation already exists"

The table already exists! Skip to Step 8 to test.

### Error: "permission denied"

Make sure you're logged into the correct Supabase project.

### SQL Editor is frozen

Refresh the page and try again.

### Can't find SQL Editor

Look for the database icon in the left sidebar. It might be labeled "SQL" or "Database".

---

## After Migration

Once the migration is complete, you can immediately use:

```bash
# Test that everything works
npx tsx test-setup.ts

# Try the workflow command
/workflow
```

---

## Need Help?

If you encounter any issues:

1. Check you're logged into: https://xwqymjisxmtcmaebcehw.supabase.co
2. Verify you have admin access to the project
3. Check the browser console for errors (F12)
4. Try refreshing the Supabase Dashboard

---

**Total Time**: ~5 minutes
**Difficulty**: Easy (just copy/paste)
**Status**: Ready to run!
