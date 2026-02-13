---
name: context-manager
description: Automatic context window management for multi-agent system to prevent token limit interruptions
capabilities:
  - Monitor token usage across all agents
  - Auto-compact context when nearing limits
  - Preserve critical information during compaction
  - Prevent agent shutdowns due to context limits
  - Maintain conversation continuity
bound_skills:
  - work-queue-processor
  - idea-queue-capture
default_mode: EXECUTION
fuel_cost: 25 PTS
max_iterations: 100
reporting_to: orchestrator
---

# Context Manager Agent

**Version**: 1.0.0
**Last Updated**: 2026-02-12
**Purpose**: Prevent "Context limit reached" shutdowns by automatically managing token usage

---

## Problem

The multi-agent system experiences frequent shutdowns with messages like:
```
● 4 teammates shut down gracefully
  ⎿  Context limit reached · /compact or /clear to continue
```

This interrupts workflow and requires manual intervention.

## Solution

Automatic context management that:
1. Monitors token usage in real-time
2. Compresses context before hitting limits
3. Preserves critical task information
4. Allows agents to continue without manual `/compact` commands

---

## Context Compaction Strategy

### When to Compact

**Compaction Triggers**:
- Token usage > 80% of limit (180,000 / 200,000 tokens)
- Agent completing a major task phase
- Before handing off between specialists
- Every 10 iterations as preventive maintenance

**Never Compact**:
- During active code editing
- While debugging an active issue
- When critical context is being exchanged

### What to Preserve

**CRITICAL (Never Remove)**:
- Current task assignment and objective
- Active code being worked on
- Recent error messages and stack traces
- Unresolved blockers or questions
- Quality gate status

**PRESERVE (Summarize if long)**:
- Task progress and completion percentage
- Recent decisions and rationale
- Integration points and dependencies
- Test results (last 3 runs)

**COMPACT (Archive to summary)**:
- Completed task phases
- Old error messages (now resolved)
- Verbose logging output
- Historical test runs
- Previous iteration details
- Duplicate information

**REMOVE (Safe to delete)**:
- Greetings and social pleasantries
- Redundant confirmations
- Verbose file listings
- Old file contents (superseded by edits)
- Completed sub-task details

---

## Compaction Process

### Step 1: Analyze Context

```typescript
interface ContextAnalysis {
  totalTokens: number;
  limitTokens: number;
  usagePercent: number;
  criticalSections: string[];
  compactableSections: string[];
  removableSections: string[];
}
```

### Step 2: Generate Summary

Replace verbose history with structured summary:

**BEFORE Compaction**:
```
Specialist B: I've implemented the API route
Orchestrator: Great, can you show me the code?
Specialist B: Sure, here's the implementation...
[500 lines of code discussion]
Orchestrator: Looks good, let's test it
Specialist B: Running tests now...
[200 lines of test output]
Orchestrator: Tests passed! Handing off to Specialist C
```

**AFTER Compaction**:
```
📋 PHASE COMPLETE: Implementation
✅ API route implemented at app/api/rnd/eligibility-checker/route.ts
✅ All tests passing (coverage: 85%)
📤 Handoff: Specialist B → Specialist C
🎯 Next: Testing & validation
```

### Step 3: Preserve Critical State

Maintain structured state object:

```yaml
context_state:
  current_phase: testing
  task_id: ORCH-003
  assigned_to: specialist-c-tester
  status: in_progress
  progress_percent: 70
  
  critical_artifacts:
    - app/api/rnd/eligibility-checker/route.ts
    - lib/rnd/eligibility-calculator.ts
    - tests/api/rnd-eligibility.test.ts
  
  unresolved_issues:
    - Coverage at 75%, need 80%
    
  recent_decisions:
    - Using async job polling for batches >5
    - Cache results for 24 hours
```

### Step 4: Continue Execution

Agents resume with compacted context + state summary.

---

## Implementation

### Integration with Orchestrator

The Context Manager runs as a background service:

```typescript
// In orchestrator.ts
class OrchestratorAgent {
  private contextManager: ContextManager;
  
  constructor() {
    this.contextManager = new ContextManager({
      tokenLimit: 200000,
      compactThreshold: 0.8, // 80%
      criticalThreshold: 0.95 // 95%
    });
  }
  
  async runAllAgents() {
    // Check context before running
    if (this.contextManager.shouldCompact()) {
      await this.contextManager.compact();
    }
    
    // Run agents normally
    const reports = await Promise.all(
      this.agents.map(agent => agent.execute())
    );
    
    // Post-run compaction if needed
    this.contextManager.monitorAndCompact();
  }
}
```

### Auto-Compact Configuration

Add to `.env.local`:

```env
# Context Management
CONTEXT_AUTO_COMPACT=true
CONTEXT_COMPACT_THRESHOLD=0.8
CONTEXT_CRITICAL_THRESHOLD=0.95
CONTEXT_PRESERVE_ITERATIONS=5
```

---

## Commands

### Manual Compact

Force immediate context compaction:
```bash
npm run agents:compact
```

### Check Context Usage

View current token usage:
```bash
npm run agents:context-status
```

Output:
```
📊 Context Usage Report
─────────────────────────
Total Tokens: 145,230 / 200,000 (72.6%)
Status: ✅ Healthy

By Agent:
  Orchestrator:    45,000 tokens
  Specialist A:    12,000 tokens (archived)
  Specialist B:    38,000 tokens
  Specialist C:    28,000 tokens
  Specialist D:    22,230 tokens (archived)

Compaction recommended in: ~15,000 tokens
```

---

## Benefits

1. **No More Shutdowns**: Agents continue working without manual intervention
2. **Preserved Context**: Critical information maintained across compactions
3. **Faster Execution**: Less token overhead = faster responses
4. **Better Focus**: Removes noise, keeps what's important
5. **Transparent**: Clear state tracking across all agents

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Context shutdowns/day | 10+ | 0 | 0 |
| Manual /compact commands | 10+ | 0 | 0 |
| Avg tokens per task | 180K | 120K | <150K |
| Task completion time | +30% | baseline | baseline |
| Context efficiency | 60% | 85% | >80% |

---

## Migration Guide

### Step 1: Deploy Context Manager

1. Copy this configuration to `.agent/context-manager/`
2. Update orchestrator to use context manager
3. Add environment variables to `.env.local`

### Step 2: Update Agent Configs

Add to each specialist's AGENT.md:

```yaml
context_management:
  auto_compact: true
  preserve_critical: true
  compaction_trigger: 0.8
```

### Step 3: Test

1. Run orchestrator with context manager
2. Monitor token usage during normal operation
3. Verify auto-compaction occurs at threshold
4. Confirm task continuity after compaction

### Step 4: Monitor

Track metrics:
```bash
npm run agents:context-status --watch
```

---

## Troubleshooting

### Compaction Too Aggressive

**Symptom**: Important context lost
**Fix**: Increase `CONTEXT_PRESERVE_ITERATIONS` to 10

### Still Hitting Limits

**Symptom**: Shutdowns continue despite compaction
**Fix**: Lower threshold to 0.7 or increase frequency

### Compaction Too Slow

**Symptom**: Delays during compaction
**Fix**: Enable async compaction in background

---

**Agent Version**: 1.0.0
**Last Updated**: 2026-02-12
**Status**: Ready for Implementation
