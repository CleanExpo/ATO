#!/usr/bin/env python3
"""
Tax Calculation Validator
Purpose: Validate tax calculations and formulas
Validates: R&D offsets, corporate tax rates, loss utilization, Division 7A interest
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
from decimal import Decimal, ROUND_HALF_UP

# Configure logging
LOG_DIR = Path(__file__).parent.parent / "logs" / "validation_logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / f"{Path(__file__).stem}_{datetime.now().strftime('%Y%m%d')}.log"

def log_validation(message: str, level: str = "INFO"):
    """Log validation results with timestamp"""
    timestamp = datetime.now().isoformat()
    log_entry = f"[{timestamp}] [{level}] {message}\n"
    with open(LOG_FILE, "a") as f:
        f.write(log_entry)
    print(log_entry.strip())

# Tax rates and thresholds
RND_OFFSET_RATE = Decimal('0.435')  # 43.5%
SMALL_BUSINESS_TAX_RATE = Decimal('0.25')  # 25%
STANDARD_CORPORATE_TAX_RATE = Decimal('0.30')  # 30%
DIV7A_BENCHMARK_RATE_FY2425 = Decimal('0.0877')  # 8.77% for FY24-25
INSTANT_WRITEOFF_THRESHOLD = Decimal('20000')  # $20,000

def validate(data: Any) -> Dict[str, Any]:
    """
    Validate tax calculations
    """
    issues = []
    warnings = []

    try:
        # Parse data
        if isinstance(data, str):
            try:
                calc_data = json.loads(data)
            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON format: {str(e)}")
                return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}
        elif isinstance(data, dict):
            calc_data = data
        else:
            issues.append(f"Invalid data type: expected dict or JSON string, got {type(data)}")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        calculation_type = calc_data.get('calculation_type', '').lower()

        # Validate based on calculation type
        if calculation_type == 'rnd' or 'rnd' in str(calc_data.get('type', '')).lower():
            validate_rnd_calculation(calc_data, issues, warnings)
        elif calculation_type == 'corporate_tax':
            validate_corporate_tax(calc_data, issues, warnings)
        elif calculation_type == 'div7a' or 'division_7a' in str(calc_data.get('type', '')).lower():
            validate_div7a_calculation(calc_data, issues, warnings)
        elif calculation_type == 'loss':
            validate_loss_calculation(calc_data, issues, warnings)
        elif calculation_type == 'deduction':
            validate_deduction_calculation(calc_data, issues, warnings)
        else:
            # Try to detect calculation type from fields
            if 'rnd_offset' in calc_data or 'eligible_expenditure' in calc_data:
                validate_rnd_calculation(calc_data, issues, warnings)
            elif 'div7a_interest' in calc_data or 'benchmark_interest' in calc_data:
                validate_div7a_calculation(calc_data, issues, warnings)
            elif 'loss' in calc_data or 'carry_forward' in calc_data:
                validate_loss_calculation(calc_data, issues, warnings)
            else:
                warnings.append(f"Unknown calculation type '{calculation_type}' - limited validation")

        # Validate confidence-adjusted calculations
        if 'confidence' in calc_data and 'benefit' in calc_data:
            confidence = Decimal(str(calc_data['confidence']))
            benefit = Decimal(str(calc_data['benefit']))
            expected_adjusted = (benefit * confidence / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            if 'adjusted_benefit' in calc_data:
                adjusted_benefit = Decimal(str(calc_data['adjusted_benefit']))
                if abs(adjusted_benefit - expected_adjusted) > Decimal('0.02'):  # Allow 2 cent rounding difference
                    issues.append(f"Adjusted benefit calculation incorrect: ${adjusted_benefit} ≠ ${expected_adjusted} (benefit ${benefit} × {confidence}%)")

    except Exception as e:
        issues.append(f"Validation error: {str(e)}")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "fix_instructions": generate_fix_instructions(issues) if issues else None
    }

def validate_rnd_calculation(data: Dict, issues: List[str], warnings: List[str]):
    """Validate R&D tax offset calculation"""
    log_validation("Validating R&D tax offset calculation")

    if 'eligible_expenditure' in data and 'rnd_offset' in data:
        expenditure = Decimal(str(data['eligible_expenditure']))
        offset = Decimal(str(data['rnd_offset']))

        expected_offset = (expenditure * RND_OFFSET_RATE).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        if abs(offset - expected_offset) > Decimal('0.02'):  # Allow 2 cent rounding difference
            issues.append(f"R&D offset calculation incorrect: ${offset} ≠ ${expected_offset} (${expenditure} × 43.5%)")
        else:
            log_validation(f"✓ R&D offset correct: ${offset} = ${expenditure} × 43.5%")

    # Check for negative values
    if data.get('eligible_expenditure', 0) < 0:
        issues.append("Eligible expenditure cannot be negative")
    if data.get('rnd_offset', 0) < 0:
        issues.append("R&D offset cannot be negative")

def validate_corporate_tax(data: Dict, issues: List[str], warnings: List[str]):
    """Validate corporate tax calculation"""
    log_validation("Validating corporate tax calculation")

    if 'taxable_income' in data and 'tax_payable' in data:
        taxable_income = Decimal(str(data['taxable_income']))
        tax_payable = Decimal(str(data['tax_payable']))
        is_small_business = data.get('is_small_business', False)

        tax_rate = SMALL_BUSINESS_TAX_RATE if is_small_business else STANDARD_CORPORATE_TAX_RATE
        expected_tax = (taxable_income * tax_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        if abs(tax_payable - expected_tax) > Decimal('0.02'):
            rate_pct = "25%" if is_small_business else "30%"
            issues.append(f"Tax payable calculation incorrect: ${tax_payable} ≠ ${expected_tax} (${taxable_income} × {rate_pct})")

def validate_div7a_calculation(data: Dict, issues: List[str], warnings: List[str]):
    """Validate Division 7A interest calculation"""
    log_validation("Validating Division 7A calculation")

    if 'loan_balance' in data and 'benchmark_interest' in data:
        balance = Decimal(str(data['loan_balance']))
        benchmark_interest = Decimal(str(data['benchmark_interest']))

        expected_interest = (balance * DIV7A_BENCHMARK_RATE_FY2425).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        if abs(benchmark_interest - expected_interest) > Decimal('0.02'):
            issues.append(f"Division 7A benchmark interest incorrect: ${benchmark_interest} ≠ ${expected_interest} (${balance} × 8.77%)")

    # Check minimum repayment calculation if provided
    if 'minimum_repayment' in data and 'loan_balance' in data:
        balance = Decimal(str(data['loan_balance']))
        min_repayment = Decimal(str(data['minimum_repayment']))

        # Minimum repayment formula varies by loan term - just check it's reasonable (>0 and < balance)
        if min_repayment <= 0:
            issues.append("Minimum repayment must be greater than zero")
        if min_repayment > balance:
            issues.append("Minimum repayment cannot exceed loan balance")

def validate_loss_calculation(data: Dict, issues: List[str], warnings: List[str]):
    """Validate loss carry-forward calculation"""
    log_validation("Validating loss carry-forward calculation")

    if all(k in data for k in ['opening_balance', 'current_year_loss', 'losses_utilized', 'closing_balance']):
        opening = Decimal(str(data['opening_balance']))
        current = Decimal(str(data['current_year_loss']))
        utilized = Decimal(str(data['losses_utilized']))
        closing = Decimal(str(data['closing_balance']))

        expected_closing = opening + current - utilized

        if abs(closing - expected_closing) > Decimal('0.02'):
            issues.append(f"Closing loss balance incorrect: ${closing} ≠ ${expected_closing} (${opening} + ${current} - ${utilized})")

    # Validate future tax value
    if 'closing_balance' in data and 'future_tax_value' in data:
        closing = Decimal(str(data['closing_balance']))
        tax_value = Decimal(str(data['future_tax_value']))
        is_small_business = data.get('is_small_business', False)

        tax_rate = SMALL_BUSINESS_TAX_RATE if is_small_business else STANDARD_CORPORATE_TAX_RATE
        expected_value = (closing * tax_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        if abs(tax_value - expected_value) > Decimal('0.02'):
            rate_pct = "25%" if is_small_business else "30%"
            issues.append(f"Future tax value incorrect: ${tax_value} ≠ ${expected_value} (${closing} × {rate_pct})")

def validate_deduction_calculation(data: Dict, issues: List[str], warnings: List[str]):
    """Validate deduction calculation"""
    log_validation("Validating deduction calculation")

    if 'total_amount' in data and 'claimable_amount' in data:
        total = Decimal(str(data['total_amount']))
        claimable = Decimal(str(data['claimable_amount']))

        if claimable > total:
            issues.append(f"Claimable amount ${claimable} cannot exceed total amount ${total}")

    # Validate instant write-off threshold
    if data.get('deduction_type') == 'instant_writeoff' and 'asset_cost' in data:
        cost = Decimal(str(data['asset_cost']))
        if cost > INSTANT_WRITEOFF_THRESHOLD:
            warnings.append(f"Asset cost ${cost} exceeds instant write-off threshold ${INSTANT_WRITEOFF_THRESHOLD}")

def generate_fix_instructions(issues: List[str]) -> str:
    """Generate agent-readable instructions to fix issues"""
    instructions = ["Resolve these tax calculation errors:"]
    for issue in issues:
        if "r&d offset" in issue.lower():
            instructions.append(f"- {issue} → Use formula: eligible_expenditure × 0.435 (43.5%)")
        elif "tax payable" in issue.lower():
            instructions.append(f"- {issue} → Use 25% for small business or 30% for standard corporate rate")
        elif "division 7a" in issue.lower():
            instructions.append(f"- {issue} → Use benchmark rate 8.77% for FY24-25")
        elif "loss balance" in issue.lower():
            instructions.append(f"- {issue} → Formula: opening + current_year_loss - utilized = closing")
        elif "adjusted benefit" in issue.lower():
            instructions.append(f"- {issue} → Formula: benefit × (confidence / 100)")
        else:
            instructions.append(f"- {issue}")
    return "\n".join(instructions)

def main():
    """Entry point for validator"""
    try:
        # Get input (from stdin, file path, or command-line args)
        input_data = sys.stdin.read() if not sys.stdin.isatty() else None

        if not input_data and len(sys.argv) > 1:
            file_path = Path(sys.argv[1])
            if file_path.exists():
                input_data = file_path.read_text()

        if not input_data:
            log_validation("No input data provided", "ERROR")
            sys.exit(1)

        # Run validation
        log_validation(f"Starting tax calculation validation")
        result = validate(input_data)

        # Log results
        if result["valid"]:
            log_validation("✅ Tax Calculation Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ Tax Calculation Validation FAILED: {len(result['issues'])} issues", "ERROR")
            for issue in result["issues"]:
                log_validation(f"  - {issue}", "ERROR")

            # Output fix instructions for agent
            if result["fix_instructions"]:
                print(result["fix_instructions"])

            sys.exit(1)

    except Exception as e:
        log_validation(f"Validator error: {str(e)}", "CRITICAL")
        sys.exit(1)

if __name__ == "__main__":
    main()
