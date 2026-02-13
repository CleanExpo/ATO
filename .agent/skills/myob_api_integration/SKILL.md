---
name: myob-api-integration
description: Read-only MYOB AccountRight and Essentials API access for historical transaction data extraction
---

# MYOB API Integration Skill

Provides read-only access to MYOB accounting data through the MYOB API. Extracts historical transactions, chart of accounts, contacts, and financial reports for tax analysis.

## When to Use

- Connecting a MYOB client for tax analysis (instead of Xero)
- Extracting historical transaction data from MYOB
- Fetching chart of accounts for GL mapping
- Pulling profit & loss and balance sheet reports
- Multi-year data sync for carry-forward analysis

## Integration Architecture

```
MYOB API → myob-adapter.ts → canonical-schema.ts → analysis engines
```

All MYOB data is normalised to the canonical schema (`lib/integrations/canonical-schema.ts`) before being consumed by analysis engines. This ensures all 16 engines work identically regardless of whether data comes from Xero, MYOB, or QuickBooks.

## Key Files

- **Adapter**: `lib/integrations/adapters/myob-adapter.ts` — MYOB API client
- **Historical Fetcher**: `lib/integrations/myob-historical-fetcher.ts` — Multi-year data sync
- **Canonical Schema**: `lib/integrations/canonical-schema.ts` — Normalised data model
- **Config**: `lib/integrations/myob-config.ts` — OAuth configuration
- **Auth Route**: `app/api/auth/myob/route.ts` — OAuth 2.0 callback

## Access Scopes

All access is **read-only**:
- General Ledger transactions
- Chart of accounts
- Contacts
- Bank transactions
- Payroll data (if available)

## Data Normalisation

| MYOB Field | Canonical Field | Notes |
|------------|----------------|-------|
| UID | externalId | MYOB unique identifier |
| DisplayID | reference | Account/transaction code |
| Date | date | ISO 8601 |
| Total/Amount | amount | Decimal precision preserved |
| Account.DisplayID | accountCode | GL account code |
| Contact.DisplayID | contactId | Contact reference |

## OAuth Flow

1. User clicks "Connect MYOB"
2. Redirect to MYOB OAuth consent screen
3. User grants read-only access
4. Callback stores encrypted tokens
5. Select company file (MYOB-specific)
6. Begin historical data sync
