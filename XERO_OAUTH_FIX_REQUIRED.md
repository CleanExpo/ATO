# Xero OAuth Configuration Fix Required

## Status: Application Working ✅ | Xero OAuth Blocked ❌

**Date:** January 20, 2026

---

## Summary

The ATO Tax Optimizer application is **fully operational** and deployed successfully. However, adding new Xero connections fails with a 500 error due to a **Xero Developer Portal configuration issue**.

**Root Cause:** The redirect URL `https://ato-blush.vercel.app/api/auth/xero/callback` is not whitelisted in the Xero OAuth app settings.

---

## Current Status

### ✅ What's Working

1. **Application Deployment**
   - URL: https://ato-blush.vercel.app/dashboard
   - Status: Fully operational
   - Environment variables: All configured correctly
   - GitHub integration: Connected and auto-deploying

2. **Dashboard**
   - Loads immediately without errors
   - Displays correct business name: "Disaster Recovery Qld Pty Ltd"
   - Shows 2 existing Xero connections
   - Shows 100 transactions scanned
   - All three feature cards visible and working:
     - R&D Tax Assessment
     - Transaction Audit
     - Loss Analysis

3. **Existing Xero Connections**
   - 2 organizations already connected
   - Data syncing working
   - Connections status: Active

### ❌ What's Not Working

**Adding New Xero Connections**

When clicking "Add Connection" button:
1. Application correctly initiates OAuth flow
2. Redirects to Xero authorization page
3. **Xero returns Error 500 with:**
   - Error: `unauthorized_client`
   - Message: `Invalid redirect_uri`
   - Error code: `500`

**Screenshot Evidence:**
```
Error: unauthorized_client
Invalid redirect_uri
Error code: 500
```

---

## Root Cause Analysis

The error occurs because:

1. **Application Configuration (Correct ✅)**
   - Environment variable `NEXT_PUBLIC_BASE_URL` = `https://ato-blush.vercel.app`
   - OAuth flow correctly constructs redirect URL: `https://ato-blush.vercel.app/api/auth/xero/callback`

2. **Xero Developer Portal (Incorrect ❌)**
   - The redirect URL is NOT in the whitelist
   - Xero OAuth server rejects the authorization request
   - Returns "unauthorized_client" error

**Why This Happened:**
- The Vercel deployment URL changed from `ato-app-phi.vercel.app` to `ato-blush.vercel.app`
- The Xero Developer Portal still has the OLD redirect URL configured
- The NEW redirect URL needs to be added to the whitelist

---

## Fix Instructions

### Step 1: Access Xero Developer Portal

1. Go to: https://developer.xero.com/app/manage
2. Log in with your Xero developer account
3. Find your OAuth 2.0 app:
   - Client ID: `B5135FA8CB7443F498F3565421F47DC0`
   - App name: (Look for your ATO Tax Optimizer app)

### Step 2: Update Redirect URLs

1. Click on your app to open settings
2. Navigate to **"Configuration"** or **"OAuth 2.0"** section
3. Find the **"Redirect URIs"** field
4. Add the new redirect URL:
   ```
   https://ato-blush.vercel.app/api/auth/xero/callback
   ```
5. **Important:** Keep the existing redirect URLs (if any) for backward compatibility:
   - `http://localhost:3000/api/auth/xero/callback` (for local development)
   - Any other production URLs you're using

6. Click **"Save"** or **"Update"**

### Step 3: Wait for Propagation

- Xero updates usually take effect immediately
- Wait 1-2 minutes for changes to propagate
- No need to redeploy the Vercel application

### Step 4: Test OAuth Flow

1. Go to: https://ato-blush.vercel.app/dashboard
2. Click **"Add Connection"** button
3. Authorize with Xero
4. Should redirect back successfully
5. New connection should appear in "Connected Organizations"

---

## Expected Redirect URLs Configuration

Your Xero OAuth app should have these redirect URLs configured:

```
# Production (Current)
https://ato-blush.vercel.app/api/auth/xero/callback

# Local Development
http://localhost:3000/api/auth/xero/callback

# Optional: If you want to support the alternative Vercel URL
https://ato-bdzzfl58p-unite-group.vercel.app/api/auth/xero/callback
```

---

## Verification Steps

After updating Xero Developer Portal:

### 1. Test New Connection
```
1. Visit: https://ato-blush.vercel.app/dashboard
2. Click "Add Connection"
3. Expected: Redirects to Xero login
4. Log in to Xero
5. Expected: Authorization page
6. Click "Allow Access"
7. Expected: Redirects back to dashboard
8. Expected: New connection appears in "Connected Organizations"
```

### 2. Verify Connection Works
```
1. New organization should show "Active" status
2. Click on any feature (R&D Tax Assessment, Transaction Audit, Loss Analysis)
3. Expected: Data loads from the new connection
4. Expected: No errors
```

---

## Technical Details

### OAuth Flow Breakdown

**Correct Flow:**
```
1. User clicks "Add Connection"
   ↓
2. App generates OAuth URL with:
   - client_id: B5135FA8CB7443F498F3565421F47DC0
   - redirect_uri: https://ato-blush.vercel.app/api/auth/xero/callback
   - scope: accounting.transactions, etc.
   ↓
3. User authorizes in Xero
   ↓
4. Xero validates redirect_uri against whitelist ← FAILING HERE
   ↓
5. Xero redirects back with authorization code
   ↓
6. App exchanges code for access token
   ↓
7. App stores token in Supabase
   ↓
8. Connection complete ✅
```

**Current Failure Point:**
- Step 4: Xero rejects the redirect_uri
- Returns: `unauthorized_client` error
- Reason: `https://ato-blush.vercel.app/api/auth/xero/callback` not in whitelist

### Related Files

**Application Code (No changes needed):**
- `app/api/auth/xero/route.ts` - OAuth initiation (correct)
- `app/api/auth/xero/callback/route.ts` - OAuth callback handler (correct)
- `lib/xero/client.ts` - Xero API client (correct)
- `lib/config/env.ts` - Environment validation (correct)

**Vercel Environment Variables (All correct):**
- `XERO_CLIENT_ID` = `B5135FA8CB7443F498F3565421F47DC0`
- `XERO_CLIENT_SECRET` = `QqaYFORaqRfAMloIMsQuC_L5di5XzSQOA2jmCkjZ4oAdqAft`
- `NEXT_PUBLIC_BASE_URL` = `https://ato-blush.vercel.app`

---

## Alternative: Using a Custom Domain

If you want to avoid this issue in the future, consider setting up a custom domain:

1. Register a domain (e.g., `ato.yourdomain.com`)
2. Add it to your Vercel project
3. Configure Xero with the custom domain redirect URL
4. The domain won't change with each deployment

**Benefits:**
- Stable redirect URL
- No need to update Xero settings when deployment URL changes
- Professional appearance

---

## Troubleshooting

### If the error persists after updating Xero:

**1. Verify the redirect URL is saved correctly**
   - Go back to Xero Developer Portal
   - Check the redirect URL is exactly: `https://ato-blush.vercel.app/api/auth/xero/callback`
   - No extra spaces, no trailing slashes
   - HTTPS, not HTTP

**2. Try clearing browser cache**
   - Clear cookies for both `ato-blush.vercel.app` and `xero.com`
   - Try in an incognito/private window

**3. Check Xero API status**
   - Visit: https://status.xero.com/
   - Ensure OAuth services are operational

**4. Verify Xero app is not suspended**
   - Check Xero Developer Portal for any warnings
   - Ensure your app is in "Production" mode, not "Development"

**5. Contact Xero Support**
   - If the issue persists, contact Xero Developer Support
   - Reference: "Invalid redirect_uri error with Client ID: B5135FA8CB7443F498F3565421F47DC0"

---

## Summary of Action Required

**YOU NEED TO DO (5 minutes):**
1. Log in to Xero Developer Portal: https://developer.xero.com/app/manage
2. Find your OAuth app (Client ID: B5135FA8CB7443F498F3565421F47DC0)
3. Add redirect URL: `https://ato-blush.vercel.app/api/auth/xero/callback`
4. Save changes
5. Test by clicking "Add Connection" on the dashboard

**NO CODE CHANGES NEEDED:**
- All application code is correct
- All environment variables are correct
- The issue is purely in Xero configuration

---

## Quick Reference

| Item | Value |
|------|-------|
| **Application URL** | https://ato-blush.vercel.app/dashboard |
| **Xero Client ID** | B5135FA8CB7443F498F3565421F47DC0 |
| **Redirect URL to Add** | https://ato-blush.vercel.app/api/auth/xero/callback |
| **Xero Developer Portal** | https://developer.xero.com/app/manage |
| **Current Status** | Application ✅ / OAuth ❌ |
| **Time to Fix** | 5 minutes (Xero portal update only) |

---

## Files for Reference

- `DEPLOYMENT_COMPLETE.md` - Original deployment completion summary
- `FINAL_STATUS.md` - Previous session status
- `ACTION_REQUIRED.md` - Vercel project configuration instructions
- `XERO_OAUTH_FIX_REQUIRED.md` - This file

---

**Bottom Line:**

The application is **fully functional and deployed correctly**. The 500 error is caused by a missing redirect URL in the Xero Developer Portal. Once you add the redirect URL to Xero's whitelist, OAuth will work and you'll be able to add new connections.

---

_Last Updated: January 20, 2026_
_Issue: Xero OAuth redirect URL not whitelisted_
_Solution: Add redirect URL in Xero Developer Portal_
