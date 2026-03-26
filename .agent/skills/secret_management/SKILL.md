---
id: secret-management
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Secret Management

> Environment variable patterns, secret validation, rotation, and leak prevention for NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `secret-management`                                      |
| **Category**   | Authentication & Security                                |
| **Complexity** | Low                                                      |
| **Complements**| `ci-cd-patterns`, `docker-patterns`, `health-check`      |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies secret management patterns for NodeJS-Starter-V1: typed environment variable loading with validation, secret strength checks at startup, rotation procedures, leak prevention in logs and error messages, CI/CD secret injection, Docker secret patterns, and `.env` file hygiene.

---

## When to Apply

### Positive Triggers

- Adding new API keys or secrets to the project
- Validating environment variables at application startup
- Implementing secret rotation procedures
- Preventing secret leakage in logs, errors, or API responses
- Configuring CI/CD secrets for GitHub Actions
- Reviewing `.env` file security and `.gitignore` coverage

### Negative Triggers

- JWT token creation and validation (use `auth/jwt.py` directly)
- OAuth flow implementation (future `oauth-flow` skill)
- RBAC and permission management (future `rbac-patterns` skill)
- Encrypting data at rest (out of scope — use database-level encryption)

---

## Core Principles

### The Three Laws of Secrets

1. **Validate at Startup, Fail Fast**: Check all required secrets exist and meet minimum strength before the application starts. A missing secret at runtime is a production incident.
2. **Never Log, Never Return**: Secrets must never appear in logs, error messages, API responses, or stack traces. Redact automatically — don't rely on developers remembering.
3. **Rotate Without Downtime**: Design secret usage so rotation requires only an environment variable change and restart — no code changes, no migrations.

---

## Pattern 1: Typed Environment Variables (Python)

### Pydantic Settings with Validation

```python
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class AppSettings(BaseSettings):
    """Validated application settings from environment variables."""

    # Required secrets
    jwt_secret_key: str = Field(min_length=32)
    database_url: str = Field(pattern=r"^postgresql://")
    backend_api_key: str = Field(min_length=16)

    # Optional secrets (with safe defaults)
    anthropic_api_key: str | None = None
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    jina_api_key: str | None = None
    exa_api_key: str | None = None
    linear_api_key: str | None = None

    # Non-secret config
    ai_provider: str = "ollama"
    log_level: str = "info"
    node_env: str = "development"

    @field_validator("jwt_secret_key")
    @classmethod
    def jwt_secret_not_default(cls, v: str) -> str:
        if "change-in-production" in v and cls._is_production():
            raise ValueError("JWT secret must be changed in production")
        return v

    @staticmethod
    def _is_production() -> bool:
        import os
        return os.getenv("NODE_ENV") == "production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
```

**Project Reference**: `apps/backend/src/config/` — the existing settings module loads env vars but lacks minimum-length validation and production-specific checks. The default JWT secret in `.env.example:20` contains "change-in-production" which should be caught.

---

## Pattern 2: Typed Environment Variables (TypeScript)

### Zod Schema for Next.js

```typescript
import { z } from "zod";

const envSchema = z.object({
  // Required
  NEXT_PUBLIC_BACKEND_URL: z.string().url().default("http://localhost:8000"),
  NEXT_PUBLIC_FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // Optional secrets (server-side only)
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  CRON_SECRET: z.string().min(16).optional(),

  // Runtime config
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Environment validation failed:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment configuration");
    }
  }
  return result.success ? result.data : (process.env as unknown as Env);
}

export const env = validateEnv();
```

**Rule**: In production, throw on invalid env. In development, warn but continue — this prevents blocking local development when optional secrets are missing.

---

## Pattern 3: Secret Redaction

### Log Sanitiser

```python
import re

SECRET_PATTERNS = [
    re.compile(r"(sk[-_](?:test|live|ant)[-_])\w+", re.IGNORECASE),
    re.compile(r"(whsec_)\w+"),
    re.compile(r"(Bearer\s+)\S+"),
    re.compile(r"(password[\"':\s=]+)\S+", re.IGNORECASE),
    re.compile(r"(api[_-]?key[\"':\s=]+)\S+", re.IGNORECASE),
]


def redact_secrets(message: str) -> str:
    """Replace secret values with redacted placeholders."""
    for pattern in SECRET_PATTERNS:
        message = pattern.sub(r"\1[REDACTED]", message)
    return message
```

Integrate with the `structured-logging` skill by adding `redact_secrets` as a structlog processor:

```python
structlog.configure(
    processors=[
        # ... existing processors
        lambda _, __, event_dict: {
            k: redact_secrets(str(v)) if isinstance(v, str) else v
            for k, v in event_dict.items()
        },
        structlog.dev.ConsoleRenderer(),
    ]
)
```

**Project Reference**: `apps/backend/src/utils/logging.py:1-39` — the existing structlog config has no secret redaction. Add the redaction processor before the renderer.

---

## Pattern 4: Startup Health Check

### Secret Presence and Strength Validation

```python
def check_secrets_health() -> dict:
    """Validate secret presence and strength at startup."""
    settings = get_settings()
    issues: list[str] = []

    # Required secrets
    required = {
        "JWT_SECRET_KEY": settings.jwt_secret_key,
        "DATABASE_URL": settings.database_url,
        "BACKEND_API_KEY": settings.backend_api_key,
    }
    for name, value in required.items():
        if not value or len(value) < 16:
            issues.append(f"{name}: missing or too short (min 16 chars)")

    # Production-only checks
    if settings.node_env == "production":
        if "localhost" in settings.database_url:
            issues.append("DATABASE_URL: points to localhost in production")
        if settings.jwt_secret_key and len(settings.jwt_secret_key) < 64:
            issues.append("JWT_SECRET_KEY: should be ≥64 chars in production")

    return {
        "status": "healthy" if not issues else "unhealthy",
        "issues": issues,
        "secrets_configured": len(required) - len(issues),
        "secrets_total": len(required),
    }
```

**Complements**: `health-check` skill — add `check_secrets_health()` as a dependency check in the deep health endpoint. Return `"degraded"` if optional secrets are missing, `"unhealthy"` if required ones fail.

---

## Pattern 5: CI/CD Secret Injection

### GitHub Actions Secrets

```yaml
# .github/workflows/ci.yml
env:
  # Map GitHub Secrets to environment variables
  DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/test_db
  JWT_SECRET_KEY: ${{ secrets.JWT_SECRET_KEY || 'test-secret-for-ci-only-not-production' }}
  BACKEND_API_KEY: ${{ secrets.BACKEND_API_KEY || 'ci-test-key-minimum-16' }}
```

**Rules for CI secrets**:

| Rule | Rationale |
|------|-----------|
| Always provide fallback for optional secrets | CI must pass without external service keys |
| Never use production secrets in CI | Test isolation |
| Use `secrets.GITHUB_TOKEN` for GitHub API calls | Auto-provided, no setup needed |
| Store deployment secrets in environment-specific secrets | Prevents cross-environment leakage |

**Project Reference**: `.github/workflows/ci.yml` — already follows the no-secrets-required pattern. Add `JWT_SECRET_KEY` fallback for test runs.

---

## Pattern 6: Docker Secret Patterns

### Environment Variable Injection

```yaml
# docker-compose.yml
services:
  backend:
    env_file:
      - .env
    environment:
      # Override specific vars (higher precedence than .env)
      - DATABASE_URL=postgresql://starter_user:local_dev_password@postgres:5432/starter_db
```

**Rules**:

| Rule | Implementation |
|------|----------------|
| Never bake secrets into Docker images | Use `env_file` or `environment`, never `ENV` in Dockerfile |
| Use Docker secrets for Swarm/K8s | `docker secret create` + `/run/secrets/` mount |
| `.env` files never in Docker image | Add `.env` to `.dockerignore` |

**Project Reference**: `apps/backend/Dockerfile` — verify `.dockerignore` excludes `.env*` files. `docker-compose.yml` — already uses `env_file: .env` pattern correctly.

---

## Pattern 7: .env File Hygiene

### Audit Checklist

| Check | Status | File |
|-------|--------|------|
| `.env` in `.gitignore` | Required | `.gitignore:26` |
| `.env.example` has no real values | Required | `.env.example` |
| `.env.local` in `.gitignore` | Required | `.gitignore:28` |
| All secrets have `xxx` or `your-*` placeholders | Required | `.env.example` |
| Production env uses unique secrets | Required | Deployment config |

**Project Reference**: `.gitignore:25-29` — correctly ignores `.env`, `.env.local`, `.env.*.local` and preserves `.env.example`. The `.env.example` uses `your-*` and `xxx` placeholders correctly.

### Secret Inventory

| Secret | Source | Required? | Rotation Frequency |
|--------|--------|:---------:|-------------------|
| `JWT_SECRET_KEY` | Self-generated | Yes | Annually |
| `DATABASE_URL` | PostgreSQL | Yes | On compromise |
| `BACKEND_API_KEY` | Self-generated | Yes | Quarterly |
| `ANTHROPIC_API_KEY` | Anthropic dashboard | No | On compromise |
| `STRIPE_SECRET_KEY` | Stripe dashboard | No | On compromise |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard | No | On re-register |
| `JINA_API_KEY` | Jina dashboard | No | On compromise |
| `LINEAR_API_KEY` | Linear settings | No | On compromise |
| `EXA_API_KEY` | Exa dashboard | No | On compromise |

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| Hardcoded secrets in source code | Leaked on push | Environment variables only |
| Default secrets in production | Predictable, exploitable | Validate at startup, reject defaults |
| Secrets in log output | Exposed in log aggregators | Automatic redaction processor |
| Same secret across environments | One compromise exposes all | Per-environment unique secrets |
| No `.env` in `.gitignore` | Secrets committed to git | Always gitignore `.env*` (except `.example`) |
| Secrets in URL query parameters | Visible in logs, referrers | Use headers or request body |

---

## Checklist

Before merging secret-management changes:

- [ ] Pydantic `AppSettings` validates all required secrets at startup
- [ ] Zod `envSchema` validates frontend environment variables
- [ ] Secret redaction processor added to structlog pipeline
- [ ] Startup health check reports secret presence and strength
- [ ] CI/CD provides fallback values for optional secrets
- [ ] `.dockerignore` excludes `.env*` files
- [ ] `.env.example` uses placeholder values only
- [ ] Production deployment uses unique, strong secrets

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Secret Management Implementation

**Validation**: [Pydantic / Zod / both]
**Redaction**: [structlog processor / manual]
**Health Check**: [startup / deep endpoint / both]
**CI/CD**: [GitHub Actions secrets / env fallbacks]
**Docker**: [env_file / Docker secrets / both]
**Rotation**: [documented / automated]
```
