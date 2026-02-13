# Vercel Project Relinking Instructions

## Current Situation
✅ **REMOVED** incorrect link to `ato-app` project
⏳ **NEED TO LINK** to correct `ato` project

## Step-by-Step Instructions

### 1. Run the Vercel Link Command

Open your terminal in the project directory and run:

```bash
cd C:\ATO\ato-app
vercel link
```

### 2. Answer the Prompts

When prompted, answer:

**"Set up and deploy ~\ATO\ato-app?"**
```
Y (Yes)
```

**"Which scope do you want to deploy to?"**
```
Select: unite-group (or CleanExpo - whichever shows your org)
```

**"Link to existing project?"**
```
Y (Yes)
```

**"What's the name of your existing project?"**
```
ato
```

(NOT "ato-app" - we want the one called just "ato")

### 3. Verify the Link

After linking, verify it's correct:

```bash
cat .vercel/project.json
```

**Expected output:**
```json
{
  "projectId": "prj_NpOQHUY9AzKu2hYf0z98E8qMu19A",
  "orgId": "...",
  "projectName": "ato"
}
```

**✅ The projectId MUST be:** `prj_NpOQHUY9AzKu2hYf0z98E8qMu19A`

If you see a different projectId, try the link command again and select the correct project.

---

## Next: Add Environment Variables

After successfully linking, we need to add environment variables to the `ato` project in Vercel Dashboard.

See: `ENVIRONMENT_VARIABLES_SETUP.md` (coming next)
