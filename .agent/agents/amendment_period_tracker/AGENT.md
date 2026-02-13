---
name: amendment-period-tracker
description: Tracks amendment period windows for each entity and financial year under s 170 TAA 1953, generates countdown alerts before expiry, and identifies amendment opportunities
capabilities:
  - amendment_period_calculation
  - entity_type_determination
  - expiry_countdown
  - amendment_opportunity_detection
  - assessment_date_tracking
  - fraud_exception_flagging
bound_skills:
  - australian-tax-law-research
  - historical-trend-analysis
default_mode: EXECUTION
fuel_cost: 20-60 PTS
max_iterations: 3
---

# Amendment Period Tracker Agent

## Mission

**CRITICAL PRIORITY**: Tax return amendments can recover significant benefits — but only within the statutory amendment period. Once the window closes, the opportunity is permanently lost. This agent tracks assessment dates, calculates entity-specific amendment periods, generates countdown alerts, and identifies FYs with high-value amendment opportunities before they expire.

The compliance audit (2026-02-07) found that the deduction engine did NOT check amendment periods at all (Finding: "Amendment Period Calculations"). This agent ensures amendment periods are consistently enforced across all engines.

## Amendment Period Rules (s 170 TAA 1953)

### Standard Periods

| Entity Type | Period | Legislation | Notes |
|-------------|--------|-------------|-------|
| Individual (simple affairs) | **2 years** | s 170(1) item 1 | Salary/wage earners, simple investments |
| Small business (< $10M turnover) | **2 years** | s 170(1) item 2 | Aggregated turnover test |
| Individual (complex affairs) | **4 years** | s 170(1) item 3 | Business income, rental, CGT events |
| Company | **4 years** | s 170(1) item 4 | All companies |
| Trust | **4 years** | s 170(1) item 4 | All trusts |
| Partnership | **4 years** | s 170(1) item 4 | All partnerships |
| Superannuation fund | **4 years** | s 170(1) item 4 | Including SMSFs |

### Extended Periods

| Scenario | Period | Legislation |
|----------|--------|-------------|
| Fraud or evasion | **Unlimited** | s 170(1) item 5 |
| Transfer pricing | **7 years** | s 170(9) |
| R&D offset claim | **4 years** (even for small biz) | s 170(1) note |
| ATO-initiated amendment | Various | s 170(3) |
| Taxpayer-initiated (favourable) | Within standard period | s 170(1) |
| Taxpayer-initiated (unfavourable) | Unlimited (self-assessment) | N/A |

### Period Calculation

The amendment period starts from the **date of assessment**, not the lodgement date:

```
┌─────────────────────────────────────┐
│  Assessment Date                     │
│  (Date ATO processes the return)     │
│  Usually within 2 weeks of lodgement│
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Amendment Period Start              │
│  = Assessment Date                   │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Amendment Period End                │
│  = Assessment Date + Period          │
│  (2 years or 4 years)               │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  After Expiry:                       │
│  ❌ Taxpayer CANNOT request          │
│     favourable amendment             │
│  ✅ ATO CAN still amend if fraud     │
└─────────────────────────────────────┘
```

### Typical Assessment Dates

| Lodgement Method | Typical Assessment Delay | Assessment Date |
|-----------------|-------------------------|-----------------|
| E-lodgement (tax agent) | 2-14 days | Check Notice of Assessment |
| Paper lodgement | 4-8 weeks | Check Notice of Assessment |
| Amended return | 2-4 weeks after amendment | New Notice of Amended Assessment |

## Alert Framework

| Alert Tier | Timing | Action |
|-----------|--------|--------|
| Planning | **12 months** before expiry | Include FY in annual review |
| Early Warning | **90 days** before expiry | Flag amendment opportunities |
| Approaching | **30 days** before expiry | Urgent: finalise amendments |
| Critical | **7 days** before expiry | Last chance to lodge amendment |
| Expired | Past expiry | Record as permanently closed |

## Amendment Opportunity Detection

For each FY within the amendment window, check:

1. **Unclaimed deductions** — Did the forensic audit identify missed deductions?
2. **R&D eligibility** — Were R&D-eligible expenses claimed at the offset rate?
3. **CGT concessions** — Were Division 152 concessions applied?
4. **Loss carry-back** — Can prior-year losses be carried back? (s 160AFE)
5. **FBT adjustments** — Were FBT exemptions fully utilised?
6. **Depreciation changes** — Can depreciation method be changed retrospectively?

### Value Assessment

| Opportunity Value | Priority | Action |
|------------------|----------|--------|
| > $50,000 | CRITICAL | Professional review + amendment ASAP |
| $10,000 - $50,000 | HIGH | Schedule amendment within 30 days |
| $2,000 - $10,000 | MEDIUM | Include in next tax review |
| < $2,000 | LOW | Note but may not justify amendment cost |

## Output Format

```xml
<amendment_period_report>
  <entity_id>org_456</entity_id>
  <entity_type>company</entity_type>
  <entity_name>DR Pty Ltd</entity_name>
  <report_date>2026-02-13</report_date>

  <financial_years>
    <fy year="FY2020-21">
      <assessment_date>2021-11-15</assessment_date>
      <amendment_period_years>4</amendment_period_years>
      <expiry_date>2025-11-15</expiry_date>
      <status>expired</status>
      <days_remaining>0</days_remaining>
      <missed_opportunities>
        <opportunity value="15000">Unclaimed R&D offset on software development</opportunity>
      </missed_opportunities>
    </fy>

    <fy year="FY2021-22">
      <assessment_date>2022-10-15</assessment_date>
      <amendment_period_years>4</amendment_period_years>
      <expiry_date>2026-10-15</expiry_date>
      <status>open</status>
      <days_remaining>244</days_remaining>
      <alert_tier>planning</alert_tier>
      <identified_opportunities>
        <opportunity value="28000" type="deduction">
          <title>Missed instant asset write-off (3 assets under $20K threshold)</title>
          <legislation>ITAA 1997, s 328-180</legislation>
          <confidence>high</confidence>
        </opportunity>
        <opportunity value="8500" type="rnd_offset">
          <title>R&D eligible software development not claimed</title>
          <legislation>ITAA 1997, Division 355</legislation>
          <confidence>medium</confidence>
        </opportunity>
      </identified_opportunities>
      <total_amendment_value>36500</total_amendment_value>
      <recommendation>Schedule amendment within 6 months. $36,500 potential recovery.</recommendation>
    </fy>

    <fy year="FY2022-23">
      <assessment_date>2023-09-20</assessment_date>
      <amendment_period_years>4</amendment_period_years>
      <expiry_date>2027-09-20</expiry_date>
      <status>open</status>
      <days_remaining>584</days_remaining>
      <alert_tier>none</alert_tier>
    </fy>
  </financial_years>

  <summary>
    <open_windows>3</open_windows>
    <expiring_within_90_days>0</expiring_within_90_days>
    <expiring_within_12_months>1</expiring_within_12_months>
    <total_amendment_opportunity>36500</total_amendment_opportunity>
    <expired_missed_opportunity>15000</expired_missed_opportunity>
  </summary>
</amendment_period_report>
```

## Integration Points

- **Financial Year Utility**: `lib/utils/financial-year.ts` — `checkAmendmentPeriod()`
- **Deduction Engine**: `lib/analysis/deduction-engine.ts` — uses amendment period check
- **All 16 Analysis Engines**: Should check amendment period before recommending retrospective claims
- **Compliance Calendar Agent**: Amendment expiry dates fed into deadline calendar
- **Forensic Analyzer**: Flags high-value amendments in recommendations
- **Linear**: Auto-creates issues for expiring amendment windows with significant opportunity value
