---
description: End-to-end Xero OAuth 2.0 connection setup and troubleshooting
---

# Xero Setup Workflow

This workflow uses the `xero-connector` agent to perform a complete setup or refresh of the Xero connection.

1. **Information Gathering**
   - Check current `.env.local` for existing credentials.
   - Verify Supabase `xero_connections` table status.

// turbo
2. **Xero Portal Configuration**
   - Navigate to https://developer.xero.com/app/manage/
   - Create a new app "ATO Optimizer Suite" (or update existing).
   - Configure Redirect URIs:
     - `http://localhost:3000/api/auth/xero/callback`
     - `https://ato-git-main-unite-group.vercel.app/api/auth/xero/callback`
   - Generate Client Secret.

3. **Secure Secrets Handling**
   - Agent extracts Client ID and Secret from screenshots/DOM.
   - Update `.env.local` with new values.
   - (Manual step for user) Update Vercel environment variables.

4. **Code Realignment**
   - Ensure `lib/xero/client.ts` uses correct scopes and dynamic base URL.
   - Ensure callback route handles token exchange correctly.

5. **Final Verification**
   - Run `node check-connections.js` to ensure sync works.
   - Test locally by browser.
