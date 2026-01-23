# 🔧 Fix Mock Data Issue - Data Quality Dashboard

**Problem**: The Data Quality dashboard at https://ato-blush.vercel.app/dashboard/data-quality shows mock/placeholder data (1,000 transactions scanned, 214 issues) instead of real data.

**Root Cause**: The `data_quality_scan_status` table does not exist in your production database. The previous migration (`20260122_fixed_migration.sql`) only created `agent_reports` and `tax_rates_cache` tables, but did NOT create the data quality tables.

---

## 🎯 Solution: Apply New Migration

### Step 1: Open Supabase Dashboard

1. Go to: **https://supabase.com/dashboard**
2. Select your project
3. Click **"SQL Editor"** in the left sidebar

### Step 2: Apply the Migration

1. Click **"New Query"**
2. Copy the **ENTIRE** contents of this file:
   ```
   C:\ATO\ato-app\supabase\migrations\20260122_data_quality_tables.sql
   ```

3. Paste it into the SQL Editor
4. Click **"Run"** (or press `Ctrl+Enter`)

### Step 3: Verify Success

You should see these messages in the output:
```
✅ data_quality_issues table created successfully
✅ correction_logs table created successfully
✅ data_quality_scan_status table created successfully (CRITICAL FOR UI!)
✅ RLS enabled on data quality tables
=========================================================
Data Quality Tables Migration completed successfully! ✅
The UI will now show real data instead of mock data
=========================================================
```

---

## 🧪 Test the Fix

### Test 1: Check API Response

Open your browser and go to:
```
https://ato-blush.vercel.app/api/data-quality/scan?tenantId=8a8caf6c-614b-45a5-9e15-46375122407c
```

**Before the fix**, you'll see:
```json
{
  "status": "complete",
  "progress": 100,
  "transactionsScanned": 1000,
  "issuesFound": 214,
  "lastScanAt": null  ← THIS MEANS NO REAL DATA
}
```

**After the fix**, you'll see:
```json
{
  "status": "idle",
  "progress": 0,
  "transactionsScanned": 0,
  "issuesFound": 0,
  "message": "No scan has been started yet"
}
```

This is correct! It means the table now exists, but no scan has been run yet.

### Test 2: Start a Scan

1. Go to: https://ato-blush.vercel.app/dashboard/data-quality
2. Refresh the page (`F5`)
3. Click the **"Start Scan"** button
4. Watch the progress counter update in real-time

---

## 📊 What This Migration Creates

### 1. `data_quality_issues` Table
- Stores individual data quality issues found during scans
- Tracks issue type, severity, current state, suggested fix
- AI confidence scores (auto-fix if >= 90%)

### 2. `correction_logs` Table
- Audit trail of all corrections made
- Tracks before/after states
- Links to Xero manual journals

### 3. `data_quality_scan_status` Table ⭐ **MOST IMPORTANT**
- This is what the UI reads!
- Tracks scan progress (0-100%)
- Issue counts by type
- Last scan timestamp
- **This table was missing, causing the mock data!**

---

## 🔍 Why Was Mock Data Showing?

The API route checks for scan status by querying `data_quality_scan_status`:

```typescript
// In lib/xero/data-quality-validator.ts
export async function getScanStatus(tenantId: string): Promise<any> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('data_quality_scan_status')  // ← This table didn't exist!
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

    if (error) {
        console.error('Error getting scan status:', error)
        return null  // ← Returns null when table doesn't exist
    }

    return data
}
```

When the table doesn't exist, the function returns `null`, and the API falls back to showing placeholder data so the UI doesn't break.

---

## ✅ After Applying the Fix

### What Will Happen:

1. **Table will exist** in your database
2. **API will query the table** successfully
3. **UI will show** "No scan has been started yet" (correct initial state)
4. **"Start Scan" button** will trigger a real scan
5. **Progress will update** in real-time as the scan runs
6. **Real data** will be displayed (not mock data)

### What the Scan Does:

When you click "Start Scan", the system will:

1. **Read cached transactions** from `historical_transactions_cache`
2. **Analyze each transaction** using AI
3. **Identify issues**:
   - Transactions in wrong accounts
   - Incorrect tax classifications
   - Unreconciled bank transactions
   - Misallocated payments
   - Duplicate transactions
4. **Auto-fix high-confidence issues** (confidence >= 90%)
5. **Flag medium-confidence issues** for accountant review
6. **Update the UI** in real-time with progress

---

## 🎯 Expected Results

### Initial State (Right After Migration):
```
Status: idle
Progress: 0%
Transactions Scanned: 0
Issues Found: 0
Message: "No scan has been started yet"
```

### During Scan:
```
Status: scanning
Progress: 45%
Transactions Scanned: 5,506 / 12,236
Issues Found: 127
Message: "Scanning... 45% complete"
```

### After Scan Complete:
```
Status: complete
Progress: 100%
Transactions Scanned: 12,236
Issues Found: 342
Issues Auto-Corrected: 189
Issues Pending Review: 153
```

---

## 📞 Support

If you encounter any issues:

1. **Check Supabase logs** for error messages
2. **Verify table was created**:
   ```sql
   SELECT * FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename = 'data_quality_scan_status';
   ```
3. **Check if RLS is enabled**:
   ```sql
   SELECT relname, relrowsecurity
   FROM pg_class
   WHERE relname = 'data_quality_scan_status';
   ```

---

## 🚀 Ready to Apply?

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260122_data_quality_tables.sql`
3. Paste and run
4. Verify success messages
5. Refresh Data Quality dashboard
6. Click "Start Scan"

**That's it! The mock data issue will be resolved.** 🎉
