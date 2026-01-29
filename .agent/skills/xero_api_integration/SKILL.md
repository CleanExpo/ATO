---
name: xero-api-integration
description: Read-only Xero API integration for extracting financial data, reports, and transactions. OAuth 2.0 authentication with minimal required scopes for accounting analysis.
---

# Xero API Integration Skill

Secure, read-only integration with Xero accounting software for financial data extraction and analysis.

## When to Use

Activate this skill when the task requires:
- Extracting financial data from Xero
- Generating accounting reports
- Analyzing transaction history
- Auditing chart of accounts
- Reviewing asset registers

## ⚠️ CRITICAL CONSTRAINT

**READ-ONLY OPERATION**
- Only read scopes are authorized
- NEVER modify any Xero data
- All changes are recommendations only

## OAuth 2.0 Authentication

### Required Scopes
```
offline_access              # For refresh token
accounting.transactions.read # Bank transactions, invoices, payments
accounting.reports.read      # Financial reports
accounting.contacts.read     # Suppliers and customers
accounting.settings          # Chart of accounts, organization info
openid profile email         # User identity
```

### Authorization Flow
```
┌─────────────────────────────────────────────────────────────────┐
│ 1. REDIRECT USER                                                │
│    https://login.xero.com/identity/connect/authorize            │
│    ?client_id={CLIENT_ID}                                       │
│    &redirect_uri={REDIRECT_URI}                                 │
│    &scope=offline_access accounting.transactions.read           │
│           accounting.reports.read accounting.contacts.read      │
│           accounting.settings openid profile email              │
│    &response_type=code                                          │
│    &state={STATE}                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. USER AUTHORIZES                                              │
│    User logs into Xero                                          │
│    Grants read-only access to organization                      │
│    Xero redirects to REDIRECT_URI with authorization code       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. EXCHANGE CODE FOR TOKENS                                     │
│    POST https://identity.xero.com/connect/token                 │
│    Body: grant_type=authorization_code                          │
│          code={AUTH_CODE}                                       │
│          redirect_uri={REDIRECT_URI}                            │
│    Headers: Authorization: Basic {base64(client_id:secret)}     │
│                                                                 │
│    Response: access_token, refresh_token, expires_in            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. GET TENANT ID                                                │
│    GET https://api.xero.com/connections                         │
│    Headers: Authorization: Bearer {access_token}                │
│                                                                 │
│    Response: [{ tenantId, tenantType, tenantName }]             │
└─────────────────────────────────────────────────────────────────┘
```

### Token Refresh
```
POST https://identity.xero.com/connect/token
Body: grant_type=refresh_token
      refresh_token={REFRESH_TOKEN}
Headers: Authorization: Basic {base64(client_id:secret)}
```

## API Endpoints

### Organization Information
```http
GET https://api.xero.com/api.xro/2.0/Organisation
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
```

### Chart of Accounts
```http
GET https://api.xero.com/api.xro/2.0/Accounts
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
```

### Bank Transactions
```http
GET https://api.xero.com/api.xro/2.0/BankTransactions
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
Parameters:
  - where: Date>=DateTime(2024,07,01)
  - page: 1
```

### Invoices
```http
GET https://api.xero.com/api.xro/2.0/Invoices
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
Parameters:
  - where: Type=="ACCREC" AND Status!="DELETED"
  - page: 1
```

### Manual Journals
```http
GET https://api.xero.com/api.xro/2.0/ManualJournals
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
```

### Payments
```http
GET https://api.xero.com/api.xro/2.0/Payments
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
```

### Trial Balance Report
```http
GET https://api.xero.com/api.xro/2.0/Reports/TrialBalance
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
Parameters:
  - date: 2024-06-30
```

### Profit and Loss Report
```http
GET https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
Parameters:
  - fromDate: 2023-07-01
  - toDate: 2024-06-30
```

### Balance Sheet Report
```http
GET https://api.xero.com/api.xro/2.0/Reports/BalanceSheet
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
Parameters:
  - date: 2024-06-30
```

### Fixed Assets
```http
GET https://api.xero.com/assets.xro/1.0/Assets
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
```

### Contacts
```http
GET https://api.xero.com/api.xro/2.0/Contacts
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
```

## Data Extraction Process

```
┌────────────────────────────────────────────────────────────────┐
│                    1. AUTHENTICATE                             │
│ • Validate access token (refresh if expired)                   │
│ • Confirm tenant ID                                            │
│ • Verify organization access                                   │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                    2. EXTRACT STRUCTURE                        │
│ • Fetch Organization info                                      │
│ • Fetch Chart of Accounts                                      │
│ • Identify account types and structure                         │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                    3. EXTRACT REPORTS                          │
│ • Trial Balance (per FY)                                       │
│ • Profit & Loss (per FY)                                       │
│ • Balance Sheet (current)                                      │
│ • Cache for analysis                                           │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                    4. EXTRACT TRANSACTIONS                     │
│ • Bank Transactions (paginated)                                │
│ • Invoices                                                     │
│ • Manual Journals                                              │
│ • Payments                                                     │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                    5. EXTRACT ASSETS                           │
│ • Fixed Asset Register                                         │
│ • Depreciation schedules                                       │
└────────────────────────────────────────────────────────────────┘
```

## Rate Limiting

| Limit Type | Value |
|------------|-------|
| Daily limit | 5,000 calls per tenant |
| Minute limit | 60 calls per minute |
| Concurrent limit | 4 pending requests |

**Best Practices:**
- Implement exponential backoff
- Cache responses where appropriate
- Use pagination efficiently
- Monitor rate limit headers

## Error Handling

| Error | HTTP Code | Recovery |
|-------|-----------|----------|
| Token expired | 401 | Refresh token |
| Rate limited | 429 | Wait and retry |
| Not found | 404 | Check endpoint/params |
| Forbidden | 403 | Check scopes |
| Server error | 500+ | Retry with backoff |

## Security Requirements

1. **Token Storage**
   - Encrypt tokens at rest
   - Never log access tokens
   - Secure refresh token storage

2. **API Calls**
   - HTTPS only
   - Validate SSL certificates
   - Log API calls (not tokens)

3. **Authorization**
   - Request minimal scopes
   - Verify tenant access
   - Handle revocation gracefully

## Output Data Structure

```typescript
interface XeroExtraction {
  organization: {
    name: string;
    abn: string;
    financialYearEndMonth: number;
  };
  
  accounts: Account[];
  
  reports: {
    trialBalance: Map<FY, Report>;
    profitAndLoss: Map<FY, Report>;
    balanceSheet: Report;
  };
  
  transactions: {
    bankTransactions: BankTransaction[];
    invoices: Invoice[];
    manualJournals: ManualJournal[];
    payments: Payment[];
  };
  
  assets: FixedAsset[];
  
  contacts: Contact[];
  
  metadata: {
    extractedAt: Date;
    financialYears: FY[];
    transactionCount: number;
  };
}
```

## Financial Year Handling

```typescript
// Australian Financial Year: 1 July - 30 June
function getFinancialYear(date: Date): string {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  
  if (month >= 6) { // July onwards
    return `FY${year}-${(year + 1).toString().slice(2)}`;
  } else {
    return `FY${year - 1}-${year.toString().slice(2)}`;
  }
}

// FY2024-25: 1 Jul 2024 - 30 Jun 2025
```
