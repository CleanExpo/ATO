---
name: idea-intake-workflow
description: Unified command interface for the autonomous idea intake workflow system
version: 2.0.0
commands:
  - /workflow
  - /workflow capture
  - /workflow validate
  - /workflow process
  - /workflow status
  - /workflow stats
author: Matt Maher
last_updated: 2026-01-29
---

# Idea Intake Workflow - Unified Interface

## Purpose

**Single command interface for Matt Maher's "do-work" autonomous idea intake pattern.** Provides unified access to capture, validation, and processing operations without needing to remember multiple commands across different skills.

This skill orchestrates three sub-skills into a cohesive workflow:
- **idea-queue-capture** - Fast idea capture
- **Senior PM Enhanced (validation)** - Feasibility assessment and routing
- **work-queue-processor** - Autonomous execution

## Philosophy

**One command to rule them all**: `/workflow` with intelligent subcommands that handle the entire lifecycle from idea capture to execution and archival.

**Context Isolation**: Each phase runs in isolated contexts to prevent pollution and maintain predictable behaviour:
- Capture Claude: Instant idea collection (no planning overhead)
- Work Claude: Autonomous execution with fresh sub-agents per item
- Validation: Runs in either instance with proper state tracking

---

## Quick Start Guide

### For First-Time Users

1. **Capture an idea**: Simply type your idea naturally, then use `/workflow capture`
2. **Validate ideas**: Use `/workflow validate` to have Senior PM assess feasibility and assign agents
3. **Process validated work**: Use `/workflow process` to autonomously execute validated items
4. **Monitor progress**: Use `/workflow status` to see what's happening in real-time

### Common Workflows

**Rapid capture mode** (Capture Claude):
```
User: Fix the navigation padding on mobile
/workflow capture

User: Also analyze R&D transactions for FY2023-24
/workflow capture

User: And add dark mode toggle to settings
/workflow capture
```

**Autonomous execution mode** (Work Claude):
```
/workflow process --continuous

(Runs until queue empty or tokens exhausted)
```

**Quick status check**:
```
/workflow status
```

---

## Commands

### `/workflow` (no args)

Shows interactive menu with current queue status and available commands.

**Output**:
```
🔄 Idea Intake Workflow v2.0.0

Current Queue Status:
├─ Pending:    3 items (awaiting validation)
├─ Validated:  2 items (ready to process)
├─ Processing: 1 item  (currently executing)
└─ Completed:  15 items (archived)

Available Commands:
├─ /workflow capture   - Capture the current message as an idea
├─ /workflow validate  - Validate all pending items (PM review)
├─ /workflow process   - Process validated items (execute work)
├─ /workflow status    - Show detailed queue status
└─ /workflow stats     - Show performance statistics

💡 Quick Actions:
- To capture current message: /workflow capture
- To validate all pending: /workflow validate
- To process everything: /workflow process --continuous
- To see what's happening: /workflow status

📚 Documentation: .agent/skills/idea-intake-workflow/SKILL.md
```

**When to use**:
- First time using the system
- Forgot available subcommands
- Need quick overview of queue state

**Aliases**: None (canonical form only)

---

### `/workflow capture`

Captures the current user message (or previous message if empty) as an idea to the work queue.

**Aliases**: `capture`, `add`, `queue`, `idea`

**Process**:
1. Extract user's most recent message (or use provided text)
2. Auto-detect type (feature/bug/improvement/task/client_request)
3. Generate concise title (max 80 chars)
4. Apply intelligent grouping if multiple related ideas detected
5. Write to Supabase work_queue with status='pending'
6. Return confirmation with queue ID and position

**Implementation**:
```typescript
import { addToQueue } from '@/lib/queue/work-queue-manager';

// Capture idea
const queueItem = await addToQueue({
  title: generatedTitle,
  description: userInputVerbatim,
  queue_item_type: detectedType,
  payload: {
    original_message: userInput,
    context: currentContext,
    timestamp: new Date().toISOString(),
    source: 'workflow-capture',
  },
});

console.log(`✅ Captured: ${queueItem.title} (ID: ${queueItem.id})`);
```

**Example 1 - Simple Bug**:
```
User: The navigation header has too much padding on mobile devices
User: /workflow capture

Claude: ✅ Idea captured successfully!

**Title**: Fix navigation header padding on mobile
**Type**: Bug
**Queue position**: #3
**Status**: Pending validation

Next: The Senior PM agent will validate this idea and assign it to an agent.
```

**Example 2 - Multiple Related Ideas (Grouped)**:
```
User: The description panel has two issues:
1. The copy icon overlaps with text
2. There's not enough spacing between sections
User: /workflow capture

Claude: ✅ Idea captured successfully!

**Title**: Fix description panel UI issues
**Type**: Bug
**Queue position**: #4
**Status**: Pending validation

Note: Grouped 2 related issues affecting the same component.
Next: Senior PM will validate and route to the appropriate agent.
```

**Example 3 - Multiple Unrelated Ideas (Separated)**:
```
User: Fix the copy icon overlap. Also, analyze R&D transactions for FY2023-24.
User: /workflow capture

Claude: ✅ 2 ideas captured successfully!

1. **Fix copy icon overlap** (Bug) - Position #5
2. **Analyze R&D transactions for FY2023-24** (Feature) - Position #6

Note: Created separate items since these are different domains (UI vs tax analysis).
Next: Senior PM will validate both ideas.
```

**Example 4 - Explicit Text Capture**:
```
User: /workflow capture Add dark mode toggle to settings page

Claude: ✅ Idea captured successfully!

**Title**: Add dark mode toggle to settings page
**Type**: Feature
**Queue position**: #7
**Status**: Pending validation

Next: Senior PM will validate and assess feasibility.
```

**Options**:
- `--text "..."` - Capture specific text instead of previous message
- `--type <type>` - Override auto-detection (feature|bug|improvement|client_request|task)
- `--separate` - Force multiple ideas to be separate items (disable grouping)

**Error Handling**:
```
❌ Failed to capture idea

Error: Database connection failed

Suggestions:
- Check SUPABASE_SERVICE_ROLE_KEY is configured
- Verify Supabase project is running
- Run migration: supabase migration up

Your idea has not been lost. Please try again or contact support.
```

---

### `/workflow validate`

Validates all pending queue items using Senior PM Enhanced agent. Performs feasibility assessment, complexity analysis, duplicate detection, priority assignment, and agent routing.

**Aliases**: `validate`, `review`, `pm-review`

**Process**:
1. Fetch all pending items from work_queue (status='pending')
2. For each item:
   a. Assess feasibility (0-100 score)
   b. Determine complexity (simple/medium/complex)
   c. Check for duplicates in Linear
   d. Assign priority (P0/P1/P2/P3)
   e. Route to domain agent
   f. Determine execution strategy (direct/requires_planning/specialist_review)
   g. Calculate confidence score
3. Mark items as 'validated' with validation_result
4. Optionally create Linear issues if not duplicates
5. Return summary of validated items

**Implementation**:
```typescript
import { getQueueItemsByStatus, markAsValidating, markAsValidated } from '@/lib/queue/work-queue-manager';
import { validateQueueItem } from '@/lib/queue/pm-validator';

// Fetch pending items
const pendingItems = await getQueueItemsByStatus('pending');

for (const item of pendingItems) {
  // Mark as validating
  await markAsValidating(item.id);

  // Run validation
  const validationResult = await validateQueueItem(item);

  // Mark as validated
  await markAsValidated(item.id, validationResult);

  console.log(`✅ Validated: ${item.title}`);
  console.log(`   Complexity: ${validationResult.complexity}`);
  console.log(`   Priority: ${validationResult.priority}`);
  console.log(`   Agent: ${validationResult.assigned_agent}`);
}
```

**Example 1 - Single Item Validation**:
```
User: /workflow validate

Claude: 🔍 Starting validation of pending items...

Validating: Fix navigation header padding on mobile

**Feasibility Score**: 85/100
- Frontend changes are straightforward with existing patterns
- UI component change with minimal risk

**Complexity**: Simple
- Single file change, straightforward implementation

**Priority**: P2 (Medium)
- Bug fix, affects user experience

**Assigned Agent**: general
- No specialist required

**Execution Strategy**: Direct
- Can execute immediately without planning phase

**Confidence**: 80%

**Duplicate Check**: No duplicates found

✅ Validation complete! Item ready for processing.

Status changed: pending → validated
```

**Example 2 - Multiple Items with Duplicate Detection**:
```
User: /workflow validate

Claude: 🔍 Starting validation of pending items...

[1/3] Validating: Fix description panel spacing

**Feasibility Score**: 90/100
**Complexity**: Simple
**Priority**: P2
**Agent**: general
**Strategy**: Direct
**Confidence**: 85%
**Duplicate**: ⚠️ Similar to UNI-42 (87% match)

Action: Merging context into existing Linear issue UNI-42
Status: Marked as duplicate, will not create new issue

---

[2/3] Validating: Analyze R&D transactions for FY2023-24

**Feasibility Score**: 95/100
- Xero integration available for data extraction
- R&D Tax Incentive specialist available

**Complexity**: Complex
- Significant analysis required, multiple files affected

**Priority**: P1 (High)
- R&D registration deadline approaching

**Assigned Agent**: rnd-tax-specialist
- Routed to R&D specialist for Division 355 analysis

**Execution Strategy**: Specialist Review
- Requires user approval before execution due to complexity

**Confidence**: 90%
**Duplicate**: No duplicates found

Action: Creating Linear issue...
✅ Created: UNI-45 - Analyze R&D transactions for FY2023-24

---

[3/3] Validating: Add dark mode toggle to settings

**Feasibility Score**: 85/100
**Complexity**: Medium
**Priority**: P3 (Low)
**Agent**: general
**Strategy**: Requires Planning
- Requires planning sub-agent before execution

**Confidence**: 80%
**Duplicate**: No duplicates found

Action: Creating Linear issue...
✅ Created: UNI-46 - Add dark mode toggle to settings

---

📊 Validation Summary
- Total pending: 3 items
- Validated: 3 items
- Duplicates: 1 item
- Linear issues created: 2 items
- Ready for execution: 3 items (2 new, 1 merged)

Next: Use `/workflow process` to start autonomous execution
```

**Options**:
- `--batch <N>` - Validate max N items (default: all pending)
- `--create-issues` - Create Linear issues immediately (default: true)
- `--skip-duplicates` - Skip duplicate checking (faster, not recommended)

**Validation Criteria**:

| Criterion | Thresholds | Action |
|-----------|------------|--------|
| Feasibility Score | < 50 | Mark as not feasible, require user review |
| Feasibility Score | 50-79 | Mark as feasible with notes |
| Feasibility Score | 80-100 | Mark as highly feasible |
| Duplicate Similarity | > 70% | Flag as duplicate, merge context |
| Duplicate Similarity | 50-70% | Flag as potential duplicate, notify user |
| Duplicate Similarity | < 50% | Not a duplicate |

**Error Handling**:
```
❌ Validation failed for: Analyze R&D transactions

Error: Linear API connection failed

Action: Marked as 'validating' (will retry)
Suggestion: Check LINEAR_API_KEY and retry

Continuing with other items...
```

---

### `/workflow process`

Processes all validated queue items autonomously using the work-queue-processor pattern. Spawns fresh sub-agent contexts for each item to avoid context pollution.

**Aliases**: `process`, `execute`, `work`, `do-work`

**Process**:
1. Fetch next validated item (status='validated', ordered by priority then creation time)
2. Mark item as 'processing'
3. Create Linear issue if not exists
4. Route based on complexity:
   - **Simple**: Execute directly
   - **Medium**: PLANNER sub-agent → EXECUTOR sub-agent
   - **Complex**: PLANNER sub-agent → USER APPROVAL → EXECUTOR sub-agent
5. Update Linear status as work progresses
6. Capture before/after screenshots
7. Mark as 'complete' or 'failed'
8. Archive if complete
9. Repeat until queue empty or stopped

**Implementation**:
```typescript
import { getNextValidatedItem, markAsProcessing, markAsComplete, markAsFailed } from '@/lib/queue/work-queue-manager';
import { createIssue, updateIssue } from '@/lib/linear/api-client';

// Orchestrator loop
while (true) {
  // Fetch next item
  const item = await getNextValidatedItem();
  if (!item) {
    console.log('Queue is empty');
    break;
  }

  // Mark as processing
  await markAsProcessing(item.id);

  // Create Linear issue if needed
  if (!item.linear_issue_id) {
    const issue = await createIssue(buildIssueFromQueue(item));
    await updateLinearMetadata(item.id, {
      issue_id: issue.id,
      issue_identifier: issue.identifier,
      issue_url: issue.url,
    });
  }

  // Execute based on complexity
  try {
    let result;
    if (item.complexity === 'simple') {
      result = await executeSimpleTask(item);
    } else if (item.complexity === 'medium') {
      const plan = await spawnPlannerSubAgent(item);
      result = await spawnExecutorSubAgent(item, plan);
    } else {
      const plan = await spawnPlannerSubAgent(item);
      const approved = await askUserForApproval(plan);
      if (!approved) {
        await markAsFailed(item.id, 'User rejected plan');
        continue;
      }
      result = await spawnExecutorSubAgent(item, plan);
    }

    // Mark as complete
    await markAsComplete(item.id, result);
    await updateIssue(item.linear_issue_id, {
      stateId: await getStateIdByType('completed'),
    });

  } catch (error) {
    // Mark as failed
    await markAsFailed(item.id, error.message);
    await updateIssue(item.linear_issue_id, {
      stateId: await getStateIdByType('canceled'),
    });
  }

  // Rate limit (4-second delay)
  await sleep(4000);
}
```

**Example 1 - Simple Item (Direct Execution)**:
```
User: /workflow process

Claude: ⚙️ Work Queue Processor Started

[1/3] Processing: Fix navigation header padding on mobile (UNI-43)
- Complexity: simple
- Strategy: Direct execution (no planning needed)

Executing...
- Reading: app/components/Navigation.tsx
- Analyzing: Current padding values
- Updating: Mobile breakpoint padding from 20px to 12px
- Testing: Visual verification

✅ Complete! (3 minutes)

Changes:
- Updated: app/components/Navigation.tsx (1 file, 3 lines changed)
- Before screenshot: .queue/screenshots/uuid-123/before.png
- After screenshot: .queue/screenshots/uuid-123/after.png

Linear: https://linear.app/unite-hub/issue/UNI-43
Status: Complete → Archived

---

[2/3] Processing: Add dark mode toggle to settings (UNI-46)
- Complexity: medium
- Strategy: Requires planning
- Agent: general

Spawning PLANNER sub-agent...

📋 Plan Created:
1. Create ThemeContext provider with light/dark state
2. Create ThemeToggle component with switch UI
3. Update existing components to read from ThemeContext
4. Add CSS variables for theme colors
5. Persist theme preference to localStorage

✓ Plan approved automatically (medium complexity)

Spawning EXECUTOR sub-agent...

Executing plan...
- Created: lib/theme/ThemeContext.tsx
- Created: components/ThemeToggle.tsx
- Updated: app/layout.tsx (wrap with ThemeProvider)
- Updated: 8 components to use theme colors
- Added: CSS variables in globals.css
- Added: localStorage persistence

Testing dark mode...
✅ Light mode works
✅ Dark mode works
✅ Theme persists on reload

✅ Complete! (12 minutes)

Changes:
- Created: 2 files
- Updated: 10 files
- Total lines: 247 lines changed

Linear: https://linear.app/unite-hub/issue/UNI-46
Status: Complete → Archived

---

[3/3] Processing: Analyze R&D transactions for FY2023-24 (UNI-45)
- Complexity: complex
- Strategy: Specialist review required
- Agent: rnd-tax-specialist

Spawning PLANNER sub-agent (rnd-tax-specialist)...

📋 Plan Created:
1. Fetch all Xero transactions for FY2023-24 (July 1, 2023 - June 30, 2024)
2. Filter for potential R&D expenditure (development, research, consulting)
3. Apply Division 355 four-element test to each transaction
4. Calculate eligible expenditure
5. Calculate R&D tax offset (43.5% for turnover < $20M)
6. Generate compliance report with legislative references
7. Flag transactions requiring further review

Estimated value: $200K-$500K potential refund

⚠️ This is a complex analysis involving significant financial value.

Proceed with execution? [Yes/No]

User: Yes

✓ Approved by user

Spawning EXECUTOR sub-agent (rnd-tax-specialist)...

Executing R&D analysis...
- Fetching Xero transactions (July 1, 2023 - June 30, 2024)...
- Retrieved: 1,247 transactions
- Filtering for potential R&D expenditure...
- Found: 387 potential R&D transactions

Applying Division 355 four-element test...
- Test 1 (New Knowledge): 256 transactions pass
- Test 2 (Outcome Unknown): 198 transactions pass
- Test 3 (Systematic Approach): 167 transactions pass
- Test 4 (Scientific Method): 127 transactions pass

✅ Eligible: 127 transactions

Calculating tax benefit...
- Total eligible expenditure: $293,000
- R&D tax offset (43.5%): $127,455
- Potential refund: $127,455

Generating compliance report...
- Transaction breakdown by category
- Four-element test results per transaction
- Legislative references (Division 355 ITAA 1997)
- Registration deadline: April 30, 2025
- Professional review recommendations

✅ Complete! (18 minutes)

Analysis Summary:
- Transactions analyzed: 1,247
- Eligible R&D transactions: 127
- Eligible expenditure: $293,000
- Tax offset: $127,455
- Confidence: High (90%)

Report saved: .queue/reports/rnd-analysis-fy2023-24.pdf

⚠️ Recommendations:
- Professional review required before submission
- Register with AusIndustry before April 30, 2025
- 15 transactions flagged for further documentation

Linear: https://linear.app/unite-hub/issue/UNI-45
Status: Complete → Archived

---

📊 Session Complete

Processed: 3 items
Succeeded: 3 items (100%)
Failed: 0 items
Total time: 33 minutes
Tokens used: ~18,500 PTS

Queue status:
- Pending: 0 items
- Validated: 0 items
- Processing: 0 items

All items complete! 🎉
```

**Example 2 - Continuous Mode**:
```
User: /workflow process --continuous

Claude: ⚙️ Work Queue Processor Started (Continuous Mode)

Will process items continuously until queue empty or tokens exhausted.

Press Ctrl+C or use /workflow pause to stop gracefully.

---

[1/10] Processing: Fix copy icon overlap (UNI-42)
...
✅ Complete! (2 minutes)

[2/10] Processing: Update form validation (UNI-47)
...
✅ Complete! (8 minutes)

[3/10] Processing: Refactor tax calculation logic (UNI-48)
...
⚙️ Processing... (45% complete)

(Continues until queue empty)

---

📊 Session Complete

Processed: 10 items
Succeeded: 9 items (90%)
Failed: 1 item (10%)
Total time: 87 minutes
Tokens used: ~42,300 PTS
Tokens remaining: ~47,700 PTS

Queue status: Empty

Next: Use /workflow capture to add more ideas
```

**Options**:
- `--continuous` - Run until queue empty or tokens exhausted
- `--limit <N>` - Process maximum N items then stop
- `--priority <P>` - Only process items with specific priority (P0/P1/P2/P3)
- `--agent <name>` - Only process items assigned to specific agent

**Error Handling**:

When an item fails:
```
❌ Execution failed: Add dark mode toggle (UNI-46)

Error: Component ThemeContext.tsx already exists
Retry count: 1/3

Action:
- Marked as 'failed' with error message
- Updated Linear issue to 'Canceled'
- Added comment to Linear with error details

The work loop will continue with the next item.
To retry failed items, use /workflow retry
```

When token budget is low:
```
⚠️ Token budget low (8,500 PTS remaining)

Action: Pausing work loop gracefully
Status: Saved processor state

Items processed this session: 8
Items remaining in queue: 2

To resume: /workflow process
```

**Performance Targets**:

| Metric | Target |
|--------|--------|
| Simple item execution | < 5 minutes |
| Medium item execution | < 15 minutes |
| Complex item execution | < 30 minutes |
| Queue throughput | 10-25 items per 90 minutes |
| Success rate | > 95% |
| Token usage per item | 50-500 PTS |

---

### `/workflow status`

Shows detailed breakdown of current queue status, including what's currently processing, items in each state, and recent completions.

**Aliases**: `status`, `queue`, `progress`

**Process**:
1. Fetch queue statistics from work_queue table
2. Get currently processing item (if any)
3. Get recent completions (last 5)
4. Calculate estimated time remaining
5. Show breakdown by status

**Implementation**:
```typescript
import { getQueueStatistics, getQueueItemsByStatus } from '@/lib/queue/work-queue-manager';

// Get statistics
const stats = await getQueueStatistics();

// Get currently processing
const processingItems = await getQueueItemsByStatus('processing', 1);
const currentItem = processingItems[0] || null;

// Get recent completions
const recentCompletions = await getQueueItemsByStatus('complete', 5);

// Display status
console.log('📊 Queue Status\n');
if (currentItem) {
  console.log('Currently processing:');
  console.log(`- ${currentItem.title} (${currentItem.linear_issue_identifier})`);
  console.log(`- Progress: Executing...`);
  console.log(`- Time elapsed: ${calculateElapsed(currentItem.updated_at)}\n`);
}

console.log('Queue breakdown:');
console.log(`├─ Pending:    ${stats.pending_count} items`);
console.log(`├─ Validating: ${stats.validating_count} items`);
console.log(`├─ Validated:  ${stats.validated_count} items (ready to process)`);
console.log(`├─ Processing: ${stats.processing_count} items`);
console.log(`├─ Complete:   ${stats.complete_count} items`);
console.log(`├─ Failed:     ${stats.failed_count} items`);
console.log(`└─ Archived:   ${stats.archived_count} items\n`);
```

**Example Output**:
```
User: /workflow status

Claude: 📊 Queue Status

Currently processing:
- Analyze R&D transactions for FY2023-24 (UNI-45)
- Progress: Applying Division 355 test (67% complete)
- Time elapsed: 12 minutes
- Agent: rnd-tax-specialist

Queue breakdown:
├─ Pending:    2 items (awaiting validation)
├─ Validating: 0 items
├─ Validated:  3 items (ready to process)
├─ Processing: 1 item  (currently executing)
├─ Complete:   25 items
├─ Failed:     1 item
└─ Archived:   22 items

Recently completed:
1. Fix navigation header padding (UNI-43) - 15 mins ago ✅
2. Update form validation (UNI-47) - 23 mins ago ✅
3. Refactor tax calculation (UNI-48) - 45 mins ago ✅
4. Add user authentication (UNI-49) - 1 hour ago ✅
5. Fix database migration (UNI-50) - 2 hours ago ✅

Session statistics:
- Items processed today: 8
- Success rate: 87.5%
- Average execution time: 9.3 minutes
- Total token usage: 24,500 PTS

Estimated time for validated items: ~45 minutes

Next in queue:
1. Add dark mode toggle (UNI-46) - P3 - Medium complexity
2. Fix copy icon overlap (UNI-51) - P2 - Simple
3. Create export functionality (UNI-52) - P1 - Complex

To process validated items: /workflow process
To see detailed statistics: /workflow stats
```

**When to use**:
- Check what's currently happening
- See queue backlog
- Monitor progress during long processing sessions
- Verify items were captured/validated
- Check estimated completion time

---

### `/workflow stats`

Shows detailed performance statistics and metrics for the idea intake workflow system.

**Aliases**: `stats`, `metrics`, `performance`, `analytics`

**Process**:
1. Fetch queue statistics from database
2. Calculate performance metrics (success rate, execution time, token usage)
3. Break down by complexity, priority, agent
4. Show validation statistics
5. Display trends over time

**Implementation**:
```typescript
import { getQueueStatistics, getQueueItemsByStatus } from '@/lib/queue/work-queue-manager';
import { calculateValidationStats } from '@/lib/queue/pm-validator';

// Get statistics
const stats = await getQueueStatistics();

// Get all validated items for PM stats
const validatedItems = await getQueueItemsByStatus('validated');
const pmStats = calculateValidationStats(validatedItems);

// Calculate success rate
const totalProcessed = stats.complete_count + stats.failed_count;
const successRate = totalProcessed > 0
  ? (stats.complete_count / totalProcessed * 100).toFixed(1)
  : 0;

// Display stats
console.log('📊 Workflow Statistics\n');
console.log('Overall Performance:');
console.log(`- Total items processed: ${totalProcessed}`);
console.log(`- Success rate: ${successRate}%`);
console.log(`- Average execution time: ${stats.avg_execution_time_seconds}s`);
console.log(`- Total token usage: ${stats.total_token_usage} PTS\n`);

console.log('By Complexity:');
console.log(`- Simple: ${pmStats.by_complexity.simple} items`);
console.log(`- Medium: ${pmStats.by_complexity.medium} items`);
console.log(`- Complex: ${pmStats.by_complexity.complex} items\n`);
```

**Example Output**:
```
User: /workflow stats

Claude: 📊 Workflow Statistics

Overall Performance:
- Total items processed: 127
- Success rate: 96.8% (123 succeeded, 4 failed)
- Average execution time: 8.3 minutes
- Total token usage: 45,230 PTS
- Average tokens per item: 356 PTS

Status Breakdown:
├─ Pending:    3 items (2.3%)
├─ Validating: 0 items (0%)
├─ Validated:  2 items (1.6%)
├─ Processing: 1 item  (0.8%)
├─ Complete:   119 items (93.7%)
├─ Failed:     2 items (1.6%)
└─ Archived:   115 items (90.6%)

By Complexity:
├─ Simple:   47 items (37.0%) - Avg time: 3.2 mins
├─ Medium:   58 items (45.7%) - Avg time: 9.1 mins
└─ Complex:  22 items (17.3%) - Avg time: 21.4 mins

By Priority:
├─ P0 (Critical): 2 items (1.6%)
├─ P1 (High):     28 items (22.0%)
├─ P2 (Medium):   74 items (58.3%)
└─ P3 (Low):      23 items (18.1%)

By Assigned Agent:
├─ general:                    67 items (52.8%)
├─ rnd-tax-specialist:         18 items (14.2%)
├─ deduction-optimizer:        12 items (9.4%)
├─ xero-auditor:               11 items (8.7%)
├─ loss-recovery-agent:        8 items (6.3%)
├─ trust-distribution-analyzer: 5 items (3.9%)
└─ Other specialists:          6 items (4.7%)

Validation Statistics:
- Average feasibility score: 82/100
- Average confidence: 78/100
- Duplicate detection rate: 12% (15 duplicates found)

Execution Strategy:
- Direct execution: 47 items (37.0%)
- Requires planning: 58 items (45.7%)
- Specialist review: 22 items (17.3%)

Recent Trends (Last 24 Hours):
- Items captured: 15
- Items validated: 12
- Items processed: 10
- Success rate: 100%
- Average time per item: 7.2 minutes

Time Distribution:
- 0-5 minutes:   47 items (37.0%)
- 5-10 minutes:  38 items (29.9%)
- 10-15 minutes: 20 items (15.7%)
- 15-30 minutes: 18 items (14.2%)
- 30+ minutes:   4 items (3.1%)

Token Distribution:
- 0-100 PTS:    52 items (40.9%)
- 100-500 PTS:  61 items (48.0%)
- 500-1000 PTS: 12 items (9.4%)
- 1000+ PTS:    2 items (1.6%)

Failed Items Analysis:
- Database connection: 1 item
- User canceled: 1 item
- Total failed: 2 items (1.6%)

Top Performing Categories:
1. UI/Frontend changes: 98% success rate (3.8 min avg)
2. Tax analysis: 95% success rate (18.2 min avg)
3. Database changes: 87% success rate (12.4 min avg)

Recommendations:
✅ High capture rate - system is being used effectively
✅ Excellent success rate (96.8%) - execution quality is strong
⚠️ 12% duplicate rate - consider improving capture descriptions
✅ Token usage is efficient (356 PTS avg per item)
```

**When to use**:
- Periodic performance review
- Understanding system usage patterns
- Identifying bottlenecks or issues
- Reporting metrics to stakeholders
- Optimizing workflow processes

---

## Implementation Notes

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    /workflow Command                         │
│                    (Orchestrator Skill)                      │
└───────────────┬─────────────────────────────────────────────┘
                │
                ├─ /workflow capture
                │  └─ Uses: lib/queue/work-queue-manager.ts
                │     └─ Function: addToQueue()
                │
                ├─ /workflow validate
                │  └─ Uses: lib/queue/pm-validator.ts
                │     └─ Function: validateQueueItem()
                │     └─ Function: checkForDuplicates()
                │     └─ Uses: lib/linear/api-client.ts
                │
                ├─ /workflow process
                │  └─ Uses: lib/queue/work-queue-manager.ts
                │     └─ Function: getNextValidatedItem()
                │     └─ Function: markAsProcessing()
                │     └─ Function: markAsComplete()
                │     └─ Function: markAsFailed()
                │     └─ Uses: lib/linear/api-client.ts
                │
                ├─ /workflow status
                │  └─ Uses: lib/queue/work-queue-manager.ts
                │     └─ Function: getQueueStatistics()
                │     └─ Function: getQueueItemsByStatus()
                │
                └─ /workflow stats
                   └─ Uses: lib/queue/work-queue-manager.ts
                      └─ Function: getQueueStatistics()
                      └─ Uses: lib/queue/pm-validator.ts
                         └─ Function: calculateValidationStats()
```

### Key Dependencies

**Database (Supabase)**:
- Table: `work_queue` (created by migration `20260129_create_work_queue.sql`)
- Service Client: `lib/supabase/server.ts`
- Functions:
  - `get_next_pending_queue_item()` - Row-level locking with SKIP LOCKED
  - `get_next_validated_queue_item()` - Priority-sorted with locking
  - `get_queue_statistics()` - Aggregated statistics

**Queue Manager** (`lib/queue/work-queue-manager.ts`):
- `addToQueue()` - Add new items
- `getNextPendingItem()` - Fetch for validation
- `getNextValidatedItem()` - Fetch for execution
- `markAsValidating()`, `markAsValidated()`, `markAsProcessing()`, `markAsComplete()`, `markAsFailed()` - Status transitions
- `archiveQueueItem()` - Archive completed items
- `updateLinearMetadata()` - Store Linear issue references
- `getQueueStatistics()` - Performance metrics
- `getQueueItemsByStatus()` - Filter by status
- `timeoutStuckItems()` - Safety mechanism for stuck items

**PM Validator** (`lib/queue/pm-validator.ts`):
- `validateQueueItem()` - Main validation pipeline
- `assessFeasibility()` - Feasibility scoring (0-100)
- `assessComplexity()` - Complexity detection (simple/medium/complex)
- `assignPriority()` - Priority assignment (P0/P1/P2/P3)
- `determineAssignedAgent()` - Agent routing logic
- `determineExecutionStrategy()` - Execution strategy (direct/planning/review)
- `checkForDuplicates()` - Linear duplicate detection
- `calculateValidationStats()` - Validation metrics

**Linear Integration** (`lib/linear/api-client.ts`):
- `createIssue()` - Create Linear issue from queue item
- `updateIssue()` - Update issue status
- `searchIssues()` - Search for duplicates
- `addComment()` - Add comments to issues
- `getStateIdByType()` - Get workflow state IDs

**Linear Utilities** (`lib/linear/graphql-queries.ts`):
- `buildIssueFromQueue()` - Convert queue item to Linear issue format
- `extractSearchKeywords()` - Extract keywords for duplicate search
- `findPotentialDuplicates()` - Similarity matching
- `mapQueueStatusToLinearState()` - Status mapping

### Data Flow

**Capture Flow**:
```
User message
  → Parse and extract ideas
  → Auto-detect type
  → Generate title
  → addToQueue() → Supabase work_queue
  → Return confirmation
```

**Validation Flow**:
```
Pending items
  → getQueueItemsByStatus('pending')
  → For each item:
     → markAsValidating()
     → validateQueueItem()
       → assessFeasibility()
       → assessComplexity()
       → checkForDuplicates() → Linear API
       → assignPriority()
       → determineAssignedAgent()
       → determineExecutionStrategy()
     → markAsValidated()
     → Create Linear issue if not duplicate
  → Return summary
```

**Processing Flow**:
```
Validated items
  → getNextValidatedItem() (with row locking)
  → markAsProcessing()
  → Create Linear issue if needed
  → Route based on complexity:
     → Simple: executeSimpleTask()
     → Medium: spawnPlannerSubAgent() → spawnExecutorSubAgent()
     → Complex: spawnPlannerSubAgent() → askUserForApproval() → spawnExecutorSubAgent()
  → markAsComplete() or markAsFailed()
  → updateIssue() → Linear API
  → archiveQueueItem() (if complete)
  → Repeat
```

### Error Handling Patterns

**Database Errors**:
```typescript
try {
  const item = await addToQueue({ ... });
  return { status: 'success', item };
} catch (error) {
  console.error('Failed to add item to queue:', error);
  return {
    status: 'error',
    error: error.message,
    suggestions: [
      'Check SUPABASE_SERVICE_ROLE_KEY is configured',
      'Verify Supabase project is running',
      'Run migration: supabase migration up'
    ]
  };
}
```

**Linear API Errors**:
```typescript
try {
  const duplicateCheck = await checkForDuplicates(item);
} catch (error) {
  console.warn('Duplicate check failed, continuing without:', error);
  // Graceful degradation - assume not duplicate
  duplicateCheck = { isDuplicate: false };
}
```

**Execution Failures**:
```typescript
try {
  const result = await executeQueueItem(item);
  await markAsComplete(item.id, result);
} catch (error) {
  console.error(`Execution failed for ${item.id}:`, error);
  await markAsFailed(item.id, error.message);

  // Update Linear
  await updateIssue(item.linear_issue_id, {
    stateId: await getStateIdByType('canceled'),
  });
  await addComment(item.linear_issue_id,
    `Execution failed: ${error.message}\n\nMarked as failed in queue.`
  );

  // Continue to next item (don't stop loop)
  continue;
}
```

**Token Exhaustion**:
```typescript
const estimatedRemainingTokens = calculateRemainingTokens();

if (estimatedRemainingTokens < MIN_TOKEN_THRESHOLD) {
  console.warn('Token budget low, stopping gracefully');

  await saveProcessorState({
    lastProcessedId: item.id,
    itemsProcessed: count,
    timestamp: new Date().toISOString(),
  });

  return {
    status: 'paused',
    reason: 'token_budget_low',
    itemsProcessed: count,
    message: 'Work loop paused due to low token budget. Restart to continue.',
  };
}
```

### Configuration

**Environment Variables**:
```bash
# Database (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Linear Integration (Required for validation/processing)
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_ID=UNI
LINEAR_PROJECT_ID=project-id-optional

# Queue Configuration (Optional)
QUEUE_BATCH_SIZE=10              # Max items per validation/processing session
QUEUE_POLL_INTERVAL_MS=5000      # How often to check for new items
QUEUE_MAX_RETRIES=3              # Max retries on failure
QUEUE_TIMEOUT_HOURS=2            # Mark as failed after N hours in 'processing'
MIN_TOKEN_THRESHOLD=10000        # Stop processing if tokens < this
```

**Rate Limiting**:
- **Linear API**: 4-second delay between calls (follows Gemini pattern)
- **Supabase**: No rate limiting (self-hosted or generous limits)
- **Token Budget**: Stop if < 10,000 PTS remaining

### Security Considerations

**Database Access**:
- Uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- No user authentication required (internal tool)
- Queue items are not user-specific (shared queue)

**Sensitive Data Handling**:
- Capture preserves user input verbatim (including sensitive data)
- Warn user if sensitive information detected
- Linear issues created in private team workspace
- Execution logs may contain sensitive context

**Prohibited Actions** (never executed, even if in queue):
- Deleting production data
- Modifying Xero data (read-only)
- Submitting ATO filings
- Committing secrets to git
- Force-pushing to main branch

### Performance Optimization

**Database Queries**:
- Use row-level locking (`FOR UPDATE SKIP LOCKED`) to prevent race conditions
- Index on `status` column for fast filtering
- Index on `created_at` for queue ordering
- Index on `priority` for priority-based processing

**Caching**:
- Cache queue statistics for 60 seconds
- Cache Linear team/project IDs for session
- No caching of queue items (always fetch fresh)

**Batching**:
- Validate items in batches (default: all pending)
- Process items one at a time (sequential for isolation)
- Rate limit Linear API calls (4-second delay)

**Token Management**:
- Estimate tokens per item (50-500 PTS)
- Stop if < 10,000 PTS remaining
- Save processor state for resumption

---

## Testing Checklist

### Capture Tests

- [ ] Can capture single idea from user message
- [ ] Can capture explicit text with `--text` option
- [ ] Auto-detects correct type (feature/bug/improvement/task/client_request)
- [ ] Generates concise title (< 80 chars)
- [ ] Groups related ideas correctly
- [ ] Separates unrelated ideas correctly
- [ ] Handles database connection errors gracefully
- [ ] Warns user about sensitive information
- [ ] Returns correct queue position
- [ ] Stores full context in payload

### Validation Tests

- [ ] Fetches all pending items
- [ ] Assesses feasibility correctly (0-100 score)
- [ ] Detects complexity (simple/medium/complex)
- [ ] Assigns priority (P0/P1/P2/P3)
- [ ] Routes to correct agent
- [ ] Determines execution strategy correctly
- [ ] Checks for duplicates in Linear
- [ ] Creates Linear issues if not duplicate
- [ ] Merges context into existing issues if duplicate
- [ ] Handles Linear API errors gracefully
- [ ] Marks items as validated with validation_result
- [ ] Returns summary with all validated items

### Processing Tests

- [ ] Fetches validated items with row locking
- [ ] Processes items in priority order
- [ ] Executes simple items directly
- [ ] Plans and executes medium items
- [ ] Asks user approval for complex items
- [ ] Spawns fresh sub-agents per item
- [ ] Updates Linear status as work progresses
- [ ] Captures before/after screenshots
- [ ] Marks items as complete with metadata
- [ ] Marks items as failed on error
- [ ] Archives completed items
- [ ] Continues on individual item failure
- [ ] Stops when queue empty
- [ ] Stops when token budget low
- [ ] Respects rate limits (4-second delay)

### Status Tests

- [ ] Shows currently processing item
- [ ] Shows queue breakdown by status
- [ ] Shows recent completions
- [ ] Calculates estimated time remaining
- [ ] Displays next items in queue
- [ ] Handles empty queue correctly

### Stats Tests

- [ ] Calculates overall performance metrics
- [ ] Breaks down by complexity
- [ ] Breaks down by priority
- [ ] Breaks down by agent
- [ ] Shows validation statistics
- [ ] Shows execution strategy distribution
- [ ] Shows time distribution
- [ ] Shows token distribution
- [ ] Shows failed items analysis
- [ ] Provides recommendations

---

## Troubleshooting

### Common Issues

**Issue**: "Failed to add item to queue: Database connection failed"

**Solution**:
1. Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured
2. Verify Supabase project is running
3. Run migration: `supabase migration up`
4. Check network connectivity

---

**Issue**: "Duplicate check failed, continuing without"

**Solution**:
1. Check `LINEAR_API_KEY` is configured
2. Verify Linear team/project IDs are correct
3. Check Linear API rate limits
4. This is a warning, not an error - validation continues

---

**Issue**: "Execution failed: Component already exists"

**Solution**:
1. Item marked as failed, work loop continues
2. Review error message in Linear issue comment
3. Fix issue manually or adjust queue item
4. Use `/workflow retry` to retry failed items

---

**Issue**: "Token budget low, stopping gracefully"

**Solution**:
1. This is expected behaviour, not an error
2. Processor state saved automatically
3. Use `/workflow process` to resume
4. Consider processing fewer items per session with `--limit`

---

**Issue**: "No items in queue" when expecting items

**Solution**:
1. Check status with `/workflow status`
2. Items may be in different status (pending, validating, processing)
3. Use `/workflow validate` to validate pending items first
4. Check if items were archived

---

**Issue**: Items stuck in 'processing' status

**Solution**:
1. Safety mechanism will timeout after 2 hours
2. Run `timeoutStuckItems()` function manually
3. Check for crashed/interrupted processor
4. Manually mark items as 'validated' to retry

---

## Advanced Usage

### Custom Agent Routing

Override automatic agent assignment:

```typescript
import { updateQueueItem } from '@/lib/queue/work-queue-manager';

// Force specific agent
await updateQueueItem(itemId, {
  assigned_agent: 'rnd-tax-specialist',
  priority: 'P0',
});
```

### Retry Failed Items

```typescript
import { getQueueItemsByStatus, updateQueueItem } from '@/lib/queue/work-queue-manager';

// Get all failed items
const failedItems = await getQueueItemsByStatus('failed');

// Reset to validated for retry
for (const item of failedItems) {
  await updateQueueItem(item.id, {
    status: 'validated',
    error_message: null,
    error_count: 0,
  });
}
```

### Bulk Archive Old Items

```typescript
import { archiveOldFailedItems } from '@/lib/queue/work-queue-manager';

// Archive failed items older than 30 days
const archivedCount = await archiveOldFailedItems(30);
console.log(`Archived ${archivedCount} old failed items`);
```

### Manual Timeout Cleanup

```typescript
import { timeoutStuckItems } from '@/lib/queue/work-queue-manager';

// Timeout items stuck in 'processing' for > 2 hours
const timedOutCount = await timeoutStuckItems(2);
console.log(`Timed out ${timedOutCount} stuck items`);
```

---

## Integration with Other Skills

### Xero Integration

Queue items can trigger Xero data fetching:

```typescript
// Example: R&D analysis queue item
const item = await addToQueue({
  title: 'Analyze R&D transactions for FY2023-24',
  description: 'Review all Xero transactions for R&D eligibility',
  queue_item_type: 'feature',
  payload: {
    financial_year: 'FY2023-24',
    start_date: '2023-07-01',
    end_date: '2024-06-30',
    analysis_type: 'rnd',
  },
});

// Processing will route to rnd-tax-specialist
// Agent will fetch Xero data automatically
```

### Tax Law Research

Complex tax questions can be queued:

```typescript
const item = await addToQueue({
  title: 'Research Division 7A loan repayment requirements',
  description: 'Client has $150K shareholder loan, need repayment schedule',
  queue_item_type: 'client_request',
  payload: {
    loan_amount: 150000,
    client_id: 'client-123',
    legislation: 'Division 7A ITAA 1936',
  },
});

// Processing will route to loss-recovery-agent
// Agent will research legislation and calculate repayments
```

### Linear Workflow Integration

Queue items automatically sync with Linear:

- **Capture**: Creates placeholder for future Linear issue
- **Validation**: Creates Linear issue if not duplicate
- **Processing**: Updates Linear issue status as work progresses
- **Completion**: Marks Linear issue as complete, adds final comment

### Reporting Integration

Queue data can feed into reports:

```typescript
import { getQueueStatistics } from '@/lib/queue/work-queue-manager';
import { calculateValidationStats } from '@/lib/queue/pm-validator';

// Generate weekly report
const stats = await getQueueStatistics();
const validationStats = calculateValidationStats(validatedItems);

const report = {
  week: getCurrentWeek(),
  items_processed: stats.complete_count,
  success_rate: (stats.complete_count / (stats.complete_count + stats.failed_count) * 100),
  avg_execution_time: stats.avg_execution_time_seconds,
  by_complexity: validationStats.by_complexity,
  by_priority: validationStats.by_priority,
};

// Save to reports table or send to stakeholders
```

---

## Future Enhancements

### Planned Features

1. **Priority Bumping**: Auto-bump priority based on age or Linear updates
2. **Scheduled Processing**: Run processor at specific times (cron-like)
3. **Batch Linear Updates**: Reduce API calls by batching updates
4. **Smart Retry Logic**: Auto-retry failed items with exponential backoff
5. **User Notifications**: Notify when high-priority items complete
6. **Analytics Dashboard**: Web UI for queue statistics and trends
7. **Agent Performance Metrics**: Track success rate per agent
8. **Complexity Prediction**: ML model to predict execution time
9. **Parallel Processing**: Process multiple simple items in parallel
10. **Queue Templates**: Pre-defined templates for common workflows

### Experimental Ideas

- **Voice Capture**: Capture ideas via voice commands
- **Email Integration**: Capture ideas from email
- **Slack Integration**: Capture ideas from Slack messages
- **GitHub Integration**: Capture ideas from GitHub issues/PRs
- **Auto-Prioritization**: ML-based priority assignment
- **Cost Estimation**: Estimate financial value of queue items

---

## Changelog

### v2.0.0 (2026-01-29)
- Initial comprehensive skill documentation
- Unified `/workflow` command interface
- Integration with work-queue-manager.ts
- Integration with pm-validator.ts
- Integration with Linear API
- Detailed examples for all commands
- Error handling patterns
- Performance targets and metrics
- Testing checklist
- Troubleshooting guide

---

## References

### Related Skills

- **idea-queue-capture** - Fast idea capture (sub-skill)
- **work-queue-processor** - Autonomous execution (sub-skill)
- **australian-tax-law-research** - Tax legislation research
- **xero-api-integration** - Xero data fetching
- **rnd-eligibility-assessment** - R&D tax analysis

### Related Files

- `lib/queue/work-queue-manager.ts` - Queue operations
- `lib/queue/pm-validator.ts` - Validation logic
- `lib/linear/api-client.ts` - Linear integration
- `lib/linear/graphql-queries.ts` - Linear utilities
- `lib/supabase/server.ts` - Database client
- `supabase/migrations/20260129_create_work_queue.sql` - Database schema

### External Documentation

- [Linear API Documentation](https://developers.linear.app/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Australian Tax Office (ATO)](https://www.ato.gov.au/)
- [Division 355 ITAA 1997](https://www.legislation.gov.au/Details/C2023C00004/Html/Volume_2) - R&D Tax Incentive

---

## Notes

- Designed for Australian Tax Optimizer (ATO) platform
- Follows Matt Maher's "do-work" autonomous pattern
- Complements "Capture Claude" and "Work Claude" two-instance pattern
- Each item gets fresh sub-agent context (no pollution)
- Observable via Linear for team visibility
- Fault-tolerant: Continues on individual item failures
- Archives maintain full audit trail
- Uses Australian English throughout (optimisation, labour, etc.)

---

**Last Updated**: 2026-01-29
**Version**: 2.0.0
**Author**: Matt Maher
**Maintainer**: Claude Code Agent Fleet
