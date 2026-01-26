# PROJECT: Australian Tax Optimizer (ATO)

## Vision
A mission-critical tax recovery and optimisation platform that integrates with Xero accounting software and uses AI forensic analysis to identify missed tax benefits, correct ledger misclassifications, and maximise legal refunds for Australian businesses.

## Problem Statement
Australian businesses routinely miss significant tax benefits due to:
- Misclassified transactions in accounting software
- Lack of awareness of available incentives (R&D Tax Incentive, instant asset write-off)
- Complex Division 7A private company loan rules
- Unclaimed deductions and carry-forward losses
- Manual review being cost-prohibitive for high-volume transaction sets

## Solution
An AI-powered forensic analysis system that:
1. Connects to Xero via OAuth (read-only)
2. Analyses all historical transactions using Gemini AI
3. Identifies R&D Tax Incentive candidates (Division 355 - 43.5% offset)
4. Flags Division 7A loan compliance issues
5. Discovers unclaimed deductions and carry-forward losses
6. Generates accountant-ready verification reports

## Target Outcome
- **Primary**: $200K-$500K tax benefit recovery per client
- **Secondary**: Compliance assurance (FBT, Division 7A, COT/SBT)
- **Tertiary**: Audit-ready documentation for accountants

## Technology Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript 5.x |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Accounting | Xero OAuth 2.0 (READ-ONLY) |
| AI Analysis | Google Gemini (gemini-2.0-flash-exp) |
| Deployment | Vercel |

## Current State (as of 27 Jan 2026)
- **Production URL**: https://ato-blush.vercel.app
- **Companies Analysed**: 3 (DRQ, DR, CARSI)
- **Total Transactions**: 10,488
- **Net Benefit Identified**: $484,190.66
- **Engine Overhaul**: Complete (23 fixes across 5 tax engines)

## Key Legislation
- Division 355 ITAA 1997 (R&D Tax Incentive)
- Division 7A ITAA 1936 (Private Company Loans)
- Section 8-1 ITAA 1997 (General Deductions)
- Subdivision 36-A ITAA 1997 (Tax Losses)
- Subdivision 328-D ITAA 1997 (Instant Asset Write-Off)

## Stakeholders
- **Primary User**: Business owners seeking tax recovery
- **Verification**: External accountants (CPA/CTA qualified)
- **Integration**: Xero accounting platform

## Constraints
- Read-only Xero access (never modify source data)
- Analysis only (never file ATO returns)
- Professional review required for all recommendations
- Australian tax law jurisdiction only
