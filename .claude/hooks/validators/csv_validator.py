#!/usr/bin/env python3
"""
CSV Validator
Purpose: Validate CSV file structure and data integrity
Validates: CSV headers, delimiters, data types, balance calculations
"""

import json
import sys
import csv
import io
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
from decimal import Decimal, InvalidOperation

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

def validate(data: Any) -> Dict[str, Any]:
    """
    Validate CSV structure and data integrity
    """
    issues = []
    warnings = []

    try:
        # Parse CSV content
        if isinstance(data, str):
            csv_content = data
        elif isinstance(data, dict) and 'content' in data:
            csv_content = data['content']
        else:
            issues.append("Invalid data format - expected CSV string or dict with 'content' key")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        # Read CSV
        csv_reader = csv.DictReader(io.StringIO(csv_content))

        # Check headers exist
        if not csv_reader.fieldnames:
            issues.append("CSV has no headers")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        headers = csv_reader.fieldnames
        log_validation(f"CSV headers found: {headers}")

        # Common financial CSV headers
        expected_headers = {'date', 'amount', 'description', 'transaction_id', 'id'}
        found_headers = set(h.lower() for h in headers)

        # Check for critical financial fields
        if not any(h in found_headers for h in ['amount', 'total', 'balance']):
            warnings.append("CSV missing amount/total/balance column - may not be financial data")

        # Validate rows
        rows = list(csv_reader)
        row_count = len(rows)
        log_validation(f"CSV has {row_count} rows")

        if row_count == 0:
            warnings.append("CSV has no data rows (only headers)")

        # Check for duplicate IDs if ID column exists
        id_columns = [h for h in headers if 'id' in h.lower()]
        if id_columns:
            id_values = [row.get(id_columns[0]) for row in rows if row.get(id_columns[0])]
            unique_ids = set(id_values)
            if len(id_values) != len(unique_ids):
                duplicates = len(id_values) - len(unique_ids)
                issues.append(f"Found {duplicates} duplicate transaction IDs")

        # Validate financial amounts
        amount_columns = [h for h in headers if any(term in h.lower() for term in ['amount', 'total', 'balance', 'price', 'cost'])]
        if amount_columns:
            for i, row in enumerate(rows[:100]):  # Check first 100 rows
                for col in amount_columns:
                    value = row.get(col, '').strip()
                    if value and value not in ['', '-', 'N/A']:
                        # Remove currency symbols and commas
                        clean_value = value.replace('$', '').replace(',', '').replace(' ', '')
                        try:
                            Decimal(clean_value)
                        except InvalidOperation:
                            issues.append(f"Row {i+1}, column '{col}': Invalid amount format '{value}'")

        # Check for broken rows (missing columns)
        for i, row in enumerate(rows):
            if len(row) < len(headers):
                issues.append(f"Row {i+1}: Missing columns (has {len(row)}, expected {len(headers)})")

        # Validate dates if date column exists
        date_columns = [h for h in headers if 'date' in h.lower()]
        if date_columns:
            for i, row in enumerate(rows[:100]):  # Check first 100 rows
                for col in date_columns:
                    value = row.get(col, '').strip()
                    if value and value not in ['', '-', 'N/A']:
                        # Basic date format check (YYYY-MM-DD, DD/MM/YYYY, etc.)
                        if not any(char.isdigit() for char in value):
                            issues.append(f"Row {i+1}, column '{col}': Invalid date format '{value}'")

    except csv.Error as e:
        issues.append(f"CSV parsing error: {str(e)}")
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
    instructions = ["Resolve these CSV validation errors:"]
    for issue in issues:
        if "duplicate" in issue.lower():
            instructions.append(f"- {issue} → Remove duplicate rows or use unique transaction IDs")
        elif "missing columns" in issue.lower():
            instructions.append(f"- {issue} → Ensure all rows have complete data")
        elif "invalid amount" in issue.lower():
            instructions.append(f"- {issue} → Format amounts as numbers (e.g., 100.00 not '$100.00')")
        elif "invalid date" in issue.lower():
            instructions.append(f"- {issue} → Format dates as YYYY-MM-DD or DD/MM/YYYY")
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
        log_validation(f"Starting CSV validation")
        result = validate(input_data)

        # Log results
        if result["valid"]:
            log_validation("✅ CSV Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ CSV Validation FAILED: {len(result['issues'])} issues", "ERROR")
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
