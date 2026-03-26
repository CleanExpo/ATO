---
id: metrics-collector
name: metrics-collector
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


# Metrics Collector - Observability Metrics Instrumentation

Standardised patterns for collecting, storing, and querying application metrics. Codifies the project's existing database-backed approach (Supabase + PostgreSQL) and defines conventions for metric naming, aggregation, and display. Designed for Vercel/serverless — no Prometheus scraping required.

## Description

Codifies database-backed metrics instrumentation for NodeJS-Starter-V1 using Supabase/PostgreSQL, covering standardised metric types (counters, gauges, histograms), naming conventions, time-series aggregation queries, and optional OpenTelemetry export for serverless-compatible observability.

---

## When to Apply

### Positive Triggers

- Adding new metrics or KPIs to the application
- Creating dashboard data sources or analytics endpoints
- Instrumenting API routes, agent executions, or background jobs
- Querying time-series metric data for trends and reports
- Setting up alerting thresholds based on metric values
- User mentions: "metrics", "KPI", "instrumentation", "analytics", "monitoring", "dashboard data"

### Negative Triggers

- Adding log statements to code (use `structured-logging` instead)
- Designing dashboard UI components (use `dashboard-patterns` when available)
- Formatting error responses (use `error-taxonomy` instead)
- Scheduling periodic metric aggregation (use `cron-scheduler` instead)

## Core Directives

### The Three Laws of Metrics

1. **Name consistently**: Every metric follows `{domain}_{entity}_{measurement}` convention
2. **Store durably**: Metrics persist in PostgreSQL, not ephemeral in-memory
3. **Aggregate lazily**: Store raw events, compute aggregations at query time (or via cron)

---

## Existing Project Metrics Infrastructure

### Backend

| Component | Location | Purpose |
|-----------|----------|---------|
| `AgentMetrics` class | `apps/backend/src/monitoring/agent_metrics.py` | Task execution tracking, health reports |
| `TaskMetrics` model | `apps/backend/src/monitoring/agent_metrics.py` | Per-task metric schema |
| `AgentHealthReport` model | `apps/backend/src/monitoring/agent_metrics.py` | Agent health aggregation |
| Analytics routes | `apps/backend/src/api/routes/analytics.py` | `/metrics/overview`, `/metrics/agents`, `/metrics/costs` |
| Dashboard routes | `apps/backend/src/api/routes/agent_dashboard.py` | `/stats`, `/list`, `/{id}/health`, `/performance/trends` |
| Health routes | `apps/backend/src/api/routes/health.py` | `/health`, `/ready` |

### Database Tables

| Table | Stores | Key Columns |
|-------|--------|-------------|
| `agent_runs` | Agent execution records | `id`, `agent_type`, `status`, `metadata`, `started_at`, `completed_at` |
| `api_usage` | LLM API call costs | `model`, `cost_usd`, `input_tokens`, `output_tokens`, `created_at` |
| `tool_usage_events` | Tool invocation records | `agent_run_id`, tool details, timestamps |

### Frontend

| Component | Location | Purpose |
|-----------|----------|---------|
| `MetricTile` | `apps/web/components/status-command-centre/` | Stat tile with trend indicator |
| Analytics dashboard | `apps/web/app/dashboard-analytics/page.tsx` | Overview metrics display |
| Proxy route | `apps/web/app/api/analytics/metrics/overview/route.ts` | Backend proxy |

---

## Metric Types

| Type | Behaviour | Storage | Examples |
|------|-----------|---------|----------|
| **Counter** | Monotonically increasing | `INSERT` per event, `COUNT(*)` for total | `agent_run_total`, `llm_token_total` |
| **Gauge** | Point-in-time value (up or down) | `UPSERT` — latest value wins | `agent_run_active`, `queue_depth` |
| **Histogram** | Value distribution | `INSERT` per observation, percentile queries | `api_request_duration_ms` |

All three types are stored in PostgreSQL (no in-memory counters — they vanish between serverless invocations). Counters and histograms go to `metrics_events`; gauges go to `metrics_gauges`.

---

## Naming Convention

All metric names follow the pattern:

```
{domain}_{entity}_{measurement}[_{unit}]
```

| Segment | Examples | Rules |
|---------|----------|-------|
| `domain` | `agent`, `api`, `cron`, `auth` | snake_case, matches module |
| `entity` | `run`, `request`, `token`, `job` | singular noun |
| `measurement` | `total`, `duration`, `rate`, `size` | what is being measured |
| `unit` (optional) | `ms`, `bytes`, `usd`, `percent` | SI or currency unit |

### Standard Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `agent_run_total` | Counter | `agent_type`, `status` | Total agent executions |
| `agent_run_duration_ms` | Histogram | `agent_type` | Execution time |
| `agent_run_active` | Gauge | `agent_type` | Currently running agents |
| `api_request_total` | Counter | `method`, `route`, `status_code` | HTTP requests |
| `api_request_duration_ms` | Histogram | `method`, `route` | Request latency |
| `llm_token_total` | Counter | `model`, `direction` | Token usage (input/output) |
| `llm_cost_usd` | Counter | `model` | LLM API cost |
| `cron_job_duration_ms` | Histogram | `job_name` | Cron execution time |
| `cron_job_total` | Counter | `job_name`, `status` | Cron executions |
| `auth_login_total` | Counter | `method`, `result` | Login attempts |

---

## Backend Patterns

### MetricsRegistry

A thin wrapper around the existing `AgentMetrics` pattern, extended with standard metric types. Three methods: `increment()` (counter), `observe()` (histogram), `set_gauge()` (gauge).

```python
from datetime import datetime, UTC
from src.state.supabase import SupabaseStateStore
from src.utils import get_logger

logger = get_logger(__name__)


class MetricsRegistry:
    """Centralised metrics collection and query interface."""

    def __init__(self) -> None:
        self.store = SupabaseStateStore()
        self.client = self.store.client

    async def increment(self, metric: str, value: int = 1, labels: dict[str, str] | None = None) -> None:
        """Increment a counter metric."""
        self.client.table("metrics_events").insert(
            {"metric_name": metric, "metric_type": "counter", "value": value,
             "labels": labels or {}, "recorded_at": datetime.now(UTC).isoformat()}
        ).execute()
        logger.debug("metric_recorded", metric=metric, type="counter", value=value)

    async def observe(self, metric: str, value: float, labels: dict[str, str] | None = None) -> None:
        """Record a histogram observation."""
        self.client.table("metrics_events").insert(
            {"metric_name": metric, "metric_type": "histogram", "value": value,
             "labels": labels or {}, "recorded_at": datetime.now(UTC).isoformat()}
        ).execute()

    async def set_gauge(self, metric: str, value: float, labels: dict[str, str] | None = None) -> None:
        """Set a gauge value (replaces previous)."""
        label_key = str(sorted((labels or {}).items()))
        self.client.table("metrics_gauges").upsert(
            {"metric_name": metric, "label_key": label_key, "labels": labels or {},
             "value": value, "recorded_at": datetime.now(UTC).isoformat()},
            on_conflict="metric_name,label_key",
        ).execute()

# Singleton instance
metrics = MetricsRegistry()
```

### Instrumenting API Routes

Use `BaseHTTPMiddleware` to record `api_request_total` (counter) and `api_request_duration_ms` (histogram) on every request. Label with `method`, `route`, `status_code`. Example:

```python
import time
from starlette.middleware.base import BaseHTTPMiddleware
from src.monitoring.metrics_registry import metrics

class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = (time.monotonic() - start) * 1000
        labels = {"method": request.method, "route": request.url.path, "status_code": str(response.status_code)}
        await metrics.increment("api_request_total", labels=labels)
        await metrics.observe("api_request_duration_ms", duration_ms, labels=labels)
        return response
```

### Instrumenting Agent Executions

Extend `AgentMetrics.track_task_execution` to also record standard metrics:

```python
await metrics.increment("agent_run_total", labels={"agent_type": agent_type, "status": status})
await metrics.observe("agent_run_duration_ms", task_metrics.duration_seconds * 1000, labels={"agent_type": agent_type})
```

---

## Aggregation Patterns

### Time-Series Bucketing

Query metrics grouped by time period for trend charts. Fetch events from `metrics_events`, group by truncated timestamp (minute/hour/day), and compute `count`, `sum`, `avg`, `min`, `max` per bucket. Use PostgreSQL `date_trunc` via Supabase RPC for server-side efficiency, or bucket in Python for small datasets:

```python
async def get_metric_timeseries(
    self, metric_name: str, bucket: str = "hour", since_hours: int = 24,
) -> list[dict[str, Any]]:
    since = (datetime.now(UTC) - timedelta(hours=since_hours)).isoformat()
    result = self.client.table("metrics_events").select("value, recorded_at").eq(
        "metric_name", metric_name
    ).gte("recorded_at", since).order("recorded_at").execute()

    buckets: dict[str, list[float]] = {}
    for row in (result.data or []):
        ts = datetime.fromisoformat(row["recorded_at"])
        fmt = {"hour": "%Y-%m-%dT%H:00:00Z", "day": "%Y-%m-%dT00:00:00Z"}.get(bucket, "%Y-%m-%dT%H:%M:00Z")
        buckets.setdefault(ts.strftime(fmt), []).append(row["value"])

    return [{"timestamp": ts, "count": len(v), "sum": sum(v), "avg": sum(v) / len(v), "min": min(v), "max": max(v)} for ts, v in buckets.items()]
```

### Percentile Calculation (Histogram Metrics)

For histogram metrics, compute p50/p90/p95/p99 using `statistics.quantiles`. Query `metrics_events` filtered by `metric_name` and time range, sort values, then calculate:

```python
import statistics

async def get_percentiles(self, metric_name: str, since_hours: int = 24) -> dict[str, float]:
    since = (datetime.now(UTC) - timedelta(hours=since_hours)).isoformat()
    result = self.client.table("metrics_events").select("value").eq(
        "metric_name", metric_name
    ).gte("recorded_at", since).execute()
    values = sorted(r["value"] for r in (result.data or []))
    if len(values) < 2:
        return {"p50": 0, "p90": 0, "p95": 0, "p99": 0}
    q = statistics.quantiles(values, n=100)
    return {"p50": q[49], "p90": q[89], "p95": q[94], "p99": q[98]}
```

---

## Summary Endpoint

Expose a `/metrics/summary` endpoint returning counters, gauges, and histogram percentiles:

```python
@router.get("/metrics/summary")
async def get_metrics_summary(since_hours: int = Query(24, ge=1, le=720)) -> dict[str, Any]:
    registry = MetricsRegistry()
    return {
        "counters": await registry.get_counter_totals(since_hours),
        "gauges": await registry.get_current_gauges(),
        "histograms": {
            "api_request_duration_ms": await registry.get_percentiles("api_request_duration_ms", since_hours),
            "agent_run_duration_ms": await registry.get_percentiles("agent_run_duration_ms", since_hours),
        },
        "since_hours": since_hours,
        "generated_at": datetime.now(UTC).isoformat(),
    }
```

---

## Frontend Patterns

Define `MetricSummary` TypeScript interface mirroring the backend response. Use the existing proxy route pattern (`apps/web/app/api/analytics/`) to forward requests. Poll at 30-second intervals (matching the existing analytics dashboard) or use Supabase Realtime for gauge updates. Display via the existing `MetricTile` component from `status-command-centre/`.

---

## Database Schema

### metrics_events Table (Counters + Histograms)

```sql
CREATE TABLE IF NOT EXISTS metrics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('counter', 'histogram')),
  value DOUBLE PRECISION NOT NULL,
  labels JSONB NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_metrics_events_name_time ON metrics_events (metric_name, recorded_at DESC);
CREATE INDEX idx_metrics_events_labels ON metrics_events USING GIN (labels);
```

### metrics_gauges Table

```sql
CREATE TABLE IF NOT EXISTS metrics_gauges (
  metric_name TEXT NOT NULL,
  label_key TEXT NOT NULL DEFAULT '',
  labels JSONB NOT NULL DEFAULT '{}',
  value DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (metric_name, label_key)
);
```

### Retention Policy

Schedule a cron job (`/api/cron/metrics-cleanup`) to `DELETE FROM metrics_events WHERE recorded_at < NOW() - INTERVAL '90 days'`.

---

## OpenTelemetry Bridge (Optional)

For production with full observability infrastructure (Grafana, Datadog), optionally export metrics to an OTel collector by creating `MeterProvider` instruments that mirror the database metric names. Only enable when `OTEL_EXPORTER_OTLP_ENDPOINT` is configured. The database-backed approach works standalone for Vercel/serverless.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| In-memory counters on serverless | Lost between invocations, no persistence | Database-backed metrics |
| Prometheus scrape endpoint on Vercel | No persistent process to scrape | Database storage + query endpoints |
| Logging metrics as unstructured strings | Cannot aggregate or query | `MetricsRegistry` with typed methods |
| Recording per-request without labels | Cannot filter by route or status | Always include `method`, `route`, `status_code` labels |
| Querying raw events for dashboards | Slow on large datasets | Pre-aggregate via cron or use time-bucket queries |
| Unbounded metrics_events growth | Storage costs, slow queries | 90-day retention cron job |

---

## Checklist for New Metrics

### Definition

- [ ] Metric name follows `{domain}_{entity}_{measurement}[_{unit}]` convention
- [ ] Type chosen correctly: counter (cumulative), gauge (current), histogram (distribution)
- [ ] Labels defined (minimum context for filtering)
- [ ] Added to Standard Metrics table in this document

### Implementation

- [ ] Uses `MetricsRegistry` singleton (`metrics.increment`, `metrics.observe`, `metrics.set_gauge`)
- [ ] Integrated with `structured-logging` (debug-level metric recording logs)
- [ ] Error handling — metric recording failures must not break the request

### Query

- [ ] Time-series aggregation tested for the new metric
- [ ] Summary endpoint includes the new metric (if high-value)
- [ ] Frontend display considered (MetricTile or chart)

### Maintenance

- [ ] Covered by 90-day retention policy (or custom retention if needed)
- [ ] Documentation updated in Standard Metrics table

---

## Response Format

```
[AGENT_ACTIVATED]: Metrics Collector
[PHASE]: {Design | Implementation | Review}
[STATUS]: {in_progress | complete}

{metrics analysis or implementation guidance}

[NEXT_ACTION]: {what to do next}
```

## Integration Points

### Structured Logging

- `MetricsRegistry` emits `metric_recorded` debug-level logs
- Shares `correlation_id` from request context for tracing

### Error Taxonomy

- Metric recording failures: `SYS_RUNTIME_METRICS` (500) — logged but never thrown to caller
- Invalid metric names: `DATA_VALIDATION_METRIC_NAME` (422)

### Cron Scheduler

- `metrics-cleanup` cron job deletes events older than 90 days
- Cron job metrics (`cron_job_total`, `cron_job_duration_ms`) recorded by cron handlers

### API Contract

- `/metrics/summary` endpoint included in OpenAPI docs
- `MetricSummary` response model typed with Pydantic (backend) and TypeScript interface (frontend)

### Dashboard Patterns

- `MetricsRegistry` provides the data layer for dashboard visualisations
- Time-series aggregation powers trend charts
- Gauge values power real-time status displays

## Australian Localisation (en-AU)

- **Timezone**: AEST/AEDT — `recorded_at` stored as UTC, converted in display
- **Currency**: `llm_cost_usd` stored in USD (API billing currency); convert to AUD for display
- **Spelling**: serialise, analyse, optimise, behaviour, colour
- **Date Format**: ISO 8601 in storage; DD/MM/YYYY in UI display
