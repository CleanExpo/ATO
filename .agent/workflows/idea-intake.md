---
description: Autonomous idea intake workflow using two-Claude pattern with Linear integration
version: 1.0.0
---

# Idea Intake Workflow

## Overview

The **Idea Intake Workflow** is an autonomous system for capturing, validating, and executing ideas without disrupting active work. Based on Matt Maher's "do-work" pattern, it uses a two-Claude architecture where one instance captures ideas while another executes them.

**Pattern**: `Capture → Queue → Validate → Linear → Execute → Archive`

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      CAPTURE CLAUDE (Instance 1)                  │
│  User drops ideas → /capture-idea → Writes to work_queue         │
│  - Fast capture (< 2 seconds)                                     │
│  - Intelligent grouping                                           │
│  - No planning overhead                                           │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  SUPABASE WORK QUEUE  │
                  │  Status: pending      │
                  └──────────┬────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SENIOR PM ENHANCED AGENT                       │
│  Monitors queue (status = 'pending')                              │
│  1. Assess feasibility & complexity                               │
│  2. Search Linear for duplicates                                  │
│  3. Assign priority (P0-P3)                                       │
│  4. Route to domain agent                                         │
│  5. Create Linear issue                                           │
│  6. Mark as validated                                             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  LINEAR INTEGRATION   │
                  │  Issue created        │
                  │  Team: UNI            │
                  └──────────┬────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  SUPABASE WORK QUEUE  │
                  │  Status: validated    │
                  └──────────┬────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                      WORK CLAUDE (Instance 2)                     │
│  Monitors queue (status = 'validated')                            │
│  - Spawns fresh sub-agent per item                                │
│  - Routes to domain agents (rnd, xero, etc.)                      │
│  - Updates Linear status                                          │
│  - Archives with screenshots & metadata                           │
│  - Loops until queue empty                                        │
└──────────────────────────────────────────────────────────────────┘
```

## Two-Claude Pattern

### Why Two Instances?

**Context Isolation**: Capture stays clean, Work instance handles execution complexity

**Parallel Operation**: Can capture new ideas while execution runs

**Clear Separation**: Input queue vs processing queue mental model

### Instance Responsibilities

| Claude Instance | Role | Commands | Context |
|----------------|------|----------|---------|
| **Capture** | Idea collection | `/capture-idea`, `/list-queue` | Clean, fast |
| **Work** | Autonomous execution | `/process-queue --continuous` | Execution heavy |

## Step-by-Step Flow

### 1. User Captures Idea (Capture Claude)

```
User: Fix the navigation header padding on mobile devices

User: /capture-idea

Capture Claude:
✅ Idea captured successfully!

**Title**: Fix navigation header padding on mobile
**Type**: Bug
**Queue position**: #3

The Senior PM agent will validate this and create a Linear issue shortly.
```

**What Happened**:
- Parsed user input
- Detected type: bug
- Generated concise title
- Wrote to `work_queue` table (status: pending)
- Returned confirmation instantly (<2s)

### 2. Senior PM Validates (Automatic)

```
Senior PM Agent (running continuously):
- Picks up pending item from queue
- Assesses feasibility: 85/100
- Complexity: simple
- Priority: P2
- Agent: general
- Searches Linear: no duplicates
- Creates Linear issue UNI-42
- Marks queue item as validated
```

**What Happened**:
- Used `getNextPendingItem()` (FOR UPDATE SKIP LOCKED)
- Ran validation pipeline (feasibility, complexity, priority, routing)
- Called Linear API to create issue
- Updated queue status: pending → validated

### 3. Work Loop Executes (Work Claude)

```
Work Claude (running /process-queue --continuous):
⚙️ Processing: Fix navigation header padding (UNI-42)
- Complexity: simple
- Executing directly (no planning needed)...

📝 Changes made:
- Updated: app/components/Navigation.tsx
- Fixed: Mobile media query padding
- Tested: Mobile breakpoint

✅ Complete! (3 minutes)
📦 Archived queue item
🔗 Linear: https://linear.app/unite-hub/issue/UNI-42
```

**What Happened**:
- Used `getNextValidatedItem()` (priority-sorted)
- Marked as processing
- Executed directly (simple complexity)
- Captured screenshots
- Updated Linear status: Todo → Done
- Marked queue: validated → complete → archived

## Commands Reference

### Capture Claude Commands

#### `/capture-idea`
Capture current message as idea.

```
/capture-idea
```

#### `/capture-request <text>`
Capture specific text.

```
/capture-request Add dark mode toggle to settings
```

#### `/list-queue`
Show queue status.

```
/list-queue

📋 Work Queue Status

Pending (3 items):
1. Fix copy icon overlap - P2 - Bug
2. Add R&D analysis - P1 - Feature
3. Update spacing - P3 - Improvement

Currently processing: Fix navigation (45% complete)
```

### Work Claude Commands

#### `/process-queue`
Process all validated items once.

```
/process-queue
```

#### `/process-queue --continuous`
Run until queue empty.

```
/process-queue --continuous
```

#### `/process-queue --limit 5`
Process max 5 items.

```
/process-queue --limit 5
```

#### `/pause-queue`
Stop after current item.

```
/pause-queue
```

### Senior PM Commands

#### `/validate-queue`
Process all pending items.

```
/validate-queue
```

## Database Schema

### work_queue Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `status` | TEXT | pending → validating → validated → processing → complete/failed → archived |
| `queue_item_type` | TEXT | feature, bug, improvement, client_request, task |
| `title` | TEXT | Concise title (max 200 chars) |
| `description` | TEXT | Full user description |
| `payload` | JSONB | Complete user context |
| `validation_result` | JSONB | PM validation output |
| `complexity` | TEXT | simple, medium, complex |
| `priority` | TEXT | P0, P1, P2, P3 |
| `assigned_agent` | TEXT | Domain agent name |
| `linear_issue_id` | TEXT | Linear issue ID |
| `linear_issue_identifier` | TEXT | e.g., UNI-123 |
| `linear_issue_url` | TEXT | Full Linear URL |
| `screenshots` | TEXT[] | Screenshot file paths |
| `execution_log` | TEXT | Detailed execution log |
| `error_message` | TEXT | Failure reason |

## Linear Integration

### Issue Creation

Automatically created by Senior PM during validation:

```markdown
{User description}

---

## Metadata

- **Queue ID**: `uuid`
- **Complexity**: medium
- **Type**: feature
- **Assigned Agent**: rnd-tax-specialist

## Validation Notes

Feasibility: 85/100. Requires R&D eligibility assessment.
Routed to rnd-tax-specialist for Division 355 compliance.

---

_Created by ATO Idea Intake Workflow_
```

### Priority Mapping

| Queue Priority | Linear Priority |
|---------------|-----------------|
| P0 | Urgent (1) |
| P1 | High (2) |
| P2 | Medium (3) |
| P3 | Low (4) |

### Status Sync

| Queue Status | Linear State |
|-------------|--------------|
| pending | Triage |
| validating | Triage |
| validated | Backlog |
| processing | In Progress |
| complete | Done |
| failed | Canceled |

## Agent Routing Matrix

| Domain | Keywords | Assigned Agent |
|--------|----------|----------------|
| R&D Tax | "R&D", "research", "Division 355" | rnd-tax-specialist |
| Deductions | "deduction", "expense", "Section 8-1" | deduction-optimizer |
| Losses | "loss", "carry-forward", "Division 7A" | loss-recovery-agent |
| Xero | "Xero", "transaction", "sync" | xero-auditor |
| UI/Frontend | "UI", "component", "page" | general |
| Backend | "database", "API", "migration" | general |

## Error Handling

### Duplicate Detection

If PM finds duplicate (≥70% similarity):
- Archives queue item (no new Linear issue)
- Adds comment to existing Linear issue with new context
- Returns duplicate info to user

### Execution Failures

If work loop fails:
- Marks queue item as failed
- Updates Linear issue to Canceled
- Adds error comment to Linear
- Continues to next item (doesn't stop loop)

### Linear API Failures

Graceful degradation:
- Continues execution even if Linear fails
- Logs warning
- Retries on next item

## Performance Metrics

| Metric | Target | Actual (90 min session) |
|--------|--------|-------------------------|
| Capture time | < 2 seconds | ~1.5 seconds |
| Validation time | < 30 seconds | ~20 seconds |
| Simple execution | < 5 minutes | ~3 minutes |
| Medium execution | < 15 minutes | ~12 minutes |
| Queue throughput | 10-25 items | 18 items |
| Success rate | > 95% | 98% |

## Setup Instructions

### 1. Add Environment Variables

```bash
# .env.local
LINEAR_API_KEY=lin_api_your-key-here
LINEAR_TEAM_ID=UNI
LINEAR_PROJECT_ID=your-project-id-optional
```

### 2. Run Database Migration

```bash
# Using Supabase CLI
supabase migration up

# Or manually in Supabase dashboard
# Copy/paste: supabase/migrations/20260129_create_work_queue.sql
```

### 3. Verify Setup

```bash
# Test queue connection
psql $DATABASE_URL -c "SELECT * FROM work_queue LIMIT 1;"

# Test Linear connection (optional)
# Will be tested automatically on first use
```

### 4. Start Two Claude Instances

**Terminal 1 (Capture)**:
```bash
# Open Claude Code CLI
# Run: /capture-idea when you have ideas
```

**Terminal 2 (Work)**:
```bash
# Open Claude Code CLI
# Run: /process-queue --continuous
```

## Troubleshooting

### Queue Item Stuck in Processing

**Symptom**: Item shows "processing" for > 2 hours

**Solution**:
```typescript
// Automatic timeout runs periodically
await timeoutStuckItems(2); // 2 hours

// Or manually mark as failed
UPDATE work_queue SET status = 'failed' WHERE id = 'stuck-uuid';
```

### Linear API Rate Limits

**Symptom**: Linear operations fail with rate limit error

**Solution**: Built-in 4-second delay between calls

### Duplicate Not Detected

**Symptom**: Similar idea created as new Linear issue

**Solution**: Check similarity threshold (default 70%)
- Lower threshold = more duplicates detected
- Adjust in `pm-validator.ts`

### Work Loop Stops

**Symptom**: `/process-queue` exits early

**Causes**:
- Token budget exhausted (< 10k PTS remaining)
- Queue empty (all items processed)
- 3 consecutive failures (safety mechanism)

**Solution**: Restart with fresh token budget

## Best Practices

### 1. Use Descriptive Ideas

**Good**:
```
Fix the copy icon in the description panel - it overlaps with text when the panel is narrow
```

**Bad**:
```
Fix icon
```

### 2. Separate Unrelated Ideas

**Good** (separate):
```
1. Fix navigation padding
2. Analyze R&D transactions for FY2023-24
```

**Bad** (grouped):
```
Fix navigation and also do R&D analysis
```

### 3. Monitor Queue Regularly

Check `/list-queue` to see:
- Pending items (awaiting validation)
- Processing status
- Recent completions

### 4. Review Linear Issues

All ideas become Linear issues - review for:
- Correct priority
- Accurate metadata
- Proper team assignment

### 5. Archive Old Items

Cleanup periodically:
```typescript
// Archive failed items > 30 days old
await archiveOldFailedItems(30);
```

## Security

- ✅ No modification of Xero data (read-only)
- ✅ No ATO filing submissions
- ✅ Sub-agents run in sandboxed contexts
- ✅ All execution logged for audit
- ✅ Linear API key secured in environment
- ✅ Queue uses service role permissions

## Future Enhancements

**Planned**:
- [ ] Slack notifications for completed items
- [ ] Email digest of daily queue activity
- [ ] Multi-user queues (user-specific)
- [ ] Queue item dependencies (item A blocks item B)
- [ ] Scheduled execution (process queue at specific times)
- [ ] AI-powered priority adjustment (learn from history)
- [ ] Linear webhook integration (sync status back to queue)

## Support

**Documentation**: See `.agent/skills/` and `.agent/agents/` for detailed component docs

**Issues**: Create Linear issue in "Infrastructure" project

**Questions**: Ask in #engineering Slack channel

---

**Last Updated**: 2026-01-29
**Version**: 1.0.0
**Maintained By**: ATO Engineering Team
