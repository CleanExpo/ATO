#!/usr/bin/env python3
"""
Loss Validator
Purpose: Validate loss carry-forward calculations and compliance
Validates: COT/SBT compliance, loss utilization, future tax value
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

def validate(data: Any) -> Dict[str, Any]:
    """
    Validate loss carry-forward calculations and compliance
    """
    issues = []
    warnings = []

    try:
        # Parse data
        if isinstance(data, str):
            try:
                loss_data = json.loads(data)
            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON format: {str(e)}")
                return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}
        elif isinstance(data, dict):
            loss_data = data
        else:
            issues.append(f"Invalid data type: expected dict or JSON string")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        log_validation("Validating loss carry-forward")

        # Validate loss balance calculation
        if all(k in loss_data for k in ['opening_balance', 'current_year_loss', 'losses_utilized', 'closing_balance']):
            opening = Decimal(str(loss_data['opening_balance']))
            current = Decimal(str(loss_data['current_year_loss']))
            utilized = Decimal(str(loss_data['losses_utilized']))
            closing = Decimal(str(loss_data['closing_balance']))

            expected_closing = opening + current - utilized
            if abs(closing - expected_closing) > Decimal('0.02'):
                issues.append(f"Closing balance incorrect: ${closing} ≠ ${expected_closing} (${opening} + ${current} - ${utilized})")

            # Check for negative losses where inappropriate
            if utilized < 0:
                issues.append("Losses utilized cannot be negative")
            if utilized > (opening + current):
                issues.append(f"Cannot utilize more losses (${utilized}) than available (${opening + current})")

        # Validate COT (Continuity of Ownership Test)
        if 'cot_satisfied' in loss_data:
            cot_satisfied = loss_data['cot_satisfied']
            if not isinstance(cot_satisfied, bool):
                issues.append("COT satisfied field must be boolean")

            # If COT failed, SBT is required
            if not cot_satisfied:
                if 'sbt_required' not in loss_data or not loss_data['sbt_required']:
                    warnings.append("COT not satisfied but SBT not marked as required")

                if 'sbt_satisfied' in loss_data:
                    sbt_satisfied = loss_data['sbt_satisfied']
                    if not sbt_satisfied:
                        warnings.append("Both COT and SBT not satisfied - losses may not be available for carry-forward")

        # Validate eligibility for carry-forward
        if 'is_eligible_for_carryforward' in loss_data:
            is_eligible = loss_data['is_eligible_for_carryforward']
            if not isinstance(is_eligible, bool):
                issues.append("Eligibility field must be boolean")

            # If not eligible but has closing balance, flag it
            if not is_eligible and 'closing_balance' in loss_data:
                closing = Decimal(str(loss_data['closing_balance']))
                if closing > 0:
                    issues.append(f"Marked as not eligible for carry-forward but has closing balance ${closing}")

        # Validate future tax value calculation
        if 'closing_balance' in loss_data and 'future_tax_value' in loss_data:
            closing = Decimal(str(loss_data['closing_balance']))
            future_value = Decimal(str(loss_data['future_tax_value']))

            # Future tax value should be closing × tax rate (25% or 30%)
            # Check both rates
            rate_25 = (closing * Decimal('0.25')).quantize(Decimal('0.01'))
            rate_30 = (closing * Decimal('0.30')).quantize(Decimal('0.01'))

            if abs(future_value - rate_25) > Decimal('0.02') and abs(future_value - rate_30) > Decimal('0.02'):
                issues.append(f"Future tax value ${future_value} doesn't match expected calculation (${closing} × 25% = ${rate_25} or × 30% = ${rate_30})")

        log_validation("Loss validation complete")

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
    instructions = ["Resolve these loss validation errors:"]
    for issue in issues:
        if "closing balance" in issue.lower() and "incorrect" in issue.lower():
            instructions.append(f"- {issue} → Formula: closing = opening + current_year - utilized")
        elif "future tax value" in issue.lower():
            instructions.append(f"- {issue} → Use 25% (small business) or 30% (standard) corporate tax rate")
        elif "cot" in issue.lower() or "sbt" in issue.lower():
            instructions.append(f"- {issue} → COT failure requires SBT assessment")
        else:
            instructions.append(f"- {issue}")

    instructions.append("\nLoss Carry-Forward Tests:")
    instructions.append("  - COT (Continuity of Ownership Test): >50% same ownership")
    instructions.append("  - SBT (Same Business Test): If COT fails, company must carry on same business")

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
            log_validation("✅ Loss Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ Loss Validation FAILED: {len(result['issues'])} issues", "ERROR")
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
