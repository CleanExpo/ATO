#!/usr/bin/env python3
"""
Deduction Validator
Purpose: Validate deduction eligibility and compliance
Validates: Deduction types, legislative references, claimable amounts, restrictions
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
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_entry)
    print(log_entry.strip())

# Valid deduction types and their legislative references
VALID_DEDUCTION_TYPES = {
    'general_business_expense': 'Section 8-1 ITAA 1997',
    'instant_writeoff': 'Section 40-82 ITAA 1997',
    'depreciation': 'Division 40 ITAA 1997',
    'professional_fees': 'Section 8-1 ITAA 1997',
    'home_office': 'Section 8-1 ITAA 1997',
    'vehicle': 'Section 8-1 ITAA 1997',
    'travel': 'Section 8-1 ITAA 1997',
    'software': 'Section 40-30 ITAA 1997',
    'capital_works': 'Division 43 ITAA 1997',
}

INSTANT_WRITEOFF_THRESHOLD = Decimal('20000')

def validate(data: Any) -> Dict[str, Any]:
    """
    Validate deduction eligibility and compliance
    """
    issues = []
    warnings = []

    try:
        # Parse data
        if isinstance(data, str):
            try:
                deduction_data = json.loads(data)
            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON format: {str(e)}")
                return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}
        elif isinstance(data, dict):
            deduction_data = data
        else:
            issues.append(f"Invalid data type: expected dict or JSON string, got {type(data)}")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        log_validation("Validating deduction eligibility")

        # Check required fields
        if 'deduction_type' in deduction_data:
            deduction_type = deduction_data['deduction_type']

            # Validate against known types
            if deduction_type not in VALID_DEDUCTION_TYPES:
                warnings.append(f"Unknown deduction type '{deduction_type}' - may need custom validation")
            else:
                expected_reference = VALID_DEDUCTION_TYPES[deduction_type]
                actual_reference = deduction_data.get('legislative_reference', '')

                if actual_reference and expected_reference not in actual_reference:
                    warnings.append(f"Legislative reference mismatch - expected '{expected_reference}' for {deduction_type}")

        # Validate amounts
        if 'total_amount' in deduction_data and 'claimable_amount' in deduction_data:
            total = Decimal(str(deduction_data['total_amount']))
            claimable = Decimal(str(deduction_data['claimable_amount']))

            if claimable > total:
                issues.append(f"Claimable amount ${claimable} cannot exceed total amount ${total}")

            if claimable < 0:
                issues.append(f"Claimable amount cannot be negative: ${claimable}")

            if total < 0:
                issues.append(f"Total amount cannot be negative: ${total}")

            # Check for 100% claimability flags
            if 'is_fully_deductible' in deduction_data:
                is_fully_deductible = deduction_data['is_fully_deductible']
                if is_fully_deductible and abs(claimable - total) > Decimal('0.02'):
                    issues.append(f"Marked as fully deductible but claimable (${claimable}) ≠ total (${total})")

        # Validate instant write-off eligibility
        if deduction_data.get('deduction_type') == 'instant_writeoff':
            if 'asset_cost' in deduction_data:
                asset_cost = Decimal(str(deduction_data['asset_cost']))
                if asset_cost > INSTANT_WRITEOFF_THRESHOLD:
                    issues.append(f"Asset cost ${asset_cost} exceeds instant write-off threshold ${INSTANT_WRITEOFF_THRESHOLD}")
            elif 'total_amount' in deduction_data:
                total_amount = Decimal(str(deduction_data['total_amount']))
                if total_amount > INSTANT_WRITEOFF_THRESHOLD:
                    issues.append(f"Total amount ${total_amount} exceeds instant write-off threshold ${INSTANT_WRITEOFF_THRESHOLD}")

        # Check for private/domestic expense flags
        if deduction_data.get('has_private_component'):
            if 'business_use_percentage' not in deduction_data:
                warnings.append("Has private component but no business use percentage specified")
            else:
                business_pct = float(deduction_data['business_use_percentage'])
                if business_pct < 0 or business_pct > 100:
                    issues.append(f"Business use percentage must be 0-100, got {business_pct}")

                # Validate split calculation
                if 'total_amount' in deduction_data and 'claimable_amount' in deduction_data:
                    total = Decimal(str(deduction_data['total_amount']))
                    claimable = Decimal(str(deduction_data['claimable_amount']))
                    expected_claimable = (total * Decimal(str(business_pct)) / Decimal('100')).quantize(Decimal('0.01'))

                    if abs(claimable - expected_claimable) > Decimal('0.02'):
                        issues.append(f"Claimable amount ${claimable} doesn't match business use calculation ${expected_claimable} ({business_pct}% of ${total})")

        # Check FBT implications
        if deduction_data.get('fbt_implications'):
            if 'fbt_notes' not in deduction_data or not deduction_data['fbt_notes']:
                warnings.append("FBT implications flagged but no notes provided")

        # Check documentation requirements
        if 'requires_documentation' in deduction_data:
            if deduction_data['requires_documentation']:
                if 'documentation_required' not in deduction_data or not deduction_data['documentation_required']:
                    warnings.append("Documentation required but no specific requirements listed")

        # Validate restrictions
        if 'deduction_restrictions' in deduction_data:
            restrictions = deduction_data['deduction_restrictions']
            if isinstance(restrictions, list):
                common_restrictions = ['private_use', 'entertainment', 'capital_nature', 'fbt_liability']
                for restriction in restrictions:
                    if restriction not in common_restrictions and len(restriction) < 5:
                        warnings.append(f"Unclear restriction: '{restriction}' - provide more detail")
            elif restrictions and not isinstance(restrictions, list):
                issues.append("Deduction restrictions must be a list")

        # Validate confidence score
        if 'confidence' in deduction_data or 'deduction_confidence' in deduction_data:
            confidence = deduction_data.get('confidence') or deduction_data.get('deduction_confidence')
            try:
                confidence_value = float(confidence)
                if confidence_value < 0 or confidence_value > 100:
                    issues.append(f"Confidence score must be 0-100, got {confidence_value}")
            except (ValueError, TypeError):
                issues.append(f"Invalid confidence value: {confidence}")

        log_validation("Deduction validation complete")

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
    instructions = ["Resolve these deduction validation errors:"]
    for issue in issues:
        if "claimable amount" in issue.lower() and "exceed" in issue.lower():
            instructions.append(f"- {issue} → Claimable cannot be more than total expense")
        elif "instant write-off" in issue.lower():
            instructions.append(f"- {issue} → Instant write-off limit is $20,000 per asset")
        elif "business use" in issue.lower():
            instructions.append(f"- {issue} → Calculate: total × (business_use_percentage / 100)")
        elif "legislative reference" in issue.lower():
            instructions.append(f"- {issue} → Include correct ITAA reference for deduction type")
        else:
            instructions.append(f"- {issue}")

    instructions.append("\nCommon Deduction Types:")
    for deduction_type, reference in list(VALID_DEDUCTION_TYPES.items())[:5]:
        instructions.append(f"  - {deduction_type}: {reference}")

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
        log_validation(f"Starting deduction validation")
        result = validate(input_data)

        # Log results
        if result["valid"]:
            log_validation("✅ Deduction Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ Deduction Validation FAILED: {len(result['issues'])} issues", "ERROR")
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
