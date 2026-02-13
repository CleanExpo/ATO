#!/usr/bin/env python3
"""
Generate detailed CSV reports for accountant verification.
Creates transaction-level exports that can be cross-referenced with Xero.
"""

import json
import csv
import os
from datetime import datetime

def load_json(filepath):
    with open(filepath, 'r') as f:
        data = json.load(f)
    return data.get('results', [])

def generate_csv_reports(results, company_name, output_dir):
    """Generate multiple CSV reports for accountant"""

    os.makedirs(output_dir, exist_ok=True)

    # 1. MASTER TRANSACTION LIST
    master_file = f"{output_dir}/{company_name}_All_Transactions.csv"
    with open(master_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Financial Year', 'Date', 'Transaction ID', 'Supplier', 'Amount',
            'Description', 'Category', 'Category Confidence',
            'Deduction Type', 'Claimable Amount', 'Fully Deductible',
            'R&D Candidate', 'R&D Confidence', 'R&D Reasoning',
            'FBT Risk', 'Div7A Risk', 'Requires Documentation',
            'Compliance Notes'
        ])
        for r in results:
            notes = '; '.join(r.get('compliance_notes') or [])
            desc = r.get('transaction_description') or ''
            reasoning = r.get('rnd_reasoning') or ''
            writer.writerow([
                r.get('financial_year', ''),
                r.get('transaction_date', ''),
                r.get('transaction_id', ''),
                r.get('supplier_name', ''),
                r.get('transaction_amount', ''),
                desc[:100],
                r.get('primary_category', ''),
                r.get('category_confidence', ''),
                r.get('deduction_type', ''),
                r.get('claimable_amount', ''),
                'Yes' if r.get('is_fully_deductible') else 'No',
                'Yes' if r.get('is_rnd_candidate') else 'No',
                r.get('rnd_confidence', ''),
                reasoning[:150],
                'YES - REVIEW' if r.get('fbt_implications') else 'No',
                'YES - REVIEW' if r.get('division7a_risk') else 'No',
                'Yes' if r.get('requires_documentation') else 'No',
                notes[:200]
            ])
    print(f"Created: {master_file}")

    # 2. HIGH-VALUE DEDUCTIONS (>$500)
    high_value = [r for r in results if (r.get('claimable_amount') or 0) > 500]
    high_value.sort(key=lambda x: x.get('claimable_amount', 0), reverse=True)

    hv_file = f"{output_dir}/{company_name}_High_Value_Deductions.csv"
    with open(hv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'PRIORITY', 'Financial Year', 'Date', 'Supplier', 'Amount',
            'Claimable', 'Deduction Type', 'Category', 'Confidence',
            'Transaction ID', 'Documentation Required', 'Notes'
        ])
        for i, r in enumerate(high_value, 1):
            notes = '; '.join(r.get('compliance_notes') or [])
            writer.writerow([
                i,
                r.get('financial_year', ''),
                r.get('transaction_date', ''),
                r.get('supplier_name', ''),
                r.get('transaction_amount', ''),
                r.get('claimable_amount', ''),
                r.get('deduction_type', ''),
                r.get('primary_category', ''),
                r.get('deduction_confidence', ''),
                r.get('transaction_id', ''),
                'Yes' if r.get('requires_documentation') else 'No',
                notes[:150]
            ])
    print(f"Created: {hv_file} ({len(high_value)} records)")

    # 3. R&D CANDIDATES
    rnd = [r for r in results if r.get('is_rnd_candidate')]
    rnd.sort(key=lambda x: x.get('transaction_amount', 0) or 0, reverse=True)

    rnd_file = f"{output_dir}/{company_name}_RnD_Candidates.csv"
    with open(rnd_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Financial Year', 'Date', 'Supplier', 'Amount',
            'Activity Type', 'R&D Confidence', 'Meets Div355',
            'Outcome Unknown', 'Systematic', 'New Knowledge', 'Scientific Method',
            'Reasoning', 'Transaction ID'
        ])
        for r in rnd:
            reasoning = r.get('rnd_reasoning') or ''
            writer.writerow([
                r.get('financial_year', ''),
                r.get('transaction_date', ''),
                r.get('supplier_name', ''),
                r.get('transaction_amount', ''),
                r.get('rnd_activity_type', ''),
                r.get('rnd_confidence', ''),
                'Yes' if r.get('meets_div355_criteria') else 'No',
                'Yes' if r.get('div355_outcome_unknown') else 'No',
                'Yes' if r.get('div355_systematic_approach') else 'No',
                'Yes' if r.get('div355_new_knowledge') else 'No',
                'Yes' if r.get('div355_scientific_method') else 'No',
                reasoning[:200],
                r.get('transaction_id', '')
            ])
    print(f"Created: {rnd_file} ({len(rnd)} records)")

    # 4. FBT IMPLICATIONS
    fbt = [r for r in results if r.get('fbt_implications')]
    fbt_file = f"{output_dir}/{company_name}_FBT_Review_Required.csv"
    with open(fbt_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Financial Year', 'Date', 'Supplier', 'Amount',
            'Category', 'Description', 'Compliance Notes', 'Transaction ID'
        ])
        for r in fbt:
            notes = '; '.join(r.get('compliance_notes') or [])
            desc = r.get('transaction_description') or ''
            writer.writerow([
                r.get('financial_year', ''),
                r.get('transaction_date', ''),
                r.get('supplier_name', ''),
                r.get('transaction_amount', ''),
                r.get('primary_category', ''),
                desc[:100],
                notes[:200],
                r.get('transaction_id', '')
            ])
    print(f"Created: {fbt_file} ({len(fbt)} records)")

    # 5. DIVISION 7A RISKS
    div7a = [r for r in results if r.get('division7a_risk')]
    div7a_file = f"{output_dir}/{company_name}_Division7A_Review.csv"
    with open(div7a_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Financial Year', 'Date', 'Supplier', 'Amount',
            'Category', 'Description', 'Compliance Notes', 'Transaction ID'
        ])
        for r in div7a:
            notes = '; '.join(r.get('compliance_notes') or [])
            desc = r.get('transaction_description') or ''
            writer.writerow([
                r.get('financial_year', ''),
                r.get('transaction_date', ''),
                r.get('supplier_name', ''),
                r.get('transaction_amount', ''),
                r.get('primary_category', ''),
                desc[:100],
                notes[:200],
                r.get('transaction_id', '')
            ])
    print(f"Created: {div7a_file} ({len(div7a)} records)")

    # 6. BY FINANCIAL YEAR SUMMARY
    by_fy = {}
    for r in results:
        fy = r.get('financial_year', 'Unknown')
        if fy not in by_fy:
            by_fy[fy] = {'count': 0, 'total': 0, 'claimable': 0, 'rnd': 0, 'fbt': 0, 'div7a': 0}
        by_fy[fy]['count'] += 1
        by_fy[fy]['total'] += abs(r.get('transaction_amount', 0) or 0)
        by_fy[fy]['claimable'] += r.get('claimable_amount', 0) or 0
        if r.get('is_rnd_candidate'): by_fy[fy]['rnd'] += 1
        if r.get('fbt_implications'): by_fy[fy]['fbt'] += 1
        if r.get('division7a_risk'): by_fy[fy]['div7a'] += 1

    summary_file = f"{output_dir}/{company_name}_Summary_By_FY.csv"
    with open(summary_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Financial Year', 'Transaction Count', 'Total Amount', 'Claimable Amount', 'R&D Candidates', 'FBT Issues', 'Div7A Issues'])
        for fy in sorted(by_fy.keys()):
            d = by_fy[fy]
            writer.writerow([fy, d['count'], f"${d['total']:,.2f}", f"${d['claimable']:,.2f}", d['rnd'], d['fbt'], d['div7a']])
    print(f"Created: {summary_file}")

    # 7. DEDUCTIONS BY CATEGORY
    by_cat = {}
    for r in results:
        cat = r.get('primary_category', 'Unknown')
        if cat not in by_cat:
            by_cat[cat] = {'count': 0, 'total': 0, 'claimable': 0}
        by_cat[cat]['count'] += 1
        by_cat[cat]['total'] += abs(r.get('transaction_amount', 0) or 0)
        by_cat[cat]['claimable'] += r.get('claimable_amount', 0) or 0

    cat_file = f"{output_dir}/{company_name}_By_Category.csv"
    with open(cat_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Category', 'Transaction Count', 'Total Amount', 'Claimable Amount'])
        for cat in sorted(by_cat.keys(), key=lambda x: by_cat[x]['claimable'], reverse=True):
            d = by_cat[cat]
            writer.writerow([cat, d['count'], f"${d['total']:,.2f}", f"${d['claimable']:,.2f}"])
    print(f"Created: {cat_file}")

    return {
        'total_transactions': len(results),
        'high_value': len(high_value),
        'rnd_candidates': len(rnd),
        'fbt_issues': len(fbt),
        'div7a_issues': len(div7a)
    }


if __name__ == '__main__':
    output_base = 'D:/ATO/reports/accountant'

    print("=" * 60)
    print("GENERATING ACCOUNTANT REPORTS")
    print("=" * 60)

    # DRQ
    drq = load_json('D:/ATO/reports/accountant/drq_results.json')
    print(f"\nDisaster Recovery Qld: {len(drq)} transactions")
    drq_stats = generate_csv_reports(drq, 'DRQ', output_base)

    # DR
    dr = load_json('D:/ATO/reports/accountant/dr_results.json')
    print(f"\nDisaster Recovery Pty Ltd: {len(dr)} transactions")
    dr_stats = generate_csv_reports(dr, 'DR', output_base)

    # CARSI
    carsi = load_json('D:/ATO/reports/accountant/carsi_results.json')
    print(f"\nCARSI: {len(carsi)} transactions")
    carsi_stats = generate_csv_reports(carsi, 'CARSI', output_base)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"DRQ:   {drq_stats}")
    print(f"DR:    {dr_stats}")
    print(f"CARSI: {carsi_stats}")
    print(f"\nAll reports saved to: {output_base}/")
