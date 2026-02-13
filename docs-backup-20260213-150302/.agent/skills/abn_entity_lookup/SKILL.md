---
name: abn-entity-lookup
description: Validates Australian Business Numbers (ABN) and retrieves entity details from the Australian Business Register (ABR) for compliance verification
---

# ABN Entity Lookup Skill

Queries the Australian Business Register (ABR) to validate ABNs, retrieve entity names, determine entity types, check GST registration status, and verify active/cancelled status. Essential for contractor deeming analysis, payroll tax compliance, and entity type determination.

## When to Use

- Validating a contractor's ABN before classifying payments
- Determining entity type (company, trust, sole trader, partnership) for tax rate selection
- Checking GST registration status for input tax credit eligibility
- Verifying ABN is active (not cancelled) before processing payments
- Populating entity details for new Xero organisation connections
- Cross-referencing Xero contact ABNs for data quality checks

## ABR API Configuration

### Endpoint

```
https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/ABRSearchByABN
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `searchString` | Yes | 11-digit ABN |
| `includeHistoricalDetails` | No | `Y` or `N` (default `N`) |
| `authenticationGuid` | Yes | ABR API GUID from env `ABR_GUID` |

### Alternative Endpoints

| Endpoint | Use Case |
|----------|----------|
| `ABRSearchByABN` | Lookup by ABN (primary) |
| `ABRSearchByASIC` | Lookup by ACN (9-digit) |
| `ABRSearchByName` | Search by entity name (fuzzy) |
| `ABRSearchByNameAdvanced` | Search with state/postcode filters |

## ABN Validation Rules

### Format Validation (Client-Side)

1. Must be exactly 11 digits
2. Apply ABN weighting algorithm:
   - Subtract 1 from the first digit
   - Multiply each digit by its weighting factor: [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
   - Sum the products
   - Result must be divisible by 89

### Example Validation

```
ABN: 51 824 753 556
Step 1: Subtract 1 from first digit → [4, 1, 8, 2, 4, 7, 5, 3, 5, 5, 6]
Step 2: Multiply by weights →          [40, 1, 24, 10, 28, 63, 55, 39, 75, 85, 114]
Step 3: Sum = 534
Step 4: 534 / 89 = 6.0 (exactly divisible) → VALID
```

## Entity Type Mapping

ABR returns entity type codes that map to tax treatment:

| ABR Entity Type | Code | Tax Rate | Amendment Period | Payroll Tax Grouping |
|----------------|------|----------|-----------------|---------------------|
| Australian Private Company | PRV | 25%/30% | 4 years | Related body corporate |
| Australian Public Company | PUB | 30% | 4 years | Related body corporate |
| Individual/Sole Trader | IND | Marginal rates | 2 years | N/A |
| Family Trust | TRT | Trustee rates | 4 years | Tracing provisions |
| Unit Trust | TRT | Trustee rates | 4 years | Tracing provisions |
| Partnership | PTR | Partner rates | 4 years | Common employees |
| SMSF | SMF | 15%/0% | 4 years | N/A |
| Government Entity | GOV | Exempt | N/A | Exempt |
| Non-Profit | NPF | Varies | 4 years | Charitable exemption |

## Response Data Extraction

### Key Fields

| Field | Path | Use |
|-------|------|-----|
| Entity Name | `businessEntity/mainName/organisationName` | Display name |
| Entity Type | `businessEntity/entityType/entityTypeCode` | Tax rate selection |
| ABN Status | `businessEntity/ABN/isCurrentIndicator` | Active check |
| GST Registered | `businessEntity/goodsAndServicesTax/effectiveFrom` | Input tax credit |
| GST Status | `businessEntity/goodsAndServicesTax/isCurrentIndicator` | Current registration |
| State | `businessEntity/mainBusinessPhysicalAddress/stateCode` | Payroll tax jurisdiction |
| Postcode | `businessEntity/mainBusinessPhysicalAddress/postcode` | Location verification |
| ACN | `businessEntity/ASICNumber` | Company cross-reference |

## Output Format

```xml
<abn_lookup_result>
  <abn>51824753556</abn>
  <abn_valid>true</abn_valid>
  <abn_active>true</abn_active>
  <entity_name>Example Pty Ltd</entity_name>
  <entity_type>Australian Private Company</entity_type>
  <entity_type_code>PRV</entity_type_code>
  <gst_registered>true</gst_registered>
  <gst_effective_from>2015-07-01</gst_effective_from>
  <state>NSW</state>
  <postcode>2000</postcode>
  <acn>824753556</acn>

  <tax_implications>
    <corporate_tax_rate>0.25</corporate_tax_rate>
    <!-- Base rate entity test required (passive income <80%) -->
    <amendment_period_years>4</amendment_period_years>
    <payroll_tax_grouping_risk>related_body_corporate</payroll_tax_grouping_risk>
  </tax_implications>

  <lookup_metadata>
    <source>ABR API</source>
    <queried_at>2026-02-13T10:00:00+11:00</queried_at>
    <cache_ttl_hours>24</cache_ttl_hours>
  </lookup_metadata>
</abn_lookup_result>
```

## Privacy Considerations

- ABR data is **public information** — no consent required for lookup
- However, **caching** ABR responses containing sole trader names has privacy implications under APP 11
- Sole trader lookups return individual names — handle with same care as personal information
- Cache ABR responses for 24 hours maximum, then re-query
- RLS policies on `abn_lookup_cache` table must restrict access to authenticated users only

## Best Practices

- **Always validate ABN format** client-side before making API call
- **Cache responses** for 24 hours to reduce ABR API load
- **Handle ABN not found** gracefully — entity may have recently registered or cancelled
- **Check GST status** separately from ABN status — ABN can be active with cancelled GST
- **Entity type determines** tax rate, amendment period, and payroll tax grouping — always extract
- **Rate limit** ABR API calls — no published limit but be respectful (max 1 req/second)
