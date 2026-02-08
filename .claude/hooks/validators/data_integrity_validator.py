#!/usr/bin/env python3
"""
Data Integrity Validator
Purpose: Validate cross-year data consistency
Validates: Opening/closing balances, no duplicates, consistent org details
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
from decimal import Decimal
from collections import defaultdict

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
    Validate data integrity across multiple years
    """
    issues = []
    warnings = []

    try:
        # Parse data
        if isinstance(data, str):
            try:
                integrity_data = json.loads(data)
            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON format: {str(e)}")
                return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}
        elif isinstance(data, dict):
            integrity_data = data
        else:
            issues.append(f"Invalid data type: expected dict or JSON string")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        log_validation("Validating data integrity")

        # Check for multiple years data
        if 'years' in integrity_data:
            years_data = integrity_data['years']
            if isinstance(years_data, list):
                validate_multi_year_consistency(years_data, issues, warnings)
            else:
                warnings.append("Years data is not a list - cannot validate cross-year consistency")

        # Check for transactions
        if 'transactions' in integrity_data:
            transactions = integrity_data['transactions']
            if isinstance(transactions, list):
                validate_transaction_integrity(transactions, issues, warnings)
            else:
                warnings.append("Transactions is not a list")

        # Check for organization consistency
        if 'organization' in integrity_data or 'tenant_id' in integrity_data:
            validate_organization_consistency(integrity_data, issues, warnings)

        log_validation("Data integrity validation complete")

    except Exception as e:
        issues.append(f"Validation error: {str(e)}")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "fix_instructions": generate_fix_instructions(issues) if issues else None
    }

def validate_multi_year_consistency(years_data: List[Dict], issues: List[str], warnings: List[str]):
    """Validate consistency across multiple years"""
    log_validation(f"Validating consistency across {len(years_data)} years")

    # Sort years chronologically
    sorted_years = sorted(years_data, key=lambda y: y.get('financial_year', ''))

    # Check consecutive years have matching balances
    for i in range(len(sorted_years) - 1):
        current_year = sorted_years[i]
        next_year = sorted_years[i + 1]

        current_fy = current_year.get('financial_year', f'Year {i}')
        next_fy = next_year.get('financial_year', f'Year {i+1}')

        # Check closing balance of current year matches opening of next year
        if 'closing_balance' in current_year and 'opening_balance' in next_year:
            current_closing = Decimal(str(current_year['closing_balance']))
            next_opening = Decimal(str(next_year['opening_balance']))

            if abs(current_closing - next_opening) > Decimal('0.02'):
                issues.append(f"Balance mismatch: {current_fy} closing (${current_closing}) ≠ {next_fy} opening (${next_opening})")

        # Check loss carry-forward consistency
        if 'losses' in current_year and 'losses' in next_year:
            current_loss_closing = Decimal(str(current_year['losses'].get('closing_balance', 0)))
            next_loss_opening = Decimal(str(next_year['losses'].get('opening_balance', 0)))

            if abs(current_loss_closing - next_loss_opening) > Decimal('0.02'):
                issues.append(f"Loss balance mismatch: {current_fy} closing (${current_loss_closing}) ≠ {next_fy} opening (${next_loss_opening})")

    # Check for overlapping date ranges
    for i in range(len(sorted_years) - 1):
        if 'end_date' in sorted_years[i] and 'start_date' in sorted_years[i + 1]:
            current_end = sorted_years[i]['end_date']
            next_start = sorted_years[i + 1]['start_date']

            # End date should be before next start date
            if current_end >= next_start:
                issues.append(f"Overlapping date ranges: {sorted_years[i].get('financial_year')} ends {current_end}, {sorted_years[i+1].get('financial_year')} starts {next_start}")

def validate_transaction_integrity(transactions: List[Dict], issues: List[str], warnings: List[str]):
    """Validate transaction data integrity"""
    log_validation(f"Validating {len(transactions)} transactions")

    # Check for duplicate transaction IDs
    transaction_ids = []
    for txn in transactions:
        txn_id = txn.get('transaction_id') or txn.get('transactionID') or txn.get('id')
        if txn_id:
            transaction_ids.append(str(txn_id))

    if transaction_ids:
        unique_ids = set(transaction_ids)
        if len(transaction_ids) != len(unique_ids):
            duplicate_count = len(transaction_ids) - len(unique_ids)
            issues.append(f"Found {duplicate_count} duplicate transaction IDs")

            # Find specific duplicates
            id_counts = defaultdict(int)
            for tid in transaction_ids:
                id_counts[tid] += 1
            duplicates = [tid for tid, count in id_counts.items() if count > 1]
            if len(duplicates) <= 5:
                warnings.append(f"Duplicate transaction IDs: {', '.join(duplicates[:5])}")

    # Check for transactions with missing critical fields
    critical_fields = ['date', 'amount']
    missing_field_count = 0
    for i, txn in enumerate(transactions[:1000]):  # Check first 1000
        for field in critical_fields:
            if field not in txn and field.title() not in txn:
                missing_field_count += 1
                if missing_field_count <= 5:  # Only report first 5
                    warnings.append(f"Transaction {i}: Missing field '{field}'")

    if missing_field_count > 5:
        warnings.append(f"Total {missing_field_count} transactions with missing critical fields")

    # Check for negative amounts where inappropriate
    for i, txn in enumerate(transactions[:100]):  # Check first 100
        amount = txn.get('amount') or txn.get('total') or txn.get('Amount')
        if amount is not None:
            try:
                amount_value = Decimal(str(amount))
                # Negative amounts might be refunds, so just warn
                if amount_value == 0:
                    warnings.append(f"Transaction {i}: Zero amount")
            except (ValueError, TypeError):
                warnings.append(f"Transaction {i}: Invalid amount format '{amount}'")

def validate_organization_consistency(data: Dict, issues: List[str], warnings: List[str]):
    """Validate organization details are consistent"""
    # Check tenant_id consistency if multiple datasets
    if 'years' in data and isinstance(data['years'], list):
        tenant_ids = set()
        for year in data['years']:
            if 'tenant_id' in year:
                tenant_ids.add(year['tenant_id'])

        if len(tenant_ids) > 1:
            issues.append(f"Multiple tenant IDs found: {tenant_ids} - data should be from single organization")

    # Check organization name consistency
    if 'years' in data and isinstance(data['years'], list):
        org_names = set()
        for year in data['years']:
            if 'organization_name' in year:
                org_names.add(year['organization_name'])

        if len(org_names) > 1:
            warnings.append(f"Multiple organization names found: {org_names} - possible name change or data error")

def generate_fix_instructions(issues: List[str]) -> str:
    """Generate agent-readable instructions to fix issues"""
    instructions = ["Resolve these data integrity errors:"]
    for issue in issues:
        if "balance mismatch" in issue.lower():
            instructions.append(f"- {issue} → Verify closing balance year N = opening balance year N+1")
        elif "duplicate transaction" in issue.lower():
            instructions.append(f"- {issue} → Remove duplicate transactions or ensure unique IDs")
        elif "overlapping date" in issue.lower():
            instructions.append(f"- {issue} → Verify financial year date ranges don't overlap")
        elif "multiple tenant" in issue.lower():
            instructions.append(f"- {issue} → Data must be from single organization")
        else:
            instructions.append(f"- {issue}")

    instructions.append("\nData Integrity Checks:")
    instructions.append("  - Closing balance year N = Opening balance year N+1")
    instructions.append("  - No duplicate transaction IDs")
    instructions.append("  - No overlapping date ranges")
    instructions.append("  - Consistent organization details")

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
            log_validation("✅ Data Integrity Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ Data Integrity Validation FAILED: {len(result['issues'])} issues", "ERROR")
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
