#!/usr/bin/env python3
"""
Report Structure Validator
Purpose: Validate report completeness and structure
Validates: All sections present, calculations complete, proper formatting
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
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_entry)
    print(log_entry.strip())

# Required report sections
REQUIRED_SECTIONS = [
    'executive_summary',
    'methodology',
    'findings',
    'recommendations',
]

RECOMMENDED_SECTIONS = [
    'rnd_analysis',
    'deductions_analysis',
    'loss_analysis',
    'div7a_analysis',
    'action_plan',
    'appendices',
]

def validate(data: Any) -> Dict[str, Any]:
    """
    Validate report structure and completeness
    """
    issues = []
    warnings = []

    try:
        # Parse data
        if isinstance(data, str):
            try:
                report_data = json.loads(data)
            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON format: {str(e)}")
                return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}
        elif isinstance(data, dict):
            report_data = data
        else:
            issues.append(f"Invalid data type: expected dict or JSON string")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        log_validation("Validating report structure")

        # Check for required sections
        missing_required = []
        for section in REQUIRED_SECTIONS:
            if section not in report_data:
                missing_required.append(section)

        if missing_required:
            issues.append(f"Missing required sections: {', '.join(missing_required)}")

        # Check for recommended sections
        missing_recommended = []
        for section in RECOMMENDED_SECTIONS:
            if section not in report_data:
                missing_recommended.append(section)

        if missing_recommended:
            warnings.append(f"Missing recommended sections: {', '.join(missing_recommended)}")

        # Validate executive summary
        if 'executive_summary' in report_data:
            validate_executive_summary(report_data['executive_summary'], issues, warnings)

        # Validate findings
        if 'findings' in report_data:
            validate_findings(report_data['findings'], issues, warnings)

        # Validate recommendations
        if 'recommendations' in report_data:
            validate_recommendations(report_data['recommendations'], issues, warnings)

        # Check report metadata
        if 'report_metadata' in report_data or 'metadata' in report_data:
            metadata = report_data.get('report_metadata') or report_data.get('metadata')
            validate_metadata(metadata, issues, warnings)

        # Check for total clawback calculation
        if 'total_clawback_opportunity' in report_data or 'total_benefit' in report_data:
            total = report_data.get('total_clawback_opportunity') or report_data.get('total_benefit')
            try:
                total_value = float(total)
                if total_value < 0:
                    issues.append("Total clawback opportunity cannot be negative")
                elif total_value == 0:
                    warnings.append("Total clawback opportunity is zero - verify findings")
            except (ValueError, TypeError):
                issues.append(f"Invalid total clawback value: {total}")

        log_validation("Report structure validation complete")

    except Exception as e:
        issues.append(f"Validation error: {str(e)}")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "fix_instructions": generate_fix_instructions(issues) if issues else None
    }

def validate_executive_summary(summary: Any, issues: List[str], warnings: List[str]):
    """Validate executive summary section"""
    if not isinstance(summary, dict):
        issues.append("Executive summary must be an object")
        return

    # Check for key fields
    key_fields = ['total_opportunity', 'key_findings', 'priority_actions']
    for field in key_fields:
        if field not in summary:
            warnings.append(f"Executive summary missing '{field}'")

    # Check key findings is not empty
    if 'key_findings' in summary:
        findings = summary['key_findings']
        if isinstance(findings, list) and len(findings) == 0:
            warnings.append("Executive summary has no key findings")
        elif not findings:
            warnings.append("Executive summary key findings is empty")

def validate_findings(findings: Any, issues: List[str], warnings: List[str]):
    """Validate findings section"""
    if isinstance(findings, dict):
        # Check for findings by tax area
        tax_areas = ['rnd', 'deductions', 'losses', 'div7a']
        found_areas = [area for area in tax_areas if area in findings]

        if len(found_areas) == 0:
            warnings.append("No tax area findings present (rnd, deductions, losses, div7a)")

        # Validate each finding has required fields
        for area, data in findings.items():
            if isinstance(data, dict):
                if 'total_benefit' not in data and 'opportunity' not in data:
                    warnings.append(f"Findings '{area}': Missing benefit/opportunity amount")

                if 'confidence' not in data:
                    warnings.append(f"Findings '{area}': Missing confidence score")

    elif isinstance(findings, list):
        if len(findings) == 0:
            warnings.append("Findings list is empty")
    else:
        issues.append("Findings must be an object or array")

def validate_recommendations(recommendations: Any, issues: List[str], warnings: List[str]):
    """Validate recommendations section"""
    if not isinstance(recommendations, list):
        issues.append("Recommendations must be a list")
        return

    if len(recommendations) == 0:
        warnings.append("No recommendations provided")
        return

    # Check each recommendation has required fields
    required_fields = ['action', 'estimated_benefit', 'priority']
    for i, rec in enumerate(recommendations):
        if not isinstance(rec, dict):
            issues.append(f"Recommendation {i}: Not a valid object")
            continue

        for field in required_fields:
            if field not in rec:
                warnings.append(f"Recommendation {i}: Missing '{field}' field")

        # Check priority is valid
        if 'priority' in rec:
            valid_priorities = ['critical', 'high', 'medium', 'low']
            if rec['priority'] not in valid_priorities:
                warnings.append(f"Recommendation {i}: Invalid priority '{rec['priority']}' (expected: {valid_priorities})")

        # Check estimated benefit is numeric
        if 'estimated_benefit' in rec:
            try:
                benefit = float(rec['estimated_benefit'])
                if benefit < 0:
                    warnings.append(f"Recommendation {i}: Estimated benefit cannot be negative")
            except (ValueError, TypeError):
                warnings.append(f"Recommendation {i}: Invalid estimated benefit value")

def validate_metadata(metadata: Dict, issues: List[str], warnings: List[str]):
    """Validate report metadata"""
    if not isinstance(metadata, dict):
        issues.append("Report metadata must be an object")
        return

    # Check for key metadata fields
    key_fields = ['generated_at', 'report_type', 'organization']
    for field in key_fields:
        if field not in metadata:
            warnings.append(f"Metadata missing '{field}'")

    # Validate report type
    if 'report_type' in metadata:
        valid_types = ['forensic_audit', 'annual_review', 'tax_optimization', 'compliance_check']
        if metadata['report_type'] not in valid_types:
            warnings.append(f"Unknown report type '{metadata['report_type']}'")

def generate_fix_instructions(issues: List[str]) -> str:
    """Generate agent-readable instructions to fix issues"""
    instructions = ["Resolve these report structure errors:"]
    for issue in issues:
        if "missing required sections" in issue.lower():
            instructions.append(f"- {issue} → Add all required sections: {', '.join(REQUIRED_SECTIONS)}")
        elif "executive summary" in issue.lower():
            instructions.append(f"- {issue} → Include: total_opportunity, key_findings, priority_actions")
        elif "recommendations" in issue.lower():
            instructions.append(f"- {issue} → Each recommendation needs: action, estimated_benefit, priority")
        else:
            instructions.append(f"- {issue}")

    instructions.append("\nRequired Report Sections:")
    for section in REQUIRED_SECTIONS:
        instructions.append(f"  - {section}")

    instructions.append("\nRecommended Report Sections:")
    for section in RECOMMENDED_SECTIONS[:3]:
        instructions.append(f"  - {section}")

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
            log_validation("✅ Report Structure Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ Report Structure Validation FAILED: {len(result['issues'])} issues", "ERROR")
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
