# Deployment Instructions - ato Project

## Prerequisites

✅ Completed: `RELINK_INSTRUCTIONS.md` - Project linked to `ato`
✅ Completed: `ENVIRONMENT_VARIABLES_SETUP.md` - All variables added to Vercel

---

## Deploy to Production

### Method 1: Using Vercel CLI (Recommended)

```bash
cd C:\ATO\ato-app

# Deploy to production
vercel --prod
```

This will:
1. Build your Next.js app
2. Upload to Vercel
3. Deploy to production (ato-ai.app)
4. Show you the deployment URL

**Expected output:**
```
🔍  Inspect: https://vercel.com/unite-group/ato/...
✅  Production: https://ato-ai.app [2-3min]
```

---

### Method 2: Using Git Push (Alternative)

Since your Git is connected to CleanExpo/ATO, you can trigger auto-deploy:

```bash
cd C:\ATO\ato-app

# Commit any remaining documentation files
git add RELINK_INSTRUCTIONS.md ENVIRONMENT_VARIABLES_SETUP.md DEPLOYMENT_INSTRUCTIONS.md
git commit -m "docs: Add Vercel project setup documentation"

# Push to main (triggers Vercel deployment)
git push origin main
```

**Monitor deployment:**
```bash
vercel deployments ls
```

Or watch in dashboard: https://vercel.com/unite-group/ato/deployments

---

### Method 3: Manual Redeploy in Dashboard

1. Go to: https://vercel.com/unite-group/ato
2. Click **Deployments** tab
3. Find the latest deployment
4. Click three dots (...) menu
5. Click **Redeploy**
6. Select **"Use existing Build Cache"** (faster)
7. Click **Redeploy**

---

## Post-Deployment Verification

### 1. Check Deployment Status

```bash
vercel deployments ls
```

Look for:
- ✅ Status: **READY**
- ✅ URL: **ato-ai.app**
- ✅ No errors in build logs

### 2. Test Slack Integration

**Browser test:**
```
https://ato-ai.app/api/slack/test
```

**Expected response:**
```json
{
  "success": true,
  "message": "Test message sent to Slack successfully!",
  "timestamp": "2026-01-28T..."
}
```

**Check Slack channel** for test message:
```
🎉 Slack Integration Test - Success!

Congratulations! Your Slack webhook is configured correctly
for the Australian Tax Optimizer.

Status: ✅ Connected
Environment: Production

💡 You will now receive notifications about user activity,
AI analysis progress, payments, and system issues.
```

### 3. Verify Cron Jobs

Check that Vercel cron jobs are configured:

1. Go to: https://vercel.com/unite-group/ato/settings/crons
2. Should see:
   - ✅ `/api/alerts/cron` - Daily at 8:00 AM AEST
   - ✅ `/api/slack/daily-summary` - Daily at 6:00 PM AEST

### 4. Test Other Endpoints

```bash
# Check if API is responding
curl https://ato-ai.app/api/health

# Check Supabase connection (if you have health endpoint)
curl https://ato-ai.app/api/db/health
```

---

## Monitoring Deployment

### Real-time Logs

```bash
vercel logs https://ato-ai.app --follow
```

### Check Build Logs

```bash
vercel logs https://ato-ai.app --since 1h
```

Or in dashboard:
1. Go to deployments
2. Click on latest deployment
3. View **Build Logs** tab

---

## Rollback (If Needed)

If something goes wrong:

### Option 1: Promote Previous Deployment

```bash
vercel rollback
```

### Option 2: Manual Rollback in Dashboard

1. Go to: https://vercel.com/unite-group/ato/deployments
2. Find last known good deployment
3. Click three dots (...)
4. Click **Promote to Production**

---

## Clean Up Old Project

### Delete `ato-app` Project

Once everything is working on the `ato` project:

1. Go to: https://vercel.com/unite-group/ato-app
2. Click **Settings** → **General**
3. Scroll to **Delete Project**
4. Type project name to confirm: `ato-app`
5. Click **Delete**

This will:
- ✅ Remove the duplicate project
- ✅ Free up the project slot
- ✅ Clean up your Vercel dashboard

---

## Success Checklist

After deployment, verify:

- [ ] Deployment status shows **READY** (green)
- [ ] Production URL is **ato-ai.app**
- [ ] Test endpoint returns 200 OK: https://ato-ai.app/api/slack/test
- [ ] Received Slack test message
- [ ] Cron jobs are scheduled in Vercel
- [ ] All environment variables visible in Settings → Environment Variables
- [ ] No errors in deployment logs
- [ ] Old `ato-app` project deleted

---

## Troubleshooting

### Deployment fails with "Environment variable not found"
- Check all variables have all 3 environments checked
- Redeploy after fixing

### 404 errors on API routes
- Wait 2-3 minutes for deployment to fully complete
- Check build logs for file structure issues
- Verify `app/api/` routes exist in repository

### Slack integration not working
- Verify `SLACK_WEBHOOK_URL` is correct in Vercel
- Test webhook directly: `curl -X POST <webhook-url> -d '{"text":"test"}'`
- Check Slack app is still authorized

### Cron jobs not running
- Verify `CRON_SECRET` matches in Vercel environment variables
- Check Vercel cron logs: Settings → Crons → View Logs
- Ensure project is on Pro plan (crons require Pro)

---

## Next Steps

After successful deployment:

1. ✅ Update OAuth redirect URIs in:
   - Google Cloud Console → Credentials
   - Xero Developer Portal
   - MYOB Developer Portal
   - QuickBooks Developer Portal

2. ✅ Test full user flow:
   - Sign up
   - Connect accounting platform
   - Run AI analysis
   - Check Slack notifications

3. ✅ Monitor for 24 hours:
   - Check Slack daily summary (6:00 PM AEST)
   - Check alert cron runs (8:00 AM AEST)
   - Review error logs

---

**Your production app is now live at:** https://ato-ai.app 🚀
