---
description: Proactively scout for tax optimization opportunities, new grants, and deadline alerts
---

# /scout - Agent Scout Workflow

The Agent Scout proactively discovers opportunities you don't know you're missing. It monitors legislative changes, new grants, approaching deadlines, and recommends which specialized agents to deploy.

## Quick Commands

```bash
/scout                    # Quick scan (critical items only)
/scout comprehensive      # Full analysis across all areas  
/scout grants            # Focus on government grants
/scout deadlines         # Deadline tracking only
/scout [ABN]             # Scout specific entity
```

## Workflow Steps

### Step 1: Initialize Entity Profiles
Load all registered entities for scanning:

**Your Entities**:
| ABN | Type | Name |
|-----|------|------|
| 62 580 077 456 | Sole Trader | Carsi |
| 85 151 794 142 | Private Company | ACN 151 794 142 |
| 42 633 062 307 | Private Company | ACN 633 062 307 |
| 45 397 296 079 | Discretionary Trust | Clean Expo 247 |

### Step 2: Run Discovery Scan
The Scout checks these areas:

#### A. Legislative Changes
- [ ] Check ATO recent rulings and determinations
- [ ] Review Treasury announcements
- [ ] Monitor state revenue office updates
- [ ] Track industry-specific changes

#### B. Grant Opportunities
- [ ] Scan business.gov.au for new federal grants
- [ ] Check state grant portals (QLD, NSW, VIC, WA)
- [ ] Identify EMDG and export programs
- [ ] Find industry-specific funding

#### C. Deadline Tracking
- [ ] R&D Tax Incentive registration (10 months after FY end)
- [ ] Tax return lodgment dates
- [ ] Amendment period expiry
- [ ] FBT return due dates
- [ ] BAS/IAS lodgment dates
- [ ] Grant application closing dates

#### D. Concession Eligibility
- [ ] SBITO for sole trader and trust beneficiaries
- [ ] Base Rate Entity status for companies
- [ ] Small Business CGT concession eligibility
- [ ] FBT exemption opportunities
- [ ] Instant Asset Write-Off tracking

### Step 3: Generate Scout Report

The report includes:

1. **Critical Alerts** - Items requiring immediate action
2. **New Opportunities** - Recently discovered incentives
3. **Upcoming Deadlines** - Time-sensitive items
4. **Agent Recommendations** - Which specialists to deploy

### Step 4: Deploy Recommended Agents

Based on discoveries, deploy specialized agents:

| Discovery Type | Recommended Agent |
|---------------|-------------------|
| R&D Activities | `/rnd-assessment` → `rnd_tax_specialist` |
| New Grants | `/grants` → `government_grants_finder` |
| Trust Issues | `/trust-check` → `trust_distribution_analyzer` |
| CGT Planning | `/cgt-plan` → `cgt_concession_planner` |
| Deductions | `/deduction-scan` → `deduction_optimizer` |
| FBT Review | `/fbt-review` → `fbt_optimizer` |

## Current Alerts (as of Jan 2026)

### ⚠️ Critical
1. **R&D Registration Deadline**: 101 days (April 30, 2026)
   - Applicable: ABN 85 151 794 142, ABN 42 633 062 307
   - Action: Register eligible activities with AusIndustry

2. **QLD Business Growth Fund Round 7**: 11 days (January 30, 2026)
   - Applicable: All QLD-based entities
   - Action: Submit grant application

### 🔔 High Priority
3. **Trust Distribution Resolution Required**: Before June 30, 2026
   - Applicable: ABN 45 397 296 079 (Clean Expo 247)
   - Action: Review beneficiary allocations

4. **EMDG Round 4 Open**: Now accepting applications
   - Applicable: Entities exporting services
   - Value: Up to $80,000/year

### 📅 Upcoming Deadlines
- **Feb 28, 2026**: Q2 BAS Lodgment
- **Mar 31, 2026**: FBT Year End
- **Apr 30, 2026**: R&D Tax Registration (FY2024-25)
- **May 21, 2026**: FBT Return Due
- **Jun 30, 2026**: Financial Year End

## Integration with Other Workflows

After running `/scout`, you can directly invoke:

- `/rnd-assessment` - If R&D activities discovered
- `/tax-audit` - For comprehensive Xero analysis
- `/deduction-scan` - For deduction optimization
- `/loss-analysis` - For loss and Division 7A review

## Scan Frequency Recommendations

| Scan Type | Frequency | Purpose |
|-----------|-----------|---------|
| Quick (`/scout`) | Weekly | Check critical items |
| Comprehensive | Monthly | Full opportunity review |
| Grants | Daily/Weekly | Catch new openings |
| Deadlines | Daily | Never miss a deadline |

## Example Output

```
╔══════════════════════════════════════════════════════════════╗
║                     🔍 AGENT SCOUT REPORT                    ║
║                       2026-01-19                             ║
╠══════════════════════════════════════════════════════════════╣
║ Entities Monitored: 4                                        ║
║ Discoveries: 27 (2 Critical, 5 High, 8 Medium, 12 Low)       ║
╠══════════════════════════════════════════════════════════════╣
║ ⚠️  CRITICAL ALERTS                                          ║
║ 1. R&D Registration deadline: 101 days                       ║
║    → Deploy: rnd_tax_specialist                              ║
║ 2. QLD Grant closing: 11 days                                ║
║    → Deploy: government_grants_finder                        ║
╠══════════════════════════════════════════════════════════════╣
║ 💡 NEW OPPORTUNITIES                                         ║
║ • EMDG Round 4 now open ($30K-$80K/year)                    ║
║ • Energy Efficiency Grants (up to $25K)                      ║
║ • SBITO available for sole trader ($1,000)                   ║
╠══════════════════════════════════════════════════════════════╣
║ 📅 UPCOMING DEADLINES                                        ║
║ Feb 28: Q2 BAS Lodgment                                      ║
║ Apr 30: R&D Tax Registration (FY2024-25)                     ║
║ May 21: FBT Return Due                                       ║
║ Jun 30: Trust Distribution Resolution                        ║
╚══════════════════════════════════════════════════════════════╝
```
