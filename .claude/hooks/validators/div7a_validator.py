#!/usr/bin/env python3
"""
Division 7A Validator
Purpose: Validate Division 7A compliance for shareholder loans
Validates: Interest rates, minimum repayments, written agreements, deemed dividends
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
from decimal import Decimal

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

# Division 7A benchmark interest rate for FY2024-25
BENCHMARK_RATE_FY2425 = Decimal('0.0877')  # 8.77%

def validate(data: Any) -> Dict[str, Any]:
    """
    Validate Division 7A compliance
    """
    issues = []
    warnings = []

    try:
        # Parse data
        if isinstance(data, str):
            try:
                div7a_data = json.loads(data)
            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON format: {str(e)}")
                return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}
        elif isinstance(data, dict):
            div7a_data = data
        else:
            issues.append(f"Invalid data type: expected dict or JSON string")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        log_validation("Validating Division 7A compliance")

        # Validate loan balance calculation
        if all(k in div7a_data for k in ['opening_balance', 'advances_this_year', 'repayments_this_year', 'closing_balance']):
            opening = Decimal(str(div7a_data['opening_balance']))
            advances = Decimal(str(div7a_data['advances_this_year']))
            repayments = Decimal(str(div7a_data['repayments_this_year']))
            closing = Decimal(str(div7a_data['closing_balance']))

            expected_closing = opening + advances - repayments
            if abs(closing - expected_closing) > Decimal('0.02'):
                issues.append(f"Closing balance incorrect: ${closing} ≠ ${expected_closing} (${opening} + ${advances} - ${repayments})")

        # Validate benchmark interest rate
        if 'loan_balance' in div7a_data or 'closing_balance' in div7a_data:
            balance = Decimal(str(div7a_data.get('loan_balance') or div7a_data.get('closing_balance')))

            if 'benchmark_interest' in div7a_data:
                benchmark_interest = Decimal(str(div7a_data['benchmark_interest']))
                expected_interest = (balance * BENCHMARK_RATE_FY2425).quantize(Decimal('0.01'))

                if abs(benchmark_interest - expected_interest) > Decimal('0.02'):
                    issues.append(f"Benchmark interest incorrect: ${benchmark_interest} ≠ ${expected_interest} (${balance} × 8.77%)")

            # Check if interest was actually charged
            if 'interest_charged' in div7a_data:
                interest_charged = Decimal(str(div7a_data['interest_charged']))
                expected_interest = (balance * BENCHMARK_RATE_FY2425).quantize(Decimal('0.01'))

                if interest_charged < expected_interest:
                    warnings.append(f"Interest charged ${interest_charged} is below benchmark ${expected_interest} - may trigger deemed dividend")

        # Validate minimum repayment
        if 'minimum_repayment' in div7a_data:
            min_repayment = Decimal(str(div7a_data['minimum_repayment']))

            if min_repayment <= 0:
                issues.append("Minimum repayment must be greater than zero")

            if 'loan_balance' in div7a_data or 'opening_balance' in div7a_data:
                balance = Decimal(str(div7a_data.get('loan_balance') or div7a_data.get('opening_balance')))
                if min_repayment > balance:
                    issues.append(f"Minimum repayment ${min_repayment} cannot exceed loan balance ${balance}")

            # Check if repayments met minimum
            if 'repayments_this_year' in div7a_data:
                repayments = Decimal(str(div7a_data['repayments_this_year']))
                if repayments < min_repayment:
                    warnings.append(f"Repayments ${repayments} below minimum ${min_repayment} - may trigger deemed dividend")

        # Validate written agreement requirement
        if 'has_written_agreement' in div7a_data:
            has_agreement = div7a_data['has_written_agreement']
            if not isinstance(has_agreement, bool):
                issues.append("Written agreement field must be boolean")

            if not has_agreement:
                warnings.append("No written agreement - Division 7A compliance at risk")

        # Validate compliance status
        if 'is_compliant' in div7a_data:
            is_compliant = div7a_data['is_compliant']
            if not isinstance(is_compliant, bool):
                issues.append("Compliance field must be boolean")

            # Check consistency with other fields
            if is_compliant:
                if div7a_data.get('has_written_agreement') is False:
                    issues.append("Marked as compliant but no written agreement")
                if div7a_data.get('interest_charged', 0) < div7a_data.get('benchmark_interest', 0):
                    issues.append("Marked as compliant but interest below benchmark")

        # Validate deemed dividend risk
        if 'deemed_dividend_risk' in div7a_data:
            risk = div7a_data['deemed_dividend_risk']
            try:
                risk_value = Decimal(str(risk))
                if risk_value < 0:
                    issues.append("Deemed dividend risk cannot be negative")
            except (ValueError, TypeError):
                issues.append(f"Invalid deemed dividend risk value: {risk}")

        # Check for potential tax liability
        if 'potential_tax_liability' in div7a_data:
            tax_liability = div7a_data['potential_tax_liability']
            try:
                liability_value = Decimal(str(tax_liability))
                if liability_value < 0:
                    issues.append("Tax liability cannot be negative")

                # If there's significant liability, should not be marked as compliant
                if liability_value > 0 and div7a_data.get('is_compliant'):
                    warnings.append(f"Marked as compliant but has potential tax liability ${liability_value}")
            except (ValueError, TypeError):
                issues.append(f"Invalid tax liability value: {tax_liability}")

        log_validation("Division 7A validation complete")

    except Exception as e:
        issues.append(f"Validation error: {str(e)}")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "fix_instructions": generate_fix_instructions(issues) if issues else None
    }

def generate_fix_instructions(issues: List[str]) -> str:
    """Generate agent-readable instructions to fix issues"""
    instructions = ["Resolve these Division 7A validation errors:"]
    for issue in issues:
        if "benchmark interest" in issue.lower():
            instructions.append(f"- {issue} → Use 8.77% for FY2024-25")
        elif "closing balance" in issue.lower():
            instructions.append(f"- {issue} → Formula: opening + advances - repayments")
        elif "written agreement" in issue.lower():
            instructions.append(f"- {issue} → Division 7A requires complying loan agreements")
        elif "minimum repayment" in issue.lower():
            instructions.append(f"- {issue} → Check Division 7A minimum repayment schedules")
        else:
            instructions.append(f"- {issue}")

    instructions.append("\nDivision 7A Requirements:")
    instructions.append("  - Written loan agreement with complying terms")
    instructions.append("  - Interest charged at benchmark rate (8.77% FY24-25)")
    instructions.append("  - Minimum yearly repayment met")
    instructions.append("  - Failure to comply = deemed dividend")

    return "\n".join(instructions)

def main():
    """Entry point for validator"""
    try:
        input_data = sys.stdin.read() if not sys.stdin.isatty() else None

        if not input_data and len(sys.argv) > 1:
            file_path = Path(sys.argv[1])
            if file_path.exists():
                input_data = file_path.read_text()

        if not input_data:
            log_validation("No input data provided", "ERROR")
            sys.exit(1)

        result = validate(input_data)

        if result["valid"]:
            log_validation("✅ Division 7A Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ Division 7A Validation FAILED: {len(result['issues'])} issues", "ERROR")
            for issue in result["issues"]:
                log_validation(f"  - {issue}", "ERROR")
            if result["fix_instructions"]:
                print(result["fix_instructions"])
            sys.exit(1)

    except Exception as e:
        log_validation(f"Validator error: {str(e)}", "CRITICAL")
        sys.exit(1)

if __name__ == "__main__":
    main()
