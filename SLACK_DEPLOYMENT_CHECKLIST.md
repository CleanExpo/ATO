# Slack Integration - Deployment Checklist

## Current Status: Deployment In Progress

The code has been pushed to GitHub, but the Vercel deployment needs to complete before Slack notifications will work in production.

---

## ✅ Step 1: Verify Deployment Status

**Go to:** https://vercel.com/dashboard

**Look for:**
- Your **ato-app** project
- Latest deployment status (should show "Building" → "Ready")
- Deployment typically takes **2-3 minutes**

**Wait until you see:**
- ✅ Green checkmark
- ✅ Status: "Ready"
- ✅ No error messages

---

## ✅ Step 2: Add Environment Variables

**IMPORTANT:** Even if deployment is complete, Slack won't work without these variables.

### How to Add:

1. Go to: https://vercel.com/dashboard
2. Click your **ato-app** project
3. Click **Settings** (top menu)
4. Click **Environment Variables** (left sidebar)
5. Click **Add New** button

### Variable 1: SLACK_WEBHOOK_URL

**Name:**
```
SLACK_WEBHOOK_URL
```

**Value:**
```
[Your Slack webhook URL from .env.local]
```

**Environments:** Check ALL three:
- ✅ Production
- ✅ Preview
- ✅ Development

**Click "Save"**

---

### Variable 2: CRON_SECRET

**Click "Add New" again**

**Name:**
```
CRON_SECRET
```

**Value:**
```
[Your CRON_SECRET from .env.local]
```

**Environments:** Check ALL three:
- ✅ Production
- ✅ Preview
- ✅ Development

**Click "Save"**

---

## ✅ Step 3: Redeploy After Adding Variables

**After adding environment variables, you MUST redeploy:**

### Option A: Redeploy in Dashboard
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the three dots (...) menu
4. Click **Redeploy**
5. Wait 2-3 minutes

### Option B: Trigger Auto-Deploy (if you prefer)
Open terminal and run:
```bash
cd C:\ATO\ato-app
git commit --allow-empty -m "chore: reload environment variables"
git push origin main
```

---

## ✅ Step 4: Test the Integration

Once deployment shows "Ready", test the endpoint:

### Method 1: Browser
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

### Method 2: PowerShell
```powershell
Invoke-RestMethod -Uri "https://ato-blush.vercel.app/api/slack/test" -Method GET
```

### Method 3: Curl (Git Bash)
```bash
curl https://ato-blush.vercel.app/api/slack/test
```

---

## ✅ Step 5: Verify Slack Message

**Check your Slack channel** - you should see:

```
🎉 Slack Integration Test - Success!

Congratulations! Your Slack webhook is configured correctly
for the Australian Tax Optimizer.

Status: ✅ Connected
Environment: Local Development

💡 You will now receive notifications about user activity,
AI analysis progress, payments, and system issues.
```

---

## 🔍 Troubleshooting

### Still Getting 404?

**Check 1: Is deployment complete?**
- Go to Vercel Dashboard → Deployments
- Latest deployment should show "Ready" (green checkmark)
- If still building, wait another minute

**Check 2: Did deployment succeed?**
- Click on the latest deployment
- Look for any build errors
- Check "Build Logs" tab

**Check 3: Are environment variables added?**
- Go to Settings → Environment Variables
- Should see `SLACK_WEBHOOK_URL` and `CRON_SECRET`
- If missing, add them (see Step 2)
- Then redeploy (see Step 3)

**Check 4: Correct production URL?**
- Your URL might be different
- Check Vercel Dashboard for actual production URL
- Look for "Visit" button or "Domains" section

### Getting "invalid_token" from Slack?

**Solution:** Regenerate webhook:
1. Go to https://api.slack.com/apps
2. Select your ATO Notifications app
3. Go to Incoming Webhooks
4. Delete old webhook, create new one
5. Update `SLACK_WEBHOOK_URL` in Vercel
6. Redeploy

### Getting 500 Error?

**Check:**
1. Environment variables are set correctly (no typos)
2. Webhook URL starts with `https://hooks.slack.com/services/`
3. Check Function Logs in Vercel for error details

---

## 📊 What Happens After Setup

### Automatic Notifications

You'll receive Slack messages when:

**Real-time Events:**
- ✅ User signs up
- ✅ Platform connected (Xero/MYOB/QuickBooks)
- ✅ AI analysis starts
- ✅ AI analysis completes (with findings & ROI)
- ✅ Critical tax alert triggered
- ✅ Payment received
- ✅ Payment failed
- ✅ System error occurs

**Scheduled (via Vercel Cron):**
- 📊 Daily summary at 6:00 PM AEST
- 🔔 Alert checks at 8:00 AM AEST

### Vercel Cron Jobs

These are automatically configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/alerts/cron",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/slack/daily-summary",
      "schedule": "0 18 * * *"
    }
  ]
}
```

Vercel will call these endpoints automatically.

---

## 🎯 Quick Reference

**Vercel Dashboard:**
https://vercel.com/dashboard

**Your Project:**
https://vercel.com/team_kmzaci5riltocrhatlgcxlxuf/ato-app

**Production URL:**
https://ato-blush.vercel.app

**Test Endpoint:**
https://ato-blush.vercel.app/api/slack/test

**Slack API Console:**
https://api.slack.com/apps

---

## ✅ Final Checklist

Before considering setup complete:

- [ ] Vercel deployment shows "Ready" status
- [ ] `SLACK_WEBHOOK_URL` added to Vercel environment variables
- [ ] `CRON_SECRET` added to Vercel environment variables
- [ ] Both variables have all 3 environments checked
- [ ] Redeployed after adding variables
- [ ] Tested `/api/slack/test` endpoint (got 200 response)
- [ ] Received test message in Slack channel
- [ ] Verified cron jobs are scheduled in Vercel dashboard

---

## 🚀 You're Done!

Once all checkmarks are complete, your Slack integration is fully operational.

**Next time:**
- Run AI analysis → Get Slack notification with findings
- Critical tax alert triggered → Get Slack notification immediately
- 6:00 PM AEST → Receive daily summary automatically

---

**Need help?** Check the comprehensive guide:
- See `docs/SLACK_INTEGRATION_SETUP.md` for full documentation

**Last Updated:** 2026-01-28
