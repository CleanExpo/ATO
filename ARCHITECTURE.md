# Architecture Document - Australian Tax Optimizer (ATO)

> Last updated: 2026-02-07
> Maintainer: Backend_Dev

---

## A. Core Module Map

The platform contains 16 analysis engines in `lib/analysis/`, grouped by tax domain. Each engine is a standalone module that reads from Supabase, applies legislation-accurate calculations using `decimal.js`, and returns typed results with confidence scores, legislative references, and recommendations.

### Income Engines

| Engine | File | Legislation | Purpose |
|--------|------|-------------|---------|
| PSI Engine | `lib/analysis/psi-engine.ts` | Div 85/86/87 ITAA 1997 | Personal services income classification, PSB determination via Results/Unrelated Clients/Employment/Business Premises tests |
| PAYG Instalment Engine | `lib/analysis/payg-instalment-engine.ts` | Div 45 Sch 1 TAA 1953 | PAYG instalment method comparison (amount vs rate), variation analysis with 85% safe harbour |

### Deduction Engines

| Engine | File | Legislation | Purpose |
|--------|------|-------------|---------|
| Deduction Engine | `lib/analysis/deduction-engine.ts` | Div 8 ITAA 1997, s 8-1 | 22 deduction categories, partial deductibility rules, instant asset write-off vs depreciation |
| R&D Engine | `lib/analysis/rnd-engine.ts` | Div 355 ITAA 1997 | R&D Tax Incentive eligibility, tiered offset calculation, four-element test, evidence sufficiency |
| Fuel Tax Credits | `lib/analysis/fuel-tax-credits-analyzer.ts` | Fuel Tax Act 2006 | Fuel purchase analysis, quarterly rate application, on-road/off-road eligibility |

### Offset / Credit Engines

| Engine | File | Legislation | Purpose |
|--------|------|-------------|---------|
| Superannuation Cap Analyzer | `lib/analysis/superannuation-cap-analyzer.ts` | Div 291 ITAA 1997 | Concessional/non-concessional cap tracking, carry-forward from FY2018-19, Division 293 tax |
| Loss Engine | `lib/analysis/loss-engine.ts` | Div 36/165 ITAA 1997 | Revenue vs capital loss classification, carry-forward with COT/SBT analysis |

### Capital Gains Tax

| Engine | File | Legislation | Purpose |
|--------|------|-------------|---------|
| CGT Engine | `lib/analysis/cgt-engine.ts` | Div 102-115, 152 ITAA 1997 | CGT event classification, 50% discount (excluding companies per s 115-25), Division 152 Small Business CGT Concessions |

### Compliance Engines

| Engine | File | Legislation | Purpose |
|--------|------|-------------|---------|
| Division 7A Engine | `lib/analysis/div7a-engine.ts` | Div 7A ITAA 1936 | Private company loan compliance, benchmark interest rate, minimum yearly repayment, dual scenario modelling |
| FBT Engine | `lib/analysis/fbt-engine.ts` | FBTAA 1986 | Fringe benefit classification (8 categories), Type 1/Type 2 gross-up, minor benefit exemption |
| Trust Distribution Analyzer | `lib/analysis/trust-distribution-analyzer.ts` | s 100A ITAA 1936, TR 2022/4 | Section 100A risk assessment, UPE tracking, reimbursement agreement detection |
| Audit Risk Engine | `lib/analysis/audit-risk-engine.ts` | N/A (ATO benchmarks) | Expense ratio analysis vs ATO industry benchmarks, descriptive only (never recommends changing to match) |
| Payroll Tax Engine | `lib/analysis/payroll-tax-engine.ts` | State/Territory Acts | Multi-state payroll tax calculation, threshold apportionment, contractor deeming, grouping rules |

### Forecasting Engines

| Engine | File | Legislation | Purpose |
|--------|------|-------------|---------|
| Cashflow Forecast Engine | `lib/analysis/cashflow-forecast-engine.ts` | N/A | Monthly income/expense projection, tax obligation scheduling, BAS/SG/FBT key dates, ASIC RG 234 disclaimer |
| Reconciliation Engine | `lib/analysis/reconciliation-engine.ts` | N/A | Bank transaction matching, duplicate detection, missing entry identification, scaled amount tolerance |

### Infrastructure

| Module | File | Purpose |
|--------|------|---------|
| Re-Analysis Worker | `lib/analysis/reanalysis-worker.ts` | Background queue processor, re-runs engines after questionnaire completion, compares before/after confidence |
| Financial Year Utility | `lib/utils/financial-year.ts` | Shared FY/FBT year calculations used by every engine |
| Tax Rates Fetcher | `lib/tax-data/rates-fetcher.ts` | Brave Search + Jina AI scraping for current ATO rates |
| Tax Data Cache Manager | `lib/tax-data/cache-manager.ts` | 24-hour Supabase cache for fetched tax rates |
| ABN Lookup | `lib/integrations/abn-lookup.ts` | ABR API integration with checksum validation and 7-day cache |

### Interconnections

```
                    financial-year.ts
                          |
           +------+------+------+------+
           |      |      |      |      |
       deduction rnd   cgt    fbt   loss   (all engines import financial-year)
           |      |      |      |      |
           +------+------+------+------+
                          |
                   cache-manager.ts -----> rates-fetcher.ts
                          |                     |
                  getCurrentTaxRates()    Brave + Jina scraping
                          |
                   Supabase tax_rates_cache

    trust-distribution ------> div7a-engine  (UPE > 2 years triggers Div 7A)
    psi-engine -----------> deduction-engine (PSI status affects deduction rules)
    audit-risk-engine ----> reconciliation   (both read from same transaction data)
    reanalysis-worker ----> fuel-tax-credits, trust-distributions, super-caps
```

---

## B. Data Flow Architecture

### End-to-End Pipeline

```
[1] DATA INGESTION
    Xero OAuth 2.0 (READ-ONLY)
    lib/xero/client.ts ------> XeroClient (xero-node SDK)
         |
         | Scopes: accounting.transactions.read,
         |         accounting.contacts.read,
         |         accounting.reports.read,
         |         assets.read, payroll.*.read
         v
    lib/xero/historical-fetcher.ts
         |  5 years of data, paginated (100/page)
         |  Rate limit handling, incremental sync
         v
[2] STORAGE (Supabase PostgreSQL)
    +----------------------------------+
    | xero_connections                 |  OAuth tokens per tenant
    | historical_transactions_cache    |  Raw Xero transactions
    | forensic_analysis_results        |  Gemini AI analysis output
    | tax_rates_cache                  |  Scraped ATO rates (24hr TTL)
    | abn_lookup_cache                 |  ABR responses (7-day TTL)
    | cgt_events                       |  CGT event records
    | fbt_items                        |  FBT item records
    | psi_analysis_results             |  PSI classification
    | cashflow_forecasts               |  Forecast snapshots
    | audit_risk_benchmarks            |  ATO industry benchmarks
    | analysis_queue                   |  Background job queue
    +----------------------------------+
         |
         | RLS: check_tenant_access() via user_tenant_access join
         |
         v
[3] ANALYSIS ENGINES
    lib/analysis/*.ts
         |  Read: historical_transactions_cache, forensic_analysis_results
         |  Read: tax_rates_cache (via cache-manager with fallback rates)
         |  Calculate: decimal.js for all monetary values
         |  Annotate: legislativeReferences[], confidence, recommendations
         v
[4] API LAYER
    app/api/analysis/*/route.ts (12 routes)
         |  POST with tenantId required
         |  export const dynamic = 'force-dynamic'
         |  Error handling via lib/api/errors.ts
         v
[5] UI LAYER
    app/dashboard/* (Next.js 16 App Router)
         |  Recharts visualisation wrapped in AccessibleChart
         |  WCAG 2.1 AA compliance
         |  Dark-only theme (OLED Black + Tax-Time variant)
         v
    [User sees: analysis results, projections, calendar, reports]
```

### Security Boundaries

```
                    BOUNDARY 1: Internet
                         |
        [Xero API]  [ABR API]  [ATO.gov.au]
                         |
                    BOUNDARY 2: Vercel Edge
                         |
                 Next.js API Routes
              (force-dynamic, no ISR)
                         |
                    BOUNDARY 3: RLS
                         |
              Supabase PostgreSQL
           check_tenant_access(tenant_id)
              joins user_tenant_access
                         |
                    BOUNDARY 4: Row-Level
                         |
           Each tenant sees only their data
           ABN cache + benchmarks: auth-only SELECT
```

### Key Tables and Access Patterns

| Table | Access | RLS Policy |
|-------|--------|------------|
| `xero_connections` | Per-tenant OAuth tokens | Tenant-scoped via user_tenant_access |
| `historical_transactions_cache` | 5 years of Xero data | Tenant-scoped |
| `forensic_analysis_results` | Gemini AI output | Tenant-scoped |
| `tax_rates_cache` | Shared (public ATO rates) | Authenticated SELECT |
| `abn_lookup_cache` | Shared (public ABR data) | Authenticated SELECT |
| `cgt_events` | CGT event records | Tenant-scoped via check_tenant_access |
| `fbt_items` | FBT benefit items | Tenant-scoped via check_tenant_access |
| `psi_analysis_results` | PSI classifications | Tenant-scoped via check_tenant_access |
| `cashflow_forecasts` | Forecast snapshots | Tenant-scoped via check_tenant_access |
| `audit_risk_benchmarks` | ATO benchmark data | Authenticated SELECT |

---

## C. Zero-Knowledge TFN Architecture

### Problem Statement

Tax File Numbers (TFNs) are protected under the Privacy Act 1988 (Cth), the TFN Guidelines, and the Tax Administration Act 1953. Unauthorised storage, access, or disclosure of TFNs carries penalties. The platform must NEVER store plaintext TFNs in its database.

### Recommended Approach: Client-Side-Only Processing

After evaluating three approaches (client-side-only, envelope encryption, tokenisation), the recommended architecture is **client-side-only processing** with no TFN persistence.

**Rationale:**
- Simplest approach with the smallest attack surface
- No server-side TFN storage means no breach risk for TFNs
- The platform does not need TFNs for its core function (tax analysis operates on transaction data, not TFN-linked identity data)
- If TFN validation is needed (e.g., for ATO SBR2 lodgement), it should be processed in the browser and transmitted directly to the ATO, never stored

### Architecture

```
Browser (Client)
+------------------------------------------+
| TFN entered by user                      |
| Validated client-side (algorithm check)  |
| Used for ATO API call (if needed)        |
| NEVER sent to our API / Supabase         |
| Cleared from memory on navigation        |
+------------------------------------------+
         |
         | Only non-TFN data crosses this boundary
         v
Server (API Routes + Supabase)
+------------------------------------------+
| NO TFN fields in any database table      |
| NO TFN in logs, error messages, or       |
|   request/response bodies                |
| Analysis engines use transaction data    |
|   only (amounts, dates, categories)      |
+------------------------------------------+
```

### Implementation Requirements

1. **Client-side TFN input component**: Masked input field, local validation only, auto-clear on blur/navigation
2. **CSP headers**: Prevent TFN exfiltration via `connect-src` restrictions
3. **Logging safeguards**: Regex-based TFN scrubbing in all log pipelines (pattern: `\b\d{3}\s?\d{3}\s?\d{3}\b`)
4. **API route guards**: Middleware that rejects any request body containing a TFN pattern
5. **Database constraint**: CHECK constraint or trigger that prevents TFN-shaped data in text columns

### Alternative Approaches (Not Recommended)

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Envelope Encryption (AWS KMS/GCP KMS) | TFN stored encrypted, key rotation possible | Added complexity, key management burden, still a target if KMS access is compromised | Overkill for current requirements |
| Tokenisation (third-party vault) | TFN replaced with opaque token, vault handles compliance | Vendor dependency, latency on every lookup, cost per transaction | Unnecessary unless ATO lodgement is built |

---

## D. ATO Digital Services API Layer

### Current State

The platform currently has NO direct ATO API integration. All data comes from Xero. ATO interaction is limited to:
- Scraping ATO.gov.au for tax rates (via Brave Search + Jina AI)
- ABR API for ABN lookups (already implemented in `lib/integrations/abn-lookup.ts`)

### Target Architecture: ATO Standard Business Reporting (SBR2)

The ATO uses the Standard Business Reporting (SBR2) framework for digital lodgement. Integration would require:

```
+------------------+         +------------------+         +------------------+
| ATO Platform     |         | SBR2 Gateway     |         | ATO Systems      |
| (our system)     |  --->   | (intermediary)   |  --->   | (ATO backend)    |
+------------------+         +------------------+         +------------------+
  Generates SBR2               Digital certificate          Processes
  taxonomy data                validation, TLS              lodgement
  (XBRL format)               mutual auth
```

### Proposed Integration Modules

#### 1. BAS Lodgement (`lib/integrations/ato-bas-lodgement.ts`)

| Field | Detail |
|-------|--------|
| Purpose | Lodge Business Activity Statements electronically |
| Protocol | SBR2 (XBRL taxonomy) |
| Auth | AUSkey / myGovID digital certificate |
| Data Source | Xero GST data + engine calculations |
| Status | NOT IMPLEMENTED - requires SBR2 registration |

**Simulation approach for MVP**: Generate BAS pre-fill data in ATO-compatible format (CSV/PDF) that accountants can manually lodge. Include field mappings to BAS labels (1A, 1B, 1C, etc.).

#### 2. Activity Statement Status (`lib/integrations/ato-activity-statement.ts`)

| Field | Detail |
|-------|--------|
| Purpose | Check lodgement status and history |
| Protocol | ATO Online Services API (REST) |
| Auth | myGovID + Relationship Authorisation Manager (RAM) |
| Status | NOT IMPLEMENTED |

**Simulation approach**: Track BAS due dates and lodgement status locally in `cashflow_forecasts.forecast_data` JSONB field. Flag overdue items.

#### 3. Tax Return Status (`lib/integrations/ato-tax-return-status.ts`)

| Field | Detail |
|-------|--------|
| Purpose | Check income tax return processing status |
| Protocol | ATO Online Services API |
| Auth | myGovID + RAM |
| Status | NOT IMPLEMENTED |

**Simulation approach**: Use amendment period calculations from `financial-year.ts` to flag returns that are within amendment windows.

#### 4. SBR2 Format Generator (`lib/integrations/sbr2-format.ts`)

| Field | Detail |
|-------|--------|
| Purpose | Generate SBR2-compliant XBRL documents |
| Standard | SBR AU taxonomy 2024 |
| Output | XBRL instance documents |
| Status | NOT IMPLEMENTED |

### Integration Priority

| Priority | Module | Rationale |
|----------|--------|-----------|
| P1 | BAS pre-fill export (CSV/PDF) | Immediate value, no SBR2 registration needed |
| P2 | SBR2 format generator | Foundation for all ATO digital lodgement |
| P3 | BAS e-lodgement | Requires SBR2 registration + digital certificate |
| P4 | Activity Statement + Tax Return status | Requires ATO API access via RAM |

---

## E. Engine Accuracy Report

### Assessment per Engine (FY2025-26)

#### Deduction Engine (`deduction-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - Correctly implements s 8-1 general deduction, s 328-180 instant write-off. 22 categories cover major deductions. |
| Rate currency | CURRENT - Dynamic rates via cache-manager. Instant write-off threshold fetched from ATO. Home office 67c/hr. Vehicle 85c/km. |
| Known issues | All deductions marked `status='potential'` (correct conservative approach). Entertainment 50% rule hardcoded rather than context-dependent. |
| Missing edge cases | No prepayment rules (s 82KZM). No capital allowance (Div 40) for depreciating assets beyond instant write-off. No specific rules for primary producers (Div 393). |

#### R&D Engine (`rnd-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - Tiered offset correctly implemented: corp_rate + 18.5% (<$20M turnover) or + 8.5% (>=$20M). $4M refundable cap per s 355-100. |
| Rate currency | CURRENT - Corporate rate and R&D offset fetched dynamically. |
| Known issues | R&D clawback (s 355-450) is deferred (noted as R-3 in compliance tracker). Evidence sufficiency check is heuristic-based. |
| Missing edge cases | Overseas R&D activities (Div 355-210, requires advance finding). Software-specific rules. Feedstock provisions (s 355-465). |

#### Division 7A Engine (`div7a-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - Historical benchmark rates accurate. Minimum yearly repayment calculated correctly. Dual scenario modelling (with/without agreement). |
| Rate currency | CURRENT - Benchmark rate fetched from ATO (8.77% for FY2024-25). |
| Known issues | Amalgamated loans (7A-3) and safe harbour exclusions (7A-4) are deferred. |
| Missing edge cases | Distributable surplus calculation (s 109Y). Interposed entity rules (s 109T). Pre-4 December 1997 loans. |

#### CGT Engine (`cgt-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - CGT discount correctly excludes companies (s 115-25). Division 152 concessions with turnover/net asset/active asset tests. |
| Rate currency | N/A - CGT discount percentage (50%) is legislated, not a variable rate. |
| Known issues | No indexation method for pre-21 September 1999 assets. |
| Missing edge cases | CGT event K6 (UPE under Div 7A). CGT event E4 (trust capital gains). CGT roll-over relief (Subdiv 122-A, 124-M). Main residence exemption. |

#### FBT Engine (`fbt-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - 8 benefit categories correctly classified. Type 1 (2.0802) and Type 2 (1.8868) gross-up rates. Minor benefit $300 threshold. |
| Rate currency | CURRENT - FBT rate (47%) and gross-up rates fetched via rates-fetcher. |
| Known issues | FBT year boundary (Apr-Mar) correctly handled via financial-year.ts. |
| Missing edge cases | Car benefit operating cost method. Reportable fringe benefits amount (RFBA). Exempt benefits (s 47 FBTAA: work-related items, portable electronic devices). |

#### Loss Engine (`loss-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - Revenue vs capital loss separation correct. COT/SBT analysis implemented but returns 'unknown' without share register data. |
| Rate currency | CURRENT - Dynamic corporate tax rate. |
| Known issues | SBT (same business test) is a complex factual determination; engine can only flag, not conclusively determine. L-2 (full SBT implementation) deferred. |
| Missing edge cases | Similar business test (expanded SBT from 2015). Tax loss integrity measures for trusts. |

#### PSI Engine (`psi-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - Results Test correctly requires ALL 3 sub-requirements (result-based income, own tools, defect liability). 80% single client rule correct. |
| Rate currency | N/A - PSI thresholds are percentage-based, not rate-dependent. |
| Known issues | PSB determination process (applying to ATO) is described but not automated. |
| Missing edge cases | Unusual PSI scenarios (e.g., multiple entities, attribution rules under Div 86). |

#### PAYG Instalment Engine (`payg-instalment-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - 85% safe harbour threshold (s 45-235) correct. GIC penalty rate (~11.26% p.a.) documented. |
| Rate currency | CURRENT - GIC rate fetched dynamically. |
| Known issues | None significant. |
| Missing edge cases | Voluntary entry provisions. GDP-adjusted instalment rates. |

#### Payroll Tax Engine (`payroll-tax-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | MEDIUM - All 8 states/territories with rates and thresholds. Multi-state apportionment implemented. |
| Rate currency | HARDCODED - State rates/thresholds are embedded in code, not dynamically fetched. Must be manually updated for FY2025-26. |
| Known issues | Rates may lag behind state budget announcements. |
| Missing edge cases | Payroll tax nexus rules for remote workers. Mental health levy (VIC). Specific contractor exemption provisions by state. |

#### Audit Risk Engine (`audit-risk-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | N/A - Uses ATO industry benchmarks (not legislation). Correctly DESCRIPTIVE, not NORMATIVE. |
| Rate currency | STATIC - Benchmark data hardcoded. Should be refreshed from ATO benchmark tools. |
| Known issues | None - explicitly avoids recommending changes to match benchmarks. |
| Missing edge cases | Industry-specific risk factors beyond standard expense ratios. |

#### Trust Distribution Analyzer (`trust-distribution-analyzer.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - Section 100A flags correctly identified (reimbursement agreements, non-resident distributions, minor distributions). TR 2022/4 referenced. |
| Rate currency | N/A |
| Known issues | T-1 (ordinary family dealing defence) and T-2 (trustee penalty rate 47% not 45%) deferred. |
| Missing edge cases | Trust streaming rules (Subdiv 115-C, 207-B). Family trust elections. |

#### Superannuation Cap Analyzer (`superannuation-cap-analyzer.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - Concessional cap $30,000 (FY2024-25). Carry-forward from FY2018-19, 5 years, balance <$500K. |
| Rate currency | CURRENT - Cap amounts likely hardcoded but correct for current FY. |
| Known issues | None significant. |
| Missing edge cases | Non-concessional cap bring-forward rule (3-year window). Total super balance thresholds. Division 293 high-income threshold ($250K). |

#### Fuel Tax Credits Analyzer (`fuel-tax-credits-analyzer.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | HIGH - Section 41-5 eligibility criteria. Light vehicle exclusion (<4.5t GVM). |
| Rate currency | CURRENT - Rates updated quarterly via rates-fetcher ($0.479/L diesel/petrol, $0.198/L LPG for FY2024-25). |
| Known issues | None significant. |
| Missing edge cases | Blended fuel rates. Environment-adjusted rates. Aviation fuel. |

#### Cashflow Forecast Engine (`cashflow-forecast-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | N/A - Projection tool, not a compliance engine. ASIC RG 234 disclaimer included. |
| Rate currency | Uses rates from other engines for tax obligation projections. |
| Known issues | None significant for a forecasting tool. |
| Missing edge cases | Seasonal adjustment algorithms could be more sophisticated. |

#### Reconciliation Engine (`reconciliation-engine.ts`)

| Criterion | Assessment |
|-----------|------------|
| Legislation accuracy | N/A - Operational tool, not legislation-dependent. |
| Rate currency | N/A |
| Known issues | Scaled tolerance (2%/1%/0.5%) is a sensible design. |
| Missing edge cases | Multi-currency reconciliation. Bank feed timing differences. |

---

## F. Engine Dependency Graph

### Calculation Pipeline Order

Engines are independent at the API layer (each route calls one engine), but logically they should be run in this order for a complete analysis because some engines' outputs inform others.

```
TIER 1 - Foundation (no dependencies, run first in parallel)
=========================================================
  reconciliation-engine          (transaction matching)
  deduction-engine               (deduction classification)
  fuel-tax-credits-analyzer      (fuel credit identification)
  superannuation-cap-analyzer    (super cap tracking)
  payroll-tax-engine             (payroll tax calc)
  audit-risk-engine              (benchmark comparison)

TIER 2 - Depends on transaction classification
=========================================================
  psi-engine                     (needs: income classification from deduction-engine)
  trust-distribution-analyzer    (needs: distribution patterns from reconciliation)
  cgt-engine                     (needs: asset disposal identification)
  fbt-engine                     (needs: benefit classification from deduction-engine)
  rnd-engine                     (needs: R&D expense classification from deduction-engine)

TIER 3 - Depends on compliance assessment
=========================================================
  div7a-engine                   (needs: loan identification, UPE data from trust analyzer)
  loss-engine                    (needs: revenue/capital classification from deduction + cgt)
  payg-instalment-engine         (needs: estimated tax liability from multiple engines)

TIER 4 - Aggregation (depends on all above)
=========================================================
  cashflow-forecast-engine       (needs: all tax obligations from above engines)

BACKGROUND
=========================================================
  reanalysis-worker              (re-runs Tier 1-4 after questionnaire completion)
```

### Cross-Engine Data Dependencies

```
deduction-engine ----[expense classification]----> rnd-engine
                 ----[expense classification]----> fbt-engine
                 ----[expense classification]----> psi-engine
                 ----[tax rate]-----------------> loss-engine

trust-distribution --[UPE > 2 years]------------> div7a-engine
                    --[distribution patterns]----> audit-risk-engine

cgt-engine ----------[capital gains/losses]------> loss-engine
                     -[CGT liability]-----------> cashflow-forecast-engine

payg-instalment -----[instalment amounts]--------> cashflow-forecast-engine
fbt-engine ----------[FBT liability]-------------> cashflow-forecast-engine
payroll-tax ---------[payroll tax liability]------> cashflow-forecast-engine
superannuation-cap --[excess contributions tax]--> cashflow-forecast-engine

ALL ENGINES --------[confidence, findings]-------> reanalysis-worker
```

### Shared Dependencies

All engines depend on:
- `lib/utils/financial-year.ts` - FY date calculations
- `lib/tax-data/cache-manager.ts` - Current tax rates (with fallback defaults)
- `lib/supabase/server.ts` - Database access via `createServiceClient()` (async)
- `decimal.js` - Monetary arithmetic

---

## G. Missing Modules

### Uncovered Tax Areas

The following tax domains have no analysis engine and represent gaps in the platform.

| Area | Legislation | Complexity | Priority | Notes |
|------|-------------|------------|----------|-------|
| **Wine Equalisation Tax (WET)** | A New Tax System (WET) Act 1999 | Medium | Low | Only affects wine producers/wholesalers. WET rebate $350K cap. Narrow client base. |
| **Luxury Car Tax (LCT)** | A New Tax System (LCT) Act 1999 | Low | Low | LCT threshold ($89,332 fuel-efficient, $76,950 other for FY2024-25). Simple calculation. Limited to car dealers and businesses importing luxury vehicles. |
| **Withholding Tax** | Div 11A/12 TAA 1953, ITAA 1936 Div 11A | Medium | Medium | Non-resident withholding (interest, dividends, royalties). PAYG withholding variations for foreign payments. Important for clients with overseas transactions. |
| **Employee Share Schemes (ESS)** | Div 83A ITAA 1997 | High | Medium | Taxing point rules (upfront vs deferred), startup concessions (s 83A-33), ESS reporting obligations. Growing relevance with tech clients. |
| **Crypto/Digital Asset Taxation** | CGT provisions + ATO guidance | High | High | No specific legislation but ATO has published guidance. Each disposal is a CGT event. DeFi, staking, airdrops create complex scenarios. High client demand. |
| **Trust Streaming** | Subdiv 115-C, 207-B ITAA 1997 | High | Medium | Streaming of capital gains and franked distributions to specific beneficiaries. Currently trust-distribution-analyzer only covers s 100A risk, not streaming mechanics. |
| **Partnership Allocations** | Div 5 ITAA 1936 | Medium | Medium | Partnership income/loss allocation rules. Individual partner assessability. Partner's interest changes mid-year. |
| **Tax Consolidation** | Div 700-721 ITAA 1997 | Very High | Low | Consolidated groups, single entity rule, cost setting, exit history. Extremely complex. Only relevant for corporate groups. |
| **Transfer Pricing** | Div 815 ITAA 1997 | Very High | Low | Arm's length principle for related-party international transactions. Requires specialised expertise. |
| **GST Apportionment** | Div 129 GST Act | Medium | High | Adjustment events, input tax credit apportionment for mixed-use assets. Currently no standalone GST engine (BAS pre-fill uses raw Xero GST data). |
| **TPAR (Taxable Payments Annual Report)** | TAA 1953 Sch 1 Subdiv 396-B | Low | Medium | Building & construction, cleaning, courier, IT, security industries. Required annual reporting of payments to contractors. |
| **Depreciation (Div 40)** | Div 40 ITAA 1997 | Medium | High | General depreciation rules beyond instant write-off. Effective life determinations. Low-value pool. Currently deduction-engine only handles instant write-off threshold. |

### Recommended Build Order

1. **GST Apportionment Engine** - High value, medium complexity, fills a gap in BAS accuracy
2. **Crypto/Digital Asset Engine** - High client demand, extends existing CGT engine
3. **Depreciation Engine (Div 40)** - Fills gap in deduction-engine, medium complexity
4. **Employee Share Schemes** - Growing demand, medium-high complexity
5. **Withholding Tax** - Important for internationalising clients
6. **TPAR Generator** - Low complexity, compliance obligation for many clients

---

## Appendix: API Route Inventory

| Route | Method | Engine | Description |
|-------|--------|--------|-------------|
| `/api/analysis/cgt` | POST | cgt-engine | CGT event analysis |
| `/api/analysis/fbt` | POST | fbt-engine | FBT liability analysis |
| `/api/analysis/psi` | POST | psi-engine | PSI classification |
| `/api/analysis/payg-instalments` | POST | payg-instalment-engine | PAYG instalment analysis |
| `/api/analysis/payroll-tax` | POST | payroll-tax-engine | Multi-state payroll tax |
| `/api/analysis/audit-risk` | POST | audit-risk-engine | Audit risk assessment |
| `/api/analysis/cashflow-forecast` | POST | cashflow-forecast-engine | Cash flow projection |
| `/api/analysis/fuel-tax-credits` | POST | fuel-tax-credits-analyzer | Fuel tax credit analysis |
| `/api/analysis/superannuation-caps` | POST | superannuation-cap-analyzer | Super cap analysis |
| `/api/analysis/trust-distributions` | POST | trust-distribution-analyzer | Trust distribution / s 100A |
| `/api/analysis/queue/process` | POST | reanalysis-worker | Process analysis queue |
| `/api/analysis/queue/status` | GET | N/A | Queue status check |

All routes use `export const dynamic = 'force-dynamic'` and require `tenantId` in the request body. Error responses use `createErrorResponse` / `createValidationError` from `lib/api/errors.ts`.
