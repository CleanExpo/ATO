# Database Migration Checklist ✅

Follow these steps to complete the database migration and verify deployment.

---

## Task 1: Apply Database Migration (5 minutes) ✅

### Step-by-Step Instructions:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Sign in if needed
   - Select your project (the one with URL: `xwqymjisxmtcmaebcehw.supabase.co`)

2. **Navigate to SQL Editor**
   - Click **"SQL Editor"** in the left sidebar
   - Click **"New query"** button

3. **Copy Migration SQL**
   - Open the file: `C:\ATO\ato-app\supabase\migrations\20260122_new_features_consolidated.sql`
   - Select all content (Ctrl+A)
   - Copy (Ctrl+C)

4. **Run Migration**
   - Paste into the SQL Editor (Ctrl+V)
   - Click **"Run"** button (or press Ctrl+Enter)
   - Wait for execution (should take ~5 seconds)

5. **Verify Success**
   - Look for these messages in the output:
     ```
     ✅ agent_reports table created successfully
     ✅ tax_rates_cache table created successfully
     ✅ RLS enabled on agent_reports
     ✅ RLS enabled on tax_rates_cache
     ✅ Test insert/delete successful on agent_reports
     ✅ Test insert/delete successful on tax_rates_cache
     ====================================
     Migration completed successfully! ✅
     ====================================
     ```

6. **Mark Complete**
   - [ ] Migration ran without errors
   - [ ] Success messages appeared
   - [ ] Tables created: `agent_reports` and `tax_rates_cache`

---

## Task 2: Restart Dev Server (1 minute)

The new API routes need a fresh server start:

```bash
# In your terminal, stop the current server (Ctrl+C)
# Then restart:
cd C:\ATO\ato-app
npm run dev
```

Wait for:
```
✓ Ready in 2.5s
○ Local:        http://localhost:3000
```

**Mark Complete:**
- [ ] Server restarted successfully
- [ ] No TypeScript errors shown

---

## Task 3: Verify Vercel Deployment (2 minutes)

Vercel should auto-deploy from your GitHub push:

1. **Check Deployment Status**
   - Go to: https://vercel.com/unite-group/ato
   - Look for latest deployment (should be in progress or completed)
   - Commit message: "Add comprehensive implementation summary"

2. **View Deployment**
   - Click on the deployment
   - Check **Runtime Logs** for errors
   - Copy the production URL (something like `ato-xyz.vercel.app`)

3. **Mark Complete**
   - [ ] Deployment shows "Ready" status
   - [ ] No errors in runtime logs
   - [ ] Production URL obtained: ___________________

---

## Task 4: Test Production Endpoints (2 minutes)

Test the new APIs in production:

### Test 1: Tax Rates API

```bash
# Replace YOUR-URL with your actual Vercel URL
curl https://YOUR-URL.vercel.app/api/tax-data/rates
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "instantWriteOffThreshold": 20000,
    "homeOfficeRatePerHour": 0.67,
    "rndOffsetRate": 0.435,
    ...
  }
}
```

### Test 2: Cache Stats API

```bash
curl https://YOUR-URL.vercel.app/api/tax-data/cache-stats
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "hasCachedData": false,  // First time
    "cacheAge": null,
    ...
  }
}
```

### Test 3: Agent Reports API

```bash
curl https://YOUR-URL.vercel.app/api/agents/reports
```

**Expected Response:**
```json
{
  "reports": []  // Empty initially
}
```

### Test 4: Analysis Status API

```bash
curl https://YOUR-URL.vercel.app/api/audit/analysis-status/8a8caf6c-614b-45a5-9e15-46375122407c
```

**Expected Response:**
```json
{
  "status": "analyzing",
  "progress": 0.8,
  "transactionsAnalyzed": 100,
  "totalTransactions": 12236
}
```

**Mark Complete:**
- [ ] Tax Rates API responding
- [ ] Cache Stats API responding
- [ ] Agent Reports API responding
- [ ] Analysis Status API responding

---

## Task 5: Test Locally (Optional)

If you want to verify everything works locally before production:

```bash
# Terminal 1: Run dev server (if not already running)
cd C:\ATO\ato-app
npm run dev

# Terminal 2: Run tests
node scripts/test-new-features.mjs
```

**Expected:** All tests should pass (6/6)

---

## Troubleshooting

### Problem: Migration fails with "table already exists"

**Solution:** Tables already created - this is OK! Skip to next task.

### Problem: 402 error when testing tax rates

**Solution:** This is expected (Jina AI free tier limit). System falls back to hardcoded values. This is safe and working as designed.

### Problem: Vercel deployment not starting

**Solution:**
1. Check GitHub Actions: https://github.com/CleanExpo/ATO/actions
2. If no action running, trigger manually:
   ```bash
   cd C:\ATO\ato-app
   git commit --allow-empty -m "Trigger deployment"
   git push origin main
   ```

### Problem: API returns 500 errors

**Solution:**
1. Check Vercel logs (Runtime Logs tab)
2. Verify environment variables are set:
   - NEXT_PUBLIC_SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - GOOGLE_AI_API_KEY
3. Verify database migration completed successfully

---

## ✅ Completion Checklist

Mark each task when complete:

- [ ] **Task 1:** Database migration applied successfully
- [ ] **Task 2:** Dev server restarted with new code
- [ ] **Task 3:** Vercel deployment verified and ready
- [ ] **Task 4:** All production endpoints tested successfully
- [ ] **Task 5 (Optional):** Local tests passing

**When all tasks are complete:**
- System is production-ready! 🎉
- Autonomous agents can be started with `npm run agents:start`
- Dashboard available at `/dashboard/agent-monitor`
- Tax rates automatically stay current

---

## 🎯 What's Next

**After completing this checklist:**

1. **Monitor AI Analysis** (3-4 hours)
   - Current progress: 0.8% (100/12,236 transactions)
   - Check status: `/api/audit/analysis-status/:tenantId`
   - When complete, R&D opportunities will appear in dashboard

2. **Start Autonomous Monitoring** (optional)
   ```bash
   npm run agents:start
   ```
   - Agents will report findings every 5 minutes
   - View dashboard: http://localhost:3000/dashboard/agent-monitor

3. **Generate Reports** (when analysis complete)
   - PDF schedules: `/api/reports/amendment-schedules`
   - Excel export: `/api/reports/excel`
   - View opportunities: `/dashboard/forensic-audit`

---

## 📞 Need Help?

If you encounter any issues:

1. Check the logs:
   - Local: Terminal output from `npm run dev`
   - Production: Vercel Runtime Logs

2. Verify environment variables:
   - Local: `.env.local` file
   - Production: Vercel Dashboard → Settings → Environment Variables

3. Review documentation:
   - `DEPLOYMENT_GUIDE.md`
   - `IMPLEMENTATION_SUMMARY.md`
   - `AGENTS_README.md`

---

**Good luck! Let's get this deployed! 🚀**
