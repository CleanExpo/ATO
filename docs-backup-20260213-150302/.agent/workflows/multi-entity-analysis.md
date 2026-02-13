---
description: Group-level forensic analysis across multiple Xero organisations with intercompany elimination and consolidated compliance reporting
---

# Multi-Entity Analysis Workflow

Orchestrates tax analysis across all organisations in an organisation group, detects intercompany transactions, performs cross-entity compliance checks, and produces a consolidated group report.

## Prerequisites

- Organisation group created with 2+ member organisations
- All member organisations connected via Xero OAuth
- Historical data synced for all members (minimum current FY)
- Per-entity forensic scan completed for each member

## Workflow Steps

### 1. Load Organisation Group

Fetch group configuration and member details.

- Query `organization_groups` table for group definition
- Load all member organisations with entity types
- Map ownership structure (parent/subsidiary, trust/trustee)
- Identify primary entity (main operating entity)

*Agent: multi-entity-consolidator*

### 2. Per-Entity Analysis Review

Verify each member has been individually analysed.

- Check forensic analysis status for each member
- If any member lacks analysis, trigger individual scan first
- Aggregate per-entity metrics (revenue, expenses, tax position)
- Note entity types for cross-entity rule application

*Agent: multi-entity-consolidator*

### 3. Intercompany Transaction Detection

Identify transactions between group members.

- Match payments/receipts between member entities (same amount, same date, opposite direction)
- Detect director/shareholder payments across entities
- Identify management fee arrangements
- Flag loan balances between entities
- Classify each intercompany flow (operational, loan, distribution, management fee)

*Agent: multi-entity-consolidator*

### 4. Cross-Entity Compliance Checks

Run compliance checks that span multiple entities.

- **Division 7A**: Loans from company to trust/individual within group
- **Payroll tax grouping**: Related bodies corporate sharing threshold
- **CGT connected entity test**: Aggregate net assets across connected entities
- **Trust distributions**: Distribution chain compliance (s 100A)
- **UPE compliance**: Unpaid present entitlements from trust to company
- **Transfer pricing**: Arm's length test on intercompany charges

*Agents: multi-entity-consolidator, payroll-tax-optimizer, trust-distribution-analyzer*

### 5. Consolidated Elimination

Eliminate double-counted items for group-level view.

- Remove intercompany revenue/expense pairs
- Net off intercompany loan balances
- Eliminate intercompany dividends (adjust franking)
- Calculate true group-level tax position

*Agent: multi-entity-consolidator*

### 6. Group Report Generation

Produce consolidated report with cross-entity findings.

- Group-level metrics (consolidated revenue, expenses, net position)
- Per-entity breakdown with entity-specific findings
- Cross-entity findings (Div 7A, payroll tax, CGT grouping)
- Consolidated recommendations ranked by group-level impact
- Amendment opportunities across all entities

*Agent: multi-entity-consolidator, accountant-report-generator*

## Output

```xml
<multi_entity_analysis_complete>
  <group_id>grp_789</group_id>
  <group_name>DR Group</group_name>
  <completed_at>2026-02-13T11:00:00+11:00</completed_at>

  <member_count>3</member_count>
  <intercompany_transactions>45</intercompany_transactions>
  <intercompany_value_eliminated>450000</intercompany_value_eliminated>

  <consolidated_position>
    <group_revenue>2800000</group_revenue>
    <group_expenses>2440000</group_expenses>
    <group_net>360000</group_net>
  </consolidated_position>

  <cross_entity_findings>4</cross_entity_findings>
  <group_opportunity_value>85000</group_opportunity_value>

  <critical_findings>
    <finding>Division 7A loan DR Pty Ltd → DR Family Trust ($180,000)</finding>
    <finding>Payroll tax grouping required (combined wages $2.8M)</finding>
  </critical_findings>
</multi_entity_analysis_complete>
```

## Follow-Up Workflows

- `/send-to-accountant` — Generate consolidated group report for accountant review
- `/compliance-monitoring` — Set up ongoing monitoring for all group members
- `/tax-audit` — Deep-dive into specific cross-entity finding
