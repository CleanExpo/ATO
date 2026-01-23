# The Token in .env.local Doesn't Work for Production

## Why the OIDC Token Failed

The `VERCEL_OIDC_TOKEN` in your `.env.local` is:
- ❌ Scoped to "development" environment only
- ❌ Still requires your git email to have team access
- ❌ Cannot deploy to production

**Error**: `Git author phill.mcgurk@gmail.com must have access to the team Team AGI`

---

## Solution: Create a Deploy Hook (1 Minute)

A deploy hook is a URL you can visit to trigger deployments.

### Steps:

1. **Go to**: https://vercel.com/unite-group/ato/settings/git

2. **Scroll down** to "Deploy Hooks" section

3. **Click "Create Hook"**

4. **Fill in**:
   - Name: `Manual Deploy`
   - Git Branch: `main`

5. **Click "Create"**

6. **Copy the URL** it gives you (looks like):
   ```
   https://api.vercel.com/v1/integrations/deploy/...
   ```

7. **Paste that URL here** and I can trigger deployments for you!

---

## Or: Get a Real Vercel Token

If you want me to deploy automatically:

1. Go to: https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: "GitHub Actions Deploy"
4. Copy the token
5. Add to `.env.local`:
   ```
   VERCEL_TOKEN=your_token_here
   ```
6. I can then deploy using that token

---

## Quick Alternative: Manual Deploy (2 Minutes)

Since the token approach isn't working, the fastest way is still:

1. Open: https://vercel.com/unite-group/ato/deployments
2. Click "..." on any deployment → "Redeploy"
3. Wait 2 minutes
4. Done!

---

Which would you prefer?
- Create deploy hook URL (paste it here)
- Get Vercel token (add to .env.local)
- Manual redeploy in browser (follow steps above)
