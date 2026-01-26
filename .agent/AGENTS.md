# Australian Tax Optimization (ATO) Agent Fleet

This document defines the autonomous agent fleet for comprehensive Australian tax optimization.

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
