# Slack Integration Setup Guide

## Overview

Get real-time notifications in Slack about:
- 👥 **User Activity** - Signups, platform connections, daily active users
- 🔬 **AI Analysis Progress** - Analysis started/completed, findings, ROI
- 🔔 **Tax Alerts** - Critical alerts (R&D deadlines, Division 7A, etc.)
- 💳 **Payments** - Successful/failed payments, revenue summaries
- 🔴 **System Issues** - Errors, rate limits, health warnings
- 📊 **Daily Summary** - Comprehensive EOD report

---

## Step 1: Create Slack Incoming Webhook

### 1.1 Go to Slack API Console

Visit: https://api.slack.com/apps

### 1.2 Create New App

1. Click **"Create New App"**
2. Choose **"From scratch"**
3. **App Name:** `ATO Notifications` (or your preferred name)
4. **Workspace:** Select your Slack workspace
5. Click **"Create App"**

### 1.3 Enable Incoming Webhooks

1. In the left sidebar, click **"Incoming Webhooks"**
2. Toggle **"Activate Incoming Webhooks"** to **ON**
3. Scroll down and click **"Add New Webhook to Workspace"**
4. Select the channel where you want notifications (e.g., `#ato-notifications`)
5. Click **"Allow"**

### 1.4 Copy Webhook URL

You'll see a webhook URL like:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

**Copy this URL** - you'll need it in the next step.

---

## Step 2: Configure Environment Variable

### 2.1 Local Development (.env.local)

Add to your `.env.local` file:

```bash
# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### 2.2 Production (Vercel Dashboard)

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your **australian-tax-optimizer** project
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Key:** `SLACK_WEBHOOK_URL`
   - **Value:** `https://hooks.slack.com/services/...`
   - **Environment:** Check all (Production, Preview, Development)
5. Click **"Save"**
6. **Redeploy** your app for changes to take effect

---

## Step 3: Test the Integration

### 3.1 Test via API Endpoint

**Local:**
```bash
curl -X POST http://localhost:3000/api/slack/test
```

**Production:**
```bash
curl -X POST https://ato.app/api/slack/test
```

### 3.2 Expected Result

You should see a test message in your Slack channel:

```
🎉 Slack Integration Test

Congratulations! Your Slack webhook is configured correctly for the Australian Tax Optimizer.

Time: [Current time in AEST]
Status: ✅ Connected

💡 You will now receive notifications about user activity, AI analysis progress, payments, and system issues.
```

### 3.3 Troubleshooting Test

**If you get an error:**

❌ **"SLACK_WEBHOOK_URL not configured"**
- Solution: Add the environment variable and restart your dev server or redeploy

❌ **"Slack webhook request failed"**
- Solution: Verify your webhook URL is correct (should start with `https://hooks.slack.com/services/`)
- Check that your Slack app is still authorized

❌ **"invalid_payload"**
- Solution: The webhook URL might be incorrect - regenerate it in Slack API console

---

## Step 4: Notification Types

### User Activity Notifications

**New User Signup:**
```
🎉 New User Signup
Email: user@example.com
Method: Email / Google
User ID: abc123...
Time: [AEST timestamp]
```

**Platform Connection:**
```
🔵 Platform Connected: XERO
Platform: XERO
User: user@example.com
Organisation: Acme Corp Pty Ltd
Time: [AEST timestamp]
```

**Daily Active Users (6:00 PM AEST daily):**
```
📊 Daily Active Users Report
Total Users: 125
Active Today: 42 (33.6%)
New Signups: 3
Date: [Date]
```

### AI Analysis Notifications

**Analysis Started:**
```
🔬 AI Analysis Started
User: user@example.com
Platform: XERO
Transactions: 12,236
Status: 🟡 In Progress
```

**Analysis Complete:**
```
✅ AI Analysis Complete
User: user@example.com
Platform: XERO
Transactions: 12,236
Duration: 245.3 minutes

Key Findings:
R&D Candidates: 487 transactions (4.0%)
Potential R&D Benefit: $522,450.00
Deduction Opportunities: 23 opportunities
Potential Deductions: $45,200.00

Analysis Cost: $4.8750 USD
ROI: 116,427x
```

### Tax Alert Notifications

**Critical Alert Triggered:**
```
🚨 Critical Tax Alert
User: user@example.com
Category: deadline

R&D Registration Deadline Approaching
You have 487 R&D eligible transactions totaling $1,200,000 in FY2024.
Registration deadline is 30/04/2025. Potential tax benefit: $522,000.

💰 Potential Benefit: $522,000.00
📅 Due Date: 30 April 2025
```

### Payment Notifications

**Payment Received:**
```
💳 Payment Received
User: user@example.com
Amount: $299.00
Plan: Professional
Payment Method: Visa **** 1234
✅ Payment processed successfully at [timestamp]
```

**Payment Failed:**
```
❌ Payment Failed
User: user@example.com
Amount: $299.00
Plan: Professional
Reason: Card declined
⚠️ Action required: Contact user to update payment method
```

### Error Notifications

**Critical Error:**
```
🔴 Critical Error
Error Type: Database Connection Failed
Time: [timestamp]
User ID: abc123...
Endpoint: /api/audit/analyze

Error Message:
Connection timeout after 30 seconds

Stack Trace:
Error: Connection timeout...
  at DatabaseClient.connect (/app/lib/database.ts:42)
  ...
```

**Rate Limit Hit:**
```
⚠️ Rate Limit Hit
Service: Google Gemini AI
User ID: abc123...
Endpoint: /api/audit/analyze
Time: [timestamp]

💡 Consider implementing request throttling or upgrading API plan
```

### Daily Summary (6:00 PM AEST)

**Comprehensive EOD Report:**
```
📊 Daily Summary Report
Date: Tuesday, 28 January 2026

👥 User Activity
Total Users: 125
Active Today: 42 (33.6%)
New Signups: 3

🔬 AI Analysis
Analyses Run: 8
Transactions Analyzed: 45,234
R&D Benefit Identified: $1,250,000.00
Analysis Cost: $18.25 USD

🔔 Tax Alerts
Total Alerts: 15
Critical Alerts: 3

💰 Revenue
Total Revenue: $897.00
New Subscriptions: 3
Churned Subscriptions: 0

⚠️ System Health
Total Errors: 2
Critical Errors: 0
```

---

## Step 5: Customize Notifications

### 5.1 Change Notification Channel

1. Go to https://api.slack.com/apps
2. Select your **ATO Notifications** app
3. Go to **Incoming Webhooks**
4. Delete old webhook
5. Click **"Add New Webhook to Workspace"**
6. Select different channel
7. Update `SLACK_WEBHOOK_URL` environment variable

### 5.2 Create Multiple Webhooks (Optional)

You can create separate webhooks for different notification types:

**Environment variables:**
```bash
# Main notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/.../main-channel

# Error notifications only
SLACK_WEBHOOK_ERROR_URL=https://hooks.slack.com/services/.../errors-channel

# Payment notifications only
SLACK_WEBHOOK_PAYMENTS_URL=https://hooks.slack.com/services/.../payments-channel
```

Then update `slack-notifier.ts` to use specific webhooks for each type.

### 5.3 Disable Specific Notifications

To disable certain notification types, comment them out in the integration code:

**Example: Disable progress milestones**

In `lib/ai/batch-processor.ts`, comment out:
```typescript
// await slack.notifyAnalysisProgress(...)
```

---

## Step 6: Scheduled Jobs

The following notifications are sent automatically via Vercel Cron:

### Alert Checks (8:00 AM AEST daily)
- **Endpoint:** `/api/alerts/cron`
- **Schedule:** `0 8 * * *` (8:00 AM daily)
- **Notifications:** BAS/Tax Return/FBT deadline alerts

### Daily Summary (6:00 PM AEST daily)
- **Endpoint:** `/api/slack/daily-summary`
- **Schedule:** `0 18 * * *` (6:00 PM daily)
- **Notifications:** Comprehensive daily report

**To verify cron jobs are running:**
1. Go to Vercel Dashboard → Your Project
2. Click **"Deployments"**
3. Click **"Functions"** tab
4. Look for cron execution logs

---

## Step 7: Best Practices

### Channel Organization

**Recommended channel structure:**

- `#ato-main` - All general notifications
- `#ato-errors` - Critical errors only
- `#ato-revenue` - Payment and revenue notifications
- `#ato-analysis` - AI analysis completions
- `#ato-alerts` - Tax alert triggers

### Alert Filtering

Use Slack's notification preferences to control noise:

1. Right-click on channel → **"Notification preferences"**
2. Set to **"Only @mentions"** for low-priority channels
3. Set to **"All messages"** for critical channels (errors)

### Message Threading

For analysis progress updates, consider grouping them in threads:

In `slack-notifier.ts`, modify to include `thread_ts`:
```typescript
{
  text: 'Analysis Progress: 50%',
  thread_ts: originalMessageTimestamp  // Groups into thread
}
```

---

## Step 8: Testing Scenarios

### Test All Notification Types

**1. Test User Signup:**
- Create a new test user account
- Check for signup notification in Slack

**2. Test Platform Connection:**
- Connect a test Xero/MYOB/QuickBooks account
- Check for connection notification

**3. Test AI Analysis:**
- Run AI analysis: `POST /api/audit/analyze`
- Check for started/progress/complete notifications

**4. Test Error Handling:**
- Trigger an intentional error (invalid API call)
- Check for error notification

**5. Test Daily Summary:**
- Manually trigger: `POST /api/slack/daily-summary` (with CRON_SECRET)
- Check for daily summary message

---

## Step 9: Monitoring & Maintenance

### Check Webhook Health

**Slack provides webhook health metrics:**

1. Go to https://api.slack.com/apps
2. Select your app
3. Go to **"Incoming Webhooks"**
4. View **"Recent deliveries"** for delivery status

### Webhook Regeneration

**If webhook is compromised:**

1. Go to Slack API console
2. Delete compromised webhook
3. Create new webhook
4. Update `SLACK_WEBHOOK_URL` environment variable
5. Redeploy application

### Rate Limiting

Slack webhooks have rate limits:
- **1 message per second** per webhook
- Burst: Up to 100 messages in quick succession

**Our implementation respects these limits by:**
- Only sending significant events (no spam)
- Batching progress updates (25%, 50%, 75% milestones only)
- Using async/non-blocking sends

---

## Step 10: Troubleshooting

### Common Issues

#### ❌ "invalid_token" Error

**Cause:** Webhook URL is incorrect or app was deleted

**Solution:**
1. Regenerate webhook in Slack API console
2. Update environment variable
3. Redeploy

#### ❌ Messages Not Appearing

**Possible causes:**
1. Wrong channel selected
2. App not authorized in workspace
3. Environment variable not set in production

**Solution:**
1. Check webhook configuration in Slack API console
2. Reauthorize app if needed
3. Verify env var in Vercel dashboard

#### ❌ "no_service" Error

**Cause:** Workspace was deleted or suspended

**Solution:**
1. Check workspace status
2. Create new workspace if needed
3. Regenerate webhooks

#### ⚠️ Delayed Notifications

**Possible causes:**
1. Slack API rate limiting
2. Network issues
3. Webhook queue backed up

**Solution:**
1. Check Slack status page: https://status.slack.com
2. Review recent delivery logs in Slack API console
3. Consider creating multiple webhooks for different channels

---

## Environment Variables Summary

Add these to your `.env.local` and Vercel environment variables:

```bash
# Required
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX

# Already configured (needed for cron authentication)
CRON_SECRET=your-existing-cron-secret

# Application URL (for links in Slack messages)
NEXT_PUBLIC_APP_URL=https://ato.app
```

---

## Security Considerations

### Webhook URL Protection

- ✅ **DO:** Keep webhook URL secret (treat like API key)
- ✅ **DO:** Use environment variables (never commit to git)
- ✅ **DO:** Regenerate if accidentally exposed
- ❌ **DON'T:** Share webhook URL publicly
- ❌ **DON'T:** Log webhook URL in application logs

### Sensitive Data

Our implementation **automatically sanitizes**:
- User passwords (never sent)
- API tokens (truncated to first 8 chars)
- Credit card numbers (masked)
- Full stack traces (truncated to 500 chars)

### Access Control

- Only authenticated API endpoints can trigger notifications
- Cron endpoints require `CRON_SECRET` authentication
- User data restricted by Supabase RLS policies

---

## Support

**Slack API Documentation:**
https://api.slack.com/messaging/webhooks

**Slack API Status:**
https://status.slack.com

**ATO Slack Integration Issues:**
Create an issue in the GitHub repository with:
- Error message
- Webhook delivery logs from Slack API console
- Steps to reproduce

---

**Setup Complete!** 🎉

You'll now receive real-time notifications in Slack about all platform activity.

**Next Steps:**
1. Test the integration: `curl -X POST http://localhost:3000/api/slack/test`
2. Run an AI analysis to see notifications in action
3. Wait for 6:00 PM AEST to receive your first daily summary
4. Customize notification channels as needed

---

**Last Updated:** 2026-01-28
**Version:** 1.0.0
