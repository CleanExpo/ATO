# Australian Tax Optimization (ATO) Agent Fleet

This document defines the autonomous agent fleet for comprehensive Australian tax optimization.

## Multi-Agent Architecture Framework

This agent system is organized into **two tiers**:

### Tier 1: Development Process Agents (Framework)

These agents manage the **development workflow**:

| Agent | Role | Context | Reports To |
|-------|------|---------|-----------|
| **Orchestrator** | Operational command, task decomposition, results synthesis | Shared | Senior PM |
| **Specialist A** | Architecture & Design (ADRs, system diagrams, API schemas) | Context 1 (design docs only) | Orchestrator |
| **Specialist B** | Implementation & Coding (production code, features) | Context 2 (code only) | Orchestrator |
| **Specialist C** | Testing & Validation (unit/integration/E2E tests, ≥80% coverage) | Context 3 (tests only) | Orchestrator |
| **Specialist D** | Review & Documentation (code review, API docs, changelogs) | Context 4 (docs only) | Orchestrator |

**Agent Definitions**:
- Orchestrator: [.agent/orchestrator/ORCHESTRATOR.md](.agent/orchestrator/ORCHESTRATOR.md)
- Specialist A: [.agent/specialists/architect/SPECIALIST_A.md](.agent/specialists/architect/SPECIALIST_A.md)
- Specialist B: [.agent/specialists/developer/SPECIALIST_B.md](.agent/specialists/developer/SPECIALIST_B.md)
- Specialist C: [.agent/specialists/tester/SPECIALIST_C.md](.agent/specialists/tester/SPECIALIST_C.md)
- Specialist D: [.agent/specialists/reviewer/SPECIALIST_D.md](.agent/specialists/reviewer/SPECIALIST_D.md)

**Context Isolation**: Each specialist operates in an isolated context to prevent cross-contamination. Context handoffs occur via standardized protocols (see `lib/agents/communication.ts`).

**Quality Gates**: Phase transitions require passing automated quality gates (see `lib/agents/quality-gates.ts`):
1. Design Complete → Implementation
2. Implementation Complete → Testing
3. Testing Complete → Documentation
4. Documentation Complete → Integration
5. Integration Complete → Final Approval
6. Final Approval → Deployment

**Linear Integration**: All framework tasks tracked in Linear (Team: `unite-hub`, Project: `ato-3f31f766c467`)

See [MULTI_AGENT_ARCHITECTURE.md](../MULTI_AGENT_ARCHITECTURE.md) for complete framework specification.

### Tier 2: Tax Domain Agents (Business Logic)

These agents handle **Australian tax analysis** (18 specialized agents below):

## Mission

Deeply analyze Australian Business Taxation Laws, Regulations, and Incentives to identify every legal avenue to recover missing tax benefits, correct ledger misclassifications, optimize tax position, and maximize refunds.

## Fleet Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATION LAYER                     │
└─────────────────────────────┬────────────────────────────────────┘
                              │
    ┌───────────────┬─────────┴─────────┬───────────────┐
    │               │                   │               │
    ▼               ▼                   ▼               ▼
┌─────────┐   ┌───────────┐   ┌─────────────┐   ┌─────────────┐
│  Tax    │   │   Xero    │   │    R&D      │   │ Deduction   │
│  Law    │   │  Auditor  │   │    Tax      │   │ Optimizer   │
│ Analyst │   │           │   │ Specialist  │   │             │
└────┬────┘   └─────┬─────┘   └──────┬──────┘   └──────┬──────┘
     │              │                │                 │
     └──────────────┴────────────────┴─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              ┌───────────┐       ┌───────────────┐
              │   Loss    │       │   Content     │
              │ Recovery  │       │ Orchestrator  │
              │   Agent   │       │ (Reporting)   │
              └───────────┘       └───────────────┘
```

## Registered Agents

### 1. Tax Law Analyst
- **Path**: `.agent/agents/tax_law_analyst/AGENT.md`
- **Description**: Deep Australian tax law research agent
- **Priority**: CRITICAL
- **Bound Skills**: `australian_tax_law_research`, `government_incentive_discovery`
- **Fuel Cost**: 30-100 PTS

### 2. Xero Auditor
- **Path**: `.agent/agents/xero_auditor/AGENT.md`
- **Description**: Xero accounting data extraction and analysis
- **Priority**: CRITICAL
- **Bound Skills**: `xero_api_integration`, `financial_statement_analysis`, `deduction_analysis`
- **Fuel Cost**: 40-150 PTS

### 3. R&D Tax Specialist
- **Path**: `.agent/agents/rnd_tax_specialist/AGENT.md`
- **Description**: R&D Tax Incentive eligibility and claiming
- **Priority**: CRITICAL
- **Bound Skills**: `rnd_eligibility_assessment`, `australian_tax_law_research`
- **Fuel Cost**: 50-150 PTS

### 4. Deduction Optimizer
- **Path**: `.agent/agents/deduction_optimizer/AGENT.md`
- **Description**: Maximize allowable business deductions
- **Priority**: HIGH
- **Bound Skills**: `deduction_analysis`, `australian_tax_law_research`
- **Fuel Cost**: 30-80 PTS

### 5. Loss Recovery Agent
- **Path**: `.agent/agents/loss_recovery_agent/AGENT.md`
- **Description**: Tax loss recovery and shareholder loan management
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `financial_statement_analysis`
- **Fuel Cost**: 40-100 PTS

### 6. Content Orchestrator
- **Path**: `.agent/agents/content_orchestrator/AGENT.md`
- **Description**: Report generation and presentation building
- **Priority**: MEDIUM
- **Bound Skills**: `notebook_lm_research`, `google_slides_storyboard`, `image_generation`, `video_generation`
- **Fuel Cost**: 50-300 PTS

### 7. SBITO Optimizer
- **Path**: `.agent/agents/sbito_optimizer/AGENT.md`
- **Description**: Small Business Income Tax Offset assessment (up to $1,000 reduction)
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 25-75 PTS

### 8. CGT Concession Planner
- **Path**: `.agent/agents/cgt_concession_planner/AGENT.md`
- **Description**: Division 152 Small Business CGT Concession planning
- **Priority**: MEDIUM
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 50-150 PTS

### 9. FBT Optimizer
- **Path**: `.agent/agents/fbt_optimizer/AGENT.md`
- **Description**: Fringe Benefits Tax exemptions and compliance optimization
- **Priority**: MEDIUM
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 30-100 PTS

### 10. Trust Distribution Analyzer
- **Path**: `.agent/agents/trust_distribution_analyzer/AGENT.md`
- **Description**: Section 100A risk assessment and Division 7A UPE compliance
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 50-150 PTS

### 11. Government Grants Finder
- **Path**: `.agent/agents/government_grants_finder/AGENT.md`
- **Description**: Federal, state, and local government grant discovery
- **Priority**: MEDIUM
- **Bound Skills**: `australian_tax_law_research`
- **Fuel Cost**: 25-75 PTS

### 12. Agent Scout 🔍
- **Path**: `.agent/agents/agent_scout/AGENT.md`
- **Description**: Proactive opportunity discovery, legislative monitoring, and deadline alerting
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 20-60 PTS
- **Trigger**: `/scout` workflow

### 13. Bad Debt Recovery Agent 💸
- **Path**: `.agent/agents/bad_debt_recovery_agent/AGENT.md`
- **Description**: Bad debt tax deductions (Section 25-35) and GST recovery (Division 21) for bankrupt/insolvent debtors
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 30-100 PTS
- **Trigger**: `/bad-debt-scan` workflow

### 14. Business Transition Agent 🔄
- **Path**: `.agent/agents/business_transition_agent/AGENT.md`
- **Description**: Business cessation, pivot to new business, loss carry-forward (Similar Business Test), ATO payment negotiation
- **Priority**: CRITICAL
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 50-200 PTS
- **Trigger**: `/business-transition` workflow

### 15. Accountant Report Generator 📧
- **Path**: `.agent/agents/accountant_report_generator/AGENT.md`
- **Description**: Generate professional reports (Google Docs/Sheets) and send directly to accountant via Gmail
- **Priority**: HIGH
- **Bound Skills**: `google_workspace_integration`, `australian_tax_law_research`
- **Fuel Cost**: 30-100 PTS
- **Trigger**: `/send-to-accountant` workflow

### 16. Xero Connector 🔗
- **Path**: `.agent/agents/xero_connector/AGENT.md`
- **Description**: End-to-end Xero OAuth 2.0 connection setup and troubleshooting
- **Priority**: CRITICAL
- **Bound Skills**: `xero_connection_management`, `xero_api_integration`
- **Fuel Cost**: 50-200 PTS
- **Trigger**: `/xero-setup` workflow

### 17. Senior Product Manager 🛡️
- **Path**: `.agent/agents/senior_product_manager/AGENT.md`
- **Description**: Multi-disciplinary tax system integrity officer. CTA Accountant, Tax Lawyer, Senior Engineer with Government tax fraud expertise. Drives complete system overhaul and compliance verification.
- **Priority**: CRITICAL
- **Bound Skills**: `australian_tax_law_research`, `tax_compliance_verification`, `tax_fraud_detection`
- **Fuel Cost**: 100-500 PTS
- **Trigger**: `/system-overhaul` workflow

### 18. Amendment Period Tracker ⏰
- **Path**: `.agent/agents/amendment_period_tracker/AGENT.md`
- **Description**: Tracks amendment period windows for each entity and financial year under s 170 TAA 1953, generates countdown alerts before expiry, and identifies amendment opportunities
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `historical_trend_analysis`
- **Fuel Cost**: 20-60 PTS
- **Trigger**: `/compliance-monitoring` workflow

### 19. Client Onboarding Agent 🚀
- **Path**: `.agent/agents/client_onboarding_agent/AGENT.md`
- **Description**: Guides new users through Xero connection, data sync, quality check, first forensic scan, and results walkthrough
- **Priority**: CRITICAL
- **Bound Skills**: `xero_connection_management`, `xero_api_integration`
- **Fuel Cost**: 20-80 PTS
- **Trigger**: `/new-client-setup` workflow

### 20. Compliance Calendar Agent 📅
- **Path**: `.agent/agents/compliance_calendar_agent/AGENT.md`
- **Description**: Tracks entity-type-aware tax compliance deadlines, generates automated alerts for BAS, PAYG, SG, lodgement, and amendment period expiry
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `ato_rate_scraping`
- **Fuel Cost**: 15-60 PTS
- **Trigger**: `/compliance-monitoring` workflow

### 21. Data Quality Agent 🔍
- **Path**: `.agent/agents/data_quality_agent/AGENT.md`
- **Description**: Detects Xero data quality issues including GL misclassifications, duplicate transactions, reconciliation gaps, and missing data affecting tax analysis accuracy
- **Priority**: HIGH
- **Bound Skills**: `xero_api_integration`, `australian_tax_law_research`, `abn_entity_lookup`
- **Fuel Cost**: 30-100 PTS
- **Trigger**: `/tax-audit` workflow (pre-step)

### 22. Foreign Entity Tax Specialist 🌏
- **Path**: `.agent/agents/foreign_entity_tax_specialist/AGENT.md`
- **Description**: International entity tax rules including CFC, transfer pricing (Division 815), foreign income tax offsets, and thin capitalisation
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 40-150 PTS
- **Trigger**: `/multi-entity-analysis` workflow

### 23. Multi-Entity Consolidator 🏢
- **Path**: `.agent/agents/multi_entity_consolidator/AGENT.md`
- **Description**: Consolidates tax analysis across multiple Xero organisations, handles intercompany eliminations, and produces group-level compliance reports
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`, `abn_entity_lookup`
- **Fuel Cost**: 60-200 PTS
- **Trigger**: `/multi-entity-analysis` workflow

### 24. Non-Profit Tax Specialist 🏛️
- **Path**: `.agent/agents/non_profit_tax_specialist/AGENT.md`
- **Description**: Charitable and non-profit organisation tax rules including DGR status, income tax exemptions, FBT rebates, and GST concessions
- **Priority**: MEDIUM
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 30-100 PTS

### 25. PAYG Instalment Advisor 💰
- **Path**: `.agent/agents/payg_instalment_advisor/AGENT.md`
- **Description**: PAYG instalment strategy optimisation — amount vs rate method, variation penalty risk (85% safe harbour), GDP-adjusted calculation
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `payg_instalment_optimization`
- **Fuel Cost**: 30-90 PTS
- **Trigger**: `/payg-review` workflow
- **Engine**: `lib/analysis/payg-instalment-engine.ts`

### 26. Payroll Tax Optimizer 👥
- **Path**: `.agent/agents/payroll_tax_optimizer/AGENT.md`
- **Description**: Multi-state payroll tax compliance across all 8 Australian jurisdictions — thresholds, grouping provisions, contractor deeming, mental health levies
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `payroll_tax_analysis`, `abn_entity_lookup`, `xero_api_integration`
- **Fuel Cost**: 50-150 PTS
- **Trigger**: `/payroll-tax` workflow
- **Engine**: `lib/analysis/payroll-tax-engine.ts`

### 27. PSI Classifier 📋
- **Path**: `.agent/agents/psi_classifier/AGENT.md`
- **Description**: Personal services income determination under Division 84-87 ITAA 1997 — 80% rule, four PSB tests, attribution rules, deduction restrictions
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `psi_classification`, `xero_api_integration`, `abn_entity_lookup`
- **Fuel Cost**: 30-100 PTS
- **Trigger**: `/psi-check` workflow
- **Engine**: `lib/analysis/psi-engine.ts`

### 28. Rate Change Monitor 📡
- **Path**: `.agent/agents/rate_change_monitor/AGENT.md`
- **Description**: Monitors ATO rate publications for changes to corporate tax, Division 7A benchmark, SG, FBT, instant asset write-off, and other rates. Triggers reanalysis when rates change.
- **Priority**: CRITICAL
- **Bound Skills**: `ato_rate_scraping`, `australian_tax_law_research`, `legislative_change_monitoring`
- **Fuel Cost**: 20-80 PTS
- **Trigger**: `/compliance-monitoring` workflow

### 29. Superannuation Specialist 🏦
- **Path**: `.agent/agents/superannuation_specialist/AGENT.md`
- **Description**: Superannuation cap management — concessional/non-concessional limits, Division 293, carry-forward unused caps (5-year window), SG quarterly compliance
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `xero_api_integration`
- **Fuel Cost**: 40-120 PTS
- **Engine**: `lib/analysis/superannuation-cap-analyzer.ts`

### 31. Audit Risk Assessor 🎯
- **Path**: `.agent/agents/audit_risk_assessor/AGENT.md`
- **Description**: Evaluates ATO audit likelihood using industry benchmarks, transaction patterns, and compliance focus areas. Benchmarks are descriptive only.
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `audit_risk_benchmarking`, `xero_api_integration`
- **Fuel Cost**: 30-100 PTS
- **Trigger**: `/audit-risk` workflow
- **Engine**: `lib/analysis/audit-risk-engine.ts`

### 32. Cash Flow Forecast Agent 📊
- **Path**: `.agent/agents/cashflow_forecast_agent/AGENT.md`
- **Description**: Projects future tax obligations and cash flow requirements, identifies negative cash position risks, recommends cash reserves
- **Priority**: HIGH
- **Bound Skills**: `australian_tax_law_research`, `cashflow_forecasting`, `xero_api_integration`, `historical_trend_analysis`
- **Fuel Cost**: 30-100 PTS
- **Trigger**: `/cashflow-forecast` workflow
- **Engine**: `lib/analysis/cashflow-forecast-engine.ts`

### 30. Senior Project Manager (Enhanced) 🎯
- **Path**: `.agent/agents/senior_project_manager_enhanced/AGENT.md`
- **Description**: Validates incoming ideas from work queue, assesses feasibility and complexity, detects Linear duplicates, assigns priority, and routes to domain agents
- **Priority**: CRITICAL
- **Bound Skills**: `australian_tax_law_research`, `tax_compliance_verification`
- **Fuel Cost**: 50-150 PTS
- **Trigger**: Idea intake pipeline (`/validate-queue`)

## Available Skills

| Skill | Path | Purpose |
|-------|------|---------|
| `australian_tax_law_research` | `.agent/skills/australian_tax_law_research/SKILL.md` | ATO legislation and ruling research |
| `xero_api_integration` | `.agent/skills/xero_api_integration/SKILL.md` | Read-only Xero data access |
| `xero_connection_management` | `.agent/skills/xero_connection_management/SKILL.md` | Xero OAuth setup and maintenance |
| `simple_report_export` | `.agent/skills/simple_report_export/SKILL.md` | PDF/Excel export + Gmail (no Cloud needed) |
| `google_workspace_integration` | `.agent/skills/google_workspace_integration/SKILL.md` | Full Google Workspace (requires Cloud setup) |
| `notebook_lm_research` | `.agent/skills/notebook_lm_research/SKILL.md` | Deep document analysis |
| `google_slides_storyboard` | `.agent/skills/google_slides_storyboard/SKILL.md` | Presentation automation |
| `image_generation` | `.agent/skills/image_generation/SKILL.md` | Visual asset creation |
| `video_generation` | `.agent/skills/video_generation/SKILL.md` | Motion graphics creation |
| `tax_compliance_verification` | `.agent/skills/tax_compliance_verification/SKILL.md` | Tax calculation and rate verification |
| `tax_fraud_detection` | `.agent/skills/tax_fraud_detection/SKILL.md` | Part IVA anti-avoidance and fraud detection |
| `abn_entity_lookup` | `.agent/skills/abn_entity_lookup/SKILL.md` | ABR API entity validation and GST status check |
| `ato_rate_scraping` | `.agent/skills/ato_rate_scraping/SKILL.md` | Scrape ATO website for current tax rates via Jina AI |
| `historical_trend_analysis` | `.agent/skills/historical_trend_analysis/SKILL.md` | Multi-year transaction trend analysis for forecasting |
| `rnd_eligibility_assessment` | `.agent/skills/rnd_eligibility_assessment/SKILL.md` | R&D Tax Incentive four-element test evaluation |
| `pdf_report_generation` | `.agent/skills/pdf_report_generation/SKILL.md` | Generate PDF reports from analysis results |
| `email_delivery` | `.agent/skills/email_delivery/SKILL.md` | Send reports and alerts via email/Gmail |
| `legislative_change_monitoring` | `.agent/skills/legislative_change_monitoring/SKILL.md` | Monitor ATO legislative updates and budget announcements |
| `idea_intake_workflow` | `.agent/skills/idea-intake-workflow/SKILL.md` | Unified idea intake pipeline management |
| `idea_queue_capture` | `.agent/skills/idea-queue-capture/SKILL.md` | Capture ideas into the work queue |
| `work_queue_processor` | `.agent/skills/work-queue-processor/SKILL.md` | Process validated queue items for execution |
| `audit_risk_benchmarking` | `.agent/skills/audit_risk_benchmarking/SKILL.md` | ATO industry benchmark comparison and risk scoring |
| `cashflow_forecasting` | `.agent/skills/cashflow_forecasting/SKILL.md` | Tax obligation projection and cash reserve planning |
| `payroll_tax_analysis` | `.agent/skills/payroll_tax_analysis/SKILL.md` | Multi-state payroll tax compliance (8 jurisdictions) |
| `psi_classification` | `.agent/skills/psi_classification/SKILL.md` | PSI determination and PSB test evaluation (Div 84-87) |
| `payg_instalment_optimization` | `.agent/skills/payg_instalment_optimization/SKILL.md` | PAYG instalment strategy and variation risk analysis |
| `myob_api_integration` | `.agent/skills/myob_api_integration/SKILL.md` | Read-only MYOB API data extraction and normalisation |

## Agent Modes

All agents operate using the three-mode discipline:

### 1. PLANNING Mode
- Analyze mission intent and scope
- Research relevant legislation and data
- Formulate strategy and estimates
- Request user approval before execution

### 2. EXECUTION Mode
- Implement approved strategy
- Extract and analyze data
- Generate findings and recommendations
- Track progress and resources

### 3. VERIFICATION Mode
- Validate findings against legislation
- Perform quality checks
- Flag items requiring professional review
- Deliver final output

## Workflows

| Workflow | Description |
|----------|-------------|
| `/scout` | Proactive opportunity discovery and deadline alerting |
| `/tax-audit` | Comprehensive Xero data analysis |
| `/rnd-assessment` | R&D Tax Incentive eligibility evaluation |
| `/deduction-scan` | Identify unclaimed deductions |
| `/loss-analysis` | Review carry-forward loss position |
| `/bad-debt-scan` | Identify bad debts for tax deduction and GST recovery |
| `/business-transition` | Business closure, pivot, loss carry-forward, ATO negotiation |
| `/send-to-accountant` | Generate reports and email directly to accountant |
| `/content-orchestrator` | Generate reports and presentations |
| `/system-overhaul` | Complete tax system integrity overhaul and verification |
| `/compliance-monitoring` | Deadline tracking, rate change monitoring, amendment period alerts |
| `/new-client-setup` | End-to-end onboarding: Xero connect, data sync, first scan |
| `/multi-entity-analysis` | Group consolidation, intercompany elimination, cross-entity compliance |
| `/xero-setup` | Xero OAuth 2.0 connection setup and troubleshooting |
| `/grant-accelerator` | Federal, state, and local government grant discovery and application |
| `/idea-intake` | Capture, validate, prioritise, and route ideas to domain agents |
| `/audit-risk` | ATO audit risk benchmarking and compliance focus area assessment |
| `/cashflow-forecast` | Tax obligation cash flow projection and reserve planning |
| `/payroll-tax` | Multi-state payroll tax analysis across 8 jurisdictions |
| `/psi-check` | Personal services income determination (Division 84-87) |
| `/payg-review` | PAYG instalment optimisation — amount vs rate method analysis |
| `/abn-lookup` | Entity validation via Australian Business Register API |

## Key Deliverables

### 1. Tax Audit Report
- Complete Xero data analysis
- Identified misclassifications
- Recommended corrections
- Priority-ranked action items

### 2. R&D Tax Incentive Assessment
- Eligible activities identified
- Expenditure quantification
- Registration guidance
- Estimated refund calculation

### 3. Deduction Optimization Plan
- Unclaimed deductions identified
- Correct categorization recommendations
- Supporting documentation requirements

### 4. Loss Recovery Analysis
- Historical loss carry-forward status
- Personal capital contribution treatment
- Division 7A compliance assessment
- Recommended tax position adjustments

## Compliance Requirements

### Read-Only Operation
All agents operate in read-only mode:
- ❌ NO modifications to Xero data
- ❌ NO ATO filings or submissions
- ✅ Analysis and recommendations only
- ✅ All changes require user implementation

### Professional Review
All recommendations should be reviewed by:
- Registered Tax Agent
- Chartered Accountant
- Tax Lawyer (for complex matters)

### Citation Standards
Every recommendation includes:
- Specific legislation reference
- ATO ruling or guidance reference
- Financial year applicability
- Deadline dates for time-sensitive claims

## Financial Years in Scope

| FY | Period | Status |
|----|--------|--------|
| FY2021-22 | 1 Jul 2021 - 30 Jun 2022 | Amendable (limited) |
| FY2022-23 | 1 Jul 2022 - 30 Jun 2023 | Amendable |
| FY2023-24 | 1 Jul 2023 - 30 Jun 2024 | Amendable |
| FY2024-25 | 1 Jul 2024 - 30 Jun 2025 | Current |
| FY2025-26 | 1 Jul 2025 - 30 Jun 2026 | Future |

## Adding New Agents

To add a new agent:

1. Create directory: `.agent/agents/<agent_name>/`
2. Create `AGENT.md` with YAML frontmatter:
```yaml
---
name: agent-name
description: Clear description for agent discovery
capabilities: [list, of, capabilities]
bound_skills: [skill_1, skill_2]
default_mode: PLANNING
---
```
3. Define execution patterns and workflows
4. Register in this `AGENTS.md` file
