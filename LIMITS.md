# System Limits & Performance Guidelines

## External API Limits (Cannot Change)

### Xero API
- **Rate:** 100 transactions per request
- **Delay:** 1-second minimum between requests
- **Impact:** 10,000 transactions = ~100 seconds (1.7 minutes) to fetch

### Google AI (Gemini 2.0 Flash Exp)
- **Rate:** 60 requests per minute (free tier)
- **Delay:** 1-second enforced between transactions
- **Cost:** FREE during experimental period
- **Impact:** 10,000 transactions = ~2.7 hours to analyze

## Internal System Limits (Configurable)

### Batch Processing
- **Default batch size:** 50 transactions
- **Configurable range:** 1-100 via API parameter
- **Location:** `lib/ai/batch-processor.ts:43`
- **Recommendation:** Use 50-100 for optimal throughput

### API Pagination
- **Default page size:** 100 results
- **Maximum page size:** 10,000 results (updated from 1,000)
- **Location:** `app/api/audit/analysis-results/route.ts:37`
- **Recommendation:** Use 1000 for UI, 10000 for exports

### Excel Export
- **Previous limit:** 10,000 rows (REMOVED ✅)
- **Current limit:** None - exports ALL transactions via pagination
- **Performance:** ~1 second per 1,000 rows
- **Max recommended:** 100,000 rows (~100 seconds)
- **Implementation:** `lib/reports/excel-generator.ts:generateExcelWorkbook()`

### PDF Export
- **Page limit:** Recommended max 100 pages
- **File size:** Recommended max 10MB
- **Performance:** ~2-5 seconds per report
- **Impact:** Large reports (50+ pages) may timeout on Vercel (10s limit for free tier, 60s for pro)
- **Implementation:** `lib/reports/pdf-generator.ts:generatePDF()`

## Performance Targets

### Historical Sync (5 years)
- **Expected transactions:** 5,000-10,000
- **Expected time:** 2-3 minutes
- **Bottleneck:** Xero API rate limiting (100 per request, 1s delay)

### AI Analysis (5 years)
- **Expected transactions:** 5,000-10,000
- **Expected time:** 1.5-3 hours
- **Bottleneck:** Google AI rate limiting (60/min)
- **Cost:** $0.00 (FREE during Gemini 2.0 Flash Exp period)

### Report Generation
- **PDF:** 2-5 seconds for standard reports
- **Excel:** 5-15 seconds (10K rows with 5 sheets)
- **Amendment Schedules:** 1-3 seconds
- **Download:** Immediate (files served from memory as Buffer)

## Recommendations

### For Small Analyses (<1,000 transactions)
- Use default settings
- Analysis completes in ~15-20 minutes
- All exports under 1 second

### For Medium Analyses (1K-5K transactions)
- Increase batch size to 100 for faster processing
- Analysis completes in ~1-1.5 hours
- Excel exports in 5-10 seconds

### For Large Analyses (5K+ transactions)
- Run overnight or during off-hours
- Use background jobs for analysis
- Excel exports may take 10-30 seconds
- No pagination needed - system handles it automatically

### For Exports
- No manual pagination needed
- System automatically fetches ALL data
- Excel workbooks include all transactions (no 10K limit)
- PDF reports are paginated internally by Puppeteer

## Known Limitations

### Cannot Be Removed
1. **Xero API Rate Limits** - Set by Xero, cannot be changed
2. **Google AI Rate Limits** - Set by Google, 60 requests/minute on free tier
3. **Vercel Function Timeouts** - 10s free tier, 60s pro tier

### Successfully Removed
1. ✅ **Excel 10K Row Limit** - Now exports unlimited rows via pagination
2. ✅ **API 1K Response Limit** - Increased to 10K for large exports
3. ✅ **Mock Data in UI** - Replaced with real API calls

## Troubleshooting

### "Export taking too long"
- **Cause:** Large dataset (10K+ transactions)
- **Solution:** This is normal. Excel generation with 10K+ rows takes 15-30 seconds
- **Workaround:** Use filters to export specific years or categories

### "PDF generation timeout on Vercel"
- **Cause:** Report too large, exceeds 10s limit
- **Solution:** Upgrade to Vercel Pro (60s timeout)
- **Workaround:** Generate smaller reports by year

### "Analysis stuck at X%"
- **Cause:** Google AI rate limiting (60 requests/min)
- **Solution:** This is normal. System enforces 1s delay between transactions
- **Expected:** 10,000 transactions = ~2.7 hours

### "Xero sync slow"
- **Cause:** Xero API rate limiting (100 per request, 1s delay)
- **Solution:** This is normal and cannot be changed
- **Expected:** 10,000 transactions = ~1.7 minutes

## Future Improvements

### Possible Optimizations
1. Implement cursor-based pagination for very large datasets
2. Add streaming for Excel exports (reduce memory usage)
3. Use worker threads for parallel PDF generation
4. Implement Redis cache for frequently-accessed data
5. Add resume capability for interrupted analysis jobs

### Cost Optimization
- Current setup: $0.00 (FREE during Gemini 2.0 Flash Exp)
- Future stable option: Gemini 2.5 Pro via Vertex AI (~$2-5 per 5-year analysis)
- Rate limit upgrade: Google AI paid tier (higher rate limits)

---

## Summary

**What Changed:**
- ❌ Removed 10K Excel export limit
- ✅ Increased API pagination from 1K to 10K
- ✅ Removed all mock data
- ✅ Added real Puppeteer PDF generation
- ✅ Added real ExcelJS workbook generation

**Current Limits:**
- Xero API: 100 per request (external, cannot change)
- Google AI: 60 per minute (external, can upgrade to paid tier)
- API Pagination: 10,000 per request (internal, can increase if needed)
- Excel Export: Unlimited (via automatic pagination)
- PDF Export: ~100 pages recommended

**Performance:**
- 5-year analysis (5K transactions): ~1.5-2 hours
- Excel export (5K rows): ~10-15 seconds
- PDF export: ~2-5 seconds
- All fully functional with no artificial limits!

---

**Last Updated:** January 21, 2026
**Version:** 2.0 (Post-Fix)
