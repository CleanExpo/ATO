---
id: search-indexer
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Search Indexer

> Full-text search indexing, query optimisation, and hybrid search patterns for NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `search-indexer`                                         |
| **Category**   | Document & Content                                       |
| **Complexity** | High                                                     |
| **Complements**| `vector-search`, `cache-strategy`                        |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies full-text search indexing patterns for NodeJS-Starter-V1: PostgreSQL tsvector index creation, GIN index optimisation, query parsing with tsquery, result ranking with ts_rank, hybrid search combining full-text and vector similarity, search suggestion/autocomplete, and index maintenance strategies.

---

## When to Apply

### Positive Triggers

- Adding full-text search indexes to database tables
- Optimising the existing search endpoint with proper GIN indexes
- Implementing hybrid search (full-text + vector similarity)
- Building search autocomplete or suggestion features
- Adding search highlighting with ts_headline
- Creating search indexes for new content types

### Negative Triggers

- Vector-only similarity search (use `vector-search` skill)
- Simple column filtering or LIKE queries (use SQLAlchemy directly)
- External search services like Elasticsearch or Algolia
- Frontend search/filter on already-loaded data

---

## Core Principles

### The Three Laws of Search Indexing

1. **Index at Write Time, Search at Read Time**: Build tsvector columns and GIN indexes during data insertion. Never compute tsvector at query time — it forces a sequential scan.
2. **Rank by Relevance, Not Recency**: Use `ts_rank` or `ts_rank_cd` with normalisation flags. Default ordering by `created_at` wastes the search engine.
3. **Combine Signals for Quality**: Hybrid search (full-text + vector + recency) outperforms any single signal. Weight and normalise each signal before combining.

---

## Pattern 1: GIN Index Creation

### Migration SQL

```sql
-- Add tsvector column with automatic update trigger
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate from existing data (weighted: title=A, content=B)
UPDATE documents SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'B');

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_documents_search
  ON documents USING GIN (search_vector);

-- Trigger to keep search_vector updated on INSERT/UPDATE
CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE OF title, content ON documents
  FOR EACH ROW EXECUTE FUNCTION documents_search_vector_update();
```

**Project Reference**: `scripts/init-db.sql` — the `documents` table has `title` and `content` columns but no tsvector column or GIN index. The existing search in `apps/backend/src/api/routes/search.py:142-161` computes `to_tsvector` at query time, causing sequential scans.

---

## Pattern 2: Optimised Search Query (Python)

### Using Pre-Computed tsvector

```python
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Document


async def search_documents(
    db: AsyncSession,
    query: str,
    limit: int = 20,
    offset: int = 0,
    user_id: str | None = None,
) -> dict:
    """Search documents using pre-computed tsvector with GIN index."""
    tsquery = func.websearch_to_tsquery("english", query)

    stmt = (
        select(
            Document.id,
            Document.title,
            Document.content,
            func.ts_rank_cd(Document.search_vector, tsquery, 32).label("rank"),
            func.ts_headline(
                "english",
                Document.content,
                tsquery,
                text("'MaxWords=30, MinWords=15, MaxFragments=2'"),
            ).label("snippet"),
        )
        .where(Document.search_vector.op("@@")(tsquery))
        .order_by(text("rank DESC"))
        .limit(limit)
        .offset(offset)
    )

    if user_id:
        stmt = stmt.where(Document.user_id == user_id)

    result = await db.execute(stmt)
    rows = result.all()

    return {
        "results": [
            {"id": str(r.id), "title": r.title, "rank": float(r.rank), "snippet": r.snippet}
            for r in rows
        ],
        "total": len(rows),
    }
```

**Key improvements over existing search**:
- `websearch_to_tsquery` instead of `plainto_tsquery` — supports quoted phrases and `OR`/`-` operators
- `ts_rank_cd` with normalisation flag 32 for better score distribution
- `ts_headline` for contextual snippets instead of truncating first 150 chars
- Pre-computed `search_vector` column hits GIN index (O(log n) vs O(n))

**Project Reference**: `apps/backend/src/api/routes/search.py:92-214` — replace the inline `to_tsvector` calls with the pre-computed column query above.

---

## Pattern 3: Hybrid Search (Full-Text + Vector)

### Reciprocal Rank Fusion

```python
async def hybrid_search(
    db: AsyncSession,
    query: str,
    query_embedding: list[float],
    limit: int = 20,
    text_weight: float = 0.4,
    vector_weight: float = 0.6,
) -> list[dict]:
    """Combine full-text and vector search using RRF."""
    # Full-text results
    text_results = await search_documents(db, query, limit=limit * 2)
    text_ids = [r["id"] for r in text_results["results"]]

    # Vector results (from vector-search skill)
    vector_stmt = (
        select(Document.id, Document.title)
        .order_by(Document.embedding.cosine_distance(query_embedding))
        .limit(limit * 2)
    )
    vector_result = await db.execute(vector_stmt)
    vector_ids = [str(r.id) for r in vector_result.all()]

    # Reciprocal Rank Fusion: score = sum(1 / (k + rank))
    k = 60  # RRF constant
    scores: dict[str, float] = {}
    for rank, doc_id in enumerate(text_ids):
        scores[doc_id] = scores.get(doc_id, 0) + text_weight / (k + rank)
    for rank, doc_id in enumerate(vector_ids):
        scores[doc_id] = scores.get(doc_id, 0) + vector_weight / (k + rank)

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"id": doc_id, "rrf_score": score} for doc_id, score in ranked]
```

**Complements**: `vector-search` skill — provides the embedding query and cosine distance. This skill provides the full-text query. Hybrid search fuses both signals for superior relevance.

---

## Pattern 4: Search Autocomplete

### Prefix Matching with Trigram Index

```sql
-- Enable pg_trgm extension (already available with pgvector)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for autocomplete
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm
  ON documents USING GIN (title gin_trgm_ops);
```

```python
async def autocomplete(
    db: AsyncSession, prefix: str, limit: int = 5
) -> list[str]:
    """Return title suggestions matching prefix."""
    stmt = (
        select(Document.title)
        .where(Document.title.ilike(f"{prefix}%"))
        .order_by(func.similarity(Document.title, prefix).desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [r.title for r in result.all()]
```

---

## Pattern 5: Index Maintenance

### Reindex and Vacuum Strategy

```sql
-- Reindex after bulk inserts (run during low-traffic windows)
REINDEX INDEX CONCURRENTLY idx_documents_search;

-- Update search statistics for query planner
ANALYZE documents;
```

Schedule reindexing via the `cron-scheduler` skill — run `REINDEX CONCURRENTLY` weekly and `ANALYZE` daily. The `CONCURRENTLY` flag avoids locking the table during reindex.

**Monitoring**: Track index size and bloat with `pg_stat_user_indexes`. Alert if `idx_scan` count is zero (index unused) or `idx_tup_read` / `idx_tup_fetch` ratio exceeds 100 (excessive bloat).

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| `to_tsvector()` at query time | Sequential scan, O(n) per query | Pre-computed tsvector column with GIN index |
| `plainto_tsquery` for user input | No phrase or boolean support | `websearch_to_tsquery` for natural syntax |
| Truncating content for snippets | No relevance context | `ts_headline` with MaxWords/MinWords |
| Full-text only search | Misses semantic matches | Hybrid with vector similarity (RRF) |
| No index on title for autocomplete | LIKE '%query%' scans entire table | `pg_trgm` GIN index |
| Never reindexing | GIN bloat degrades performance | Weekly `REINDEX CONCURRENTLY` |

---

## Checklist

Before merging search-indexer changes:

- [ ] `search_vector` tsvector column added to `documents` table
- [ ] GIN index created on `search_vector`
- [ ] Trigger keeps `search_vector` updated on INSERT/UPDATE
- [ ] Weighted fields: title=A, content=B
- [ ] `websearch_to_tsquery` replaces `plainto_tsquery`
- [ ] `ts_headline` provides contextual snippets
- [ ] Hybrid search combines full-text rank with vector cosine
- [ ] Autocomplete uses `pg_trgm` trigram index
- [ ] Scheduled reindex and ANALYZE via cron

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Search Indexer Implementation

**Engine**: PostgreSQL tsvector + GIN
**Tables**: [documents / custom]
**Weights**: title=A, content=B, [metadata=C]
**Query Parser**: [websearch_to_tsquery / plainto_tsquery]
**Hybrid**: [enabled / disabled], text_weight=[0.4], vector_weight=[0.6]
**Autocomplete**: [pg_trgm / disabled]
**Maintenance**: [scheduled reindex / manual]
```
