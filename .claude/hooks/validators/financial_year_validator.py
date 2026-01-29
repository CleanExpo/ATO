#!/usr/bin/env python3
"""
Financial Year Validator
Purpose: Validate Australian financial year date ranges
Validates: FY format, date ranges (July 1 - June 30), year consistency
"""

import json
import sys
from pathlib import Path
from datetime import datetime, date
from typing import Dict, List, Any
import re

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

# Financial year patterns
FY_PATTERNS = [
    r'FY\d{4}-\d{2,4}',  # FY2024-25 or FY2024-2025
    r'FY\d{2}-\d{2}',    # FY24-25
    r'\d{4}-\d{2,4}',    # 2024-25 or 2024-2025
]

def validate(data: Any) -> Dict[str, Any]:
    """
    Validate financial year format and date ranges
    """
    issues = []
    warnings = []

    try:
        # Parse data
        if isinstance(data, str):
            try:
                fy_data = json.loads(data)
            except json.JSONDecodeError:
                # Treat as plain text FY string
                fy_data = {'financial_year': data.strip()}
        elif isinstance(data, dict):
            fy_data = data
        else:
            issues.append(f"Invalid data type: expected dict or string")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        log_validation("Validating financial year")

        # Check for financial year field
        fy_field = None
        for field in ['financial_year', 'fy', 'fiscalYear', 'year']:
            if field in fy_data:
                fy_field = field
                break

        if not fy_field:
            # Check if we have start_date and end_date instead
            if 'start_date' in fy_data and 'end_date' in fy_data:
                validate_date_range(fy_data, issues, warnings)
                return {
                    "valid": len(issues) == 0,
                    "issues": issues,
                    "warnings": warnings,
                    "fix_instructions": generate_fix_instructions(issues) if issues else None
                }
            else:
                warnings.append("No financial year field found")
                return {"valid": True, "issues": issues, "warnings": warnings, "fix_instructions": None}

        fy_value = str(fy_data[fy_field])

        # Validate FY format
        valid_format = False
        for pattern in FY_PATTERNS:
            if re.match(pattern, fy_value):
                valid_format = True
                break

        if not valid_format:
            issues.append(f"Invalid financial year format '{fy_value}' - expected format: FY2024-25")

        # Extract years
        years = re.findall(r'\d{2,4}', fy_value)
        if len(years) >= 2:
            try:
                year1 = int(years[0]) if len(years[0]) == 4 else int(f"20{years[0]}")
                year2 = int(years[1]) if len(years[1]) == 4 else int(f"20{years[1]}")

                # Check consecutive years
                if year2 != year1 + 1 and year2 != (year1 + 1) % 100:
                    issues.append(f"Financial year must be consecutive years, got {year1}-{year2}")

                # Check year range is reasonable
                current_year = datetime.now().year
                if year1 < 2000 or year1 > current_year + 2:
                    warnings.append(f"Financial year {year1} is outside reasonable range (2000-{current_year+2})")

            except ValueError:
                issues.append(f"Could not parse years from '{fy_value}'")

        # Validate date ranges if provided
        if 'start_date' in fy_data and 'end_date' in fy_data:
            validate_date_range(fy_data, issues, warnings, fy_value)

        log_validation("Financial year validation complete")

    except Exception as e:
        issues.append(f"Validation error: {str(e)}")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "fix_instructions": generate_fix_instructions(issues) if issues else None
    }

def validate_date_range(data: Dict, issues: List[str], warnings: List[str], fy_value: str = None):
    """Validate date range matches Australian FY (July 1 - June 30)"""
    try:
        start_str = str(data['start_date'])
        end_str = str(data['end_date'])

        # Parse dates
        start_date = parse_date(start_str)
        end_date = parse_date(end_str)

        if not start_date or not end_date:
            issues.append("Could not parse start_date or end_date")
            return

        # Check Australian FY starts July 1
        if start_date.month != 7 or start_date.day != 1:
            issues.append(f"Financial year must start July 1, not {start_date.strftime('%B %d')}")

        # Check Australian FY ends June 30
        if end_date.month != 6 or end_date.day != 30:
            issues.append(f"Financial year must end June 30, not {end_date.strftime('%B %d')}")

        # Check end is after start
        if end_date <= start_date:
            issues.append(f"End date {end_str} must be after start date {start_str}")

        # Check approximately 12 months
        days_diff = (end_date - start_date).days
        if days_diff < 360 or days_diff > 370:
            warnings.append(f"Financial year length is {days_diff} days (expected ~365 days)")

        # Check years match FY label
        if fy_value:
            fy_start_year = start_date.year
            fy_end_year = end_date.year
            if str(fy_start_year) not in fy_value:
                warnings.append(f"FY label '{fy_value}' doesn't match date range year {fy_start_year}")

    except Exception as e:
        issues.append(f"Date range validation error: {str(e)}")

def parse_date(date_str: str) -> date:
    """Parse date string in various formats"""
    formats = [
        '%Y-%m-%d',
        '%d/%m/%Y',
        '%Y/%m/%d',
        '%d-%m-%Y',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M:%S.%f',
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str.split('T')[0], fmt.split('T')[0]).date()
        except ValueError:
            continue

    return None

def generate_fix_instructions(issues: List[str]) -> str:
    """Generate agent-readable instructions to fix issues"""
    instructions = ["Resolve these financial year validation errors:"]
    for issue in issues:
        if "format" in issue.lower():
            instructions.append(f"- {issue} → Use format: FY2024-25 or FY2024-2025")
        elif "july 1" in issue.lower():
            instructions.append(f"- {issue} → Australian FY starts July 1")
        elif "june 30" in issue.lower():
            instructions.append(f"- {issue} → Australian FY ends June 30")
        elif "consecutive years" in issue.lower():
            instructions.append(f"- {issue} → FY spans two consecutive years (e.g., 2024-25)")
        else:
            instructions.append(f"- {issue}")

    instructions.append("\nAustralian Financial Year:")
    instructions.append("  - Format: FY2024-25 (July 1, 2024 to June 30, 2025)")
    instructions.append("  - Starts: July 1")
    instructions.append("  - Ends: June 30 (next calendar year)")

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
            log_validation("✅ Financial Year Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ Financial Year Validation FAILED: {len(result['issues'])} issues", "ERROR")
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
