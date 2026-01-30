# Accountant Workflow Enhancement - Orchestration Plan

**Linear Issue**: [UNI-277](https://linear.app/unite-hub/issue/UNI-277/enhance-accountant-workflow-integration)
**Priority**: High
**Deadline**: 2026-03-01
**Status**: Awaiting Orchestrator Decomposition

---

## Project Overview

### Objective
Design and implement an accountant-facing workflow that provides intelligence and recommendations WITHOUT replacing professional judgment. System must integrate seamlessly with accountants' daily tasks across 6 key workflow areas.

### Core Principle
**Add Value, Don't Replace**: ATO provides pre-analysis, flags opportunities, and suggests actions, but accountant retains 100% decision-making authority.

---

## 6 Workflow Integration Areas

### 1. Sundries Inputs
**Accountant's Current Task**: Review miscellaneous transactions, ensure proper coding

**ATO Value-Add**:
- Flag sundries that might qualify as R&D expenditure
- Identify potential deductions in "Other Expenses"
- Suggest reclassification opportunities with confidence scores

**Integration Point**: During transaction review → ATO highlights anomalies → Accountant decides action

---

### 2. General Deductions (Section 8-1)
**Accountant's Current Task**: Ensure all legitimate deductions claimed

**ATO Value-Add**:
- Scan for missed Section 8-1 deductions
- Cross-reference expenses against deduction categories
- Provide confidence score on eligibility (High/Medium/Low)

**Integration Point**: During tax return prep → ATO suggests additional deductions → Accountant reviews/approves

---

### 3. FBT (Fringe Benefits Tax)
**Accountant's Current Task**: Identify FBT liabilities, calculate 47% rate

**ATO Value-Add**:
- Flag transactions triggering FBT (car benefits, entertainment)
- Calculate FBT exposure estimates
- Suggest exemptions/concessions available (FBTAA 1986)

**Integration Point**: During payroll/benefits review → ATO flags FBT triggers → Accountant validates

---

### 4. Division 7A
**Accountant's Current Task**: Review shareholder loans, ensure compliance

**ATO Value-Add**:
- Calculate minimum yearly repayments (8.77% benchmark FY2024-25)
- Flag non-compliant loans (deemed dividends risk)
- Track loan agreements and repayment deadlines

**Integration Point**: During company finances review → ATO highlights Div 7A risks → Accountant advises client

---

### 5. Source Documents
**Accountant's Current Task**: Ensure receipts/invoices support claims

**ATO Value-Add**:
- Identify transactions missing documentation
- Flag high-risk items requiring substantiation
- Suggest document requirements for R&D claims

**Integration Point**: During doc collection → ATO prioritizes what's needed → Client provides

---

### 6. Reconciliation
**Accountant's Current Task**: Bank recs, balance sheet reconciliation

**ATO Value-Add**:
- Detect discrepancies in financial data (forensic analysis)
- Highlight unusual patterns requiring investigation
- Validate multi-year consistency

**Integration Point**: During recs → ATO flags anomalies → Accountant investigates

---

## Orchestrator Decomposition Plan

When the Orchestrator receives this task, it will decompose into the following specialist assignments:

### Phase 1: Architecture & Design (Specialist A)

**Task ID**: ORCH-ACC-001
**Estimated**: 8 hours
**Dependencies**: None

**Objectives**:
1. Design 6-area dashboard architecture
2. Define notification system architecture (>$50K triggers, compliance risks)
3. Design client report generator workflow (review → approve → send)
4. Create data models for confidence scoring
5. Design legislation reference system

**Deliverables**:
- ADR: Accountant Workflow Integration Architecture
- System diagrams: Dashboard layout, notification flow, report workflow
- Database ERD: Workflow states, notifications, reports
- API specifications: OpenAPI specs for all endpoints
- Risk assessment: Integration risks with mitigation strategies

**Quality Gate 1: Design Complete**
- ✅ ADR exists with architecture decisions documented
- ✅ System diagrams complete (Mermaid/PlantUML)
- ✅ API specifications provided (OpenAPI 3.0)
- ✅ Database ERD showing all entities
- ✅ Risks documented with mitigations

---

### Phase 2: Tax Compliance Validation (Tax Agent)

**Task ID**: ORCH-ACC-002
**Estimated**: 4 hours
**Dependencies**: ORCH-ACC-001 (requires architecture)

**Objectives**:
1. Validate Section 8-1 deduction eligibility logic
2. Confirm FBT calculation formulas (FBTAA 1986)
3. Verify Division 7A compliance calculations (8.77% benchmark)
4. Review R&D eligibility criteria (4-element test)
5. Validate source document requirements

**Deliverables**:
- Legislation reference guide with sections cited
- Calculation formulas validated against ATO regulations
- Compliance checklist for each workflow area
- Edge cases documented (e.g., mixed-use assets for FBT)

**Quality Gate 2: Compliance Validated**
- ✅ All calculations verified against legislation
- ✅ Legislation references complete (ITAA 1997, ITAA 1936, FBTAA 1986)
- ✅ Edge cases documented
- ✅ Compliance checklist approved by tax specialist

---

### Phase 3: Implementation - Dashboard & Workflow (Specialist B)

**Task ID**: ORCH-ACC-003
**Estimated**: 12 hours
**Dependencies**: ORCH-ACC-001, ORCH-ACC-002

**Objectives**:
1. Implement 6-area dashboard (Sundries, Deductions, FBT, Div7A, Docs, Recs)
2. Build smart notification system (>$50K, compliance risks, deadlines)
3. Create client report generator with review/approve workflow
4. Implement confidence scoring system (High/Medium/Low)
5. Add legislation reference display for all recommendations

**Implementation Files**:
```
app/dashboard/accountant/
├── page.tsx                          # Main dashboard
├── sundries/page.tsx                 # Sundries analysis view
├── deductions/page.tsx               # Deductions scanner
├── fbt/page.tsx                      # FBT calculator
├── div7a/page.tsx                    # Division 7A tracker
├── documents/page.tsx                # Document checker
└── reconciliation/page.tsx           # Reconciliation auditor

app/api/accountant/
├── notifications/route.ts            # GET notifications
├── reports/generate/route.ts         # POST generate report
├── reports/approve/route.ts          # POST approve report
├── confidence-score/route.ts         # POST calculate confidence
└── legislation-refs/route.ts         # GET legislation references

lib/accountant/
├── notification-engine.ts            # Smart notification logic
├── report-generator.ts               # Client report builder
├── confidence-scorer.ts              # Confidence calculation
└── legislation-linker.ts             # Legislation reference mapper

components/accountant/
├── DashboardOverview.tsx             # 6-area summary
├── NotificationPanel.tsx             # Alert display
├── ReportPreview.tsx                 # Report review UI
└── ConfidenceBadge.tsx               # High/Medium/Low badge
```

**Quality Gate 3: Implementation Complete**
- ✅ All 6 workflow area pages functional
- ✅ Notification system triggers on >$50K and compliance risks
- ✅ Report generator creates customizable reports
- ✅ Confidence scores display on all recommendations
- ✅ Legislation references clickable/viewable
- ✅ Code compiles without errors
- ✅ ESLint passes (0 errors, 0 warnings)

---

### Phase 4: Testing & Validation (Specialist C)

**Task ID**: ORCH-ACC-004
**Estimated**: 10 hours
**Dependencies**: ORCH-ACC-003

**Objectives**:
1. Unit tests for notification engine (thresholds, triggers)
2. Integration tests for report generation workflow
3. E2E tests for accountant user journey (review → approve → send)
4. Test confidence scoring accuracy
5. Validate legislation reference linking

**Test Files**:
```
lib/accountant/
├── notification-engine.test.ts       # Unit tests
├── report-generator.test.ts          # Unit tests
├── confidence-scorer.test.ts         # Unit tests
└── legislation-linker.test.ts        # Unit tests

tests/integration/accountant/
├── dashboard-workflow.test.ts        # Integration tests
├── notification-flow.test.ts         # Integration tests
└── report-approval.test.ts           # Integration tests

tests/e2e/accountant/
├── accountant-review-journey.spec.ts # E2E tests
└── report-generation.spec.ts         # E2E tests
```

**Test Scenarios**:
- ✅ Notification triggers when opportunity value > $50,000
- ✅ Compliance risk alert for non-compliant Div 7A loans
- ✅ Report generation includes all required sections
- ✅ Accountant can review, edit, and approve reports
- ✅ Confidence scores match expected values
- ✅ Legislation references link to correct ATO pages
- ✅ Dashboard displays all 6 workflow areas correctly

**Quality Gate 4: Testing Complete**
- ✅ All tests passing (target: 100% of tests)
- ✅ Code coverage ≥80% (unit + integration)
- ✅ E2E tests cover complete user journeys
- ✅ No critical bugs found
- ✅ Performance acceptable (<2s page load)

---

### Phase 5: Documentation & User Guide (Specialist D)

**Task ID**: ORCH-ACC-005
**Estimated**: 6 hours
**Dependencies**: ORCH-ACC-003, ORCH-ACC-004

**Objectives**:
1. Write accountant user guide (how to use each workflow area)
2. Document API endpoints for developers
3. Create video/screenshot walkthrough
4. Write changelog entry
5. Code review all implementations

**Documentation Files**:
```
docs/accountant/
├── USER_GUIDE.md                     # Complete accountant guide
├── WORKFLOW_AREAS.md                 # 6-area detailed documentation
├── NOTIFICATION_SYSTEM.md            # How notifications work
├── REPORT_GENERATOR.md               # Report customization guide
└── FAQ.md                            # Common questions

docs/api/
└── ACCOUNTANT_API.md                 # API reference

CHANGELOG.md                          # Updated with v8.4.0 entry
```

**Accountant User Guide Contents**:
1. **Getting Started**: Dashboard overview, navigation
2. **Sundries Workflow**: How to review flagged sundries
3. **Deductions Workflow**: How to approve suggested deductions
4. **FBT Workflow**: How to validate FBT triggers
5. **Division 7A Workflow**: How to manage loan compliance
6. **Documents Workflow**: How to prioritize document collection
7. **Reconciliation Workflow**: How to investigate flagged anomalies
8. **Notifications**: Understanding alerts and priorities
9. **Report Generation**: Creating, reviewing, approving client reports
10. **Best Practices**: Daily workflow integration tips

**Quality Gate 5: Documentation Complete**
- ✅ Accountant user guide complete (all 10 sections)
- ✅ API documentation complete with examples
- ✅ Changelog updated
- ✅ Code review: APPROVED (no issues)
- ✅ Screenshots/walkthrough provided

---

### Phase 6: Integration & Final Review (Orchestrator)

**Task ID**: ORCH-ACC-006
**Estimated**: 4 hours
**Dependencies**: ORCH-ACC-001, ORCH-ACC-002, ORCH-ACC-003, ORCH-ACC-004, ORCH-ACC-005

**Objectives**:
1. Merge all specialist outputs
2. Run full integration tests
3. Verify all quality gates passed
4. Prepare deployment package
5. Generate completion report for Senior PM

**Integration Checklist**:
- ✅ Architecture documented and approved
- ✅ Tax compliance validated
- ✅ All 6 workflow areas implemented
- ✅ Notification system functional
- ✅ Report generator operational
- ✅ Tests passing (≥80% coverage)
- ✅ Documentation complete
- ✅ No merge conflicts
- ✅ System functional end-to-end

**Quality Gate 6: Integration Complete**
- ✅ All prior quality gates passed (5/5)
- ✅ Integrated system functional
- ✅ No critical issues
- ✅ Ready for Senior PM final approval

---

## Success Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Dashboard shows 6 workflow areas | ⏳ Pending | Implementation in ORCH-ACC-003 |
| Smart notifications for >$50K opportunities | ⏳ Pending | Notification engine in ORCH-ACC-003 |
| Customizable client report generator | ⏳ Pending | Report generator in ORCH-ACC-003 |
| All outputs include legislation refs | ⏳ Pending | Legislation linker in ORCH-ACC-003 |
| All outputs include confidence scores | ⏳ Pending | Confidence scorer in ORCH-ACC-003 |
| Tests ≥80% coverage | ⏳ Pending | Testing in ORCH-ACC-004 |
| Accountant user guide complete | ⏳ Pending | Documentation in ORCH-ACC-005 |

---

## Timeline Estimate

**Total Estimated Duration**: 44 hours (5.5 working days)

| Phase | Duration | Can Start After |
|-------|----------|-----------------|
| ORCH-ACC-001: Architecture | 8 hours | Immediate |
| ORCH-ACC-002: Compliance | 4 hours | ORCH-ACC-001 complete |
| ORCH-ACC-003: Implementation | 12 hours | ORCH-ACC-001, ORCH-ACC-002 complete |
| ORCH-ACC-004: Testing | 10 hours | ORCH-ACC-003 complete |
| ORCH-ACC-005: Documentation | 6 hours | ORCH-ACC-003, ORCH-ACC-004 complete |
| ORCH-ACC-006: Integration | 4 hours | All prior phases complete |

**Parallel Execution Opportunities**:
- ORCH-ACC-004 and ORCH-ACC-005 can partially overlap (documentation can start while testing in progress)

**Critical Path**: ORCH-ACC-001 → ORCH-ACC-002 → ORCH-ACC-003 → ORCH-ACC-004 → ORCH-ACC-006

**Target Completion**: 2026-02-07 (with buffer before March 1 deadline)

---

## Risks & Mitigations

### Risk 1: Complexity of 6-Area Integration
**Impact**: High
**Probability**: Medium
**Mitigation**: Implement areas incrementally, start with highest-value area (Deductions)

### Risk 2: Accountant User Acceptance
**Impact**: Critical
**Probability**: Medium
**Mitigation**: Involve real accountants in testing (ORCH-ACC-004), gather feedback early

### Risk 3: Legislation Reference Accuracy
**Impact**: High
**Probability**: Low
**Mitigation**: Tax agent validation in ORCH-ACC-002, automated reference checking

### Risk 4: Notification Fatigue
**Impact**: Medium
**Probability**: High
**Mitigation**: Implement smart filtering (>$50K threshold, priority-based), allow customization

### Risk 5: Report Customization Complexity
**Impact**: Medium
**Probability**: Medium
**Mitigation**: Provide templates, limit customization to essential fields initially

---

## Next Steps (Senior PM Actions)

1. ✅ **Send to Orchestrator** for task decomposition approval
2. ⏳ **Create Linear sub-issues** for each ORCH-ACC task
3. ⏳ **Assign specialists** based on availability
4. ⏳ **Monitor quality gates** throughout execution
5. ⏳ **Escalate blockers** to Developer if needed
6. ⏳ **Final approval** before deployment

---

## Monitoring & Reporting

**Daily Status Updates**: `npm run senior-pm:daily-report`

**Key Metrics to Track**:
- Tasks completed vs. assigned
- Quality gate pass rate
- Blocker count and resolution time
- Test coverage percentage
- Days until deadline (March 1)

**Escalation Triggers**:
- Any quality gate failure
- Blocker unresolved for >4 hours
- Deadline at risk (less than 7 days buffer remaining)
- Specialist requesting scope change

---

**Created**: 2026-01-30
**Last Updated**: 2026-01-30
**Status**: Awaiting Orchestrator Decomposition
**Linear Issue**: [UNI-277](https://linear.app/unite-hub/issue/UNI-277)
