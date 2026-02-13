---
description: Validate entities via the Australian Business Register API
---

# /abn-lookup - ABN Lookup Workflow

Validates entity details through the Australian Business Register (ABR) API. Checks ABN validity, entity type, GST registration status, and trading name.

## Quick Commands

```bash
/abn-lookup 62580077456          # Lookup by ABN
/abn-lookup "DR Pty Ltd"         # Search by name
/abn-lookup --batch              # Batch validate all Xero contacts
```

## Workflow Steps

### Step 1: Validate Input
- Check ABN format (11-digit, passes check digit algorithm)
- Or prepare name search query

### Step 2: Query ABR API
- Call `searchByAbn()` or `searchByName()` from `lib/integrations/abn-lookup.ts`
- Handle rate limiting (ABR API limits apply)

### Step 3: Extract Entity Details
- Entity name and trading name(s)
- Entity type (individual, company, trust, partnership, etc.)
- ABN status (active, cancelled)
- GST registration status and date
- State/territory of registration
- Main business location

### Step 4: Determine Tax Implications
- Entity type affects: tax rate, amendment period, loss rules
- GST status affects: BAS obligations, input credit eligibility
- Active/cancelled affects: whether payments are deductible

### Step 5: Cache Result
- Store in `abn_lookup_cache` table (24-hour TTL)
- No tenant scoping — ABR data is public

### Step 6: Return Result
- Full entity profile
- Tax implications summary
- GST registration confirmation

## Skill Used

Uses the `abn_entity_lookup` skill directly — no dedicated agent required.

## Integration

`lib/integrations/abn-lookup.ts` — `searchByAbn()`, `searchByName()`, `searchByAcn()`

## API

`POST /api/integrations/abn-lookup`
