---
name: ato-rate-scraping
description: Automated scraping and extraction of current Australian tax rates from ATO.gov.au and related government sources
---

# ATO Rate Scraping Skill

Extracts current tax rates, thresholds, and benchmarks from official Australian government sources. Uses Jina AI Reader API to convert ATO web pages into structured rate data with full provenance tracking.

## When to Use

- Validating that cached tax rates match current ATO publications
- Detecting quarterly fuel tax credit rate changes
- Confirming annual rate updates (Div 7A benchmark, SG rate, FBT rates)
- Verifying IAWO threshold after federal budget announcements
- Populating rate tables for new financial years
- Cross-checking rate fallback values in analysis engines

## Scraping Method

Use the Jina AI Reader API to fetch and parse ATO pages:

```bash
curl "https://r.jina.ai/https://www.ato.gov.au/[rate-page-path]" \
  -H "Authorization: Bearer $JINA_API_KEY"
```

The Jina Reader converts pages to clean markdown, stripping navigation and ads. Rate tables are preserved as markdown tables for structured extraction.

## Rate Source Registry

### Primary Sources

| Rate | Source URL | Update Schedule | Extraction Pattern |
|------|-----------|----------------|-------------------|
| Individual Tax Brackets | `ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents` | Annual (1 Jul) | Table: Taxable income / Tax on this income |
| Corporate Tax Rate | `ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-tax-rate` | Annual (Budget) | Paragraph: "The full company tax rate is..." |
| Division 7A Benchmark | ATO Tax Determinations (annual) | Annual (before 1 Jul) | TD title: "Income tax: Division 7A benchmark interest rate" |
| Fuel Tax Credits | `ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/incentives-and-concessions/fuel-schemes/fuel-tax-credits-business/rates-all-fuels` | Quarterly | Table: Fuel type / Rate per litre / Period |
| SG Rate | `ato.gov.au/businesses-and-organisations/super-for-employers/how-much-to-pay` | Annual (legislated) | Table: Period / SG rate percentage |
| FBT Rate & Gross-Up | `ato.gov.au/businesses-and-organisations/fringe-benefits-tax` | Annual (1 Apr) | Table: FBT year / Rate / Type 1 / Type 2 |
| IAWO Threshold | `ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business` | Budget announcement | Paragraph: "instant asset write-off threshold" |
| Medicare Levy | `ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy` | Annual (Budget) | Paragraph: "Medicare levy is..." |

### Secondary Sources

| Rate | Source |
|------|--------|
| R&D Tax Offset Rates | `business.gov.au/grants-and-programs/research-and-development-tax-incentive` |
| Payroll Tax Thresholds | State revenue office websites (per-state) |
| CGT Discount | `ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/cgt-discount` |

## Extraction Process

1. **Fetch page** via Jina AI Reader API
2. **Locate rate table** by searching for known headers (e.g., "Taxable income", "Rate per litre")
3. **Parse markdown table** into structured key-value pairs
4. **Validate extracted values** against expected ranges:
   - Tax rates: 0-100%
   - Dollar thresholds: > 0
   - Interest rates: 0-20%
   - Fuel credit rates: $0.00-$1.00 per litre
5. **Compare against cached values** in `lib/tax-data/cache-manager.ts`
6. **Record provenance**: source URL, extraction timestamp, financial year, effective date

## Validation Rules

| Rate Type | Expected Range | Red Flag If |
|-----------|---------------|------------|
| Corporate Tax Rate | 25-30% | < 20% or > 35% |
| R&D Offset | 35-50% | < 30% or > 55% |
| Div 7A Benchmark | 4-12% | < 2% or > 15% |
| SG Rate | 9-15% | < 9% or > 15% |
| FBT Rate | 45-50% | < 40% or > 55% |
| Fuel Credit (per litre) | $0.05-$0.80 | < $0.01 or > $1.00 |
| IAWO Threshold | $1,000-$200,000 | < $1,000 or > $500,000 |
| Medicare Levy | 1-3% | < 1% or > 5% |

Values outside expected ranges should be flagged for manual verification before cache update.

## Output Format

```xml
<rate_scrape_result>
  <source_url>https://www.ato.gov.au/businesses-and-organisations/super-for-employers/how-much-to-pay</source_url>
  <scraped_at>2026-02-13T10:30:00+11:00</scraped_at>
  <scrape_method>jina_ai_reader</scrape_method>
  <rates_extracted>
    <rate>
      <name>Superannuation Guarantee Rate</name>
      <value>0.12</value>
      <display_value>12%</display_value>
      <effective_from>2025-07-01</effective_from>
      <effective_to>2026-06-30</effective_to>
      <financial_year>FY2025-26</financial_year>
      <legislation>SGAA 1992, s 19</legislation>
      <confidence>high</confidence>
    </rate>
  </rates_extracted>
  <validation>
    <in_expected_range>true</in_expected_range>
    <changed_from_cache>true</changed_from_cache>
    <previous_cached_value>0.115</previous_cached_value>
  </validation>
</rate_scrape_result>
```

## Best Practices

- **Always verify** extracted rates against expected ranges before updating cache
- **Never auto-update** rates that fall outside expected ranges — flag for manual review
- **Log every scrape** with full provenance for audit trail (AD-5)
- **Respect rate limits** on ATO.gov.au — maximum 1 request per 10 seconds
- **Cache Jina responses** for 15 minutes to avoid redundant scrapes
- **FY attribution** is mandatory — every rate must specify which financial year it applies to
- **Fallback values** must remain in engine code for resilience — scraping augments, not replaces
