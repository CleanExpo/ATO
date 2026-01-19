# Xero Connection Management Skill

## Description
This skill focuses on the end-to-end setup and maintenance of the Xero OAuth 2.0 connection. It ensures that the application is correctly registered in the Xero Developer Portal, environment variables are synchronized across local and production (Vercel), and the authentication flow is robust.

## Connection Requirements

### 1. Xero Developer Portal Configuration
- **App Type**: Web App
- **Redirect URIs**:
  - Local: `http://localhost:3000/api/auth/xero/callback`
  - Production: `https://ato-git-main-unite-group.vercel.app/api/auth/xero/callback`
- **Scopes Required**:
  - `offline_access` (Required for refresh tokens)
  - `openid` (Required for identity)
  - `profile` (Required for user profile)
  - `email` (Required for user email)
  - `accounting.transactions.read`
  - `accounting.reports.read`
  - `accounting.contacts.read`
  - `accounting.settings.read` (Optional but recommended)

### 2. Environment Variables
- `XERO_CLIENT_ID`: The unique identifier for your Xero app.
- `XERO_CLIENT_SECRET`: The secret key generated in Xero.
- `NEXT_PUBLIC_BASE_URL`: Must match the environment (localhost or Vercel URL).

### 3. Database Sync
- Connections must be stored in the `xero_connections` table in Supabase.
- Table schema includes `tenant_id`, `access_token`, `refresh_token`, and `expires_at`.

## Standard Procedures

### Setup New App
1. Create app in Xero Dev Portal.
2. Configure Redirect URIs.
3. Generate Client Secret.
4. Update `.env.local` and Vercel Environment Variables.
5. Restart development server.
6. Initialize connection from `/dashboard`.

### Troubleshooting Connection
1. Verify Redirect URI exact match (case sensitive, trailing slashes).
2. Check `SESSION_SECRET` is set.
3. Verify `xero-node` SDK version compatibility.
4. Check Xero system status.
