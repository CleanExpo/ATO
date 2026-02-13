---
description: Continuous compliance monitoring workflow combining deadline tracking, rate change detection, and amendment period alerts
---

# Compliance Monitoring Workflow

Orchestrates continuous compliance monitoring by coordinating the compliance-calendar-agent, rate-change-monitor, and amendment-period-tracker to provide proactive alerts and prevent missed deadlines or stale calculations.

## Prerequisites

- At least one Xero organisation connected
- Entity type identified (company, trust, individual, partnership, SMSF)
- Tax agent status known (self-lodger vs tax agent managed)
- GST registration status confirmed
- Employee/contractor count available (for SG obligations)

## Workflow Steps

### 1. Initialise Entity Profile

Gather entity characteristics to personalise the compliance calendar.

- Fetch organisation details from Xero (`/api/xero/organizations`)
- Determine entity type from Xero org data or manual configuration
- Check GST registration (from BAS filing history)
- Detect employee count (from payroll data if available)
- Determine tax agent status (from lodgement history)

### 2. Generate Personalised Deadline Calendar

Using the compliance-calendar-agent, produce a filtered calendar showing only relevant deadlines.

- Filter BAS deadlines by frequency (monthly/quarterly/annual)
- Include SG deadlines only if entity has employees
- Include FBT deadlines only if entity has fringe benefit exposure
- Include R&D registration deadline only if R&D claims exist
- Calculate amendment period expiry for each filed FY
- Apply tax agent vs self-lodger due dates

### 3. Schedule Rate Monitoring

Using the rate-change-monitor, set up periodic rate checks.

- Daily check: Fuel tax credit rates (quarterly changes)
- Weekly check: All other rates (annual changes)
- On-demand check: After federal budget announcements
- Post-1-July check: New FY rates (Div 7A benchmark, SG rate, caps)

### 4. Monitor Amendment Windows

Track amendment period countdown for each entity and FY.

- Calculate assessment date for each filed return
- Apply entity-specific amendment period (2 years individual/small biz, 4 years company/trust)
- Generate 90-day, 30-day, and 7-day alerts before expiry
- Flag FYs with identified optimisation opportunities that require amendment

### 5. Generate Alerts

Based on steps 2-4, produce tiered alerts.

- **INFO** (30+ days): Upcoming deadlines, rate publication expected
- **STANDARD** (14 days): Approaching deadline, prepare documentation
- **URGENT** (7 days): Imminent deadline, action required
- **CRITICAL** (3 days or overdue): Penalty risk, immediate action

### 6. Continuous Loop

Re-run steps 2-5 on a schedule:

- Every morning: Check for new alerts, update countdowns
- After Xero sync: Refresh entity profile, detect new obligations
- After rate change: Trigger re-analysis of affected engines
- After return lodgement: Update amendment period start date

## Output

```xml
<compliance_monitoring_report>
  <entity_id>org_456</entity_id>
  <report_date>2026-02-13</report_date>

  <alert_summary>
    <critical>0</critical>
    <urgent>1</urgent>
    <standard>2</standard>
    <info>5</info>
  </alert_summary>

  <rate_status>
    <last_check>2026-02-13T06:00:00+11:00</last_check>
    <changes_since_last_check>0</changes_since_last_check>
    <next_expected_change>Fuel tax credits Q3 (late February 2026)</next_expected_change>
  </rate_status>

  <amendment_windows>
    <expiring_soon>
      <financial_year>FY2021-22</financial_year>
      <expires>2026-10-15</expires>
      <days_remaining>244</days_remaining>
      <has_optimisation_opportunities>true</has_optimisation_opportunities>
    </expiring_soon>
  </amendment_windows>

  <next_deadlines>
    <deadline type="BAS_Q2" due="2026-02-28" days="15" />
    <deadline type="SG_Q3" due="2026-04-28" days="74" />
    <deadline type="FBT_RETURN" due="2026-05-21" days="97" />
  </next_deadlines>
</compliance_monitoring_report>
```

## Follow-Up Workflows

- `/tax-audit` — Run full audit if amendment window expiring with unreviewed FYs
- `/send-to-accountant` — Generate report for accountant review when deadlines approach
- `/loss-analysis` — Re-analyse losses if amendment period for loss year expiring
