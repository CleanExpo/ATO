# Data Sovereignty & Cross-Border Data Flow Assessment

**Australian Tax Optimizer (ATO) Platform**
**Last Updated: 2026-02-07**
**Compliance Framework: Privacy Act 1988 (Cth), APP 8**

---

## 1. Overview

This document records the data sovereignty posture of the ATO platform, addressing
Australian Privacy Principle 8 (APP 8) requirements for cross-border disclosure of
personal information. Financial data processed by this platform is subject to
Australian data sovereignty requirements.

---

## 2. Data Classification

| Data Category | Sensitivity | Examples | Retention |
|---------------|-------------|----------|-----------|
| Financial Transactions | HIGH | Xero invoices, bank feeds, journal entries | 5 years (s 262A ITAA 1936) |
| Tax Analysis Results | HIGH | R&D offsets, deduction recommendations, CGT calculations | 5 years |
| Entity Information | MEDIUM | ABN, entity name, industry code | Life of account |
| User Credentials | CRITICAL | Xero OAuth tokens (AES-256-GCM encrypted) | Until revoked |
| Cached Public Data | LOW | ABN lookup results, ATO benchmark data | 7 days TTL |
| CGT Asset Records | HIGH | Cost base, acquisition/disposal dates | Life of asset + 5 years |

---

## 3. Infrastructure Regions

### 3.1 Primary Database (Supabase)

| Component | Required Region | Verification Method |
|-----------|----------------|---------------------|
| PostgreSQL Database | ap-southeast-2 (Sydney) | Supabase Dashboard > Project Settings > General |
| Row Level Security | N/A (database feature) | Applied via migration files |
| Realtime | ap-southeast-2 | Same region as database |
| Storage | ap-southeast-2 | Same region as database |
| Edge Functions | ap-southeast-2 | Deploy with `--region ap-southeast-2` |

**ACTION REQUIRED**: Verify Supabase project region in dashboard. If not ap-southeast-2,
data must be migrated before production deployment.

### 3.2 Application Hosting (Vercel)

| Component | Required Region | Configuration |
|-----------|----------------|---------------|
| Serverless Functions | syd1 (Sydney) | `vercel.json` > `regions: ["syd1"]` |
| Edge Functions | syd1 | `vercel.json` > `regions: ["syd1"]` |
| Static Assets | CDN (global) | Non-sensitive, acceptable |
| Build Artefacts | Vercel infrastructure | Transient, no financial data |

**vercel.json configuration:**
```json
{
  "regions": ["syd1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

### 3.3 External API Services

| Service | Data Sent | Region | Risk Level | Mitigation |
|---------|-----------|--------|------------|------------|
| Xero API | OAuth tokens only | api.xero.com (global) | LOW | Read-only scopes, tokens encrypted at rest |
| Google Gemini AI | Transaction descriptions, amounts | Google Cloud (global) | MEDIUM | See section 4 |
| Brave Search API | Tax rate queries (no PII) | search.brave.com (US) | LOW | No financial data sent |
| Jina AI Reader | ATO.gov.au URLs (no PII) | r.jina.ai (global) | LOW | Only public ATO pages scraped |
| Australian Business Register | ABN numbers (public data) | abr.business.gov.au (AU) | NONE | Public register |

---

## 4. Gemini AI Data Processing

### 4.1 Data Sent to Gemini

The forensic analysis engine sends transaction data to Google Gemini for AI analysis.
This includes:

- Transaction descriptions (may contain supplier/customer names)
- Transaction amounts
- Account codes and names
- Date ranges

### 4.2 Risk Assessment

- Gemini API processes data on Google Cloud infrastructure (potentially non-AU)
- Google Cloud data processing terms apply
- Transaction descriptions may contain personal information (supplier names)

### 4.3 Mitigations

1. **Minimisation**: Supplier names are anonymised (`Supplier_1`, `Supplier_2` tokens) before Gemini API calls. TFN, account credentials, and entity identifiers are never sent
2. **Ephemeral processing**: Gemini API calls use streaming mode; Google states API data is not used for model training (verify current terms)
3. **Aggregation**: Where possible, transactions are batched and anonymised before AI analysis
4. **Opt-in**: AI analysis is user-initiated, not automatic

### 4.4 Required Actions

- [ ] Review Google Cloud Terms of Service for Gemini API data handling
- [ ] Confirm Gemini API does not retain input data beyond request processing
- [ ] Consider Google Cloud Australia region for API routing if available
- [x] Add user consent notice before first AI analysis -- Implemented in `/dashboard/connect` page (APP 1 Collection Notice with cross-border AI data processing disclosure, 2026-02-07)

### 4.5 Gemini AI Consent Implementation (2026-02-07)

The pre-OAuth connection page (`/dashboard/connect`) now includes:
- Explicit disclosure that financial transaction data (descriptions, amounts, dates) is sent to Google Gemini AI
- Warning that Google Cloud servers may be located outside Australia
- Reference to Australian Privacy Principle 8 (Privacy Act 1988)
- Consent checkbox updated to include cross-border AI processing acknowledgement
- User's right to opt out of AI analysis via dashboard Settings

### 4.6 Data Minimisation Implementation (2026-02-08)

Supplier names in transaction data are replaced with anonymous tokens before
being sent to Google Gemini AI. Implementation: `lib/ai/pii-sanitizer.ts`.
Files updated: `lib/ai/forensic-analyzer.ts`, `lib/ai/account-classifier.ts`.

---

## 5. APP 8 Compliance Checklist

Australian Privacy Principle 8 requires that before disclosing personal information
to an overseas recipient, the entity must take reasonable steps to ensure the overseas
recipient does not breach the APPs.

| Requirement | Status | Notes |
|-------------|--------|-------|
| Database in Australia | VERIFY | Must confirm ap-southeast-2 |
| Functions in Australia | VERIFY | Must confirm syd1 |
| Cross-border disclosure notice | IMPLEMENTED | Added to /dashboard/connect page (2026-02-07) |
| Contractual protections | REQUIRED | Google Cloud DPA review |
| Data minimisation | IMPLEMENTED | Supplier names anonymised via `lib/ai/pii-sanitizer.ts` (2026-02-08) |
| Encryption in transit | IMPLEMENTED | TLS 1.3 for all API calls |
| Encryption at rest | IMPLEMENTED | AES-256-GCM for tokens, Supabase encryption for database |

---

## 6. Record-Keeping Requirements

### 6.1 Statutory Retention (s 262A ITAA 1936)

- Financial records: **5 years** from preparation or transaction completion
- CGT asset records: **Life of asset + 5 years** after disposal
- FBT records: **5 years** from lodgement of FBT return

### 6.2 Platform Implementation

- No auto-deletion within statutory retention window
- Shared report links persist for record-keeping purposes
- Database backups retained per Supabase project configuration
- User-initiated deletion respects statutory hold requirements

---

## 7. Breach Response

In the event of a data breach involving Australian financial data:

1. **Assess** within 30 days whether breach is likely to result in serious harm
2. **Notify** OAIC and affected individuals if serious harm is likely
3. **Contain** the breach and prevent further access
4. **Record** in data breach register (even non-notifiable breaches)

Contact: Privacy Officer (details to be added before production deployment)

---

## 8. Review Schedule

This document must be reviewed:
- Before production deployment
- When infrastructure providers or regions change
- When new external API integrations are added
- When Privacy Act amendments take effect
- At minimum annually

---

*This document addresses compliance finding from The_Compliance_Skeptic audit (2026-02-07)
regarding data sovereignty verification (APP 8, section 4.3 of audit report).*
