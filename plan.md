# Tax Logic Engine & ATO API Integration Architecture Plan

## Author: Backend_Dev (Senior Backend Engineer)
## Date: 2026-02-07
## Status: DRAFT - Awaiting Approval

---

## 1. Executive Summary

This plan architects 9 new tax engines, an ABN Lookup integration, and a comprehensive test suite for ALL engines (existing + new). The design follows established codebase patterns discovered in `lib/analysis/` -- each engine is a self-contained TypeScript module exporting typed interfaces, analysis functions, and summary calculations, backed by Supabase queries and the existing `getCurrentTaxRates()` cache infrastructure.

---

## 2. Existing Patterns Identified

After reading all 9 existing engines, the consistent patterns are:

| Pattern | Implementation |
|---------|---------------|
| **Data source** | Supabase `forensic_analysis_results` + `historical_transactions_cache` |
| **Tax rates** | `getCurrentTaxRates()` from `lib/tax-data/cache-manager.ts` with fallback constants |
| **Precision** | `decimal.js` for all monetary calculations |
| **Async DB** | `const supabase = await createServiceClient()` (always awaited) |
| **Entity types** | `EntityType` with rate determination per entity |
| **Provenance** | Every result includes `taxRateSource`, `taxRateVerifiedAt`, legislative references |
| **Empty states** | Explicit empty summary functions, never mock data |
| **API routes** | Next.js route handlers in `app/api/`, `export const dynamic = 'force-dynamic'` |
| **Error handling** | `createErrorResponse()`, `createValidationError()` from `lib/api/errors` |
| **Confidence scoring** | 0-100 confidence with thresholds for recommendations |

---

## 3. New Engine Architecture

### 3.1 CGT Engine + Division 152 Small Business Concessions

**File:** `lib/analysis/cgt-engine.ts`
**API:** `app/api/analysis/cgt/route.ts`

**Legislation:**
- Division 102-114 ITAA 1997 (CGT events, cost base, discounts)
- Division 115 ITAA 1997 (50% CGT discount for 12+ month assets)
- Division 152 ITAA 1997 (Small business CGT concessions)
  - Subdiv 152-A: Basic conditions (turnover < $2M or net assets < $6M)
  - Subdiv 152-B: 15-year exemption
  - Subdiv 152-C: 50% active asset reduction
  - Subdiv 152-D: Retirement exemption ($500k lifetime cap)
  - Subdiv 152-E: Rollover (replacement asset)

**Key Types:**
```typescript
interface CGTEvent {
  eventType: 'A1' | 'C2' | 'D1' | 'E1' | ... // CGT event categories
  assetDescription: string
  acquisitionDate: string
  disposalDate: string
  costBase: number
  capitalProceeds: number
  capitalGain: number
  capitalLoss: number
  holdingPeriodMonths: number
  eligibleForDiscount: boolean // 12+ months
}

interface Div152Analysis {
  basicConditionsMet: boolean
  turnoverTest: { met: boolean; turnover: number; threshold: number }
  netAssetTest: { met: boolean; netAssets: number; threshold: number }
  activeAssetTest: { met: boolean; activePercentage: number }
  fifteenYearExemption: { eligible: boolean; yearsHeld: number }
  fiftyPercentReduction: { eligible: boolean; reducedGain: number }
  retirementExemption: { eligible: boolean; amountExempt: number; lifetimeCap: number }
  rolloverAvailable: boolean
}

interface CGTSummary {
  totalCapitalGains: number
  totalCapitalLosses: number
  netCapitalGain: number
  discountApplied: number
  div152Concessions: number
  taxableCapitalGain: number
  // Provenance
  taxRateSource: string
  taxRateVerifiedAt: string
}
```

**Data source:** Query `historical_transactions_cache` for asset disposal transactions (ACCREC with asset account codes), cross-reference with `forensic_analysis_results` for AI classification.

### 3.2 FBT Engine (FBTAA 1986)

**File:** `lib/analysis/fbt-engine.ts`
**API:** `app/api/analysis/fbt/route.ts`

**Legislation:**
- FBTAA 1986 (Fringe Benefits Tax Assessment Act)
- s 5B-5E: Definitions of benefit types
- s 136: FBT rate (47% for FY2024-25)
- s 57A: Exempt benefits
- s 58X: Minor benefits exemption ($300)
- FBT year: 1 April - 31 March (different from income tax FY!)

**Key Types:**
```typescript
type FBTCategory =
  | 'car_fringe_benefit'        // Division 2 FBTAA
  | 'loan_fringe_benefit'       // Division 4
  | 'expense_payment'           // Division 5
  | 'housing_benefit'           // Division 6
  | 'living_away_from_home'     // Division 7
  | 'meal_entertainment'        // Division 9A
  | 'property_fringe_benefit'   // Division 3
  | 'residual_fringe_benefit'   // Division 12
  | 'exempt_benefit'            // s 57A, s 58X
  | 'otherwise_deductible'      // s 24 (otherwise deductible rule)

interface FBTItem {
  transactionId: string
  category: FBTCategory
  taxableValue: number           // Grossed-up taxable value
  gstCredits: number
  exemptionApplied: string | null
  employeeContribution: number   // Reduces taxable value
  fbtLiability: number           // taxableValue * 47%
}

interface FBTSummary {
  fbtYear: string                // "FBT2024-25" (1 Apr 2024 - 31 Mar 2025)
  totalFBTLiability: number
  byCategory: Record<FBTCategory, { count: number; taxableValue: number; fbtLiability: number }>
  exemptBenefits: number
  type1AggregateAmount: number   // Grossed-up (GST-creditable)
  type2AggregateAmount: number   // Grossed-up (no GST credit)
  grossUpRate1: number           // 2.0802 for FY2024-25
  grossUpRate2: number           // 1.8868 for FY2024-25
  lodgmentDeadline: Date         // 21 May for employer lodgment
}
```

**Important design note:** FBT year runs 1 April - 31 March, NOT the standard Australian FY. Engine must convert between tax year and FBT year when querying transactions.

### 3.3 PSI Engine (Division 85 ITAA 1997)

**File:** `lib/analysis/psi-engine.ts`
**API:** `app/api/analysis/psi/route.ts`

**Legislation:**
- Division 85 ITAA 1997 (Personal Services Income)
- s 85-10: Definition of PSI
- s 85-15 to s 85-40: PSI tests (results test, unrelated clients test, employment test, business premises test)
- PSB (Personal Services Business) determination

**Key Types:**
```typescript
interface PSITestResult {
  resultsTest: { passed: boolean; confidence: number; evidence: string[] }
  unrelatedClientsTest: { passed: boolean; clientCount: number; unrelatedCount: number }
  employmentTest: { passed: boolean; hasEmployees: boolean }
  businessPremisesTest: { passed: boolean; hasSeparatePremises: boolean }
  isPSB: boolean              // Personal Services Business (passes >= 1 test)
  isPSI: boolean              // Is Personal Services Income
  deductionRestrictions: string[] // Which deductions are limited under PSI rules
}

interface PSISummary {
  totalIncome: number
  psiIncome: number
  nonPsiIncome: number
  isPSB: boolean
  testResults: PSITestResult
  restrictedDeductions: { category: string; amount: number; reason: string }[]
  allowableDeductions: { category: string; amount: number }[]
  taxImpact: number           // Additional tax if PSI rules apply
}
```

**Data source:** Analyse `forensic_analysis_results` for revenue concentration patterns (80%+ from single client = PSI indicator). Cross-reference contact/supplier data.

### 3.4 PAYG Instalment Optimisation Engine

**File:** `lib/analysis/payg-instalment-engine.ts`
**API:** `app/api/analysis/payg-instalments/route.ts`

**Legislation:**
- Division 45 Schedule 1 TAA 1953 (PAYG instalments)
- s 45-112: Instalment rate method
- s 45-115: GDP-adjusted instalment amount
- s 45-205: Varying PAYG instalments

**Key Types:**
```typescript
type PAYGMethod = 'instalment_rate' | 'instalment_amount' | 'varied'

interface PAYGQuarter {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  periodStart: string
  periodEnd: string
  dueDate: string
  assessableIncome: number
  instalmentRate: number
  gdpAdjustedAmount: number
  actualPaid: number
  recommendedPayment: number
  method: PAYGMethod
  variance: number            // Overpayment or underpayment
}

interface PAYGOptimisation {
  currentMethod: PAYGMethod
  recommendedMethod: PAYGMethod
  annualSaving: number
  cashFlowImpact: number     // Positive = better cash flow
  quarters: PAYGQuarter[]
  variationRecommended: boolean
  variationDeadline: string
  recommendations: string[]
}
```

### 3.5 State Payroll Tax Calculator (All 8 Jurisdictions)

**File:** `lib/analysis/payroll-tax-engine.ts`
**API:** `app/api/analysis/payroll-tax/route.ts`

**Legislation (all 8 jurisdictions):**
- NSW: Payroll Tax Act 2007 (threshold $1.2M, rate 5.45%)
- VIC: Payroll Tax Act 2007 (threshold $900K, rate 4.85%, surcharge 0.5% above $10M)
- QLD: Payroll Tax Act 1971 (threshold $1.3M, rate 4.75%, mental health levy)
- WA: Pay-roll Tax Assessment Act 2002 (threshold $1M, rate 5.5%)
- SA: Payroll Tax Act 2009 (threshold $1.5M, rate 4.95%)
- TAS: Payroll Tax Act 2008 (threshold $1.25M, rate 4%)
- ACT: Payroll Tax Act 2011 (threshold $2M, rate 6.85%)
- NT: Payroll Tax Act 2009 (threshold $1.5M, rate 5.5%)

**Key Types:**
```typescript
type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT'

interface StatePayrollConfig {
  state: AustralianState
  threshold: number
  rate: number
  surchargeRate?: number       // VIC surcharge
  surchargeThreshold?: number
  mentalHealthLevy?: number    // QLD mental health levy
  financialYear: string
  legislativeReference: string
}

interface PayrollTaxCalculation {
  state: AustralianState
  totalWages: number
  taxableWages: number         // Above threshold
  baseTax: number
  surcharge: number
  mentalHealthLevy: number
  totalPayrollTax: number
  effectiveRate: number
  groupingApplied: boolean     // Multi-state grouping rules
}

interface PayrollTaxSummary {
  totalNationalWages: number
  byState: PayrollTaxCalculation[]
  totalPayrollTax: number
  groupingAnalysis: {
    isPartOfGroup: boolean
    groupMembers: string[]
    thresholdAllocation: Record<AustralianState, number> // Proportional threshold allocation
  }
  recommendations: string[]
}
```

**Design note:** Multi-state employers must allocate the threshold proportionally across states. The engine needs to handle employer grouping rules (related entities sharing a single threshold).

### 3.6 ATO Audit Risk Benchmarking (ANZSIC)

**File:** `lib/analysis/audit-risk-engine.ts`
**API:** `app/api/analysis/audit-risk/route.ts`

**Data source:** ATO publishes industry benchmarks by ANZSIC code. These will be fetched via Jina AI scraping of ATO small business benchmarks pages.

**Key Types:**
```typescript
interface ANZSICBenchmark {
  anzsicCode: string
  industryName: string
  financialYear: string
  benchmarks: {
    totalBusinessIncome: { low: number; median: number; high: number }
    costOfSales: { low: number; median: number; high: number }
    labourCosts: { low: number; median: number; high: number }
    rentExpenses: { low: number; median: number; high: number }
    motorVehicleExpenses: { low: number; median: number; high: number }
    otherExpenses: { low: number; median: number; high: number }
    netProfit: { low: number; median: number; high: number }
  }
  source: string
}

interface AuditRiskScore {
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
  riskScore: number            // 0-100
  deviations: {
    metric: string
    yourValue: number
    industryMedian: number
    deviationPercent: number
    riskContribution: number
    explanation: string
  }[]
  redFlags: string[]
  recommendations: string[]
}
```

### 3.7 ABN Lookup API Integration

**File:** `lib/integrations/abn-lookup.ts`
**API:** `app/api/integrations/abn-lookup/route.ts`

**Integration:** ABR (Australian Business Register) public API at `https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx`

**Key Types:**
```typescript
interface ABNLookupResult {
  abn: string
  abnStatus: 'Active' | 'Cancelled'
  abnStatusEffectiveFrom: string
  entityType: string
  entityName: string
  tradingNames: string[]
  gstRegistered: boolean
  gstRegisteredFrom: string | null
  mainBusinessLocation: { state: AustralianState; postcode: string }
  acn: string | null
  dgrStatus: boolean           // Deductible Gift Recipient
  anzsicCode: string | null    // For audit benchmarking cross-reference
  source: 'ABR_API'
  fetchedAt: string
}

interface ABNSearchResult {
  results: ABNLookupResult[]
  searchType: 'abn' | 'name' | 'acn'
  query: string
}
```

**Design note:** ABR API uses XML/SOAP. We will use a REST wrapper or parse XML responses. The ABN Lookup connects to the audit risk engine (provides ANZSIC code) and DGR validation for the deduction engine.

### 3.8 Cash Flow Tax Forecasting Engine

**File:** `lib/analysis/cashflow-forecast-engine.ts`
**API:** `app/api/analysis/cashflow-forecast/route.ts`

**Key Types:**
```typescript
interface TaxObligation {
  type: 'income_tax' | 'gst' | 'payg_instalment' | 'payg_withholding' | 'fbt' | 'payroll_tax' | 'super_guarantee'
  amount: number
  dueDate: string
  period: string
  status: 'upcoming' | 'overdue' | 'paid'
  legislativeReference: string
}

interface CashFlowForecast {
  financialYear: string
  monthlyForecasts: {
    month: string
    projectedIncome: number
    projectedExpenses: number
    taxObligations: TaxObligation[]
    totalTaxDue: number
    netCashPosition: number
    cumulativeTaxReserve: number  // Recommended tax reserve
  }[]
  annualSummary: {
    totalProjectedTax: number
    recommendedMonthlyReserve: number
    peakTaxMonth: string
    cashFlowRiskMonths: string[]  // Months where tax > available cash
  }
  assumptions: string[]
}
```

**Data source:** Analyses historical transaction patterns from `historical_transactions_cache` to project future income/expenses, then overlays all known tax obligations with their due dates.

---

## 4. Database Schema Changes

### 4.1 New Tables

```sql
-- CGT events tracking
CREATE TABLE IF NOT EXISTS cgt_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  transaction_id TEXT,
  event_type TEXT NOT NULL,
  asset_description TEXT,
  acquisition_date DATE,
  disposal_date DATE,
  cost_base DECIMAL(15,2),
  capital_proceeds DECIMAL(15,2),
  capital_gain DECIMAL(15,2),
  capital_loss DECIMAL(15,2),
  holding_period_months INTEGER,
  eligible_for_discount BOOLEAN DEFAULT FALSE,
  div152_eligible BOOLEAN DEFAULT FALSE,
  financial_year TEXT NOT NULL,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, transaction_id)
);

-- FBT items tracking
CREATE TABLE IF NOT EXISTS fbt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  transaction_id TEXT,
  fbt_year TEXT NOT NULL,
  category TEXT NOT NULL,
  taxable_value DECIMAL(15,2),
  gst_credits DECIMAL(15,2),
  exemption_applied TEXT,
  employee_contribution DECIMAL(15,2),
  fbt_liability DECIMAL(15,2),
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, transaction_id)
);

-- ABN lookup cache
CREATE TABLE IF NOT EXISTS abn_lookup_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  abn TEXT NOT NULL UNIQUE,
  entity_name TEXT,
  entity_type TEXT,
  abn_status TEXT,
  gst_registered BOOLEAN,
  dgr_status BOOLEAN,
  anzsic_code TEXT,
  main_state TEXT,
  raw_response JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Audit risk benchmarks cache
CREATE TABLE IF NOT EXISTS audit_risk_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anzsic_code TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  benchmarks JSONB NOT NULL,
  source_url TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anzsic_code, financial_year)
);

-- Cash flow forecast snapshots
CREATE TABLE IF NOT EXISTS cashflow_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  forecast_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, financial_year)
);
```

### 4.2 RLS Policies

All new tables will follow the existing pattern:
```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own data" ON <table_name>
  FOR ALL USING (auth.uid()::text = tenant_id);
```

The `abn_lookup_cache` and `audit_risk_benchmarks` tables are shared (no RLS per-user) since they contain public data.

---

## 5. API Route Design

All API routes follow the existing pattern from `app/api/analysis/fuel-tax-credits/route.ts`:

| Route | Method | Engine | Description |
|-------|--------|--------|-------------|
| `/api/analysis/cgt` | POST | cgt-engine | CGT analysis with Div 152 concessions |
| `/api/analysis/fbt` | POST | fbt-engine | FBT liability calculation |
| `/api/analysis/psi` | POST | psi-engine | PSI determination and impact |
| `/api/analysis/payg-instalments` | POST | payg-instalment-engine | PAYG optimisation |
| `/api/analysis/payroll-tax` | POST | payroll-tax-engine | Multi-state payroll tax |
| `/api/analysis/audit-risk` | POST | audit-risk-engine | Industry benchmark comparison |
| `/api/analysis/cashflow-forecast` | POST | cashflow-forecast-engine | Tax cash flow projection |
| `/api/integrations/abn-lookup` | GET | abn-lookup | ABN/name/ACN search |

**Standard request body** (POST routes):
```typescript
{
  tenantId: string       // Required
  financialYear?: string // Optional, "FY2024-25" format
  entityType?: string    // Optional, for rate determination
}
```

**Standard response structure:**
```typescript
{
  summary: { ... },
  details: [ ... ],
  taxRateSource: string,
  taxRateVerifiedAt: string,
  legislativeReferences: string[],
  recommendations: string[],
  professionalReviewRequired: boolean
}
```

---

## 6. Rates Fetcher Extensions

Extend `lib/tax-data/rates-fetcher.ts` TaxRates interface to include new rate fields:

```typescript
// Additions to TaxRates interface
fbtRate: number | null              // 47% FY2024-25
fbtGrossUpRate1: number | null      // 2.0802
fbtGrossUpRate2: number | null      // 1.8868
cgtDiscountRate: number | null      // 50%
superGuaranteeRate: number | null   // 11.5% from 1 Jul 2024
payrollTaxRates: Record<string, { threshold: number; rate: number }> | null
```

These will be fetched via new Jina AI scraping methods in the rates fetcher, with fallback constants as per existing pattern.

---

## 7. Test Suite Architecture

### 7.1 Test Framework

**Location:** `__tests__/analysis/` (co-located with source under Next.js conventions)

**Framework:** Jest + ts-jest (already configured in the project)

### 7.2 Test Files

| Test File | Engine(s) Covered | Estimated Test Count |
|-----------|-------------------|---------------------|
| `deduction-engine.test.ts` | Existing deduction engine | ~25 tests |
| `div7a-engine.test.ts` | Existing Div 7A engine | ~20 tests |
| `rnd-engine.test.ts` | Existing R&D engine | ~20 tests |
| `loss-engine.test.ts` | Existing loss engine | ~15 tests |
| `superannuation-cap-analyzer.test.ts` | Existing super engine | ~12 tests |
| `trust-distribution-analyzer.test.ts` | Existing trust engine | ~12 tests |
| `fuel-tax-credits-analyzer.test.ts` | Existing fuel engine | ~12 tests |
| `reconciliation-engine.test.ts` | Existing recon engine | ~15 tests |
| `cgt-engine.test.ts` | NEW CGT + Div 152 | ~30 tests |
| `fbt-engine.test.ts` | NEW FBT engine | ~25 tests |
| `psi-engine.test.ts` | NEW PSI engine | ~15 tests |
| `payg-instalment-engine.test.ts` | NEW PAYG engine | ~15 tests |
| `payroll-tax-engine.test.ts` | NEW payroll tax | ~20 tests (8 states) |
| `audit-risk-engine.test.ts` | NEW audit risk | ~12 tests |
| `abn-lookup.test.ts` | NEW ABN integration | ~10 tests |
| `cashflow-forecast-engine.test.ts` | NEW cash flow | ~12 tests |

**Total: ~270 tests**

### 7.3 Test Strategy

Each test file follows this structure:
1. **Unit tests** for pure calculation functions (no DB, no async)
2. **Integration tests** that mock Supabase client for DB-dependent functions
3. **Edge case tests** for boundary conditions (zero amounts, missing data, invalid FY formats)
4. **Legislative compliance tests** verifying correct application of tax law

**Key test patterns:**
- Mock `createServiceClient()` to return test data (never real DB in tests)
- Mock `getCurrentTaxRates()` to return known rate fixtures
- Use `Decimal` assertions for monetary precision
- Test empty state returns (no data scenarios)
- Test FY boundary handling (transactions on 30 June vs 1 July)

---

## 8. Implementation Order

The engines will be built in dependency order:

### Phase 1: Foundation (no cross-dependencies)
1. ABN Lookup integration (standalone, used by others)
2. Payroll tax engine (standalone calculation)
3. PSI engine (standalone analysis)

### Phase 2: Core Tax Engines
4. CGT engine + Div 152 (needs asset data patterns)
5. FBT engine (needs employee benefit patterns)
6. PAYG instalment engine (needs quarterly income data)

### Phase 3: Cross-Cutting
7. Audit risk benchmarking (needs ABN lookup for ANZSIC)
8. Cash flow forecasting (aggregates all other engine outputs)

### Phase 4: Test Suite
9. Tests for ALL existing engines (8 engines)
10. Tests for ALL new engines (8 engines)

---

## 9. API Contracts for Frontend

Frontend_Dev will need these API contracts:

### CGT Analysis
```
POST /api/analysis/cgt
Request: { tenantId, financialYear?, entityType? }
Response: { summary: CGTSummary, events: CGTEvent[], div152: Div152Analysis }
```

### FBT Analysis
```
POST /api/analysis/fbt
Request: { tenantId, fbtYear? }
Response: { summary: FBTSummary, items: FBTItem[], lodgmentStatus }
```

### PSI Determination
```
POST /api/analysis/psi
Request: { tenantId, financialYear? }
Response: { summary: PSISummary, tests: PSITestResult, restrictedDeductions }
```

### PAYG Optimisation
```
POST /api/analysis/payg-instalments
Request: { tenantId, financialYear? }
Response: { optimisation: PAYGOptimisation, quarters: PAYGQuarter[] }
```

### Payroll Tax
```
POST /api/analysis/payroll-tax
Request: { tenantId, financialYear?, states?: AustralianState[] }
Response: { summary: PayrollTaxSummary, byState: PayrollTaxCalculation[] }
```

### Audit Risk
```
POST /api/analysis/audit-risk
Request: { tenantId, anzsicCode?, financialYear? }
Response: { risk: AuditRiskScore, benchmarks: ANZSICBenchmark, deviations }
```

### ABN Lookup
```
GET /api/integrations/abn-lookup?abn=12345678901
GET /api/integrations/abn-lookup?name=ExampleCorp
Response: { result: ABNLookupResult } or { results: ABNLookupResult[] }
```

### Cash Flow Forecast
```
POST /api/analysis/cashflow-forecast
Request: { tenantId, financialYear? }
Response: { forecast: CashFlowForecast, obligations: TaxObligation[] }
```

---

## 10. CLAUDE.md Updates

After approval, the following sections will be added to CLAUDE.md:
- New engine descriptions in the Architecture Overview
- Updated Tax Rate Cheat Sheet with FBT, payroll tax, CGT rates
- New API routes listed in Quick Reference
- Test commands for running the test suite
- State payroll tax jurisdiction table

---

## 11. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| ABR API downtime | 7-day cache with fallback to last known result |
| ATO benchmark data changes | Jina AI scraping with fallback constants per FY |
| State payroll tax rate changes | Per-FY rate tables with manual override capability |
| FBT year vs income tax FY confusion | Explicit `fbtYear` parameter, clear date boundary handling |
| Decimal precision in CGT calculations | `decimal.js` throughout, never floating-point arithmetic for money |
| Multi-state employer grouping | Proportional threshold allocation algorithm, flagged for professional review |

---

## 12. Files to Create/Modify

### New Files (16):
- `lib/analysis/cgt-engine.ts`
- `lib/analysis/fbt-engine.ts`
- `lib/analysis/psi-engine.ts`
- `lib/analysis/payg-instalment-engine.ts`
- `lib/analysis/payroll-tax-engine.ts`
- `lib/analysis/audit-risk-engine.ts`
- `lib/analysis/cashflow-forecast-engine.ts`
- `lib/integrations/abn-lookup.ts`
- `app/api/analysis/cgt/route.ts`
- `app/api/analysis/fbt/route.ts`
- `app/api/analysis/psi/route.ts`
- `app/api/analysis/payg-instalments/route.ts`
- `app/api/analysis/payroll-tax/route.ts`
- `app/api/analysis/audit-risk/route.ts`
- `app/api/analysis/cashflow-forecast/route.ts`
- `app/api/integrations/abn-lookup/route.ts`

### Modified Files (3):
- `lib/tax-data/rates-fetcher.ts` (add FBT, payroll tax, CGT rates)
- `supabase/migrations/` (new migration for 5 new tables)
- `CLAUDE.md` (updated architecture docs)

### Test Files (16):
- `__tests__/analysis/` (one per engine, existing + new)

---

## 13. COMPLIANCE REMEDIATION (Responding to The_Compliance_Skeptic Audit)

The following critical findings from the compliance audit will be fixed as **Phase 0** -- before any new engine work begins. These affect existing engines and have material correctness impacts.

### FINDING 7A-1 (CRITICAL): Hardcoded FY in div7a-engine.ts line 962

**Problem:** `const currentFY = 'FY2024-25'` is hardcoded. After 30 June 2025, benchmark rate lookups will silently use the wrong rate.

**Fix:** Create a shared utility `lib/utils/financial-year.ts`:
```typescript
/**
 * Determine the current Australian Financial Year from the system date.
 * AU FY runs 1 July - 30 June. e.g. on 15 March 2026 -> 'FY2025-26'
 */
export function getCurrentFinancialYear(referenceDate: Date = new Date()): string {
  const month = referenceDate.getMonth() // 0-indexed (0=Jan, 6=Jul)
  const year = referenceDate.getFullYear()

  // If July onwards (month >= 6), FY starts this calendar year
  // If Jan-June (month < 6), FY started previous calendar year
  const fyStartYear = month >= 6 ? year : year - 1
  const fyEndYear = fyStartYear + 1
  const fyEndShort = String(fyEndYear).slice(-2)

  return `FY${fyStartYear}-${fyEndShort}`
}

/**
 * Determine FBT year (1 April - 31 March) from system date.
 * e.g. on 15 March 2026 -> 'FBT2025-26', on 15 April 2026 -> 'FBT2026-27'
 */
export function getCurrentFBTYear(referenceDate: Date = new Date()): string {
  const month = referenceDate.getMonth()
  const year = referenceDate.getFullYear()

  // If April onwards (month >= 3), FBT year starts this calendar year
  // If Jan-March (month < 3), FBT year started previous calendar year
  const fbtStartYear = month >= 3 ? year : year - 1
  const fbtEndYear = fbtStartYear + 1
  const fbtEndShort = String(fbtEndYear).slice(-2)

  return `FBT${fbtStartYear}-${fbtEndShort}`
}
```

**Files affected:**
- `lib/analysis/div7a-engine.ts` line 962: Replace hardcoded string with `getCurrentFinancialYear()`
- All new engines will use this utility
- All existing engines will be audited for hardcoded FY strings

### FINDING RND-1: R&D offset rate is not always 43.5%

**Problem:** The R&D engine uses a single 43.5% fallback. In reality:
- Turnover < $20M, tax rate 25% (base rate entity): offset = 43.5% (25% + 18.5%) -- REFUNDABLE
- Turnover < $20M, tax rate 30%: offset = 48.5% (30% + 18.5%) -- REFUNDABLE
- Turnover >= $20M: offset = corporate rate + 8.5% -- NON-REFUNDABLE
- $4M annual cap on refundable offsets (s 355-100(3) ITAA 1997)

**Fix:** Modify `rnd-engine.ts` to:
1. Accept `entityTaxRate` and `annualTurnover` parameters
2. Calculate the correct offset rate: `entityTaxRate + 0.185` (18.5% premium)
3. Distinguish refundable (turnover < $20M) vs non-refundable (>= $20M)
4. Enforce the $4M refundable cap per s 355-100(3)
5. Update `RndSummary` to include `isRefundable`, `refundableCap`, `capExceeded` fields

### FINDING LOSS-1: Capital losses vs revenue losses

**Problem:** The loss engine treats ALL losses identically. Capital losses can ONLY offset capital gains (s 102-5 ITAA 1997), never assessable income.

**Fix:**
1. Add `lossType: 'revenue' | 'capital'` field to `LossPosition` and `LossAnalysis`
2. In `fetchLossPositions()`, classify losses based on transaction type/account code:
   - Asset disposal losses = capital losses
   - Operating losses = revenue losses
3. In `optimizeLossUtilization()`, enforce:
   - Revenue losses offset assessable income (existing behaviour)
   - Capital losses ONLY offset capital gains (new constraint)
   - Unapplied capital losses carry forward indefinitely but never reduce taxable income
4. The new CGT engine will cross-reference with the loss engine for capital loss utilisation

### FINDING DED-1: Base rate entity passive income test

**Problem:** `deduction-engine.ts` line 244 uses turnover < $50M as sole condition for 25% rate. Section 23AA also requires the passive income test: no more than 80% of assessable income can be passive (base rate entity passive income test).

**Fix:** Add `passiveIncomePercentage` to `DeductionAnalysisOptions`:
```typescript
interface DeductionAnalysisOptions {
  // ... existing fields
  passiveIncomePercentage?: number // 0-100, must be <= 80 for base rate entity
}
```
In `determineTaxRate()`:
- If `annualTurnover < 50M` AND `passiveIncomePercentage <= 80`: 25% rate
- If `annualTurnover < 50M` AND `passiveIncomePercentage > 80`: 30% rate (fails passive income test)
- Add warning when passive income data is unavailable: "Base rate entity status unconfirmed - passive income test not assessed (s 23AA ITAA 1997)"

### FINDING 7A-2: Division 7A distributable surplus cap

**Problem:** The engine does not cap deemed dividends at the distributable surplus (s 109Y ITAA 1936). A company with $10K distributable surplus cannot have a $500K deemed dividend.

**Fix:** Add to `analyzeSingleLoan()`:
1. Accept optional `distributableSurplus` parameter
2. When provided, cap `deemedDividendRisk` at `Math.min(closingBalance, distributableSurplus)`
3. When not provided, add warning: "Distributable surplus not provided - deemed dividend amount may be overstated (s 109Y ITAA 1936). Verify against company financial statements."
4. Add `distributableSurplusCap` and `distributableSurplusNote` fields to `Division7aAnalysis`

### FINDING SUPER-1: Concessional cap carry-forward

**Problem:** Since FY2018-19, unused concessional cap carries forward for 5 years if total super balance < $500K. Without this, the engine generates false breach alerts.

**Fix:** Add to superannuation cap analyzer:
```typescript
interface CarryForwardAllowance {
  financialYear: string
  unusedCap: number
  expiresAtEndOfFY: string // Expires after 5 years
}

// In EmployeeSuperSummary, add:
carryForwardAvailable: number        // Sum of unused caps from prior 5 FYs
adjustedCap: number                  // concessionalCap + carryForwardAvailable
totalSuperBalance: number | null     // Must be < $500K to access carry-forward
carryForwardEligible: boolean        // totalSuperBalance < $500K
carryForwardBreakdown: CarryForwardAllowance[]
```
Requires `totalSuperBalance` input. When not provided, flag: "Carry-forward eligibility not assessed - total super balance not provided."

---

## 14. Architecture Questions Answered

### Q: What happens when ATO changes a rate mid-year?

**Current:** 24-hour cache TTL means up to 24 hours of stale data.

**Fix (to be implemented):**
1. Add `POST /api/tax-data/refresh` endpoint for manual cache invalidation (admin only)
2. Add `forceRefresh` parameter to all analysis endpoints: `{ tenantId, financialYear, forceRefresh?: boolean }`
3. The rates fetcher already supports `forceRefresh` via `getCacheManager().getRates(true)` -- just need to expose it through API routes
4. Add a `rateEffectiveDate` field to cached rates so engines can detect mid-FY rate changes

### Q: Are amendment period checks applied consistently?

**Current:** Loss engine checks (via `checkAmendmentPeriod()`), deduction engine does NOT.

**Fix:** Extract `checkAmendmentPeriod()` into `lib/utils/financial-year.ts` (alongside `getCurrentFinancialYear()`). Apply consistently in ALL engines that make recommendations for prior FY claims:
- Deduction engine: Add warning for deductions in FYs outside amendment period
- R&D engine: Already has `registrationDeadline` but no amendment period check
- Div 7A engine: Add amendment period warning for corrective actions
- All new engines: Include amendment period check in recommendations

### Q: Where is the data sovereignty configuration?

**Answer:** This must be documented in CLAUDE.md. The implementation plan will:
1. Verify Supabase project region is `ap-southeast-2` (Sydney)
2. Verify Vercel deployment region is `syd1` (Sydney)
3. Add a `DATA_SOVEREIGNTY.md` note to the project root documenting:
   - All financial data must reside in Australian data centres
   - Supabase: ap-southeast-2 (Sydney)
   - Vercel: syd1 (Sydney, Australia)
   - ABR API calls: Australian government endpoint (inherently Australian)
   - Jina AI scraping: Transient only, no data stored externally

### Q: How will quarterly fuel tax credit rate lookups work?

**Fix:** Modify `FuelTaxCreditAnalysis` to include:
1. `quarterlyRates: Record<string, number>` instead of a single annual rate
2. In the rates fetcher, scrape ATO fuel tax credit rate tables which are published quarterly
3. Each fuel purchase transaction is matched to its applicable quarter rate based on `transaction_date`
4. Fallback constants will be per-quarter, not per-year

---

## 15. Revised Implementation Order (incorporating compliance fixes)

### Phase 0: Compliance Remediation (BEFORE new engines)
1. Create `lib/utils/financial-year.ts` (shared FY/FBT year utilities)
2. Fix div7a-engine.ts hardcoded FY (FINDING 7A-1) -- CRITICAL, deadline 30 June 2025
3. Fix rnd-engine.ts offset rate calculation (FINDING RND-1)
4. Fix loss-engine.ts capital vs revenue loss separation (FINDING LOSS-1)
5. Fix deduction-engine.ts base rate entity passive income test (FINDING DED-1)
6. Fix div7a-engine.ts distributable surplus cap (FINDING 7A-2)
7. Fix superannuation carry-forward implementation (FINDING SUPER-1)
8. Add amendment period checks to deduction + R&D engines
9. Add forceRefresh capability to analysis API routes

### Phase 1: Foundation (no cross-dependencies)
10. ABN Lookup integration (standalone, used by others)
11. Payroll tax engine (standalone calculation)
12. PSI engine (standalone analysis)

### Phase 2: Core Tax Engines
13. CGT engine + Div 152 (integrated with capital loss handling from Phase 0)
14. FBT engine (uses FBT year utility from Phase 0)
15. PAYG instalment engine (needs quarterly income data)

### Phase 3: Cross-Cutting
16. Audit risk benchmarking (needs ABN lookup for ANZSIC)
17. Cash flow forecasting (aggregates all other engine outputs)

### Phase 4: Test Suite
18. Tests for ALL existing engines (including compliance fixes)
19. Tests for ALL new engines

### Phase 5: Documentation
20. Update CLAUDE.md with all architectural decisions
21. Add DATA_SOVEREIGNTY.md

---

## 16. Revised Files to Create/Modify

### New Files (17):
- `lib/utils/financial-year.ts` (shared FY utilities -- Phase 0)
- `lib/analysis/cgt-engine.ts`
- `lib/analysis/fbt-engine.ts`
- `lib/analysis/psi-engine.ts`
- `lib/analysis/payg-instalment-engine.ts`
- `lib/analysis/payroll-tax-engine.ts`
- `lib/analysis/audit-risk-engine.ts`
- `lib/analysis/cashflow-forecast-engine.ts`
- `lib/integrations/abn-lookup.ts`
- `app/api/analysis/cgt/route.ts`
- `app/api/analysis/fbt/route.ts`
- `app/api/analysis/psi/route.ts`
- `app/api/analysis/payg-instalments/route.ts`
- `app/api/analysis/payroll-tax/route.ts`
- `app/api/analysis/audit-risk/route.ts`
- `app/api/analysis/cashflow-forecast/route.ts`
- `app/api/integrations/abn-lookup/route.ts`

### Modified Files (existing engine compliance fixes -- 8):
- `lib/analysis/div7a-engine.ts` (FY utility, distributable surplus cap)
- `lib/analysis/rnd-engine.ts` (tiered offset rate, $4M refundable cap)
- `lib/analysis/loss-engine.ts` (capital vs revenue loss separation)
- `lib/analysis/deduction-engine.ts` (passive income test for base rate entity)
- `lib/analysis/superannuation-cap-analyzer.ts` (carry-forward implementation)
- `lib/analysis/fuel-tax-credits-analyzer.ts` (quarterly rate support)
- `lib/tax-data/rates-fetcher.ts` (add FBT, payroll tax, CGT, quarterly fuel rates)
- `CLAUDE.md` (updated architecture docs)

### New Documentation (1):
- `DATA_SOVEREIGNTY.md`

### Migration File (1):
- `supabase/migrations/20260207_new_tax_engines.sql`

### Test Files (16):
- `__tests__/analysis/` (one per engine, existing + new)
