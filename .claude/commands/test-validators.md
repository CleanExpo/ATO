---
name: test-validators
description: Run all validators against test data to ensure they work
hint: Test all validators with sample data
tools: [Bash, Write]
model_invocable: true
context_fork: false
---

# Validator Test Suite

## Purpose
Run all validators with both valid and invalid test data to ensure they work correctly and catch issues.

## Test Strategy

For each validator:
1. Create valid test data (should pass)
2. Create invalid test data (should fail with clear errors)
3. Test edge cases (boundary conditions)
4. Verify log output is correct
5. Confirm fix instructions are actionable

## Validators to Test

1. **CSV Validator** - Test CSV structure, duplicates, data types
2. **Xero Data Validator** - Test API response schema
3. **Tax Calculation Validator** - Test R&D offset (43.5%), tax rates
4. **R&D Eligibility Validator** - Test Division 355 four-element test
5. **Deduction Validator** - Test eligibility rules, amounts
6. **Loss Validator** - Test loss carry-forward calculations
7. **Division 7A Validator** - Test interest rates (8.77%)
8. **Financial Year Validator** - Test FY format, date ranges
9. **Data Integrity Validator** - Test cross-year consistency
10. **Report Structure Validator** - Test report completeness

## Test Cases

### Tax Calculation Validator

**Valid Test (should pass)**:
```json
{
  "eligible_expenditure": 100000,
  "rnd_offset": 43500,
  "calculation_type": "rnd"
}
```

**Invalid Test (should fail)**:
```json
{
  "eligible_expenditure": 100000,
  "rnd_offset": 40000,
  "calculation_type": "rnd"
}
```
Expected error: "R&D offset calculation incorrect: $40,000 ≠ $43,500 (100,000 × 43.5%)"

### R&D Eligibility Validator

**Valid Test (should pass)**:
```json
{
  "outcome_unknown": true,
  "systematic_approach": true,
  "new_knowledge": true,
  "scientific_method": true,
  "confidence": 85
}
```

**Invalid Test (should fail)**:
```json
{
  "outcome_unknown": true,
  "systematic_approach": true,
  "new_knowledge": true,
  "scientific_method": false,
  "confidence": 85
}
```
Expected error: "Not all Division 355 criteria met"

### CSV Validator

**Valid Test (should pass)**:
```csv
id,date,amount,description
1,2024-01-01,100.00,Test transaction
2,2024-01-02,200.00,Another transaction
```

**Invalid Test (should fail)**:
```csv
id,date,amount,description
1,2024-01-01,100.00,Test transaction
1,2024-01-02,200.00,Duplicate ID
```
Expected error: "Found 1 duplicate transaction IDs"

## Expected Results

All validators should:
- ✅ Exit code 0 for valid data
- ❌ Exit code 1 for invalid data
- 📝 Generate clear error messages
- 🔧 Provide actionable fix instructions
- 📊 Log all attempts with timestamps

## Implementation

```bash
#!/bin/bash

# Run all validator tests
cd .claude/hooks/validators

echo "Testing Tax Calculation Validator..."
echo '{"eligible_expenditure": 100000, "rnd_offset": 43500, "calculation_type": "rnd"}' | python3 tax_calculation_validator.py
if [ $? -eq 0 ]; then
    echo "✅ Valid data passed"
else
    echo "❌ Valid data failed (should have passed!)"
fi

echo '{"eligible_expenditure": 100000, "rnd_offset": 40000, "calculation_type": "rnd"}' | python3 tax_calculation_validator.py
if [ $? -eq 1 ]; then
    echo "✅ Invalid data failed (as expected)"
else
    echo "❌ Invalid data passed (should have failed!)"
fi

# Repeat for all validators...
```

## Usage

```bash
/test-validators
```

## Success Criteria

- 100% of validators catch their respective issues
- All error messages are clear and specific
- All fix instructions are actionable
- All logs are written correctly
- No false positives or false negatives
