---
id: error-boundary
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
context: fork
---

# Error Boundary

> React error boundary patterns with graceful degradation, fallback UI, and error reporting for NodeJS-Starter-V1.

---

## Metadata

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Skill ID**   | `error-boundary`                                         |
| **Category**   | Error Handling & Resilience                              |
| **Complexity** | Low                                                      |
| **Complements**| `scientific-luxury`, `error-taxonomy`, `structured-logging` |
| **Version**    | 1.0.0                                                    |
| **Locale**     | en-AU                                                    |

---

## Description

Codifies React error boundary patterns for NodeJS-Starter-V1: Next.js App Router `error.tsx` conventions, class-based error boundaries for client components, fallback UI with Scientific Luxury design, error recovery with retry, granular boundary placement, and error reporting integration.

---

## When to Apply

### Positive Triggers

- Adding error handling to Next.js route segments
- Creating reusable error boundary components for client-side failures
- Implementing fallback UI that matches the Scientific Luxury design system
- Adding error recovery (retry) for transient component failures
- Isolating third-party component failures from the rest of the UI

### Negative Triggers

- Server-side API error handling (use `error-taxonomy` skill)
- Form validation errors (use `data-validation` skill)
- Network request retry logic (use `retry-strategy` skill)
- Global application crashes (use Next.js `global-error.tsx`)

---

## Core Principles

### The Three Laws of Error Boundaries

1. **Boundary Per Feature, Not Per Component**: Place error boundaries around feature areas (dashboard, agent panel, workflow editor) not around every button. Too many boundaries fragment the recovery experience.
2. **Degrade, Don't Blank**: A failed component should show a meaningful fallback — never a blank screen. The user must know what happened and how to recover.
3. **Report, Then Recover**: Log the error with context (component name, props, user action) before showing the fallback. Silent failures are debugging nightmares.

---

## Pattern 1: Next.js App Router Error Files

### Route-Level Error Handling

```tsx
// apps/web/app/(dashboard)/error.tsx
"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#050505]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md space-y-4 text-center"
      >
        <div className="mx-auto h-3 w-3 rounded-full bg-[#FF4444]"
          style={{ animation: "pulse 2s ease-in-out infinite" }} />
        <h2 className="font-mono text-lg text-white/90">
          Something went wrong
        </h2>
        <p className="font-mono text-sm text-white/50">
          {error.message || "An unexpected error occurred"}
        </p>
        <button
          onClick={reset}
          className="rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.03]
                     px-4 py-2 font-mono text-sm text-[#00F5FF]
                     transition-colors hover:bg-white/[0.06]"
        >
          Try again
        </button>
        {error.digest && (
          <p className="font-mono text-xs text-white/30">
            Error ID: {error.digest}
          </p>
        )}
      </motion.div>
    </div>
  );
}
```

**Project Reference**: `apps/web/app/` — no `error.tsx` files exist in any route segment. Add `error.tsx` to: `(dashboard)/`, `(auth)/`, `workflows/`, and root `app/`.

### Required Error Files

| File | Purpose |
|------|---------|
| `app/error.tsx` | Catches all unhandled route errors |
| `app/global-error.tsx` | Catches root layout errors (replaces `<html>`) |
| `app/(dashboard)/error.tsx` | Dashboard-specific error UI |
| `app/workflows/error.tsx` | Workflow editor error UI |
| `app/not-found.tsx` | Custom 404 page |

---

## Pattern 2: Reusable Error Boundary Component

### Class-Based Boundary with Hooks API

```tsx
"use client";

import React, { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
    console.error(`[ErrorBoundary:${this.props.name ?? "unnamed"}]`, error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.reset);
      }
      return this.props.fallback ?? <DefaultFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-sm border-[0.5px] border-[#FF4444]/20
                    bg-[#FF4444]/5 p-4 font-mono text-sm">
      <div className="h-2 w-2 rounded-full bg-[#FF4444]" />
      <span className="text-white/70">{error.message}</span>
      <button onClick={reset} className="ml-auto text-[#00F5FF] hover:underline">
        Retry
      </button>
    </div>
  );
}

export { ErrorBoundary };
```

**Usage**: `<ErrorBoundary name="agent-panel"><AgentPanel /></ErrorBoundary>`

---

## Pattern 3: Granular Boundary Placement

### Recommended Boundary Map

```
app/layout.tsx                    ← global-error.tsx (root)
  ├── (dashboard)/layout.tsx      ← error.tsx (dashboard)
  │   ├── agents/page.tsx         ← <ErrorBoundary name="agent-list">
  │   │   ├── AgentList           ← <ErrorBoundary name="agent-card"> per card
  │   │   └── PerformanceTrends   ← <ErrorBoundary name="perf-chart">
  │   └── tasks/page.tsx          ← <ErrorBoundary name="task-list">
  ├── workflows/[id]/page.tsx     ← error.tsx (workflow)
  │   ├── WorkflowCanvas          ← <ErrorBoundary name="canvas">
  │   └── ExecutionPanel          ← <ErrorBoundary name="execution">
  └── status-demo/page.tsx        ← <ErrorBoundary name="status-centre">
```

**Rule**: One `error.tsx` per route segment for route-level recovery. One `<ErrorBoundary>` per feature area within a page for component-level isolation.

---

## Pattern 4: Error Reporting Integration

### Structured Error Logging

```typescript
function reportError(error: Error, context: Record<string, unknown> = {}): void {
  const payload = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    ...context,
  };

  // Log locally
  console.error("[Error Report]", payload);

  // Send to backend (fire-and-forget)
  fetch("/api/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {}); // Never fail on error reporting
}
```

**Complements**: `structured-logging` skill — the backend `/api/errors` endpoint logs with structlog. `error-taxonomy` skill — map `error.name` to structured error codes.

---

## Pattern 5: Suspense + Error Boundary Composition

### Loading and Error States Together

```tsx
import { Suspense } from "react";

function FeatureSection({ children, name }: { children: ReactNode; name: string }) {
  return (
    <ErrorBoundary
      name={name}
      fallback={(error, reset) => (
        <ErrorCard error={error} onRetry={reset} section={name} />
      )}
    >
      <Suspense fallback={<SkeletonLoader name={name} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Usage in dashboard
<FeatureSection name="agent-metrics">
  <AgentMetrics />  {/* Server Component with async data */}
</FeatureSection>
```

**Rule**: Always wrap `<Suspense>` inside `<ErrorBoundary>`, not the other way around. The error boundary catches rendering errors; Suspense handles loading states. If Suspense is outside, a rendering error during loading bypasses the boundary.

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|-----------------:|
| No error.tsx in route segments | White screen on route errors | Add error.tsx to every major route segment |
| ErrorBoundary around every component | Fragmented UX, recovery confusion | One boundary per feature area |
| Showing stack traces to users | Security risk, poor UX | Show friendly message, log stack internally |
| No retry mechanism | User must refresh entire page | Provide reset/retry button in fallback |
| Catching errors silently | Debugging nightmare | Always log before showing fallback |
| Suspense outside ErrorBoundary | Loading errors bypass boundary | ErrorBoundary wraps Suspense |

---

## Checklist

Before merging error-boundary changes:

- [ ] `error.tsx` in root, `(dashboard)/`, `(auth)/`, and `workflows/` segments
- [ ] `global-error.tsx` in app root for layout-level errors
- [ ] Reusable `<ErrorBoundary>` component with name, fallback, onError props
- [ ] Fallback UI follows Scientific Luxury design (OLED black, spectral colours)
- [ ] Error reporting sends to `/api/errors` endpoint
- [ ] Suspense wrapped inside ErrorBoundary, not outside
- [ ] Feature-level boundaries in dashboard and workflow pages

---

## Response Format

When applying this skill, structure implementation as:

```markdown
### Error Boundary Implementation

**Route Boundaries**: [error.tsx locations]
**Component Boundaries**: [feature areas wrapped]
**Fallback Design**: [Scientific Luxury / minimal / custom]
**Error Reporting**: [/api/errors / console / external service]
**Recovery**: [retry button / auto-retry / manual refresh]
```
