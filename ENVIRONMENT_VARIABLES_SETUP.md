# Environment Variables Setup for Production

## Overview

After linking to the correct `ato` Vercel project, you need to add all required environment variables in the Vercel Dashboard.

## How to Add Variables

1. Go to: https://vercel.com/unite-group/ato
2. Click **Settings** → **Environment Variables**
3. For each variable below, click **Add New**
4. ✅ **CRITICAL:** Check ALL 3 environments for each variable:
   - Production
   - Preview
   - Development

---

## Required Variables (MUST ADD)

### 1. Supabase Configuration

**NEXT_PUBLIC_SUPABASE_URL**
```
[Get from .env.local file]
```
Environments: ✅ All 3

**NEXT_PUBLIC_SUPABASE_ANON_KEY**
```
[Get from .env.local file]
```
Environments: ✅ All 3

**SUPABASE_SERVICE_ROLE_KEY**
```
[Get from .env.local file]
```
Environments: ✅ All 3

---

### 2. Application Settings

**NEXT_PUBLIC_BASE_URL**

For Production:
```
https://ato-ai.app
```
Environment: ✅ Production only

For Preview/Development:
```
https://ato-blush.vercel.app
```
Environments: ✅ Preview + Development

(Or add separately to each environment)

**SESSION_SECRET**
```
[Get from .env.local file]
```
Environments: ✅ All 3

---

### 3. Google AI (Gemini)

**GOOGLE_AI_API_KEY**
```
[Get from .env.local file]
```
Environments: ✅ All 3

---

### 4. Slack Integration

**SLACK_WEBHOOK_URL**
```
[Get from .env.local file - Your Slack webhook URL]
```
Environments: ✅ All 3

**CRON_SECRET**
```
[Get from .env.local file]
```
Environments: ✅ All 3

---

### 5. Resend Email

**RESEND_API_KEY**
```
[Get from .env.local file]
```
Environments: ✅ All 3

**RESEND_FROM_EMAIL**
```
[Get from .env.local file]
```
Environments: ✅ All 3

---

### 6. Google Workspace

**GOOGLE_CLIENT_ID**
```
[Get from .env.local file]
```
Environments: ✅ All 3

**GOOGLE_CLIENT_SECRET**
```
[Get from .env.local file]
```
Environments: ✅ All 3

**GOOGLE_REDIRECT_URI**

For Production:
```
https://ato-ai.app/api/auth/google/callback
```
Environment: ✅ Production only

For Preview/Development:
```
https://ato-blush.vercel.app/api/auth/google/callback
```
Environments: ✅ Preview + Development

---

### 7. Jina AI (Optional)

**JINA_API_KEY**
```
jina_c016fb6c12c1444c98737d7e9f70966eNpogql_hauwHSi3Ta2KPptcvhXLc
```
Environments: ✅ All 3

---

### 8. Feature Flags

**ENABLE_TAX_ALERTS**
```
true
```
Environments: ✅ All 3

**ENABLE_PDF_EXPORT**
```
true
```
Environments: ✅ All 3

**ENABLE_EXCEL_EXPORT**
```
true
```
Environments: ✅ All 3

**ENABLE_EMAIL_REPORTS**
```
true
```
Environments: ✅ All 3

**ENABLE_MULTI_PLATFORM**
```
true
```
Environments: ✅ All 3

---

## Optional Variables (Add Later if Needed)

### Xero Integration
- XERO_CLIENT_ID
- XERO_CLIENT_SECRET
- XERO_REDIRECT_URI

### MYOB Integration
- MYOB_CLIENT_ID
- MYOB_CLIENT_SECRET

### QuickBooks Integration
- QUICKBOOKS_CLIENT_ID
- QUICKBOOKS_CLIENT_SECRET

---

## After Adding Variables

### CRITICAL: You MUST redeploy for variables to take effect

```bash
vercel --prod
```

Or in Vercel Dashboard:
1. Go to **Deployments** tab
2. Click **Redeploy** on latest deployment
3. Wait for "Ready" status

---

## Verification Checklist

After adding variables and redeploying:

- [ ] All required variables added (12 variables minimum)
- [ ] Each variable has all 3 environments checked
- [ ] NEXT_PUBLIC_BASE_URL is correct for production (https://ato-ai.app)
- [ ] Redeployed after adding variables
- [ ] Test endpoint: https://ato-ai.app/api/slack/test
- [ ] Received Slack test message
- [ ] Verify in Vercel Dashboard: Settings → Environment Variables (should see 12+ variables)

---

## Common Issues

### "Environment variable not found" errors
- **Fix:** Make sure you checked all 3 environments when adding the variable
- **Fix:** Redeploy after adding variables

### Slack test returns 404
- **Fix:** Wait 2-3 minutes for deployment to complete
- **Fix:** Check deployment logs for build errors

### OAuth callbacks failing
- **Fix:** Update redirect URIs in Google/Xero/MYOB developer consoles to use ato-ai.app domain

---

**Next:** See `DEPLOYMENT_INSTRUCTIONS.md` for how to deploy to production
