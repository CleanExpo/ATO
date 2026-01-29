#!/usr/bin/env python3
"""
Validator Template - Copy this for new validators
Purpose: [Specific validation purpose]
Validates: [What aspect of the system]
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
    Main validation logic
    Returns: {
        "valid": bool,
        "issues": List[str],
        "warnings": List[str],
        "fix_instructions": str or None
    }
    """
    issues = []
    warnings = []

    # Validation logic here
    # ...

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "fix_instructions": generate_fix_instructions(issues) if issues else None
    }

def generate_fix_instructions(issues: List[str]) -> str:
    """Generate agent-readable instructions to fix issues"""
    return f"Resolve these validation errors:\n" + "\n".join(f"- {issue}" for issue in issues)

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

        # Parse input
        try:
            data = json.loads(input_data)
        except json.JSONDecodeError:
            data = input_data  # Plain text fallback

        # Run validation
        log_validation(f"Starting validation: {Path(__file__).stem}")
        result = validate(data)

        # Log results
        if result["valid"]:
            log_validation("✅ Validation PASSED", "SUCCESS")
            sys.exit(0)
        else:
            log_validation(f"❌ Validation FAILED: {len(result['issues'])} issues", "ERROR")
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
