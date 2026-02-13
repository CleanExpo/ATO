---
name: show-validation-logs
description: Display recent validation results and failure patterns
hint: Show validation logs for debugging
tools: [Bash, Read]
model_invocable: true
context_fork: false
---

# Validation Observability

## Purpose
View validation results across all validators to identify patterns and failures.

## Workflow
1. List all validation logs in `.claude/hooks/logs/validation_logs/`
2. Parse recent logs (last 24 hours)
3. Summarize:
   - Total validations run
   - Pass/fail ratio per validator
   - Most common failure patterns
   - Agents with validation failures
4. Generate report with actionable insights

## Usage

```bash
/show-validation-logs
```

## Example Output

```
Validation Summary (Last 24 Hours)
===================================
✅ csv_validator: 45/50 passed (90%)
✅ xero_data_validator: 12/12 passed (100%)
❌ rnd_eligibility_validator: 3/8 passed (37.5%)
   - Common issue: Missing "new knowledge" evidence (5 failures)
   - Recommendation: Add more context to R&D transaction descriptions

✅ tax_calculation_validator: 156/160 passed (97.5%)
✅ deduction_validator: 89/89 passed (100%)
✅ loss_validator: 15/15 passed (100%)
✅ div7a_validator: 8/10 passed (80%)
✅ financial_year_validator: 25/25 passed (100%)
✅ data_integrity_validator: 5/5 passed (100%)
✅ report_structure_validator: 2/2 passed (100%)

Total Validations: 370
Overall Pass Rate: 94.3%

Most Common Failures:
1. R&D eligibility - Missing evidence (5 occurrences)
2. Division 7A - Interest rate calculation (2 occurrences)
3. CSV format - Duplicate transaction IDs (5 occurrences)

Recommendations:
- Review R&D transaction descriptions to include more supporting evidence
- Verify Division 7A interest rate calculation logic (should be 8.77% for FY24-25)
- Check for duplicate transaction imports in CSV files
```

## Implementation

This command should:
1. Find all log files in `.claude/hooks/logs/validation_logs/`
2. Filter for today's date or last 24 hours
3. Parse each log file for ✅ PASSED and ❌ FAILED entries
4. Count totals per validator
5. Extract common failure patterns from error messages
6. Generate summary report

## Troubleshooting

**No logs found**:
- Validators haven't been run yet
- Check `.claude/hooks/logs/validation_logs/` directory exists
- Run a validator manually to generate logs

**Old logs showing**:
- Logs are dated by day (YYYYMMDD format)
- Check system date is correct
- Adjust time window in command
