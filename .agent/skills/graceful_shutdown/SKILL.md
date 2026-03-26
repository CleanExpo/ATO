---
id: graceful-shutdown
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Graceful Shutdown

> Process signal handling, connection draining, and clean resource teardown for NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `graceful-shutdown`                                      |
| **Category**   | Error Handling & Resilience                              |
| **Complexity** | Medium                                                   |
| **Complements**| `health-check`, `structured-logging`, `metrics-collector`|
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies the shutdown lifecycle for both the FastAPI backend and Next.js frontend in NodeJS-Starter-V1. Covers OS signal handling (SIGTERM, SIGINT), connection pool draining, active request completion, WebSocket teardown, scheduled timer cancellation, subagent cleanup, and Docker container stop_grace_period integration.

---

## When to Apply

### Positive Triggers

- Implementing or modifying the FastAPI `lifespan` context manager
- Adding new persistent resources (database pools, WebSocket connections, MCP clients)
- Writing background workers, scheduled tasks, or long-running agent operations
- Configuring Docker Compose `stop_grace_period` or Kubernetes `terminationGracePeriodSeconds`
- Integrating health-check readiness probes with shutdown awareness
- Handling `SIGTERM` or `SIGINT` in Python or Node.js processes

### Negative Triggers

- Pure stateless API endpoints with no persistent connections
- Static asset serving or build-time generation
- Client-side React components (use `useEffect` cleanup instead — not this skill)
- One-shot CLI scripts that exit after completion

---

## Core Principles

### The Three Laws of Graceful Shutdown

1. **Signal → Stop Accepting → Drain → Teardown**: Always follow this four-phase sequence. Never skip phases.
2. **Bounded Grace Period**: Every shutdown has a hard deadline. If draining exceeds the timeout, force-terminate.
3. **Health Probe Awareness**: Mark readiness as `false` immediately on signal receipt, before draining begins.

---

## Phase 1: Signal Handling

### Python (FastAPI / Uvicorn)

Uvicorn handles `SIGTERM` and `SIGINT` natively. The FastAPI `lifespan` context manager is the primary integration point:

```python
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from src.utils import get_logger

logger = get_logger(__name__)

# Shared shutdown event for coordinating background tasks
shutdown_event = asyncio.Event()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — startup and shutdown hooks."""
    logger.info("Starting application")
    # Startup: initialise resources
    yield
    # Shutdown: teardown resources (runs on SIGTERM/SIGINT)
    logger.info("Shutdown signal received — beginning graceful shutdown")
    shutdown_event.set()
    await drain_and_teardown()
    logger.info("Graceful shutdown complete")
```

**Project Reference**: `apps/backend/src/api/main.py:20-26` — current lifespan (startup logging only, shutdown is a log-only stub).

### TypeScript (Next.js / Node.js)

For standalone Node.js processes or custom Next.js servers:

```typescript
const shutdownController = new AbortController();

function registerShutdownHandlers(cleanup: () => Promise<void>): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  let shuttingDown = false;

  for (const signal of signals) {
    process.on(signal, async () => {
      if (shuttingDown) return; // Prevent double-shutdown
      shuttingDown = true;
      console.log(`Received ${signal} — beginning graceful shutdown`);
      shutdownController.abort();

      const timeout = setTimeout(() => {
        console.error('Shutdown timed out — forcing exit');
        process.exit(1);
      }, 30_000); // 30s hard deadline

      try {
        await cleanup();
      } finally {
        clearTimeout(timeout);
        process.exit(0);
      }
    });
  }
}
```

---

## Phase 2: Stop Accepting New Work

### Backend — Reject New Requests

Once a shutdown signal is received, the backend must stop accepting new requests while allowing in-flight requests to complete:

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

class ShutdownAwareMiddleware(BaseHTTPMiddleware):
    """Returns 503 for new requests during shutdown."""

    async def dispatch(self, request: Request, call_next):
        if shutdown_event.is_set():
            # Allow health probes through for orchestrator awareness
            if request.url.path in ("/health", "/ready"):
                return await call_next(request)
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Service is shutting down",
                    "retry_after": 5,
                },
                headers={"Retry-After": "5"},
            )
        return await call_next(request)
```

### Frontend — Stop Scheduled Timers

Cancel all `setInterval` and `setTimeout` handles:

```typescript
// Pattern from ScheduledAuditRunner
stopAll(): void {
  for (const scheduleId of this.timers.keys()) {
    this.stopSchedule(scheduleId);
  }
}
```

**Project Reference**: `apps/web/lib/audit/scheduled-audit-runner.ts:526-530` — `stopAll()` clears all interval timers.

---

## Phase 3: Drain Active Connections

### Database Connection Pool

Dispose the SQLAlchemy async engine to drain active connections:

```python
from src.config.database import async_engine, sync_engine

async def drain_database() -> None:
    """Dispose database connection pools."""
    logger.info("Draining database connections")
    await async_engine.dispose()
    sync_engine.dispose()
    logger.info("Database connections drained")
```

**Project Reference**: `apps/backend/src/config/database.py:60-66` — async_engine with `pool_size=5`, `max_overflow=10`. The `dispose()` method waits for checked-out connections to return before closing the pool.

### Subagent Manager

Cancel running subagents and clean up tracking state:

```python
async def drain_subagents(manager: SubagentManager) -> None:
    """Cancel active subagents and clean up."""
    active_count = await manager.get_active_count()
    if active_count > 0:
        logger.info("Cancelling active subagents", count=active_count)
        for subtask_id, tracking in manager._active_subagents.items():
            if tracking["status"] == SubagentStatus.RUNNING:
                await manager.cancel_subagent(subtask_id)
    await manager.cleanup()
    logger.info("Subagent cleanup complete")
```

**Project Reference**: `apps/backend/src/agents/subagent_manager.py:485-507` — `cancel_subagent()` marks agents as CANCELLED; `cleanup()` at line 520 removes completed/failed/cancelled entries.

### MCP Client Connections

Disconnect from all MCP servers:

```python
async def drain_mcp_connections(client: MCPClient) -> None:
    """Disconnect from all MCP servers."""
    status = await client.get_connection_status()
    connected = sum(1 for v in status.values() if v)
    if connected > 0:
        logger.info("Disconnecting MCP servers", count=connected)
        await client.cleanup()
```

**Project Reference**: `apps/backend/src/tools/mcp_client.py:295-302` — `cleanup()` iterates all connections and calls `disconnect_from_server()`.

### WebSocket / Yjs Provider

Tear down real-time collaboration connections:

```typescript
function destroyCollaboration(provider: YjsProvider): void {
  provider.destroy();
  // destroy() does:
  //   awareness.off('change', updateCollaborators)
  //   wsProvider.disconnect()
  //   ydoc.destroy()
}
```

**Project Reference**: `apps/web/lib/collaboration/yjs-provider.ts:241-245` — `destroy()` removes listeners, disconnects WebSocket, and destroys the Yjs document.

---

## Phase 4: Teardown Orchestration

### Combined Shutdown Function

Orchestrate all drain operations with a bounded timeout:

```python
import asyncio

SHUTDOWN_TIMEOUT_SECONDS = 30

async def drain_and_teardown() -> None:
    """Orchestrate all shutdown operations with timeout."""
    try:
        await asyncio.wait_for(
            _drain_all(),
            timeout=SHUTDOWN_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        logger.error(
            "Shutdown timed out — some resources may not have been released",
            timeout=SHUTDOWN_TIMEOUT_SECONDS,
        )

async def _drain_all() -> None:
    """Drain all resources in dependency order."""
    # Phase 1: Stop accepting (handled by middleware)

    # Phase 2: Drain active work (parallel — independent resources)
    await asyncio.gather(
        drain_subagents(subagent_manager),
        drain_mcp_connections(mcp_client),
        return_exceptions=True,
    )

    # Phase 3: Drain connection pools (after active work completes)
    await drain_database()

    logger.info("All resources released")
```

### Dependency Order

Resources must be drained in reverse-initialisation order:

```
Signal Received
  ├─ Set shutdown_event (stops new requests)
  ├─ Mark readiness probe as NOT READY
  ├─ Wait for in-flight requests (bounded)
  ├─ Cancel subagents (parallel)
  ├─ Disconnect MCP clients (parallel)
  ├─ Disconnect WebSocket providers
  ├─ Dispose database pools
  └─ Exit process
```

**Rule**: Resources that depend on the database (subagents, MCP tools) must drain **before** the database pool is disposed.

---

## Docker Integration

### stop_grace_period

Configure Docker Compose to allow sufficient time for draining:

```yaml
services:
  backend:
    # ...
    stop_grace_period: 35s  # > SHUTDOWN_TIMEOUT_SECONDS (30s)
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/ready || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
```

**Rule**: `stop_grace_period` must be **greater than** the application's internal shutdown timeout. Docker sends `SIGTERM`, waits for `stop_grace_period`, then sends `SIGKILL`.

### Kubernetes

```yaml
spec:
  terminationGracePeriodSeconds: 35
  containers:
    - name: backend
      lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 5"]
      # preStop delay allows load balancer to deregister
      # before the app begins draining
```

**Project Reference**: `docker-compose.yml:15-19` — PostgreSQL healthcheck uses `pg_isready`. The backend service (commented out) should add `stop_grace_period` when uncommented.

---

## Health Probe Integration

### Readiness Probe During Shutdown

The readiness endpoint must return `503` immediately after shutdown signal, even while draining:

```python
@router.get("/ready")
async def readiness_check() -> JSONResponse:
    """Readiness probe — returns 503 during shutdown."""
    if shutdown_event.is_set():
        return JSONResponse(
            status_code=503,
            content={
                "status": "shutting_down",
                "timestamp": datetime.now().isoformat(),
            },
        )
    return JSONResponse(
        content={
            "status": "ready",
            "timestamp": datetime.now().isoformat(),
        },
    )
```

### Liveness Probe During Shutdown

The liveness probe should continue returning `200` during shutdown to prevent the orchestrator from killing the process prematurely:

```python
@router.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness probe — always returns 200 (even during shutdown)."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "0.1.0",
    }
```

**Project Reference**: `apps/backend/src/api/routes/health.py:1-28` — current `/health` and `/ready` endpoints are not shutdown-aware.

---

## Frontend Cleanup Patterns

### React useEffect Cleanup

For components with subscriptions, timers, or WebSocket connections:

```typescript
useEffect(() => {
  const provider = createYjsProvider(config);

  return () => {
    // Cleanup runs on unmount or dependency change
    provider.destroy();
  };
}, [config.workflowId]);
```

### AbortController for Fetch Requests

Cancel in-flight fetch requests on component unmount or shutdown:

```typescript
useEffect(() => {
  const controller = new AbortController();

  async function fetchData() {
    try {
      const response = await fetch('/api/data', {
        signal: controller.signal,
      });
      // handle response
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return; // Expected during cleanup
      }
      throw error;
    }
  }

  fetchData();
  return () => controller.abort();
}, []);
```

---

## Logging During Shutdown

All shutdown operations must log structured events for post-mortem analysis:

```python
# Start of shutdown
logger.info("Shutdown signal received", signal="SIGTERM")

# Each drain phase
logger.info("Draining database connections", pool_size=5, active=2)
logger.info("Database connections drained", duration_ms=150)

# Completion or timeout
logger.info("Graceful shutdown complete", total_duration_ms=1200)
# or
logger.error("Shutdown timed out", timeout=30, remaining_connections=1)
```

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------|
| `process.exit(0)` immediately on signal | In-flight requests dropped | Drain first, then exit |
| No shutdown timeout | Process hangs forever if a connection refuses to close | Always set a hard deadline |
| Disposing database before subagents | Subagents crash mid-execution | Drain dependents before dependencies |
| Liveness returning 503 during shutdown | Orchestrator kills process during drain | Liveness stays 200; only readiness goes 503 |
| Ignoring double-signal | Second SIGTERM triggers shutdown again, corrupting state | Guard with `shuttingDown` flag |
| `clearInterval` without clearing the Map | Timer references leak memory | Delete from Map after clearing |

---

## Checklist

Before merging code that touches shutdown:

- [ ] `shutdown_event` is set on signal receipt
- [ ] Readiness probe returns 503 during shutdown
- [ ] Liveness probe returns 200 during shutdown
- [ ] New requests rejected with 503 + `Retry-After` header
- [ ] All persistent resources have drain/cleanup methods
- [ ] Drain order respects dependency graph (dependents before dependencies)
- [ ] Hard timeout prevents infinite drain
- [ ] Docker `stop_grace_period` exceeds application timeout
- [ ] Structured log events at each shutdown phase
- [ ] Double-signal guard prevents re-entrant shutdown

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Shutdown Implementation

**Signal Handler**: [lifespan / process.on / both]
**Resources to Drain**: [list of resources]
**Drain Order**: [dependency-ordered sequence]
**Timeout**: [seconds]
**Health Probe Updates**: [readiness 503 / liveness unchanged]
```
