# Compliance Risk Assessment v2

**Australian Tax Optimizer (ATO) Platform**
**Audited by: The_Compliance_Skeptic**
**Assessment Date: 2026-02-07**
**Scope: Full application audit -- all 16 analysis engines, API routes, database migrations, shared report system, OAuth flow, data sovereignty posture**

---

## Executive Summary

This assessment identifies the **three most significant compliance risks** facing the ATO platform before production deployment. These risks are ranked by a composite score considering: (a) regulatory penalty severity, (b) probability of materialising, and (c) breadth of user impact.

### Risk Heat Map

| # | Risk | Severity | Likelihood | Impact | Composite |
|---|------|----------|------------|--------|-----------|
| 1 | Cross-Border Data Processing Without Informed Consent | CRITICAL | HIGH | ALL USERS | **CRITICAL** |
| 2 | Unregistered Tax Agent Services Exposure | CRITICAL | HIGH | ALL USERS + THIRD PARTIES | **CRITICAL** |
| 3 | FBT Engine Systemic Miscalculation (Live Rates Bug) | HIGH | CERTAIN | ALL FBT ANALYSES | **HIGH** |

**Overall Platform Risk Rating: HIGH**

The platform cannot be deployed to production until Risk 1 and Risk 2 are remediated. Risk 3 will produce materially incorrect outputs for every FBT analysis run.

---

## Risk 1: Cross-Border Data Processing Without Informed Consent

**Severity: CRITICAL**
**Regulatory Framework: Privacy Act 1988 (Cth), APP 1, APP 6, APP 8; Notifiable Data Breaches Scheme**
**Maximum Penalty: $50,000,000 or 30% of adjusted turnover for body corporate (s 13G Privacy Act, post-2022 amendments)**

### 1.1 Description

The application sends Australian financial transaction data -- including transaction descriptions that may contain personal information such as employee names and client identifiers -- to Google Gemini AI for forensic analysis. **Supplier names are now anonymised** (replaced with `Supplier_1`, `Supplier_2` tokens) before Gemini API calls via `lib/ai/pii-sanitizer.ts` (implemented 2026-02-08). However, this cross-border disclosure still occurs without:

1. **Collection notice** (APP 1.4): Users are not informed at or before the time of Xero OAuth connection that their financial data will be sent to overseas AI services.
2. **Cross-border disclosure consent** (APP 8.2(b)): No explicit consent mechanism exists for the overseas transfer of personal information to Google.
3. **Contractual protections** (APP 8.2(a)): No Google Cloud Data Processing Agreement has been reviewed or executed to ensure Google is bound by obligations equivalent to the APPs.
4. **Data Processing Agreement verification**: DATA_SOVEREIGNTY.md (line 107-110) lists four unchecked action items for Gemini data handling.

### 1.2 Affected Code and Data Flows

| Component | File | Data Exposed |
|-----------|------|-------------|
| Forensic Analysis | `lib/ai/forensic-analyzer.ts`, `lib/ai/account-classifier.ts` | Transaction descriptions, amounts, account codes, date ranges. **Supplier names anonymised** (2026-02-08) |
| Rate Fetcher | `lib/tax-data/brave-client.ts` | Tax rate search queries (no PII -- LOW risk) |
| Rate Scraper | `lib/tax-data/jina-scraper.ts` | ATO.gov.au URLs only (no PII -- LOW risk) |

The primary concern is the Gemini AI data flow. Transaction descriptions sourced from Xero may contain:
- ~~Supplier/customer names (personal information under Privacy Act s 6)~~ **MITIGATED** (2026-02-08): Supplier names anonymised via `lib/ai/pii-sanitizer.ts` before Gemini API calls
- Employee names in payroll transactions
- ABN numbers linked to sole traders (identifying information)
- Invoice references containing client identifiers

### 1.3 DATA_SOVEREIGNTY.md Status

The platform's own data sovereignty document (created 2026-02-07) acknowledges this risk but lists four unchecked remediation items:

1. `[ ]` Review Google Cloud Terms of Service for Gemini API data handling
2. `[ ]` Confirm Gemini API does not retain input data beyond request processing
3. `[ ]` Consider Google Cloud Australia region for API routing if available
4. `[ ]` Add user consent notice before first AI analysis

Additionally:
- Supabase region verified as required (ap-southeast-2) but marked "ACTION REQUIRED" -- not confirmed
- Vercel deployment region marked "VERIFY" -- not confirmed
- Privacy Officer contact listed as "to be added before production deployment"
- Breach response plan exists in document form but no technical implementation (no breach detection, no automated notification)

### 1.4 Consequences

- **OAIC Investigation**: The Office of the Australian Information Commissioner can investigate upon complaint or own motion. Financial data sent overseas without APP 8 compliance is a clear trigger.
- **Civil penalty**: Up to $50M or 30% of adjusted turnover under the enhanced penalty regime (Privacy Legislation Amendment (Enforcement and Other Measures) Act 2022).
- **Notifiable Data Breach**: If transaction data is exposed through a Gemini API breach, the entity is deemed to have caused the breach because APP 8.1 makes the disclosing entity accountable for the overseas recipient's actions.
- **Reputational**: Financial professionals will not use a platform that sends their client data to overseas AI services without transparency.

### 1.5 Required Remediation

1. **IMMEDIATE**: Add pre-analysis consent interstitial: "Your transaction data (descriptions, amounts, dates) will be processed by Google Gemini AI. Google may process this data outside Australia. Do you consent?"
2. **IMMEDIATE**: Add APP 1 Collection Notice to the pre-OAuth connection page listing all data collected, purposes, and overseas disclosures.
3. **BEFORE PRODUCTION**: Execute Google Cloud Data Processing Agreement and verify Gemini API terms re: data retention.
4. **BEFORE PRODUCTION**: Confirm Supabase region is ap-southeast-2 and Vercel region is syd1 in live deployment.
5. ~~**BEFORE PRODUCTION**: Implement technical data minimisation -- strip supplier/customer names from transaction descriptions before sending to Gemini where possible.~~ **DONE** (2026-02-08): Supplier names anonymised via `lib/ai/pii-sanitizer.ts`. Applied in `forensic-analyzer.ts` and `account-classifier.ts`.
6. **BEFORE PRODUCTION**: Appoint Privacy Officer and publish contact details in application.

---

## Risk 2: Unregistered Tax Agent Services Exposure

**Severity: CRITICAL**
**Regulatory Framework: Tax Agent Services Act 2009 (TASA), s 50-5, s 90-5; Tax Practitioners Board (TPB) requirements**
**Maximum Penalty: $262,500 per offence for body corporate (s 50-5(2) TASA)**

### 2.1 Description

The application generates dollar-amount "recommendations" and "estimated savings" that cross the boundary from analytical software into territory that the TPB may consider "tax agent services" under s 90-5 TASA. While a legal disclaimer exists (TaxDisclaimer component), three compounding issues severely undermine its protective value:

#### Issue A: Disclaimer is Functionally Invisible

**File**: `C:/ATO/ato-app/components/dashboard/TaxDisclaimer.tsx`, line 28

```
<p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
```

The disclaimer renders at **10px font size** with a muted colour against a dark background. At 10px, the text is:
- Below the minimum readable size for most users (12px is the widely-accepted minimum)
- Likely to be dismissed by a court as inadequate notice, especially for a disclaimer intended to limit liability for financial harm
- Below the platform's own compliance requirement documented in CLAUDE.md (section 12: "Must be >= 12px, >= 60% opacity")

The previous audit flagged this exact issue. The remediation was listed as "CONDITIONAL" but remains unfixed.

#### Issue B: Shared Reports Expose Dollar Estimates to Non-Users

**File**: `C:/ATO/ato-app/app/api/share/[token]/route.ts`, lines 303-306

The share API calculates `totalPotentialBenefit` using a flat 25% tax rate estimate:

```
return sum + Math.abs(amount) * 0.25; // Rough estimate at 25% tax rate
```

This dollar amount is served to **unauthenticated external users** (accountants) who:
- Never agreed to the platform's Terms of Service
- May rely on these estimates to advise their own clients
- See the estimates alongside legislative references and action steps (lines 460-476) that constitute step-by-step tax advice

While the share page now includes `<TaxDisclaimer sticky />` (addressing a previous finding), the disclaimer at 10px is still functionally invisible.

#### Issue C: Recommendations Include Specific Filing Instructions

The shared report API generates recommendations with explicit steps (line 470-476):

```
steps: [
  'Review transaction details with accountant',
  f.actionRequired,
  'Prepare supporting documentation',
  'Lodge amendment if applicable',
]
```

Combined with dollar estimates, legislative references, and action items, this constitutes guidance that a reasonable person would interpret as tax advice -- not merely analytical output.

### 2.2 TASA 2009 Analysis

Section 90-5 defines "tax agent service" to include:
- (a) preparing a return or statement under a taxation law
- (b) ascertaining liabilities, obligations, or entitlements under a taxation law
- (c) advising about liabilities, obligations, or entitlements under a taxation law

The platform's outputs clearly fall within (b) and (c). The disclaimer attempts to re-characterise this as "informational purposes only" -- but the substance of the output (dollar amounts, legislative references, filing instructions, amendment recommendations) may override the disclaimer in a TPB enforcement action.

**Key legal principle**: A disclaimer cannot convert advice into non-advice if the substance of the communication would be understood by a reasonable recipient as advice. See *ASIC v Westpac Securities Administration Ltd* [2019] FCAFC 187 (analogous principle in financial services).

### 2.3 Consequences

- **TPB enforcement**: Up to $262,500 per offence for a body corporate providing tax agent services without registration.
- **Professional indemnity gap**: The platform explicitly states it does NOT hold PI insurance. If a user acts on a recommendation and suffers loss, no insurance coverage exists.
- **Accountant liability**: Accountants who receive shared reports and act on them may face their own TPB/PI exposure if they relied on unregistered software output.
- **Multiple offences**: Each shared report could constitute a separate offence under s 50-5.

### 2.4 Required Remediation

1. **IMMEDIATE**: Increase TaxDisclaimer font size from `text-[10px]` to minimum `text-xs` (12px) and increase opacity to at least 60%.
2. **IMMEDIATE**: Remove specific dollar estimates from shared reports OR add prominent "ESTIMATE ONLY" labelling at same font size as the estimates themselves.
3. **BEFORE PRODUCTION**: Obtain legal opinion on whether the platform's outputs constitute "tax agent services" under s 90-5 TASA.
4. **BEFORE PRODUCTION**: If legal opinion confirms risk, either:
   - (a) Register with TPB and obtain PI insurance, OR
   - (b) Re-architect outputs to provide only data visualisation and categorisation without dollar estimates, legislative references, or filing instructions.
5. **STRUCTURAL**: Ensure shared report recipients cannot download or forward reports without the disclaimer permanently embedded in the document (not just rendered in the browser).

---

## Risk 3: FBT Engine Systemic Miscalculation (Live Rates Bug)

**Severity: HIGH**
**Regulatory Framework: Fringe Benefits Tax Assessment Act 1986 (FBTAA); s 66 FBTAA (assessment); s 67 FBTAA (penalty for incorrect return)**
**Impact: Every FBT analysis produced by the platform will use fallback rates regardless of live rate availability**

### 3.1 Description

The FBT engine contains a code defect where live tax rates are fetched from the ATO but **never assigned to the calculation variables**. This means every FBT analysis uses hardcoded fallback rates regardless of whether current rates are available.

**File**: `C:/ATO/ato-app/lib/analysis/fbt-engine.ts`, lines 152-163

```typescript
// Lines 152-163
let fbtRate = FALLBACK_FBT_RATE           // Set to fallback
let grossUpRate1 = FALLBACK_GROSS_UP_RATE_1 // Set to fallback
let grossUpRate2 = FALLBACK_GROSS_UP_RATE_2 // Set to fallback
let rateSource = 'ATO_FALLBACK_DEFAULT'

try {
  const rates = await getCurrentTaxRates()
  if (rates.sources.corporateTax) rateSource = rates.sources.corporateTax
  // BUG: fbtRate, grossUpRate1, grossUpRate2 are NEVER updated from rates
  // The fetched rates are discarded. Only rateSource string is updated.
} catch (err) {
  console.warn('Failed to fetch live FBT rates', err)
}
```

The `rateSource` variable is updated (giving a false impression that live rates are in use), but the three rate variables that actually drive calculations (`fbtRate`, `grossUpRate1`, `grossUpRate2`) remain at their fallback values.

### 3.2 Compounding Issues

This bug is compounded by three additional FBT engine deficiencies:

#### 3.2.1 Type 1/Type 2 Gross-Up Determination is Naive

**File**: `C:/ATO/ato-app/lib/analysis/fbt-engine.ts`, line 257 (approximate)

The engine determines Type 1 vs Type 2 benefits using simple keyword matching:
- `meal_entertainment` -> Type 2
- Everything else -> Type 1

In reality, the Type 1/Type 2 determination depends on whether the employer is entitled to a GST input tax credit for the benefit -- a per-item determination that requires knowledge of the supplier's GST registration status, the nature of the supply, and whether the benefit is GST-free or input taxed.

**Impact**: A Type 2 benefit incorrectly classified as Type 1 will be grossed up at 2.0802 instead of 1.8868, overstating the FBT liability by approximately 10% per item.

#### 3.2.2 Car Fringe Benefits Have No Valuation Method

Cars are the single most common fringe benefit category. The FBTAA provides two valuation methods:
- **Statutory formula method** (s 9): Based on cost of car and number of days available
- **Operating cost method** (s 10): Based on actual operating costs and business use percentage

The FBT engine classifies car benefits but provides no calculation for either method. The `FBTItem` type lacks fields for kilometres driven, log book data, or method selection.

#### 3.2.3 Otherwise Deductible Rule Not Applied

Section 24 FBTAA allows the taxable value of a fringe benefit to be reduced to the extent the employee would have been entitled to a deduction for the expense. This is classified in the engine but never applied as a numerical reduction.

### 3.3 Quantified Impact

For a typical SME with 20 employees and $200,000 in annual fringe benefits:

| Scenario | Correct FBT Liability | Engine Output | Error |
|----------|----------------------|---------------|-------|
| All Type 1 at 47% | $93,000 | $93,000 (if fallback is 47%) | $0 (coincidental) |
| Mixed Type 1/2 | $87,500 | $93,000 (all treated as Type 1) | +$5,500 |
| If FBT rate changes from 47% | Changes | $93,000 (still at 47%) | Variable |

The error is most dangerous when it produces **overestimates** -- if an employer relies on the engine to assess FBT liability and then discovers the actual liability is lower, they may have made unnecessary cash flow provisions. However, if the fallback rate is lower than the actual rate, the engine will **underestimate** liability, potentially leading to shortfall penalties.

### 3.4 Consequences

- **s 67 FBTAA**: If an employer lodges an incorrect FBT return based on this engine's output, shortfall penalties apply (25-75% of the shortfall amount depending on culpability).
- **Professional liability**: Users who rely on materially incorrect FBT analysis may have a claim against the platform operator, despite disclaimers (see Risk 2 re: disclaimer adequacy).
- **Cascading errors**: FBT liability feeds into income tax deductions (employers can deduct FBT paid). Incorrect FBT -> incorrect income tax deduction -> compounding error.

### 3.5 Required Remediation

1. **IMMEDIATE**: Fix the rate assignment bug -- add lines to assign fetched rates to the calculation variables:
   ```
   if (rates.fbtRate) fbtRate = rates.fbtRate
   if (rates.fbtType1GrossUpRate) grossUpRate1 = rates.fbtType1GrossUpRate
   if (rates.fbtType2GrossUpRate) grossUpRate2 = rates.fbtType2GrossUpRate
   ```
2. **HIGH PRIORITY**: Implement per-item Type 1/Type 2 determination based on GST credit entitlement data (may require additional Xero scope or user input).
3. **HIGH PRIORITY**: Implement at least the statutory formula method for car fringe benefits.
4. **MEDIUM**: Implement otherwise deductible rule (s 24 FBTAA) as a taxable value reduction.

---

## Secondary Findings

### Category A: Tax Law Accuracy (Engines)

| ID | Engine | Finding | Severity | Status |
|----|--------|---------|----------|--------|
| A-1 | trust-distribution | Trustee penalty rate references 45% but correct rate is 47% (45% + 2% Medicare Levy) | MEDIUM | Unfixed (deferred T-2) |
| A-2 | trust-distribution | Ordinary family dealing exclusion (TR 2022/4) not implemented -- excessive false s 100A flags | HIGH | Unfixed (deferred T-1) |
| A-3 | cashflow-forecast | Super guarantee rate hardcoded at 11.5% (line 198) -- rate is 12% from 1 July 2025 | MEDIUM | New finding |
| A-4 | fuel-tax-credits | Uses single annual rate instead of quarterly rates (rates change Feb/Apr/Aug/Nov) | MEDIUM | Unfixed (F-1) |
| A-5 | fuel-tax-credits | Road user charge deduction not applied for heavy vehicles on public roads | MEDIUM | Unfixed (F-2) |
| A-6 | cgt-engine | Connected entity aggregation for $6M net asset test (Subdivision 152-15) not implemented | HIGH | Known (CR-1) |
| A-7 | cgt-engine | Collectable/personal use asset loss quarantining (s 108-10, s 108-20) not distinguished | MEDIUM | Known (CR-3) |
| A-8 | cgt-engine | Cost base always initialised at 0 -- no asset register integration | MEDIUM | By design (requires data) |
| A-9 | loss-engine | Trust losses (Division 266/267) not distinguished from company losses (Division 165) | MEDIUM | Unfixed (L-3) |
| A-10 | loss-engine | Similar Business Test always returns 'unknown' -- overly conservative | MEDIUM | Unfixed (L-2) |
| A-11 | rnd-engine | R&D clawback provisions (s 355-450) not checked | HIGH | Deferred (R-3) |
| A-12 | div7a-engine | Distributable surplus cap (s 109Y) -- deemed dividend cannot exceed distributable surplus | HIGH | Accepted but verify implementation |
| A-13 | deduction-engine | Amendment period not checked before recommending amended returns | HIGH | Unfixed |
| A-14 | deduction-engine | Duplicate `return summary` statements at lines 549-551 | LOW | Code quality |

### Category B: Security and Privacy

| ID | Component | Finding | Severity |
|----|-----------|---------|----------|
| B-1 | Share API | Password sent as URL query parameter (`?password=xxx`) -- appears in server access logs, browser history, and referrer headers | MEDIUM |
| B-2 | Xero OAuth | CSRF state token returned to client in JSON but not stored server-side for verification -- relies entirely on client-side storage | MEDIUM |
| B-3 | Share documents | Unauthenticated file upload via share token -- file type/size validated but no virus/malware scanning | MEDIUM |
| B-4 | Share API | Uses `createServiceClient()` (service role, bypasses all RLS) for public share endpoint -- any SQL injection or filter bypass would expose all tenant data | HIGH |
| B-5 | IP logging | `getClientIp()` uses first value from `X-Forwarded-For` which is user-controllable -- audit logs can be spoofed | LOW |
| B-6 | RLS migration | Two different RLS helper functions exist: `get_user_tenant_ids()` (joins `xero_connections`) and `check_tenant_access()` (joins `user_tenant_access`) -- inconsistent access model | MEDIUM |
| B-7 | Rate limiting | In-memory rate limiting ineffective in serverless environment (each function instance has isolated memory) | MEDIUM |
| B-8 | Dev auth bypass | `devBypassAuth()` function exists with runtime NODE_ENV check -- should use build-time elimination | LOW |
| B-9 | Token generator | Modulo bias in share token generation (256 mod 56 is non-zero) | LOW |
| B-10 | CSP headers | No Content-Security-Policy headers on shared report pages -- XSS risk from Xero-sourced data | MEDIUM |

### Category C: Professional Liability and Regulatory

| ID | Component | Finding | Severity |
|----|-----------|---------|----------|
| C-1 | TaxDisclaimer | Font size is 10px, required minimum is 12px per platform's own audit | HIGH |
| C-2 | Shared reports | Dollar estimates calculated with rough 25% flat rate -- misleading for companies (25-30%), trusts, and individuals (0-45%) | MEDIUM |
| C-3 | Pre-OAuth flow | No APP 1 Collection Notice shown before Xero OAuth connection -- users not informed of data collection scope | HIGH |
| C-4 | Data retention | No mechanism prevents auto-deletion within 5-year statutory retention window (s 262A ITAA 1936) | MEDIUM |
| C-5 | Entity coverage | Missing entity types: SMSF (15% tax rate), non-profit organisations, foreign companies | LOW |
| C-6 | NDB scheme | No breach detection or automated notification system implemented -- DATA_SOVEREIGNTY.md lists manual process only | MEDIUM |
| C-7 | PI insurance | Platform explicitly states no professional indemnity insurance | HIGH |

---

## Zero-Knowledge Architecture Assessment

### What the Platform Knows vs. What It Should Know

| Data Element | Currently Stored | Should Be Stored | Assessment |
|-------------|-----------------|-----------------|------------|
| Xero OAuth tokens | Yes (AES-256-GCM encrypted) | Yes (required for API access) | APPROPRIATE |
| Transaction descriptions | Yes (cached in Supabase) | Minimal (clear after analysis) | EXCESSIVE |
| Transaction amounts | Yes (cached in Supabase) | Yes (needed for calculations) | APPROPRIATE |
| Supplier/customer names | Yes (embedded in descriptions) | No (strip before caching) | **PARTIALLY MITIGATED** -- anonymised before Gemini calls (2026-02-08) but still cached in Supabase |
| User email/profile | Yes (Supabase auth) | Yes (required for authentication) | APPROPRIATE |
| ABN lookup results | Yes (7-day TTL cache) | Yes (public data, caching acceptable) | APPROPRIATE |
| AI analysis results | Yes (permanent) | Yes (but with retention policy) | NEEDS POLICY |
| Share access logs (IP, UA) | Yes (permanent) | Yes (but with retention limit) | NEEDS POLICY |
| Dollar estimate calculations | Yes (in shared reports) | Recalculate on access, don't store | EXCESSIVE |

### Zero-Knowledge Recommendations

1. **Transaction Description Sanitisation**: Before caching transaction data from Xero, strip or pseudonymise supplier/customer names. The AI analysis only needs the transaction category, not the specific counterparty.

2. ~~**Data Minimisation for Gemini**~~: **IMPLEMENTED** (2026-02-08). Supplier names replaced with anonymous tokens (`Supplier_1`, `Supplier_2`) via `lib/ai/pii-sanitizer.ts` before Gemini API calls. Case-insensitive normalisation ensures consistent mapping. Applied in `forensic-analyzer.ts` and `account-classifier.ts`. Remaining items:
   - Remove ABN numbers from description text
   - Aggregate small transactions before analysis

3. **Retention Policy Implementation**: Implement automated data lifecycle:
   - Transaction cache: 90-day TTL (re-fetch from Xero if needed)
   - Analysis results: 5 years (statutory minimum)
   - Share access logs: 2 years
   - ABN cache: 7-day TTL (already implemented)

4. **Computed vs. Stored**: Dollar estimates in shared reports should be computed at access time, not stored. This ensures estimates use current rates and reduces the data footprint of shared reports.

---

## Remediation Priority Matrix

### Phase 0 (Before ANY Production Deployment)

| Priority | Action | Risk Addressed | Effort |
|----------|--------|----------------|--------|
| P0-1 | Add APP 1 Collection Notice before Xero OAuth | Risk 1 | 2 days |
| P0-2 | Add Gemini AI consent interstitial | Risk 1 | 1 day |
| P0-3 | Confirm Supabase region (ap-southeast-2) | Risk 1 | 1 hour |
| P0-4 | Confirm Vercel region (syd1) | Risk 1 | 1 hour |
| P0-5 | Fix TaxDisclaimer font size to 12px minimum | Risk 2 | 30 minutes |
| P0-6 | Obtain legal opinion on TASA s 90-5 applicability | Risk 2 | 2-4 weeks |
| P0-7 | Fix FBT rate assignment bug | Risk 3 | 30 minutes |
| P0-8 | Appoint Privacy Officer | Risk 1 | Administrative |

### Phase 1 (Within 30 Days of Production)

| Priority | Action | Risk Addressed | Effort |
|----------|--------|----------------|--------|
| P1-1 | Execute Google Cloud DPA | Risk 1 | Legal review |
| P1-2 | Implement Type 1/Type 2 FBT determination | Risk 3 | 3-5 days |
| P1-3 | Implement car fringe benefit statutory formula | Risk 3 | 3-5 days |
| P1-4 | Add CSP headers to shared report pages | B-10 | 1 day |
| P1-5 | Implement distributed rate limiting (Redis/KV) | B-7 | 2 days |
| P1-6 | Move share password from query param to POST body | B-1 | 1 day |
| P1-7 | Fix trust distribution trustee penalty rate to 47% | A-1 | 30 minutes |
| P1-8 | Update SG rate to 12% for FY2025-26 | A-3 | 30 minutes |

### Phase 2 (Within 90 Days)

| Priority | Action | Effort |
|----------|--------|--------|
| ~~P2-1~~ | ~~Implement transaction description sanitisation for Gemini~~ **DONE** (2026-02-08) -- Supplier names anonymised via `lib/ai/pii-sanitizer.ts` | ~~3-5 days~~ |
| P2-2 | Implement connected entity aggregation for CGT $6M test | 5 days |
| P2-3 | Implement ordinary family dealing exclusion for s 100A | 3 days |
| P2-4 | Implement quarterly fuel tax credit rates | 2 days |
| P2-5 | Add amendment period check to deduction engine | 2 days |
| P2-6 | Implement R&D clawback warning (s 355-450) | 3 days |
| P2-7 | Implement data retention policy with automated lifecycle | 5 days |
| P2-8 | Implement NDB technical detection and notification | 5 days |

---

## Conclusion

The ATO platform demonstrates strong engineering foundations (encryption, tenant isolation, legislative references, comprehensive engine coverage). However, the three critical risks identified in this assessment represent genuine regulatory exposure that must be addressed before production deployment:

1. **Risk 1 (Data Sovereignty)** is a Privacy Act violation waiting to happen. The post-2022 penalty regime makes this a potential $50M+ exposure.

2. **Risk 2 (Unregistered Tax Agent)** is subtle but dangerous. The platform walks a fine line between "analytical tool" and "tax agent service." The combination of dollar estimates, legislative references, filing instructions, and an effectively invisible disclaimer tips the balance toward TASA exposure.

3. **Risk 3 (FBT Rate Bug)** is a concrete code defect that will produce incorrect outputs for every FBT analysis. While the fallback rates may coincidentally be correct for the current FY, the bug masks any future rate changes and gives a false impression that live rates are in use.

The platform should not be deployed to production until P0 remediation items are complete. A follow-up audit should be conducted after Phase 1 remediation to verify the effectiveness of the fixes.

---

*This assessment was prepared by The_Compliance_Skeptic as an independent audit of the ATO platform codebase. It does not constitute legal advice. The platform operator should obtain independent legal advice on TASA and Privacy Act obligations before production deployment.*
