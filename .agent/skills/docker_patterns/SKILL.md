---
id: docker-patterns
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Docker Patterns

> Multi-stage builds, layer caching, security hardening, and Docker Compose orchestration for NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `docker-patterns`                                        |
| **Category**   | Observability & DevOps                                   |
| **Complexity** | Medium                                                   |
| **Complements**| `health-check`, `graceful-shutdown`, `ci-cd-patterns`    |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies Docker patterns for NodeJS-Starter-V1: multi-stage builds for Python (FastAPI) and Next.js frontends, .dockerignore configuration, Docker Compose service orchestration with healthchecks and dependency ordering, container security hardening (non-root users, read-only filesystems), and layer caching strategies for fast CI builds.

---

## When to Apply

### Positive Triggers

- Writing or modifying a Dockerfile for backend or frontend services
- Configuring Docker Compose services, networks, or volumes
- Optimising Docker build times or image sizes
- Adding new services to the containerised stack
- Implementing container security hardening (non-root, capabilities)
- Debugging container health, networking, or volume mount issues

### Negative Triggers

- Running containers locally for development without modifying Docker config (just use `pnpm run docker:up`)
- Kubernetes-specific orchestration (out of scope; use `infrastructure-as-code`)
- CI/CD pipeline configuration (use `ci-cd-patterns` instead)
- Application-level health endpoints (use `health-check` skill instead)

---

## Core Principles

### The Three Laws of Docker

1. **Smallest Possible Image**: Every unnecessary byte is attack surface and transfer time. Use multi-stage builds, alpine bases, and aggressive .dockerignore.
2. **Layer Cache Is King**: Order instructions from least-changed to most-changed. Copy dependency manifests before source code.
3. **Non-Root by Default**: Never run containers as root in production. Create a dedicated user and drop all capabilities.

---

## Pattern 1: Python Backend Multi-Stage Build

**Project Reference**: `apps/backend/Dockerfile:1-30` — current single-stage build without multi-stage or non-root user.

### Multi-Stage with Security

```dockerfile
# ── Stage 1: Dependencies ──────────────────────────────────
FROM python:3.12-slim AS deps

WORKDIR /app
RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev

# ── Stage 2: Runtime ───────────────────────────────────────
FROM python:3.12-slim AS runtime

# Security: non-root user
RUN groupadd --gid 1001 appuser \
    && useradd --uid 1001 --gid appuser --shell /bin/false appuser

# Runtime-only system deps (curl for healthcheck)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy virtual environment from deps stage
COPY --from=deps /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy application source
COPY --chown=appuser:appuser src/ ./src/

# Drop to non-root
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Key Improvements**: Two-stage (deps → runtime), non-root `appuser` (UID 1001), `--no-install-recommends` for smaller image, direct `uvicorn` call (no uv wrapper in production).

---

## Pattern 2: Next.js Frontend Multi-Stage Build

### Standalone Output Mode

Next.js must be configured for standalone output before containerising:

```typescript
// next.config.ts — add output: 'standalone'
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // ... existing config
};
```

**Project Reference**: `apps/web/next.config.ts:3` — currently no `output` property set.

### Frontend Dockerfile

```dockerfile
# ── Stage 1: Dependencies ──────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter=web

# ── Stage 2: Build ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=web

# ── Stage 3: Runtime ───────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
```

**Key Points**:
- Three-stage: deps → build → runtime (runtime image ~150 MB vs ~1 GB without standalone)
- `corepack enable pnpm` for pnpm in Alpine
- `NEXT_TELEMETRY_DISABLED=1` prevents telemetry in build and runtime
- `wget` for healthcheck (pre-installed in Alpine, unlike `curl`)
- Standalone output copies only necessary server files

---

## Pattern 3: .dockerignore

### Backend .dockerignore

```dockerignore
# apps/backend/.dockerignore
__pycache__/
*.pyc
*.pyo
.mypy_cache/
.ruff_cache/
.pytest_cache/
htmlcov/
coverage.xml
.coverage
.venv/
*.egg-info/
dist/
build/
.git/
.github/
.env
.env.local
.env.production
tests/
docs/
*.md
!README.md
```

**Project Reference**: No `.dockerignore` currently exists in the project. Without it, the entire build context (including `.git/`, `node_modules/`, test files) is sent to the Docker daemon.

For monorepo root builds, also exclude `.git/`, `.github/`, `.beads/`, `.bin/`, `.claude/`, `.skills/`, `NodeJS-Starter-V1/`, `docs/`, `scripts/`, `*.md`, and all `node_modules/`/`.venv/` directories.

**Rule**: Always create a `.dockerignore` in the same directory as the Dockerfile. Without it, Docker sends the entire directory tree as build context.

---

## Pattern 4: Docker Compose Orchestration

### Service Dependencies and Health

**Project Reference**: `docker-compose.yml:1-68` — PostgreSQL (pgvector:pg15, port 5433) + Redis (7-alpine, port 6380) with healthchecks. Backend service commented out at line 36.

When enabling the backend service, add health-aware dependencies and shutdown integration:

```yaml
backend:
  build:
    context: .
    dockerfile: apps/backend/Dockerfile
  environment:
    DATABASE_URL: postgresql://starter_user:local_dev_password@postgres:5432/starter_db
    REDIS_URL: redis://redis:6379
    AI_PROVIDER: ${AI_PROVIDER:-ollama}
    OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
  ports:
    - "8000:8000"
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  stop_grace_period: 35s
```

### Key Rules

| Rule | Why |
|------|-----|
| Always use `condition: service_healthy` | Prevents app starting before database is ready |
| Use named volumes for data persistence | Anonymous volumes are lost on `docker compose down` |
| Map to non-standard host ports (5433, 6380) | Avoids conflicts with locally installed PostgreSQL/Redis |
| Use bridge network for inter-service communication | Services reference each other by name, not `localhost` |
| Set `stop_grace_period` > app shutdown timeout | Prevents SIGKILL during graceful shutdown drain |

### Development Overrides

Use a `docker-compose.override.yml` for development-specific settings:

```yaml
# docker-compose.override.yml (auto-merged by docker compose)
services:
  backend:
    volumes:
      - ./apps/backend/src:/app/src:ro
    command: uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      - PYTHONUNBUFFERED=1
```

**Rule**: Never bind-mount source code in production. Use `volumes` only in development for hot-reload. The override file is auto-detected by `docker compose` and does not need `-f` flags.

---

## Pattern 5: Security Hardening

### Non-Root Execution

```dockerfile
# Python (Debian-based)
RUN groupadd --gid 1001 appuser \
    && useradd --uid 1001 --gid appuser --shell /bin/false appuser
USER appuser

# Node.js (Alpine-based)
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
USER nextjs
```

### Read-Only Root Filesystem

```yaml
services:
  backend:
    read_only: true
    tmpfs:
      - /tmp
      - /app/.cache
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

**Rule**: Use `read_only: true` in production Compose files. Add `tmpfs` mounts for directories the application needs to write to (temp files, caches).

### Capability Dropping

```yaml
services:
  backend:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

### Image Pinning

**Rule**: In production, pin images to at least minor version (`python:3.12.8-slim`). Use digest pinning (`python:3.12-slim@sha256:abc...`) for maximum reproducibility. Never use `latest` or major-only tags.

---

## Pattern 6: Layer Caching

### Dependency-First Copy Pattern

The most impactful caching strategy: copy dependency manifests before source code.

```dockerfile
# ✅ Correct order: manifests → install → source
COPY pyproject.toml uv.lock* ./     # Layer 1: rarely changes
RUN uv sync --frozen --no-dev       # Layer 2: cached unless deps change
COPY src/ ./src/                    # Layer 3: changes frequently

# ❌ Wrong order: all files → install
COPY . .                           # Invalidates ALL subsequent layers on any change
RUN uv sync --frozen --no-dev      # Reinstalls every time
```

**Project Reference**: `apps/backend/Dockerfile:14-20` — already follows this pattern correctly.

### BuildKit Cache Mounts

For large dependency trees, use BuildKit cache mounts to persist the package manager cache across builds:

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim AS deps

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev
```

```dockerfile
# Node.js with pnpm store cache
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
```

**Rule**: Enable BuildKit with `DOCKER_BUILDKIT=1` or `docker buildx build`. Cache mounts are not included in the final image — they only speed up builds.

### CI Layer Caching

In GitHub Actions, use `docker/build-push-action@v6` with `cache-from: type=gha` and `cache-to: type=gha,mode=max` to persist Docker layer cache across workflow runs via GitHub Actions cache.

---

## Pattern 7: Container Healthchecks

### Dockerfile HEALTHCHECK

```dockerfile
# Python (curl available)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Node.js Alpine (wget pre-installed, curl is not)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
```

### Compose Healthcheck

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U starter_user -d starter_db"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s
```

### Timing Guidelines

| Parameter | Development | Production | Rationale |
|-----------|:-----------:|:----------:|-----------|
| `interval` | 10s | 30s | Faster feedback in dev; lower overhead in prod |
| `timeout` | 5s | 10s | More tolerance for loaded prod systems |
| `start_period` | 5s | 30s | Longer startup in prod (migrations, warmup) |
| `retries` | 3 | 5 | More retries before marking unhealthy in prod |

**Complements**: `health-check` skill — defines the application-level `/health` and `/ready` endpoints. This skill defines the container-level HEALTHCHECK that calls those endpoints.

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| `COPY . .` before `RUN install` | Invalidates cache on every source change | Copy manifests first, install, then copy source |
| Running as root in production | Container escape grants host root access | Create non-root user with `useradd`/`adduser` |
| No `.dockerignore` | Sends `.git/`, `node_modules/` to daemon | Create `.dockerignore` in every build context |
| `latest` tag in FROM | Non-reproducible builds, surprise breakage | Pin to version (`python:3.12-slim`) |
| `apt-get install` without cleanup | Layer retains package cache (~100+ MB) | Chain with `&& rm -rf /var/lib/apt/lists/*` |
| Bind-mounting source in production | Leaks source code, breaks immutability | Bind mounts for dev only; COPY in prod |
| `depends_on` without `condition` | App starts before database is ready | Use `condition: service_healthy` |
| Storing secrets in ENV in Dockerfile | Secrets baked into image layers | Use runtime environment variables or secrets |
| Single-stage build for production | Image includes build tools, dev deps | Multi-stage: build in stage 1, copy artefacts to stage 2 |

---

## Checklist

Before merging Docker changes:

- [ ] Dockerfile uses multi-stage build (deps → runtime)
- [ ] Non-root user created and set with `USER`
- [ ] `.dockerignore` exists and excludes `.git/`, tests, docs, env files
- [ ] Dependency manifests copied before source (layer cache order)
- [ ] `apt-get` cleanup in same layer (`&& rm -rf /var/lib/apt/lists/*`)
- [ ] HEALTHCHECK instruction defined with appropriate timing
- [ ] `depends_on` uses `condition: service_healthy`
- [ ] `stop_grace_period` exceeds application shutdown timeout
- [ ] No secrets in Dockerfile ENV instructions
- [ ] Image tags pinned to at least minor version

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Docker Implementation

**Service**: [backend / frontend / infrastructure]
**Build Strategy**: [single-stage / multi-stage]
**Base Image**: [image:tag]
**User**: [root / non-root (UID)]
**Healthcheck**: [endpoint / command]
**Compose Integration**: [depends_on / healthcheck / stop_grace_period]
```
