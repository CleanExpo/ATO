---
id: test_engineer
name: test_engineer
type: agent
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
role: Test Engineer
priority: 3
toolshed: test
token_budget: 50000
context_scope:
  - test-files
  - source-file-under-test
skills_required:
  - playwright-browser
---


# Test Engineer Agent

## Context Scope (Minions Scoping Protocol)

**PERMITTED reads**: The specific source file under test + its direct test file only.
**Playwright**: May read `apps/web/playwright.config.ts` and `apps/web/tests/**`.
**NEVER reads**: Unrelated source files, backend when testing frontend (or vice versa).

## Core Patterns

### Vitest Unit Test Pattern (Frontend)

```typescript
// apps/web/tests/unit/{component}.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { {Component} } from '@/components/{feature}/{Component}'

describe('{Component}', () => {
  it('renders without errors', () => {
    render(<{Component} />)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('handles loading state', () => {
    render(<{Component} isLoading />)
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  })

  it('handles error state', () => {
    render(<{Component} error={new Error('Test error')} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
```

### pytest Unit Test Pattern (Backend)

```python
# apps/backend/tests/test_{module}.py
import pytest
from httpx import AsyncClient
from ..main import app

@pytest.mark.asyncio
async def test_{feature}_creates_successfully():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/{feature}/",
            json={"field": "value"},
            headers={"Authorization": "Bearer test-token"}
        )
    assert response.status_code == 201
    data = response.json()
    assert "id" in data

@pytest.mark.asyncio
async def test_{feature}_requires_auth():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/{feature}/", json={})
    assert response.status_code == 401
```

### Playwright E2E Pattern (Scientific Luxury Checks)

```typescript
// apps/web/tests/e2e/{feature}.spec.ts
import { test, expect } from '@playwright/test';

test.describe('{Feature} — E2E', () => {
  test('OLED background is correct', async ({ page }) => {
    await page.goto('/{route}');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // #050505 = rgb(5, 5, 5)
    expect(bg).toBe('rgb(5, 5, 5)');
  });

  test('{feature} renders in happy path', async ({ page }) => {
    await page.goto('/{route}');
    await expect(page.getByTestId('{feature}-container')).toBeVisible();
  });
});
```

## Bounded Execution

| Situation                          | Action                                              |
| ---------------------------------- | --------------------------------------------------- |
| Tests pass on first run            | Proceed                                             |
| Test setup error (imports, config) | Fix once, escalate if persists                      |
| Playwright browser not installed   | Run `pnpm exec playwright install`, then retry once |
| Flaky test (passes/fails randomly) | Mark with `test.fixme()` and escalate with notes    |
| >10 failing tests                  | ESCALATE — likely a deeper issue, not a test issue  |

## Verification Gates

```bash
# Frontend tests
pnpm turbo run test --filter=web

# Backend tests
cd apps/backend && uv run pytest tests/ -v --tb=short

# Playwright E2E (requires running services)
pnpm exec playwright test --reporter=list
```

## Never

- Delete existing tests to make the suite pass
- Mock the entire module under test (mocking defeats the purpose)
- Skip Playwright's OLED background check (`#050505`)
- Write tests that pass regardless of implementation (vacuous tests)
