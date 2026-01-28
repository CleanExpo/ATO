# Slack Integration - Quick Start Guide

## Overview

I've implemented comprehensive Slack notifications for your ATO platform. You'll receive real-time alerts about:

✅ **User Activity** - Signups, platform connections
✅ **AI Analysis** - Progress, completions, findings
✅ **Tax Alerts** - Critical deadlines and opportunities
✅ **Payments** - Revenue and failed payments
✅ **System Issues** - Errors and health warnings
✅ **Daily Summary** - EOD report at 6:00 PM AEST

---

## Quick Setup (5 minutes)

### Step 1: Create Slack Webhook

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name: `ATO Notifications`, select your workspace
4. Go to **"Incoming Webhooks"** → Toggle ON
5. Click **"Add New Webhook to Workspace"**
6. Select channel (e.g., `#ato-notifications`)
7. Copy the webhook URL that looks like:
   ```
   https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
   ```

### Step 2: Add Environment Variable

**Local (.env.local):**
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00.../B00.../XXX...
```

**Production (Vercel Dashboard):**
1. Go to your Vercel project
2. Settings → Environment Variables
3. Add `SLACK_WEBHOOK_URL` with your webhook URL
4. Save and redeploy

### Step 3: Test It

**Local:**
```bash
curl -X POST http://localhost:3000/api/slack/test
```

**Production:**
```bash
curl -X POST https://ato.app/api/slack/test
```

You should see a test message in your Slack channel! 🎉

---

## What You'll Receive

### Real-Time Notifications

**User Signup:**
```
🎉 New User Signup
Email: user@example.com
Method: Google
Time: [AEST]
```

**AI Analysis Complete:**
```
✅ AI Analysis Complete
User: user@example.com
Platform: XERO
Transactions: 12,236
Duration: 245.3 minutes

Key Findings:
R&D Candidates: 487 (4.0%)
Potential R&D Benefit: $522,450.00
Deduction Opportunities: 23
Potential Deductions: $45,200.00

Analysis Cost: $4.88 USD
ROI: 116,427x
```

**Critical Tax Alert:**
```
🚨 Critical Tax Alert
User: user@example.com

R&D Registration Deadline Approaching
You have 487 R&D eligible transactions totaling $1,200,000
in FY2024. Registration deadline is 30/04/2025.

💰 Potential Benefit: $522,000.00
📅 Due Date: 30 April 2025
```

**System Error:**
```
🔴 Critical Error
Error Type: AI Analysis Failed
Time: [AEST]
User ID: abc123...
Endpoint: /api/audit/analyze

Error Message:
Rate limit exceeded: 15 requests per minute

Stack Trace:
Error: Rate limit exceeded...
```

### Daily Summary (6:00 PM AEST)

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

## When Notifications Are Sent

| Event | Timing | Notification |
|-------|--------|--------------|
| **User signup** | Immediate | New User Signup |
| **Platform connection** | Immediate | Platform Connected |
| **Analysis started** | Immediate | AI Analysis Started |
| **Analysis progress** | 25%, 50%, 75% | Analysis Progress |
| **Analysis complete** | Immediate | AI Analysis Complete |
| **Critical alert generated** | Immediate | Critical Tax Alert |
| **Payment received** | Immediate | Payment Received |
| **Payment failed** | Immediate | Payment Failed |
| **System error** | Immediate | Critical Error |
| **Daily summary** | 6:00 PM AEST | Daily Summary Report |

---

## Integration Points

### ✅ Already Integrated

**AI Batch Processor:**
- Sends notification when analysis starts
- Sends notification when analysis completes with statistics
- Sends notification if analysis fails with error details

**Alert Generator:**
- Sends notification for critical tax alerts (R&D, Div 7A, etc.)

**Scheduled Cron:**
- Sends daily summary report every day at 6:00 PM AEST

### 🔜 Ready to Integrate (Optional)

You can easily add Slack notifications to:

**User Authentication (app/api/auth):**
```typescript
import slack from '@/lib/slack/slack-notifier'

// After signup
await slack.notifyUserSignup(userId, email, 'google')
```

**Platform Connections (app/api/auth/xero/callback):**
```typescript
await slack.notifyPlatformConnection(
  userId,
  email,
  'xero',
  organisationName
)
```

**Payment Processing:**
```typescript
// After successful payment
await slack.notifyPaymentReceived(userId, email, amount, plan, 'stripe')

// After failed payment
await slack.notifyPaymentFailed(userId, email, amount, plan, reason)
```

**Error Boundaries:**
```typescript
// In error handlers
await slack.notifyError(
  'Database Connection Failed',
  error.message,
  { userId, endpoint, stackTrace }
)
```

---

## Advanced Configuration

### Multiple Channels

Create separate webhooks for different notification types:

```bash
# Main notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/.../main

# Errors only
SLACK_WEBHOOK_ERROR_URL=https://hooks.slack.com/services/.../errors

# Payments only
SLACK_WEBHOOK_PAYMENTS_URL=https://hooks.slack.com/services/.../payments
```

### Disable Specific Notifications

Edit `lib/ai/batch-processor.ts` and comment out unwanted notifications:

```typescript
// Disable progress milestones
// await slack.notifyAnalysisProgress(...)

// Keep start and complete notifications
await slack.notifyAnalysisStarted(...)
await slack.notifyAnalysisComplete(...)
```

### Custom Notification Format

Modify `lib/slack/slack-notifier.ts` to customize message format, colors, or fields.

---

## Files Created

1. **lib/slack/slack-notifier.ts** (800+ lines)
   - Complete notification service
   - All notification types implemented
   - Rich Slack Block Kit formatting

2. **app/api/slack/test/route.ts**
   - Test endpoint to verify webhook

3. **app/api/slack/daily-summary/route.ts**
   - Cron job for daily summary report

4. **docs/SLACK_INTEGRATION_SETUP.md**
   - Comprehensive setup guide
   - All notification examples
   - Troubleshooting tips

5. **lib/ai/batch-processor.ts** (modified)
   - Integrated analysis notifications

6. **vercel.json** (modified)
   - Added daily summary cron (6:00 PM AEST)

---

## Environment Variables

Add these to your environment:

```bash
# Required - Slack webhook URL
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00.../B00.../XXX...

# Already configured - used for cron auth
CRON_SECRET=your-existing-cron-secret

# Already configured - used in notification links
NEXT_PUBLIC_APP_URL=https://ato.app
```

---

## Testing Checklist

Once configured, test these scenarios:

- [ ] Test webhook: `curl -X POST http://localhost:3000/api/slack/test`
- [ ] Run AI analysis and check for notifications
- [ ] Trigger an error and check error notification
- [ ] Wait until 6:00 PM AEST for daily summary
- [ ] Check Slack message formatting and links

---

## Troubleshooting

### "SLACK_WEBHOOK_URL not configured"

**Fix:** Add the environment variable to `.env.local` and restart dev server

### "invalid_token" error from Slack

**Fix:** Regenerate webhook in Slack API console and update environment variable

### Messages not appearing

**Fix:**
1. Check webhook URL is correct
2. Verify app is still authorized in workspace
3. Check channel permissions

### Delayed notifications

**Fix:** Check Slack status page: https://status.slack.com

---

## Next Steps

1. ✅ Complete setup (Steps 1-3 above)
2. ✅ Test integration
3. ✅ Deploy to production (Vercel will auto-configure cron)
4. 📊 Monitor your Slack channel for real-time updates
5. 🎨 Customize channels and notification preferences as needed

---

## Support

**Full documentation:** See `docs/SLACK_INTEGRATION_SETUP.md`

**Slack API docs:** https://api.slack.com/messaging/webhooks

**Slack status:** https://status.slack.com

---

**Setup complete!** 🎉 Your Slack channel will now receive real-time notifications about all platform activity.

---

**Last Updated:** 2026-01-28
