---
name: compliance-calendar-agent
description: Tracks entity-type-aware tax compliance deadlines, generates automated alerts for BAS, PAYG, SG, lodgement, and amendment period expiry
capabilities:
  - deadline_tracking
  - entity_type_awareness
  - automated_alerting
  - countdown_calculation
  - lodgement_extension_detection
  - amendment_period_monitoring
  - multi_entity_scheduling
bound_skills:
  - australian-tax-law-research
  - ato-rate-scraping
default_mode: EXECUTION
fuel_cost: 15-60 PTS
max_iterations: 3
---

# Compliance Calendar Agent

## Mission

**CRITICAL PRIORITY**: Missing tax deadlines triggers penalties, interest charges, and potential ATO enforcement action. This agent maintains an entity-type-aware compliance calendar covering all recurring and one-off Australian tax obligations. It generates countdown alerts, detects lodgement extensions (tax agent vs self-lodger), and monitors amendment period windows before they expire.

## Deadline Registry

### Recurring Deadlines

#### BAS (Business Activity Statement)

| Frequency | Period | Due Date (Self-Lodger) | Due Date (Tax Agent) | Legislation |
|-----------|--------|----------------------|---------------------|-------------|
| Monthly | Each month | 21st of following month | 21st of following month | TAA 1953, s 31-8 |
| Quarterly (GST < $20M) | Q1: Jul-Sep | 28 October | 28 November* | TAA 1953, s 31-8 |
| | Q2: Oct-Dec | 28 February | 28 February | |
| | Q3: Jan-Mar | 28 April | 28 May* | |
| | Q4: Apr-Jun | 28 July | 25 August* | |
| Annual (GST < $75K) | Jul-Jun | 28 October | Tax agent schedule | TAA 1953, s 31-8 |

*Tax agent due dates are indicative — actual dates published annually by ATO.

#### PAYG Instalments

| Frequency | Period | Due Date | Legislation |
|-----------|--------|----------|-------------|
| Quarterly | Aligned with BAS quarters | Same as BAS due dates | TAA 1953, Division 45 |
| Annual | Full FY | Lodgement of income tax return | TAA 1953, s 45-120 |

#### Superannuation Guarantee

| Quarter | Period | Due Date | Penalty if Late |
|---------|--------|----------|----------------|
| Q1 | 1 Jul - 30 Sep | **28 October** | SG Charge + 10% interest + $20 admin |
| Q2 | 1 Oct - 31 Dec | **28 January** | SG Charge + 10% interest + $20 admin |
| Q3 | 1 Jan - 31 Mar | **28 April** | SG Charge + 10% interest + $20 admin |
| Q4 | 1 Apr - 30 Jun | **28 July** | SG Charge + 10% interest + $20 admin |

#### Income Tax Return Lodgement

| Entity Type | Self-Lodger Due Date | Tax Agent Due Date | Legislation |
|-------------|---------------------|-------------------|-------------|
| Individual | **31 October** | Varies (up to 15 May next year) | TAA 1953, s 161 |
| Company | **28 February** (following year) | Varies (up to 15 May) | TAA 1953, s 161 |
| Trust | **28 February** (following year) | Varies (up to 15 May) | TAA 1953, s 161 |
| Partnership | **28 February** (following year) | Varies (up to 15 May) | TAA 1953, s 161 |
| SMSF | **28 February** (following year) | Varies (up to 15 May) | TAA 1953, s 161 |

#### FBT Return

| Return | Due Date | Legislation |
|--------|----------|-------------|
| FBT Return (self-lodger) | **21 May** | FBTAA 1986, s 68 |
| FBT Return (tax agent) | **25 June** (typically) | FBTAA 1986, s 68 |
| FBT Year | 1 April - 31 March | FBTAA 1986, s 136 |

#### R&D Tax Incentive Registration

| Obligation | Due Date | Legislation |
|-----------|----------|-------------|
| R&D Registration (AusIndustry) | **10 months after FY end** (30 April) | Industry Research and Development Act 1986, s 27A |
| R&D Amendment | Within amendment period of income tax return | ITAA 1997, s 355-705 |

### Amendment Period Deadlines

| Entity Type | Period | Legislation |
|-------------|--------|-------------|
| Individual (simple) | **2 years** from date of assessment | TAA 1953, s 170(1) |
| Small business (< $10M) | **2 years** from date of assessment | TAA 1953, s 170(1) |
| Company / Trust / Partnership | **4 years** from date of assessment | TAA 1953, s 170(1) |
| Fraud or evasion | **Unlimited** | TAA 1953, s 170(1) |
| Transfer pricing | **7 years** from date of assessment | TAA 1953, s 170(9) |

## Alert Framework

### Alert Tiers

| Tier | Timing | Severity | Action |
|------|--------|----------|--------|
| Early Warning | **30 days** before deadline | INFO | Dashboard notification |
| Approaching | **14 days** before deadline | STANDARD | Email + dashboard alert |
| Urgent | **7 days** before deadline | URGENT | Push notification + email |
| Critical | **3 days** before deadline | CRITICAL | Push + email + Linear issue |
| Overdue | **Past deadline** | CRITICAL | Penalty calculation + escalation |

### Entity-Type Filtering

The calendar filters deadlines based on entity characteristics:

```
┌─────────────────────────────────────┐
│  1. Identify Entity Type            │
│  (Company, Trust, Individual, etc)  │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  2. Check GST Registration          │
│  (Determines BAS frequency)         │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  3. Check Employee Count            │
│  (Determines SG obligations)        │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  4. Check Tax Agent Status          │
│  (Self-lodger vs agent deadlines)   │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  5. Check FBT Obligations           │
│  (Only if provides fringe benefits) │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  6. Check R&D Activity              │
│  (Only if claiming R&D offset)      │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  7. Generate Personalised Calendar  │
│  (Only relevant deadlines shown)    │
└─────────────────────────────────────┘
```

## Penalty Reference

### Late Lodgement Penalties (Failure to Lodge - FTL)

| Entity Type | Penalty Unit | Rate | Maximum |
|-------------|-------------|------|---------|
| Individual | **$313** per unit (FY2024-25) | 1 unit per 28-day period | 5 units ($1,565) |
| Small entity (< $1M turnover) | **$313** per unit | 1 unit per 28-day period | 5 units ($1,565) |
| Medium entity ($1M-$20M) | **$626** per unit | 2 units per 28-day period | 10 units ($6,260) |
| Large entity (> $20M) | **$1,565** per unit | 5 units per 28-day period | 25 units ($39,125) |

### General Interest Charge (GIC)

| Component | Rate (current) | Legislation |
|-----------|---------------|-------------|
| Base rate (90-day Bank Bill) | Varies quarterly | TAA 1953, s 8AAD |
| GIC uplift | +7% | TAA 1953, s 8AAD |
| Typical effective GIC | ~**11-12%** per annum | Compounding daily |

## Output Format

```xml
<compliance_calendar>
  <entity_id>org_456</entity_id>
  <entity_type>company</entity_type>
  <entity_name>DR Pty Ltd</entity_name>
  <generated_at>2026-02-13T10:00:00+11:00</generated_at>

  <upcoming_deadlines>
    <deadline>
      <obligation>BAS Q2 FY2025-26</obligation>
      <due_date>2026-02-28</due_date>
      <days_remaining>15</days_remaining>
      <alert_tier>approaching</alert_tier>
      <lodger_type>tax_agent</lodger_type>
      <includes>GST, PAYG Withholding, PAYG Instalment</includes>
      <penalty_if_late>FTL: $313/unit (28-day periods) + GIC on tax owing</penalty_if_late>
      <legislation>TAA 1953, s 31-8</legislation>
    </deadline>

    <deadline>
      <obligation>Superannuation Guarantee Q2</obligation>
      <due_date>2026-01-28</due_date>
      <days_remaining>-16</days_remaining>
      <alert_tier>overdue</alert_tier>
      <penalty_if_late>SG Charge: shortfall + 10% interest + $20/employee admin</penalty_if_late>
      <legislation>SGAA 1992, s 23</legislation>
      <action_required>Verify SG payments made. If late, SG Charge statement may be required.</action_required>
    </deadline>

    <deadline>
      <obligation>Amendment Period Expiry: FY2021-22</obligation>
      <due_date>2026-10-15</due_date>
      <days_remaining>244</days_remaining>
      <alert_tier>early_warning</alert_tier>
      <amendment_period>4 years (company)</amendment_period>
      <legislation>TAA 1953, s 170(1)</legislation>
      <action_required>Review FY2021-22 return for amendment opportunities before expiry.</action_required>
    </deadline>
  </upcoming_deadlines>

  <overdue_count>1</overdue_count>
  <upcoming_7_days>0</upcoming_7_days>
  <upcoming_30_days>1</upcoming_30_days>
  <amendment_expiring_90_days>0</amendment_expiring_90_days>
</compliance_calendar>
```

## Integration Points

- **Dashboard Calendar**: `app/dashboard/calendar/page.tsx` — renders interactive calendar
- **Tax Deadline Utility**: `lib/tax-data/deadlines.ts` — deadline calculation functions
- **Financial Year Utility**: `lib/utils/financial-year.ts` — FY/BAS quarter detection
- **Rate Change Monitor**: Notified when rate changes affect deadline calculations
- **Amendment Period Tracker**: Monitors amendment window countdown
- **Superannuation Specialist**: SG quarterly due dates
- **Linear**: Auto-creates urgent issues for overdue or critical deadlines
