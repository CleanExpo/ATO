---
name: idea-queue-capture
description: Instantly capture user ideas to work queue with intelligent grouping
version: 1.0.0
---

# Idea Queue Capture Skill

## When to Use

- User provides a feature request, bug report, or improvement idea
- User mentions multiple related ideas that should be grouped together
- User wants to queue work without interrupting current execution
- Quick capture needed without planning overhead
- User says things like: "add this to my ideas", "queue this for later", "capture this"

## Purpose

This skill provides **fast, interruption-free idea capture** for the autonomous work queue system. It follows Matt Maher's "do-work" pattern where one Claude instance (Capture) collects ideas while another instance (Work) executes them.

**Key Principle**: Capture is FAST. No planning, no validation, no execution - just preserve the full context and queue it.

## Process

### 1. Parse User Input

Extract all distinct ideas from the user's message:

- Identify keywords: "feature", "bug", "fix", "improve", "add", "change", "update", "create"
- Look for numbered lists or bullet points
- Detect multiple sentences with distinct ideas
- Preserve full context verbatim - don't summarize

### 2. Intelligent Grouping Logic

Analyze if ideas should be grouped or separated:

**Group together** (create single queue item) if:
- Ideas affect the same UI component (e.g., "Fix button padding AND change button color")
- Ideas have dependencies (e.g., "Add field to form AND update validation")
- Ideas are variations/options for same change (e.g., "Make button blue OR green")
- Ideas are in the same domain (e.g., all R&D related, all UI related)

**Separate** (create multiple queue items) if:
- Ideas are independent with no relationship
- Ideas belong to different domains (e.g., tax calculation vs UI change)
- Ideas have different priority levels explicitly stated
- User explicitly separates with "Also..." or "Separately..."

**Example Grouping**:
```
Input: "Fix the copy icon overlap in description panel AND adjust the panel spacing"
Output: 1 queue item (both affect description panel)

Input: "Fix copy icon overlap. Also analyze R&D transactions for FY2023-24"
Output: 2 queue items (UI vs tax analysis - completely different domains)
```

### 3. Auto-Detect Queue Item Type

Based on keywords and context:

| Keywords | Type |
|----------|------|
| "bug", "fix", "broken", "error", "issue" | bug |
| "feature", "add", "new", "create", "build" | feature |
| "improve", "enhance", "optimize", "refactor", "better" | improvement |
| "client", "customer", "stakeholder", "requested" | client_request |
| Everything else | task |

### 4. Generate Title

Create concise title (max 80 chars):

- Extract action verb + subject (e.g., "Fix copy icon overlap")
- If grouped, summarize both (e.g., "Fix description panel UI issues")
- Capitalize first letter
- No trailing punctuation
- If title > 80 chars, truncate and add "..."

### 5. Create Queue Item

```typescript
import { addToQueue } from '@/lib/queue/work-queue-manager';

const queueItem = await addToQueue({
  title: generatedTitle,
  description: userInputVerbatim, // Full user message preserved
  queue_item_type: detectedType,
  payload: {
    original_message: userInput,
    context: currentContext,
    timestamp: new Date().toISOString(),
    source: 'capture-skill',
  },
});
```

### 6. Confirmation Response

Return clear confirmation with:
- Number of items captured
- Title(s) of created item(s)
- Type(s) detected
- Queue position(s)

## Configuration

### Environment Variables

```bash
# Required (already configured in ATO)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Database Table

Uses the `work_queue` table created by migration `20260129_create_work_queue.sql`.

## Workflow Commands

### `/capture-idea`
Capture the current user message as an idea.

**Usage**:
```
User: Fix the navigation header padding in mobile view
User: /capture-idea
```

### `/capture-request <text>`
Capture specific text as a request.

**Usage**:
```
/capture-request Add dark mode toggle to settings page
```

### `/capture-multiple`
Explicitly capture multiple separate ideas from the message.

**Usage**:
```
User: Fix button color. Also update the form validation. And review tax calculations.
User: /capture-multiple
```
Creates 3 separate queue items.

### `/list-queue`
Show pending queue items and their positions.

**Usage**:
```
/list-queue
```

**Output**:
```
📋 Work Queue Status

Pending (3 items):
1. Fix copy icon overlap - P2 - Bug - 2 mins ago
2. Add R&D analysis for FY2023-24 - P1 - Feature - 15 mins ago
3. Update navigation spacing - P3 - Improvement - 1 hour ago

Validated (1 item):
1. Fix description panel spacing - P2 - Bug - Ready for execution

Currently processing: Analyzing deduction opportunities (12% complete)

Total in queue: 4 items
```

### `/queue-stats`
Show detailed queue statistics.

**Usage**:
```
/queue-stats
```

**Output**:
```
📊 Queue Statistics

Total items processed: 127
Average execution time: 8.3 minutes
Total token usage: 45,230 PTS

Status breakdown:
- Pending: 3
- Validated: 1
- Processing: 1
- Completed: 119
- Failed: 2
- Archived: 115

Success rate: 98.4%
```

## Output Format

### Success Response

```json
{
  "status": "success",
  "captured": [
    {
      "id": "uuid-123",
      "title": "Fix copy icon overlap in description panel",
      "type": "bug",
      "status": "pending",
      "queue_position": 3,
      "created_at": "2026-01-29T10:30:00Z"
    }
  ],
  "message": "1 idea captured successfully",
  "next_steps": "The Senior PM agent will validate this idea and create a Linear issue if approved."
}
```

### Multiple Items Response

```json
{
  "status": "success",
  "captured": [
    {
      "id": "uuid-123",
      "title": "Fix navigation header padding",
      "type": "bug",
      "status": "pending",
      "queue_position": 3
    },
    {
      "id": "uuid-456",
      "title": "Analyze R&D transactions for FY2023-24",
      "type": "feature",
      "status": "pending",
      "queue_position": 4
    }
  ],
  "message": "2 ideas captured successfully",
  "next_steps": "The Senior PM agent will validate these ideas and create Linear issues if approved."
}
```

### Error Response

```json
{
  "status": "error",
  "error": "Failed to add item to queue: Database connection failed",
  "suggestions": [
    "Check SUPABASE_SERVICE_ROLE_KEY is configured",
    "Verify Supabase project is running",
    "Run migration: supabase migration up"
  ]
}
```

## User-Facing Messages

When capturing ideas, use clear, friendly language:

### Success Messages

```
✅ Idea captured successfully!

**Title**: Fix copy icon overlap in description panel
**Type**: Bug
**Queue position**: #3

The Senior PM agent will validate this and create a Linear issue shortly.
You can continue working - this won't interrupt your current task.
```

### Multiple Ideas Captured

```
✅ 2 ideas captured successfully!

1. **Fix navigation header padding** (Bug) - Position #3
2. **Analyze R&D transactions** (Feature) - Position #4

Both ideas will be validated by the Senior PM agent.
```

### Queue is Processing

```
⚙️ Idea captured! The work queue is currently processing other items.

**Your idea**: Add dark mode toggle
**Position**: #5 in queue
**Estimated wait**: ~15 minutes

You'll be notified when your idea reaches validation.
```

## Integration Points

### Upstream
- **User messages**: Captures ideas from natural conversation
- **Slash commands**: Explicit capture commands

### Downstream
- **work_queue table**: Writes to Supabase queue
- **Senior PM Agent**: Items flow to validation
- **Work Loop Processor**: Eventually executed autonomously

## Error Handling

### Database Errors

If queue write fails:
1. Log error with full context
2. Return user-friendly error message
3. Suggest: Check Supabase connection, verify migration ran
4. **DO NOT** lose user's idea - store in local fallback if possible

### Validation Errors

If title/description too long:
1. Truncate title to 200 chars
2. Preserve full description in payload
3. Add note to payload: `truncated: true`

### Duplicate Detection

**NOT** performed at capture stage (deferred to PM validation):
- Capture is fast, validation is thorough
- Senior PM will detect duplicates with Linear search
- If duplicate found, PM merges context into existing Linear issue

## Performance Targets

| Metric | Target |
|--------|--------|
| Capture time | < 2 seconds |
| User wait time | Immediate response |
| Database write | < 500ms |
| Message parsing | < 100ms |

## Security Considerations

- Uses `SUPABASE_SERVICE_ROLE_KEY` for database access
- No user authentication required (internal tool)
- Queue items are not user-specific (shared queue)
- Sensitive data in user messages is preserved as-is (no filtering)

**Important**: If user provides sensitive information (passwords, API keys), capture includes it. Warn user:

```
⚠️ Warning: Your idea contains what looks like sensitive information.
Please review the queue item before the Senior PM validates it.
```

## Testing Checklist

- [ ] Single idea capture works
- [ ] Multiple related ideas group correctly
- [ ] Multiple unrelated ideas separate correctly
- [ ] Type detection is accurate
- [ ] Title generation follows 80-char limit
- [ ] Queue position calculation is correct
- [ ] Error handling gracefully fails
- [ ] `/list-queue` shows correct status
- [ ] `/queue-stats` calculates correctly
- [ ] Database connection errors are handled

## Example Usage Sessions

### Session 1: Simple Bug Fix

```
User: The navigation header has too much padding on mobile devices. It's covering content.

User: /capture-idea

Claude: ✅ Idea captured successfully!

**Title**: Fix navigation header padding on mobile
**Type**: Bug
**Queue position**: #1

The Senior PM agent will validate this and create a Linear issue shortly.
```

### Session 2: Multiple Related Ideas

```
User: The description panel on the right has two issues:
1. The copy icon overlaps with text
2. There's not enough spacing between sections

User: /capture-idea

Claude: ✅ Idea captured successfully!

**Title**: Fix description panel UI issues
**Type**: Bug
**Queue position**: #2

Grouped 2 related issues into 1 queue item since they affect the same component.
The Senior PM will validate and route to the appropriate agent.
```

### Session 3: Multiple Unrelated Ideas

```
User: Fix the copy icon overlap. Also, I need an analysis of all R&D eligible transactions for FY2023-24.

User: /capture-idea

Claude: ✅ 2 ideas captured successfully!

1. **Fix copy icon overlap** (Bug) - Position #3
2. **Analyze R&D eligible transactions for FY2023-24** (Feature) - Position #4

Created separate queue items since these are different domains (UI vs tax analysis).
Both will be validated by the Senior PM agent.
```

## Notes

- This skill is **capture-only** - no planning, no validation, no execution
- Designed to run in dedicated "Capture Claude" instance
- Complements the "Work Claude" instance running `/process-queue`
- Follows Matt Maher's two-Claude pattern for context isolation
- Queue items remain pending until Senior PM validates them
- Validation includes feasibility check, duplicate detection, priority assignment
