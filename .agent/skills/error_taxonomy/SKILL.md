---
id: error-taxonomy
name: error-taxonomy
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


# Error Taxonomy - Structured Error Classification

Unified error classification system ensuring every error in the stack has a code, category, severity, and user-facing message. Bridges the FastAPI `ErrorResponse` model with the Next.js `ApiClientError` class.

## Description

Provides a structured error code taxonomy following the `DOMAIN_CATEGORY_SPECIFIC` format. Maps every runtime error to an HTTP status code, severity level, and user-facing message, ensuring consistent error handling between the FastAPI backend and Next.js frontend.

## When to Apply

### Positive Triggers

- Creating or modifying API error responses
- Adding new `HTTPException` raises in FastAPI routes
- Implementing frontend error handling or display
- Designing error boundaries for React components
- Reviewing error consistency across backend and frontend
- User mentions: "error handling", "error codes", "error messages", "error response"

### Negative Triggers

- Implementing retry/resilience logic (use `retry-strategy` instead)
- Designing React error boundary components (use `error-boundary` instead)
- The error is a build/lint/type error (not runtime error handling)

## Core Directives

### Error Code Format

All error codes follow the pattern: `{DOMAIN}_{CATEGORY}_{SPECIFIC}`

```
AUTH_VALIDATION_INVALID_TOKEN
AGENT_RUNTIME_TIMEOUT
DATA_VALIDATION_MISSING_FIELD
```

### Domains

| Domain | Prefix | Scope |
|--------|--------|-------|
| Authentication | `AUTH_` | Login, JWT, permissions |
| Agent | `AGENT_` | AI agent execution, LLM providers |
| Data | `DATA_` | Validation, transformation, storage |
| Workflow | `WORKFLOW_` | Pipeline, state machine, scheduling |
| System | `SYS_` | Infrastructure, database, external services |

### Categories

| Category | Suffix | Meaning |
|----------|--------|---------|
| Validation | `_VALIDATION_` | Input/schema validation failure |
| Runtime | `_RUNTIME_` | Unexpected runtime failure |
| Permission | `_PERMISSION_` | Authorisation or access denied |
| NotFound | `_NOTFOUND_` | Resource does not exist |
| Conflict | `_CONFLICT_` | State conflict or duplicate |
| RateLimit | `_RATELIMIT_` | Throttled request |
| External | `_EXTERNAL_` | Third-party service failure |

### Severity Levels

| Level | HTTP Range | Action |
|-------|-----------|--------|
| **Fatal** | 500-599 | Log + alert + escalate |
| **Error** | 400-499 | Log + return user message |
| **Warning** | 200 with warning header | Log only |

---

## Backend Pattern (FastAPI)

### Standard Error Response Model

The project already has `ErrorResponse` in `apps/backend/src/models/contractor.py`. Extend this as the canonical model:

```python
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ErrorSeverity(str, Enum):
    FATAL = "fatal"
    ERROR = "error"
    WARNING = "warning"


class ErrorResponse(BaseModel):
    """Canonical error response for all API endpoints."""

    detail: str = Field(..., description="Human-readable error message")
    error_code: str = Field(..., description="Machine-readable error code")
    severity: ErrorSeverity = Field(
        default=ErrorSeverity.ERROR,
        description="Error severity level"
    )
    field: Optional[str] = Field(
        None,
        description="Specific field that caused the error (validation)"
    )
```

### Raising Errors

```python
# GOOD: Structured error with code
raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=ErrorResponse(
        detail="Token has expired. Please log in again.",
        error_code="AUTH_VALIDATION_EXPIRED_TOKEN",
    ).model_dump(),
)

# BAD: Unstructured string
raise HTTPException(
    status_code=401,
    detail="Invalid token",
)
```

### Validation Error Handler

Register a global handler to convert Pydantic `ValidationError` into structured responses:

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError


async def validation_exception_handler(
    request: Request,
    exc: ValidationError
) -> JSONResponse:
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append({
            "detail": error["msg"],
            "error_code": f"DATA_VALIDATION_{error['type'].upper()}",
            "field": field,
        })
    return JSONResponse(
        status_code=422,
        content={"errors": errors},
    )
```

---

## Frontend Pattern (Next.js)

### Error Interface

The project has `ApiError` and `ApiClientError` in `apps/web/lib/api/client.ts`. Extend to include severity:

```typescript
export interface ApiError {
  detail: string;
  error_code: string;
  severity?: 'fatal' | 'error' | 'warning';
  field?: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorCode: string,
    public severity: 'fatal' | 'error' | 'warning' = 'error',
    public field?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  get isAuth(): boolean {
    return this.errorCode.startsWith('AUTH_');
  }

  get isValidation(): boolean {
    return this.errorCode.includes('_VALIDATION_');
  }

  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}
```

### User-Facing Message Map

Map technical error codes to user-friendly messages:

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  AUTH_VALIDATION_INVALID_TOKEN: 'Your session has expired. Please sign in again.',
  AUTH_VALIDATION_EXPIRED_TOKEN: 'Your session has expired. Please sign in again.',
  AUTH_PERMISSION_DENIED: 'You do not have permission to perform this action.',
  AUTH_PERMISSION_INACTIVE: 'Your account has been deactivated.',
  DATA_VALIDATION_MISSING_FIELD: 'Please fill in all required fields.',
  AGENT_RUNTIME_TIMEOUT: 'The AI agent took too long to respond. Please try again.',
  AGENT_EXTERNAL_PROVIDER_DOWN: 'The AI service is temporarily unavailable.',
  SYS_EXTERNAL_DATABASE: 'A database error occurred. Please try again later.',
  SYS_RATELIMIT_EXCEEDED: 'Too many requests. Please wait a moment.',
};

export function getUserMessage(error: ApiClientError): string {
  return ERROR_MESSAGES[error.errorCode] ?? error.message;
}
```

---

## Error Code Registry

### Authentication Errors

| Code | HTTP | Message |
|------|------|---------|
| `AUTH_VALIDATION_INVALID_TOKEN` | 401 | Invalid authentication token |
| `AUTH_VALIDATION_EXPIRED_TOKEN` | 401 | Token has expired |
| `AUTH_VALIDATION_MISSING_TOKEN` | 401 | No authentication token provided |
| `AUTH_PERMISSION_DENIED` | 403 | Insufficient permissions |
| `AUTH_PERMISSION_INACTIVE` | 403 | Account is inactive |
| `AUTH_PERMISSION_NOT_ADMIN` | 403 | Admin access required |
| `AUTH_NOTFOUND_USER` | 404 | User not found |

### Agent Errors

| Code | HTTP | Message |
|------|------|---------|
| `AGENT_RUNTIME_TIMEOUT` | 504 | Agent execution timed out |
| `AGENT_RUNTIME_FAILED` | 500 | Agent execution failed |
| `AGENT_EXTERNAL_PROVIDER_DOWN` | 503 | AI provider unavailable |
| `AGENT_VALIDATION_INVALID_INPUT` | 422 | Invalid agent input |
| `AGENT_NOTFOUND_TYPE` | 404 | Unknown agent type |

### Data Errors

| Code | HTTP | Message |
|------|------|---------|
| `DATA_VALIDATION_MISSING_FIELD` | 422 | Required field missing |
| `DATA_VALIDATION_INVALID_FORMAT` | 422 | Invalid data format |
| `DATA_NOTFOUND_DOCUMENT` | 404 | Document not found |
| `DATA_NOTFOUND_CONTRACTOR` | 404 | Contractor not found |
| `DATA_CONFLICT_DUPLICATE` | 409 | Resource already exists |

### System Errors

| Code | HTTP | Message |
|------|------|---------|
| `SYS_EXTERNAL_DATABASE` | 500 | Database connection error |
| `SYS_EXTERNAL_REDIS` | 500 | Cache service error |
| `SYS_RATELIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `SYS_RUNTIME_INTERNAL` | 500 | Internal server error |

---

## Adding New Error Codes

When adding a new error code:

1. **Choose domain** from the Domains table
2. **Choose category** from the Categories table
3. **Add specific identifier** describing the failure
4. **Register** in the Error Code Registry table above
5. **Map** a user-facing message in the frontend `ERROR_MESSAGES`
6. **Use** the `ErrorResponse` model when raising `HTTPException`

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|------------------|
| Unstructured error strings (`raise HTTPException(detail="bad input")`) | No machine-readable code, inconsistent frontend handling | Use `ErrorResponse` model with `error_code` field |
| Inconsistent error codes (`AUTH_BAD_TOKEN` vs `AUTH_VALIDATION_INVALID_TOKEN`) | Breaks the `DOMAIN_CATEGORY_SPECIFIC` convention | Follow the three-part code format defined in this skill |
| Missing user-facing messages | Frontend falls back to raw technical error text | Map every error code in the `ERROR_MESSAGES` record |
| Error codes not matching domain prefix | Agent errors using `SYS_` prefix or vice versa | Choose domain from the Domains table before naming |

## Checklist

- [ ] Error codes follow `DOMAIN_CATEGORY_SPECIFIC` format
- [ ] User-facing messages defined in frontend `ERROR_MESSAGES` map
- [ ] HTTP status codes mapped correctly per severity table
- [ ] Frontend `ApiClientError` handling matches backend `ErrorResponse` contract
- [ ] New error codes registered in the Error Code Registry section

## Response Format

```
[AGENT_ACTIVATED]: Error Taxonomy
[PHASE]: {Classification | Implementation | Review}
[STATUS]: {in_progress | complete}

{error analysis or implementation guidance}

[NEXT_ACTION]: {what to do next}
```

## Integration Points

### Council of Logic (Shannon Check)

- Error messages must be concise — no verbose stack traces in user-facing output
- Error codes encode maximum information in minimum characters
- One error code per failure mode, no duplicates

### API Contract

- Every API endpoint must document its possible error codes
- Error codes form part of the API contract between backend and frontend
- Breaking error code changes require a version bump

## Australian Localisation (en-AU)

- **Date Format**: DD/MM/YYYY
- **Currency**: AUD ($)
- **Spelling**: colour, behaviour, optimisation, analyse, centre, authorisation
- **Tone**: Direct, professional — error messages should be helpful, not apologetic
