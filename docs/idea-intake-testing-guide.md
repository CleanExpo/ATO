# Idea Intake Workflow - Testing Guide

## Prerequisites

Before testing, ensure:

- [ ] Database migration completed (`20260129_create_work_queue.sql`)
- [ ] Environment variables configured (LINEAR_API_KEY, LINEAR_TEAM_ID)
- [ ] Linear API key is valid and has correct permissions
- [ ] Supabase connection working

### Verify Setup

```bash
# 1. Check database table exists
psql $DATABASE_URL -c "\d work_queue"

# 2. Test Linear connection (optional - will be tested during workflow)
# Will fail gracefully if Linear not configured

# 3. Verify environment variables
grep LINEAR .env.local
```

---

## Test Plan

### Test 1: Simple Bug Fix (End-to-End)

**Objective**: Verify the complete workflow for a simple idea

**Steps**:

1. **Open Capture Claude** (Terminal 1)
   ```
   User: The navigation header has too much padding on mobile devices
   User: /capture-idea
   ```

2. **Expected Output**:
   ```
   ✅ Idea captured successfully!

   **Title**: Fix navigation header padding on mobile
   **Type**: Bug
   **Queue position**: #1

   The Senior PM agent will validate this and create a Linear issue shortly.
   ```

3. **Verify Database**:
   ```sql
   SELECT id, status, title, queue_item_type, complexity, priority
   FROM work_queue
   WHERE status = 'pending'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

   **Expected**: 1 row with status='pending'

4. **Run Senior PM Validation**:
   ```
   /validate-queue
   ```

   **Expected Output**:
   ```
   🔍 Senior PM Validation Started

   ✅ Validated: Fix navigation header padding on mobile (UNI-42)
      - Priority: P2
      - Complexity: simple
      - Agent: general
      - Linear: https://linear.app/unite-hub/issue/UNI-42
   ```

5. **Verify Linear Issue Created**:
   - Go to https://linear.app/unite-hub/team/UNI/active
   - Find issue UNI-42
   - Check metadata in description

6. **Verify Database**:
   ```sql
   SELECT status, complexity, priority, linear_issue_identifier
   FROM work_queue
   WHERE title LIKE '%navigation%'
   LIMIT 1;
   ```

   **Expected**: status='validated', complexity='simple', priority='P2', linear_issue_identifier='UNI-42'

7. **Open Work Claude** (Terminal 2)
   ```
   /process-queue
   ```

   **Expected Output**:
   ```
   ⚙️ Processing: Fix navigation header padding (UNI-42)
   - Complexity: simple
   - Executing directly (no planning needed)...

   📝 Changes made:
   - Updated: [files changed]
   - Fixed: [description]

   ✅ Complete! (X minutes)
   📦 Archived queue item
   🔗 Linear: https://linear.app/unite-hub/issue/UNI-42
   ```

8. **Verify Database**:
   ```sql
   SELECT status, processed_at, archived_at, execution_time_seconds
   FROM work_queue
   WHERE title LIKE '%navigation%'
   LIMIT 1;
   ```

   **Expected**: status='archived', processed_at and archived_at have timestamps

9. **Verify Linear Issue Updated**:
   - Check Linear issue UNI-42
   - Status should be "Done"

**✅ Pass Criteria**:
- Item flows through all statuses: pending → validating → validated → processing → complete → archived
- Linear issue created with correct metadata
- Linear issue status updated to Done
- Execution completes without errors

---

### Test 2: Multiple Related Ideas (Intelligent Grouping)

**Objective**: Verify intelligent grouping of related ideas

**Steps**:

1. **Capture Claude**:
   ```
   User: The description panel has two issues: (1) copy icon overlaps with text, and (2) there's not enough spacing between sections
   User: /capture-idea
   ```

2. **Expected Output**:
   ```
   ✅ Idea captured successfully!

   **Title**: Fix description panel UI issues
   **Type**: Bug
   **Queue position**: #2

   Grouped 2 related issues into 1 queue item since they affect the same component.
   ```

**✅ Pass Criteria**:
- Single queue item created (not 2 separate items)
- Title reflects both issues
- Description preserves both issues verbatim

---

### Test 3: Multiple Unrelated Ideas (Separation)

**Objective**: Verify separation of unrelated ideas

**Steps**:

1. **Capture Claude**:
   ```
   User: Fix the copy icon overlap. Also, I need an analysis of all R&D eligible transactions for FY2023-24.
   User: /capture-idea
   ```

2. **Expected Output**:
   ```
   ✅ 2 ideas captured successfully!

   1. **Fix copy icon overlap** (Bug) - Position #3
   2. **Analyze R&D eligible transactions for FY2023-24** (Feature) - Position #4

   Created separate queue items since these are different domains (UI vs tax analysis).
   ```

**✅ Pass Criteria**:
- 2 separate queue items created
- First item: type=bug, complexity=simple
- Second item: type=feature, complexity=complex, assigned_agent=rnd-tax-specialist

---

### Test 4: Duplicate Detection

**Objective**: Verify Linear duplicate detection

**Steps**:

1. **Create first idea**:
   ```
   User: Fix the navigation header padding issues
   User: /capture-idea
   ```

2. **Validate** (creates Linear issue):
   ```
   /validate-queue
   ```

3. **Create similar idea**:
   ```
   User: Adjust navigation header spacing
   User: /capture-idea
   ```

4. **Validate again**:
   ```
   /validate-queue
   ```

5. **Expected Output**:
   ```
   ⚠️ Duplicate: Adjust navigation header spacing
      - Merged into: UNI-42
      - Similarity: 78%
   ```

**✅ Pass Criteria**:
- Second idea marked as duplicate
- No new Linear issue created
- Comment added to existing Linear issue
- Queue item archived

---

### Test 5: Priority Assignment

**Objective**: Verify correct priority scoring

**Test Cases**:

| Input | Expected Priority |
|-------|-------------------|
| "Security vulnerability in auth" | P0 |
| "User-reported bug in dashboard" | P1 |
| "Add new feature for reports" | P2 |
| "Refactor internal code" | P3 |

**Steps**: For each test case:

1. Capture idea
2. Validate
3. Check database:
   ```sql
   SELECT title, priority FROM work_queue ORDER BY created_at DESC LIMIT 1;
   ```

**✅ Pass Criteria**:
- All priorities match expected values

---

### Test 6: Domain Routing

**Objective**: Verify correct agent routing

**Test Cases**:

| Input | Expected Agent |
|-------|----------------|
| "Analyze R&D transactions" | rnd-tax-specialist |
| "Review Xero sync status" | xero-auditor |
| "Find unclaimed deductions" | deduction-optimizer |
| "Fix UI button color" | general |

**Steps**: Same as Test 5, check `assigned_agent` column

---

### Test 7: Error Handling (Linear API Failure)

**Objective**: Verify graceful degradation

**Steps**:

1. **Temporarily break Linear API** (invalid API key):
   ```bash
   # In .env.local
   LINEAR_API_KEY=invalid-key-for-testing
   ```

2. **Capture and validate**:
   ```
   /capture-idea Test error handling
   /validate-queue
   ```

3. **Expected Behavior**:
   - Validation still completes
   - Queue item marked as validated
   - Warning logged: "Linear issue creation failed"
   - Item continues to work queue

4. **Restore Linear API key**

**✅ Pass Criteria**:
- System continues despite Linear failure
- Queue item not stuck in validating state
- Error logged appropriately

---

### Test 8: Work Loop Continuous Mode

**Objective**: Verify autonomous processing

**Steps**:

1. **Capture 5 simple ideas** (Capture Claude):
   ```
   /capture-idea Fix typo in title
   /capture-idea Update button color
   /capture-idea Add console.log
   /capture-idea Remove unused import
   /capture-idea Fix spacing
   ```

2. **Validate all** (Senior PM):
   ```
   /validate-queue
   ```

3. **Start continuous work loop** (Work Claude):
   ```
   /process-queue --continuous
   ```

4. **Observe**:
   - Should process all 5 items sequentially
   - Should pause between items (2s delay)
   - Should stop when queue empty

**✅ Pass Criteria**:
- All 5 items processed successfully
- No context pollution (each item independent)
- Loop stops gracefully when empty
- Average execution time < 5 minutes per item

---

### Test 9: Complex Item (User Approval)

**Objective**: Verify user approval for complex items

**Steps**:

1. **Capture complex idea**:
   ```
   User: Create a new agent for analyzing trust distributions with UPE compliance
   User: /capture-idea
   ```

2. **Validate**:
   ```
   /validate-queue
   ```

   **Expected**: complexity='complex', execution_strategy='specialist_review'

3. **Process**:
   ```
   /process-queue
   ```

4. **Expected Behavior**:
   - PLANNER sub-agent spawned
   - Plan presented to user
   - System waits for user approval
   - User must explicitly approve before EXECUTOR runs

**✅ Pass Criteria**:
- User approval prompt appears
- Execution blocked until approval
- Can reject and mark as failed

---

### Test 10: Queue Statistics

**Objective**: Verify statistics calculation

**Steps**:

1. **After processing several items**, check stats:
   ```
   /queue-stats
   ```

2. **Expected Output**:
   ```
   📊 Queue Statistics

   Total items processed: 10
   Average execution time: 8.3 minutes
   Total token usage: 45,230 PTS

   Status breakdown:
   - Pending: 1
   - Validated: 2
   - Processing: 0
   - Completed: 7
   - Failed: 0
   - Archived: 7

   Success rate: 100%
   ```

3. **Verify database**:
   ```sql
   SELECT * FROM get_queue_statistics();
   ```

**✅ Pass Criteria**:
- Counts match database
- Statistics calculate correctly
- Success rate accurate

---

## Performance Benchmarks

Run these tests to establish performance baselines:

### Benchmark 1: Capture Speed

**Goal**: < 2 seconds

```bash
# Capture 10 ideas and measure time
time {
  for i in {1..10}; do
    echo "/capture-idea Test idea $i" | claude-code
  done
}
```

**Expected**: Total time < 20 seconds (avg 2s per capture)

### Benchmark 2: Validation Speed

**Goal**: < 30 seconds per item

```bash
# Validate 10 items and measure
time /validate-queue
```

**Expected**: < 5 minutes for 10 items

### Benchmark 3: End-to-End Throughput

**Goal**: 10-25 items per 90 minutes

**Test**: Process 20 simple items end-to-end, measure total time

**Expected**: Complete in < 90 minutes

---

## Common Issues & Solutions

### Issue 1: Queue Item Stuck in "Processing"

**Symptom**: Item shows status='processing' for > 2 hours

**Diagnosis**:
```sql
SELECT id, title, status, updated_at,
       NOW() - updated_at AS stuck_duration
FROM work_queue
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '2 hours';
```

**Solution**:
```typescript
// Run timeout function
await timeoutStuckItems(2); // 2 hours

// Or manually:
UPDATE work_queue
SET status = 'failed',
    error_message = 'Timeout: Processing exceeded 2 hours'
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '2 hours';
```

### Issue 2: Linear API Rate Limits

**Symptom**: Linear operations fail with 429 error

**Solution**: Already built-in - 4-second delay between calls

**Verify delay is working**:
```typescript
// Check logs for rate limit warnings
grep "rate limit" logs/*.log
```

### Issue 3: Duplicate Not Detected

**Symptom**: Similar idea created as new Linear issue

**Diagnosis**:
- Check similarity threshold (default 70%)
- Verify search keywords extracted correctly

**Solution**:
```typescript
// Lower threshold in pm-validator.ts
const duplicates = findPotentialDuplicates(
  existingIssues,
  item.title,
  item.description,
  60 // Lower from 70% to 60%
);
```

### Issue 4: Agent Routing Incorrect

**Symptom**: Item routed to wrong agent

**Diagnosis**:
```sql
SELECT title, description, assigned_agent
FROM work_queue
WHERE assigned_agent != 'expected-agent';
```

**Solution**: Update routing matrix in `pm-validator.ts`

---

## Test Checklist

### Setup Phase
- [ ] Database migration ran successfully
- [ ] Environment variables configured
- [ ] Linear API key valid
- [ ] Supabase connection working

### Functional Tests
- [ ] Test 1: Simple bug fix (end-to-end) ✅
- [ ] Test 2: Multiple related ideas (grouping) ✅
- [ ] Test 3: Multiple unrelated ideas (separation) ✅
- [ ] Test 4: Duplicate detection ✅
- [ ] Test 5: Priority assignment ✅
- [ ] Test 6: Domain routing ✅
- [ ] Test 7: Error handling (Linear failure) ✅
- [ ] Test 8: Work loop continuous mode ✅
- [ ] Test 9: Complex item (user approval) ✅
- [ ] Test 10: Queue statistics ✅

### Performance Tests
- [ ] Capture speed < 2 seconds ⚡
- [ ] Validation speed < 30 seconds ⚡
- [ ] Throughput 10-25 items per 90 min ⚡

### Integration Tests
- [ ] Linear issue creation works 🔗
- [ ] Linear issue updates work 🔗
- [ ] Linear duplicate search works 🔗
- [ ] Linear comment adding works 🔗

### Edge Cases
- [ ] Empty queue handled gracefully
- [ ] Invalid Linear API key handled
- [ ] Stuck items timeout correctly
- [ ] Token exhaustion stops gracefully
- [ ] Concurrent validation prevented (FOR UPDATE SKIP LOCKED)

---

## Success Criteria

The Idea Intake Workflow is considered production-ready when:

✅ All 10 functional tests pass
✅ All 3 performance benchmarks met
✅ All 4 Linear integration tests pass
✅ All 5 edge cases handled
✅ No data loss or corruption
✅ Full audit trail maintained
✅ Linear issues sync correctly
✅ Success rate > 95% over 100 items

---

## Next Steps After Testing

1. **Deploy to production**: Vercel deployment with environment variables
2. **Monitor initial usage**: Watch for errors, performance issues
3. **Iterate on routing**: Fine-tune agent routing based on results
4. **Adjust thresholds**: Tweak similarity threshold, priority scoring
5. **Add metrics**: Implement dashboards for queue monitoring

---

**Testing Date**: _____________________
**Tested By**: _____________________
**Results**: _____________________
**Notes**: _____________________
