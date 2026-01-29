# Self-Validating Agent System

## Overview
Every agent in the forensic tax audit system automatically validates its work using specialized validators. This creates a deterministic layer of trust that transforms unreliable agents into dependable ones.

## How It Works

### 1. Hooks Trigger Validators
Validators are automatically triggered at key points:
- **After tool use** (Write, Edit) - Validates data immediately after creation/modification
- **Agent completion** (stop) - Validates complete results before finishing
- **Command execution** - Validates outputs of specific commands

### 2. Validators Check Specific Aspects
Each validator is hyper-focused on one aspect of the system:
- **CSV Validator**: File structure, headers, data types, duplicates
- **Xero Data Validator**: API response schema, required fields, pagination
- **Tax Calculation Validator**: R&D offsets (43.5%), tax rates (25%/30%), formulas
- **R&D Eligibility Validator**: Division 355 four-element test compliance
- **Deduction Validator**: Eligibility rules, legislative references
- **Loss Validator**: COT/SBT compliance, carry-forward calculations
- **Division 7A Validator**: Interest rates (8.77%), minimum repayments
- **Financial Year Validator**: FY format, date ranges (July 1 - June 30)
- **Data Integrity Validator**: Cross-year consistency, no duplicates
- **Report Structure Validator**: Completeness, all required sections

### 3. Failures Return Fix Instructions
When validation fails:
1. Validator logs the error with timestamp
2. Provides clear fix instructions to the agent
3. Agent automatically corrects the issue
4. Re-validation occurs
5. Process repeats until validation passes

### 4. Logs Track All Validations
Every validation is logged:
- **Location**: `.claude/hooks/logs/validation_logs/`
- **Format**: `{validator_name}_{YYYYMMDD}.log`
- **Content**: Timestamped entries with pass/fail status

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Agent writes data                                           │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  Hook triggers validator (post_tool_use or stop)             │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  Validator checks data                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Validates structure                               │   │
│  │  • Checks calculations                               │   │
│  │  • Verifies compliance rules                         │   │
│  │  • Scores confidence                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  Validation Result                                           │
│  ┌──────────────┐           ┌──────────────────────────┐    │
│  │ ✅ PASS      │           │ ❌ FAIL                  │    │
│  │ Continue     │           │ Return fix instructions   │    │
│  └──────────────┘           └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Using Validators

### Running a Validator Manually

```bash
# Test with inline data
echo '{"eligible_expenditure": 100000, "rnd_offset": 43500, "calculation_type": "rnd"}' | python3 .claude/hooks/validators/tax_calculation_validator.py

# Test with file
python3 .claude/hooks/validators/csv_validator.py /path/to/file.csv

# View results
cat .claude/hooks/logs/validation_logs/tax_calculation_validator_$(date +%Y%m%d).log
```

### Adding Validators to Commands

Add frontmatter to `.claude/commands/*.md`:

```markdown
---
name: my-command
hooks:
  post_tool_use:
    - tool: Write
      command: python3 {{claude.project_path}}/.claude/hooks/validators/csv_validator.py {{tool.args.file_path}}
      once: false
---
```

### Adding Validators to Agents

Add frontmatter to `.claude/agents/*.md`:

```markdown
---
name: my-agent
hooks:
  post_tool_use:
    - tool: Write
      command: python3 {{claude.project_path}}/.claude/hooks/validators/rnd_eligibility_validator.py {{tool.args.file_path}}
  stop:
    - command: python3 {{claude.project_path}}/.claude/hooks/validators/tax_calculation_validator.py
---
```

### Adding Validators to Skills

Add frontmatter to `.claude/skills/*/skill.md`:

```markdown
---
hooks:
  post_tool_use:
    - tool: Write
      command: python3 {{claude.project_path}}/.claude/hooks/validators/report_structure_validator.py {{tool.args.file_path}}
---
```

## Creating New Validators

### 1. Copy the Template

```bash
cp .claude/hooks/validators/_validator_template.py .claude/hooks/validators/my_new_validator.py
```

### 2. Implement Validation Logic

```python
def validate(data: Any) -> Dict[str, Any]:
    issues = []
    warnings = []

    # Your validation logic here
    if some_check_fails:
        issues.append("Description of the issue")

    if some_warning_condition:
        warnings.append("Warning message")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "fix_instructions": generate_fix_instructions(issues) if issues else None
    }
```

### 3. Add Fix Instructions

```python
def generate_fix_instructions(issues: List[str]) -> str:
    instructions = ["Resolve these validation errors:"]
    for issue in issues:
        if "specific error" in issue.lower():
            instructions.append(f"- {issue} → How to fix it")
    return "\n".join(instructions)
```

### 4. Test Your Validator

```bash
# Test with valid data (should exit 0)
echo '{"valid": "data"}' | python3 .claude/hooks/validators/my_new_validator.py
echo $?  # Should print 0

# Test with invalid data (should exit 1)
echo '{"invalid": "data"}' | python3 .claude/hooks/validators/my_new_validator.py
echo $?  # Should print 1
```

## Validation Observability

### View Recent Validation Logs

```bash
# List all validation logs
ls -lah .claude/hooks/logs/validation_logs/

# View today's logs for a specific validator
cat .claude/hooks/logs/validation_logs/rnd_eligibility_validator_$(date +%Y%m%d).log

# View all logs for today
grep -h "✅\|❌" .claude/hooks/logs/validation_logs/*_$(date +%Y%m%d).log
```

### Monitor Validation Pass/Fail Rates

Use the `/show-validation-logs` command (to be implemented) to see:
- Total validations run
- Pass/fail ratio per validator
- Most common failure patterns
- Agents with validation failures

## Benefits

### Before Self-Validation
- ❌ Hope agents got it right
- ❌ Manual spot-checking required
- ❌ Errors discovered late
- ❌ Low confidence (~60-70%)
- ❌ Time wasted on incorrect analyses

### After Self-Validation
- ✅ Know agents got it right
- ✅ Automatic validation at every step
- ✅ Errors caught immediately
- ✅ High confidence (~90-95%)
- ✅ Time saved on reliable analyses

## Troubleshooting

### Validator Fails Repeatedly

**Problem**: Validator keeps failing on the same issue.

**Solution**:
1. Check input data format matches validator expectations
2. Review validator code for bugs
3. Verify fix instructions are actionable
4. Consider if validation rule is too strict

### Hook Doesn't Trigger

**Problem**: Validator never runs even though hook is configured.

**Solution**:
1. Verify frontmatter syntax is correct
2. Check tool name matches exactly (Write, Edit, etc.)
3. Ensure validator file path is correct
4. Test validator manually to confirm it works

### No Log Output

**Problem**: Validation runs but no logs appear.

**Solution**:
1. Check LOG_DIR permissions
2. Verify `.claude/hooks/logs/validation_logs/` directory exists
3. Run validator manually and check stderr

### Python ModuleNotFoundError

**Problem**: Validator fails with "No module named X".

**Solution**:
1. Ensure Python 3 is installed
2. Install required modules: `pip install [module]`
3. Use virtual environment if needed

## Philosophy

> **"Specialized self-validation. Each validator does one thing extraordinarily well."**

A focused agent with specialized validation will outperform an unfocused agent without validation 100% of the time.

## Integration with Forensic Audit System

Every phase of the forensic tax audit system uses validators:

| Phase | Validators Used | Purpose |
|-------|----------------|---------|
| **Historical Data Fetch** | `xero_data_validator`, `financial_year_validator` | Ensure API responses valid, FY ranges correct |
| **Data Caching** | `data_integrity_validator` | Check cross-year consistency |
| **AI Analysis** | `tax_calculation_validator` | Validate confidence scores, calculations |
| **R&D Engine** | `rnd_eligibility_validator`, `tax_calculation_validator` | Division 355 compliance, offset calculations |
| **Deduction Engine** | `deduction_validator` | Eligibility rules, claimable amounts |
| **Loss Engine** | `loss_validator` | COT/SBT compliance, utilization tracking |
| **Division 7A Engine** | `div7a_validator` | Interest rates, repayment schedules |
| **Report Generation** | `report_structure_validator`, `tax_calculation_validator` | Completeness, accuracy |

## Trust Equation

```
Trust = (Validation Coverage × Validator Accuracy) / (Agent Complexity × Error Impact)

Without validation: Trust ≈ 60-70% (vibe coding)
With specialized validation: Trust ≈ 90-95% (deterministic guarantees)
```

## Next Steps

1. **Add hooks to your commands** - Start with critical data operations
2. **Monitor validation logs** - Check pass/fail rates regularly
3. **Create custom validators** - Add domain-specific validation for your use case
4. **Iterate on fix instructions** - Make them more actionable based on agent feedback

---

**Why Self-Validating Agents Are Critical for Tax Audit**

Building a $200k-$500k tax clawback system requires **trust**. Self-validating agents transform:
- **Hope it works** → **Know it works**
- **Manual checking** → **Automatic verification**
- **Late errors** → **Immediate detection**
- **70% confidence** → **95% confidence**

**This is the difference between a system you hope works and a system you trust with real money.**
