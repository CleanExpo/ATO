---
name: legislative-change-monitoring
description: Monitors Australian tax legislative changes including new ATO rulings, Treasury amendments, federal budget announcements, and court decisions that affect tax analysis engines
---

# Legislative Change Monitoring Skill

Tracks changes to Australian tax legislation, ATO rulings, tax determinations, and court decisions that may affect the accuracy of tax analysis engines. Provides structured alerts when changes are detected that require engine updates, rate refreshes, or compliance recalculation.

## When to Use

- Monitoring for new ATO tax rulings (TR) and tax determinations (TD) that affect engine logic
- Detecting federal budget announcements that change tax rates or thresholds
- Tracking Treasury Laws Amendment bills through Parliament
- Identifying court decisions (AAT, Federal Court, High Court) that change interpretation
- Alerting when Division 7A benchmark rate is published for the new FY
- Detecting changes to R&D Tax Incentive eligibility criteria
- Monitoring state government changes to payroll tax rates/thresholds

## Source Registry

### Primary Sources (ATO)

| Source | URL Pattern | Content | Check Frequency |
|--------|------------|---------|----------------|
| ATO Legal Database | `ato.gov.au/law/view` | Tax rulings, determinations | Weekly |
| ATO What's New | `ato.gov.au/about-ato/new-legislation` | New legislation summaries | Weekly |
| ATO Tax Determinations | `ato.gov.au/law/view/document?DocID=TXD/` | Annual rate determinations | Weekly |
| ATO Practice Statements | `ato.gov.au/law/view/document?DocID=PSR/` | ATO interpretation guidance | Monthly |

### Secondary Sources (Government)

| Source | URL Pattern | Content | Check Frequency |
|--------|------------|---------|----------------|
| Federal Register of Legislation | `legislation.gov.au` | Acts, regulations, amendments | Weekly |
| Treasury | `treasury.gov.au` | Exposure drafts, budget papers | Event-driven (budget) |
| Parliament | `aph.gov.au/Parliamentary_Business/Bills` | Bills before Parliament | Weekly |
| AusIndustry (DISER) | `business.gov.au/grants-and-programs` | R&D program updates | Monthly |

### Tertiary Sources (Legal/Professional)

| Source | Content | Check Frequency |
|--------|---------|----------------|
| AustLII | Court decisions (AAT, Federal Court, High Court) | Weekly |
| CPA Australia | Professional guidance, interpretation | Monthly |
| Tax Institute | Technical analysis, member alerts | Monthly |

## Change Categories

### Category 1: Rate Changes (Immediate Impact)

| Change Type | Affected Engine | Action Required |
|------------|----------------|-----------------|
| Div 7A benchmark rate (annual TD) | div7a-engine | Update rate, re-analyse open assessments |
| R&D offset percentage | rnd-engine | Update rate table, recalculate offsets |
| FBT rate | fbt-engine | Update rate, recalculate FBT liabilities |
| SG rate | superannuation-cap-analyzer | Update rate, recalculate SG obligations |
| Fuel tax credit rates (quarterly) | fuel-tax-credits-analyzer | Update quarterly rate table |
| Payroll tax thresholds (per state) | payroll-tax-engine | Update state threshold table |
| IAWO threshold | deduction-engine | Update threshold, reclassify asset purchases |
| CGT discount rate | cgt-engine | Update discount (rare change) |

### Category 2: Rule Changes (Engine Logic Update)

| Change Type | Example | Impact |
|------------|---------|--------|
| New tax ruling (TR) | TR 2024/X on s 100A | Trust distribution analyzer logic update |
| Tax determination (TD) | TD on depreciation effective life | Deduction engine asset table update |
| Legislative amendment | Treasury Laws Amendment Act | Multiple engine updates |
| Court decision overriding ATO view | High Court reversal | Engine logic may need reversal |
| New Division or Section | New incentive program | New engine or skill required |

### Category 3: Deadline Changes (Calendar Update)

| Change Type | Example | Impact |
|------------|---------|--------|
| Lodgement extension | COVID-era extensions | Compliance calendar update |
| New reporting obligation | Country-by-country reporting | New deadline entries |
| Changed due dates | BAS quarterly date shift | Calendar recalculation |

## Monitoring Process

```
1. Scrape Sources
   ├── Use Jina AI Reader for ATO/government pages
   ├── Compare page content against last scrape
   └── Detect new items (rulings, determinations, bills)

2. Classify Change
   ├── Category 1: Rate change → immediate cache invalidation
   ├── Category 2: Rule change → engine update required
   └── Category 3: Deadline change → calendar update

3. Assess Impact
   ├── Which engines are affected?
   ├── Which financial years?
   ├── Which entity types?
   └── How many active analyses need re-running?

4. Generate Alert
   ├── CRITICAL: Immediate rate change affecting live calculations
   ├── HIGH: Rule change requiring engine update within 7 days
   ├── MEDIUM: Upcoming change (bill before Parliament)
   └── INFO: Professional guidance or interpretation update

5. Trigger Actions
   ├── Rate change → rate-change-monitor agent
   ├── Rule change → Linear issue for engine update
   ├── Deadline change → compliance-calendar-agent
   └── All → Log in legislative change register
```

## Alert Severity Matrix

| Change Type | Financial Impact | Severity | Response Time |
|------------|-----------------|----------|---------------|
| Rate change (effective immediately) | Direct calculation error | CRITICAL | Same day |
| Budget announcement (future effective) | Planning impact | HIGH | Within 7 days |
| Bill before Parliament (not yet law) | Preparedness | MEDIUM | Within 30 days |
| ATO ruling (clarification) | Interpretation update | MEDIUM | Within 14 days |
| Court decision (appeal pending) | Uncertain | LOW | Monitor |
| Professional body guidance | Best practice | INFO | As convenient |

## Output Format

```xml
<legislative_change_alert>
  <alert_id>LCA-2026-0213-001</alert_id>
  <detected_at>2026-02-13T08:00:00+11:00</detected_at>
  <severity>high</severity>
  <category>rate_change</category>

  <change>
    <title>Division 7A Benchmark Interest Rate FY2025-26</title>
    <source>ATO Tax Determination TD 2025/X</source>
    <source_url>https://www.ato.gov.au/law/view/document?DocID=TXD/TD2025X</source_url>
    <effective_date>2025-07-01</effective_date>
    <financial_year>FY2025-26</financial_year>
    <description>The Commissioner has determined the Division 7A benchmark interest rate for FY2025-26 is 8.95% (up from 8.77% in FY2024-25).</description>
    <legislation>ITAA 1936, s 109N; TD 2025/X</legislation>
  </change>

  <impact>
    <engines_affected>div7a-engine</engines_affected>
    <entity_types_affected>private_company</entity_types_affected>
    <financial_years_affected>FY2025-26</financial_years_affected>
    <active_analyses_requiring_update>12</active_analyses_requiring_update>
    <calculation_impact>Minimum yearly repayments increase for all Div 7A loans</calculation_impact>
  </impact>

  <actions_required>
    <action priority="immediate">Update Div 7A benchmark rate in cache-manager for FY2025-26</action>
    <action priority="within_7_days">Re-run Div 7A compliance checks for entities with open loans</action>
    <action priority="within_30_days">Update compliance reports showing MYR calculations</action>
  </actions_required>
</legislative_change_alert>
```

## Best Practices

- **Scrape conservatively** — respect rate limits on government websites (max 1 req/10s)
- **Cache page content** — compare against cached version to detect changes, not re-scrape blindly
- **Verify before acting** — rate changes should be confirmed from the official source (ATO Legal Database)
- **Log all changes** — maintain a legislative change register for audit trail
- **Distinguish enacted vs proposed** — bills before Parliament are NOT law until Royal Assent
- **Monitor court appeals** — a Federal Court decision may be overturned on appeal to Full Federal Court or High Court
- **Include effective date** — changes may be announced months before they take effect
- **Cross-reference** — verify ATO rulings against primary legislation (rulings can be withdrawn)
