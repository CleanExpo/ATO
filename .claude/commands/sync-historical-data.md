---
name: sync-historical-data
description: Fetch and cache 5 years of Xero historical data with validation
hint: Sync 5 years of Xero transactions
tools: [Bash, Read, Write]
model_invocable: true
context_fork: false

hooks:
  post_tool_use:
    - tool: Write
      command: python3 {{claude.project_path}}/.claude/hooks/validators/xero_data_validator.py {{tool.args.file_path}}
      once: false
      matcher:
        pattern: ".*\\.json$"
        field: "file_path"
    - tool: Write
      command: python3 {{claude.project_path}}/.claude/hooks/validators/financial_year_validator.py {{tool.args.file_path}}
      once: false
      matcher:
        pattern: "financial_year|fy_"
        field: "file_path"

  stop:
    - command: python3 {{claude.project_path}}/.claude/hooks/validators/data_integrity_validator.py
      once: true
---

# Sync Historical Xero Data

## Purpose
Fetch and cache 5 years of Xero historical transactions with automatic validation at every step.

This command initiates a long-running sync process that:
1. Fetches transactions from Xero API (paginated)
2. Caches raw data in database (JSONB)
3. Tracks progress in real-time
4. Validates data integrity

## Workflow

### 1. Validate Connection
Check that Xero token is valid and not expired.

```bash
# Get tenant ID from Xero connection
curl http://localhost:3000/api/xero/organizations
```

### 2. Start Sync
Call the sync API with tenant ID:

```bash
curl -X POST http://localhost:3000/api/audit/sync-historical \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "YOUR_TENANT_ID",
    "years": 5,
    "forceResync": false
  }'
```

### 3. Monitor Progress
Poll the status endpoint to track progress:

```bash
# Poll every 5 seconds
while true; do
  curl http://localhost:3000/api/audit/sync-status/YOUR_TENANT_ID
  sleep 5
done
```

### 4. Verify Cache
Once complete, check cached data:

```bash
curl "http://localhost:3000/api/audit/cached-transactions?tenantId=YOUR_TENANT_ID&page=1&pageSize=10"
```

## Validation Points

The sync process automatically validates at multiple checkpoints:

### During Sync
- **After writing cache data** → `xero_data_validator.py`
  - Validates Xero API response structure
  - Checks required fields (transaction_id, date, amount)
  - Verifies no pagination errors

- **During FY calculation** → `financial_year_validator.py`
  - Validates financial year format (FY2024-25)
  - Checks date ranges (July 1 - June 30)
  - Ensures consecutive years

### On Completion
- **After all years synced** → `data_integrity_validator.py`
  - Validates cross-year consistency
  - Checks closing balance year N = opening balance year N+1
  - Ensures no duplicate transactions
  - Verifies organization consistency

## API Endpoints

### Start Sync
```
POST /api/audit/sync-historical
Body: {
  "tenantId": string (required),
  "years": number (1-10, default: 5),
  "forceResync": boolean (default: false)
}

Response: {
  "status": "syncing",
  "progress": 0,
  "transactionsSynced": 0,
  "totalEstimated": 5000,
  "message": "Started syncing...",
  "pollUrl": "/api/audit/sync-status/:tenantId"
}
```

### Get Status
```
GET /api/audit/sync-status/:tenantId

Response: {
  "status": "syncing" | "complete" | "error",
  "progress": 45.5,
  "transactionsSynced": 2275,
  "totalEstimated": 5000,
  "currentYear": "FY2022-23",
  "yearsSynced": ["FY2024-25", "FY2023-24"],
  "eta": "5 minutes",
  "isComplete": false,
  "isSyncing": true,
  "isError": false
}
```

### Get Cached Data
```
GET /api/audit/cached-transactions?tenantId=xxx&financialYear=FY2024-25&page=1

Response: {
  "transactions": [...],
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "total": 2500,
    "totalPages": 25,
    "hasMore": true
  },
  "summary": {
    "totalAmount": 1250000.00,
    "transactionCount": 100,
    "totalTransactions": 2500,
    "dateRange": {
      "from": "2024-07-01",
      "to": "2025-06-30"
    },
    "byFinancialYear": {
      "FY2024-25": 2500
    }
  }
}
```

## Arguments

### tenantId (required)
The Xero tenant ID for the organization to sync.

Get from: `GET /api/xero/organizations`

### years (optional, default: 5)
Number of financial years to fetch.

- Minimum: 1
- Maximum: 10
- Recommended: 5 (for comprehensive audit)

### forceResync (optional, default: false)
Skip cache and re-fetch all data from Xero.

Use when:
- Data has changed in Xero
- Cache is corrupted
- Testing sync process

## Success Criteria

A successful sync must pass all these checks:

- ✅ All 5 years fetched without pagination errors
- ✅ No duplicate transactions (validated by `data_integrity_validator`)
- ✅ All transaction IDs unique per tenant
- ✅ Closing/opening balances match year-over-year
- ✅ Financial year date ranges valid (July 1 - June 30)
- ✅ All Xero API responses valid (validated by `xero_data_validator`)
- ✅ All validators pass

## Error Handling

### Sync Fails
If sync fails, check:

1. **Error message** in status response
   ```bash
   curl http://localhost:3000/api/audit/sync-status/YOUR_TENANT_ID | jq .errorMessage
   ```

2. **Validation logs** for specific issues
   ```bash
   cat .claude/hooks/logs/validation_logs/xero_data_validator_$(date +%Y%m%d).log
   cat .claude/hooks/logs/validation_logs/data_integrity_validator_$(date +%Y%m%d).log
   ```

3. **Database status** table
   ```sql
   SELECT * FROM audit_sync_status WHERE tenant_id = 'YOUR_TENANT_ID';
   ```

### Common Issues

**Token expired**:
- Solution: Refresh token automatically handled, but check Xero connection

**Rate limit hit**:
- Solution: Retry with exponential backoff (automatic)

**Network timeout**:
- Solution: Resume capability (automatic from last synced year)

**Validation failed**:
- Solution: Check validator logs for specific fix instructions

## Performance

### Expected Duration
- **1,000 transactions**: ~2 minutes
- **5,000 transactions**: ~10 minutes
- **10,000 transactions**: ~20 minutes

Factors affecting speed:
- Number of transactions
- Xero API rate limits
- Network latency
- Database write speed

### Optimization
The sync process is optimized with:
- Batch inserts (100 transactions per batch)
- Upsert logic (no duplicates)
- Pagination (100 items per page)
- Retry logic (3 attempts with backoff)

## Next Steps

After sync is complete:

1. **Run AI Analysis**
   ```bash
   # Phase 2: Analyze transactions with Google AI
   # (to be implemented)
   ```

2. **Generate Findings**
   ```bash
   # Phase 3: Run tax-specific analysis engines
   # (to be implemented)
   ```

3. **Create Reports**
   ```bash
   # Phase 5: Generate PDF/Excel reports
   # (to be implemented)
   ```

## Example Usage

```bash
# 1. Get tenant ID
TENANT_ID=$(curl -s http://localhost:3000/api/xero/organizations | jq -r '.[0].tenantId')

# 2. Start sync
curl -X POST http://localhost:3000/api/audit/sync-historical \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\": \"$TENANT_ID\", \"years\": 5}"

# 3. Watch progress
watch -n 5 "curl -s http://localhost:3000/api/audit/sync-status/$TENANT_ID | jq '.'"

# 4. When complete, view cached data
curl "http://localhost:3000/api/audit/cached-transactions?tenantId=$TENANT_ID&page=1" | jq '.'
```

## Troubleshooting

### Sync stuck at 0%
- Check Xero connection is valid
- Verify tenant ID is correct
- Check server logs for errors

### Validator errors
- Check `.claude/hooks/logs/validation_logs/` for details
- Run validators manually to debug
- Verify input data format

### Database errors
- Check migrations are applied: `supabase db reset`
- Verify table structure: `\d historical_transactions_cache`
- Check for constraint violations

---

**Note**: This is a long-running operation (5-10 minutes for 5 years). The API starts the sync in the background and returns immediately. Poll the status endpoint for progress updates.
