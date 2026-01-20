# API Documentation - Forensic Tax Audit System

**Version**: 1.0
**Last Updated**: 2026-01-20

---

## Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

---

## Authentication

**Current**: Single-user mode (no authentication required)
**Future**: Multi-tenant with user authentication

All endpoints require a valid Xero connection to be established first:
- Connect via: `GET /api/auth/xero`
- Callback: `GET /api/auth/xero/callback`

---

## Endpoints Overview

### Xero Connection
- `GET /api/auth/xero` - Initiate Xero OAuth
- `GET /api/auth/xero/callback` - OAuth callback
- `GET /api/xero/organizations` - Get connected organizations

### Historical Data Sync (Phase 1)
- `POST /api/audit/sync-historical` - Start sync
- `GET /api/audit/sync-status/:tenantId` - Get sync progress
- `GET /api/audit/cached-transactions` - Get cached data

### AI Analysis (Phase 2 - Coming Soon)
- `POST /api/audit/analyze` - Start AI analysis
- `GET /api/audit/analysis-status/:tenantId` - Get analysis progress
- `GET /api/audit/analysis-results` - Get analysis results

### Tax Engines (Phase 3 - Coming Soon)
- `GET /api/audit/rnd-opportunities` - R&D tax incentive findings
- `GET /api/audit/deduction-opportunities` - Unclaimed deductions
- `GET /api/audit/loss-analysis` - Loss carry-forward analysis
- `GET /api/audit/div7a-compliance` - Division 7A compliance

### Recommendations (Phase 4 - Coming Soon)
- `GET /api/audit/recommendations` - Get prioritized recommendations
- `POST /api/audit/recommendations/:id/status` - Update status

### Reports (Phase 5 - Coming Soon)
- `POST /api/audit/reports/generate` - Generate PDF/Excel
- `GET /api/audit/reports/:id/download` - Download report

---

## Detailed Endpoint Documentation

### 1. Start Historical Sync

**Endpoint**: `POST /api/audit/sync-historical`

**Description**: Initiates a background sync of 5 years of Xero transactions. This is a long-running operation (5-10 minutes).

**Request Body**:
```typescript
{
  tenantId: string      // Required: Xero tenant ID
  years?: number        // Optional: 1-10, default: 5
  forceResync?: boolean // Optional: Skip cache, default: false
}
```

**Response**: 200 OK
```typescript
{
  status: 'syncing'
  progress: number           // 0-100
  transactionsSynced: number
  totalEstimated: number
  message: string
  pollUrl: string            // URL to poll for status
}
```

**Error Responses**:
- `400` - Invalid tenant ID or parameters
- `404` - Xero connection not found
- `500` - Internal server error

**Example**:
```bash
curl -X POST http://localhost:3000/api/audit/sync-historical \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "abc-123-def",
    "years": 5
  }'
```

**Response**:
```json
{
  "status": "syncing",
  "progress": 0,
  "transactionsSynced": 0,
  "totalEstimated": 5000,
  "message": "Started syncing 5 years of historical data. Poll /api/audit/sync-status/abc-123-def for progress.",
  "pollUrl": "/api/audit/sync-status/abc-123-def"
}
```

**Notes**:
- Sync runs in background (returns immediately)
- Poll status endpoint every 5 seconds for updates
- Duplicate sync requests return existing status
- Auto-refreshes expired Xero tokens

---

### 2. Get Sync Status

**Endpoint**: `GET /api/audit/sync-status/:tenantId`

**Description**: Get real-time sync progress for polling.

**Path Parameters**:
- `tenantId` (required) - Xero tenant ID

**Response**: 200 OK
```typescript
{
  status: 'idle' | 'syncing' | 'complete' | 'error'
  progress: number           // 0-100
  transactionsSynced: number
  totalEstimated: number
  currentYear?: string       // e.g., 'FY2022-23'
  yearsSynced: string[]      // ['FY2024-25', 'FY2023-24']
  errorMessage?: string
  eta?: string               // e.g., '3 minutes'
  message: string
  isComplete: boolean
  isSyncing: boolean
  isError: boolean
}
```

**Status Values**:
- `idle` - No sync started yet
- `syncing` - Sync in progress
- `complete` - Sync finished successfully
- `error` - Sync failed (check errorMessage)

**Example**:
```bash
curl http://localhost:3000/api/audit/sync-status/abc-123-def
```

**Response (Syncing)**:
```json
{
  "status": "syncing",
  "progress": 65.5,
  "transactionsSynced": 3275,
  "totalEstimated": 5000,
  "currentYear": "FY2022-23",
  "yearsSynced": ["FY2024-25", "FY2023-24"],
  "eta": "3 minutes",
  "message": "Syncing historical data... 65.5% complete",
  "isComplete": false,
  "isSyncing": true,
  "isError": false
}
```

**Response (Complete)**:
```json
{
  "status": "complete",
  "progress": 100,
  "transactionsSynced": 5234,
  "totalEstimated": 5234,
  "yearsSynced": ["FY2024-25", "FY2023-24", "FY2022-23", "FY2021-22", "FY2020-21"],
  "message": "Historical data sync complete - ready for analysis",
  "isComplete": true,
  "isSyncing": false,
  "isError": false
}
```

**Polling Recommendation**:
```javascript
// Poll every 5 seconds
const pollStatus = async (tenantId) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/audit/sync-status/${tenantId}`)
    const status = await response.json()

    console.log(`Progress: ${status.progress}%`)

    if (status.isComplete) {
      clearInterval(interval)
      console.log('Sync complete!')
    }

    if (status.isError) {
      clearInterval(interval)
      console.error('Sync failed:', status.errorMessage)
    }
  }, 5000) // 5 seconds
}
```

---

### 3. Get Cached Transactions

**Endpoint**: `GET /api/audit/cached-transactions`

**Description**: Retrieve cached historical transactions after sync is complete.

**Query Parameters**:
- `tenantId` (required) - Xero tenant ID
- `financialYear` (optional) - Filter by FY (e.g., 'FY2024-25')
- `page` (optional) - Page number, default: 1
- `pageSize` (optional) - Items per page, default: 100, max: 1000

**Response**: 200 OK
```typescript
{
  transactions: Array<{
    transactionID: string
    type: string              // ACCPAY, ACCREC, BANK
    date: string
    reference?: string
    contact?: {
      name: string
      contactID: string
    }
    lineItems: Array<{
      description?: string
      quantity?: number
      unitAmount?: number
      accountCode?: string
      taxType?: string
      lineAmount: number
    }>
    total: number
    status: string
    // ... full Xero transaction object
  }>
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasMore: boolean
  }
  summary: {
    totalAmount: number
    transactionCount: number
    totalTransactions: number
    dateRange: {
      from: string
      to: string
    }
    byFinancialYear: Record<string, number>
  }
}
```

**Example**:
```bash
# Get first page (100 transactions)
curl "http://localhost:3000/api/audit/cached-transactions?tenantId=abc-123-def&page=1"

# Get FY2024-25 only
curl "http://localhost:3000/api/audit/cached-transactions?tenantId=abc-123-def&financialYear=FY2024-25"

# Get more per page
curl "http://localhost:3000/api/audit/cached-transactions?tenantId=abc-123-def&pageSize=500"
```

**Response**:
```json
{
  "transactions": [
    {
      "transactionID": "xyz-789",
      "type": "ACCPAY",
      "date": "2024-08-15T00:00:00.000Z",
      "reference": "INV-001",
      "contact": {
        "name": "ABC Supplier",
        "contactID": "contact-123"
      },
      "lineItems": [
        {
          "description": "Software development services",
          "quantity": 1,
          "unitAmount": 1250.00,
          "accountCode": "500",
          "taxType": "INPUT",
          "lineAmount": 1250.00
        }
      ],
      "total": 1375.00,
      "status": "PAID"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "total": 5234,
    "totalPages": 53,
    "hasMore": true
  },
  "summary": {
    "totalAmount": 125000.00,
    "transactionCount": 100,
    "totalTransactions": 5234,
    "dateRange": {
      "from": "2019-07-01",
      "to": "2024-06-30"
    },
    "byFinancialYear": {
      "FY2024-25": 1200,
      "FY2023-24": 1150,
      "FY2022-23": 1100,
      "FY2021-22": 1084,
      "FY2020-21": 700
    }
  }
}
```

**Error Responses**:
- `400` - Missing tenantId or invalid parameters
- `500` - Database error

---

## Error Handling

### Standard Error Response

All endpoints return errors in this format:

```typescript
{
  error: {
    message: string        // Human-readable error message
    code?: string         // Error code (e.g., 'VALIDATION_ERROR')
    details?: any         // Additional error details
    operation?: string    // Operation that failed
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid request parameters
- `NOT_FOUND` - Resource not found (e.g., tenant)
- `UNAUTHORIZED` - Authentication required (future)
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `XERO_API_ERROR` - Xero API returned error
- `DATABASE_ERROR` - Database operation failed
- `INTERNAL_ERROR` - Unexpected server error

### Example Error Response

```json
{
  "error": {
    "message": "tenantId is required and must be a string",
    "code": "VALIDATION_ERROR",
    "operation": "startHistoricalSync"
  }
}
```

---

## Rate Limits

### Current Limits
- **Xero API**: 5 requests/second (enforced by Xero)
- **Our API**: No limits (single-user mode)

### Future Limits (Multi-tenant)
- **Historical Sync**: 1 concurrent sync per tenant
- **API Calls**: 100 requests/minute per user
- **Analysis**: 5 concurrent analyses per tenant

---

## Webhooks (Future)

### Planned Webhook Events
- `sync.started` - Historical sync started
- `sync.completed` - Historical sync completed
- `sync.failed` - Historical sync failed
- `analysis.completed` - AI analysis completed
- `recommendation.created` - New recommendation generated

### Webhook Payload Example
```json
{
  "event": "sync.completed",
  "timestamp": "2024-08-15T10:30:00Z",
  "tenantId": "abc-123-def",
  "data": {
    "transactionsSynced": 5234,
    "yearsSynced": ["FY2024-25", "FY2023-24", "FY2022-23", "FY2021-22", "FY2020-21"]
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import fetch from 'node-fetch'

class AuditAPI {
  constructor(private baseUrl: string) {}

  async startSync(tenantId: string, years: number = 5) {
    const response = await fetch(`${this.baseUrl}/api/audit/sync-historical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, years })
    })
    return response.json()
  }

  async pollStatus(tenantId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/audit/sync-status/${tenantId}`)
    return response.json()
  }

  async waitForSync(tenantId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        const status = await this.pollStatus(tenantId)

        if (status.isComplete) {
          clearInterval(interval)
          resolve()
        }

        if (status.isError) {
          clearInterval(interval)
          reject(new Error(status.errorMessage))
        }
      }, 5000)
    })
  }

  async getCachedTransactions(tenantId: string, page: number = 1) {
    const response = await fetch(
      `${this.baseUrl}/api/audit/cached-transactions?tenantId=${tenantId}&page=${page}`
    )
    return response.json()
  }
}

// Usage
const api = new AuditAPI('http://localhost:3000')

// Start sync
await api.startSync('tenant-123', 5)

// Wait for completion
await api.waitForSync('tenant-123')

// Get cached data
const data = await api.getCachedTransactions('tenant-123')
console.log(`Cached ${data.summary.totalTransactions} transactions`)
```

### Python

```python
import requests
import time

class AuditAPI:
    def __init__(self, base_url):
        self.base_url = base_url

    def start_sync(self, tenant_id, years=5):
        response = requests.post(
            f"{self.base_url}/api/audit/sync-historical",
            json={"tenantId": tenant_id, "years": years}
        )
        return response.json()

    def poll_status(self, tenant_id):
        response = requests.get(
            f"{self.base_url}/api/audit/sync-status/{tenant_id}"
        )
        return response.json()

    def wait_for_sync(self, tenant_id):
        while True:
            status = self.poll_status(tenant_id)

            if status['isComplete']:
                return status

            if status['isError']:
                raise Exception(status['errorMessage'])

            print(f"Progress: {status['progress']}%")
            time.sleep(5)

    def get_cached_transactions(self, tenant_id, page=1):
        response = requests.get(
            f"{self.base_url}/api/audit/cached-transactions",
            params={"tenantId": tenant_id, "page": page}
        )
        return response.json()

# Usage
api = AuditAPI('http://localhost:3000')

# Start sync
api.start_sync('tenant-123', 5)

# Wait for completion
status = api.wait_for_sync('tenant-123')
print(f"Sync complete: {status['transactionsSynced']} transactions")

# Get cached data
data = api.get_cached_transactions('tenant-123')
print(f"Cached {data['summary']['totalTransactions']} transactions")
```

---

## Testing

### Postman Collection

Import this collection into Postman:

```json
{
  "info": {
    "name": "Forensic Tax Audit API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Start Sync",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/audit/sync-historical",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"tenantId\": \"{{tenantId}}\",\n  \"years\": 5\n}"
        }
      }
    },
    {
      "name": "Get Status",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/audit/sync-status/{{tenantId}}"
      }
    },
    {
      "name": "Get Cached Transactions",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/audit/cached-transactions?tenantId={{tenantId}}&page=1"
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "tenantId",
      "value": "your-tenant-id"
    }
  ]
}
```

---

## Changelog

### Version 1.0 (2026-01-20)
- ✅ Initial release
- ✅ Historical sync endpoints
- ✅ Status polling
- ✅ Cached transaction retrieval
- ✅ Full documentation

### Upcoming (Phase 2)
- 🔲 AI analysis endpoints
- 🔲 Analysis status polling
- 🔲 Results retrieval

---

## Support

**Issues**: https://github.com/your-repo/issues
**Documentation**: `/IMPLEMENTATION_STATUS.md`
**API Reference**: This file (`API_DOCUMENTATION.md`)
