---
id: rate-limiter
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Rate Limiter

> Token bucket, sliding window, and tiered rate limiting patterns for FastAPI and Next.js in NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `rate-limiter`                                           |
| **Category**   | API & Integration                                        |
| **Complexity** | Medium                                                   |
| **Complements**| `api-contract`, `retry-strategy`, `cache-strategy`       |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies rate limiting patterns for NodeJS-Starter-V1: token bucket and sliding window algorithms, Redis-backed distributed limiting, per-endpoint configuration, user-tier-based quotas, standard rate limit response headers, client-side Retry-After handling, Next.js middleware limiting, and upgrading the existing in-memory `RateLimitMiddleware` to production-grade.

---

## When to Apply

### Positive Triggers

- Adding rate limiting to API endpoints or Next.js routes
- Upgrading the existing `RateLimitMiddleware` from in-memory to Redis-backed
- Implementing per-endpoint or per-user rate limit configuration
- Adding standard rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)
- Building tiered rate limits based on user subscription or role
- Handling 429 responses with client-side Retry-After logic

### Negative Triggers

- DDoS protection at the infrastructure level (use Cloudflare/WAF, not application-level)
- Circuit breaker patterns for outbound calls (use `retry-strategy` skill instead)
- Request queuing and backpressure (use `queue-worker` skill instead)
- API key management and authentication (use auth middleware directly)

---

## Core Principles

### The Three Laws of Rate Limiting

1. **Limit Close to the Edge**: Apply rate limits as early as possible in the request lifecycle. Middleware before route handlers, edge before origin.
2. **Inform, Don't Surprise**: Every rate-limited response must include `Retry-After` and `X-RateLimit-*` headers so clients can self-regulate.
3. **Degrade Gracefully**: When limits are hit, return 429 with a clear message and reset time. Never drop requests silently or return 500.

---

## Pattern 1: Token Bucket Algorithm (Python)

### Core Implementation

```python
import time
from dataclasses import dataclass, field


@dataclass
class TokenBucket:
    """Token bucket rate limiter with configurable capacity and refill."""

    capacity: int
    refill_rate: float  # tokens per second
    tokens: float = field(init=False)
    last_refill: float = field(init=False)

    def __post_init__(self) -> None:
        self.tokens = float(self.capacity)
        self.last_refill = time.monotonic()

    def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens. Returns True if allowed."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(
            self.capacity,
            self.tokens + elapsed * self.refill_rate,
        )
        self.last_refill = now

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    @property
    def retry_after(self) -> float:
        """Seconds until at least 1 token is available."""
        if self.tokens >= 1:
            return 0.0
        deficit = 1 - self.tokens
        return deficit / self.refill_rate
```

**Why token bucket?** The existing `RateLimitMiddleware` uses a simple sliding window that allows bursts at window boundaries. Token bucket smooths traffic by refilling at a constant rate while permitting short bursts up to bucket capacity.

**Project Reference**: `apps/backend/src/api/middleware/rate_limit.py` — current implementation uses an in-memory dict with 60 req/min fixed window. Replace the inner logic with `TokenBucket` for smoother rate control.

---

## Pattern 2: Redis-Backed Sliding Window (Python)

### Distributed Rate Limiting

```python
import time

import redis.asyncio as redis


class RedisSlidingWindow:
    """Sliding window counter using Redis sorted sets."""

    def __init__(
        self,
        redis_client: redis.Redis,
        limit: int = 60,
        window_seconds: int = 60,
    ) -> None:
        self.redis = redis_client
        self.limit = limit
        self.window = window_seconds

    async def is_allowed(self, key: str) -> dict:
        """Check if request is within rate limit."""
        now = time.time()
        window_start = now - self.window
        pipe_key = f"rl:{key}"

        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(pipe_key, 0, window_start)
            pipe.zadd(pipe_key, {str(now): now})
            pipe.zcard(pipe_key)
            pipe.expire(pipe_key, self.window)
            results = await pipe.execute()

        current = results[2]
        return {
            "allowed": current <= self.limit,
            "limit": self.limit,
            "remaining": max(0, self.limit - current),
            "reset": int(now + self.window),
        }
```

**Project Reference**: `docker-compose.yml:23-34` — Redis 7-alpine on port 6380 (host) / 6379 (container). Use the same instance for rate limiting. This replaces the in-memory dict in `rate_limit.py` and survives server restarts.

---

## Pattern 3: Upgraded FastAPI Middleware

### Production-Grade Replacement

```python
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware with Redis backend and standard headers."""

    SKIP_PATHS = {"/health", "/ready", "/api/health", "/api/ready"}

    def __init__(self, app, redis_url: str = "redis://localhost:6379") -> None:
        super().__init__(app)
        import redis.asyncio as redis_lib
        self.redis = redis_lib.from_url(redis_url)
        self.limiters: dict[str, RedisSlidingWindow] = {}

    def _get_limiter(self, path: str) -> RedisSlidingWindow:
        """Get rate limiter for endpoint (cached)."""
        config = ENDPOINT_LIMITS.get(path, DEFAULT_LIMIT)
        key = f"{config['limit']}:{config['window']}"
        if key not in self.limiters:
            self.limiters[key] = RedisSlidingWindow(
                self.redis, config["limit"], config["window"],
            )
        return self.limiters[key]

    def _get_client_id(self, request: Request) -> str:
        user_id = request.headers.get("x-user-id")
        if user_id:
            return f"user:{user_id}"
        forwarded = request.headers.get("x-forwarded-for")
        ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
        return f"ip:{ip}"

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        limiter = self._get_limiter(request.url.path)
        client_id = self._get_client_id(request)
        result = await limiter.is_allowed(f"{client_id}:{request.url.path}")

        if not result["allowed"]:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers=self._headers(result),
            )

        response = await call_next(request)
        for k, v in self._headers(result).items():
            response.headers[k] = v
        return response

    def _headers(self, result: dict) -> dict[str, str]:
        return {
            "X-RateLimit-Limit": str(result["limit"]),
            "X-RateLimit-Remaining": str(result["remaining"]),
            "X-RateLimit-Reset": str(result["reset"]),
            "Retry-After": str(result["reset"] - __import__("time").time()),
        }
```

**Replaces**: `apps/backend/src/api/middleware/rate_limit.py:1-80` — drop-in replacement. The existing 60 req/min default is preserved but now backed by Redis and augmented with standard headers.

---

## Pattern 4: Per-Endpoint Configuration

### Endpoint Limit Registry

```python
from typing import TypedDict


class LimitConfig(TypedDict):
    limit: int
    window: int  # seconds


DEFAULT_LIMIT: LimitConfig = {"limit": 60, "window": 60}

ENDPOINT_LIMITS: dict[str, LimitConfig] = {
    # Auth endpoints — stricter to prevent brute force
    "/api/auth/login": {"limit": 5, "window": 60},
    "/api/auth/register": {"limit": 3, "window": 300},
    # AI generation — expensive, tight limits
    "/api/agents/run": {"limit": 10, "window": 60},
    "/api/generate": {"limit": 10, "window": 60},
    # Webhooks — generous, providers retry on 429
    "/api/webhooks": {"limit": 200, "window": 60},
    # Search — moderate
    "/api/search": {"limit": 30, "window": 60},
    "/api/documents": {"limit": 30, "window": 60},
}
```

**Rule**: Auth endpoints must be the most restrictive (5 req/min for login, 3/5 min for registration). AI generation endpoints are expensive and should be capped at 10/min. Webhook endpoints should be generous since providers retry on 429.

---

## Pattern 5: User-Tier Rate Limits

### Tiered Quota System

```python
from enum import Enum


class UserTier(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"
    INTERNAL = "internal"


TIER_MULTIPLIERS: dict[UserTier, float] = {
    UserTier.FREE: 1.0,
    UserTier.PRO: 5.0,
    UserTier.ENTERPRISE: 20.0,
    UserTier.INTERNAL: 100.0,  # Effectively unlimited
}


def get_tier_limit(base_limit: int, tier: UserTier) -> int:
    """Apply tier multiplier to base rate limit."""
    return int(base_limit * TIER_MULTIPLIERS[tier])
```

To resolve user tier, read from the JWT claims: `request.state.user.tier` (after `AuthMiddleware` runs). If no user is authenticated, default to `UserTier.FREE`.

**Project Reference**: `apps/backend/src/api/main.py:38-45` — `AuthMiddleware` runs before `RateLimitMiddleware`. The rate limiter can access `request.state.user` for tier information.

---

## Pattern 6: Standard Response Headers

### Header Specification

Every response from a rate-limited endpoint must include these headers:

| Header | Value | Example |
|--------|-------|---------|
| `X-RateLimit-Limit` | Maximum requests in current window | `60` |
| `X-RateLimit-Remaining` | Requests remaining in current window | `42` |
| `X-RateLimit-Reset` | Unix timestamp when window resets | `1708300860` |
| `Retry-After` | Seconds until next request is allowed (429 only) | `18` |

### 429 Response Body

```json
{
  "detail": "Rate limit exceeded",
  "limit": 60,
  "remaining": 0,
  "reset": 1708300860,
  "retry_after": 18
}
```

**Project Reference**: `apps/backend/src/api/middleware/rate_limit.py:60-66` — currently returns only `Retry-After: 60` (hardcoded). Replace with dynamic headers from the sliding window result.

---

## Pattern 7: Client-Side Rate Limit Handling (TypeScript)

### Retry-After Aware Fetch Wrapper

```typescript
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const limit = headers.get("x-ratelimit-limit");
  if (!limit) return null;
  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(headers.get("x-ratelimit-remaining") ?? "0", 10),
    reset: parseInt(headers.get("x-ratelimit-reset") ?? "0", 10),
  };
}

async function fetchWithRateLimit(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status !== 429) return response;

    const retryAfter = response.headers.get("retry-after");
    const waitMs = retryAfter
      ? parseFloat(retryAfter) * 1000
      : Math.min(1000 * 2 ** attempt, 30_000);

    if (attempt === maxRetries) return response;
    await new Promise((r) => setTimeout(r, waitMs));
  }

  throw new Error("Rate limit retries exhausted");
}
```

**Project Reference**: `apps/web/lib/api/client.ts` — the existing API client uses a plain `fetch` wrapper. Wrap with `fetchWithRateLimit` to automatically handle 429 responses. Also reference `apps/web/lib/anthropic/client.ts:185-187` — `AnthropicAPIError.isRateLimited()` detects 429 but has no retry logic; apply the same pattern.

---

## Pattern 8: Next.js Middleware Rate Limiting

### Edge-Level Rate Limiting

```typescript
import { NextRequest, NextResponse } from "next/server";

const rateLimitMap = new Map<
  string,
  { count: number; windowStart: number }
>();

const LIMITS: Record<string, { limit: number; window: number }> = {
  "/api/generate-image": { limit: 10, window: 60_000 },
  "/api/webhooks": { limit: 200, window: 60_000 },
  default: { limit: 60, window: 60_000 },
};

function getConfig(pathname: string) {
  return LIMITS[pathname] ?? LIMITS.default;
}

export function rateLimit(request: NextRequest): NextResponse | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const config = getConfig(request.nextUrl.pathname);
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > config.window) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return null; // Allowed
  }

  entry.count++;
  if (entry.count > config.limit) {
    const reset = Math.ceil((entry.windowStart + config.window) / 1000);
    return NextResponse.json(
      { detail: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.ceil((entry.windowStart + config.window - now) / 1000)),
        },
      },
    );
  }

  return null; // Allowed
}
```

**Project Reference**: `apps/web/app/api/generate-image/route.ts:11-23` — has an inline rate limiter with 10 req/min. Extract into the shared `rateLimit()` function above and call from `middleware.ts`. This eliminates duplicated rate limit logic in individual route handlers.

---

## Pattern 9: Upgrading Existing Middleware

### Migration Path

The existing `apps/backend/src/api/middleware/rate_limit.py` uses an in-memory dict, 60 req/min hardcoded, IP-only identification, and only a static `Retry-After: 60` header. Upgrade by: (1) replacing the class body with Pattern 3 (Redis-backed), (2) adding `ENDPOINT_LIMITS` from Pattern 4, (3) adding `X-RateLimit-*` headers from Pattern 6, (4) uncommenting `TestRateLimiting` in `tests/security/test_api_security.py:351-400`.

**Complements**: `retry-strategy` skill — when the rate limiter returns 429, upstream callers should use exponential backoff from `retry_async()`. `cache-strategy` skill — cache rate limit state in Redis with the same connection pool.

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| In-memory only rate limiting | Resets on restart, no cross-instance sharing | Redis-backed sliding window |
| Hardcoded limits for all endpoints | Auth and AI endpoints need different limits | Per-endpoint `ENDPOINT_LIMITS` registry |
| No response headers | Clients cannot self-regulate | Always include `X-RateLimit-*` headers |
| Fixed window at boundaries | Allows 2x burst at window edge | Sliding window or token bucket |
| Rate limiting after auth middleware | Brute force attacks bypass limits | Rate limit before authentication |
| `time.time()` for token refill | Wall clock jumps on NTP sync | Use `time.monotonic()` for intervals |
| Silent request dropping | Client retries blindly, worsening load | Return 429 with `Retry-After` |
| Same limits for all users | Paying customers throttled like free users | Tier-based multipliers |

---

## Checklist

Before merging rate-limiter changes:

- [ ] Redis-backed sliding window replaces in-memory dict
- [ ] Per-endpoint `ENDPOINT_LIMITS` configuration defined
- [ ] Auth endpoints have stricter limits (5 req/min login, 3/5 min register)
- [ ] `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on every response
- [ ] `Retry-After` header on 429 responses with dynamic value
- [ ] Client-side `fetchWithRateLimit` wrapper handles 429 with backoff
- [ ] Next.js middleware rate limiting extracted from inline route handlers
- [ ] User tier multipliers applied when JWT claims are available
- [ ] Health and readiness endpoints excluded from rate limiting
- [ ] `TestRateLimiting` tests uncommented and passing

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Rate Limiter Implementation

**Algorithm**: [token bucket / sliding window / fixed window]
**Backend**: [in-memory / Redis-backed]
**Scope**: [global / per-endpoint / per-user]
**Tiers**: [enabled / disabled], multipliers=[free:1x, pro:5x, enterprise:20x]
**Headers**: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
**Client Handling**: [fetchWithRateLimit / manual / none]
**Migration**: [upgrade existing / new middleware]
```
