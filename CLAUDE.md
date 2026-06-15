@../Unite-Hub/.portfolio/PORTFOLIO.yaml

<!--
  Reconstructed after UTF-8 corruption (a Windows generation tool baked U+FFFD
  replacement characters into the Jina section). The Identity block and the
  Jina AI guide below were restored verbatim from the clean ancestor commit
  (81529b7, the initial commit) and the registry. The project CONSTITUTION at
  `.claude/memory/CONSTITUTION.md` is the human-only source of truth for rules.
-->

## Identity (SSOT)
**Canonical name:** ATO-APP
**Aliases:** "ATO", "ato-app", "Tax App"
**Canonical local path:** `D:\ATO`
**GitHub:** `CleanExpo/ATO`

> Registry: see `D:\Unite-Hub\.portfolio\PORTFOLIO.yaml` (single source of truth)

---

# Claude AI Integration Guide

## Web Scraping with Jina AI

**IMPORTANT: When asked to visit a site, use Jina AI instead of internal web scraping tools.**

Always use the Jina AI Reader API to actually view and scrape website content:

```bash
curl "https://r.jina.ai/https://www.example.com" \
  -H "Authorization: Bearer $JINA_API_KEY"
```

### Usage
- Replace `https://www.example.com` with the target URL you want to visit
- **Always use Jina AI for viewing pages** - don't use internal web scraping
- The Jina Reader API converts web pages to clean, readable markdown format
- Handles JavaScript-rendered content and returns structured data
- Returns the actual rendered page content, not just HTML source
- Useful for extracting content from documentation sites, articles, and web pages

### Example
```bash
# Scrape ATO website
curl "https://r.jina.ai/https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents" \
  -H "Authorization: Bearer $JINA_API_KEY"
```

This will return clean markdown content from the target page without HTML clutter.
