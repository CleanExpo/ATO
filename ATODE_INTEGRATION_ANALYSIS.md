# ATODE Integration Analysis
## Gap Analysis & Implementation Roadmap

**Date**: 2026-01-30
**Version**: 1.0
**Status**: Planning

---

## EXECUTIVE SUMMARY

This document analyzes the Australian Tax Opportunity Discovery Engine (ATODE) integration specification against the current ATO application implementation and provides a phased roadmap for closing identified gaps.

### Current State
- ✅ **Xero Integration**: Fully operational with read-only OAuth 2.0
- ✅ **5 Analysis Engines**: R&D (Div 355), Div 7A, Deductions (Div 8), Loss Carry-Forward (Div 36/165), Reconciliation
- ✅ **AI Forensic Analysis**: Gemini-powered transaction classification with confidence scoring
- ✅ **Historical Data Caching**: 5-year transaction history with incremental sync
- ⚠️ **Multi-Platform Support**: Xero only (MYOB, QBO not implemented)
- ⚠️ **Advanced Analysis**: Trust distributions, business transitions, bad debts incomplete

### Gap Assessment
- **Critical Gaps**: 3 high-priority analysis engines missing
- **Platform Gaps**: MYOB and QuickBooks Online not supported
- **Data Gaps**: 5 additional data categories needed (payroll, BAS, assets, inventory, contacts)
- **API Gaps**: Questionnaire system and gap-filling workflow not implemented

---

## 1. DATA EXTRACTION GAP ANALYSIS

### 1.1 Currently Implemented (Xero Only)

| ATODE Spec Category | Current Implementation | Completeness | Notes |
|---------------------|------------------------|--------------|-------|
| **Chart of Accounts** | ✅ Full | 100% | `/api/xero/accounts` - all fields extracted |
| **Transactions (GL)** | ✅ Full | 100% | Invoices, bills, payments, journals - 5-year history cached |
| **Bank Transactions** | ✅ Full | 100% | `/api/xero/transactions` - includes reconciliation status |
| **Contacts** | ✅ Partial | 60% | Basic contact data extracted, missing ABN/default tax type |
| **Fixed Assets** | ❌ Not Implemented | 0% | Xero Assets API not integrated |
| **Payroll Data** | ❌ Not Implemented | 0% | Requires additional OAuth scopes |
| **BAS Data** | ❌ Not Implemented | 0% | Manual BAS compilation required |
| **Inventory/Stock** | ❌ Not Implemented | 0% | Items API not integrated |

### 1.2 Platform Coverage

| Platform | ATODE Spec Status | Current Status | Priority |
|----------|-------------------|----------------|----------|
| **Xero** | Primary | ✅ Fully Integrated | P0 |
| **MYOB AccountRight** | Supported | ❌ Not Started | P1 |
| **QuickBooks Online** | Supported | ❌ Not Started | P2 |
| **Other Platforms** | Future | ❌ Not Planned | P3 |

### 1.3 Missing Data Points (Xero)

#### High Priority
1. **Fixed Assets** (Section 4.1.3)
   - Required for: Capital allowances, instant asset write-off, depreciation analysis
   - Xero Endpoint: `GET /assets.xro/1.0/Assets`
   - New OAuth Scope: `assets.read`
   - Data Points: Purchase date, cost, disposal, depreciation method, pooling

2. **Payroll Data** (Section 4.1.5)
   - Required for: Superannuation cap analysis, PAYG compliance, FBT calculation
   - Xero Endpoints: `/payroll.xro/2.0/Employees`, `/PayRuns`, `/Timesheets`, `/SuperFunds`
   - New OAuth Scopes: `payroll.employees.read`, `payroll.payruns.read`, `payroll.timesheets.read`
   - Data Points: Employees, pay items, super contributions, leave balances, YTD earnings

3. **Contact Details Enhanced** (Section 4.1.4)
   - Required for: Trust beneficiary analysis, related party detection
   - Current: Basic name/email only
   - Missing: ABN, default tax type, address, customer/supplier flags

#### Medium Priority
4. **BAS Data** (Section 4.1.6)
   - Required for: GST reconciliation, PAYG instalment analysis
   - Xero Endpoint: `GET /api.xro/2.0/Reports/AustralianBASReport` (manual compilation)
   - Data Points: G1-G11, W1-W2, T1-T2 fields, lodgement dates

5. **Inventory Data** (Section 4.1.8)
   - Required for: Trading stock adjustments, valuation methods
   - Xero Endpoint: `GET /api.xro/2.0/Items`
   - Data Points: Tracked inventory, quantities, cost price, asset/COGS accounts

---

## 2. ANALYSIS ENGINE GAP ANALYSIS

### 2.1 Currently Implemented Engines

| Engine | ATODE Trigger | Current Status | Legislation Coverage |
|--------|---------------|----------------|---------------------|
| **R&D Tax Incentive** | Fuel purchases, capital purchases | ✅ Full | Division 355 ITAA 1997 ✅ |
| **Division 7A Compliance** | Director/shareholder loans | ✅ Full | Division 7A ITAA 1936 ✅ |
| **Deduction Optimization** | Various expense categories | ✅ Full | Section 8-1 ITAA 1997 ✅ |
| **Loss Carry-Forward** | Net losses | ✅ Partial | Div 36 ✅, Div 165/166 ⚠️ (COT/SBT manual) |
| **Reconciliation** | Data quality | ✅ Full | N/A |

### 2.2 Missing ATODE Analysis Triggers

| ATODE Trigger (Section 5.1) | Current Implementation | Gap Priority | Notes |
|------------------------------|------------------------|--------------|-------|
| **5.1.1 Fuel Purchases** | ⚠️ Partial | P1 | R&D engine detects, but no **Fuel Tax Credits** analysis (Fuel Tax Act 2006) |
| **5.1.2 Director/Shareholder Loans** | ✅ Full | - | Division 7A engine fully implemented |
| **5.1.3 Trust Distributions** | ❌ Missing | P0 | No trust distribution analysis (Section 100A, UPE) |
| **5.1.4 Superannuation Contributions** | ❌ Missing | P1 | No cap checking engine (requires payroll data) |
| **5.1.5 Capital Purchases** | ⚠️ Partial | P1 | Deduction engine flags, but no **instant write-off optimization** |

### 2.3 High-Priority Missing Engines

#### Engine 6: Trust Distribution Analyzer (Section 5.1.3)
**Legislation**: Section 100A ITAA 1936, Subdivision 115-C (Unpaid Present Entitlements)

**Detection Logic** (from ATODE spec):
```
IF organisation.entity_type = 'TRUST'
AND transaction.account CONTAINS ['distribution', 'beneficiary']
THEN trigger_trust_distribution_review()
```

**Data Points Needed**:
- Distribution amounts by beneficiary
- Beneficiary types (individual, company, sub-trust)
- Distribution resolution dates
- Unpaid entitlements (UPE) tracking
- Related party flags

**Questions Generated**:
- Was a distribution resolution made by 30 June?
- Are there any unpaid entitlements?
- Are beneficiaries related parties?
- Are distributions to minors subject to penalty rates?

**Implementation File**: `lib/analysis/trust-distribution-engine.ts`

---

#### Engine 7: Fuel Tax Credits Analyzer (Section 5.1.1)
**Legislation**: Fuel Tax Act 2006

**Detection Logic**:
```
IF transaction.account IN ['Fuel', 'Petrol', 'Diesel', 'Motor Vehicle']
AND transaction.amount > threshold
THEN trigger_fuel_tax_credit_review()
```

**Data Points Needed**:
- Total fuel spend by account
- Supplier names (to identify fuel type: diesel, petrol, LPG)
- Associated vehicle or equipment accounts
- On-road vs off-road usage percentage

**Fuel Tax Credit Rates (FY2024-25)**:
| Fuel Type | Use | Rate per Litre |
|-----------|-----|----------------|
| Diesel | Heavy vehicles (>4.5t GVM) on-road | 18.2c |
| Diesel | Off-road equipment | 49.6c |
| Petrol | Off-road only | 49.6c |
| LPG | Off-road only | 16.5c |

**Questions Generated**:
- What equipment uses this fuel?
- What percentage is on-road vs off-road?
- What vehicle types (GVM over/under 4.5t)?
- Is usage logged (required for compliance)?

**Implementation File**: `lib/analysis/fuel-tax-credit-engine.ts`

---

#### Engine 8: Superannuation Cap Analyzer (Section 5.1.4)
**Legislation**: Superannuation Guarantee (Administration) Act 1992, Division 291 ITAA 1997 (Concessional Caps)

**Detection Logic**:
```
IF transaction.pay_item_type IN ['SUPER_SG', 'SUPER_SALARY_SAC', 'SUPER_PERSONAL']
THEN aggregate_and_check_caps()
```

**Concessional Contribution Caps (FY2024-25)**:
- General Cap: $30,000/year
- Carry-Forward: Unused cap from prior 5 years (if TSB < $500,000)

**Non-Concessional Caps**:
- General Cap: $120,000/year
- Bring-Forward: Up to $360,000 (if TSB < $1.9M)

**Analysis**:
- YTD contributions by type (SG, salary sacrifice, personal deductible)
- Comparison to concessional/non-concessional caps
- Carry-forward cap availability (requires prior year data)
- Total Superannuation Balance (TSB) estimation from contributions

**Data Points Needed** (from Payroll):
- Employee contributions by type (SG, salary sacrifice, personal)
- Employer contributions (SG vs additional)
- Contribution dates
- YTD totals per employee

**Questions Generated**:
- What is the employee's Total Superannuation Balance (TSB)?
- Are there excess concessional contributions?
- Is carry-forward cap available?
- Should contributions be restructured (timing/type)?

**Implementation File**: `lib/analysis/super-cap-engine.ts`

---

#### Engine 9: Instant Asset Write-Off Optimizer (Section 5.1.5)
**Legislation**: Section 328-180 ITAA 1997 (Small Business Instant Asset Write-Off)

**Detection Logic**:
```
IF transaction.account.type = 'FIXED_ASSET'
AND transaction.amount > instant_write_off_threshold
THEN trigger_depreciation_review()
```

**Instant Write-Off Threshold (FY2024-25)**:
- Small Business Entities (turnover < $10M): $20,000 per asset
- Applies to assets first used or installed ready for use by 30 June

**Alternative: Small Business Pool**:
- Assets costing ≥$20,000 go into SB pool
- Pool depreciated at 15% (year 1) then 30% (subsequent years)
- Pool deducted fully when balance < $20,000

**Analysis**:
- Assets purchased close to thresholds ($18K-$22K range = strategic timing opportunity)
- Assets eligible for instant write-off but depreciated instead (missed opportunity)
- Pooling optimization (when to pool vs instant write-off)
- Motor vehicle limit ($69,674 FY2024-25)

**Data Points Needed** (from Fixed Assets):
- Purchase date
- Cost
- Asset type
- Intended use percentage (business vs private)
- Depreciation method currently applied

**Questions Generated**:
- Is the asset used 100% for business?
- Is it a motor vehicle (check limit $69,674)?
- Was the asset first used before 30 June?
- Should simplified depreciation (SBE pool) be elected?

**Implementation File**: `lib/analysis/instant-write-off-engine.ts`

---

## 3. PLATFORM-SPECIFIC GAPS

### 3.1 MYOB AccountRight Integration (Priority P1)

**OAuth Scopes** (Section 3.1.2):
```
CompanyFile
```

**Key Differences from Xero**:
- Requires company file URI: `GET /{cf_uri}/Info`
- Some endpoints require user credentials beyond OAuth
- Asset tracking **not available via API** (manual import required)
- AU-specific payroll API

**Required Endpoints**:
- `GET /{cf_uri}/GeneralLedger/Account` - Chart of Accounts
- `GET /{cf_uri}/GeneralLedger/JournalTransaction` - Transactions
- `GET /{cf_uri}/Contact/Customer` and `/Contact/Supplier` - Contacts
- `GET /{cf_uri}/Payroll/Employee` - Payroll data
- Tax reports via API (BAS equivalent)

**Implementation Files**:
- `lib/myob/client.ts` - OAuth & API client
- `lib/myob/normalizer.ts` - Convert MYOB data to ATODE internal format
- `app/api/myob/*` - MYOB-specific endpoints

---

### 3.2 QuickBooks Online Integration (Priority P2)

**OAuth Scopes** (Section 3.1.2):
```
com.intuit.quickbooks.accounting
com.intuit.quickbooks.payment
```

**Key Differences from Xero**:
- Uses `realmId` from auth response for API calls
- Minor entity (sandbox) separate from production
- Payroll API (Intuit Payroll) is **separate subscription**
- Australian localisation may have limitations

**Required Endpoints**:
- `GET /v3/company/{companyId}/query?query=select * from Account`
- `GET /v3/company/{companyId}/query?query=select * from Invoice`
- `GET /v3/company/{companyId}/query?query=select * from Item where Type='Fixed Asset'`
- `GET /v3/company/{companyId}/query?query=select * from Customer`
- `GET /v3/company/{companyId}/query?query=select * from Vendor`

**Implementation Files**:
- `lib/quickbooks/client.ts` - OAuth & API client
- `lib/quickbooks/normalizer.ts` - Convert QBO data to ATODE internal format
- `app/api/quickbooks/*` - QBO-specific endpoints

---

## 4. API INTEGRATION GAPS

### 4.1 Missing ATODE API Endpoints (Section 7.1)

| ATODE Endpoint | Current ATO Equivalent | Gap | Priority |
|----------------|------------------------|-----|----------|
| `POST /api/v1/analysis/initiate` | `/api/audit/analyze` | ⚠️ Similar, missing multi-year & client_type params | P2 |
| `GET /api/v1/analysis/{id}/status` | `/api/audit/analysis-status/{tenantId}` | ⚠️ Different URL structure | P2 |
| `GET /api/v1/analysis/{id}/results` | `/api/audit/analysis-results` | ⚠️ Different format | P2 |
| `POST /api/v1/analysis/{id}/questionnaire` | ❌ Not Implemented | **Critical Gap** | P0 |
| `POST /api/v1/analysis/{id}/report` | `/api/audit/reports/generate` | ✅ Implemented | - |

### 4.2 Questionnaire System (Critical Gap)

**Purpose** (Section 7.1.4):
- Collect missing data points identified during analysis
- Examples: Vehicle usage %, equipment types for fuel, trust resolution dates

**Current Workaround**:
- Analysis generates findings with "data required" notes
- No interactive questionnaire to collect responses
- No re-analysis with user-provided data

**Required Implementation**:

1. **Questionnaire Definition Schema**:
```typescript
interface Questionnaire {
  questionnaire_id: string;
  category: string; // VEHICLE_USAGE, FUEL_TAX, TRUST_DISTRIBUTION
  title: string;
  description: string;
  questions: Question[];
}

interface Question {
  question_id: string;
  text: string;
  type: 'TEXT' | 'NUMBER' | 'PERCENTAGE' | 'BOOLEAN' | 'SELECT' | 'DATE';
  options?: string[]; // For SELECT type
  validation?: {
    min?: number;
    max?: number;
    required: boolean;
    pattern?: string; // Regex
  };
}
```

2. **Questionnaire Templates**:
- `/lib/questionnaires/fuel-tax-credits.ts`
- `/lib/questionnaires/vehicle-usage.ts`
- `/lib/questionnaires/trust-distribution.ts`
- `/lib/questionnaires/super-caps.ts`

3. **Response Storage**:
```sql
CREATE TABLE questionnaire_responses (
  response_id UUID PRIMARY KEY,
  analysis_id UUID REFERENCES analysis_sessions(id),
  questionnaire_id VARCHAR NOT NULL,
  question_id VARCHAR NOT NULL,
  answer TEXT NOT NULL,
  answered_at TIMESTAMPTZ DEFAULT NOW()
);
```

4. **Re-Analysis Trigger**:
- After questionnaire submission, re-run affected analysis engine
- Update opportunity confidence scores based on user-provided data
- Generate refined recommendations

**Implementation Files**:
- `lib/questionnaires/schema.ts` - TypeScript interfaces
- `lib/questionnaires/*.ts` - Template definitions
- `app/api/questionnaire/[analysisId]/route.ts` - API endpoint
- Component: `components/questionnaire/QuestionnaireForm.tsx`

---

## 5. DATA NORMALIZATION GAP

### 5.1 ATODE Internal Format (Section 4.3)

**Current State**:
- Each analysis engine works directly with Xero data structures
- No unified internal format
- Platform-agnostic analysis impossible

**Required**:
```typescript
interface ATODENormalizedData {
  organisation: OrganisationInfo;
  periods: FinancialPeriod[];
  accounts: NormalizedAccount[];
  transactions: NormalizedTransaction[];
  assets: NormalizedAsset[];
  contacts: NormalizedContact[];
  employees: NormalizedEmployee[];
  bas_periods: NormalizedBAS[];
}
```

**Implementation**:
- `lib/normalization/xero-normalizer.ts` - Xero → ATODE format
- `lib/normalization/myob-normalizer.ts` - MYOB → ATODE format
- `lib/normalization/qbo-normalizer.ts` - QBO → ATODE format
- `lib/normalization/schema.ts` - Shared TypeScript interfaces

**Benefit**:
- Analysis engines become platform-agnostic
- Add new platforms without modifying engines
- Consistent data quality across platforms

---

## 6. SECURITY & COMPLIANCE GAPS

### 6.1 Token Storage (Section 6.1.1)

**Current State**:
- OAuth tokens stored in `xero_connections` table
- **No encryption at rest** (ATODE spec requires AES-256)

**Required**:
- Implement `lib/security/token-encryption.ts`
- Use environment variable `TOKEN_ENCRYPTION_KEY` (32-byte hex)
- Encrypt tokens before storage, decrypt on retrieval

**Code Update**:
```typescript
// lib/xero/client.ts
import { encryptToken, decryptToken } from '@/lib/security/token-encryption';

// Before storage:
const encryptedAccessToken = encryptToken(tokenSet.access_token);
const encryptedRefreshToken = encryptToken(tokenSet.refresh_token);

// On retrieval:
const accessToken = decryptToken(row.access_token);
const refreshToken = decryptToken(row.refresh_token);
```

### 6.2 Data Purging (Section 6.1.3)

**Current State**:
- Historical transaction cache persists indefinitely
- No automatic purging after analysis session

**ATODE Requirement**:
- Analysis sessions time out after 60 minutes of inactivity
- Extracted data purged at session end
- Audit log retained for 7 years (without personal data)

**Required**:
- Session management: `lib/sessions/session-manager.ts`
- Purge logic: Delete `forensic_analysis_results` after 60 minutes idle
- Audit log: Create `audit_log` table with sanitized data only

### 6.3 Audit Trail (Section 6.3.2)

**Current State**:
- No comprehensive audit logging

**Required**:
```sql
CREATE TABLE audit_log (
  event_id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  action VARCHAR NOT NULL, -- DATA_EXTRACT, ANALYSIS_RUN, REPORT_GENERATE
  resource VARCHAR, -- invoices, accounts, etc.
  organisation_id UUID,
  ip_address VARCHAR,
  user_agent TEXT
);
```

**Retention**: 7 years (no personal data)

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1: Critical Data Gaps (4-6 weeks)

**Priority**: P0 - Immediate
**Goal**: Extract all required Xero data categories

| Task | Effort | Owner |
|------|--------|-------|
| **Task 1.1**: Implement Fixed Assets extraction | 1 week | Specialist B |
| - Add `assets.read` OAuth scope | | |
| - Create `/api/xero/assets` endpoint | | |
| - Update data model: `NormalizedAsset` interface | | |
| **Task 1.2**: Implement Payroll data extraction | 2 weeks | Specialist B |
| - Add payroll OAuth scopes | | |
| - Create `/api/xero/employees`, `/payroll`, `/super-funds` endpoints | | |
| - Update data model: `NormalizedEmployee`, `PayrollData` interfaces | | |
| **Task 1.3**: Enhance Contact data | 3 days | Specialist B |
| - Extract ABN, default tax type, address | | |
| - Update `NormalizedContact` interface | | |
| **Task 1.4**: Implement BAS data extraction | 1 week | Specialist B |
| - Create `/api/xero/bas-report` endpoint | | |
| - Manual compilation logic for G1-G11, W1-W2, T1-T2 | | |
| **Task 1.5**: Implement Inventory extraction | 3 days | Specialist B |
| - Create `/api/xero/items` endpoint | | |
| - Update data model: `NormalizedInventoryItem` | | |

**Deliverables**:
- All 8 ATODE data categories extracted from Xero
- Updated OAuth scopes (assets, payroll)
- Comprehensive data models

---

### Phase 2: Critical Analysis Engines (6-8 weeks)

**Priority**: P0-P1 - High
**Goal**: Implement missing high-value analysis engines

| Task | Effort | Owner |
|------|--------|-------|
| **Task 2.1**: Trust Distribution Analyzer | 2 weeks | Specialist B + Tax Agent |
| - Detection logic (trust entity, distribution accounts) | | |
| - Section 100A compliance analysis | | |
| - UPE tracking and beneficiary classification | | |
| - Questionnaire: Trust distribution details | | |
| **Task 2.2**: Fuel Tax Credits Analyzer | 2 weeks | Specialist B + Tax Agent |
| - Detection logic (fuel accounts, supplier matching) | | |
| - Fuel type classification (diesel, petrol, LPG) | | |
| - On-road vs off-road usage calculation | | |
| - Questionnaire: Equipment types, usage logs | | |
| **Task 2.3**: Superannuation Cap Analyzer | 2 weeks | Specialist B + Tax Agent |
| - Contribution aggregation (SG, salary sacrifice, personal) | | |
| - Cap comparison (concessional $30K, non-concessional $120K) | | |
| - Carry-forward cap calculation | | |
| - Questionnaire: TSB, prior contributions | | |
| **Task 2.4**: Instant Write-Off Optimizer | 1 week | Specialist B + Tax Agent |
| - Asset threshold detection ($20K instant write-off) | | |
| - Motor vehicle limit check ($69,674) | | |
| - SBE pool vs instant write-off optimization | | |
| - Questionnaire: Asset usage %, first use date | | |

**Deliverables**:
- 4 new analysis engines fully implemented
- Integration with existing AI forensic analysis
- Questionnaire templates for each engine
- Legislative references and confidence scoring

---

### Phase 3: Questionnaire System (3-4 weeks)

**Priority**: P0 - Critical
**Goal**: Interactive data gap filling

| Task | Effort | Owner |
|------|--------|-------|
| **Task 3.1**: Questionnaire schema & templates | 1 week | Specialist A |
| - Define TypeScript interfaces | | |
| - Create template library | | |
| **Task 3.2**: API implementation | 1 week | Specialist B |
| - `POST /api/questionnaire/{analysisId}` endpoint | | |
| - Response storage in database | | |
| **Task 3.3**: Frontend components | 1 week | Specialist B |
| - `QuestionnaireForm.tsx` component | | |
| - Dynamic question rendering | | |
| - Validation and submission | | |
| **Task 3.4**: Re-analysis integration | 1 week | Specialist B |
| - Trigger affected engines after submission | | |
| - Update opportunity confidence scores | | |
| - Generate refined recommendations | | |

**Deliverables**:
- Interactive questionnaire system
- 5+ questionnaire templates (fuel, vehicles, trust, super, assets)
- Re-analysis workflow

---

### Phase 4: Security & Compliance (2-3 weeks)

**Priority**: P1 - High
**Goal**: Meet ATODE security requirements

| Task | Effort | Owner |
|------|--------|-------|
| **Task 4.1**: Token encryption | 3 days | Specialist B |
| - Implement AES-256 encryption | | |
| - Migrate existing tokens | | |
| **Task 4.2**: Session management | 1 week | Specialist B |
| - 60-minute timeout logic | | |
| - Data purging on session end | | |
| **Task 4.3**: Audit logging | 1 week | Specialist B |
| - Create `audit_log` table | | |
| - Log all data access events | | |
| - 7-year retention policy | | |

**Deliverables**:
- AES-256 encrypted token storage
- Automatic session timeout and data purging
- Comprehensive audit trail

---

### Phase 5: Platform Expansion (8-12 weeks)

**Priority**: P1-P2 - Medium
**Goal**: Support MYOB and QuickBooks Online

| Task | Effort | Owner |
|------|--------|-------|
| **Task 5.1**: Data normalization layer | 2 weeks | Specialist A + B |
| - Define ATODE internal format | | |
| - Create Xero normalizer | | |
| - Refactor engines to use normalized data | | |
| **Task 5.2**: MYOB integration | 4 weeks | Specialist B |
| - OAuth 2.0 implementation | | |
| - Data extraction endpoints | | |
| - MYOB normalizer | | |
| **Task 5.3**: QuickBooks Online integration | 4 weeks | Specialist B |
| - OAuth 2.0 implementation | | |
| - Data extraction endpoints | | |
| - QBO normalizer | | |

**Deliverables**:
- Platform-agnostic analysis engines
- Full MYOB AccountRight integration
- Full QuickBooks Online integration

---

### Phase 6: API Standardization (2-3 weeks)

**Priority**: P2 - Medium
**Goal**: Match ATODE API specification exactly

| Task | Effort | Owner |
|------|--------|-------|
| **Task 6.1**: Refactor endpoints to match ATODE spec | 1 week | Specialist B |
| - `/api/v1/analysis/initiate` | | |
| - `/api/v1/analysis/{id}/status` | | |
| - `/api/v1/analysis/{id}/results` | | |
| **Task 6.2**: Update response formats | 1 week | Specialist B |
| - Match ATODE JSON structure | | |
| - Add missing fields (estimated_benefit_min/max, categories_reviewed) | | |

**Deliverables**:
- ATODE-compliant API endpoints
- Consistent response formats

---

## 8. RISK ASSESSMENT

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Xero API rate limits** | High | Medium | Implement caching, batch requests, exponential backoff |
| **OAuth scope changes** | Medium | Low | Monitor Xero developer portal, implement graceful degradation |
| **Payroll data access** | High | Medium | Clear consent flow, separate OAuth for payroll scopes |
| **Multi-platform complexity** | High | High | Build normalization layer first, test thoroughly |
| **Tax law changes** | Medium | Medium | Maintain tax rate cache, flag outdated rates |
| **Data encryption overhead** | Low | Low | Use efficient AES-256 library, benchmark performance |

---

## 9. SUCCESS METRICS

### Phase 1 Success Criteria
- [ ] All 8 ATODE data categories extracted from Xero
- [ ] Payroll OAuth scopes granted by test organisations
- [ ] BAS data accurately compiled and validated

### Phase 2 Success Criteria
- [ ] 4 new analysis engines pass validation tests
- [ ] Fuel tax credit calculations verified against ATO examples
- [ ] Trust distribution analysis covers Section 100A scenarios
- [ ] Superannuation cap calculations match ATO caps

### Phase 3 Success Criteria
- [ ] Questionnaire system deployed and functional
- [ ] User response rate >70% for data gap questions
- [ ] Re-analysis improves opportunity confidence by >20%

### Phase 4 Success Criteria
- [ ] All tokens encrypted with AES-256
- [ ] Session timeout purges data correctly
- [ ] Audit log captures all events without PII

### Phase 5 Success Criteria
- [ ] MYOB integration extracts equivalent data to Xero
- [ ] QBO integration extracts equivalent data to Xero
- [ ] All analysis engines work with normalized data

---

## 10. RESOURCE REQUIREMENTS

### Development Team (Multi-Agent Framework)

| Role | Allocation | Phase Focus |
|------|------------|-------------|
| **Specialist A (Architect)** | 30% | Data model design, normalization layer, security architecture |
| **Specialist B (Developer)** | 100% | All API implementations, OAuth flows, engine development |
| **Specialist C (Tester)** | 50% | Validation tests, security testing, platform compatibility |
| **Specialist D (Reviewer)** | 30% | API documentation, questionnaire templates, legislative references |
| **Tax Law Analyst Agent** | Consultative | Legislative validation, tax calculation verification |
| **R&D Tax Specialist Agent** | Consultative | R&D four-element test refinement |

### Infrastructure

| Resource | Requirement | Purpose |
|----------|-------------|---------|
| **Supabase Database** | Expand storage | Additional tables for payroll, BAS, assets, inventory |
| **Encryption Keys** | Generate 32-byte key | AES-256 token encryption |
| **OAuth Credentials** | MYOB & QBO dev accounts | Platform integration testing |
| **Test Data** | Multi-platform sandbox orgs | Comprehensive testing |

---

## 11. NEXT STEPS

### Immediate Actions (This Week)

1. **Review & Approve Plan**
   - Developer approval of phased approach
   - Resource allocation confirmation
   - Timeline validation

2. **Setup Phase 1**
   ```bash
   # Create Linear parent issue for ATODE Integration
   npm run agent:orchestrator -- \
     --task "ATODE Integration: Extract all Xero data categories" \
     --priority Critical \
     --type feature
   ```

3. **Kickoff Architecture Review**
   - Specialist A: Design normalized data schema
   - Specialist A: Plan OAuth scope expansion
   - Specialist A: Design questionnaire system architecture

4. **Begin Development**
   - Specialist B: Implement Fixed Assets extraction (Task 1.1)
   - Specialist B: Add Payroll OAuth scopes (Task 1.2)

### Weekly Progress Tracking

```bash
# Daily status reports
npm run agent:daily-report

# Quality gate checks before phase transitions
npm run agent:quality-gate -- --gate implementation-complete --task ORCH-XXX

# Weekly comprehensive report
npm run linear:report
```

---

## APPENDIX A: FILE MANIFEST

### New Files to Create (Phase 1-3)

**Data Extraction**:
- `app/api/xero/assets/route.ts`
- `app/api/xero/employees/route.ts`
- `app/api/xero/payroll/route.ts`
- `app/api/xero/super-funds/route.ts`
- `app/api/xero/bas-report/route.ts`
- `app/api/xero/items/route.ts`

**Analysis Engines**:
- `lib/analysis/trust-distribution-engine.ts`
- `lib/analysis/fuel-tax-credit-engine.ts`
- `lib/analysis/super-cap-engine.ts`
- `lib/analysis/instant-write-off-engine.ts`

**Questionnaire System**:
- `lib/questionnaires/schema.ts`
- `lib/questionnaires/fuel-tax-credits.ts`
- `lib/questionnaires/vehicle-usage.ts`
- `lib/questionnaires/trust-distribution.ts`
- `lib/questionnaires/super-caps.ts`
- `app/api/questionnaire/[analysisId]/route.ts`
- `components/questionnaire/QuestionnaireForm.tsx`

**Security**:
- `lib/security/token-encryption.ts`
- `lib/sessions/session-manager.ts`

**Normalization (Phase 5)**:
- `lib/normalization/schema.ts`
- `lib/normalization/xero-normalizer.ts`
- `lib/normalization/myob-normalizer.ts`
- `lib/normalization/qbo-normalizer.ts`

**Platform Integration (Phase 5)**:
- `lib/myob/client.ts`
- `lib/myob/endpoints.ts`
- `app/api/myob/*`
- `lib/quickbooks/client.ts`
- `lib/quickbooks/endpoints.ts`
- `app/api/quickbooks/*`

### Files to Update

**OAuth Scopes**:
- `lib/xero/client.ts` - Add assets, payroll scopes

**Database Migrations**:
- `supabase/migrations/XXX_add_assets_table.sql`
- `supabase/migrations/XXX_add_payroll_tables.sql`
- `supabase/migrations/XXX_add_questionnaire_responses.sql`
- `supabase/migrations/XXX_add_audit_log.sql`
- `supabase/migrations/XXX_encrypt_tokens.sql`

**TypeScript Types**:
- `lib/types/index.ts` - Add normalized data interfaces

---

## APPENDIX B: LEGISLATIVE REFERENCES

All new analysis engines must include:

| Engine | Primary Legislation | ATO Resources |
|--------|---------------------|---------------|
| Trust Distribution | Section 100A ITAA 1936, Subdivision 115-C | TR 2022/4 (Section 100A) |
| Fuel Tax Credits | Fuel Tax Act 2006 | Fuel tax credit rates (ato.gov.au) |
| Super Cap | Div 291 ITAA 1997, SG(A)A 1992 | Super contributions caps (ato.gov.au) |
| Instant Write-Off | s 328-180 ITAA 1997 | Instant asset write-off (ato.gov.au) |

---

**Document Status**: Ready for Review
**Next Review**: After Phase 1 completion
**Maintained By**: Orchestrator + Specialist A

---

*This analysis uses the Multi-Agent Architecture Framework for implementation planning.
See MULTI_AGENT_ARCHITECTURE.md for development process details.*
