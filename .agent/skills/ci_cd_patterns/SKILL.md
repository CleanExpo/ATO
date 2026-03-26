---
id: ci-cd-patterns
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# CI/CD Patterns

> GitHub Actions workflow optimisation, caching strategies, and pipeline architecture for NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `ci-cd-patterns`                                         |
| **Category**   | Observability & DevOps                                   |
| **Complexity** | Medium                                                   |
| **Complements**| `docker-patterns`, `health-check`, `structured-logging`  |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies CI/CD patterns for NodeJS-Starter-V1: GitHub Actions workflow architecture with job dependency graphs, multi-layer caching (pnpm, uv, Turborepo, Docker), service containers for integration tests, security scanning pipelines, artifact management, monorepo path filtering, and optional-secret design that works without any external tokens.

---

## When to Apply

### Positive Triggers

- Creating or modifying GitHub Actions workflow files
- Adding new CI jobs (test, lint, build, deploy, scan)
- Optimising workflow run times or reducing redundant steps
- Configuring caching for package managers or build outputs
- Setting up deployment pipelines for backend or frontend
- Adding security scanning or dependency review steps

### Negative Triggers

- Docker image building patterns (use `docker-patterns` instead)
- Application-level health endpoints (use `health-check` instead)
- Local development scripts that do not run in CI
- Infrastructure provisioning (use `infrastructure-as-code` when available)

---

## Core Principles

### The Three Laws of CI/CD

1. **Fast Feedback First**: Cheap checks (lint, type-check) run before expensive ones (E2E, deploy). Fail fast to save developer time.
2. **Cache Everything, Trust Nothing**: Cache dependency installs aggressively but always use `--frozen-lockfile` to ensure reproducibility.
3. **Zero Secrets Required**: The pipeline must pass with zero configured secrets. Optional features (Snyk, deployment) activate only when their secrets are present.

---

## Pattern 1: Workflow Architecture

### Job Dependency Graph

The project's CI pipeline follows a diamond dependency pattern:

```
dependency-verification
        │
   ┌────┴────┐
   ▼         ▼
backend   frontend     (parallel)
 tests     tests
   │         │
   └────┬────┘
        │
   ┌────┴────┐
   ▼         ▼
 build    e2e-tests    (parallel)
             │
             ▼
      accessibility
```

**Project Reference**: `ci.yml:14-297` — 6 jobs with `needs` dependencies.

### Job Dependency Rules

| Rule | Implementation | Rationale |
|------|---------------|-----------|
| Lint before test | `needs: [dependency-verification]` | No point testing code that does not compile |
| Tests before build | `needs: [backend-tests, frontend-tests]` | Build is expensive; only run if tests pass |
| Tests before E2E | `needs: [backend-tests, frontend-tests]` | E2E is slowest; gate on unit tests first |
| Security parallel to CI | Separate workflow file | Security scans should not block feature PRs |

### Workflow File Organisation

```
.github/workflows/
├── ci.yml                           # Core CI (tests, lint, build, E2E)
├── security.yml                     # Security scanning (Snyk, Trivy, npm audit)
├── agent-pr-checks.yml              # Agent-generated PR validation
└── examples/
    ├── deploy-backend.yml.example   # DigitalOcean deployment template
    └── deploy-frontend.yml.example  # Vercel deployment template
```

**Rule**: Separate concerns into distinct workflow files. CI, security, and deployment should not be in the same file. Use `.example` suffix for optional deployment workflows that require secrets.

---

## Pattern 2: Caching Strategies

### pnpm Cache (Frontend)

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: ${{ env.PNPM_VERSION }}

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: ${{ env.NODE_VERSION }}
    cache: pnpm                      # Built-in pnpm cache support
```

**Project Reference**: `ci.yml:23-31` — `setup-node` with `cache: pnpm` automatically caches the pnpm store.

### uv Cache (Backend)

```yaml
- name: Cache uv dependencies
  uses: actions/cache@v4
  with:
    path: |
      ~/.cache/uv
      apps/backend/.venv
    key: ${{ runner.os }}-uv-${{ hashFiles('apps/backend/pyproject.toml') }}
    restore-keys: |
      ${{ runner.os }}-uv-
```

**Project Reference**: `ci.yml:87-95` — caches both the uv download cache and the virtualenv.

### Turborepo Cache

Turborepo caches task outputs locally in `.turbo/`. For CI, enable remote caching:

```yaml
- name: Build all packages
  run: pnpm turbo run build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

**Project Reference**: `turbo.json:5-8` — build outputs include `.next/**` (excluding cache) and `dist/**`.

### Cache Key Design

| Cache | Key Pattern | Invalidation |
|-------|-------------|-------------|
| pnpm | `${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}` | Lockfile changes |
| uv | `${{ runner.os }}-uv-${{ hashFiles('apps/backend/pyproject.toml') }}` | pyproject.toml changes |
| Turbo | Hash of inputs per task | Source file changes |
| Playwright | `${{ runner.os }}-playwright-${{ hashFiles('**/pnpm-lock.yaml') }}` | Lockfile changes |

**Rule**: Always use `hashFiles()` of the lockfile or dependency manifest as the cache key suffix. Use `restore-keys` with progressively shorter prefixes for partial cache hits.

---

## Pattern 3: Service Containers

### PostgreSQL for Integration Tests

```yaml
services:
  postgres:
    image: postgres:15-alpine
    env:
      POSTGRES_DB: starter_db
      POSTGRES_USER: starter_user
      POSTGRES_PASSWORD: local_dev_password
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

**Project Reference**: `ci.yml:60-73` — PostgreSQL service container in `backend-tests` job.

### Service Container Rules

| Rule | Why |
|------|-----|
| Use `-alpine` images | Faster pull times in CI |
| Always set healthcheck options | Prevents test step starting before DB is ready |
| Match credentials to `.env.example` | Consistency between local and CI environments |
| Use `localhost` not service name | Service containers map ports to the runner host |

**Note**: Service containers use `localhost:PORT` (not Docker network names) because GitHub Actions maps container ports directly to the runner.

---

## Pattern 4: Security Scanning Pipeline

### Multi-Layer Security Architecture

```
┌─────────────────────────────────────────────┐
│ Layer 1: Dependency Review (PR only)        │
│   actions/dependency-review-action@v4       │
│   fail-on-severity: moderate                │
│   deny-licenses: GPL-3.0, LGPL-3.0         │
├─────────────────────────────────────────────┤
│ Layer 2: NPM Audit (no token required)      │
│   pnpm audit --audit-level=high             │
├─────────────────────────────────────────────┤
│ Layer 3: Trivy FS Scan (no token required)  │
│   aquasecurity/trivy-action — severity HIGH │
│   Uploads SARIF to GitHub Security tab      │
├─────────────────────────────────────────────┤
│ Layer 4: Snyk (optional, needs SNYK_TOKEN)  │
│   Frontend + Backend scans                  │
│   if: secrets.SNYK_TOKEN != ''              │
└─────────────────────────────────────────────┘
```

**Project Reference**: `security.yml:1-200` — all four layers implemented.

### Optional Secret Pattern

```yaml
snyk-frontend:
  name: Snyk Frontend Security Scan (Optional)
  runs-on: ubuntu-latest
  if: ${{ secrets.SNYK_TOKEN != '' }}
  steps:
    # ...
```

**Rule**: Use `if: ${{ secrets.SECRET_NAME != '' }}` to conditionally run jobs that need tokens. This ensures the workflow passes when no secrets are configured (zero-barrier principle).

---

## Pattern 5: Artifact Management

### Upload Pattern

```yaml
- name: Upload coverage report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: backend-coverage
    path: |
      apps/backend/coverage.xml
      apps/backend/htmlcov/
    retention-days: 30
```

**Project Reference**: `ci.yml:115-123` — coverage uploads in backend-tests job.

### Artifact Naming Conventions

| Artefact | Name Pattern | Retention |
|----------|-------------|-----------|
| Backend coverage | `backend-coverage` | 30 days |
| Frontend coverage | `frontend-coverage` | 30 days |
| Test results | `{scope}-test-results` | 30 days |
| Playwright report | `playwright-report` | 30 days |
| Security reports | `{scanner}-report` | 30 days |
| Dependency verification | `dependency-verification-report` | 30 days |

**Rule**: Always use `if: always()` on artifact upload steps. Test results and coverage reports are most valuable when tests fail, not when they pass.

---

## Pattern 6: Monorepo Path Filtering

### Deploy Only Changed Services

```yaml
on:
  push:
    branches: [main]
    paths:
      - "apps/backend/**"
```

**Project Reference**: `deploy-backend.yml.example:5-7` — only triggers on backend changes.

### Path Filter Patterns

| Service | Path Filter | Rationale |
|---------|-------------|-----------|
| Backend deploy | `apps/backend/**` | Only deploy backend when backend changes |
| Frontend deploy | `apps/web/**`, `packages/**` | Include shared packages |
| Full CI | No filter (all pushes) | Tests should run on every change |
| Security | No filter + weekly schedule | Security applies to everything |

**Rule**: Deployment workflows should use `paths` filters to avoid unnecessary deployments. CI and security workflows should run on all changes.

---

## Pattern 7: Agent PR Validation

### Agent-Specific Quality Gates

The project has a dedicated workflow for AI-generated PRs:

```yaml
on:
  pull_request:
    branches: [main, develop]

jobs:
  detect-agent-pr:
    steps:
      - name: Check if agent PR
        run: |
          if [[ "${{ github.head_ref }}" == feature/agent-* ]]; then
            echo "is_agent=true" >> $GITHUB_OUTPUT
          fi
```

**Project Reference**: `agent-pr-checks.yml:1-174` — validates agent metadata, runs quality checks, scans for secrets/debug code, posts PR status comment.

### Agent PR Checks

| Check | Purpose | Blocking |
|-------|---------|:--------:|
| Agent metadata (ID, Task, Verifier) | Audit trail for agent-generated code | Yes |
| Type check + Lint + Test + Build | Standard quality gates | Yes |
| Secret scan (hardcoded keys/passwords) | Prevent credential leaks | Yes |
| Debug code scan (console.log, print) | Clean production code | Warning |

---

## Pattern 8: Environment Variable Management

### Centralised Version Pinning

```yaml
env:
  NODE_VERSION: '20'
  PNPM_VERSION: 9
  PYTHON_VERSION: '3.12'
```

**Project Reference**: `ci.yml:9-13` — version matrix defined at workflow level.

**Rule**: Define tool versions once at the workflow `env` level, then reference with `${{ env.TOOL_VERSION }}` in all jobs. This ensures consistency and makes upgrades a single-line change.

### Secret Tiers

| Tier | Examples | Required | Used By |
|------|----------|:--------:|---------|
| **None** | — | Core CI, tests, lint | `ci.yml` |
| **Optional** | `SNYK_TOKEN`, `CODECOV_TOKEN` | Enhanced scanning | `security.yml` |
| **Deploy** | `VERCEL_TOKEN`, `DO_API_TOKEN` | Production deployment | `deploy-*.yml` |

**Project Reference**: `.github/SECRETS.md:1-60` — full secrets documentation with setup instructions.

---

## Pattern 9: Verification Scripts

### Reusable Shell Functions

```bash
# scripts/dependency-checks.sh — sourced by CI and verify.sh
source scripts/dependency-checks.sh
if ! check_lockfile_integrity; then
  echo "::error::Lockfile integrity check failed"
  exit 1
fi
```

**Project Reference**: `scripts/dependency-checks.sh:10-50` — lockfile integrity checks. `ci.yml:34-39` — used in dependency-verification job.

**Rule**: Extract verification logic into reusable shell scripts in `scripts/`. Source them in both CI workflows and local verification commands (`pnpm run verify`). This ensures local and CI validation are identical.

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| All jobs sequential | Pipeline takes 15+ min | Parallelise independent jobs |
| No `--frozen-lockfile` | CI installs different versions than local | Always use `--frozen-lockfile` / `--frozen` |
| Caching `node_modules/` directly | Fragile, breaks on OS/Node version changes | Cache pnpm store via `setup-node` |
| `continue-on-error: true` on tests | Failing tests are silently ignored | Use only on optional scans (Snyk) |
| Secrets required for CI to pass | Contributors without secrets cannot verify PRs | Use `if: secrets.X != ''` for optional jobs |
| Same workflow for CI and deploy | Deploy failures block CI feedback | Separate workflow files |
| No `if: always()` on artifact upload | Artefacts lost when tests fail | Always upload regardless of job status |
| Hardcoded tool versions in each job | Version drift between jobs | Centralise in workflow-level `env` |
| Running E2E before unit tests | Slow feedback for simple failures | Gate E2E on unit test success |

---

## Checklist

Before merging CI/CD changes:

- [ ] Jobs parallelised where independent (tests, scans)
- [ ] Expensive jobs gated behind cheap checks (`needs`)
- [ ] `--frozen-lockfile` used for all package installs
- [ ] Package manager caches configured (pnpm, uv)
- [ ] Service containers have healthcheck options
- [ ] Artefact uploads use `if: always()` and `retention-days`
- [ ] Optional features use `if: secrets.X != ''` guard
- [ ] Tool versions centralised in workflow `env` block
- [ ] Deployment workflows use `paths` filter
- [ ] Security scans run on schedule (weekly) in addition to push/PR

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### CI/CD Implementation

**Workflow**: [ci / security / deploy / custom]
**Trigger**: [push / pull_request / schedule / workflow_dispatch]
**Jobs**: [job dependency graph]
**Caching**: [pnpm / uv / Turbo / Docker layers]
**Secrets Required**: [none / optional / required]
**Path Filter**: [all / specific paths]
```
