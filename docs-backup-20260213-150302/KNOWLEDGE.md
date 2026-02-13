# G-Pilot Intelligence: Capability Matrix & Knowledge Library

## 🏛️ System Architecture
The ATO Optimization Suite is a multi-agent orchestration layer built on Next.js 16 and Supabase, specifically designed for Australian Business Taxation compliance and optimization.

### 🧠 Core Reasoners
- **Forensic Auditor**: Analyzes Xero/MYOB/QuickBooks ledgers for misclassifications and unclaimed deductions.
- **R&D Spec**: Evaluates projects against Division 355 ITAA 1997 Four-Element Test.
- **Div7A Guardian**: Monitors shareholder loans for Section 109N compliance.
- **SBE Discovery**: Evaluates aggregated turnover thresholds for Small Business Concessions.

---

## ⚖️ Legislative Grounding (Data Provenance)
All analysis is grounded in specific Australian Taxation legislation. The system maintains live links to ATO.gov.au rulings.

| Domain | Primary Legislation | Key Ruling/Section |
| :--- | :--- | :--- |
| **R&D Tax Incentive** | ITAA 1997 | Division 355 |
| **Shareholder Loans** | ITAA 1936 | Division 7A |
| **Small Business Concessions** | ITAA 1997 | Division 328 |
| **Tax Losses** | ITAA 1997 | Division 36 |
| **Instant Asset Write-off** | ITAA 1997 | Section 40-82 |

---

## 🛠️ Integrated Skills
The following specialized skills are available to the agent fleet:

### 1. `xero_api_integration`
- **Scope**: Read-only access to Transactions, Manual Journals, and Reports.
- **Security**: OAuth 2.0 with minimal scopes. Identity-linked multi-tenant isolation.

### 2. `rnd_eligibility_assessment`
- **Criteria**: Outcome Unknown, Systematic Approach, New Knowledge, Scientific Method.
- **Output**: 43.5% Refundable Offset projections.

### 3. `legal_research_engine`
- **Capability**: Real-time searching of ATO legal database via Brave + Jina AI.
- **Artifacts**: Current year benchmark interest rates, corporate tax thresholds.

---

## 📊 Data Quality & Provenance
The system tracks **Forensic Confidence Scores** for every recommendation:
- **High (70-100%)**: Substantiated by direct ledger evidence and clear legislative alignment.
- **Medium (40-70%)**: Requires user verification or additional documentation.
- **Low (<40%)**: Flagged for professional audit review only.

---

## 🚀 Visionary UI Standard (v8.1)
The interface adheres to the **Scientific Luxury** mandate:
- **Aesthetic**: #050505 Deep Black, Sky-500 Accents, 20px Glassmorphism Blur.
- **Typography**: Inter / Mono for data provenance. Tracking 0.2em for tactical headers.
- **Motion**: Framer Motion orchestrating entry sequences and state transitions.

---

## 📅 Roadmap: Phase 5 & Beyond
1. **Automated BAS Lodgement**: Secure submission via ATO Standard Business Reporting (SBR).
2. **AI-Ledger Correction**: Batch-reclassification triggers for Xero.
3. **Multi-Entity Scenario Modeling**: Advanced group structuring visualization.
