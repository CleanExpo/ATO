---
id: audit-trail
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Audit Trail

> Structured audit event logging for compliance, forensics, and activity tracking in NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `audit-trail`                                            |
| **Category**   | Authentication & Security                                |
| **Complexity** | Medium                                                   |
| **Complements**| `error-taxonomy`, `structured-logging`, `health-check`   |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies structured audit trail patterns for NodeJS-Starter-V1: immutable audit event logging with Pydantic models, PostgreSQL-backed audit log table, FastAPI middleware for request/response capture, authentication event tracking, agent activity correlation, retention policies with time-based archival, and query APIs for compliance reporting.

---

## When to Apply

### Positive Triggers

- Adding audit logging to API endpoints or authentication flows
- Implementing compliance-grade activity tracking (who did what, when)
- Building forensic investigation capabilities for security incidents
- Integrating audit events with the existing `AgentEventPublisher`
- Creating admin dashboards that display user activity timelines
- Adding retention policies and archival for audit data

### Negative Triggers

- Application-level debug logging (use `structured-logging` skill instead)
- Agent execution event publishing (use existing `AgentEventPublisher` in `src/state/events.py`)
- Frontend evidence collection for UI audits (use existing `EvidenceCollector` in `apps/web/lib/audit/`)
- Metrics instrumentation (use `metrics-collector` skill instead)

---

## Core Principles

### The Three Laws of Audit Trails

1. **Immutability**: Audit records must never be updated or deleted through application code. Use append-only writes. Retention cleanup runs as a separate privileged process.
2. **Completeness**: Every state-changing operation (create, update, delete) must produce an audit event. Missing audit entries are worse than missing features.
3. **Correlation**: Every audit event must carry a `correlation_id` that links it to the originating request, user session, and (if applicable) agent run.

---

## Pattern 1: Audit Event Schema (Python)

### Pydantic Model

```python
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class AuditAction(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PERMISSION_DENIED = "permission_denied"
    EXPORT = "export"
    ESCALATE = "escalate"


class AuditEvent(BaseModel):
    """Immutable audit event record."""

    id: str = Field(default_factory=lambda: f"audit_{uuid4().hex[:12]}")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    action: AuditAction
    resource_type: str          # e.g., "user", "document", "agent_run"
    resource_id: str | None = None
    actor_id: str | None = None  # user ID or agent ID
    actor_type: str = "user"     # "user" | "agent" | "system"
    correlation_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    outcome: str = "success"     # "success" | "failure" | "denied"
    metadata: dict[str, Any] = Field(default_factory=dict)
```

**Project Reference**: `apps/backend/src/state/events.py` — the existing `AgentEventPublisher` tracks agent run lifecycle events. The `AuditEvent` model complements this by capturing user-initiated and system-level actions that fall outside agent runs.

### Action Classification

| Action | When to Emit | Outcome Values |
|--------|-------------|----------------|
| `create` | New record inserted | success, failure |
| `read` | Sensitive data accessed | success, denied |
| `update` | Record modified | success, failure |
| `delete` | Record removed | success, failure |
| `login` | Successful authentication | success |
| `login_failed` | Failed authentication | failure |
| `logout` | User session ended | success |
| `permission_denied` | Unauthorised access attempt | denied |
| `export` | Data exported or downloaded | success, failure |
| `escalate` | Agent escalated to human | success |

---

## Pattern 2: Audit Log Table

### PostgreSQL Schema

```sql
CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action VARCHAR(30) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    actor_id VARCHAR(100),
    actor_type VARCHAR(20) NOT NULL DEFAULT 'user',
    correlation_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}'::JSONB,
    outcome VARCHAR(20) NOT NULL DEFAULT 'success',
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_correlation ON audit_log(correlation_id);
CREATE INDEX idx_audit_outcome ON audit_log(outcome)
    WHERE outcome != 'success';

-- Partition by month for retention management (optional)
-- CREATE TABLE audit_log_2026_02 PARTITION OF audit_log
--     FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

**Project Reference**: `scripts/init-db.sql` — add this table after SECTION 6 (Utility Views). No existing audit tables in the schema. The `audit_evidence` table referenced in `apps/web/lib/audit/evidence-collector.ts` is a Supabase-only table for frontend evidence, not backend audit events.

### Index Rationale

| Index | Query Pattern |
|-------|--------------|
| `idx_audit_timestamp` | Recent events: `ORDER BY timestamp DESC LIMIT 100` |
| `idx_audit_actor` | User activity: `WHERE actor_id = ? ORDER BY timestamp DESC` |
| `idx_audit_resource` | Resource history: `WHERE resource_type = ? AND resource_id = ?` |
| `idx_audit_correlation` | Request tracing: `WHERE correlation_id = ?` |
| `idx_audit_outcome` | Security review: `WHERE outcome = 'denied'` (partial index) |

---

## Pattern 3: Audit Event Emitter

### Python Implementation

```python
from src.utils import get_logger

logger = get_logger(__name__)


class AuditTrail:
    """Append-only audit event emitter."""

    def __init__(self, store) -> None:
        self.store = store

    async def emit(self, event: AuditEvent) -> None:
        """Write audit event to database."""
        try:
            self.store.client.table("audit_log").insert(
                event.model_dump(mode="json")
            ).execute()
        except Exception as exc:
            # Audit failures must never crash the application.
            # Log and continue — investigate separately.
            logger.error(
                "audit_write_failed",
                event_id=event.id,
                action=event.action,
                error=str(exc),
            )

    async def emit_batch(self, events: list[AuditEvent]) -> None:
        """Write multiple audit events in a single transaction."""
        rows = [e.model_dump(mode="json") for e in events]
        try:
            self.store.client.table("audit_log").insert(rows).execute()
        except Exception as exc:
            logger.error(
                "audit_batch_write_failed",
                count=len(events),
                error=str(exc),
            )
```

**Rule**: Audit writes must never raise exceptions to the caller. A failed audit write is logged and investigated separately — it must not block the business operation that triggered it.

**Complements**: `structured-logging` skill — audit failures are logged via `structlog` with structured fields for monitoring and alerting.

---

## Pattern 4: FastAPI Middleware

### Request/Response Audit Middleware

```python
import time
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from src.auth.jwt import extract_user_email
from src.state.supabase import SupabaseStateStore


class AuditMiddleware(BaseHTTPMiddleware):
    """Capture audit events for state-changing API requests."""

    AUDITABLE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    async def dispatch(self, request: Request, call_next):
        # Skip non-auditable methods
        if request.method not in self.AUDITABLE_METHODS:
            return await call_next(request)

        correlation_id = request.headers.get(
            "x-correlation-id", f"req_{uuid4().hex[:12]}"
        )
        start_time = time.monotonic()

        # Extract actor from JWT
        token = request.cookies.get("access_token")
        actor_id = extract_user_email(token) if token else None

        response: Response = await call_next(request)

        duration_ms = (time.monotonic() - start_time) * 1000

        # Emit audit event
        trail = AuditTrail(SupabaseStateStore())
        await trail.emit(AuditEvent(
            action=self._method_to_action(request.method),
            resource_type=self._extract_resource(request.url.path),
            actor_id=actor_id,
            correlation_id=correlation_id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            outcome="success" if response.status_code < 400 else "failure",
            details={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        ))

        # Propagate correlation ID in response
        response.headers["x-correlation-id"] = correlation_id
        return response

    @staticmethod
    def _method_to_action(method: str) -> AuditAction:
        return {"POST": AuditAction.CREATE, "PUT": AuditAction.UPDATE,
                "PATCH": AuditAction.UPDATE, "DELETE": AuditAction.DELETE,
                }.get(method, AuditAction.UPDATE)

    @staticmethod
    def _extract_resource(path: str) -> str:
        parts = path.strip("/").split("/")
        return parts[1] if len(parts) > 1 else "unknown"
```

**Project Reference**: `apps/backend/src/api/main.py` — add `app.add_middleware(AuditMiddleware)` after existing middleware.

For fine-grained control beyond middleware, use an `@audited(resource_type, action)` decorator that attaches `_audit_resource` and `_audit_action` attributes to endpoint functions. The middleware reads these attributes to override auto-detected values.

---

## Pattern 5: Authentication Event Logging

### Auth Audit Integration

```python
from src.auth.jwt import verify_password, create_access_token


async def login_with_audit(
    email: str,
    password: str,
    ip_address: str | None,
    trail: AuditTrail,
) -> str | None:
    """Authenticate user and emit audit event."""
    user = await get_user_by_email(email)

    if not user or not verify_password(password, user["password_hash"]):
        await trail.emit(AuditEvent(
            action=AuditAction.LOGIN_FAILED,
            resource_type="auth",
            actor_id=email,
            ip_address=ip_address,
            outcome="failure",
            details={"reason": "invalid_credentials"},
        ))
        return None

    token = create_access_token({"sub": email})

    await trail.emit(AuditEvent(
        action=AuditAction.LOGIN,
        resource_type="auth",
        resource_id=str(user["id"]),
        actor_id=email,
        ip_address=ip_address,
        outcome="success",
    ))

    return token
```

**Project Reference**: `apps/backend/src/auth/jwt.py` — current auth module has no audit logging. The `login_with_audit` wrapper adds audit events without modifying the existing JWT functions.

### Security Events to Audit

| Event | Action | Priority |
|-------|--------|----------|
| Successful login | `login` | Always |
| Failed login | `login_failed` | Always |
| Logout | `logout` | Always |
| Password change | `update` | Always |
| Permission denied (403) | `permission_denied` | Always |
| Admin action | `create`/`update`/`delete` | Always |
| Data export | `export` | Always |
| Token refresh | `update` | Optional |
| Profile view | `read` | Optional |

---

## Pattern 6: Agent Activity Correlation

### Bridging AgentEventPublisher and AuditTrail

```python
class AuditedEventPublisher(AgentEventPublisher):
    """Extends AgentEventPublisher with audit trail correlation."""

    def __init__(self, trail: AuditTrail) -> None:
        super().__init__()
        self.trail = trail

    async def start_run(self, **kwargs) -> str:
        run_id = await super().start_run(**kwargs)
        await self.trail.emit(AuditEvent(
            action=AuditAction.CREATE,
            resource_type="agent_run",
            resource_id=run_id,
            actor_id=kwargs.get("user_id"),
            actor_type="system",
            correlation_id=kwargs.get("task_id"),
            details={"agent_name": kwargs.get("agent_name")},
        ))
        return run_id

    async def escalate_run(self, run_id: str, reason: str, **kwargs):
        await super().escalate_run(run_id, reason, **kwargs)
        await self.trail.emit(AuditEvent(
            action=AuditAction.ESCALATE,
            resource_type="agent_run",
            resource_id=run_id,
            actor_type="agent",
            outcome="success",
            details={"reason": reason},
        ))
```

**Project Reference**: `apps/backend/src/state/events.py:39-313` — `AgentEventPublisher` handles real-time status updates for the frontend. `AuditedEventPublisher` extends it to write immutable audit records for compliance without duplicating the real-time functionality.

---

## Pattern 7: Retention and Archival

### Time-Based Retention Policy

| Data Classification | Retention Period | Archival |
|---|---|---|
| Security events (login, permission_denied) | 365 days | Archive to cold storage |
| State-changing operations (create, update, delete) | 90 days | Archive to cold storage |
| Read access events | 30 days | Delete after expiry |
| Agent activity events | 90 days | Archive to cold storage |

### Cleanup Implementation

Implement `cleanup_audit_log(store, retention_days=90, security_retention_days=365)` as an async function that:

1. Calculates cutoff timestamps for both retention tiers
2. Deletes non-security events older than `retention_days` using `.delete().lt("timestamp", cutoff).not_.in_("action", security_actions)`
3. Deletes security events older than `security_retention_days` using `.delete().lt("timestamp", security_cutoff).in_("action", security_actions)`
4. Returns `{"non_security_deleted": int, "security_deleted": int}`

**Complements**: `cron-scheduler` skill — schedule `cleanup_audit_log` as a daily cron job with `CRON_SECRET` authentication. `health-check` skill — add audit log table size to the `/ready` endpoint.

**Project Reference**: `apps/web/lib/audit/evidence-collector.ts:116-137` — the frontend `EvidenceCollector` already implements retention policies with category-based durations. Follow the same pattern for backend audit events.

---

## Pattern 8: Query API

### Audit Log Query Endpoint

Create a `GET /api/audit/events` endpoint on `APIRouter(prefix="/api/audit", tags=["audit"])` with these query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `actor_id` | `str \| None` | Filter by actor |
| `resource_type` | `str \| None` | Filter by resource type |
| `resource_id` | `str \| None` | Filter by specific resource |
| `action` | `str \| None` | Filter by action enum |
| `outcome` | `str \| None` | Filter by outcome |
| `from_date` / `to_date` | `datetime \| None` | Date range |
| `correlation_id` | `str \| None` | Trace a request chain |
| `limit` | `int` (default 50, max 200) | Pagination |
| `offset` | `int` (default 0) | Pagination offset |

Chain Supabase `.eq()` / `.gte()` / `.lte()` filters, order by `timestamp DESC`, apply `.range(offset, offset + limit - 1)`, return `{"events": data, "count": len(data)}`.

**Rule**: The audit query endpoint must be restricted to admin users. Never expose audit logs to non-admin users — they may contain IP addresses, user agents, and other sensitive metadata.

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| Mutable audit records (UPDATE/DELETE) | Destroys forensic evidence | Append-only writes; cleanup via privileged process |
| Audit writes blocking business logic | Application errors on audit failure | Fire-and-forget with error logging |
| No correlation ID | Cannot trace events across services | Propagate `x-correlation-id` header |
| Logging everything as `read` | Noise drowns out security signals | Only audit sensitive reads (PII, credentials) |
| Storing raw request bodies | PII exposure, storage bloat | Store action + resource + outcome only |
| Same retention for all events | Security events deleted too early | Category-based retention (security = 365d) |
| Audit endpoint without auth | Audit data leaks to unauthorised users | Admin-only access with JWT verification |
| Synchronous audit in hot path | Latency on every request | Async writes; consider background queue |

---

## Checklist

Before merging audit-trail changes:

- [ ] `audit_log` table created with correct indexes
- [ ] `AuditEvent` Pydantic model validates all required fields
- [ ] `AuditTrail.emit()` never raises exceptions to callers
- [ ] FastAPI middleware captures POST/PUT/PATCH/DELETE requests
- [ ] Authentication events (login, logout, failed) are audited
- [ ] `correlation_id` propagated via `x-correlation-id` header
- [ ] Agent activity bridges `AgentEventPublisher` to audit trail
- [ ] Retention policy configured with security event exceptions
- [ ] Query endpoint restricted to admin users
- [ ] No PII stored in raw request bodies (action + outcome only)

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Audit Trail Implementation

**Storage**: [PostgreSQL / Supabase]
**Event Model**: AuditEvent (Pydantic)
**Capture Method**: [middleware / decorator / explicit]
**Auth Events**: [login, logout, login_failed, permission_denied]
**Agent Correlation**: [AuditedEventPublisher / direct emit]
**Retention**: security=[days], operations=[days], reads=[days]
**Query API**: /api/audit/events (admin-only)
**Cleanup**: [cron / manual / scheduled]
```
