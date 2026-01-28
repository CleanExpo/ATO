# Complete Vercel Setup - 3 Steps

## Current Status
✅ Code pushed to GitHub
✅ Deployment triggered
⏳ Endpoint returning 404 (expected - deployment in progress)

---

## Step 1: Wait for Deployment (2-3 minutes)

**Go to:** https://vercel.com/dashboard

**Look for your `ato-app` project**, then:
- Click on it
- Check the "Deployments" tab
- Wait until you see: ✅ **Green checkmark** + Status: **"Ready"**

If you see **"Building"** or **"Queued"**, wait another minute and refresh.

---

## Step 2: Add Environment Variables

**IMPORTANT:** Even after deployment completes, Slack won't work without these variables.

### How to Add:

1. In Vercel Dashboard, click your **ato-app** project
2. Click **Settings** (top menu)
3. Click **Environment Variables** (left sidebar)
4. Click **Add New** button

### Add Variable 1: SLACK_WEBHOOK_URL

**Name:**
```
SLACK_WEBHOOK_URL
```

**Value:**
```
[Your Slack webhook URL from .env.local]
```

**Environments:** ✅ Check ALL three:
- Production
- Preview
- Development

**Click "Save"**

### Add Variable 2: CRON_SECRET

**Click "Add New" again**

**Name:**
```
CRON_SECRET
```

**Value:**
```
[Your CRON_SECRET from .env.local]
```

**Environments:** ✅ Check ALL three:
- Production
- Preview
- Development

**Click "Save"**

---

## Step 3: Redeploy

**CRITICAL:** After adding environment variables, you MUST redeploy for them to take effect.

### Option A: Redeploy in Dashboard (Recommended)

1. Go to **Deployments** tab
2. Find the latest deployment (should show "Ready")
3. Click the three dots **(...) menu** on the right
4. Click **Redeploy**
5. Confirm the redeploy
6. Wait 2-3 minutes for completion

### Option B: Trigger Auto-Deploy

```bash
cd C:\ATO\ato-app
git commit --allow-empty -m "chore: reload environment variables"
git push origin main
```

---

## Step 4: Test the Integration

Once redeployment shows "Ready", test the endpoint:

### Browser Test
Open this URL in your browser:
```
https://ato-blush.vercel.app/api/slack/test
```

**Expected response:**
```json
{
  "success": true,
  "message": "Test message sent to Slack successfully!",
  "timestamp": "2026-01-28T..."
}
```

### PowerShell Test
```powershell
cd C:\ATO\ato-app
.\check-vercel-status.ps1
```

---

## Step 5: Verify Slack Message

**Check your Slack channel** - you should see:

```
🎉 Slack Integration Test - Success!

Congratulations! Your Slack webhook is configured correctly
for the Australian Tax Optimizer.

Status: ✅ Connected
Environment: Production

💡 You will now receive notifications about user activity,
AI analysis progress, payments, and system issues.
```

---

## Troubleshooting

### Still Getting 404 After Redeploy?

1. **Check deployment logs:**
   - Go to Vercel Dashboard → Deployments
   - Click on the latest deployment
   - Check "Build Logs" tab for errors

2. **Verify environment variables:**
   - Go to Settings → Environment Variables
   - Should see `SLACK_WEBHOOK_URL` and `CRON_SECRET`
   - Both should have all 3 environments checked

3. **Check production URL:**
   - Your URL might be different
   - Look for "Visit" button in Vercel Dashboard
   - Or check "Domains" section for actual URL

### Getting "invalid_token" from Slack?

1. Go to https://api.slack.com/apps
2. Select your ATO Notifications app
3. Go to Incoming Webhooks
4. Create new webhook if needed
5. Update `SLACK_WEBHOOK_URL` in Vercel
6. Redeploy

---

## Quick Reference

**Vercel Dashboard:** https://vercel.com/dashboard

**Your Project:** https://vercel.com/team_kmzaci5riltocrhatlgcxlxuf/ato-app

**Production URL:** https://ato-blush.vercel.app

**Test Endpoint:** https://ato-blush.vercel.app/api/slack/test

**Slack API Console:** https://api.slack.com/apps

---

## Timeline

| Step | Duration | Status |
|------|----------|--------|
| 1. Wait for deployment | 2-3 min | Check dashboard |
| 2. Add env variables | 2 min | Follow guide above |
| 3. Redeploy | 2-3 min | Use dashboard |
| 4. Test endpoint | 30 sec | Should get 200 OK |
| 5. Verify Slack | 10 sec | Check for message |
| **TOTAL** | **~10 min** | |

---

## ✅ Success Checklist

- [ ] Deployment shows "Ready" status in Vercel
- [ ] `SLACK_WEBHOOK_URL` added to environment variables
- [ ] `CRON_SECRET` added to environment variables
- [ ] Both variables have all 3 environments checked
- [ ] Redeployed after adding variables
- [ ] Test endpoint returns 200 OK response
- [ ] Received test message in Slack channel
- [ ] Verified cron jobs scheduled in Vercel dashboard

---

## 🚀 You're Done!

Once all checkmarks are complete, your Slack integration is fully operational.

**Next time:**
- Run AI analysis → Get Slack notification with findings
- Critical tax alert triggered → Get notification immediately
- 6:00 PM AEST → Receive daily summary automatically

---

**For comprehensive details, see:** `SLACK_DEPLOYMENT_CHECKLIST.md`
