# Gemini AI Integration Guide

## Web Scraping with Jina AI

**IMPORTANT: When asked to visit a site, use Jina AI instead of internal web scraping tools.**

Always use the Jina AI Reader API to actually view and scrape website content for Gemini AI analysis:

```bash
curl "https://r.jina.ai/https://www.example.com" \
  -H "Authorization: Bearer $JINA_API_KEY"
```

### Usage
- Replace `https://www.example.com` with the target URL you want to visit
- **Always use Jina AI for viewing pages** - don't use internal web scraping
- The Jina Reader API converts web pages to clean, readable markdown format
- Returns the actual rendered page content, not just HTML source
- Perfect for feeding scraped content to Gemini AI for analysis
- Handles JavaScript-rendered content and returns structured data

### Integration with Gemini
```typescript
// Example: Scrape and analyze with Gemini
const response = await fetch('https://r.jina.ai/https://www.example.com', {
  headers: {
    'Authorization': 'Bearer $JINA_API_KEY'
  }
});

const scrapedContent = await response.text();

// Send to Gemini for analysis
const result = await geminiModel.generateContent([
  { text: `Analyze this content:\n\n${scrapedContent}` }
]);
```

### Example Use Cases
- Scraping ATO tax guidance for tax rule analysis
- Extracting R&D eligibility criteria from government websites
- Gathering legislation text for Division 355, 8, 7A compliance checks
- Pulling industry-specific deduction guidance

This ensures Gemini receives clean, well-formatted content for accurate tax analysis.
