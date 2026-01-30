# G-Pilot: Australian Tax Optimization (ATO) Audit Suite

## 🚀 Mission Statement
The G-Pilot ATO Suite is an elite forensic analysis system for **Business Owners ($990)** and **Accountants ($495)**. It is designed to act as an **Auditing Tool** to discover hidden tax benefits, identify misclassifications, and optimize financial positions. We provide the **Audit Outline**—identifying candidate items for professional review and remediation.

## 🏛️ Core Sovereignty
1. **Forensic Assistance Only**: This is NOT a DIY Tax Machine. We identify candidates; the Human Professional (Owner or Accountant) executes.
2. **Professional Layer Partnership**: Designed to provide Accountants with high-fidelity discovery data to on-charge as a "Tax Health Check" advisory service.
3. **Legal & Ethical Absolute**: Every discovery is mapped to Division/Section legislation in ITAA 1997/1936.
4. **Read-Only Integrity**: We analyze and report; we never modify source ledgers.

---

## 🧠 Intelligence Matrix

### 1. Forensic Audit Engine
- **Xero Integration**: Deep-scan of historical ledgers (up to 5 years).
- **Misclassification Detection**: Identifying CAPEX/OPEX errors and unclaimed SBE concessions.
- **Confidence Scoring**: Probability-based risk assessment for every transaction.

### 2. R&D Tax Incentive (Division 355)
- **Automatic Opportunity Discovery**: Identifying Core vs. Supporting projects.
- **Legislative Testing**: Applying the Four-Element test for eligibility.
- **Refund Projections**: Estimating 43.5% refundable offsets.

### 3. Division 7A Compliance
- **Loan Monitoring**: Tracking shareholder loans against benchmark rates.
- **Scenario Modeling**: Calculating minimum yearly repayments to avoid deemed dividends.

### 4. SBE Discovery
- **Turnover Aggregation**: Calculating group turnover for concession eligibility.
- **Benefit Estimator**: Quantifying the value of simplified depreciation and FBT exemptions.

---

## 🛠️ Operational Workflow

### `/tax-audit`
Run a comprehensive forensic scan of the connected Xero tenant.
- Generates: Opportunity Matrix, Data Quality Report, Potential Refund Summary.

### `/rnd-assessment`
Deep dive into specific project narratives for Division 355 eligibility.
- Generates: Technical Evidence Summary, Documentation Checklist.

### `/loss-analysis`
Review historical loss carry-forwards and capital contributions.
- Generates: Loss Utilization Strategy, Shareholder Loan Adjustments.

---

## 📊 Design & UX Standard (v8.1)
- **Visuals**: #050505 Background, Sky-500 Tactical Accents.
- **Components**: GlassCard Containers, Animated KPI Counters, Recharts Visualizations.
- **Provenance**: Footers contain live metadata regarding the source of legislative data.

---

## 🤖 Multi-Agent Architecture Framework

This project uses a formalized multi-agent development framework. See `MULTI_AGENT_ARCHITECTURE.md` for complete specification.

### Agent Hierarchy

```
Developer (Ultimate Authority)
    ↓
Senior Project Manager
    ↓
Orchestrator
    ↓
┌─────────┬─────────┬─────────┬─────────┐
│ Spec A  │ Spec B  │ Spec C  │ Spec D  │
│ Arch    │ Code    │ Test    │ Docs    │
└─────────┴─────────┴─────────┴─────────┘
```

### Framework Components

**Framework Agents** (Development):
- Orchestrator: Task decomposition and coordination
- Specialist A: Architecture & Design
- Specialist B: Implementation & Coding
- Specialist C: Testing & Validation
- Specialist D: Review & Documentation

**Tax Domain Agents** (Business Logic):
- 18 specialized tax agents (R&D, deductions, Division 7A, etc.)

### Quality Gates

Six automated quality gates enforce standards before phase transitions:
1. Design Complete → Implementation
2. Implementation Complete → Testing
3. Testing Complete → Documentation
4. Documentation Complete → Integration
5. Integration Complete → Final Approval
6. Final Approval → Deployment

### Linear Integration

All work tracked in Linear:
- Team: `unite-hub`
- Project: `ato-3f31f766c467`
- Auto-updates, blocker escalation, daily reports

### Quick Commands

```bash
npm run agent:orchestrator -- --task "Description"
npm run agent:daily-report
npm run agent:quality-gate -- --gate <name>
npm run linear:sync
npm run linear:report
```

---

## 🔗 Critical Resources
- **Knowledge Base**: `KNOWLEDGE.md` - Technical architecture and skill mapping.
- **Project Status**: `ATO_PROJECT_STATUS.md` - Linear task tracking and deployment health.
- **Design Tokens**: `STANDARDS.md` - UI/UX mandates and v8.1 implementation details.
