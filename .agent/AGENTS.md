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

## Available Skills

| Skill | Path | Purpose |
|-------|------|---------|
| `australian_tax_law_research` | `.agent/skills/australian_tax_law_research/SKILL.md` | ATO legislation and ruling research |
| `xero_api_integration` | `.agent/skills/xero_api_integration/SKILL.md` | Read-only Xero data access |
| `rnd_eligibility_assessment` | `.agent/skills/rnd_eligibility_assessment/SKILL.md` | Division 355 R&D activity assessment |
| `notebook_lm_research` | `.agent/skills/notebook_lm_research/SKILL.md` | Deep document analysis |
| `google_slides_storyboard` | `.agent/skills/google_slides_storyboard/SKILL.md` | Presentation automation |
| `image_generation` | `.agent/skills/image_generation/SKILL.md` | Visual asset creation |
| `video_generation` | `.agent/skills/video_generation/SKILL.md` | Motion graphics creation |

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
| `/tax-audit` | Comprehensive Xero data analysis |
| `/rnd-assessment` | R&D Tax Incentive eligibility evaluation |
| `/deduction-scan` | Identify unclaimed deductions |
| `/loss-analysis` | Review carry-forward loss position |
| `/content-orchestrator` | Generate reports and presentations |

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
