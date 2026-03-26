---
id: retry-strategy
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Retry Strategy

> Exponential backoff, circuit breaker, and retry policy patterns for Python (httpx, asyncio) and TypeScript (fetch) in NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `retry-strategy`                                         |
| **Category**   | Error Handling & Resilience                              |
| **Complexity** | Medium                                                   |
| **Complements**| `error-taxonomy`, `graceful-shutdown`, `health-check`    |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies retry and resilience patterns for NodeJS-Starter-V1: exponential backoff with jitter for transient failures, circuit breaker for cascading failure prevention, retry policies for httpx (backend) and fetch (frontend) clients, agent execution retry loops with self-correction, timeout configuration, and dead letter handling for exhausted retries.

---

## When to Apply

### Positive Triggers

- Adding retry logic to HTTP client calls (httpx, fetch)
- Implementing backoff strategies for API rate limits or transient errors
- Building circuit breaker patterns around external service calls
- Configuring timeout and retry policies for AI provider calls (Ollama, Anthropic)
- Wrapping agent execution in retry-with-correction loops
- Handling webhook delivery with guaranteed delivery semantics

### Negative Triggers

- Input validation failures (use `data-validation` instead — invalid input should not be retried)
- Application-level business logic errors (non-transient, retrying will not help)
- Authentication/authorisation failures (401/403 — retrying with same credentials is pointless)
- Database schema or migration issues (use `state-machine` for workflow recovery)

---

## Core Principles

### The Three Laws of Retry

1. **Only Retry Transient Failures**: Network timeouts, 429 rate limits, 502/503/504 gateway errors. Never retry 400 Bad Request or 404 Not Found.
2. **Always Add Jitter**: Without jitter, retrying clients synchronise and create thundering herd. Full jitter: `delay = random(0, base * 2^attempt)`.
3. **Bound Everything**: Max retries, max delay, total timeout. Unbounded retries are denial-of-service against yourself.

---

## Pattern 1: Exponential Backoff with Jitter (Python)

### Core Implementation

```python
import asyncio
import random
from typing import TypeVar, Callable, Awaitable

T = TypeVar("T")

class RetryConfig:
    """Retry configuration with sensible defaults."""
    max_retries: int = 3
    base_delay: float = 1.0        # seconds
    max_delay: float = 30.0        # seconds
    jitter: bool = True
    retryable_status_codes: set[int] = {429, 502, 503, 504}
    retryable_exceptions: tuple[type[Exception], ...] = (
        ConnectionError, TimeoutError, asyncio.TimeoutError,
    )

def calculate_delay(attempt: int, config: RetryConfig) -> float:
    """Exponential backoff with optional full jitter."""
    delay = min(config.base_delay * (2 ** attempt), config.max_delay)
    if config.jitter:
        delay = random.uniform(0, delay)
    return delay

async def retry_async(
    fn: Callable[..., Awaitable[T]],
    *args,
    config: RetryConfig | None = None,
    **kwargs,
) -> T:
    """Execute async function with exponential backoff retry."""
    config = config or RetryConfig()
    last_exception: Exception | None = None

    for attempt in range(config.max_retries + 1):
        try:
            return await fn(*args, **kwargs)
        except config.retryable_exceptions as exc:
            last_exception = exc
            if attempt == config.max_retries:
                break
            delay = calculate_delay(attempt, config)
            await asyncio.sleep(delay)

    raise last_exception  # type: ignore[misc]
```

**Project Reference**: `apps/backend/src/models/ollama_provider.py` — httpx calls to Ollama API currently have no retry logic. Wrap with `retry_async()`.

### Usage with httpx

```python
import httpx

async def call_ollama(prompt: str) -> dict:
    config = RetryConfig(
        max_retries=3,
        base_delay=1.0,
        retryable_exceptions=(
            httpx.ConnectError, httpx.TimeoutException,
        ),
    )
    async with httpx.AsyncClient(timeout=30.0) as client:
        return await retry_async(
            client.post,
            "http://localhost:11434/api/generate",
            json={"model": "llama3.1:8b", "prompt": prompt},
            config=config,
        )
```

---

## Pattern 2: Exponential Backoff with Jitter (TypeScript)

### Core Implementation

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;       // milliseconds
  maxDelay: number;        // milliseconds
  jitter: boolean;
  retryableStatusCodes: Set<number>;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
  retryableStatusCodes: new Set([429, 502, 503, 504]),
};

function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(config.baseDelay * 2 ** attempt, config.maxDelay);
  return config.jitter ? Math.random() * delay : delay;
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!config.retryableStatusCodes.has(response.status)) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < config.maxRetries) {
      await new Promise((r) => setTimeout(r, calculateDelay(attempt, config)));
    }
  }

  throw lastError;
}
```

**Project Reference**: `apps/web/lib/api/client.ts` — `fetchApi()` currently has no retry logic. Replace inner `fetch()` call with `fetchWithRetry()`.

**Rule**: For 429 responses, always check the `Retry-After` header and use that delay instead of calculated backoff. Parse as seconds (`parseInt(retryAfter, 10) * 1000`) before sleeping.

---

## Pattern 3: Circuit Breaker

### State Machine

```
CLOSED ──(failure threshold)──► OPEN
  ▲                               │
  │                          (reset timeout)
  │                               │
  └──(success)── HALF_OPEN ◄──────┘
```

### Python Implementation

```python
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    """Circuit breaker for external service calls."""

    def __init__(
        self,
        failure_threshold: int = 5,
        reset_timeout: float = 60.0,
        half_open_max_calls: int = 1,
    ):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.half_open_max_calls = half_open_max_calls
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: float = 0
        self._half_open_calls = 0

    @property
    def state(self) -> CircuitState:
        if (
            self._state == CircuitState.OPEN
            and time.monotonic() - self._last_failure_time >= self.reset_timeout
        ):
            self._state = CircuitState.HALF_OPEN
            self._half_open_calls = 0
        return self._state

    async def call(self, fn, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            raise CircuitOpenError(
                f"Circuit open. Resets in "
                f"{self.reset_timeout - (time.monotonic() - self._last_failure_time):.0f}s"
            )

        try:
            result = await fn(*args, **kwargs)
            self._on_success()
            return result
        except Exception as exc:
            self._on_failure()
            raise

    def _on_success(self) -> None:
        self._failure_count = 0
        self._state = CircuitState.CLOSED

    def _on_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.monotonic()
        if self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN

class CircuitOpenError(Exception):
    """Raised when circuit breaker is open."""
```

### Usage

```python
# One circuit breaker per external service
ollama_circuit = CircuitBreaker(failure_threshold=5, reset_timeout=60)
anthropic_circuit = CircuitBreaker(failure_threshold=3, reset_timeout=120)

async def call_ai_provider(prompt: str) -> str:
    try:
        return await ollama_circuit.call(ollama_complete, prompt)
    except CircuitOpenError:
        # Fallback to alternative provider
        return await anthropic_circuit.call(anthropic_complete, prompt)
```

**Rule**: Create one circuit breaker instance per external dependency. Never share circuit breakers between unrelated services — a database outage should not trip the AI provider circuit.

---

## Pattern 4: Agent Retry with Self-Correction

**Project Reference**: `apps/backend/src/agents/base_agent.py:540-634` — `iterate_until_passing()` with `max_attempts=3`.

### Enhanced Pattern

```python
async def iterate_until_passing(
    self,
    task_description: str,
    context: dict[str, Any] | None = None,
    max_attempts: int = 3,
    backoff_base: float = 2.0,
) -> tuple[Any, bool]:
    """Execute task with self-correction retry loop."""
    attempts: list[dict] = []

    for attempt in range(max_attempts):
        if attempt > 0:
            delay = backoff_base * (2 ** (attempt - 1))
            await asyncio.sleep(delay)

        result = await self.execute(task_description, context)
        verification = await self.verify(result)

        if verification.passed:
            return result, True

        # Collect failure evidence for self-correction
        attempts.append({
            "attempt": attempt + 1,
            "result_summary": result.summary,
            "failure_reasons": verification.failures,
        })

        # Enrich context with failure history
        context = {
            **(context or {}),
            "previous_attempts": attempts,
            "correction_guidance": verification.suggestions,
        }

    return result, False  # Exhausted retries
```

**Key Differences from Current Implementation**:

| Current (`base_agent.py`) | Enhanced Pattern |
|---|---|
| No backoff between attempts | Exponential backoff (`2s → 4s → 8s`) |
| Failure history as flat list | Structured failure evidence with suggestions |
| No configurable backoff | `backoff_base` parameter |

### Subagent Timeout Pattern

**Project Reference**: `apps/backend/src/agents/subagent_manager.py:53-54` — `SubagentConfig(timeout_seconds=300, max_retries=2)`.

```python
async def _execute_subagent(
    self,
    agent: BaseAgent,
    task: str,
    config: SubagentConfig,
) -> TaskOutput:
    """Execute subagent with timeout and retry."""
    for attempt in range(config.max_retries + 1):
        try:
            return await asyncio.wait_for(
                agent.execute(task, {}),
                timeout=config.timeout_seconds,
            )
        except asyncio.TimeoutError:
            if attempt == config.max_retries:
                return TaskOutput(
                    status="timeout",
                    error=f"Subagent timed out after {config.timeout_seconds}s "
                          f"({attempt + 1} attempts)",
                )
            # Reduce timeout on retry to fail faster
            config = config.model_copy(
                update={"timeout_seconds": config.timeout_seconds * 0.8}
            )
```

**Rule**: When retrying timeouts, consider reducing the timeout on each attempt. If a call times out at 300s, it is unlikely to succeed at 300s again — but it might succeed at 240s if the service recovers.

---

## Pattern 5: Retry Classification

Classify errors into three categories before deciding whether to retry:

| Classification | HTTP Codes | Exceptions | Action |
|---|---|---|---|
| `RETRYABLE` | 502, 503, 504, 5xx | `ConnectionError`, `TimeoutError`, `asyncio.TimeoutError`, `OSError(111/104)` | Retry with backoff |
| `RETRYABLE_WITH_BACKOFF` | 429 | — | Retry using `Retry-After` header |
| `NON_RETRYABLE` | 4xx (400, 401, 403, 404) | `ValueError`, `TypeError` | Fail immediately |

**Complements**: `error-taxonomy` skill — use error codes from that skill to drive retry classification.

---

## Pattern 6: Dead Letter and Exhausted Retry Handling

When all retries are exhausted, the failure must be recorded, not silently dropped. Wrap `retry_async()` in a try/except that:

1. **Logs** with structured fields: `max_retries`, `function`, `error_type` (see `structured-logging` skill)
2. **Calls an `on_exhausted` callback** if provided (e.g., write to dead-letter queue, send alert)
3. **Increments** `retry_exhausted_total` counter (see `metrics-collector` skill)
4. **Re-raises** the exception — callers must handle exhaustion explicitly

---

## Pattern 7: Timeout Configuration

### Recommended Timeouts by Service Type

| Service | Connect Timeout | Read Timeout | Total Timeout | Rationale |
|---------|:-:|:-:|:-:|---|
| Ollama (local AI) | 5s | 120s | 300s | Model loading can be slow; generation is streaming |
| Anthropic API | 10s | 60s | 120s | Cloud API with SLA |
| PostgreSQL | 5s | 30s | 60s | Local database should respond quickly |
| Redis | 2s | 5s | 10s | In-memory store; slow = broken |
| External APIs | 10s | 30s | 60s | Unknown latency; bound aggressively |

Use `httpx.Timeout(connect=X, read=Y, write=Z, pool=P)` to configure per-service timeouts. Create named constants (e.g., `OLLAMA_TIMEOUT`, `EXTERNAL_API_TIMEOUT`) and pass them to `httpx.AsyncClient(timeout=OLLAMA_TIMEOUT)`.

**Project Reference**: `apps/backend/src/models/ollama_provider.py` — currently uses default httpx timeout. Should use explicit timeout matching the table above.

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| Retrying 400/404 errors | Client errors will not resolve on retry | Only retry transient errors (429, 5xx, network) |
| No jitter on backoff | Thundering herd when service recovers | Always add full jitter: `random(0, base * 2^n)` |
| Unbounded retries | Infinite loop if service never recovers | Set `max_retries` (typically 3-5) |
| Same timeout on retry | Waiting 300s again after 300s timeout | Reduce timeout on retry attempts |
| Retrying inside a retry | Exponential explosion of attempts | One retry layer per call stack |
| Shared circuit breaker | Unrelated failures trip each other | One circuit breaker per external dependency |
| Silent retry exhaustion | Failures disappear without a trace | Log and/or dead-letter on exhaustion |
| Retrying auth failures | Wastes time; credentials will not change | Classify 401/403 as non-retryable |

---

## Checklist

Before merging retry logic:

- [ ] Only transient errors are retried (429, 502, 503, 504, network errors)
- [ ] Exponential backoff with full jitter implemented
- [ ] `max_retries` bounded (typically 3-5)
- [ ] `max_delay` capped (typically 30-60s)
- [ ] Total timeout configured per service type
- [ ] Circuit breaker wraps external service calls
- [ ] `Retry-After` header respected for 429 responses
- [ ] Exhausted retries logged with structured context
- [ ] No nested retry loops (one layer per call stack)
- [ ] Agent retry loops include failure evidence for self-correction

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Retry Implementation

**Target**: [function / endpoint / service call]
**Strategy**: [exponential backoff / circuit breaker / agent self-correction]
**Max Retries**: [count]
**Backoff**: [base_delay]s × 2^n, max [max_delay]s, jitter: [yes/no]
**Retryable Errors**: [status codes / exception types]
**Timeout**: connect=[X]s, read=[Y]s, total=[Z]s
**On Exhaustion**: [log / dead letter / fallback provider]
```
