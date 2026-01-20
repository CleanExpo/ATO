# Testing Guide: Phases 1 & 2

**Purpose**: Validate historical data sync and AI analysis before proceeding to Phase 3.

---

## Prerequisites Checklist

Before testing, ensure you have:

- [ ] Xero connection established (visited `/api/auth/xero` and completed OAuth)
- [ ] Database migrations applied (migrations 004 and 005)
- [ ] Google AI API key configured in `.env.local`
- [ ] Development server running (`npm run dev`)
- [ ] `jq` installed for JSON parsing (optional but helpful)

---

## Step 1: Apply Database Migrations

### Check Current Migration Status

```bash
cd ato-app

# Check if migrations table exists
echo "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" | psql $DATABASE_URL
```

### Apply Migrations

**Option A: Using Supabase CLI (Recommended)**

```bash
# If using Supabase locally
supabase db reset

# If using remote Supabase
supabase db push
```

**Option B: Manual Application**

```bash
# Apply migration 004 (historical cache)
psql $DATABASE_URL < supabase/migrations/004_create_historical_cache.sql

# Apply migration 005 (forensic analysis)
psql $DATABASE_URL < supabase/migrations/005_create_forensic_analysis.sql
```

**Option C: Using Node Script**

```bash
# Use existing migration script if available
npm run db:migrate
```

### Verify Tables Created

```bash
# Check tables exist
psql $DATABASE_URL -c "\dt"

# Should see:
# - historical_transactions_cache
# - audit_sync_status
# - forensic_analysis_results
# - tax_recommendations
# - ai_analysis_costs
```

---

## Step 2: Check Xero Connection

### Get Tenant ID

```bash
# Visit organizations endpoint
curl http://localhost:3000/api/xero/organizations | jq '.'

# Should return array with your Xero organization
# Note the tenantId - you'll need this for testing
```

**Save Tenant ID as Environment Variable:**

```bash
export TENANT_ID="your-tenant-id-here"
echo "TENANT_ID=$TENANT_ID"
```

### Verify Connection Status

```bash
# Check connection in database
psql $DATABASE_URL -c "SELECT tenant_id, tenant_name, organisation_name FROM xero_connections;"
```

---

## Step 3: Test Phase 1 - Historical Sync

### 3.1 Start Sync (Small Test)

Let's start with 1 year for a quick test:

```bash
curl -X POST http://localhost:3000/api/audit/sync-historical \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"years\": 1
  }" | jq '.'
```

**Expected Response:**
```json
{
  "status": "syncing",
  "progress": 0,
  "transactionsSynced": 0,
  "totalEstimated": 1000,
  "message": "Started syncing 1 years of historical data...",
  "pollUrl": "/api/audit/sync-status/..."
}
```

### 3.2 Monitor Progress

**Option A: Manual Polling**

```bash
# Poll status every 5 seconds
while true; do
  clear
  echo "=== Historical Sync Status ==="
  curl -s "http://localhost:3000/api/audit/sync-status/$TENANT_ID" | jq '{
    status: .status,
    progress: .progress,
    transactionsSynced: .transactionsSynced,
    totalEstimated: .totalEstimated,
    currentYear: .currentYear,
    yearsSynced: .yearsSynced,
    eta: .eta,
    isComplete: .isComplete
  }'
  echo ""
  echo "Press Ctrl+C to stop polling"
  sleep 5
done
```

**Option B: Using Watch**

```bash
watch -n 5 "curl -s http://localhost:3000/api/audit/sync-status/$TENANT_ID | jq '.'"
```

**What to Look For:**
- Status should change from "syncing" to "complete"
- Progress should increase from 0 to 100
- transactionsSynced should increment
- yearsSynced array should populate

### 3.3 Verify Cached Data

Once sync is complete (status = "complete"):

```bash
# Check cached transactions
curl -s "http://localhost:3000/api/audit/cached-transactions?tenantId=$TENANT_ID&page=1&pageSize=10" | jq '{
  total: .summary.totalTransactions,
  dateRange: .summary.dateRange,
  byYear: .summary.byFinancialYear,
  firstTransaction: .transactions[0]
}'
```

**Expected Output:**
- total: Number of transactions synced
- dateRange: From/to dates
- byYear: Breakdown by financial year
- firstTransaction: Sample transaction data

### 3.4 Check Database

```bash
# Count cached transactions
psql $DATABASE_URL -c "
  SELECT
    financial_year,
    COUNT(*) as transaction_count,
    SUM(total_amount) as total_amount
  FROM historical_transactions_cache
  WHERE tenant_id = '$TENANT_ID'
  GROUP BY financial_year
  ORDER BY financial_year DESC;
"

# Check sync status
psql $DATABASE_URL -c "
  SELECT
    sync_status,
    sync_progress,
    transactions_synced,
    years_synced
  FROM audit_sync_status
  WHERE tenant_id = '$TENANT_ID';
"
```

### 3.5 Validate Data Integrity

Run validators manually:

```bash
# Test financial year validator
echo '{"financial_year": "FY2024-25", "start_date": "2024-07-01", "end_date": "2025-06-30"}' | \
  python3 .claude/hooks/validators/financial_year_validator.py

# Check validation logs
cat .claude/hooks/logs/validation_logs/financial_year_validator_$(date +%Y%m%d).log
```

---

## Step 4: Test Phase 2 - AI Analysis

**Prerequisites:**
- Phase 1 sync must be complete
- Google AI API key must be configured

### 4.1 Verify Google AI API Key

```bash
# Check .env.local has GOOGLE_AI_API_KEY
grep GOOGLE_AI_API_KEY .env.local

# If not set:
echo "GOOGLE_AI_API_KEY=your-key-here" >> .env.local

# Restart dev server
npm run dev
```

### 4.2 Start AI Analysis (Small Batch)

```bash
# Start analysis with small batch size for faster test
curl -X POST http://localhost:3000/api/audit/analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"businessName\": \"Test Business\",
    \"industry\": \"Software Development\",
    \"batchSize\": 20
  }" | jq '.'
```

**Expected Response:**
```json
{
  "status": "analyzing",
  "progress": 0,
  "transactionsAnalyzed": 0,
  "totalTransactions": 500,
  "estimatedCostUSD": 0.1875,
  "message": "Started AI analysis of 500 transactions...",
  "pollUrl": "/api/audit/analysis-status/...",
  "costBreakdown": {
    "inputTokens": 400000,
    "outputTokens": 500000,
    "totalCost": 0.1875
  }
}
```

### 4.3 Monitor Analysis Progress

```bash
# Poll analysis status every 15 seconds
while true; do
  clear
  echo "=== AI Analysis Status ==="
  curl -s "http://localhost:3000/api/audit/analysis-status/$TENANT_ID" | jq '{
    status: .status,
    progress: .progress,
    transactionsAnalyzed: .transactionsAnalyzed,
    totalTransactions: .totalTransactions,
    currentBatch: .currentBatch,
    totalBatches: .totalBatches,
    eta: .eta,
    isComplete: .isComplete
  }'
  echo ""
  echo "Press Ctrl+C to stop polling"
  sleep 15
done
```

**What to Look For:**
- Status should change from "analyzing" to "complete"
- Progress should increase
- transactionsAnalyzed should increment
- ETA should decrease

### 4.4 Review Analysis Results

Once analysis is complete:

```bash
# Get summary
curl -s "http://localhost:3000/api/audit/analysis-results?tenantId=$TENANT_ID&page=1&pageSize=10" | jq '.summary'
```

**Expected Summary:**
```json
{
  "total": 500,
  "rnd": {
    "candidates": 120,
    "meetsDiv355": 85,
    "coreActivities": 62,
    "percentage": "24.0"
  },
  "categories": {
    "Software Development": 150,
    "Marketing": 80,
    "Professional Services": 70,
    ...
  },
  "confidence": {
    "high": 420,
    "medium": 65,
    "low": 15
  },
  "deductions": {
    "fullyDeductible": 480,
    "totalClaimableAmount": 125000.00
  },
  "compliance": {
    "requiresDocumentation": 180,
    "fbtImplications": 25,
    "division7aRisk": 2
  },
  "cost": {
    "totalCost": 0.1875,
    "totalTransactions": 500,
    "costPerTransaction": 0.000375
  }
}
```

### 4.5 Check R&D Candidates

```bash
# Get high-confidence R&D candidates
curl -s "http://localhost:3000/api/audit/analysis-results?tenantId=$TENANT_ID&isRndCandidate=true&minConfidence=70&pageSize=5" | jq '.results[] | {
  transaction_id: .transaction_id,
  primary_category: .primary_category,
  rnd_confidence: .rnd_confidence,
  meets_div355: .meets_div355_criteria,
  activity_type: .rnd_activity_type,
  outcome_unknown: .outcome_unknown,
  systematic_approach: .systematic_approach,
  new_knowledge: .new_knowledge,
  scientific_method: .scientific_method
}'
```

**What to Look For:**
- R&D candidates identified
- Four-element test results (all should be true for meets_div355)
- Confidence scores ≥ 70%
- Activity type mostly "core_rnd" or "supporting_rnd"

### 4.6 Check Database

```bash
# Count analysis results
psql $DATABASE_URL -c "
  SELECT
    COUNT(*) as total_analyzed,
    COUNT(*) FILTER (WHERE is_rnd_candidate) as rnd_candidates,
    COUNT(*) FILTER (WHERE meets_div355_criteria) as meets_div355,
    AVG(category_confidence)::numeric(5,2) as avg_confidence
  FROM forensic_analysis_results
  WHERE tenant_id = '$TENANT_ID';
"

# Check cost tracking
psql $DATABASE_URL -c "
  SELECT
    SUM(transactions_analyzed) as total_transactions,
    SUM(api_calls_made) as total_api_calls,
    SUM(estimated_cost_usd)::numeric(10,4) as total_cost,
    (SUM(estimated_cost_usd) / NULLIF(SUM(transactions_analyzed), 0))::numeric(10,6) as cost_per_transaction
  FROM ai_analysis_costs
  WHERE tenant_id = '$TENANT_ID';
"
```

### 4.7 Sample Individual Analysis

```bash
# Get detailed analysis for one transaction
curl -s "http://localhost:3000/api/audit/analysis-results?tenantId=$TENANT_ID&isRndCandidate=true&pageSize=1" | jq '.results[0]'
```

**Review:**
- Is the category classification accurate?
- Are the R&D criteria assessments reasonable?
- Is the reasoning provided?
- Are deduction types appropriate?
- Are compliance flags accurate?

---

## Step 5: Validation Tests

### 5.1 Test Tax Calculation Validator

```bash
# Valid R&D offset calculation
echo '{
  "eligible_expenditure": 100000,
  "rnd_offset": 43500,
  "calculation_type": "rnd"
}' | python3 .claude/hooks/validators/tax_calculation_validator.py

# Should output: ✅ Validation PASSED

# Invalid calculation (should fail)
echo '{
  "eligible_expenditure": 100000,
  "rnd_offset": 40000,
  "calculation_type": "rnd"
}' | python3 .claude/hooks/validators/tax_calculation_validator.py

# Should output: ❌ Validation FAILED with fix instructions
```

### 5.2 Test R&D Eligibility Validator

```bash
# Valid R&D assessment (all four elements met)
echo '{
  "outcome_unknown": true,
  "systematic_approach": true,
  "new_knowledge": true,
  "scientific_method": true,
  "confidence": 85
}' | python3 .claude/hooks/validators/rnd_eligibility_validator.py

# Should output: ✅ Validation PASSED

# Invalid (missing scientific method)
echo '{
  "outcome_unknown": true,
  "systematic_approach": true,
  "new_knowledge": true,
  "scientific_method": false,
  "confidence": 85
}' | python3 .claude/hooks/validators/rnd_eligibility_validator.py

# Should output: ❌ Validation FAILED
```

### 5.3 Check Validation Logs

```bash
# List all validation logs
ls -lh .claude/hooks/logs/validation_logs/

# View today's logs
cat .claude/hooks/logs/validation_logs/*_$(date +%Y%m%d).log
```

---

## Step 6: Performance & Cost Analysis

### 6.1 Measure Sync Performance

```bash
# Check sync duration
psql $DATABASE_URL -c "
  SELECT
    tenant_id,
    created_at as sync_started,
    updated_at as sync_completed,
    (updated_at - created_at) as duration,
    transactions_synced,
    (transactions_synced::float / EXTRACT(EPOCH FROM (updated_at - created_at)))::numeric(10,2) as transactions_per_second
  FROM audit_sync_status
  WHERE tenant_id = '$TENANT_ID';
"
```

### 6.2 Measure Analysis Performance

```bash
# Calculate analysis speed
psql $DATABASE_URL -c "
  SELECT
    analysis_date,
    SUM(transactions_analyzed) as transactions,
    SUM(estimated_cost_usd)::numeric(10,4) as cost,
    (SUM(estimated_cost_usd) / NULLIF(SUM(transactions_analyzed), 0) * 1000)::numeric(10,4) as cost_per_1000
  FROM ai_analysis_costs
  WHERE tenant_id = '$TENANT_ID'
  GROUP BY analysis_date
  ORDER BY analysis_date DESC;
"
```

### 6.3 Cost Projection

```bash
# If you have 5000 transactions cached
TOTAL_TRANSACTIONS=$(curl -s "http://localhost:3000/api/audit/cached-transactions?tenantId=$TENANT_ID&page=1" | jq '.summary.totalTransactions')

echo "Total transactions: $TOTAL_TRANSACTIONS"
echo "Estimated full analysis cost: \$$(echo "scale=4; $TOTAL_TRANSACTIONS * 0.000375" | bc)"
```

---

## Step 7: Troubleshooting

### Issue: Sync Stuck at 0%

**Check:**
```bash
# View server logs
npm run dev

# Check for errors in sync status
psql $DATABASE_URL -c "SELECT error_message FROM audit_sync_status WHERE tenant_id = '$TENANT_ID';"

# Verify Xero token not expired
curl http://localhost:3000/api/xero/organizations | jq '.'
```

**Solution:**
- Refresh Xero connection if token expired
- Check Xero API rate limits
- Review server console for errors

### Issue: Analysis Fails

**Check:**
```bash
# Verify Google AI API key
echo $GOOGLE_AI_API_KEY

# Test Google AI directly (optional)
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_AI_API_KEY"

# Check analysis status for errors
curl -s "http://localhost:3000/api/audit/analysis-status/$TENANT_ID" | jq '.errorMessage'
```

**Solution:**
- Verify Google AI API key is valid
- Check API quota/billing enabled
- Review server logs for specific errors

### Issue: Validators Failing

**Check:**
```bash
# Check Python is installed
python3 --version

# Test validator directly with sample data
echo '{"test": "data"}' | python3 .claude/hooks/validators/csv_validator.py

# Check validator logs
cat .claude/hooks/logs/validation_logs/*_$(date +%Y%m%d).log
```

**Solution:**
- Ensure Python 3 is installed
- Check validator file permissions
- Review validation log errors

### Issue: Database Connection

**Check:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check if tables exist
psql $DATABASE_URL -c "\dt"
```

**Solution:**
- Verify DATABASE_URL in .env.local
- Apply migrations if tables missing
- Check Supabase project status

---

## Step 8: Full Test Script

Save this as `test-phases-1-2.sh`:

```bash
#!/bin/bash

set -e  # Exit on error

echo "==================================="
echo "Testing Phases 1 & 2"
echo "==================================="
echo ""

# Check prerequisites
if [ -z "$TENANT_ID" ]; then
  echo "❌ TENANT_ID not set"
  echo "Run: export TENANT_ID=your-tenant-id"
  exit 1
fi

echo "✅ Tenant ID: $TENANT_ID"
echo ""

# Test Phase 1: Historical Sync
echo "--- Phase 1: Historical Sync ---"
echo "Starting sync (1 year)..."

SYNC_RESPONSE=$(curl -s -X POST http://localhost:3000/api/audit/sync-historical \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\": \"$TENANT_ID\", \"years\": 1}")

echo $SYNC_RESPONSE | jq '.'

# Wait for sync to complete
echo ""
echo "Waiting for sync to complete..."
while true; do
  STATUS=$(curl -s "http://localhost:3000/api/audit/sync-status/$TENANT_ID")
  IS_COMPLETE=$(echo $STATUS | jq -r '.isComplete')
  IS_ERROR=$(echo $STATUS | jq -r '.isError')
  PROGRESS=$(echo $STATUS | jq -r '.progress')

  echo "Progress: $PROGRESS%"

  if [ "$IS_COMPLETE" = "true" ]; then
    echo "✅ Sync complete!"
    break
  fi

  if [ "$IS_ERROR" = "true" ]; then
    echo "❌ Sync failed:"
    echo $STATUS | jq '.errorMessage'
    exit 1
  fi

  sleep 5
done

# Verify cached data
echo ""
echo "Cached transactions:"
curl -s "http://localhost:3000/api/audit/cached-transactions?tenantId=$TENANT_ID&page=1" | jq '.summary'

# Test Phase 2: AI Analysis
echo ""
echo "--- Phase 2: AI Analysis ---"
echo "Starting analysis (batch size 20)..."

ANALYSIS_RESPONSE=$(curl -s -X POST http://localhost:3000/api/audit/analyze \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\": \"$TENANT_ID\", \"batchSize\": 20}")

echo $ANALYSIS_RESPONSE | jq '.'

# Wait for analysis to complete
echo ""
echo "Waiting for analysis to complete..."
while true; do
  STATUS=$(curl -s "http://localhost:3000/api/audit/analysis-status/$TENANT_ID")
  IS_COMPLETE=$(echo $STATUS | jq -r '.isComplete')
  IS_ERROR=$(echo $STATUS | jq -r '.isError')
  PROGRESS=$(echo $STATUS | jq -r '.progress')

  echo "Progress: $PROGRESS%"

  if [ "$IS_COMPLETE" = "true" ]; then
    echo "✅ Analysis complete!"
    break
  fi

  if [ "$IS_ERROR" = "true" ]; then
    echo "❌ Analysis failed:"
    echo $STATUS | jq '.errorMessage'
    exit 1
  fi

  sleep 15
done

# Get results
echo ""
echo "Analysis summary:"
curl -s "http://localhost:3000/api/audit/analysis-results?tenantId=$TENANT_ID&page=1" | jq '.summary'

echo ""
echo "✅ All tests passed!"
```

Make executable and run:
```bash
chmod +x test-phases-1-2.sh
./test-phases-1-2.sh
```

---

## Success Criteria

### Phase 1: Historical Sync ✅
- [ ] Sync completes with status="complete"
- [ ] Progress reaches 100%
- [ ] Transactions cached in database
- [ ] No errors in sync_status.error_message
- [ ] Financial year validation passes
- [ ] Data integrity validation passes

### Phase 2: AI Analysis ✅
- [ ] Analysis completes with status="complete"
- [ ] Progress reaches 100%
- [ ] Results stored in forensic_analysis_results table
- [ ] R&D candidates identified (>0)
- [ ] Average confidence score ≥ 60%
- [ ] Cost tracking recorded
- [ ] No errors in analysis status

---

## Next Steps After Testing

**If Tests Pass:**
✅ Proceed to Phase 3 (Tax Engines)

**If Tests Fail:**
1. Review error messages
2. Check troubleshooting section
3. Verify prerequisites
4. Check validation logs
5. Review server logs

---

## Quick Reference

**Get Tenant ID:**
```bash
curl http://localhost:3000/api/xero/organizations | jq -r '.[0].tenantId'
```

**Check Sync Status:**
```bash
curl -s "http://localhost:3000/api/audit/sync-status/$TENANT_ID" | jq '.'
```

**Check Analysis Status:**
```bash
curl -s "http://localhost:3000/api/audit/analysis-status/$TENANT_ID" | jq '.'
```

**Get Results Summary:**
```bash
curl -s "http://localhost:3000/api/audit/analysis-results?tenantId=$TENANT_ID&page=1" | jq '.summary'
```

---

Good luck with testing! 🚀
