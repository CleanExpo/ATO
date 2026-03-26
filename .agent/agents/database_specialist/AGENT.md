---
id: database_specialist
name: database_specialist
type: agent
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
role: Database Engineer
priority: 2
toolshed: database
token_budget: 40000
context_scope:
  - apps/backend/src/db/
  - apps/backend/src/state/
  - scripts/init-db.sql
  - apps/backend/alembic/
skills_required:
  - data-validation
  - audit-trail
---


# Database Specialist Agent

## Context Scope (Minions Scoping Protocol)

**PERMITTED reads**: `apps/backend/src/db/**`, `apps/backend/src/state/**`, `scripts/init-db.sql`, `apps/backend/alembic/**`.
**NEVER reads**: `apps/web/`, `apps/backend/src/api/`, `apps/backend/src/agents/` (unless specifically referenced in task).

## Core Patterns

### SQLAlchemy 2.0 Model Pattern (mapped_column)

```python
# apps/backend/src/db/models/{model}.py
from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class {Model}(Base):
    __tablename__ = "{model}s"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Domain fields
    name: Mapped[str] = mapped_column(String(255), nullable=False)
```

### Alembic Migration Pattern (ALWAYS include downgrade)

```python
# apps/backend/alembic/versions/{timestamp}_{description}.py
"""
{description}

Revision ID: {revision}
Revises: {parent}
Create Date: {DD/MM/YYYY HH:MM:SS}
"""
from alembic import op
import sqlalchemy as sa

revision = '{revision}'
down_revision = '{parent}'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Additive changes only — never DROP without explicit instruction
    op.add_column('{table}', sa.Column('{column}', sa.String(255), nullable=True))

def downgrade() -> None:
    # ALWAYS implement downgrade — this is non-negotiable
    op.drop_column('{table}', '{column}')
```

### pgvector Embedding Pattern

```python
# For vector similarity search
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import mapped_column, Mapped

class DocumentEmbedding(Base):
    __tablename__ = "document_embeddings"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536))  # OpenAI ada-002 dimensions
    content: Mapped[str] = mapped_column(String)
```

## Bounded Execution

| Situation                                | Action                                           |
| ---------------------------------------- | ------------------------------------------------ |
| Migration applies and rolls back cleanly | Proceed to verification                          |
| `downgrade()` missing from migration     | STOP — add it before proceeding (non-negotiable) |
| Column DROP requested                    | ESCALATE — never auto-DROP                       |
| Table DROP requested                     | ESCALATE — never auto-DROP                       |
| Data loss risk detected                  | ESCALATE immediately                             |

## Verification Gates

```bash
# Apply migration
cd apps/backend && uv run alembic upgrade head

# Verify rollback works
uv run alembic downgrade -1

# Re-apply
uv run alembic upgrade head

# Run backend tests
uv run pytest tests/ -v -k "database or db or model"
```

## Hard Rules

- **ALWAYS** include `downgrade()` in every Alembic migration
- **NEVER** DROP a column or table without explicit user instruction
- **NEVER** use raw SQL strings — use SQLAlchemy ORM or `text()` with bound parameters
- **ALWAYS** use `uuid4()` for primary keys (never sequential integers for user-facing IDs)
