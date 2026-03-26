---
id: structured-logging
name: structured-logging
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


# Structured Logging - Observability Patterns

Consistent, machine-readable logging across the full stack. The backend uses `structlog` with JSON output; the frontend uses a custom `Logger` class. This skill codifies conventions for both and adds correlation IDs, log context, and level guidelines.

## Description

Enforces JSON-structured logging with correlation IDs, consistent log levels, and contextual metadata across the FastAPI backend (structlog) and Next.js frontend (Logger class). Covers sensitive data redaction, request tracing, and observability best practices.

## When to Apply

### Positive Triggers

- Adding logging to new modules or API endpoints
- Reviewing existing log statements for consistency
- Implementing request tracing or correlation IDs
- Debugging production issues via log analysis
- Setting up log aggregation or monitoring pipelines
- User mentions: "logging", "logs", "observability", "tracing", "monitoring", "debug"

### Negative Triggers

- Implementing error response formats (use `error-taxonomy` instead)
- Designing metrics/dashboards (use `metrics-collector` when available)
- Configuring CI/CD pipelines (use `ci-cd-patterns` when available)

## Core Directives

### Always Structured, Never Unstructured

```python
# GOOD: Structured with context
logger.info("Document created", document_id=doc.id, user_id=user.id)

# BAD: Unstructured string interpolation
logger.info(f"Document {doc.id} created by user {user.id}")

# BAD: print() for logging
print(f"Created doc: {doc.id}")
```

### Log Levels

| Level | When to Use | Example |
|-------|------------|---------|
| **ERROR** | Operation failed, needs attention | Database connection lost, agent execution failed |
| **WARNING** | Recoverable issue, degraded behaviour | Rate limit approaching, fallback provider used |
| **INFO** | Significant business events | User logged in, document created, agent run completed |
| **DEBUG** | Development-only detail | Query parameters, intermediate computation results |

### What NOT to Log

- Passwords, tokens, API keys, or session IDs
- Full request/response bodies (log summaries instead)
- Personal information beyond what's needed for debugging
- High-frequency events without sampling (e.g., every heartbeat)

---

## Backend Patterns (structlog)

### Existing Setup

The project configures structlog in `apps/backend/src/utils/logging.py`:

- **Debug mode**: `ConsoleRenderer()` (human-readable)
- **Production mode**: `JSONRenderer()` (machine-readable)
- **Context vars**: `merge_contextvars` enables request-scoped context

### Getting a Logger

```python
from src.utils import get_logger

logger = get_logger(__name__)

# Logger name becomes the "logger" field in JSON output
# e.g., "logger": "src.api.routes.documents"
```

### Correlation IDs

Add a middleware that generates a correlation ID per request and binds it to structlog context:

```python
import uuid
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Attach a correlation ID to every request for log tracing."""

    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get(
            "X-Correlation-ID",
            str(uuid.uuid4())
        )

        # Bind to structlog context (available to all loggers in this request)
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
        )

        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response
```

Register in `apps/backend/src/api/main.py`:

```python
from .middleware.correlation import CorrelationIdMiddleware

app.add_middleware(CorrelationIdMiddleware)
```

### Request Logging

Log every API request with timing:

```python
import time
from src.utils import get_logger

logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log request method, path, status, and duration."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "Request completed",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        return response
```

### Agent Execution Logging

Log agent lifecycle events consistently:

```python
logger = get_logger(__name__)


async def execute_agent(agent_name: str, task: str):
    logger.info("Agent started", agent=agent_name, task=task[:100])

    try:
        result = await agent.run(task)
        logger.info(
            "Agent completed",
            agent=agent_name,
            status="success",
            duration_ms=result.duration_ms,
        )
        return result
    except TimeoutError:
        logger.error(
            "Agent timed out",
            agent=agent_name,
            error_code="AGENT_RUNTIME_TIMEOUT",
        )
        raise
    except Exception as exc:
        logger.error(
            "Agent failed",
            agent=agent_name,
            error_code="AGENT_RUNTIME_FAILED",
            error=str(exc),
        )
        raise
```

### JSON Output Format

In production, each log line is a single JSON object:

```json
{
  "timestamp": "2026-02-13T09:30:00.000Z",
  "level": "info",
  "event": "Request completed",
  "logger": "src.api.middleware.logging",
  "correlation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "POST",
  "path": "/api/documents",
  "status": 201,
  "duration_ms": 42.5
}
```

---

## Frontend Patterns (Logger)

### Existing Setup

The project has a `Logger` class in `apps/web/lib/logger.ts`:

- Level filtering via `LOG_LEVEL` env var
- ISO timestamp formatting
- JSON context serialisation

### Usage Convention

```typescript
import { logger } from '@/lib/logger';

// Business events
logger.info('Document created', { documentId: doc.id, userId: user.id });

// Warnings
logger.warn('API response slow', { endpoint: '/api/agents', durationMs: 2500 });

// Errors (always include the error object)
logger.error('Failed to fetch documents', error, { userId: user.id });

// Debug (stripped in production via LOG_LEVEL)
logger.debug('API response', { status: response.status, body: data });
```

### Correlation ID Propagation

Pass the correlation ID from backend responses to subsequent requests:

```typescript
let correlationId: string | null = null;

export async function apiRequest(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(correlationId ? { 'X-Correlation-ID': correlationId } : {}),
  };

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  // Capture correlation ID from response
  correlationId = response.headers.get('X-Correlation-ID');

  return response;
}
```

### Replacing console.log

All `console.log`, `console.error`, and `console.warn` calls should use the `logger` instead:

```typescript
// BAD
console.log('User logged in');
console.error('Failed to load', error);

// GOOD
logger.info('User logged in', { userId: user.id });
logger.error('Failed to load', error, { component: 'Dashboard' });
```

---

## Log Context Standards

### Required Fields

Every log entry should include (automatically via middleware or manually):

| Field | Source | Example |
|-------|--------|---------|
| `timestamp` | Auto (structlog/Logger) | `2026-02-13T09:30:00.000Z` |
| `level` | Auto | `info`, `error`, `warn`, `debug` |
| `event` | First argument | `"Document created"` |
| `correlation_id` | Middleware | `"a1b2c3d4-..."` |

### Recommended Fields (per domain)

| Domain | Fields |
|--------|--------|
| API requests | `method`, `path`, `status`, `duration_ms` |
| Authentication | `user_id`, `action` (login/logout/token_refresh) |
| Agent execution | `agent`, `task` (truncated), `status`, `duration_ms` |
| Database operations | `table`, `operation` (select/insert/update/delete), `row_count` |
| External services | `service`, `endpoint`, `status`, `duration_ms` |

---

## Logging Checklist

When adding or reviewing logging:

- [ ] Use `get_logger(__name__)` (backend) or `logger` import (frontend)
- [ ] Use structured key-value context, not f-strings
- [ ] Correct log level (ERROR/WARNING/INFO/DEBUG)
- [ ] No secrets, tokens, or passwords in log output
- [ ] Error logs include `error_code` from `error-taxonomy` where applicable
- [ ] High-frequency operations use DEBUG level (not INFO)

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|------------------|
| Unstructured `log.info(f"User {id} logged in")` strings | Not machine-parseable, breaks log aggregation | Use structured key-value pairs: `logger.info("User logged in", user_id=id)` |
| Logging sensitive data (passwords, tokens, API keys) | Security breach via log exposure | Redact sensitive fields; never log credentials or session tokens |
| No correlation IDs across requests | Cannot trace a request through backend and frontend | Use `CorrelationIdMiddleware` and propagate `X-Correlation-ID` header |
| Inconsistent log levels (ERROR for warnings, INFO for debug) | Noisy alerts, missed critical errors | Follow the log level table: ERROR/WARNING/INFO/DEBUG |
| Using `console.log` instead of the Logger class | No level filtering, no structured context, no timestamps | Import `logger` from `@/lib/logger` and use its methods |

## Checklist

- [ ] JSON-structured log output configured for production (structlog `JSONRenderer`)
- [ ] Correlation IDs propagated via `X-Correlation-ID` header
- [ ] Sensitive data redacted from all log output
- [ ] Log levels consistently applied per the level guidelines table
- [ ] All `console.log` calls replaced with `logger` methods in frontend code
- [ ] Error logs include `error_code` from the error taxonomy

## Response Format

```
[AGENT_ACTIVATED]: Structured Logging
[PHASE]: {Implementation | Review | Configuration}
[STATUS]: {in_progress | complete}

{logging analysis or implementation guidance}

[NEXT_ACTION]: {what to do next}
```

## Integration Points

### Error Taxonomy

Error logs should include `error_code` from the error taxonomy:

```python
logger.error("Agent failed", error_code="AGENT_RUNTIME_FAILED", agent=name)
```

### Council of Logic (Shannon Check)

- Log messages must be concise — maximum signal, minimum noise
- Avoid logging the same event at multiple levels
- Use sampling for high-frequency events (e.g., log 1 in 100 health checks)

## Australian Localisation (en-AU)

- **Timestamps**: ISO 8601 (UTC) in log output, DD/MM/YYYY in human reports
- **Spelling**: behaviour, colour, organisation, analyse, centre, serialisation
- **Compliance**: Logs must not contain data subject to Privacy Act 1988 without justification
