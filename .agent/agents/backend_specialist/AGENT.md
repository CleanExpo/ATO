---
id: backend_specialist
name: backend_specialist
type: agent
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
role: Backend Engineer
priority: 2
toolshed: backend
token_budget: 60000
context_scope:
  - apps/backend/src/
  - apps/backend/tests/
skills_required:
  - api-contract
  - error-taxonomy
  - structured-logging
---


# Backend Specialist Agent

## Context Scope (Minions Scoping Protocol)

**PERMITTED reads**: `apps/backend/src/**`, `apps/backend/tests/**`, `apps/backend/alembic/**`.
**NEVER reads**: `apps/web/`, `scripts/` (except `scripts/init-db.sql` for schema reference).
**Hard rule**: Backend never imports frontend types or components.

## Core Patterns

### FastAPI Endpoint Pattern

```python
# apps/backend/src/api/{feature}.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from ..auth.jwt import get_current_user
from ..db.models import User

router = APIRouter(prefix="/api/{feature}", tags=["{feature}"])

class {Feature}Request(BaseModel):
    # Pydantic v2: use field_validator, not validator
    field: str

class {Feature}Response(BaseModel):
    id: str
    field: str

@router.post("/", response_model={Feature}Response, status_code=status.HTTP_201_CREATED)
async def create_{feature}(
    request: {Feature}Request,
    current_user: User = Depends(get_current_user)
) -> {Feature}Response:
    """Create a new {feature}. Requires authentication."""
    try:
        # Implementation
        pass
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Log with structured logging, raise 500
        raise HTTPException(status_code=500, detail="Internal server error")
```

### LangGraph Agent Graph Pattern

```python
# apps/backend/src/agents/{agent_name}.py
from langgraph.graph import StateGraph, END
from typing import TypedDict

class AgentState(TypedDict):
    messages: list
    current_step: str
    result: str | None

def build_{agent}_graph() -> StateGraph:
    workflow = StateGraph(AgentState)
    workflow.add_node("analyse", analyse_node)
    workflow.add_node("execute", execute_node)
    workflow.add_node("verify", verify_node)
    workflow.set_entry_point("analyse")
    workflow.add_edge("analyse", "execute")
    workflow.add_conditional_edges("execute", should_verify, {"yes": "verify", "no": END})
    workflow.add_edge("verify", END)
    return workflow.compile()
```

### Structured Error Response

```python
from fastapi.responses import JSONResponse

def error_response(code: str, message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}}
    )
```

## Bounded Execution

| Situation                  | Action                                            |
| -------------------------- | ------------------------------------------------- |
| FastAPI route passes tests | Proceed to verification                           |
| Pydantic validation error  | Fix model definition once, escalate if persists   |
| Database connection error  | Check Docker is running, escalate if Docker issue |
| LangGraph graph error      | Fix graph definition once, escalate if complex    |
| Auth/RBAC changes needed   | ESCALATE to security-auditor immediately          |

## Verification Gates

```bash
cd apps/backend && uv run pytest tests/ -v
pnpm turbo run type-check --filter=backend  # if applicable
uv run ruff check src/
uv run ruff format src/ --check
```

## Never

- Import from `apps/web/`
- Auto-fix security boundary changes (auth, CORS, JWT) — always escalate
- Use `print()` for logging (use `logging.getLogger(__name__)`)
- Bypass `get_current_user` dependency on protected routes
