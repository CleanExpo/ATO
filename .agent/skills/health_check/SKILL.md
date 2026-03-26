---
id: health-check
name: health-check
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
metadata:
  author: NodeJS-Starter-V1
  version: 1.0.0
  locale: en-AU
description: ">-"
context: fork
---


# Health Check - Liveness, Readiness & Dependency Probes

Codifies the project's three-tier health probe architecture (shallow liveness, readiness, deep dependency checks), Docker container healthchecks, cron-based periodic monitoring, route discovery verification, and the comprehensive system health script. Patterns align with Kubernetes probe conventions even when running outside K8s.

## Description

Codifies liveness, readiness, and deep dependency health endpoints for NodeJS-Starter-V1's Next.js and FastAPI services, covering three-tier probe architecture, Docker healthchecks, cron-based monitoring, route discovery verification, and the system health script.

---

## When to Apply

### Positive Triggers

- Adding new health check endpoints or probes
- Integrating new dependencies that need health verification
- Configuring Docker healthchecks for containers
- Setting up periodic health monitoring via cron
- Implementing startup, liveness, or readiness probes
- Adding service dependency checks to existing endpoints
- User mentions: "health check", "liveness", "readiness", "probe", "heartbeat", "service health", "dependency check"

### Negative Triggers

- Collecting application metrics (use `metrics-collector` instead)
- Adding structured log statements (use `structured-logging` instead)
- Designing dashboard UI for health status (use `dashboard-patterns` instead)
- Implementing graceful shutdown (use `graceful-shutdown` when available)

## Core Directives

### The Three Laws of Health Checks

1. **Three tiers, not one**: Separate liveness (am I alive?), readiness (can I serve traffic?), and deep (are all dependencies healthy?). Never combine them.
2. **Parallel dependency checks**: Check all dependencies concurrently via `Promise.all` or `asyncio.gather`. Never check sequentially — a slow database should not delay the Redis check.
3. **503 for unhealthy**: Return HTTP 200 for healthy/degraded, HTTP 503 for unhealthy. Load balancers and orchestrators use status codes, not response bodies.

---

## Existing Project Infrastructure

### Backend (FastAPI)

| Endpoint | Type | Location |
|----------|------|----------|
| `GET /health` | Liveness | `apps/backend/src/api/routes/health.py` |
| `GET /ready` | Readiness | `apps/backend/src/api/routes/health.py` |
| `GET /api/agents/{id}/health` | Agent health | `apps/backend/src/api/routes/agent_dashboard.py` |

### Frontend (Next.js)

| Endpoint | Type | Location |
|----------|------|----------|
| `GET /api/health` | Shallow liveness | `apps/web/app/api/health/route.ts` |
| `GET /api/health/deep` | Deep dependency | `apps/web/app/api/health/deep/route.ts` |
| `GET /api/health/routes` | Route discovery | `apps/web/app/api/health/routes/route.ts` |
| `GET /api/cron/health-check` | Periodic cron | `apps/web/app/api/cron/health-check/route.ts` |

### Docker

| Service | Command | Interval | Timeout | Retries |
|---------|---------|----------|---------|---------|
| PostgreSQL | `pg_isready -U starter_user -d starter_db` | 10s | 5s | 5 |
| Redis | `redis-cli ping` | 10s | 5s | 5 |

### System Script

`scripts/health-check.ps1` — 6-phase comprehensive health check (prerequisites, database, backend, frontend, integration, summary) with exit code 0 (healthy) or 1 (unhealthy).

---

## Health Status Model

All health endpoints use a three-state status:

| Status | HTTP Code | Meaning | Action |
|--------|-----------|---------|--------|
| `healthy` | 200 | All systems operational | None |
| `degraded` | 200 | Functional but impaired | Monitor, alert |
| `unhealthy` | 503 | Cannot serve requests | Remove from load balancer |

### Aggregation Rule

```
if any dependency is unhealthy → overall = unhealthy (503)
else if any dependency is degraded → overall = degraded (200)
else → overall = healthy (200)
```

---

## Probe Patterns

### Tier 1: Liveness (Shallow)

Returns immediately with minimal computation. Used by load balancers and orchestrators to confirm the process is alive.

**Backend** (`/health`):

```python
@router.get("/health")
async def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "0.1.0",
    }
```

**Frontend** (`/api/health`):

```typescript
interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
}
```

Rules: No database calls, no external service checks, no computation. Must respond in < 50ms.

### Tier 2: Readiness

Confirms the service can accept and process requests. Checks that critical dependencies are reachable.

**Backend** (`/ready`):

```python
@router.get("/ready")
async def readiness_check() -> dict[str, str]:
    # Check database connectivity
    # Check Redis connectivity
    # Check AI provider availability
    return {"status": "ready", "timestamp": datetime.now().isoformat()}
```

Rules: Check only fast, critical dependencies (database, cache). Timeout each check at 2–5 seconds. Do not check optional or slow services.

### Tier 3: Deep Dependency Check

Checks all dependencies in parallel with latency measurement. Used for debugging and monitoring dashboards, not for load balancer probes (too slow).

**Frontend** (`/api/health/deep`):

```typescript
interface DependencyCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unchecked";
  latency_ms: number | null;
  error: string | null;
  last_checked: string;
}
```

Each dependency checker follows this pattern:

1. Record start time
2. Attempt operation with timeout (`AbortSignal.timeout(5000)`)
3. Measure latency (`Date.now() - start`)
4. Classify: `healthy` (success), `degraded` (slow or partial), `unhealthy` (error/timeout)

Checks run in parallel via `Promise.all`:

```typescript
const [database, backend, verification] = await Promise.all([
  checkDatabase(),
  checkBackend(),
  checkVerificationSystem(),
]);
```

The summary aggregates results:

```typescript
const summary = {
  total_checks: checks.length,
  passed: checks.filter(c => c.status === "healthy").length,
  failed: checks.filter(c => c.status === "unhealthy").length,
  degraded: checks.filter(c => c.status === "degraded").length,
};
```

---

## Docker Healthcheck Pattern

Docker Compose healthchecks use `CMD-SHELL` with service-native commands:

```yaml
services:
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U starter_user -d starter_db"]
      interval: 10s
      timeout: 5s
      retries: 5
  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

For application containers, use `curl` or `wget` against the liveness endpoint:

```yaml
backend:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

`start_period` gives the application time to initialise before healthchecks begin. Use `depends_on` with `condition: service_healthy` to sequence container startup.

---

## Cron-Based Monitoring

The project's `/api/cron/health-check` runs every 5 minutes, pings the backend, and logs results. Secured with `CRON_SECRET` bearer token.

Pattern for adding new periodic checks:

```typescript
export async function GET(request: Request) {
  // 1. Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  // 2. Run checks with latency measurement
  const start = Date.now();
  const response = await fetch(`${backendUrl}/health`, {
    signal: AbortSignal.timeout(5000),
  });
  const latency = Date.now() - start;
  // 3. Log results
  logger.info("Health check cron", { backend: response.ok, latency });
  // 4. Alert if unhealthy
  if (!response.ok) { logger.error("Backend unhealthy"); }
  // 5. Return results
  return NextResponse.json({ status: response.ok ? "healthy" : "unhealthy" });
}
```

---

## Route Health Verification

The `/api/health/routes` endpoint discovers all API routes by scanning the filesystem and optionally verifies each GET endpoint:

1. **Discovery**: Recursively scan `app/api/` for `route.ts` files
2. **Method detection**: Parse file content for exported HTTP methods (GET, POST, PUT, PATCH, DELETE)
3. **Verification** (optional `?verify=true`): Send GET request to each endpoint with 5-second timeout
4. **Status**: `verified` (200 OK), `error` (non-200 or timeout), `unverified` (not tested)

---

## Adding a New Dependency Check

When integrating a new service, add a checker following this template:

```typescript
async function checkNewService(): Promise<DependencyCheck> {
  const start = Date.now();
  const result: DependencyCheck = {
    name: "service_name",
    status: "unchecked",
    latency_ms: null,
    error: null,
    last_checked: new Date().toISOString(),
  };
  try {
    // Service-specific check (e.g., ping, SELECT 1, PING)
    const response = await fetch(serviceUrl, {
      signal: AbortSignal.timeout(5000),
    });
    result.latency_ms = Date.now() - start;
    result.status = response.ok ? "healthy" : "degraded";
    if (!response.ok) result.error = `HTTP ${response.status}`;
  } catch (e) {
    result.latency_ms = Date.now() - start;
    result.status = "unhealthy";
    result.error = e instanceof Error ? e.message : "Unknown error";
  }
  return result;
}
```

Then add it to the `Promise.all` array in the deep health endpoint.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Database query in liveness probe | Probe fails when DB is slow, kills healthy process | Liveness = process alive only; DB check in readiness |
| Sequential dependency checks | Total latency = sum of all checks | `Promise.all` / `asyncio.gather` for parallel |
| 200 OK when unhealthy | Load balancer keeps routing traffic to broken instance | 503 for unhealthy, 200 for healthy/degraded |
| No timeout on dependency checks | Single hung dependency blocks entire health response | `AbortSignal.timeout(5000)` on every check |
| Exposing sensitive details in health response | Internal errors, stack traces leaked to public | Return status + latency only; log details server-side |
| No `start_period` in Docker healthcheck | Container marked unhealthy during boot | Set `start_period` to cover startup time |
| Hardcoded service URLs in health checks | Breaks across environments | Use environment variables (`BACKEND_URL`, etc.) |

---

## Checklist for New Health Endpoints

### Structure

- [ ] Three-tier separation (liveness, readiness, deep)
- [ ] `healthy` / `degraded` / `unhealthy` status values
- [ ] HTTP 200 for healthy/degraded, 503 for unhealthy
- [ ] Response includes `timestamp` and `version`

### Dependencies

- [ ] Parallel checking via `Promise.all` or `asyncio.gather`
- [ ] 5-second timeout per dependency check
- [ ] Latency measurement per dependency
- [ ] Graceful handling of missing environment variables

### Docker

- [ ] Container healthcheck using service-native command
- [ ] `interval`, `timeout`, `retries` configured
- [ ] `start_period` covers application boot time
- [ ] `condition: service_healthy` for dependent services

### Monitoring

- [ ] Cron-based periodic checks for production
- [ ] CRON_SECRET authentication on cron endpoints
- [ ] Health check latency instrumented via `metrics-collector`
- [ ] Failures logged via `structured-logging`

---

## Response Format

```
[AGENT_ACTIVATED]: Health Check
[PHASE]: {Design | Implementation | Review}
[STATUS]: {in_progress | complete}

{health check analysis or implementation guidance}

[NEXT_ACTION]: {what to do next}
```

## Integration Points

### Metrics Collector

- `health_check_duration_ms` histogram per dependency
- `health_check_status` gauge (1=healthy, 0.5=degraded, 0=unhealthy)

### Structured Logging

- Info-level health check results (dependency, status, latency)
- Error-level alerts when dependencies become unhealthy

### Error Taxonomy

- `SYS_HEALTH_DEPENDENCY_UNAVAILABLE` (503) — critical dependency unreachable
- `SYS_HEALTH_TIMEOUT` (504) — dependency check exceeded timeout

### Cron Scheduler

- `/api/cron/health-check` runs every 5 minutes with CRON_SECRET auth
- Results can trigger alerting via notification system

### Dashboard Patterns

- `StatusPulse` component for live dependency status indicators
- `DataStrip` for health check latency metrics
- Connection status mapped to spectral colours (emerald=healthy, amber=degraded, red=unhealthy)

## Australian Localisation (en-AU)

- **Spelling**: initialise, serialise, analyse, optimise, colour, behaviour
- **Date**: ISO 8601 in responses; DD/MM/YYYY in dashboard display
- **Timezone**: AEST/AEDT — timestamps stored as UTC
