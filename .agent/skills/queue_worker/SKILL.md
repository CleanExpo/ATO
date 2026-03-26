---
id: queue-worker
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Queue Worker

> Background job processing with Redis-backed queues, worker lifecycle management, and concurrency control for NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `queue-worker`                                           |
| **Category**   | Data Processing                                          |
| **Complexity** | High                                                     |
| **Complements**| `retry-strategy`, `graceful-shutdown`, `structured-logging` |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies background job processing patterns for NodeJS-Starter-V1: Redis-backed job queues with priority scheduling (arq for Python, BullMQ for TypeScript), worker process lifecycle management, concurrency control, dead letter queues, job serialisation, and integration with the existing `agent_task_queue` API and Docker Compose Redis service.

---

## When to Apply

### Positive Triggers

- Adding background job processing to the backend (email sending, report generation, AI inference)
- Implementing worker processes that consume from Redis queues
- Building job priority and scheduling systems
- Adding dead letter queue handling for failed jobs
- Configuring concurrency limits for resource-intensive tasks
- Integrating background processing with the existing task queue API

### Negative Triggers

- Simple in-process async operations (use `asyncio.create_task()` instead — no queue needed)
- Scheduled periodic tasks without job queues (use `cron-scheduler` skill instead)
- Database-only workflow execution (use the existing `DbWorkflowExecutor` instead)
- Real-time streaming responses (use SSE/WebSocket, not queues)

---

## Core Principles

### The Three Laws of Queue Workers

1. **At-Least-Once Delivery**: Jobs must be acknowledged only after successful processing. If a worker crashes mid-job, the job must be retried — never silently lost.
2. **Idempotency Required**: Every job handler must produce the same result if executed twice with the same input. Use idempotency keys and database upserts.
3. **Bounded Concurrency**: Never process unlimited jobs in parallel. Set concurrency limits based on resource constraints (CPU, memory, database connections).

---

## Pattern 1: Python Worker with arq

### Why arq

arq is a lightweight async job queue built on Redis, designed for Python 3.7+ with native asyncio support. It uses Redis streams for reliable delivery and supports typed jobs, cron-like scheduling, and graceful shutdown.

**Project Reference**: `docker-compose.yml:23-34` — Redis 7-alpine available on port 6380 (mapped from 6379).

### Job Definition

```python
from arq import create_pool
from arq.connections import RedisSettings
from pydantic import BaseModel

# ── Job payload models ────────────────────────────────────
class EmailJobPayload(BaseModel):
    to: str
    subject: str
    template_id: str
    context: dict

class AgentTaskPayload(BaseModel):
    task_id: str
    task_type: str
    description: str
    priority: int = 5

# ── Job handlers ──────────────────────────────────────────
async def send_email(ctx: dict, payload: dict) -> dict:
    """Process email sending job."""
    data = EmailJobPayload(**payload)
    # ... send email logic
    return {"status": "sent", "to": data.to}

async def execute_agent_task(ctx: dict, payload: dict) -> dict:
    """Process agent task from queue."""
    data = AgentTaskPayload(**payload)
    # ... agent execution logic
    return {"status": "completed", "task_id": data.task_id}
```

### Worker Configuration

```python
from arq import cron
from arq.connections import RedisSettings

REDIS_SETTINGS = RedisSettings(
    host="localhost",
    port=6380,        # Project uses non-standard port
    database=0,
)

class WorkerSettings:
    """arq worker configuration."""
    redis_settings = REDIS_SETTINGS
    functions = [send_email, execute_agent_task]
    max_jobs = 10                    # Concurrent job limit
    job_timeout = 300                # 5 minutes per job
    max_tries = 3                    # Retry count before dead letter
    retry_delay = 60                 # Seconds between retries
    health_check_interval = 30       # Health check frequency
    queue_name = "starter:jobs"      # Namespaced queue
```

### Enqueueing Jobs

Use `await create_pool(REDIS_SETTINGS)` then `pool.enqueue_job("function_name", payload_dict, _queue_name="starter:jobs")`. For priority scheduling, use `_defer_by=0` for high-priority jobs (immediate processing).

**Project Reference**: `apps/backend/src/api/routes/task_queue.py:445-510` — the `execute_task` endpoint currently has a placeholder. Replace with `pool.enqueue_job("execute_agent_task", ...)` to process via the worker.

---

## Pattern 2: TypeScript Worker with BullMQ

### Job Definition

```typescript
import { Queue, Worker, Job } from "bullmq";

const connection = { host: "localhost", port: 6380 };

// ── Queue setup ──────────────────────────────────────────
const taskQueue = new Queue("starter:tasks", { connection });

// ── Worker setup ─────────────────────────────────────────
const worker = new Worker(
  "starter:tasks",
  async (job: Job) => {
    switch (job.name) {
      case "send-email":
        return await handleSendEmail(job.data);
      case "generate-report":
        return await handleGenerateReport(job.data);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }, // Rate limit: 10 jobs/sec
  },
);
```

Use `taskQueue.add("job-name", data, { priority, delay, repeat })` to enqueue. Priority: 1 (highest) to 10 (lowest). For delayed jobs, pass `delay` in milliseconds. For repeatable jobs, pass `repeat: { every: ms }` with `removeOnComplete: { count: N }`.

**Project Reference**: `apps/web/app/(dashboard)/tasks/components/QueueStats.tsx` — frontend already displays queue stats. Wire to BullMQ's `queue.getJobCounts()`.

---

## Pattern 3: Worker Lifecycle

### Startup, Processing, and Shutdown

```python
import signal
import asyncio
from arq import create_pool

class WorkerProcess:
    """Managed worker process with lifecycle hooks."""

    def __init__(self, settings: type):
        self.settings = settings
        self._shutdown_event = asyncio.Event()

    async def start(self) -> None:
        """Start worker with signal handlers."""
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, self._handle_shutdown)

        pool = await create_pool(self.settings.redis_settings)
        await self._health_check(pool)
        # arq worker runs until shutdown signal
        # ...

    def _handle_shutdown(self) -> None:
        """Initiate graceful shutdown."""
        self._shutdown_event.set()

    async def _health_check(self, pool) -> None:
        """Verify Redis connectivity before accepting jobs."""
        info = await pool.info()
        if not info:
            raise RuntimeError("Redis not reachable")
```

**Complements**: `graceful-shutdown` skill — worker shutdown must drain in-flight jobs before exiting. Set `stop_grace_period` in Docker Compose to exceed `job_timeout`.

### Docker Compose Integration

```yaml
worker:
  build:
    context: .
    dockerfile: apps/backend/Dockerfile
  command: arq src.worker.WorkerSettings
  environment:
    REDIS_URL: redis://redis:6379
    DATABASE_URL: postgresql://starter_user:local_dev_password@postgres:5432/starter_db
  depends_on:
    redis:
      condition: service_healthy
    postgres:
      condition: service_healthy
  stop_grace_period: 330s   # job_timeout (300s) + 30s buffer
```

**Rule**: The worker container is a separate service from the API server. They share the same image but use different `command` entrypoints. Never run workers inside the API process in production.

---

## Pattern 4: Concurrency Control

### Concurrency Strategies

| Strategy | When to Use | Implementation |
|----------|-------------|----------------|
| **Global limit** | CPU-bound tasks (AI inference) | `max_jobs=2` in worker config |
| **Per-queue limit** | Different task types need different limits | Multiple queues with separate workers |
| **Rate limit** | External API calls with rate limits | BullMQ `limiter` or arq `job_timeout` |
| **Semaphore** | Database connection pool limits | `asyncio.Semaphore(pool_size)` |

### Python Semaphore Pattern

```python
import asyncio

# Limit concurrent database-heavy jobs
_db_semaphore = asyncio.Semaphore(5)

async def execute_agent_task(ctx: dict, payload: dict) -> dict:
    async with _db_semaphore:
        # Only 5 agent tasks run concurrently
        return await _process_task(payload)
```

### Queue Isolation

```python
class WorkerSettings:
    functions = [send_email, execute_agent_task, generate_report]
    queue_name = "starter:jobs"

class HighPriorityWorkerSettings(WorkerSettings):
    functions = [execute_agent_task]
    queue_name = "starter:high-priority"
    max_jobs = 2  # AI tasks are resource-intensive
```

**Rule**: Separate resource-intensive jobs (AI inference, report generation) into dedicated queues with lower concurrency. Lightweight jobs (email, notifications) can share a higher-concurrency queue.

---

## Pattern 5: Dead Letter Queue

### Failed Job Handling

```python
import json
from datetime import datetime

async def on_job_failed(ctx: dict, job_id: str, error: str) -> None:
    """Move failed job to dead letter queue after max retries."""
    pool = ctx["redis"]
    await pool.rpush(
        "starter:dead-letter",
        json.dumps({
            "job_id": job_id,
            "error": str(error),
            "failed_at": datetime.now().isoformat(),
            "original_queue": "starter:jobs",
        }),
    )
```

### Dead Letter Reprocessing

```python
async def reprocess_dead_letters(limit: int = 10) -> int:
    """Move dead letter jobs back to the main queue."""
    pool = await create_pool(REDIS_SETTINGS)
    reprocessed = 0
    for _ in range(limit):
        raw = await pool.lpop("starter:dead-letter")
        if not raw:
            break
        job_data = json.loads(raw)
        await pool.enqueue_job(
            job_data["function"],
            job_data["payload"],
            _queue_name=job_data["original_queue"],
        )
        reprocessed += 1
    return reprocessed
```

**Complements**: `retry-strategy` skill — jobs use exponential backoff between retries. After `max_tries` exhausted, the job moves to the dead letter queue. `structured-logging` skill — log every dead-letter event with structured context.

---

## Pattern 6: Job Serialisation and Idempotency

### Idempotency Keys

```python
async def send_email(ctx: dict, payload: dict) -> dict:
    """Idempotent email sending — safe to retry."""
    idempotency_key = f"email:{payload['to']}:{payload['template_id']}:{payload.get('ref_id')}"

    redis = ctx["redis"]
    if await redis.exists(idempotency_key):
        return {"status": "already_sent", "skipped": True}

    result = await _actually_send_email(payload)

    # Mark as processed with 24h TTL
    await redis.setex(idempotency_key, 86400, "sent")
    return result
```

### Payload Serialisation Rules

| Type | Serialisation | Deserialisation |
|------|---------------|-----------------|
| Pydantic model | `.model_dump()` | `Model(**payload)` |
| UUID | `str(uuid)` | `UUID(payload["id"])` |
| datetime | `.isoformat()` | `datetime.fromisoformat(s)` |
| Enum | `.value` | `Enum(payload["status"])` |

**Rule**: Job payloads must be JSON-serialisable. Never pass ORM objects, database sessions, or file handles as job arguments. Serialise to primitives, deserialise in the handler.

---

## Pattern 7: Integration with Existing Task Queue

**Project Reference**: `apps/backend/src/api/routes/task_queue.py` — existing API with CRUD endpoints for `agent_task_queue` table.

### Bridging API → Worker

Replace the placeholder in the `execute_task` endpoint:

```python
@router.post("/{task_id}/execute")
async def execute_task(task_id: str) -> dict:
    """Submit task to background worker via Redis queue."""
    store = SupabaseStateStore()
    task = await _get_task(store, task_id)

    # Enqueue to worker instead of inline execution
    pool = await create_pool(REDIS_SETTINGS)
    job = await pool.enqueue_job(
        "execute_agent_task",
        {"task_id": task_id, "task_type": task["task_type"],
         "description": task["description"], "priority": task["priority"]},
        _queue_name="starter:high-priority" if task["priority"] <= 3 else "starter:jobs",
    )

    # Update status to in_progress
    store.client.table("agent_task_queue").update({
        "status": "in_progress",
        "started_at": datetime.now().isoformat(),
    }).eq("id", task_id).execute()

    return {"status": "queued", "job_id": job.job_id, "task_id": task_id}
```

### Worker → Status Updates

```python
async def execute_agent_task(ctx: dict, payload: dict) -> dict:
    """Worker handler that updates task status on completion."""
    store = SupabaseStateStore()
    task_id = payload["task_id"]

    try:
        result = await _run_agent(payload)
        store.client.table("agent_task_queue").update({
            "status": "completed",
            "result": result,
            "completed_at": datetime.now().isoformat(),
        }).eq("id", task_id).execute()
        return result
    except Exception as exc:
        store.client.table("agent_task_queue").update({
            "status": "failed",
            "error_message": str(exc),
            "completed_at": datetime.now().isoformat(),
        }).eq("id", task_id).execute()
        raise
```

---

## Pattern 8: Worker Health and Monitoring

### Health Check Endpoint

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/workers", tags=["workers"])

@router.get("/health")
async def worker_health() -> dict:
    """Check worker connectivity and queue depth."""
    pool = await create_pool(REDIS_SETTINGS)
    queue_length = await pool.llen("starter:jobs")
    dlq_length = await pool.llen("starter:dead-letter")

    return {
        "status": "healthy" if queue_length < 1000 else "degraded",
        "queue_depth": queue_length,
        "dead_letter_count": dlq_length,
        "max_jobs": WorkerSettings.max_jobs,
    }
```

**Complements**: `health-check` skill — add worker queue depth to the `/ready` endpoint. `metrics-collector` skill — expose `queue_depth`, `jobs_processed_total`, `job_duration_seconds` gauges/histograms.

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| Processing jobs in the API process | Blocks request handling, no isolation | Separate worker process with own entrypoint |
| No idempotency on job handlers | Duplicate processing on retry | Use idempotency keys with Redis TTL |
| Unbounded concurrency | OOM, connection pool exhaustion | Set `max_jobs` and use semaphores |
| Passing ORM objects as job args | Serialisation fails, stale data | Serialise to primitives, re-fetch in handler |
| No dead letter queue | Failed jobs disappear silently | Move to DLQ after `max_tries` exhausted |
| Worker and API share Redis DB 0 | Key collisions, noisy monitoring | Use separate Redis databases or key namespacing |
| No `stop_grace_period` in Compose | SIGKILL during job processing | Set `stop_grace_period > job_timeout` |
| Inline status updates (no queue) | Tight coupling, no retry | Enqueue status updates as separate micro-jobs |

---

## Checklist

Before merging queue-worker changes:

- [ ] Worker runs as separate process/container from API server
- [ ] Redis connection uses project's non-standard port (6380 host / 6379 container)
- [ ] Job handlers are idempotent (safe to retry)
- [ ] `max_jobs` configured based on resource constraints
- [ ] Dead letter queue captures failed jobs after max retries
- [ ] `stop_grace_period` exceeds `job_timeout` in Docker Compose
- [ ] Job payloads are JSON-serialisable primitives (no ORM objects)
- [ ] Queue names are namespaced (`starter:jobs`, `starter:high-priority`)
- [ ] Worker health endpoint exposed for monitoring
- [ ] Status updates flow back to `agent_task_queue` table

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Queue Worker Implementation

**Queue Backend**: [Redis / PostgreSQL / in-memory]
**Library**: [arq / BullMQ / custom]
**Queue Names**: [namespace:queue-name]
**Concurrency**: [max_jobs] workers, [semaphore] per resource
**Job Timeout**: [seconds]
**Max Retries**: [count] with [backoff strategy]
**Dead Letter**: [enabled / disabled], reprocess via [method]
**Shutdown**: stop_grace_period=[seconds] (> job_timeout)
```
