# CRITICAL: Vercel Project Configuration Fix

## Problem Identified

The production domain `ato-app-phi.vercel.app` is currently connected to the **WRONG** Vercel project:

- **Current (Wrong):** `unite-group/ato`
- **Desired (Correct):** `unite-group/ato`

## Evidence

```bash
$ vercel inspect ato-app-phi.vercel.app
Fetching deployment "ato-app-phi.vercel.app" in team-agi
> Project: ato-app
> Team: team-agi
```

The domain is pointing to team-agi, but you want to use unite-group/ato.

---

## Fix Options

### Option A: Transfer Domain to unite-group/ato (Recommended)

This moves the custom domain from the old project to the correct one.

#### Steps:

1. **Remove domain from old project (unite-group/ato)**
   - Go to: https://vercel.com/unite-group/ato/settings/domains
   - Find `ato-app-phi.vercel.app`
   - Click the 3 dots → **Remove**
   - Confirm removal

2. **Add domain to correct project (unite-group/ato)**
   - Go to: https://vercel.com/unite-group/ato/settings/domains
   - Click **Add Domain**
   - Enter: `ato-app-phi.vercel.app`
   - Click **Add**
   - Should automatically verify (it was already verified)

3. **Add ALL environment variables to unite-group/ato**
   - Go to: https://vercel.com/unite-group/ato/settings/environment-variables
   - Add each variable for **Production, Preview, and Development**:

```bash
# REQUIRED (Core Functionality)
XERO_CLIENT_ID=B5135FA8CB7443F498F3565421F47DC0
XERO_CLIENT_SECRET=QqaYFORaqRfAMloIMsQuC_L5di5XzSQOA2jmCkjZ4oAdqAft

# REQUIRED (Supabase - Token Storage)
NEXT_PUBLIC_SUPABASE_URL=https://xwqymjisxmtcmaebcehw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTE3MjksImV4cCI6MjA4NDM2NzcyOX0.7BUiIFURS9QclDEY5kYgahba6I6yQpmQKwJ2Xk2SetE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo

# REQUIRED (OAuth Redirect)
NEXT_PUBLIC_BASE_URL=https://ato-app-phi.vercel.app

# OPTIONAL (Enhanced Features)
GOOGLE_AI_API_KEY=AIzaSyA5i79ERLApgFdXGA3pfY0suhx7nx0WhtI
BUSINESS_NAME=Disaster Recovery Qld
BUSINESS_ABN=42 633 062 307
YOUR_NAME=Phill McGurk
```

**IMPORTANT:** When adding each variable:
- Click **Add New**
- Enter Name (e.g., `XERO_CLIENT_ID`)
- Enter Value (copy exactly, no extra spaces or newlines)
- Select environments: **Production, Preview, Development** (all 3)
- Click **Save**
- Repeat for all 10 variables

4. **Connect GitHub to unite-group/ato**
   - Go to: https://vercel.com/unite-group/ato/settings/git
   - If not connected:
     - Click **Connect Git Repository**
     - Select **GitHub**
     - Authorize Vercel if needed
     - Select repository: `CleanExpo/ATO`
     - Select branch: `main`
     - Click **Connect**

5. **Trigger Deployment**
   - Go to: https://vercel.com/unite-group/ato/deployments
   - Click **Create Deployment**
   - Select branch: `main`
   - Click **Deploy**
   - Wait 3-4 minutes for build

6. **Verify Deployment**
   Test these URLs:
   ```
   https://ato-app-phi.vercel.app/api/health
   Expected: {"status":"healthy",...}

   https://ato-app-phi.vercel.app/dashboard
   Expected: Loads immediately
   ```

---

### Option B: Use unite-group Project with Different Domain

If you don't want to move the domain, you can:

1. Deploy to unite-group/ato (it will get auto-generated domain like `ato-abc123.vercel.app`)
2. Add all environment variables to that project
3. Test on the auto-generated domain
4. If it works, then transfer the custom domain later

---

## Why This Happened

The Vercel CLI was configured to use `team-agi` scope:
- File `.vercel/project.json` had: `"orgId": "team_zp1CsU87brPbSks2eFbPqWJQ"`
- This is the team-agi organization ID
- All `vercel env add` commands went to unite-group/ato
- But you wanted to use unite-group/ato

The CLI **cannot access** unite-group because:
```bash
$ vercel teams ls
team-agi          ← Has access
persona-foundary
oz-invoice
...
(unite-group is NOT in this list)
```

This means the account currently logged into the CLI doesn't have access to unite-group.

---

## What's Already Done (In Wrong Project)

These environment variables were added to **unite-group/ato** (the wrong project):

✅ XERO_CLIENT_ID
✅ XERO_CLIENT_SECRET
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY (without `\n`)
✅ SUPABASE_SERVICE_ROLE_KEY (without `\n`)
✅ NEXT_PUBLIC_BASE_URL
✅ GOOGLE_AI_API_KEY
✅ BUSINESS_NAME
✅ BUSINESS_ABN
✅ YOUR_NAME

These need to be **re-added** to unite-group/ato (the correct project).

---

## Current GitHub Status

✅ **GitHub Repository:** https://github.com/CleanExpo/ATO
✅ **Latest Commit:** `b6be2ae` - All production fixes implemented
✅ **Branch:** `main`

The code is ready. It just needs to be deployed from the correct Vercel project with the correct environment variables.

---

## After Fixing

Once domain is transferred and variables are added:

1. ✅ Push to GitHub will auto-deploy to unite-group/ato
2. ✅ Domain ato-app-phi.vercel.app will serve the new code
3. ✅ Health check will work: `https://ato-app-phi.vercel.app/api/health`
4. ✅ Dashboard will load: `https://ato-app-phi.vercel.app/dashboard`
5. ✅ Xero OAuth will work correctly

---

## Quick Reference

**Correct Project URL:** https://vercel.com/unite-group/ato
**Wrong Project URL:** https://vercel.com/unite-group/ato (ignore this)
**Production Domain:** ato-app-phi.vercel.app (needs to point to correct project)
**GitHub Repo:** https://github.com/CleanExpo/ATO

---

## If You Have Questions

- **Can't access unite-group/ato?** → Make sure you're logged into the correct Vercel account
- **Domain transfer fails?** → You may need owner/admin permissions in both organizations
- **Variables not saving?** → Make sure to select all 3 environments (Production, Preview, Development)
- **Deployment fails?** → Check build logs in Vercel dashboard for errors
