---
id: webhook-handler
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Webhook Handler

> Idempotent webhook processing with HMAC signature verification, delivery tracking, and replay for NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `webhook-handler`                                        |
| **Category**   | API & Integration                                        |
| **Complexity** | Medium                                                   |
| **Complements**| `retry-strategy`, `audit-trail`, `queue-worker`          |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies webhook handling patterns for NodeJS-Starter-V1: HMAC-SHA256 signature verification for inbound webhooks, idempotent event processing with Redis-backed deduplication, typed event schema with registry, outbound webhook delivery with retry, Stripe webhook integration, dead letter storage for failed events, and replay capabilities.

---

## When to Apply

### Positive Triggers

- Adding signature verification to the existing webhook routes
- Implementing idempotent webhook processing to prevent duplicate handling
- Building outbound webhook delivery for notifying external systems
- Integrating Stripe, GitHub, or other provider webhooks with signature validation
- Adding webhook event replay and dead letter handling
- Extending the existing `WebhookPayload` model with typed event schemas

### Negative Triggers

- Internal event publishing between services (use `AgentEventPublisher` in `src/state/events.py`)
- Real-time frontend updates (use Supabase Realtime, not webhooks)
- Scheduled polling of external APIs (use `cron-scheduler` skill instead)
- Simple HTTP callbacks without verification requirements

---

## Core Principles

### The Three Laws of Webhooks

1. **Verify Before Processing**: Every inbound webhook must have its signature verified before any business logic executes. An unverified webhook is an untrusted input.
2. **Process Exactly Once**: Webhook providers may deliver the same event multiple times. Use idempotency keys to ensure each event is processed exactly once.
3. **Respond Fast, Process Later**: Return 200 within 5 seconds to acknowledge receipt. Offload heavy processing to a background queue to avoid provider timeouts and retries.

---

## Pattern 1: HMAC Signature Verification (Python)

### Core Implementation

```python
import hashlib
import hmac
import time

from fastapi import HTTPException, Request


class WebhookVerifier:
    """HMAC-SHA256 signature verifier for inbound webhooks."""

    def __init__(self, secret: str, tolerance_seconds: int = 300) -> None:
        self.secret = secret.encode("utf-8")
        self.tolerance = tolerance_seconds

    def verify(self, payload: bytes, signature: str, timestamp: str) -> None:
        """Verify webhook signature and timestamp freshness."""
        # Reject stale webhooks (replay attack prevention)
        ts = int(timestamp)
        if abs(time.time() - ts) > self.tolerance:
            raise HTTPException(
                status_code=403,
                detail="Webhook timestamp too old",
            )

        # Compute expected signature
        signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
        expected = hmac.new(
            self.secret,
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        # Constant-time comparison
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(
                status_code=403,
                detail="Invalid webhook signature",
            )
```

**Project Reference**: `apps/backend/src/api/routes/webhooks.py:28-52` — the existing `handle_webhook` endpoint has no signature verification. Inject `WebhookVerifier` as a FastAPI dependency.

### FastAPI Dependency

```python
from fastapi import Depends

from src.config import get_settings

settings = get_settings()
verifier = WebhookVerifier(secret=settings.webhook_secret)


async def verify_webhook_signature(request: Request) -> bytes:
    """FastAPI dependency that verifies webhook signature."""
    body = await request.body()
    signature = request.headers.get("x-webhook-signature", "")
    timestamp = request.headers.get("x-webhook-timestamp", "")

    if not signature or not timestamp:
        raise HTTPException(status_code=400, detail="Missing signature headers")

    verifier.verify(body, signature, timestamp)
    return body
```

Use as: `@router.post("/webhooks") async def handle_webhook(body: bytes = Depends(verify_webhook_signature))`.

---

## Pattern 2: HMAC Signature Verification (TypeScript)

### Next.js Route Handler

```typescript
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function verifySignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string,
  toleranceSeconds = 300,
): void {
  // Reject stale webhooks
  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) {
    throw new Error("Webhook timestamp too old");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex"),
    )
  ) {
    throw new Error("Invalid webhook signature");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  const secret = process.env.WEBHOOK_SECRET ?? "";

  try {
    verifySignature(body, signature, timestamp, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const event = JSON.parse(body);
  // ... process event
  return NextResponse.json({ received: true });
}
```

**Project Reference**: `apps/web/app/api/webhooks/route.ts:8-15` — currently reads `x-webhook-signature` but has a placeholder comment. Replace with the `verifySignature` function above.

---

## Pattern 3: Idempotent Processing

### Redis-Based Deduplication

```python
from datetime import timedelta

class IdempotencyGuard:
    """Prevents duplicate webhook processing using Redis."""

    def __init__(self, redis, ttl: timedelta = timedelta(hours=24)) -> None:
        self.redis = redis
        self.ttl = int(ttl.total_seconds())

    async def is_duplicate(self, idempotency_key: str) -> bool:
        """Check if this event was already processed."""
        key = f"webhook:processed:{idempotency_key}"
        exists = await self.redis.exists(key)
        return bool(exists)

    async def mark_processed(self, idempotency_key: str) -> None:
        """Mark event as processed with TTL."""
        key = f"webhook:processed:{idempotency_key}"
        await self.redis.setex(key, self.ttl, "1")
```

### Extracting Idempotency Keys

| Provider | Header / Field | Example |
|----------|---------------|---------|
| Generic | `x-idempotency-key` header | `idem_abc123` |
| Stripe | `event.id` in payload | `evt_1234567890` |
| GitHub | `x-github-delivery` header | UUID |
| Custom | `{event_type}:{resource_id}:{timestamp}` | `task.completed:task_42:1708300800` |

**Rule**: If the provider does not supply an idempotency key, generate one from `{event_type}:{resource_id}:{timestamp}`. Never use a random value — the key must be deterministic so duplicate deliveries produce the same key.

**Project Reference**: `docker-compose.yml:23-34` — Redis 7-alpine available on port 6380 (host) / 6379 (container). Use the same Redis instance for idempotency tracking.

---

## Pattern 4: Typed Event Schema

### Pydantic Event Registry

```python
from typing import Any, Literal
from pydantic import BaseModel, Field


class WebhookEvent(BaseModel):
    """Base webhook event with required metadata."""

    id: str
    event_type: str
    timestamp: int
    data: dict[str, Any]
    idempotency_key: str | None = None


class TaskCompletedEvent(WebhookEvent):
    event_type: Literal["task.completed"] = "task.completed"
    data: dict[str, Any] = Field(
        ..., description="Must contain task_id and result"
    )


class TaskFailedEvent(WebhookEvent):
    event_type: Literal["task.failed"] = "task.failed"
    data: dict[str, Any] = Field(
        ..., description="Must contain task_id and error"
    )


EVENT_REGISTRY: dict[str, type[WebhookEvent]] = {
    "task.completed": TaskCompletedEvent,
    "task.failed": TaskFailedEvent,
}


def parse_event(raw: dict[str, Any]) -> WebhookEvent:
    """Parse raw payload into typed event."""
    event_type = raw.get("event_type", raw.get("event", ""))
    model = EVENT_REGISTRY.get(event_type, WebhookEvent)
    return model(**raw)
```

**Project Reference**: `apps/backend/src/api/routes/webhooks.py:14-19` — the existing `WebhookPayload` model has only `event: str` and `data: dict`. Replace with `WebhookEvent` and typed subclasses for each event.

---

## Pattern 5: Complete Inbound Handler

### FastAPI Route with Verification + Idempotency + Queue

```python
from fastapi import APIRouter, Depends

router = APIRouter()


@router.post("/webhooks")
async def handle_webhook(
    body: bytes = Depends(verify_webhook_signature),
) -> dict:
    """Handle inbound webhooks with full verification pipeline."""
    import json
    from arq import create_pool

    raw = json.loads(body)
    event = parse_event(raw)

    # Idempotency check
    guard = IdempotencyGuard(redis=await get_redis())
    idem_key = event.idempotency_key or f"{event.event_type}:{event.id}"

    if await guard.is_duplicate(idem_key):
        return {"received": True, "status": "already_processed"}

    # Enqueue for background processing (respond fast)
    pool = await create_pool(REDIS_SETTINGS)
    await pool.enqueue_job(
        "process_webhook_event",
        event.model_dump(),
        _queue_name="starter:webhooks",
    )

    # Mark as processed
    await guard.mark_processed(idem_key)

    return {"received": True, "event_type": event.event_type}
```

**Complements**: `queue-worker` skill — webhook events are enqueued to a dedicated `starter:webhooks` queue. The worker processes events asynchronously, ensuring the webhook endpoint responds within 5 seconds. `retry-strategy` skill — the worker retries failed event processing with exponential backoff.

---

## Pattern 6: Outbound Webhook Delivery

### Sending Webhooks with Signature Signing

```python
import hashlib
import hmac
import time

import httpx


class WebhookSender:
    """Send signed webhooks to external endpoints."""

    def __init__(self, signing_secret: str) -> None:
        self.secret = signing_secret.encode("utf-8")

    def _sign(self, payload: str, timestamp: int) -> str:
        signed = f"{timestamp}.{payload}"
        return hmac.new(
            self.secret, signed.encode("utf-8"), hashlib.sha256
        ).hexdigest()

    async def deliver(
        self,
        url: str,
        event_type: str,
        data: dict,
        timeout: float = 10.0,
    ) -> dict:
        """Deliver a signed webhook to the target URL."""
        import json

        timestamp = int(time.time())
        payload = json.dumps({
            "event_type": event_type,
            "data": data,
            "timestamp": timestamp,
        })
        signature = self._sign(payload, timestamp)

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                url,
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-webhook-signature": signature,
                    "x-webhook-timestamp": str(timestamp),
                },
            )

        return {"status_code": response.status_code, "delivered": response.status_code < 400}
```

For outbound delivery with retry, wrap `sender.deliver()` with `retry_async()` from the `retry-strategy` skill. Retryable status codes: 429, 502, 503, 504. Max retries: 5. After exhaustion, write to dead letter (see Pattern 7).

---

## Pattern 7: Stripe Webhook Integration

### Leveraging Existing Infrastructure

```typescript
import { constructWebhookEvent } from "@/lib/api/stripe";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutComplete(event.data.object);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object);
      break;
  }

  return NextResponse.json({ received: true });
}
```

**Project Reference**: `apps/web/lib/api/stripe.ts:184-193` — `constructWebhookEvent()` already implements Stripe signature verification using `STRIPE_WEBHOOK_SECRET`. Use this directly for Stripe-specific webhooks instead of the generic `verifySignature`.

---

## Pattern 8: Dead Letter and Replay

### Failed Event Storage

```python
async def store_dead_letter(
    redis, event: WebhookEvent, error: str
) -> None:
    """Store failed webhook event for later replay."""
    import json
    from datetime import datetime

    entry = {
        "event": event.model_dump(),
        "error": error,
        "failed_at": datetime.utcnow().isoformat(),
        "retry_count": 0,
    }
    await redis.rpush("webhook:dead-letter", json.dumps(entry))
```

### Replay Endpoint

Implement `POST /api/webhooks/replay` (admin-only) that pops entries from `webhook:dead-letter` and re-enqueues them to `starter:webhooks`. Accept optional filters: `event_type`, `from_date`, `limit`. Reset the idempotency guard for replayed events by deleting the `webhook:processed:{key}` Redis key before re-enqueueing.

**Complements**: `audit-trail` skill — log every dead-letter event and replay action as audit events for compliance tracking.

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| No signature verification | Anyone can send fake webhooks | HMAC-SHA256 with constant-time comparison |
| Processing inline (no queue) | Provider times out → duplicate delivery | Enqueue, respond 200, process async |
| No idempotency checking | Duplicate events processed twice | Redis-backed idempotency with TTL |
| Using `==` for signature comparison | Timing attack vulnerability | Use `hmac.compare_digest` or `crypto.timingSafeEqual` |
| Random idempotency keys | Duplicates not detected | Deterministic keys from event_type + id |
| No timestamp validation | Replay attacks with old signatures | Reject events older than 5 minutes |
| Returning 500 on processing errors | Provider retries indefinitely | Return 200 on receipt, handle errors internally |
| Shared webhook secret across providers | One compromise exposes all | Separate secret per provider |

---

## Checklist

Before merging webhook-handler changes:

- [ ] HMAC-SHA256 signature verification on all inbound webhook routes
- [ ] Constant-time comparison (`hmac.compare_digest` / `timingSafeEqual`)
- [ ] Timestamp tolerance check (default 300s) for replay prevention
- [ ] Idempotency guard with Redis TTL (24h default)
- [ ] Events enqueued to background queue (respond within 5s)
- [ ] Typed event schema with registry for known event types
- [ ] Outbound webhooks signed with provider-specific secrets
- [ ] Dead letter queue for failed events with replay capability
- [ ] Stripe webhooks use existing `constructWebhookEvent()`
- [ ] `WEBHOOK_SECRET` configured in `.env` (never hardcoded)

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Webhook Handler Implementation

**Direction**: [inbound / outbound / both]
**Signature**: HMAC-SHA256 with [provider-specific / generic] secret
**Idempotency**: Redis-backed, TTL=[hours], key=[strategy]
**Processing**: [inline / background queue]
**Queue**: [starter:webhooks / custom name]
**Dead Letter**: [enabled / disabled], replay via [endpoint / manual]
**Providers**: [Stripe / GitHub / generic / custom]
**Timeout Tolerance**: [seconds] for timestamp validation
```
