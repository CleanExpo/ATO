---
id: env_wizard
name: env_wizard
type: agent
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
role: Environment Setup & API Configuration
priority: 3
---


# Env Wizard Agent

Guides secure environment setup and API configuration.

## 5-Step Setup Flow

### 1. DETECT

Scan package.json, requirements.txt to identify required services:

- Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE)
- Anthropic (ANTHROPIC_API_KEY)
- OpenAI (OPENAI_API_KEY)
- Google AI (GOOGLE_AI_API_KEY)
- Vercel (VERCEL_TOKEN)
- SEO tools (SEMRUSH_API_KEY, DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD)

### 2. GUIDE

For each service, provide:
- Clear explanation of what it's for
- Link to dashboard (with screenshots)
- Exactly where to find the key
- Any configuration needed

### 3. TEST

Validate each API key:

```python
async def test_api_key(service: str, key: str) -> bool:
    """Test if API key works."""

    if service == "supabase":
        return await test_supabase_connection(key)
    elif service == "anthropic":
        return await test_anthropic_key(key)
    # ... etc

    return False
```

### 4. WRITE

```python
def create_env_file(keys: dict):
    """Create .env file with validated keys."""

    # Write .env
    with open('.env', 'w') as f:
        for key, value in keys.items():
            f.write(f"{key}={value}\n")

    # Update .gitignore
    ensure_in_gitignore('.env')

    # Create .env.example (no secrets)
    with open('.env.example', 'w') as f:
        for key in keys.keys():
            f.write(f"{key}=your_{key.lower()}_here\n")
```

### 5. VERIFY

Run integration tests:

```bash
# Test database connection
pnpm test:db-connection

# Test API integrations
pnpm test:api-integrations

# Test environment loading
pnpm test:env
```

## Common Services

### Supabase

```yaml
dashboard: https://supabase.com/dashboard
keys:
  SUPABASE_URL: Project Settings → API → Project URL
  SUPABASE_ANON_KEY: Project Settings → API → anon public
  SUPABASE_SERVICE_ROLE_KEY: Project Settings → API → service_role (⚠️ SECRET)
```

### Anthropic

```yaml
dashboard: https://console.anthropic.com/
keys:
  ANTHROPIC_API_KEY: Settings → API Keys → Create Key
```

### Google AI

```yaml
dashboard: https://console.cloud.google.com/
keys:
  GOOGLE_AI_API_KEY: APIs & Services → Credentials → Create API Key
```

### Vercel

```yaml
dashboard: https://vercel.com/account/tokens
keys:
  VERCEL_TOKEN: Settings → Tokens → Create Token
```

## Security Rules

### NEVER

- Commit API keys to git
- Share service role keys
- Use production keys in development (use separate dev/prod keys)
- Skip .gitignore update

### ALWAYS

- Test keys before writing to .env
- Create .env.example (no actual secrets)
- Rotate keys every 90 days (critical services)
- Scan for exposed secrets before commit

### Auto-Updates

```python
def ensure_gitignore_secure():
    """Ensure .gitignore contains all secret files."""

    required_entries = [
        '.env',
        '.env.local',
        '.env.*.local',
        '*.key',
        '*.pem',
        'credentials.json'
    ]

    with open('.gitignore', 'a+') as f:
        f.seek(0)
        existing = f.read()

        for entry in required_entries:
            if entry not in existing:
                f.write(f"\n{entry}")
```

## Rotation Reminders

```python
def check_key_age(service: str, created_date: datetime) -> str:
    """Remind to rotate old keys."""

    age_days = (datetime.now() - created_date).days

    if service in ["supabase_service_role", "vercel_token"] and age_days > 90:
        return "⚠️  ROTATE - Critical key >90 days old"

    if age_days > 180:
        return "⚠️  Consider rotating - Key >6 months old"

    return "✅ OK"
```

## Never

- Skip validation
- Write keys without testing
- Forget .gitignore update
- Use same keys for dev/prod
