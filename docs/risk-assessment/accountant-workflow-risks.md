# Accountant Workflow Integration - Risk Assessment

**Document Version**: 1.0
**Created**: 2026-01-30
**Linear Issue**: [UNI-278](https://linear.app/unite-hub/issue/UNI-278)
**ADR**: [ADR-017](../adr/ADR-017-accountant-workflow-integration.md)
**Assessment Period**: FY2024-25
**Next Review**: 2026-04-30 (90 days)

---

## Executive Summary

This risk assessment identifies, evaluates, and provides mitigation strategies for risks associated with the Accountant Workflow Integration system. The system adds AI-powered tax intelligence to accountant workflows while preserving professional judgment and compliance.

### Risk Overview

| Category | High Risk | Medium Risk | Low Risk | Total |
|----------|-----------|-------------|----------|-------|
| **Technical** | 1 | 3 | 2 | 6 |
| **Business** | 2 | 2 | 1 | 5 |
| **Compliance** | 3 | 2 | 0 | 5 |
| **Security** | 1 | 2 | 1 | 4 |
| **Operational** | 0 | 3 | 2 | 5 |
| **TOTAL** | **7** | **12** | **6** | **25** |

### Risk Heat Map

```
          LIKELIHOOD →
IMPACT    Low (1)    Medium (2)    High (3)
  ↓
High (3)    [L3H]      [M3H]        [H3H] 🔴
            Medium     High         Critical

Medium (2)  [L2M]      [M2M]        [H2M] 🟠
            Low        Medium       High

Low (1)     [L1L]      [M1L]        [H1L] 🟡
            Low        Low          Medium
```

**Critical Risks (🔴)**:
- COMP-001: Incorrect tax advice leads to client penalties
- COMP-002: AI recommendations contradict current legislation
- BUS-001: Accountants don't trust AI recommendations

**High Risks (🟠)**:
- SEC-001: Unauthorised access to confidential tax findings
- COMP-003: Missing professional indemnity coverage for AI advice
- BUS-002: Dashboard adoption fails (accountants ignore system)

---

## Risk Register

### COMPLIANCE RISKS

#### COMP-001: Incorrect Tax Advice Leads to Client Penalties 🔴

**Category**: Compliance
**Impact**: High (3) - Financial penalties, reputational damage, legal liability
**Likelihood**: Medium (2) - AI systems can make errors
**Risk Level**: **HIGH** (6/9)

**Description**:
The AI system provides incorrect tax recommendations that accountants approve and implement, resulting in:
- Client ATO penalties and interest charges
- Professional negligence claims
- Loss of practicing certificate
- Reputational damage to firm

**Root Causes**:
1. Gemini AI misinterprets complex tax legislation
2. Training data outdated or incomplete
3. Edge cases not covered in validation
4. Confidence scoring incorrectly inflates certainty
5. Legislation changes not reflected in system

**Impact Assessment**:
| Scenario | Financial Impact | Reputational Impact | Legal Impact |
|----------|------------------|---------------------|--------------|
| Minor error | $5K-$20K penalties | Client complaints | Low risk |
| Significant error | $50K-$200K penalties | Loss of clients | Medium risk |
| Systemic error | $500K+ penalties | Firm closure risk | High risk |

**Mitigation Strategies**:

**Primary Controls**:
1. **Accountant Authority Principle** (Implemented)
   - System provides "intelligence" NOT "advice"
   - Accountant retains 100% decision-making authority
   - All recommendations require explicit approval
   - Clear disclaimers: "Review by qualified accountant required"

2. **Confidence Scoring System** (Implemented)
   - 0-100 algorithmic confidence score
   - Low confidence (<60) flags need for ATO private ruling
   - High-value findings (>$50K) require extra scrutiny
   - Legislation references mandatory for all recommendations

3. **Multi-Layer Validation** (Implemented)
   - 10 specialised validators for tax calculations
   - Division 355 four-element test verification
   - Section 8-1 deduction eligibility rules
   - Division 7A compliance formulas
   - All validation results logged for audit

4. **Legislation Reference Linking** (Implemented)
   - Every recommendation includes direct legislation links
   - ATO guidance documents referenced
   - Precedent cases cited where applicable
   - Effective date and amendments tracked

**Secondary Controls**:
5. **Professional Review Workflow** (Implemented)
   - Findings status: pending → reviewed → approved
   - Mandatory accountant notes (min 10 characters)
   - Timestamp and reviewer ID tracking
   - Audit trail for all decisions

6. **Tax Agent Validation Layer** (Planned)
   - Tax agent specialist validates all formulas
   - Reviews edge cases and complex scenarios
   - Signs off on calculation logic
   - Updates validation rules quarterly

7. **Quarterly Legislation Updates** (Planned)
   - Monitor ATO website for changes
   - Update tax rates, thresholds, formulas
   - Deprecate outdated recommendations
   - Re-validate existing findings

8. **Professional Indemnity Insurance** (Required)
   - Confirm PI policy covers AI-assisted advice
   - Adequate coverage limits ($5M+)
   - Cyber liability coverage included
   - Annual review of policy terms

**Monitoring**:
```typescript
// Tracking metrics
metrics.counter('recommendations_rejected_by_accountant', {
  workflow_area: area,
  reason: 'legislative_concern'
});

metrics.histogram('confidence_score_distribution', {
  workflow_area: area,
  score_range: '0-59'  // Low confidence
});

// Alert on high rejection rate
if (rejectionRate > 0.25) {
  alert('High recommendation rejection rate detected');
}
```

**Residual Risk**: **MEDIUM** (after controls)
**Risk Owner**: Senior Tax Accountant
**Review Frequency**: Monthly

---

#### COMP-002: AI Recommendations Contradict Current Legislation 🔴

**Category**: Compliance
**Impact**: High (3) - Non-compliant tax positions
**Likelihood**: Medium (2) - Legislation changes frequently
**Risk Level**: **HIGH** (6/9)

**Description**:
AI provides recommendations based on outdated or superseded legislation, including:
- Tax rates that have changed
- Thresholds that have been updated
- Provisions that have been repealed
- New legislation not yet incorporated

**Examples**:
- Instant asset write-off threshold changes from $20K to $30K
- R&D offset rates adjusted
- Division 7A benchmark rate updates (currently 8.77% for FY2024-25)
- FBT rate changes

**Mitigation Strategies**:

1. **Legislation Version Control** (Implemented)
   - All tax rates include effective date
   - Financial year clearly stated (FY2024-25)
   - Source URL to ATO website
   - Amendment history tracked

```typescript
interface TaxRate {
  rate: number;
  effectiveFrom: string;  // ISO date
  effectiveTo?: string;
  financialYear: string;  // "FY2024-25"
  source: string;         // ATO URL
  lastVerified: string;   // ISO timestamp
}
```

2. **Quarterly Legislation Audits** (Planned)
   - Review ATO website for changes
   - Subscribe to ATO email updates
   - Monitor Federal Register of Legislation
   - Tax agent validates all updates

3. **Automated Staleness Detection** (Planned)
   ```typescript
   // Flag recommendations using old rates
   if (daysSinceVerified > 90) {
     finding.warnings.push(
       'Legislation not verified in 90+ days. Review ATO website for changes.'
     );
   }
   ```

4. **User Warnings on Findings** (Implemented)
   - Display legislation effective date
   - Show last verification timestamp
   - Flag if >6 months old
   - Link to current ATO page for manual verification

**Residual Risk**: **MEDIUM**
**Risk Owner**: Tax Agent Specialist
**Review Frequency**: Quarterly

---

#### COMP-003: Missing Professional Indemnity Coverage for AI Advice 🟠

**Category**: Compliance
**Impact**: High (3) - Uninsured liability exposure
**Likelihood**: Low (1) - Addressable via policy review
**Risk Level**: **MEDIUM** (3/9)

**Description**:
Professional indemnity insurance policy may exclude claims arising from AI-assisted advice, leaving firm exposed to uninsured liability.

**Mitigation Strategies**:

1. **Policy Review** (Action Required)
   - Review PI policy terms with insurance broker
   - Confirm AI-assisted advice is covered
   - Request written confirmation from insurer
   - Obtain adequate coverage limits ($5M minimum)

2. **Disclosure to Insurer** (Action Required)
   - Disclose use of AI system to insurer
   - Provide system documentation
   - Explain human-in-the-loop safeguards
   - Update policy if needed

3. **Client Engagement Letters** (Implemented)
   - Disclose AI usage in engagement terms
   - Clarify accountant retains final decision authority
   - Client consent to AI-assisted analysis
   - Limit liability where legally permissible

**Residual Risk**: **LOW** (after policy confirmation)
**Risk Owner**: Firm Managing Partner
**Review Frequency**: Annually (policy renewal)

---

#### COMP-004: Non-Compliance with Australian Privacy Principles (APPs) 🟠

**Category**: Compliance
**Impact**: Medium (2) - Privacy Commissioner investigation, fines
**Likelihood**: Low (1) - Mitigated by design
**Risk Level**: **MEDIUM** (2/9)

**Description**:
System collects and processes sensitive financial data (Xero transactions, tax findings, client reports). Non-compliance with APPs could result in:
- Privacy breach notifications required
- Privacy Commissioner investigation
- Fines up to $2.5M
- Reputational damage

**Relevant APPs**:
- APP 1: Open and transparent management of personal information
- APP 5: Notification of collection
- APP 6: Use or disclosure
- APP 8: Cross-border disclosure (if using overseas AI)
- APP 11: Security of personal information

**Mitigation Strategies**:

1. **Privacy by Design** (Implemented)
   - Row Level Security (RLS) enforces user isolation
   - Encryption at rest (Supabase default)
   - Encryption in transit (HTTPS/TLS)
   - No cross-tenant data leakage

2. **Privacy Policy** (Action Required)
   - Document what data is collected (Xero transactions, findings)
   - Explain why data is collected (tax analysis)
   - Disclose third parties (Google Gemini AI, Resend email)
   - Provide opt-out mechanisms where applicable

3. **Consent Management** (Implemented)
   - Xero OAuth requires user consent
   - Client reports require accountant approval before sending
   - Email addresses collected with purpose

4. **Data Minimisation** (Implemented)
   - Only collect necessary data
   - Redact sensitive data in AI prompts (e.g., client names)
   - Retention policies delete old rejected findings (>1 year)

5. **Third-Party Data Processing Agreements** (Action Required)
   - Google Gemini: Review data processing terms
   - Resend: Confirm GDPR/APP compliance
   - Xero: Existing DPA in place

**Residual Risk**: **LOW**
**Risk Owner**: Data Protection Officer
**Review Frequency**: Annually

---

#### COMP-005: Breach of Accountants' Code of Conduct 🟡

**Category**: Compliance
**Impact**: Medium (2) - Professional disciplinary action
**Likelihood**: Low (1) - Mitigated by safeguards
**Risk Level**: **LOW** (2/9)

**Description**:
Accountants using the system must comply with APES 110 Code of Ethics, including:
- Professional competence and due care
- Professional skepticism
- Integrity and objectivity
- Confidentiality

Over-reliance on AI without professional skepticism could breach these duties.

**Mitigation Strategies**:

1. **Accountant Training** (Planned)
   - User guide emphasizes accountant's professional duties
   - Training on reviewing AI recommendations critically
   - Examples of when to seek second opinions
   - Guidance on documenting professional judgment

2. **System Design Principles** (Implemented)
   - No auto-approvals - all require accountant review
   - Confidence scores encourage critical evaluation
   - Legislation links enable independent verification
   - Accountant notes field mandatory for review

3. **Disclaimer in All Outputs** (Implemented)
   ```
   DISCLAIMER: This analysis is provided for informational purposes only and
   does not constitute tax advice. All recommendations should be reviewed by
   a qualified tax professional before implementation. The software provides
   'intelligence' and 'estimates', not binding financial advice.
   ```

**Residual Risk**: **VERY LOW**
**Risk Owner**: Firm Compliance Officer
**Review Frequency**: Annually

---

### TECHNICAL RISKS

#### TECH-001: AI Hallucination Produces False Tax Findings 🟠

**Category**: Technical
**Impact**: High (3) - Incorrect recommendations
**Likelihood**: Low (1) - Mitigated by validation
**Risk Level**: **MEDIUM** (3/9)

**Description**:
Gemini AI "hallucinates" non-existent tax provisions or invents legislation references that don't exist, leading to false findings.

**Examples**:
- Cites "Division 360" which doesn't exist
- Invents ATO ruling numbers
- Misquotes legislation section text
- Creates fictional tax thresholds

**Mitigation Strategies**:

1. **Structured AI Prompts** (Implemented)
   ```typescript
   const prompt = `
   Analyse this transaction for R&D eligibility under Division 355 ITAA 1997.

   CONSTRAINTS:
   - Only reference provisions in Division 355 ITAA 1997
   - Cite specific subsections (e.g., 355-25, 355-30)
   - Do not invent ATO ruling numbers
   - If uncertain, state "Unable to determine"

   OUTPUT FORMAT (JSON):
   {
     "eligible": boolean,
     "legislation": "Division 355 ITAA 1997",
     "subsections": ["355-25", "355-30"],
     "reasoning": "...",
     "confidence": 0-100
   }
   `;
   ```

2. **Legislation Reference Validation** (Implemented)
   - Validate all cited legislation against known provisions
   - Check ATO website URLs return 200 OK
   - Flag unknown sections for manual review
   - Reject findings with invalid references

   ```typescript
   const VALID_LEGISLATION = {
     'ITAA 1997': [
       'Division 355',  // R&D
       'Section 8-1',   // Deductions
       'Subdivision 36-A', // Losses
       // ...
     ],
     'ITAA 1936': [
       'Division 7A',
       // ...
     ]
   };

   function validateLegislation(ref: LegislationRef): boolean {
     return VALID_LEGISLATION[ref.act]?.includes(ref.section);
   }
   ```

3. **Confidence Penalty for Complex Claims** (Implemented)
   - Reduce confidence score for novel interpretations
   - Flag findings citing uncommon provisions
   - Require tax agent review for low-confidence (<60)

4. **Periodic AI Output Audits** (Planned)
   - Monthly review of 20 random findings
   - Verify all legislation references are valid
   - Check reasoning against tax law
   - Document and fix any hallucinations

**Residual Risk**: **LOW**
**Risk Owner**: AI Engineer
**Review Frequency**: Monthly

---

#### TECH-002: Xero API Rate Limiting Blocks Analysis 🟡

**Category**: Technical
**Impact**: Medium (2) - Service degradation
**Likelihood**: Medium (2) - Xero limits at 60/min
**Risk Level**: **MEDIUM** (4/9)

**Description**:
Xero API enforces rate limits (60 requests/minute). Heavy usage during forensic analysis could hit these limits, blocking the service.

**Mitigation Strategies**:

1. **Exponential Backoff** (Implemented)
   ```typescript
   async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
     try {
       return await fetch(url);
     } catch (error) {
       if (error.status === 429 && attempt < 5) {
         const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s
         await sleep(delay);
         return fetchWithRetry(url, attempt + 1);
       }
       throw error;
     }
   }
   ```

2. **Request Queuing** (Implemented)
   - Queue Xero API calls
   - Process at max 50/minute (safety margin)
   - Prioritise interactive requests over batch jobs

3. **Caching Strategy** (Implemented)
   - Cache transaction data for 24 hours
   - Cache reports for 7 days
   - Refresh cache in off-peak hours
   - Reduce redundant API calls

4. **Batch Size Limits** (Implemented)
   - Forensic analysis limited to 100 transactions per batch
   - User can adjust batch size (10-100)
   - Display progress bar during analysis

**Residual Risk**: **LOW**
**Risk Owner**: Backend Engineer
**Review Frequency**: Quarterly

---

#### TECH-003: Database Performance Degradation at Scale 🟡

**Category**: Technical
**Impact**: Medium (2) - Slow response times
**Likelihood**: Low (1) - Supabase scales well
**Risk Level**: **LOW** (2/9)

**Description**:
As findings accumulate (10K+ records per tenant), database queries slow down, degrading user experience.

**Mitigation Strategies**:

1. **Database Indexes** (Implemented)
   - Indexes on user_id, tenant_id, workflow_area, status
   - Composite indexes for common query patterns
   - See ERD document for complete index strategy

2. **Pagination** (Implemented)
   - Limit/offset pagination (50 results per page)
   - Cursor-based pagination for large datasets
   - Virtual scrolling for lists

3. **Materialized Views** (Planned)
   - Pre-compute workflow area summaries
   - Refresh every 5 minutes via cron
   - Avoid complex aggregations on-demand

4. **Archival Strategy** (Planned)
   - Archive rejected findings >1 year old
   - Archive actioned findings >2 years old
   - Keep active table lean (<100K rows)

**Residual Risk**: **VERY LOW**
**Risk Owner**: Database Administrator
**Review Frequency**: Quarterly

---

#### TECH-004: Gemini AI Service Outage 🟡

**Category**: Technical
**Impact**: Medium (2) - Analysis unavailable
**Likelihood**: Low (1) - Google SLA 99.9%
**Risk Level**: **LOW** (2/9)

**Description**:
Google Gemini API experiences outage, preventing forensic analysis.

**Mitigation Strategies**:

1. **Graceful Degradation** (Implemented)
   - Cache existing findings for review
   - Manual finding creation still available
   - Notification shown: "AI analysis temporarily unavailable"

2. **Retry Logic** (Implemented)
   - Retry failed requests 3 times with exponential backoff
   - Queue analysis jobs for retry after outage

3. **Fallback AI Provider** (Future Enhancement)
   - Consider Claude/GPT-4 as backup
   - Requires additional API integration

**Residual Risk**: **VERY LOW**
**Risk Owner**: DevOps Engineer
**Review Frequency**: Annually

---

#### TECH-005: Report PDF Generation Fails 🟡

**Category**: Technical
**Impact**: Low (1) - Manual workaround available
**Likelihood**: Low (1) - Puppeteer reliable
**Risk Level**: **VERY LOW** (1/9)

**Description**:
Puppeteer fails to generate PDF (timeout, memory limit, rendering error).

**Mitigation Strategies**:

1. **Error Handling** (Implemented)
   - Retry PDF generation 3 times
   - Increase timeout to 30 seconds
   - Log errors for debugging

2. **Manual Export** (Implemented)
   - Accountant can download findings as CSV
   - Create report manually in Excel/Word
   - Include all findings data in export

3. **Monitoring** (Planned)
   - Alert on PDF generation failures
   - Track success rate metric

**Residual Risk**: **VERY LOW**
**Risk Owner**: Frontend Engineer
**Review Frequency**: Quarterly

---

#### TECH-006: Client Report Email Delivery Fails 🟡

**Category**: Technical
**Impact**: Low (1) - Retry available
**Likelihood**: Low (1) - Resend reliable
**Risk Level**: **VERY LOW** (1/9)

**Description**:
Resend fails to deliver email (recipient server down, spam filter, Resend outage).

**Mitigation Strategies**:

1. **Delivery Tracking** (Implemented)
   - Track email delivery status (sent, delivered, bounced)
   - Notify accountant of delivery failures
   - Provide download link as fallback

2. **Retry Mechanism** (Implemented)
   - Retry failed deliveries 3 times (1h, 4h, 24h intervals)
   - Exponential backoff

3. **Manual Download** (Implemented)
   - Accountant can download PDF
   - Send via their own email client

**Residual Risk**: **VERY LOW**
**Risk Owner**: Backend Engineer
**Review Frequency**: Annually

---

### BUSINESS RISKS

#### BUS-001: Accountants Don't Trust AI Recommendations 🔴

**Category**: Business
**Impact**: High (3) - Product adoption failure
**Likelihood**: Medium (2) - AI skepticism common
**Risk Level**: **HIGH** (6/9)

**Description**:
Accountants don't trust AI-generated recommendations and ignore the system, leading to:
- Low adoption rate
- No ROI on development investment
- Product failure

**Trust Barriers**:
1. "Black box" AI with no explainability
2. Historical examples of AI errors
3. Professional liability concerns
4. Lack of transparency in calculations

**Mitigation Strategies**:

1. **Transparency by Design** (Implemented)
   - Every recommendation shows:
     - Confidence score (0-100) with explanation
     - Legislation references (direct links to ATO)
     - Reasoning in plain language
     - Confidence factor breakdown
   - No "black box" - accountant can verify every claim

2. **Professional Control** (Implemented)
   - Accountant has 100% decision authority
   - System provides "intelligence" not "advice"
   - All recommendations require explicit approval
   - Accountant can reject with reason

3. **Incremental Trust Building** (Planned)
   - Start with high-confidence findings only (90-100)
   - Track accuracy rate and share with users
   - User testimonials from early adopters
   - Case studies showing successful outcomes

4. **Accountant Training** (Planned)
   - User guide explaining how AI works
   - Examples of good vs bad findings
   - When to trust vs verify
   - Best practices for review

5. **Trust Metrics Tracking** (Planned)
   ```typescript
   // Measure trust via actions
   metrics.gauge('finding_approval_rate', approvalRate, {
     confidence_level: 'High'
   });

   metrics.gauge('average_review_time_seconds', avgTime, {
     workflow_area: area
   });

   // Low review time + high approval rate = high trust
   ```

**Success Criteria**:
- Approval rate >70% for high-confidence findings (90-100)
- <10% of findings rejected for "don't trust AI" reason
- >80% of accountants use dashboard weekly

**Residual Risk**: **MEDIUM**
**Risk Owner**: Product Manager
**Review Frequency**: Monthly (first 6 months)

---

#### BUS-002: Dashboard Adoption Fails (Accountants Ignore System) 🟠

**Category**: Business
**Impact**: High (3) - Product failure, no ROI
**Likelihood**: Low (1) - Mitigated by UX design
**Risk Level**: **MEDIUM** (3/9)

**Description**:
Accountants find the dashboard too cumbersome, don't integrate it into daily workflow, and continue using existing methods.

**Adoption Barriers**:
1. "Yet another tool to check"
2. Doesn't fit existing workflow
3. Too time-consuming to review findings
4. Value not immediately obvious

**Mitigation Strategies**:

1. **Smart Notifications** (Implemented)
   - Don't require accountants to constantly check dashboard
   - Notifications for high-value (>$50K) and critical findings
   - Email digest (daily/weekly, user configurable)
   - In-app badge count

2. **Workflow Integration Design** (Implemented)
   - 6 areas match accountant's daily tasks:
     - Sundries, Deductions, FBT, Div7A, Documents, Reconciliation
   - Not a new workflow - enhances existing workflow
   - Findings tied to Xero transactions accountants already review

3. **Quick Wins** (Implemented)
   - Show total value of findings ($287K opportunities found)
   - Highlight easiest wins (high confidence, low complexity)
   - One-click approval for simple findings
   - Fast review (<2 min per finding)

4. **Performance Targets** (Implemented)
   - Dashboard loads <2 seconds
   - Finding retrieval <500ms
   - Instant filtering and sorting

5. **User Onboarding** (Planned)
   - Interactive tutorial on first login
   - Demo findings to show value
   - Success stories from other accountants
   - Weekly tips via email

**Success Criteria**:
- >80% of accountants use dashboard weekly
- Average session >5 minutes (engaged usage)
- >50% of findings reviewed within 48 hours

**Residual Risk**: **LOW**
**Risk Owner**: Product Manager
**Review Frequency**: Monthly (first 6 months)

---

#### BUS-003: Incorrect Value Estimates Damage Credibility 🟡

**Category**: Business
**Impact**: Medium (2) - Loss of user trust
**Likelihood**: Medium (2) - Financial estimates uncertain
**Risk Level**: **MEDIUM** (4/9)

**Description**:
AI overestimates financial benefit of findings (e.g., claims "$87K R&D offset" but actual is $12K), damaging system credibility.

**Mitigation Strategies**:

1. **Conservative Estimates** (Implemented)
   - Use lower bound of estimate ranges
   - Include disclaimers: "Estimated benefit subject to verification"
   - Show estimate confidence separately from finding confidence

2. **Calculation Transparency** (Implemented)
   - Show formula: `$200,000 × 43.5% = $87,000`
   - Link to tax calculator methodology
   - Enable accountant to adjust estimates

3. **Range-Based Estimates** (Planned)
   ```typescript
   interface FinancialEstimate {
     low: number;
     mid: number;
     high: number;
     confidence: 'High' | 'Medium' | 'Low';
     assumptions: string[];
   }
   // Display as: "$70K - $90K (est.)"
   ```

4. **Post-Implementation Tracking** (Planned)
   - Track estimated vs actual amounts
   - Improve AI prompts based on variance
   - Display accuracy metrics to users

**Residual Risk**: **LOW**
**Risk Owner**: AI Engineer
**Review Frequency**: Quarterly

---

#### BUS-004: High-Value Clients Receive Poor UX 🟡

**Category**: Business
**Impact**: Medium (2) - Client churn
**Likelihood**: Low (1) - Addressable via testing
**Risk Level**: **LOW** (2/9)

**Description**:
System performs poorly for high-value clients with large transaction volumes (>10K transactions/year), creating bad experience.

**Mitigation Strategies**:

1. **Performance Testing** (Planned)
   - Test with datasets up to 50K transactions
   - Identify bottlenecks
   - Optimize slow queries

2. **Batch Processing** (Implemented)
   - Configurable batch size (10-100 transactions)
   - Background processing for large analyses
   - Progress tracking

3. **Scalability Architecture** (Implemented)
   - Serverless APIs scale automatically
   - Database indexes for fast queries
   - Redis caching for frequently accessed data

**Residual Risk**: **VERY LOW**
**Risk Owner**: Engineering Lead
**Review Frequency**: Quarterly

---

#### BUS-005: Competitive Products Offer Better Features 🟡

**Category**: Business
**Impact**: Low (1) - Market share loss
**Likelihood**: Low (1) - First-mover advantage
**Risk Level**: **VERY LOW** (1/9)

**Description**:
Competitors launch superior accountant workflow tools, making our solution less attractive.

**Mitigation Strategies**:

1. **Continuous Improvement** (Ongoing)
   - Quarterly feature releases
   - User feedback collection
   - Monitor competitor products

2. **Unique Value Props** (Implemented)
   - Australian tax law specialisation
   - Xero integration (existing install base)
   - 6-area workflow coverage
   - AI-powered forensic analysis

3. **Network Effects** (Planned)
   - Multi-tenant agency view (supervising accountant)
   - Shared best practices library
   - Community features

**Residual Risk**: **VERY LOW**
**Risk Owner**: Product Manager
**Review Frequency**: Annually

---

### SECURITY RISKS

#### SEC-001: Unauthorised Access to Confidential Tax Findings 🟠

**Category**: Security
**Impact**: High (3) - Data breach, privacy violation
**Likelihood**: Low (1) - Mitigated by RLS
**Risk Level**: **MEDIUM** (3/9)

**Description**:
Attacker gains unauthorised access to confidential tax findings, client reports, or sensitive financial data.

**Attack Vectors**:
1. SQL injection
2. Broken authentication
3. Broken authorisation (IDOR)
4. Session hijacking
5. Cross-site scripting (XSS)

**Mitigation Strategies**:

1. **Row Level Security (RLS)** (Implemented)
   - Database enforces user isolation
   - Users can only see their own data
   - Cannot be bypassed by API bugs
   ```sql
   CREATE POLICY "Users can view own findings"
     ON accountant_findings
     FOR SELECT
     USING (auth.uid() = user_id);
   ```

2. **Supabase Auth** (Implemented)
   - JWT tokens with short expiry (1 hour)
   - HttpOnly cookies prevent XSS theft
   - Refresh token rotation
   - Email verification required

3. **API Input Validation** (Implemented)
   - Validate all inputs (type, length, format)
   - Sanitise before database queries
   - Reject malformed requests

4. **HTTPS Everywhere** (Implemented)
   - All traffic encrypted via TLS 1.3
   - HSTS header forces HTTPS
   - No insecure HTTP endpoints

5. **Security Headers** (Implemented)
   ```typescript
   headers: {
     'X-Frame-Options': 'DENY',
     'X-Content-Type-Options': 'nosniff',
     'Referrer-Policy': 'strict-origin-when-cross-origin',
     'Content-Security-Policy': "default-src 'self'",
   }
   ```

6. **Penetration Testing** (Planned)
   - Quarterly pen tests by third party
   - Fix vulnerabilities within 30 days
   - Retest to confirm fixes

**Residual Risk**: **LOW**
**Risk Owner**: Security Engineer
**Review Frequency**: Quarterly

---

#### SEC-002: Xero OAuth Token Compromise 🟡

**Category**: Security
**Impact**: High (3) - Unauthorised Xero access
**Likelihood**: Very Low (1) - Encrypted at rest
**Risk Level**: **MEDIUM** (3/9)

**Description**:
Attacker obtains Xero OAuth tokens, gaining read access to client financial data.

**Mitigation Strategies**:

1. **Token Encryption** (Implemented)
   - Tokens encrypted at rest in Supabase
   - AES-256 encryption
   - Decryption only during API calls

2. **Token Rotation** (Implemented)
   - Refresh tokens every 30 minutes
   - Revoke on logout
   - Detect and revoke leaked tokens

3. **Read-Only Scopes** (Implemented)
   - Use minimum necessary Xero scopes
   - Never request write permissions
   - Cannot modify Xero data

4. **Secure Storage** (Implemented)
   - Never log tokens (redact to first 8 chars)
   - Not exposed in API responses
   - Not stored in browser localStorage

**Residual Risk**: **VERY LOW**
**Risk Owner**: Security Engineer
**Review Frequency**: Annually

---

#### SEC-003: Client Report Data Leakage via Email 🟡

**Category**: Security
**Impact**: Medium (2) - Confidential info leaked
**Likelihood**: Low (1) - Email delivered to correct recipients
**Risk Level**: **LOW** (2/9)

**Description**:
Client report emailed to wrong recipients, leaking confidential tax findings.

**Mitigation Strategies**:

1. **Email Validation** (Implemented)
   - Validate email format
   - Maximum 10 recipients per send
   - Accountant must approve recipient list

2. **Confirmation Step** (Implemented)
   - Show "Send to: [emails]" confirmation
   - Require explicit "Send" button click
   - No auto-send

3. **Access Controls on PDFs** (Planned)
   - Password-protect PDFs
   - Expiring download links
   - Track who downloaded

4. **Audit Logging** (Implemented)
   - Log all email sends (to, from, timestamp)
   - Detect anomalous patterns
   - Alert on high-volume sends

**Residual Risk**: **VERY LOW**
**Risk Owner**: Security Engineer
**Review Frequency**: Annually

---

#### SEC-004: Denial of Service (DoS) Attack 🟡

**Category**: Security
**Impact**: Medium (2) - Service unavailable
**Likelihood**: Low (1) - Vercel DDoS protection
**Risk Level**: **LOW** (2/9)

**Description**:
Attacker floods API with requests, making service unavailable to legitimate users.

**Mitigation Strategies**:

1. **Vercel DDoS Protection** (Implemented)
   - Automatic DDoS mitigation
   - Rate limiting at edge
   - IP blocking for malicious traffic

2. **API Rate Limiting** (Implemented)
   ```typescript
   // Per-user rate limits
   const RATE_LIMITS = {
     findings: 100,  // requests per minute
     analysis: 10,
     reports: 20,
   };
   ```

3. **CAPTCHA on Sensitive Actions** (Planned)
   - Require CAPTCHA for report generation
   - Prevent automated abuse

**Residual Risk**: **VERY LOW**
**Risk Owner**: DevOps Engineer
**Review Frequency**: Annually

---

### OPERATIONAL RISKS

#### OPS-001: Key Personnel Departure 🟡

**Category**: Operational
**Impact**: Medium (2) - Knowledge loss
**Likelihood**: Low (1) - Team stability
**Risk Level**: **LOW** (2/9)

**Description**:
Key engineer or tax agent leaves, taking critical knowledge about system architecture or tax logic.

**Mitigation Strategies**:

1. **Documentation** (Implemented)
   - Comprehensive ADR, API specs, ERD, diagrams
   - Code comments for complex logic
   - User guides and training materials

2. **Knowledge Sharing** (Planned)
   - Pair programming for critical features
   - Cross-training on tax logic
   - Regular architecture reviews

3. **Code Reviews** (Implemented)
   - All code reviewed by 2+ engineers
   - Spreads knowledge across team

**Residual Risk**: **VERY LOW**
**Risk Owner**: Engineering Manager
**Review Frequency**: Annually

---

#### OPS-002: Insufficient Support Resources During Tax Season 🟡

**Category**: Operational
**Impact**: Medium (2) - Poor user experience
**Likelihood**: Medium (2) - Seasonal spike
**Risk Level**: **MEDIUM** (4/9)

**Description**:
Usage spikes during tax season (June-October), overwhelming support team.

**Mitigation Strategies**:

1. **Self-Service Resources** (Planned)
   - Comprehensive FAQ
   - Video tutorials
   - In-app help tooltips
   - AI chatbot for common questions

2. **Proactive Monitoring** (Planned)
   - Track error rates, slow queries
   - Fix issues before users complain
   - Automated alerts

3. **Scalable Support** (Planned)
   - Hire seasonal support staff
   - Escalation path to engineering
   - SLA: respond within 24 hours

**Residual Risk**: **LOW**
**Risk Owner**: Customer Success Manager
**Review Frequency**: Quarterly

---

#### OPS-003: Vendor Lock-In (Supabase, Vercel, Google) 🟡

**Category**: Operational
**Impact**: Medium (2) - Migration difficulty
**Likelihood**: Low (1) - Vendors stable
**Risk Level**: **LOW** (2/9)

**Description**:
Heavy reliance on third-party vendors (Supabase, Vercel, Google Gemini) makes migration difficult if needed.

**Mitigation Strategies**:

1. **Standard Protocols** (Implemented)
   - PostgreSQL (portable to any PG host)
   - REST APIs (framework-agnostic)
   - Docker containerisation

2. **Abstraction Layers** (Planned)
   - Abstract database layer (can swap Supabase)
   - Abstract AI layer (can swap Gemini for Claude/GPT)

3. **Disaster Recovery Plan** (Planned)
   - Regular backups (daily)
   - Tested restore procedures
   - Alternative hosting plan

**Residual Risk**: **LOW**
**Risk Owner**: CTO
**Review Frequency**: Annually

---

#### OPS-004: Data Loss Due to Bug or Incident 🟡

**Category**: Operational
**Impact**: High (3) - Loss of findings/reports
**Likelihood**: Very Low (1) - Supabase backups
**Risk Level**: **MEDIUM** (3/9)

**Description**:
Software bug or infrastructure incident causes loss of findings, reports, or configuration data.

**Mitigation Strategies**:

1. **Automated Backups** (Implemented)
   - Supabase automatic daily backups
   - 7-day retention
   - Point-in-time recovery

2. **Soft Deletes** (Planned)
   - Don't hard-delete findings
   - Mark as deleted, archive after 30 days
   - Recoverable if user asks

3. **Audit Logging** (Implemented)
   - Track all create/update/delete operations
   - Can reconstruct state if needed

**Residual Risk**: **VERY LOW**
**Risk Owner**: Database Administrator
**Review Frequency**: Annually

---

#### OPS-005: Regulatory Changes Require System Updates 🟡

**Category**: Operational
**Impact**: Low (1) - Manageable with planning
**Likelihood**: Medium (2) - Tax law changes regularly
**Risk Level**: **LOW** (2/9)

**Description**:
ATO introduces new tax legislation, requiring system updates (e.g., new R&D offset rates, FBT changes).

**Mitigation Strategies**:

1. **Flexible Configuration** (Implemented)
   - Tax rates configurable, not hardcoded
   - Easy to update via config files
   - Version control for tax data

2. **Monitoring ATO Changes** (Planned)
   - Subscribe to ATO email updates
   - Quarterly legislation reviews
   - Tax agent validates changes

3. **Rapid Deployment** (Implemented)
   - Vercel allows instant deploys
   - Blue-green deployment
   - Rollback capability

**Residual Risk**: **VERY LOW**
**Risk Owner**: Tax Agent Specialist
**Review Frequency**: Quarterly

---

## Risk Treatment Plan

### Immediate Actions (Next 30 Days)

| Risk ID | Action | Owner | Due Date |
|---------|--------|-------|----------|
| COMP-003 | Review PI insurance policy with broker | Managing Partner | 2026-02-28 |
| COMP-004 | Draft privacy policy | Data Protection Officer | 2026-02-28 |
| BUS-001 | Develop accountant training materials | Product Manager | 2026-02-28 |
| SEC-001 | Schedule Q1 penetration test | Security Engineer | 2026-02-28 |

### Short-Term Actions (Next 90 Days)

| Risk ID | Action | Owner | Due Date |
|---------|--------|-------|----------|
| COMP-001 | Tax agent to validate all formulas | Tax Agent | 2026-04-30 |
| COMP-002 | Implement quarterly legislation audit process | Tax Agent | 2026-04-30 |
| TECH-001 | Implement monthly AI output audit | AI Engineer | 2026-04-30 |
| BUS-001 | Launch user onboarding tutorial | Product Manager | 2026-04-30 |
| BUS-002 | Track adoption metrics dashboard | Product Manager | 2026-04-30 |

### Long-Term Actions (Next 12 Months)

| Risk ID | Action | Owner | Due Date |
|---------|--------|-------|----------|
| BUS-003 | Implement post-implementation tracking | AI Engineer | 2026-12-31 |
| OPS-002 | Build self-service support resources | Customer Success | 2026-12-31 |
| OPS-003 | Create vendor abstraction layers | CTO | 2026-12-31 |

---

## Risk Monitoring Dashboard

### Key Risk Indicators (KRIs)

```typescript
// Compliance Risk
metrics.gauge('finding_rejection_rate', {
  reason: 'legislative_concern'
});
// Alert if >15%

// Business Risk
metrics.gauge('weekly_active_accountants', count);
// Alert if <80% of expected

// Technical Risk
metrics.gauge('ai_hallucination_rate', rate);
// Alert if >1%

// Security Risk
metrics.counter('unauthorised_access_attempts', count);
// Alert immediately on any occurrence

// Operational Risk
metrics.gauge('support_ticket_response_time_hours', hours);
// Alert if >24 hours
```

### Monthly Risk Review

**Agenda**:
1. Review risk register for changes
2. Assess residual risks after controls
3. Identify new risks
4. Update risk treatment plan
5. Report to leadership

**Attendees**:
- Product Manager (Business risks)
- Engineering Lead (Technical risks)
- Tax Agent (Compliance risks)
- Security Engineer (Security risks)
- DevOps Engineer (Operational risks)

**Meeting Frequency**: Monthly (first 6 months), then quarterly

---

## Appendix A: Risk Scoring Matrix

### Impact Scale

| Level | Score | Financial | Reputational | Legal |
|-------|-------|-----------|--------------|-------|
| **Low** | 1 | <$10K | Minor complaints | No legal action |
| **Medium** | 2 | $10K-$100K | Client churn | Regulatory warning |
| **High** | 3 | >$100K | Firm closure risk | Fines or prosecution |

### Likelihood Scale

| Level | Score | Probability | Frequency |
|-------|-------|-------------|-----------|
| **Very Low** | 1 | <5% | Once in 5+ years |
| **Low** | 1 | 5-25% | Once in 2-5 years |
| **Medium** | 2 | 25-50% | Once per year |
| **High** | 3 | >50% | Multiple times per year |

### Risk Level Calculation

```
Risk Level = Impact × Likelihood

1-2: Very Low 🟢
3-4: Low 🟡
5-6: Medium 🟠
7-9: High/Critical 🔴
```

---

## Appendix B: Incident Response Plan

### Security Incident Response

**Phase 1: Detection & Triage** (0-2 hours)
1. Alert received (automated monitoring or user report)
2. Assess severity (low/medium/high/critical)
3. Assemble response team
4. Begin incident log

**Phase 2: Containment** (2-4 hours)
1. Isolate affected systems
2. Revoke compromised credentials
3. Block malicious IP addresses
4. Prevent further damage

**Phase 3: Investigation** (4-24 hours)
1. Analyse logs and forensics
2. Identify root cause
3. Determine scope of breach
4. Document findings

**Phase 4: Remediation** (24-72 hours)
1. Fix vulnerabilities
2. Restore systems from backups
3. Verify fix effectiveness
4. Re-enable services

**Phase 5: Post-Incident** (72 hours+)
1. Notify affected users (if required by Privacy Act)
2. Report to Privacy Commissioner (if required)
3. Conduct lessons learned review
4. Update security controls
5. Update risk register

---

**Risk Assessment Status**: Complete
**Total Risks Identified**: 25
**Critical Risks**: 3
**High Risks**: 4
**Medium Risks**: 12
**Low Risks**: 6

**Next Review**: 2026-04-30 (90 days)
**Document Owner**: Risk Manager
**Approved By**: [Pending UNI-278 completion]
