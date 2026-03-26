---
id: data-validation
name: data-validation
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


# Data Validation - Input Sanitisation & Schema Patterns

Validation patterns ensuring all data entering the system is validated at boundaries: user input via Zod (frontend), API requests via Pydantic (backend). No unvalidated data crosses a trust boundary.

## Description

Defines Zod and Pydantic validation patterns for all data entering the system at trust boundaries. Covers form validation, API request schemas, type-safe contracts, Australian-specific validators (ABN, phone, postcode), and schema composition strategies.

## When to Apply

### Positive Triggers

- Creating or modifying form inputs with user data
- Defining API request/response schemas (Pydantic models)
- Adding Zod schemas for frontend validation
- Reviewing code for missing input validation
- Building new API endpoints that accept POST/PUT/PATCH data
- User mentions: "validation", "Zod", "Pydantic", "schema", "sanitise", "input"

### Negative Triggers

- Implementing authentication logic (use auth patterns directly)
- Designing error response formats (use `error-taxonomy` instead)
- Working on database model definitions (that is ORM schema, not input validation)

## Core Directives

### Validate at Boundaries, Trust Internally

```
[User Input] --Zod--> [Frontend] --fetch--> [API] --Pydantic--> [Service Layer]
     ^                                         ^
     |                                         |
  VALIDATE HERE                          VALIDATE HERE
```

- **Frontend boundary**: Every form field validated with Zod before submission
- **API boundary**: Every request body validated with Pydantic before processing
- **Internal code**: Trust validated data — no redundant re-validation inside services

### Naming Conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| Frontend Zod schema | `camelCase` + `Schema` suffix | `loginFormSchema` |
| Frontend inferred type | `PascalCase` via `z.infer` | `type LoginForm = z.infer<typeof loginFormSchema>` |
| Backend Pydantic model | `PascalCase` + purpose suffix | `DocumentCreateRequest` |
| Shared contract | Same field names both sides | `email`, `password`, `title` |

---

## Frontend Patterns (Zod + react-hook-form)

### Basic Form Schema

The project already uses this pattern in `apps/web/components/auth/login-form.tsx`:

```typescript
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

// 1. Define schema
const loginFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// 2. Infer type (never define manually)
type LoginForm = z.infer<typeof loginFormSchema>;

// 3. Use with react-hook-form
const form = useForm<LoginForm>({
  resolver: zodResolver(loginFormSchema),
  defaultValues: { email: '', password: '' },
});
```

### Schema Composition

Build complex schemas from reusable parts:

```typescript
// Base schemas (reusable)
const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const abnSchema = z.string().regex(/^\d{11}$/, 'ABN must be 11 digits');

// Composed schemas
const registerFormSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
```

### API Request Validation

Validate data before sending to the backend:

```typescript
const documentCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  content: z.string().min(1, 'Content is required'),
  metadata: z.record(z.unknown()).optional(),
});

async function createDocument(input: unknown): Promise<Document> {
  // Validate before sending — fail fast on the client
  const validated = documentCreateSchema.parse(input);
  return apiClient.post('/api/documents', validated);
}
```

### Australian-Specific Validators

```typescript
// Australian Business Number (ABN) with checksum
const abnSchema = z.string().refine(
  (val) => {
    if (!/^\d{11}$/.test(val)) return false;
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const digits = val.split('').map(Number);
    digits[0] -= 1;
    const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
    return sum % 89 === 0;
  },
  { message: 'Invalid ABN' }
);

// Australian phone number
const auPhoneSchema = z.string().regex(
  /^(\+61|0)[2-478]\d{8}$/,
  'Please enter a valid Australian phone number'
);

// Australian postcode
const postcodeSchema = z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits');

// Date in DD/MM/YYYY format
const auDateSchema = z.string().regex(
  /^\d{2}\/\d{2}\/\d{4}$/,
  'Date must be in DD/MM/YYYY format'
);
```

---

## Backend Patterns (Pydantic)

### Request Model Convention

The project defines request models in route files or `apps/backend/src/api/schemas/`:

```python
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class DocumentCreateRequest(BaseModel):
    """Validated input for document creation."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Document title"
    )
    content: str = Field(
        ...,
        min_length=1,
        description="Document content"
    )
    metadata: Optional[dict] = Field(
        None,
        description="Additional metadata"
    )

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()
```

### Constrained Types

Use Pydantic's built-in constraints instead of custom validators where possible:

```python
from pydantic import BaseModel, Field, EmailStr
from typing import Annotated


# Constrained types (prefer over custom validators)
PositiveInt = Annotated[int, Field(gt=0)]
PageSize = Annotated[int, Field(ge=1, le=100)]
ShortString = Annotated[str, Field(min_length=1, max_length=255)]


class PaginationParams(BaseModel):
    """Reusable pagination parameters."""

    page: PositiveInt = 1
    page_size: PageSize = 20


class SearchRequest(BaseModel):
    """Validated search input."""

    query: ShortString
    pagination: PaginationParams = PaginationParams()
```

### Route Integration

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/", status_code=201)
async def create_document(
    request: DocumentCreateRequest,  # Pydantic validates automatically
    user: User = Depends(get_current_user),
) -> DocumentResponse:
    """Create a new document. Input is validated by Pydantic."""
    # request is already validated — trust it here
    return await document_service.create(request, user)
```

### Schema Location Convention

| Schema Type | Location | When to Use |
|------------|---------|-------------|
| Route-specific | Inline in route file | Simple schemas used by one endpoint |
| Shared across routes | `apps/backend/src/api/schemas/` | Schemas used by multiple endpoints |
| Domain models | `apps/backend/src/models/` | Core business models (not request schemas) |

---

## Validation Checklist

When adding a new feature, verify:

- [ ] Every form has a Zod schema with `zodResolver`
- [ ] Form types are inferred via `z.infer`, not manually defined
- [ ] Every POST/PUT/PATCH endpoint has a Pydantic request model
- [ ] Error messages are user-friendly, not technical
- [ ] Australian formats validated where applicable (ABN, phone, postcode, date)
- [ ] Schema field names match between frontend Zod and backend Pydantic

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|------------------|
| Validation logic inside route handlers | Mixes concerns, hard to reuse or test | Define Zod/Pydantic schemas separately and reference them |
| No error messages on validation failure | Users see raw Pydantic/Zod errors | Provide human-readable messages in en-AU on every field |
| Type coercion without validation (`Number(input)`) | `NaN` and unexpected values slip through | Use Zod `.coerce.number()` or Pydantic `field_validator` |
| Optional fields without defaults | Downstream code must null-check everywhere | Set sensible defaults via `Field(default=...)` or `.default()` |
| Manually defining types instead of inferring | Types drift out of sync with schemas | Use `z.infer<typeof schema>` and Pydantic model exports |

## Checklist

- [ ] Zod schemas defined for all frontend form and API inputs
- [ ] Pydantic models defined for all backend request bodies
- [ ] Error messages written in en-AU (e.g., "Please enter a valid email address")
- [ ] Validation occurs at system boundaries (frontend forms, API entry points)
- [ ] Schema field names match between frontend Zod and backend Pydantic

## Response Format

```
[AGENT_ACTIVATED]: Data Validation
[PHASE]: {Schema Design | Implementation | Review}
[STATUS]: {in_progress | complete}

{validation analysis or schema output}

[NEXT_ACTION]: {what to do next}
```

## Integration Points

### Error Taxonomy

Validation failures should use `DATA_VALIDATION_*` error codes from the `error-taxonomy` skill:

```python
# Backend: structured validation error
raise HTTPException(
    status_code=422,
    detail={
        "detail": "Email format is invalid",
        "error_code": "DATA_VALIDATION_INVALID_FORMAT",
        "field": "email",
    },
)
```

### Council of Logic (Shannon Check)

- Schemas should be minimal — only validate what the endpoint actually uses
- Avoid duplicating the same schema across files — compose from base schemas
- Prefer built-in constraints (`min_length`, `gt`) over custom validators

### API Contract

When `api-contract` skill is installed, Zod and Pydantic schemas should mirror each other to form a typed contract between frontend and backend.

## Australian Localisation (en-AU)

- **Date Format**: DD/MM/YYYY (not MM/DD/YYYY)
- **Phone**: `+61` or `0X XXXX XXXX`
- **ABN**: 11-digit with checksum validation
- **Postcode**: 4 digits (0200–9999)
- **Currency**: AUD ($) — validate as positive decimal
- **Spelling**: sanitisation, organisation, analyse, centre, colour
