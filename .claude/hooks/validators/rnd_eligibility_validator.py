#!/usr/bin/env python3
"""
R&D Eligibility Validator
Purpose: Validate Division 355 R&D tax incentive eligibility criteria
Validates: Four-element test, confidence scores, supporting evidence
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

# Division 355 thresholds
MIN_CONFIDENCE_FOR_RECOMMENDATION = 70
REQUIRED_CRITERIA = ['outcome_unknown', 'systematic_approach', 'new_knowledge', 'scientific_method']

def validate(data: Any) -> Dict[str, Any]:
    """
    Validate R&D eligibility per Division 355 four-element test
    """
    issues = []
    warnings = []

    try:
        # Parse data
        if isinstance(data, str):
            try:
                rnd_data = json.loads(data)
            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON format: {str(e)}")
                return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}
        elif isinstance(data, dict):
            rnd_data = data
        else:
            issues.append(f"Invalid data type: expected dict or JSON string, got {type(data)}")
            return {"valid": False, "issues": issues, "warnings": warnings, "fix_instructions": generate_fix_instructions(issues)}

        log_validation("Validating R&D eligibility criteria")

        # Check if this is assessment data (direct criteria) or analysis result (nested criteria)
        if 'eligibility_criteria' in rnd_data:
            criteria_data = rnd_data['eligibility_criteria']
        elif any(criterion in rnd_data for criterion in REQUIRED_CRITERIA):
            criteria_data = rnd_data
        else:
            warnings.append("No R&D eligibility criteria found in data")
            return {"valid": True, "issues": issues, "warnings": warnings, "fix_instructions": None}

        # Validate all four Division 355 elements are present and assessed
        missing_criteria = []
        for criterion in REQUIRED_CRITERIA:
            if criterion not in criteria_data:
                missing_criteria.append(criterion)

        if missing_criteria:
            issues.append(f"Missing Division 355 criteria: {', '.join(missing_criteria)}")

        # Validate each criterion has proper structure
        for criterion in REQUIRED_CRITERIA:
            if criterion in criteria_data:
                criterion_value = criteria_data[criterion]

                # Check if it's a simple boolean or structured object
                if isinstance(criterion_value, dict):
                    # Structured format with met/confidence/evidence
                    if 'met' not in criterion_value:
                        issues.append(f"Criterion '{criterion}': Missing 'met' field")
                    elif not isinstance(criterion_value['met'], bool):
                        issues.append(f"Criterion '{criterion}': 'met' field must be boolean")

                    if 'confidence' in criterion_value:
                        confidence = criterion_value['confidence']
                        if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 100:
                            issues.append(f"Criterion '{criterion}': Confidence must be 0-100")

                    if 'evidence' in criterion_value:
                        evidence = criterion_value['evidence']
                        if not isinstance(evidence, (list, str)) or (isinstance(evidence, list) and len(evidence) == 0):
                            warnings.append(f"Criterion '{criterion}': No supporting evidence provided")

                elif isinstance(criterion_value, bool):
                    # Simple boolean format
                    if not criterion_value:
                        log_validation(f"⚠️  Criterion '{criterion}' not met")
                else:
                    issues.append(f"Criterion '{criterion}': Invalid value type (expected bool or dict)")

        # Validate ALL FOUR elements must be TRUE for eligibility
        all_criteria_met = True
        for criterion in REQUIRED_CRITERIA:
            if criterion in criteria_data:
                criterion_value = criteria_data[criterion]
                if isinstance(criterion_value, dict):
                    if not criterion_value.get('met', False):
                        all_criteria_met = False
                        log_validation(f"Criterion '{criterion}' not met")
                elif isinstance(criterion_value, bool):
                    if not criterion_value:
                        all_criteria_met = False
                        log_validation(f"Criterion '{criterion}' not met")

        if not all_criteria_met:
            warnings.append("Not all Division 355 criteria met - R&D eligibility may be questionable")

        # Check if is_eligible field matches criteria assessment
        if 'is_eligible' in rnd_data or 'meets_div355_criteria' in rnd_data:
            stated_eligible = rnd_data.get('is_eligible') or rnd_data.get('meets_div355_criteria')
            if stated_eligible and not all_criteria_met:
                issues.append("Marked as eligible but not all four Division 355 criteria are met")
            elif not stated_eligible and all_criteria_met:
                warnings.append("Marked as not eligible but all four Division 355 criteria appear to be met")

        # Validate confidence score
        confidence_fields = ['confidence', 'rnd_confidence', 'overall_confidence']
        confidence = None
        for field in confidence_fields:
            if field in rnd_data:
                confidence = rnd_data[field]
                break

        if confidence is not None:
            try:
                confidence_value = float(confidence)
                if confidence_value < 0 or confidence_value > 100:
                    issues.append(f"Confidence score must be 0-100, got {confidence_value}")
                elif confidence_value < MIN_CONFIDENCE_FOR_RECOMMENDATION:
                    warnings.append(f"Confidence score {confidence_value}% is below recommended threshold of {MIN_CONFIDENCE_FOR_RECOMMENDATION}% for claiming R&D offset")
                else:
                    log_validation(f"✓ Confidence score {confidence_value}% meets threshold")
            except (ValueError, TypeError):
                issues.append(f"Invalid confidence value: {confidence}")

        # Check for supporting documentation
        if 'documentation_required' in rnd_data:
            docs = rnd_data['documentation_required']
            if isinstance(docs, list) and len(docs) == 0:
                warnings.append("No documentation requirements specified - R&D claims require supporting evidence")

        # Validate activity type classification
        if 'activity_type' in rnd_data or 'rnd_activity_type' in rnd_data:
            activity_type = rnd_data.get('activity_type') or rnd_data.get('rnd_activity_type')
            valid_types = ['core_rnd', 'supporting_rnd', 'not_eligible']
            if activity_type not in valid_types:
                issues.append(f"Invalid activity type '{activity_type}' - must be one of: {valid_types}")

            # Core R&D should have all criteria met
            if activity_type == 'core_rnd' and not all_criteria_met:
                issues.append("Activity classified as 'core_rnd' but not all Division 355 criteria are met")

        # Validate registration deadline if provided
        if 'registration_deadline' in rnd_data:
            deadline = rnd_data['registration_deadline']
            if not isinstance(deadline, str) or not deadline:
                warnings.append("Registration deadline not properly formatted")

        log_validation("R&D eligibility validation complete")

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
    instructions = ["Resolve these R&D eligibility validation errors:"]
    for issue in issues:
        if "missing division 355 criteria" in issue.lower():
            instructions.append(f"- {issue} → Assess all four elements: outcome unknown, systematic approach, new knowledge, scientific method")
        elif "not all four" in issue.lower() and "met" in issue.lower():
            instructions.append(f"- {issue} → ALL FOUR Division 355 criteria must be TRUE for R&D eligibility")
        elif "confidence" in issue.lower():
            instructions.append(f"- {issue} → Provide confidence score 0-100 (≥70% recommended for recommendations)")
        elif "evidence" in issue.lower():
            instructions.append(f"- {issue} → Document supporting evidence for each criterion")
        else:
            instructions.append(f"- {issue}")

    instructions.append("\nDivision 355 Four-Element Test:")
    instructions.append("1. Outcome Unknown: Could not be known in advance by a competent professional")
    instructions.append("2. Systematic Approach: Planned and executed in a systematic manner")
    instructions.append("3. New Knowledge: Generates new knowledge (not routine application)")
    instructions.append("4. Scientific Method: Based on principles of established sciences")

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
        log_validation(f"Starting R&D eligibility validation")
        result = validate(input_data)

        # Log results
        if result["valid"]:
            log_validation("✅ R&D Eligibility Validation PASSED", "SUCCESS")
            if result["warnings"]:
                for warning in result["warnings"]:
                    log_validation(f"⚠️  {warning}", "WARNING")
            sys.exit(0)
        else:
            log_validation(f"❌ R&D Eligibility Validation FAILED: {len(result['issues'])} issues", "ERROR")
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
