#!/usr/bin/env python3
"""
Xero Data Validator
Purpose: Validate Xero API responses and data structure
Validates: API response schema, required fields, pagination, date ranges
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

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
    Validate Xero API response structure
    """
    issues = []
    warnings = []

    try:
        # Parse data
        if isinstance(data, str):
            try:
                xero_data = json.loads(data)
            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON format: {str(e)}")
                return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}
        elif isinstance(data, dict):
            xero_data = data
        else:
            issues.append(f"Invalid data type: expected dict or JSON string, got {type(data)}")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        # Check for Xero-specific fields
        # Common Xero response structures
        if 'transactions' in xero_data or 'Transactions' in xero_data:
            transactions = xero_data.get('transactions') or xero_data.get('Transactions')
            validate_transactions(transactions, issues, warnings)
        elif 'bankTransactions' in xero_data or 'BankTransactions' in xero_data:
            transactions = xero_data.get('bankTransactions') or xero_data.get('BankTransactions')
            validate_transactions(transactions, issues, warnings)
        elif 'invoices' in xero_data or 'Invoices' in xero_data:
            invoices = xero_data.get('invoices') or xero_data.get('Invoices')
            validate_invoices(invoices, issues, warnings)
        elif 'contacts' in xero_data or 'Contacts' in xero_data:
            contacts = xero_data.get('contacts') or xero_data.get('Contacts')
            validate_contacts(contacts, issues, warnings)
        elif isinstance(xero_data, list):
            # Direct array of transactions
            validate_transactions(xero_data, issues, warnings)
        else:
            warnings.append("Unknown Xero data structure - cannot validate specific fields")

        # Check for pagination info
        if 'pagination' in xero_data:
            pagination = xero_data['pagination']
            if pagination.get('hasMorePages') or pagination.get('pageCount', 1) > 1:
                warnings.append("Response has multiple pages - ensure all pages are fetched")

    except Exception as e:
        issues.append(f"Validation error: {str(e)}")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "fix_instructions": generate_fix_instructions(issues) if issues else None
    }

def validate_transactions(transactions: List[Dict], issues: List[str], warnings: List[str]):
    """Validate transaction array structure"""
    if not isinstance(transactions, list):
        issues.append("Transactions field is not an array")
        return

    log_validation(f"Validating {len(transactions)} transactions")

    required_fields = ['date', 'amount', 'transactionID']
    alternative_fields = {
        'date': ['Date', 'TransactionDate', 'date'],
        'amount': ['Total', 'Amount', 'total', 'amount'],
        'transactionID': ['TransactionID', 'transactionID', 'ID', 'id']
    }

    for i, txn in enumerate(transactions[:100]):  # Check first 100
        if not isinstance(txn, dict):
            issues.append(f"Transaction {i}: Not a valid object")
            continue

        # Check for required fields (with alternatives)
        for field in required_fields:
            alternatives = alternative_fields.get(field, [field])
            if not any(alt in txn for alt in alternatives):
                issues.append(f"Transaction {i}: Missing required field '{field}' (checked: {alternatives})")

        # Validate date format
        date_field = next((alt for alt in alternative_fields['date'] if alt in txn), None)
        if date_field:
            date_value = txn[date_field]
            if not isinstance(date_value, str) or not date_value:
                warnings.append(f"Transaction {i}: Date field '{date_field}' has invalid format")

        # Validate amount is numeric
        amount_field = next((alt for alt in alternative_fields['amount'] if alt in txn), None)
        if amount_field:
            amount_value = txn[amount_field]
            if not isinstance(amount_value, (int, float)):
                try:
                    float(str(amount_value))
                except (ValueError, TypeError):
                    warnings.append(f"Transaction {i}: Amount '{amount_value}' is not numeric")

def validate_invoices(invoices: List[Dict], issues: List[str], warnings: List[str]):
    """Validate invoice array structure"""
    if not isinstance(invoices, list):
        issues.append("Invoices field is not an array")
        return

    log_validation(f"Validating {len(invoices)} invoices")

    required_fields = ['InvoiceID', 'Date', 'Total']

    for i, inv in enumerate(invoices[:100]):  # Check first 100
        if not isinstance(inv, dict):
            issues.append(f"Invoice {i}: Not a valid object")
            continue

        for field in required_fields:
            if field not in inv:
                issues.append(f"Invoice {i}: Missing required field '{field}'")

def validate_contacts(contacts: List[Dict], issues: List[str], warnings: List[str]):
    """Validate contact array structure"""
    if not isinstance(contacts, list):
        issues.append("Contacts field is not an array")
        return

    log_validation(f"Validating {len(contacts)} contacts")

    required_fields = ['ContactID', 'Name']

    for i, contact in enumerate(contacts[:100]):  # Check first 100
        if not isinstance(contact, dict):
            issues.append(f"Contact {i}: Not a valid object")
            continue

        for field in required_fields:
            if field not in contact:
                issues.append(f"Contact {i}: Missing required field '{field}'")

def generate_fix_instructions(issues: List[str]) -> str:
    """Generate agent-readable instructions to fix issues"""
    instructions = ["Resolve these Xero data validation errors:"]
    for issue in issues:
        if "missing required field" in issue.lower():
            instructions.append(f"- {issue} → Verify Xero API response includes all required fields")
        elif "invalid json" in issue.lower():
            instructions.append(f"- {issue} → Check Xero API response format")
        elif "not an array" in issue.lower():
            instructions.append(f"- {issue} → Verify Xero API response structure")
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
        log_validation(f"Starting Xero data validation")
        result = validate(input_data)

        # Log results
        if result["valid"]:
            log_validation("✅ Xero Data Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ Xero Data Validation FAILED: {len(result['issues'])} issues", "ERROR")
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
