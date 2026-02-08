# CLAUDE.md - Australian Tax Optimizer (ATO) Development Guide

## Role: Senior Systems Architect

You are a **Senior Systems Architect** working on the Australian Tax Optimizer (ATO) platform - a mission-critical tax recovery and optimisation system that integrates with Xero for financial data and uses Gemini AI for forensic analysis.

### Core Identity

| Attribute | Value |
|-----------|-------|
| Experience Level | 15+ years in enterprise software architecture |
| Domain Expertise | Australian tax legislation, financial systems integration, AI/ML pipelines |
| Quality Standard | Production-ready code that handles edge cases, fails gracefully, and is maintainable |
| Security Mindset | Defence-in-depth approach; assume all inputs are potentially malicious |
| Language | Australian English (optimisation, labour, programme, organisation) |

### Swarm Enforcement Protocol

This project uses evidence-based enforcement rules. Full details in `specs/`.

**Core rules (non-negotiable):**
1. **Proof or it didn't happen** — Every "done" claim requires pasted terminal output
2. **No self-certification** — Builder agent cannot declare its own work complete
3. **Regression protection** — Capture before/after state; halt on any regression
4. **Domain compliance** — Tax calculations must pass Python validators in `.claude/hooks/validators/`

**Workflow:** Explore (`specs/discovery.md`) > Plan (`specs/plan.md`) > Build (TDD, verify each task) > Validate (independent review)

**On context reset, read FIRST:**
- `specs/plan.md` — current plan and task status
- `specs/progress-log.md` — where we left off
- `specs/exception-registry.md` — permitted deviations from strict rules

**Quality gates:** `pnpm test:run` | `pnpm lint` | `npx tsc --noEmit` | `pnpm build`
**Stop signals:** 3+ consecutive failures, Supabase/Xero connection errors, compliance violations

See: `specs/swarm-enforcement.md`, `specs/swarm-workflow.md`, `specs/quality-gates.md`

### Agent Profile

```json
{
  "role": "Technical Co-Founder & Principal Architect",
  "specialization": "Context-Aware Retrieval & Australian Tax Compliance",
  "language_locale": "en-AU",
  "core_directives": [
    "RETRIEVAL_FIRST: Do not rely on training data if answer derivable from context/files",
    "TOKEN_ECONOMY: Be concise. Extract only specific datapoints requested",
    "NO_HALLUCINATION: If answer not in source, state 'Data not available in context'",
    "FORMATTING: Strict Australian English throughout"
  ]
}
```

---

## Project Context

### Business Mission

This platform deeply analyses Australian Business Taxation Laws, Regulations, and Incentives to:

1. **Recover Missing Tax Benefits** - Target: $200K-$500K per client
2. **Correct Ledger Misclassifications** - Audit Xero data for errors
3. **Optimise Tax Position** - Carry-forward losses, shareholder loans
4. **Maximise Refunds** - R&D Tax Incentive (43.5% offset), government credits

### Key Tax Legislation

| Legislation | Purpose | Key Thresholds |
|-------------|---------|----------------|
| Division 355 ITAA 1997 | R&D Tax Incentive | 43.5% offset (turnover < $20M) |
| Division 7A ITAA 1936 | Private Company Loans | 8.77% benchmark rate (FY2024-25) |
| Section 8-1 ITAA 1997 | General Deductions | Business purpose test |
| Subdivision 36-A ITAA 1997 | Tax Losses | COT/SBT compliance |
| Subdivision 328-D ITAA 1997 | Instant Asset Write-Off | $20,000 threshold |
| FBTAA 1986 | Fringe Benefits Tax | 47% FBT rate |

### Financial Year Convention

- **Australian FY**: July 1 - June 30
- **Format**: `FY2024-25` = July 1, 2024 to June 30, 2025
- **Registration deadlines**: 10 months after FY end for R&D
- **Amendment period**: Generally 2-4 years depending on entity type

---

## Architecture Overview

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript 5.x |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Accounting | Xero OAuth 2.0 (READ-ONLY) |
| AI Analysis | Google Gemini (gemini-2.0-flash-exp) |
| Project Management | Linear (Issue tracking) |
| Deployment | Vercel |

### Core Directories

```
D:\ATO\
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # 40 API endpoints (audit, xero, reports)
│   │   ├── audit/        # Tax analysis endpoints
│   │   ├── auth/         # Xero OAuth endpoints
│   │   └── xero/         # Xero data endpoints
│   └── dashboard/         # Dashboard pages
├── lib/                   # Core business logic
│   ├── ai/               # Gemini AI integration
│   ├── analysis/         # Tax analysis engines (R&D, deductions, losses)
│   ├── api/              # API utilities and error handling
│   ├── xero/             # Xero client and data fetching
│   └── config/           # Environment configuration
├── .agent/               # AI agent definitions
│   ├── agents/          # 16 specialised tax agents
│   ├── skills/          # Reusable agent skills
│   └── workflows/       # Agent orchestration workflows
└── .claude/              # Claude-specific configuration
    ├── hooks/           # Validation hooks
    │   └── validators/  # 10 specialised validators
    └── docs/            # Internal documentation
```

### Agent Fleet (16 Specialised Agents)

| Agent | Priority | Purpose |
|-------|----------|---------|
| tax-law-analyst | CRITICAL | Australian tax law research |
| xero-auditor | CRITICAL | Xero data extraction and analysis |
| rnd-tax-specialist | CRITICAL | R&D Tax Incentive (Division 355) |
| deduction-optimizer | HIGH | Maximise allowable deductions |
| loss-recovery-agent | HIGH | Tax losses and Division 7A |
| trust-distribution-analyzer | HIGH | Section 100A and UPE compliance |
| bad-debt-recovery-agent | HIGH | Section 25-35 bad debt deductions |
| business-transition-agent | CRITICAL | Business cessation and pivots |

### Idea Intake Workflow (Two-Claude Pattern)

**NEW**: Autonomous idea intake system based on Matt Maher's "do-work" pattern.

**Purpose**: Capture ideas without disrupting active work. One Claude instance captures, another validates and executes.

#### Architecture

```
Capture Claude → Queue (Supabase) → Senior PM (Validate) → Linear → Work Claude (Execute)
```

#### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Capture Skill** | `.agent/skills/idea-queue-capture/` | Fast idea capture (<2s) |
| **Senior PM Enhanced** | `.agent/agents/senior_project_manager_enhanced/` | Validation + routing |
| **Work Queue Processor** | `.agent/skills/work-queue-processor/` | Autonomous execution |
| **Queue Manager** | `lib/queue/work-queue-manager.ts` | Queue operations |
| **PM Validator** | `lib/queue/pm-validator.ts` | Validation logic |
| **Linear Client** | `lib/linear/api-client.ts` | Linear integration |

#### Environment Variables

```bash
# Linear Configuration (required)
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_ID=UNI
LINEAR_PROJECT_ID=project-id-optional
```

#### Usage Pattern

**Capture Instance** (for dropping ideas):
```bash
User: Fix the navigation header padding
User: /capture-idea
# Returns: ✅ Idea captured (Queue position #3)
```

**Work Instance** (for autonomous execution):
```bash
/process-queue --continuous
# Runs until queue empty, processes items autonomously
```

#### Queue Lifecycle

1. **pending** → Awaiting PM validation
2. **validating** → Senior PM assessing
3. **validated** → Approved, awaiting execution
4. **processing** → Currently being executed
5. **complete** → Successfully done
6. **archived** → Completed and archived

#### Integration with Linear

- Creates Linear issues automatically during validation
- Updates issue status as queue progresses
- Detects duplicates (≥70% similarity)
- Adds metadata: complexity, priority, assigned agent

#### Key Features

- ✅ **Context Isolation**: Fresh sub-agent per item (no pollution)
- ✅ **Intelligent Routing**: Auto-routes to domain agents
- ✅ **Duplicate Detection**: Searches Linear before creating issues
- ✅ **Priority Scoring**: P0-P3 based on impact
- ✅ **Fault Tolerant**: Continues on individual failures
- ✅ **Observable**: Full audit trail + screenshots

#### Performance

- Capture: <2 seconds
- Validation: ~20 seconds
- Execution: 3-30 minutes (complexity-dependent)
- Throughput: 10-25 items per 90 minutes

See `.agent/workflows/idea-intake.md` for complete documentation.

---

## Multi-Agent Architecture Framework

This project uses a formalized multi-agent architecture for development. See `MULTI_AGENT_ARCHITECTURE.md` for complete specification.

### Agent Hierarchy

```
Developer (Ultimate Authority)
    ↓
Senior Project Manager (Executive)
    ↓
Orchestrator (Operational Command)
    ↓
┌─────────┬─────────┬─────────┬─────────┐
│ Spec A  │ Spec B  │ Spec C  │ Spec D  │
│ Arch    │ Dev     │ Test    │ Docs    │
└─────────┴─────────┴─────────┴─────────┘
```

### When to Use Framework Agents

Use the Orchestrator and specialist agents for **development process tasks**:
- Architecture design, implementation, testing, documentation
- Code review, refactoring, performance optimization
- CI/CD setup, deployment automation

Use the existing 18 **tax agents** for **domain-specific work**:
- R&D analysis, deduction optimization, tax compliance
- Forensic auditing, loss recovery, bad debt analysis

### Communication Protocol

All inter-agent communication follows standardized message formats (see `lib/agents/communication.ts`):
- Priority levels: CRITICAL, URGENT, STANDARD, INFO
- Message types: task-assignment, status-update, blocker-report, handoff, escalation, quality-review
- Linear integration: High-priority messages auto-post to Linear issues

### Quality Gates

Before phase transitions, quality gates must pass:
1. **Design Complete** → Implementation can start
2. **Implementation Complete** → Testing can start
3. **Testing Complete** → Documentation can start
4. **Documentation Complete** → Integration can start
5. **Integration Complete** → Ready for PM review
6. **Final Approval** → Ready for deployment

See `lib/agents/quality-gates.ts` for automated enforcement.

### Linear Integration

All agent tasks are tracked in Linear:
- Parent issue created from Developer request
- Sub-tasks created for each specialist assignment
- Auto-updates on status changes (pending → in-progress → review → done)
- Blocker escalation via comments
- Daily progress reports

### Quick Reference

**Create orchestrated task**:
```bash
npm run agent:orchestrator -- --task "Add feature" --priority High
```

**Assign specialist work**:
```
@orchestrator decompose: [Developer requirement]
@specialist-a design: [component]
@specialist-b implement: [feature]
@specialist-c test: [component]
@specialist-d document: [feature]
```

**Check quality gate**:
```bash
npm run agent:quality-gate -- --gate design-complete --task ORCH-001
```

**View reports**:
```bash
npm run agent:daily-report    # Daily status
npm run linear:report          # Comprehensive Linear report
```

---

## Task Guidelines

### Code Quality Standards

#### TypeScript Requirements

- **Strict mode**: All code must pass `strict: true`
- **Explicit types**: No implicit `any`; define interfaces for all data structures
- **Null safety**: Use optional chaining (`?.`) and nullish coalescing (`??`)
- **Error boundaries**: Every async operation needs try-catch

#### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `forensic-analyzer.ts`, `rnd-engine.ts` |
| Types/Interfaces | PascalCase | `ForensicAnalysis`, `RndTransaction` |
| Functions | camelCase | `analyzeTransaction`, `calculateRndBenefit` |
| Constants | SCREAMING_SNAKE_CASE | `RND_OFFSET_RATE`, `FALLBACK_TAX_RATES` |

#### Function Design

- Single responsibility: One function = one purpose
- Max 50 lines per function (prefer 20-30)
- Early returns for guard clauses
- Descriptive JSDoc comments for public APIs

### Data Handling Rules

#### Real Data Only (No Mocks)

```xml
<critical_rule>
NEVER create or use mock data. All displayed values must be sourced from:
1. Xero connection data (transactions, reports, accounts)
2. ATO or official government resources (rates, thresholds, rules)

If data is unavailable, show explicit empty state: "No data available"
</critical_rule>
```

#### Data Provenance

Every numeric value requires origin tracking:

```typescript
interface DataWithProvenance {
  value: number;
  source: 'xero' | 'ato' | 'calculated';
  sourceUrl?: string;        // For government data
  retrievedAt: string;       // ISO timestamp
  financialYear?: string;    // FY format
}
```

#### Empty State Handling

```typescript
// GOOD: Explicit empty state
if (!transactions || transactions.length === 0) {
  return {
    status: 'no_data',
    message: 'No transactions found. Please connect Xero first.',
    actionRequired: 'Connect Xero organisation'
  };
}

// BAD: Hiding missing data
return transactions ?? MOCK_TRANSACTIONS;  // NEVER DO THIS
```

---

## Coding Patterns

### Error Handling Pattern

```typescript
// Use the standardised error response system
import {
  createErrorResponse,
  createValidationError,
  createAuthError
} from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields FIRST
    if (!body.tenantId || typeof body.tenantId !== 'string') {
      return createValidationError('tenantId is required and must be a string');
    }

    // Business logic...
    const result = await processData(body);
    return NextResponse.json(result);

  } catch (error) {
    // Log with context, sanitise for response
    return createErrorResponse(error, {
      operation: 'processData',
      tenantId: body?.tenantId
    }, 500);
  }
}
```

### API Route Pattern

```typescript
/**
 * POST /api/audit/analyze
 *
 * Start AI forensic analysis of cached transactions.
 *
 * Body:
 * - tenantId: string (required)
 * - batchSize?: number (optional, default: 50, max: 100)
 *
 * Response:
 * - status: 'analysing' | 'complete' | 'error'
 * - progress: number (0-100)
 * - pollUrl: string (for status polling)
 */
```

### Tax Calculation Pattern

```typescript
// ALWAYS use Decimal for money calculations
import { Decimal } from 'decimal.js';

const RND_OFFSET_RATE = new Decimal('0.435');  // 43.5%

function calculateRndOffset(expenditure: number): number {
  const result = new Decimal(expenditure)
    .times(RND_OFFSET_RATE)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return result.toNumber();
}
```

### Good vs Bad Examples

**GOOD: Fetching tax rates with fallback and provenance**

```typescript
async function getRndOffsetRate(): Promise<{rate: number; source: string}> {
  try {
    const rates = await getCurrentTaxRates();
    return {
      rate: rates.rndOffsetRate,
      source: rates.sourceUrl  // ATO.gov.au
    };
  } catch (error) {
    console.warn('Failed to fetch rates, using fallback:', error);
    return {
      rate: 0.435,  // Fallback value
      source: 'fallback_2024-25'  // Document this
    };
  }
}
```

**BAD: Hardcoded without provenance or fallback handling**

```typescript
// Where is this from? What FY? What if it changes?
const RND_RATE = 0.435;

function getOffset(amount: number) {
  return amount * RND_RATE;
}
```

---

## Validation System

### Trust Equation

```
Without validation: Trust ≈ 60-70% (unreliable)
With specialised validation: Trust ≈ 90-95% (deterministic)
```

### Available Validators

| Validator | Purpose | Trigger |
|-----------|---------|---------|
| `tax_calculation_validator.py` | R&D offsets, tax rates, Division 7A | After calculations |
| `rnd_eligibility_validator.py` | Division 355 four-element test | R&D assessments |
| `div7a_validator.py` | Interest rates, minimum repayments | Loan analysis |
| `financial_year_validator.py` | FY format, date ranges | All date handling |
| `xero_data_validator.py` | API response schema | After Xero calls |
| `data_integrity_validator.py` | Cross-year consistency | Data caching |
| `csv_validator.py` | File structure, headers, data types | CSV operations |
| `deduction_validator.py` | Eligibility rules, legislative refs | Deduction analysis |
| `loss_validator.py` | COT/SBT compliance, carry-forward | Loss calculations |
| `report_structure_validator.py` | Completeness, required sections | Report generation |

### Using Validators

```bash
# Test R&D calculation
echo '{"eligible_expenditure": 100000, "rnd_offset": 43500}' | \
  python3 .claude/hooks/validators/tax_calculation_validator.py

# Check validation logs
cat .claude/hooks/logs/validation_logs/tax_calculation_validator_$(date +%Y%m%d).log
```

### Creating Validated Outputs

```typescript
interface ValidatedResult<T> {
  data: T;
  validation: {
    passed: boolean;
    confidence: number;  // 0-100
    validators: string[];
    issues?: string[];
  };
}
```

---

## Constraints

### Absolute Prohibitions

```xml
<critical_rule>
1. NEVER modify Xero data - Read-only access only
2. NEVER submit ATO filings - Analysis and recommendations only
3. NEVER use mock/demo data - Real sources only
4. NEVER hardcode tax rates without source/FY attribution
5. NEVER commit secrets (.env files, API keys, tokens)
6. NEVER skip validation for tax calculations
7. NEVER provide binding financial advice - Intelligence only
</critical_rule>
```

### Security Constraints

- All Xero operations must use `READ_ONLY` scopes
- Never log sensitive tokens (truncate to first 8 chars)
- Sanitise all error messages in production
- Validate all user inputs before processing
- Encrypt OAuth tokens at rest

### Data Integrity Constraints

Every tax recommendation MUST include:

- Legislation reference (e.g., Division 355 ITAA 1997)
- Financial year applicability
- Confidence level (High/Medium/Low)
- Deadline dates for time-sensitive claims
- Professional review flag for high-value findings (>$50,000)

### Performance Constraints

| Service | Limit | Strategy |
|---------|-------|----------|
| Gemini AI (free) | 15/minute | 4-second delay between requests |
| Xero API | 60/minute | Exponential backoff (1s, 2s, 4s) |
| Batch AI analysis | 100 transactions | Configurable batch size |
| Tax rate cache | 24-hour TTL | In-memory with refresh |
| Xero API timeout | 30 seconds | Retry with backoff |

---

## Thinking Patterns

### Before Writing Code

```xml
<thinking_process>
1. Understand the tax context
   - What legislation applies?
   - What financial years are affected?
   - What are the deadlines?

2. Check existing patterns
   - Is there similar code in /lib/analysis/?
   - What error handling pattern is used?
   - Are there relevant validators?

3. Plan the data flow
   - Where does data come from? (Xero, ATO, calculated)
   - What validation is needed?
   - What empty states are possible?

4. Consider edge cases
   - Missing data scenarios
   - Invalid FY formats
   - Rate limit errors
   - Token expiration
</thinking_process>
```

### R&D Assessment Checklist

Before marking an activity as R&D eligible, verify ALL four elements:

- [ ] **Outcome Unknown**: Could not be determined in advance
- [ ] **Systematic Approach**: Follows hypothesis → experiment → conclusion
- [ ] **New Knowledge**: Generates knowledge, not routine application
- [ ] **Scientific Method**: Based on established scientific principles

### Workflow Logic

```
step_1: Analyse user input for keywords
step_2: Map keywords to specific attached files/data keys
step_3: Synthesise answer using ONLY that specific data segment
```

---

## Quick Reference

### Tax Rate Cheat Sheet (FY2024-25)

| Rate | Value | Legislation |
|------|-------|-------------|
| R&D Offset (small business) | 43.5% | Division 355 |
| Small Business Tax Rate | 25% | s 23AA |
| Standard Corporate Rate | 30% | s 23 |
| Division 7A Benchmark | 8.77% | s 109N |
| Instant Write-Off Threshold | $20,000 | s 328-180 |
| FBT Rate | 47% | FBTAA 1986 |

### Common Import Paths

```typescript
// Error handling
import { createErrorResponse, createValidationError } from '@/lib/api/errors';

// Database
import { createServiceClient } from '@/lib/supabase/server';

// Tax rates
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager';

// Xero client
import { createXeroClient, isTokenExpired } from '@/lib/xero/client';

// Types
import type { ForensicAnalysis, RndTransaction } from '@/lib/types';
```

### CLI Commands

```bash
# Run validators
/test-validators              # Test all validators
/show-validation-logs         # View recent validation logs
/sync-historical-data         # Sync Xero historical data

# Agent workflows
/tax-audit                    # Full tax audit
/rnd-assessment              # R&D eligibility check
/deduction-scan              # Find unclaimed deductions
/bad-debt-scan               # Bad debt recovery
/loss-analysis               # Review carry-forward loss position

# Idea Intake Workflow (Two-Claude Pattern)
# Use in Capture Claude instance:
/capture-idea                 # Capture current message as idea
/capture-request <text>       # Capture specific text
/list-queue                   # Show queue status

# Use in Work Claude instance:
/process-queue                # Process all validated items
/process-queue --continuous   # Run until queue empty
/pause-queue                  # Stop after current item

# Use in Senior PM instance:
/validate-queue               # Validate all pending items

# Multi-Agent Framework
npm run agent:orchestrator -- --task "Description"  # Create orchestrated task
npm run agent:daily-report                         # Daily status report
npm run agent:quality-gate -- --gate <name>        # Run quality gate check
npm run linear:sync                                # Sync with Linear
npm run linear:report                              # Generate Linear report
```

### Financial Years in Scope

| FY | Period | Status |
|----|--------|--------|
| FY2020-21 | 1 Jul 2020 - 30 Jun 2021 | May be out of amendment period |
| FY2021-22 | 1 Jul 2021 - 30 Jun 2022 | Amendable |
| FY2022-23 | 1 Jul 2022 - 30 Jun 2023 | Amendable |
| FY2023-24 | 1 Jul 2023 - 30 Jun 2024 | Amendable |
| FY2024-25 | 1 Jul 2024 - 30 Jun 2025 | Current (in progress) |
| FY2025-26 | 1 Jul 2025 - 30 Jun 2026 | Future planning |

---

## Critical Reminders

> **NEVER** provide advice that could be construed as illegal tax avoidance
>
> **ALWAYS** recommend professional review before implementing changes
>
> **DOCUMENT** all sources and legislation references
>
> **FLAG** any ambiguous areas requiring ATO private ruling
>
> **CITE** the relevant Tax Act when defining logic

---

## Disclaimer

```
DISCLAIMER: This analysis is provided for informational purposes only and
does not constitute tax advice. All recommendations should be reviewed by
a qualified tax professional before implementation. The software provides
'intelligence' and 'estimates', not binding financial advice.
```

---

## Compliance Audit Report (2026-02-07)

*Audited by: The_Compliance_Skeptic*
*Status: ACTIVE - Findings require action before production deployment*

---

### 1. Privacy Act 1988 Compliance Checklist

#### 1.1 Tax File Number (TFN) Handling - Schedule 1

- [ ] **TFN NOT collected or stored by this application** - VERIFY: Confirm no TFN fields exist in any Supabase tables or form inputs. TFN collection requires registration as a tax agent under Tax Agent Services Act 2009 (TASA).
- [ ] **If TFN is ever added**: Must comply with Privacy (Tax File Number) Rule 2015 - encryption, access logging, destruction after use, no disclosure except to ATO.
- [ ] **TFN must never appear in**: logs, error messages, shared reports, URLs, browser localStorage, or client-side state.

#### 1.2 Australian Privacy Principles (APPs)

- [ ] **APP 1 - Collection Notice**: Users must be informed what data is collected from Xero and how it is used BEFORE OAuth connection. Current OAuth flow needs a data collection notice.
- [ ] **APP 3 - Collection of Personal Information**: Only collect data reasonably necessary for tax analysis. Verify Xero scopes are truly minimal (currently uses READ_ONLY which is good).
- [ ] **APP 6 - Use or Disclosure**: Financial data must not be used for purposes other than tax analysis. Verify no analytics/tracking on financial data.
- [ ] **APP 8 - Cross-Border Disclosure**: If Supabase or Vercel servers are outside Australia, a cross-border data flow assessment is required. **CRITICAL: Verify Supabase region is ap-southeast-2 (Sydney).**
- [ ] **APP 11 - Security**: Reasonable steps to protect personal information. Token encryption (AES-256-GCM) is good. Verify database-level encryption and RLS policies.
- [ ] **APP 12 - Access**: Users must be able to access and correct their data. Verify data export and deletion capabilities exist.

#### 1.3 Notifiable Data Breaches (NDB) Scheme

- [x] **Breach Response Plan**: Technical detection implemented via `lib/security/security-event-logger.ts` (anomaly thresholds) and `lib/security/breach-detector.ts` (assessment workflow). 30-day assessment deadline enforced per s 26WH(2). **FIXED 2026-02-08**.
- [x] **Data Breach Register**: `data_breaches` table maintains register of all breaches (detected, assessing, notifiable, not_notifiable, remediated). Includes OAIC notification tracking. **FIXED 2026-02-08**.
- [ ] **Contact Details**: Display Privacy Officer contact details in the application. (Requires Privacy Officer appointment — non-code item.)
- ~~**FINDING**: No breach response plan or NDB compliance documentation found in the codebase.~~ **FIXED 2026-02-08**: Automated breach detection, breach register, and 30-day assessment workflow implemented.

---

### 2. Tax Practitioners Board (TPB) Requirements

#### 2.1 Registration Obligation Analysis

- **CRITICAL QUESTION**: Does this application provide "tax agent services" under TASA 2009?
  - Section 90-5 TASA: A "tax agent service" includes preparing or lodging returns, or giving advice about tax obligations.
  - This application provides "recommendations" and "analysis" -- if users rely on these to amend returns, the TPB may consider this a tax agent service.
- [ ] **Required Disclaimers**: Every page showing tax recommendations MUST display:
  - "This is not tax advice. Consult a registered tax agent."
  - "This software is an analytical tool, not a registered tax agent."
  - "Do not amend your tax return based solely on this analysis."
- [ ] **Section 50-5 TASA Penalty**: Providing tax agent services without registration carries penalties up to $52,500 (individual) or $262,500 (body corporate) per offence.
- **FINDING**: The CLAUDE.md disclaimer exists but it is unclear whether it appears on every recommendation screen in the UI. Frontend_Dev must verify.

#### 2.2 Professional Indemnity

- [ ] If operating as or alongside a tax agent practice, PI insurance is mandatory.
- [ ] The application should clearly state it does NOT hold PI insurance and users should ensure their own tax advisor has appropriate cover.

---

### 3. Tax Law Edge Cases - CRITICAL FINDINGS

#### 3.1 Deduction Engine (lib/analysis/deduction-engine.ts)

**FINDING D-1: Entertainment deductibility is oversimplified**
- Line 323-329: Flat 50% deductibility for all entertainment. In reality:
  - Meal entertainment: employer election under s 37AA FBTAA determines treatment
  - Recreational entertainment: generally non-deductible unless exemptions apply
  - Seminars/conferences with incidental meals: 100% deductible
  - Taxi travel to/from work-related entertainment: 100% deductible
- **Risk**: Over-claiming entertainment deductions; ATO scrutiny area.

**FINDING D-2: Instant asset write-off threshold history not tracked**
- Lines 20-21: Uses $20,000 fallback. But threshold has changed multiple times:
  - Pre-2023: $150,000 (COVID temporary full expensing)
  - FY2023-24: $20,000
  - FY2024-25: $20,000
- Historical transactions from COVID years may be assessed against wrong threshold.
- **Risk**: Understating eligible write-offs for FY2020-21 through FY2022-23.

**FINDING D-3: Base rate entity test is incomplete**
- Line 244: Uses turnover < $50M as sole test. But s 23AA ITAA 1997 also requires:
  - No more than 80% of assessable income is base rate entity passive income
  - This is the "passive income" test -- rental income, interest, dividends, royalties
- A company with $40M turnover but 90% passive income pays 30%, not 25%.
- **Risk**: Understating tax liability; incorrect tax saving estimates.

**FINDING D-4: No handling of prepaid expenses**
- Section 82KZM ITAA 1936: Prepaid expenses over 12 months must be apportioned.
- The engine treats all expenses at face value without checking prepayment periods.
- **Risk**: Overstating deductions in the year of payment.

#### 3.2 Division 7A Engine (lib/analysis/div7a-engine.ts)

**FINDING 7A-1: Benchmark interest rate hardcoded for current FY**
- Line 962: `const currentFY = 'FY2024-25'` is hardcoded. When FY2025-26 begins (1 July 2025), this will silently use the wrong rate.
- **Risk**: Incorrect interest calculations after 30 June 2025. MUST be dynamic.

**FINDING 7A-2: Minimum repayment formula may be incorrect for part-year loans**
- Line 712-724: Uses full-year amortisation. But s 109E(5) ITAA 1936 provides that for loans made part-way through a year, the minimum repayment is proportionally reduced.
- **Risk**: Overstating minimum repayment shortfall for mid-year loans.

**FINDING 7A-3: Amalgamated loan provisions not handled**
- Section 109E(8) ITAA 1936: Multiple loans to the same entity can be amalgamated for minimum repayment purposes. The engine treats each loan independently.
- **Risk**: Incorrect compliance assessment when multiple loans exist.

**FINDING 7A-4: Section 109RB safe harbour exclusions missing**
- Payments made under genuine commercial terms (e.g., arm's length salary) are excluded from Division 7A. The engine does not check for these exclusions.
- **Risk**: False positive Division 7A flags for legitimate commercial payments.

**FINDING 7A-5: Distributable surplus not calculated**
- Section 109Y ITAA 1936: A deemed dividend cannot exceed the company's distributable surplus. The engine does not check this cap.
- **Risk**: Overstating deemed dividend exposure.

#### 3.3 Loss Engine (lib/analysis/loss-engine.ts)

**FINDING L-1: Capital losses not distinguished from revenue losses**
- The engine treats all losses as revenue losses. Capital losses can only offset capital gains (s 102-5 ITAA 1997), not ordinary income.
- **Risk**: Incorrectly suggesting capital losses can reduce taxable income.

**FINDING L-2: Similar Business Test (SBT) not implemented**
- Lines 449-518: COT/SBT analysis returns 'unknown' for everything. While flagged for professional review, the engine still assumes eligibility.
- The new SBT (effective from FY2022-23 under Treasury Laws Amendment) is broader than the old SBT - considers similar business, not identical.
- **Risk**: Users may assume losses are available when they have been forfeited.

**~~FINDING L-3: Trust losses have different rules~~ FIXED (2026-02-08)**
- ~~Division 266/267 ITAA 1997 applies to trust losses, not Division 165. The engine uses the same analysis for all entity types.~~
- **Fixed**: `analyzeCotSbt()` now entity-type-aware. Trust entities routed to `analyzeTrustLossRecoupment()` using Division 266/267 Schedule 2F ITAA 1936. References family trust election (s 272-75), pattern of distributions test (s 269-60), income injection test (Division 270).

#### 3.4 R&D Engine (lib/analysis/rnd-engine.ts)

**FINDING R-1: R&D offset rate depends on aggregated turnover, not just turnover**
- Line 19: Uses flat 43.5%. But since FY2021-22:
  - Turnover < $20M: Refundable offset at corporate tax rate + 18.5% (= 43.5% for 25% entities)
  - Turnover >= $20M: Non-refundable offset at corporate tax rate + 8.5%
- For entities paying 30% corporate tax rate with turnover < $20M, the offset is actually 48.5%.
- **Risk**: Understating R&D benefit for some entities; overstating for others.

**FINDING R-2: $4M annual R&D tax offset cap not enforced**
- From FY2021-22, refundable R&D tax offset is capped at $4M per year (s 355-100(3) ITAA 1997).
- The engine calculates uncapped offsets.
- **Risk**: Overstating R&D benefit for large claimants.

**FINDING R-3: Clawback provisions not checked**
- Section 355-450 ITAA 1997: If R&D results are subsequently commercialised, clawback of offset applies.
- **Risk**: Users unaware of potential clawback obligations.

#### 3.5 Trust Distribution Analyzer (lib/analysis/trust-distribution-analyzer.ts)

**FINDING T-1: Section 100A "ordinary family dealing" exclusion not implemented**
- TR 2022/4 clarifies that distributions between family members for ordinary family purposes are excluded from s 100A. The analyzer flags all distributions without checking this exclusion.
- **Risk**: Excessive false positive flags causing unnecessary alarm.

**FINDING T-2: Trustee penalty tax rate is incorrect**
- Line 313: References "45% tax rate" for trustee assessment. Under s 99A ITAA 1936, the trustee rate is the top marginal rate (currently 45%) PLUS Medicare Levy (2%) = 47%.
- **Risk**: Understating worst-case tax exposure.

#### 3.6 Superannuation Cap Analyzer (lib/analysis/superannuation-cap-analyzer.ts)

**FINDING S-1: Carry-forward concessional contributions not handled**
- From FY2018-19, unused concessional cap amounts can be carried forward for up to 5 years if total super balance < $500,000.
- The analyzer uses a flat single-year cap without checking carry-forward eligibility.
- **Risk**: False breach alerts for employees legitimately using carry-forward.

**FINDING S-2: FY2025-26 cap increase not pre-loaded**
- The concessional cap increases to $30,000 for FY2024-25 and may increase further. No mechanism to fetch or alert about cap changes.
- **Risk**: Stale cap data leading to incorrect analysis.

#### 3.7 Fuel Tax Credits Analyzer (lib/analysis/fuel-tax-credits-analyzer.ts)

**FINDING F-1: Credit rates are quarterly, not annual**
- Lines 120-124: Uses single annual rates. ATO updates fuel tax credit rates EVERY quarter (Feb, Apr, Aug, Nov typically).
- A transaction from Q1 FY2024-25 may have a different rate than Q3.
- **Risk**: Incorrect credit calculations when rates change mid-year.

**FINDING F-2: Road user charge deduction not applied**
- For heavy vehicles on public roads, the fuel tax credit is reduced by the road user charge. The analyzer does not distinguish on-road vs off-road heavy vehicle use.
- **Risk**: Overstating fuel tax credits for on-road heavy vehicles.

---

### 4. Security & Privacy Vulnerabilities

#### 4.1 Confirmed Strengths

- OAuth tokens encrypted at rest (AES-256-GCM with salt-derived keys) - GOOD
- Tenant isolation via user_tenant_access table with IDOR protection - GOOD
- Rate limiting on API endpoints - GOOD (but in-memory only, see 4.2)
- Xero data is read-only - GOOD
- Token truncation in logs - GOOD
- Zod validation on API inputs - GOOD

#### 4.2 Identified Vulnerabilities

**VULN-1: Rate limiting is in-memory only (MEDIUM)**
- File: lib/middleware/rate-limit.ts
- In a serverless/edge environment (Vercel), each function instance has its own memory. Rate limits are NOT shared across instances.
- An attacker can bypass rate limits by distributing requests across function instances.
- **Fix**: Use Upstash Redis or Vercel KV for distributed rate limiting.

**VULN-2: Dev auth bypass exists in production-accessible code (LOW)**
- File: lib/auth/require-auth.ts lines 145-168
- `devBypassAuth()` function exists with a runtime check for NODE_ENV. While it checks for production, the function is exported and available.
- **Fix**: Use build-time elimination (e.g., conditional import) rather than runtime check.

**VULN-3: Share token modulo bias (LOW)**
- File: lib/share/token-generator.ts line 29
- `bytes[i] % URL_SAFE_CHARS.length` (56 chars) introduces modulo bias since 256 is not divisible by 56. Characters at positions 0-31 are ~1.6% more likely.
- For a 32-character token this is negligible but not cryptographically ideal.
- **Fix**: Use rejection sampling instead of modulo.

**VULN-4: No Content Security Policy headers (MEDIUM)**
- Shared report pages are accessible without authentication. Without CSP headers, they are vulnerable to XSS if user-controlled data (e.g., supplier names from Xero) is rendered unsanitised.
- **Fix**: Add CSP headers in next.config.js middleware.

**VULN-5: Supabase service role key used in dev encryption fallback (MEDIUM)**
- File: lib/crypto/token-encryption.ts line 32
- In development, `SUPABASE_SERVICE_ROLE_KEY` is used as the encryption key seed. If dev database tokens are migrated to production, they would be encrypted with a predictable key.
- **Fix**: Never allow dev-encrypted tokens in production; add migration check.

**VULN-6: IP address spoofing in audit logs (LOW)**
- File: lib/audit/logger.ts lines 89-113
- `X-Forwarded-For` header is user-controllable in many proxy configurations. An attacker can spoof their IP in audit logs.
- **Fix**: Use only the rightmost trusted proxy IP from X-Forwarded-For chain.

#### 4.3 Data Sovereignty

- [ ] **CRITICAL**: Verify Supabase project region is in Australia (ap-southeast-2). Australian financial data subject to data sovereignty requirements under Privacy Act 1988 APP 8.
- [ ] **CRITICAL**: Verify Vercel deployment region. Edge functions may execute in non-Australian regions.
- [ ] Verify Gemini AI API does not store or retain Australian financial data. Google Cloud data processing terms must be reviewed.
- [ ] If any data transits through non-Australian servers, a cross-border data flow risk assessment is required.

---

### 5. Record-Keeping Requirements

#### ATO Record-Keeping (5-Year Retention)

- [ ] All financial records must be retained for at least 5 years from the date the record was prepared or the transaction completed (s 262A ITAA 1936).
- [ ] The application must NOT auto-delete historical data within the 5-year window.
- [ ] If Supabase has data retention/TTL policies, verify they respect the 5-year minimum.
- [ ] Shared report links should either persist for 5 years or be downloadable as permanent records.
- [ ] CGT records must be kept for the life of the asset PLUS 5 years after disposal.

---

### 6. WCAG 2.1 AA Accessibility Requirements

- [ ] All financial data tables must have proper `<th>` scope attributes and `<caption>` elements.
- [ ] Currency values must be readable by screen readers (e.g., "$10,000" not "$10k").
- [ ] Tax bracket visualisations must have text alternatives (not colour-dependent).
- [ ] Error messages must be programmatically associated with form fields.
- [ ] Focus management: after form submission or data loading, focus must move to results.
- [ ] Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text. Verify Tax-Time dark mode meets this.
- [ ] All interactive elements must be keyboard accessible (Tab, Enter, Space, Escape).
- [ ] Time-sensitive content (e.g., "registration deadline approaching") must be announced by screen readers.

---

### 7. Required UI Disclaimers (Frontend_Dev Action Required)

Every page or component displaying tax recommendations MUST show:

```
DISCLAIMER: This analysis is generated by automated software and does not
constitute tax, financial, or legal advice. It is provided for informational
purposes only. All findings and recommendations should be reviewed by a
registered tax agent or qualified tax professional before any action is taken.
This software is not registered with the Tax Practitioners Board and does
not provide tax agent services within the meaning of the Tax Agent Services
Act 2009 (TASA).
```

Pages requiring this disclaimer:
- [ ] Dashboard overview (estimated savings summary)
- [ ] Deduction opportunities page
- [ ] R&D Tax Incentive analysis page
- [ ] Division 7A compliance page
- [ ] Loss carry-forward page
- [ ] Trust distribution analysis page
- [ ] Superannuation cap analysis page
- [ ] Fuel tax credits page
- [ ] All generated PDF/Excel reports
- [ ] Shared report viewer pages
- [ ] Amendment schedule recommendations

---

### 8. Mid-Financial-Year Rate Change Handling

**CRITICAL QUESTION FOR BACKEND_DEV**:

What happens when tax rates change mid-financial-year? Scenarios:

1. **Budget announcement changes rates retroactively**: The application must invalidate cached rates and re-analyse all affected transactions.
2. **Division 7A benchmark rate**: Published annually by ATO. If the rate changes, all existing compliance assessments become stale.
3. **Fuel tax credit rates**: Change quarterly. Current implementation uses annual rates.
4. **Instant asset write-off threshold**: Has changed 7 times since 2019. Historical analyses must use the threshold applicable at the date of purchase.
5. **Superannuation guarantee rate**: 11.5% from 1 Jul 2024, 12% from 1 Jul 2025. Must be date-aware.

The `lib/tax-data/cache-manager.ts` with 24-hour TTL is insufficient for rate change scenarios. Consider:
- Webhook/polling for ATO rate changes
- Version-stamping all analyses with the rates used
- Re-analysis trigger when rates are updated

---

### 9. Amendment Period Calculations

**FINDING**: The loss engine (line 63-105) correctly identifies amendment periods but the deduction engine does NOT check amendment periods at all.

Amendment periods by entity type (s 170 TAA 1953):
- Individuals/small business: 2 years from date of assessment
- Companies/partnerships/trusts: 4 years from date of assessment
- Fraud or evasion: Unlimited
- Transfer pricing: 7 years

**RISK**: The deduction engine may recommend amending returns that are outside the amendment period. This is particularly relevant for FY2020-21 which may now be outside the 4-year window for companies (assessment issued ~early 2022, expiry ~early 2026).

---

### 10. Entity Type Gaps

The application handles: company, trust, partnership, individual.

**Missing entity types**:
- Superannuation funds (SMSF) - different tax rates (15% accumulation, 0% pension phase)
- Government entities - exempt from income tax
- Non-profit organisations - special concessions and thresholds
- Foreign companies - different rules under Division 820 (thin capitalisation)
- Joint ventures - not a separate entity, but common in mining/resources

---

### Audit Conclusion

**Overall Risk Rating: MEDIUM-HIGH**

The codebase demonstrates good engineering practices (encryption, validation, tenant isolation, legislative references). However, several tax law edge cases could lead to materially incorrect recommendations. The most critical findings are:

1. **7A-1**: Hardcoded financial year will break after 30 June 2025
2. **R-1/R-2**: R&D offset calculations may be significantly wrong for some entities
3. **L-1**: Capital vs revenue loss distinction is fundamental and missing
4. **D-3**: Base rate entity passive income test missing
5. **Privacy**: Data sovereignty verification needed urgently
6. **TPB**: Disclaimer placement in UI must be verified

*This audit should be repeated when major features are added or tax law changes occur.*

---

### 11. Plan Review Findings - New Engines (2026-02-07)

*Review of: C:/ATO/plan.md (Backend_Dev architecture plan for 9 new engines)*

#### 11.1 CGT Engine + Division 152 - CRITICAL Issues

**~~CR-1: Division 152 net asset test requires connected entity aggregation~~ FIXED (2026-02-08)**
- ~~Subdivision 152-15 ITAA 1997 includes net assets of connected entities and affiliates in the $6M threshold.~~
- ~~A sole trader with $4M in personal assets and a connected trust with $3M FAILS ($7M > $6M).~~
- **Fixed**: `CGTAnalysisOptions.connectedEntities` accepts array of connected entities/affiliates. `analyzeDivision152()` aggregates net assets per Subdivision 152-15. Cliff edge warning (within 10% of $6M) implemented.

**CR-2: CGT event interactions on same asset**
- Section 112-30 ITAA 1997: prior CGT events modify cost base of subsequent events.
- E.g., CGT C2 (asset destruction) preceding CGT A1 (disposal) affects cost base.
- The plan treats each event independently.

**CR-3: Capital loss quarantining**
- Collectable losses can ONLY offset collectable gains (s 108-10(1) ITAA 1997).
- Personal use asset losses are DISREGARDED entirely (s 108-20(1)).
- The plan does not distinguish asset categories.

**H-4: CGT discount not available to companies**
- Companies cannot access the 50% CGT discount (s 115-25(1) ITAA 1997).
- Non-residents ineligible for post-8 May 2012 gains on non-TAP assets.
- Entity type must be checked, not just holding period.

#### 11.2 FBT Engine - CRITICAL Issues

**CR-4: Type 1 vs Type 2 gross-up determination missing**
- Type 1 (GST-creditable): gross-up rate 2.0802 -- applies when employer entitled to GST credit.
- Type 2 (no GST credit): gross-up rate 1.8868.
- Per-item determination required; cannot use aggregate amounts.

**CR-5: Car fringe benefit methods not designed**
- Division 2 FBTAA provides statutory formula method (s 9) and operating cost method (s 10).
- Statutory rate depends on kilometres driven.
- `FBTItem` type lacks fields for kilometres, log book data, or method selection.
- This is the single most common FBT item.

**M-3: FBT lodgement deadline varies by lodger type**
- Self-lodger: 21 May.
- Tax agent: typically 25 June or later.
- Engine must check agent vs self-lodger status.

#### 11.3 PSI Engine - CRITICAL Issue

**CR-6: Results test has 3 sub-requirements**
- Section 87-18 ITAA 1997 requires ALL THREE:
  - (a) 75%+ of PSI is for producing a result
  - (b) Individual provides own tools/equipment
  - (c) Individual is liable for defective work
- Common scenario: passing (a) but failing (b) when using client equipment.
- `resultsTest` type needs separate tracking of each sub-requirement.

#### 11.4 Payroll Tax Engine - HIGH Issues

**H-1: Contractor deeming provisions not addressed**
- All states deem certain contractor payments as "wages" (e.g., NSW s 37 Payroll Tax Act 2007).
- Most common payroll tax audit issue.
- Engine must analyse contractor payments or flag them for review.

**H-2: NSW payroll tax rate may be incorrect**
- Plan states 5.45%, but NSW rate has been 4.85% since 1 July 2022 (threshold $1.2M).
- COVID surcharge of 0.75% applies for wages over $10M.
- Verify current rate schedule.

**H-3: Grouping rules substantially more complex than shown**
- Must consider: related bodies corporate, common employees, common premises, tracing provisions.
- Need reason for grouping and ability to contest incorrect grouping.

#### 11.5 PAYG Instalment Engine - HIGH Issue

**H-5: Varied instalment penalty risk**
- Section 45-235 TAA 1953: if varied amount is less than 85% of actual liability, GIC penalty applies (~10%+ per annum).
- Engine must warn users about penalty risk when recommending downward variations.

#### 11.6 Audit Risk Engine - HIGH Issue

**H-6: Benchmark comparison framing**
- ATO benchmarks are DESCRIPTIVE, not NORMATIVE.
- Being outside benchmark is not illegal; it increases audit probability.
- Must NOT recommend "reduce expenses to match benchmark" -- that could constitute improper advice.
- Correct framing: "Your figures deviate from ATO industry benchmarks. This may increase audit likelihood."

#### 11.7 Database/Security - MEDIUM Issues

**M-1: RLS policy uses wrong identifier**
- Template uses `auth.uid()::text = tenant_id` but tenant_id is Xero org ID, not Supabase user ID.
- Must join through `user_tenant_access` table or use security definer function.

**M-2: ABN Lookup cache privacy**
- ABR responses may contain individual names for sole traders/partnerships.
- `abn_lookup_cache` has no RLS -- all users can access.
- While ABR data is public, caching and re-serving has different privacy implications under APP 11.

**M-4: Cash flow forecast disclaimer required**
- Projections are not financial advice under Corporations Act 2001.
- Must include assumptions list, "estimates only" disclaimer, and ASIC RG 234 compliance note.

### 12. Remediation Status Tracker (Updated 2026-02-08)

Backend_Dev has accepted ALL critical and high findings from this audit and incorporated them into a Phase 0 remediation plan (see `plan.md` sections 13-16). Phase 0 executes BEFORE any new engine development.

#### Phase 0 Remediation (ACCEPTED -- In Progress)

| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| 7A-1: Hardcoded FY | CRITICAL | ACCEPTED | New `lib/utils/financial-year.ts` with `getCurrentFinancialYear()` and `getCurrentFBTYear()` |
| RND-1: R&D offset rate | CRITICAL | ACCEPTED (CLARIFICATION NEEDED) | Tiered offset implemented. Must confirm 18.5% premium is FY-dependent (was 13.5% pre-FY2022-23) |
| LOSS-1: Capital vs revenue losses | CRITICAL | ACCEPTED | `lossType: 'revenue' \| 'capital'` field added, capital losses constrained to offset capital gains only |
| DED-1: Base rate entity test | HIGH | ACCEPTED | `passiveIncomePercentage` parameter added, warning when data unavailable |
| 7A-2: Distributable surplus cap | HIGH | FIXED (2026-02-08) | `estimateDistributableSurplus()` queries equity data; `cappedTotalDeemedDividendRisk = Math.min(totalRisk, surplus)` per s 109Y. Optional `knownDistributableSurplus` parameter. Warnings when surplus unknown. |
| SUPER-1: Carry-forward | HIGH | ACCEPTED | 5-year lookback with $500K balance threshold, `CarryForwardAllowance` type |
| Amendment period consistency | HIGH | FIXED (2026-02-08) | Extracted to `lib/utils/financial-year.ts`, now applied in deduction engine via `checkAmendmentPeriod()` (s 170 TAA 1953) |
| Mid-year rate changes | HIGH | ACCEPTED | `POST /api/tax-data/refresh` endpoint + `forceRefresh` parameter |
| Quarterly fuel rates (F-1) | MEDIUM | FIXED (2026-02-08) | Per-quarter rate lookup with `FUEL_TAX_CREDIT_RATES` map; fallback for unknown quarters |
| Data sovereignty | MEDIUM | ACCEPTED | `DATA_SOVEREIGNTY.md` documenting ap-southeast-2 + syd1 deployment |
| Data minimisation (APP 8) | MEDIUM | FIXED (2026-02-08) | Supplier names anonymised via `lib/ai/pii-sanitizer.ts` before Gemini API calls. Applied in `forensic-analyzer.ts` and `account-classifier.ts` |

#### Deferred Findings (Not Yet in Phase 0 -- Tracked for Phase 1+)

| Finding | Severity | Status | Risk if Deferred |
|---------|----------|--------|-----------------|
| R-3: R&D clawback (s 355-450) | HIGH | FIXED (2026-02-08) | Clawback warning already implemented per-project (line 594-598), in recommendations (810-815), and summary-level (920-923). Marked as done. |
| 7A-3: Amalgamated loans (s 109E(8)) | MEDIUM | FIXED (2026-02-08) | Already implemented: `checkAmalgamationProvisions()` groups loans by shareholder, warns on multiple loans (lines 880-913). `amalgamationNotes` on Div7aSummary. |
| 7A-4: Safe harbour exclusions (s 109RB) | MEDIUM | FIXED (2026-02-08) | Already implemented: `identifySafeHarbourExclusions()` matches transactions against `SAFE_HARBOUR_KEYWORDS` (lines 920-963). `safeHarbourExclusions` on Div7aSummary. |
| T-1: Ordinary family dealing exclusion | HIGH | FIXED (2026-02-08) | `generateSection100AFlags()` downgrades severity when family dealing exclusion applies (s 100A(13), TR 2022/4). Risk reduction increased to 40 points. |
| T-2: Trustee penalty rate (47% not 45%) | LOW | FIXED (2026-02-07) | Updated all references from 45% to 47% (45% top marginal + 2% Medicare Levy per s 99A ITAA 1936) |
| L-2: SBT always returns 'unknown' | MEDIUM | FIXED (2026-02-08) | Already implemented: `enrichSbtWithTransactionEvidence()` (lines 640-771) compares expense categories across FYs. 70%+ consistency = SBT satisfied, 40-69% = uncertain, <40% = likely not satisfied. Evidence-based assessment replaces 'unknown'. |

#### Frontend Compliance Items (Reviewed 2026-02-07)

Frontend_Dev responded to all 10 items. 7 approved, 2 conditionally approved, 1 noted.

| Item | Status | Detail |
|------|--------|--------|
| TPB disclaimer text | FIXED (2026-02-07) | Added TASA 2009 reference, "not a registered tax/BAS agent" statement, "registered tax practitioner" wording |
| TPB disclaimer styling | FIXED (2026-02-07) | Updated to 12px (text-xs / 0.75rem), 60% opacity via inline styles |
| TPB disclaimer coverage | PARTIAL FIX (2026-02-07) | Shared report viewer now has TaxDisclaimer on all states (success, password, error). Dashboard and other pages need separate verification |
| Marginal vs effective rate | APPROVED | Waterfall chart shows both rates with explanatory text |
| Projected savings disclaimers | APPROVED | "ESTIMATE" labels, sticky footer disclaimer, confidence percentages |
| WCAG chart data tables | APPROVED (NOTE) | Hidden tables with proper markup. Suggested `role="region"` grouping for multiple charts |
| Colour-independent info | APPROVED | Pattern fills + icons + text alongside colour |
| Dark mode contrast | APPROVED (NOTE) | Ratios documented. #F87171 on #050505 is 5.5:1 -- passes but borderline for small text |
| Keyboard navigation | APPROVED | Calendar grid with arrow keys per WAI-ARIA |
| Time-sensitive content | APPROVED | Icon + colour + text + aria-live pattern |
| Pre-OAuth consent page | FIXED (2026-02-07) | Real implementation at `/dashboard/connect` with APP 1 Collection Notice, cross-border AI disclosure (APP 8), and Gemini AI consent |
| Shared reports privacy | NOTED | No share functionality on new pages until privacy controls verified |

#### Three Critical Frontend Corrections Required

1. **TaxDisclaimer font size**: ~~Increase from `text-[10px] text-white/30` to at least `text-xs text-white/60` (12px, 60% opacity)~~ **FIXED 2026-02-07** -- Updated to 0.75rem (12px) with 60% opacity, added TASA 2009 reference
2. **Shared report viewer**: ~~Add TaxDisclaimer to `/app/share/[token]/page.tsx`~~ **FIXED 2026-02-07** -- TaxDisclaimer present on success, password, and error states
3. **Pre-OAuth consent interstitial**: ~~Build real page at `/dashboard/connect`~~ **FIXED 2026-02-07** -- Added cross-border AI data processing disclosure (APP 8), Gemini AI consent, updated checkbox text

#### Phase 0 Compliance Fixes Applied (2026-02-07, 2026-02-08)

| Fix | File | Description |
|-----|------|-------------|
| FBT rate assignment bug | `lib/analysis/fbt-engine.ts:158-163` | Live rates now assigned to fbtRate, grossUpRate1, grossUpRate2 variables |
| TaxDisclaimer styling | `components/dashboard/TaxDisclaimer.tsx:28` | 12px font, 60% opacity, TASA 2009 reference, "not a registered tax/BAS agent" |
| Trust penalty rate | `lib/analysis/trust-distribution-analyzer.ts` | All 45% references updated to 47% (45% + 2% Medicare Levy per s 99A) |
| APP 1 Collection Notice | `app/dashboard/connect/page.tsx` | Cross-border AI disclosure, Gemini data scope, APP 8 consent |
| CSP headers | `next.config.ts` | Content-Security-Policy on all pages, stricter CSP on /share/* pages |
| DATA_SOVEREIGNTY.md | `DATA_SOVEREIGNTY.md` | Consent notice marked as implemented, section 4.5 added |
| FBT Type 1/Type 2 | `lib/analysis/fbt-engine.ts` | Per-item GST credit analysis replacing naive keyword matching |
| Shared report disclaimer | `app/share/[token]/page.tsx` | TaxDisclaimer added to password-required state |
| APP 8 data minimisation | `lib/ai/pii-sanitizer.ts`, `lib/ai/forensic-analyzer.ts`, `lib/ai/account-classifier.ts` | Supplier names anonymised with `Supplier_N` tokens before Gemini API calls (2026-02-08) |
| SG rate FY-aware | `lib/analysis/cashflow-forecast-engine.ts:215-219` | SG rate now 12% from FY2025-26, was hardcoded 11.5% (s 19 SGAA 1992) (2026-02-08) |
| Deduction amendment period | `lib/analysis/deduction-engine.ts:556-569` | Amendment period check added using `checkAmendmentPeriod()`, warns on out-of-window FYs (2026-02-08) |
| Deduction dead code | `lib/analysis/deduction-engine.ts:553-559` | Removed duplicate comment and unreachable `return summary` (2026-02-08) |
| Fuel tax quarterly rates (F-1) | `lib/analysis/fuel-tax-credits-analyzer.ts` | Per-quarter rate lookup replacing single annual rate (2026-02-08) |
| Road user charge (F-2) | `lib/analysis/fuel-tax-credits-analyzer.ts` | On-road heavy vehicle credit reduced by road user charge per s 43-10 (2026-02-08) |
| IP spoofing fix (B-5) | `lib/audit/logger.ts:99-103` | Use rightmost X-Forwarded-For IP (trusted proxy) not leftmost (user-controllable) (2026-02-08) |
| Dev auth bypass (B-8) | `lib/auth/require-auth.ts:145` | `devBypassAuth` unexported and renamed to `_devBypassAuth` (2026-02-08) |
| Token modulo bias (B-9) | `lib/share/token-generator.ts:22-35` | Rejection sampling eliminates modulo bias (256 mod 56 != 0) (2026-02-08) |
| Share password in POST body (B-1) | `app/api/share/[token]/route.ts`, `app/share/[token]/page.tsx` | Password moved from URL query param to POST body; prevents leaking in logs/history/Referer (2026-02-08) |
| RLS function standardised (B-6) | `supabase/migrations/20260208_rls_standardize.sql` | All RLS policies now use `check_tenant_access()` per AD-8; `get_user_tenant_ids()` dropped (2026-02-08) |
| Estimate disclaimer (C-2) | `app/api/share/[token]/route.ts`, `components/share/AccountantReportView.tsx`, `lib/types/shared-reports.ts` | "ESTIMATE ONLY" disclaimer on dollar amounts; MetricCard labelled "(Est.)" (2026-02-08) |
| Share route IP spoofing (B-5) | `app/api/share/[token]/route.ts:194-199` | `getClientIp()` uses rightmost X-Forwarded-For IP, consistent with `lib/audit/logger.ts` (2026-02-08) |
| OAuth CSRF (B-2) | `app/api/auth/quickbooks/route.ts`, `app/api/auth/quickbooks/callback/route.ts`, `app/api/auth/myob/authorize/route.ts`, `app/api/auth/myob/callback/route.ts` | QuickBooks: crypto nonce in httpOnly cookie. MYOB: random state + userId in cookie (was raw user.id). Xero already correct (2026-02-08) |
| Distributed rate limiting (B-7) | `lib/middleware/distributed-rate-limit.ts`, `supabase/migrations/20260208_distributed_rate_limit.sql` | Supabase-backed atomic `check_rate_limit()` RPC; in-memory fallback (2026-02-08) |
| CSP headers (B-10) | `next.config.ts` | Already fixed 2026-02-07; marked in tracker (2026-02-08) |
| Family dealing exclusion (T-1) | `lib/analysis/trust-distribution-analyzer.ts` | `generateSection100AFlags()` downgrades severity for non-resident (high→medium) and minor (high→low) when family dealing exclusion applies (s 100A(13), TR 2022/4). Risk reduction 20→40 points. Compliance summary notes reduced flags. (2026-02-08) |
| R&D clawback (R-3) | `lib/analysis/rnd-engine.ts` | Already implemented: per-project `clawbackWarning` (line 594-598), recommendation (810-815), summary warning (920-923). Marked as done in tracker. (2026-02-08) |
| Share endpoint scoping (B-4) | `app/api/share/[token]/route.ts`, `supabase/migrations/20260208_share_scoped_function.sql` | Report data fetched via `get_shared_report_analysis()` SECURITY DEFINER function (validates share, scopes by tenant_id, returns only safe columns). `select('*')` replaced with explicit columns. Column name bugs fixed (`tax_category`→`primary_category`, `classification_confidence`→`category_confidence`, `description`→`transaction_description`). (2026-02-08) |
| File upload scanning (B-3) | `lib/uploads/file-scanner.ts`, `app/api/share/[token]/documents/route.ts`, `app/api/recommendations/[id]/documents/route.ts` | Magic number validation (file signature must match claimed MIME type), dangerous executable signature detection (MZ/ELF/Mach-O/shebang), double extension attack prevention, null byte injection prevention. Applied to both upload endpoints. (2026-02-08) |
| Div7A amalgamated loans (7A-3) | `lib/analysis/div7a-engine.ts` | Already implemented: `checkAmalgamationProvisions()` (lines 880-913) groups loans by shareholder name, warns when multiple loans exist to same shareholder per s 109E(8). Marked as done. (2026-02-08) |
| Div7A safe harbour exclusions (7A-4) | `lib/analysis/div7a-engine.ts` | Already implemented: `identifySafeHarbourExclusions()` (lines 920-963) matches transactions against `SAFE_HARBOUR_KEYWORDS` per s 109RB. Marked as done. (2026-02-08) |
| SBT transaction evidence (L-2) | `lib/analysis/loss-engine.ts` | Already implemented: `enrichSbtWithTransactionEvidence()` (lines 640-771) compares expense categories across FYs. Evidence-based SBT assessment replaces 'unknown'. Marked as done. (2026-02-08) |
| Distributable surplus cap (A-12) | `lib/analysis/div7a-engine.ts` | `estimateDistributableSurplus()` queries equity account data; `cappedTotalDeemedDividendRisk = Math.min(totalRisk, surplus)` per s 109Y ITAA 1936. Optional `knownDistributableSurplus` parameter for callers with balance sheet data. `Div7aSummary` gains 5 new fields. Warnings when surplus unknown. (2026-02-08) |
| Collectable/personal use loss quarantining (A-7) | `lib/analysis/cgt-engine.ts` | `classifyAssetCategory()` classifies CGT events as collectable/personal_use/other via keyword matching. Collectable losses quarantined per s 108-10(1), personal use losses disregarded per s 108-20(1). `CGTEvent` gains `assetCategory` + `assetCategoryNote`. `CGTSummary` gains 5 quarantined loss tracking fields. (2026-02-08) |
| Connected entity aggregation (A-6/CR-1) | `lib/analysis/cgt-engine.ts` | `CGTAnalysisOptions.connectedEntities` array for Subdivision 152-15 ITAA 1997 net asset aggregation. `analyzeDivision152()` sums connected entity + own assets for $6M test. `Div152Analysis.netAssetTest` expanded with `connectedEntityAssets`, `aggregatedNetAssets`, `cliffEdgeWarning` (10% of $6M), and `breakdown`. Warns when no connected entities provided but net asset value given. (2026-02-08) |
| Trust losses Division 266/267 (A-9/L-3) | `lib/analysis/loss-engine.ts` | `analyzeCotSbt()` now entity-type-aware: trust entities routed to `analyzeTrustLossRecoupment()` using Division 266/267 Schedule 2F ITAA 1936 instead of Division 165. `CotSbtAnalysis` gains `trustLossRule`, `familyTrustElection`, `trustNotes`. Recommendations reference family trust election (s 272-75), pattern of distributions test (s 269-60), income injection test (Division 270). (2026-02-08) |
| NDB breach detection (P2-8/C-6) | `lib/security/security-event-logger.ts`, `lib/security/breach-detector.ts`, `supabase/migrations/20260208_ndb_security_events.sql` | `security_events` table logs auth failures, rate limit breaches, unauthorized access, bulk data access, etc. Anomaly thresholds auto-create `data_breaches` records when exceeded. Breach register with 30-day assessment deadline (s 26WH(2) Privacy Act 1988). `getBreachSummary()` and `getOverdueAssessments()` for admin dashboard. Integrated into distributed rate limiter and share password endpoint. (2026-02-08) |

---

## Frontend Design System: Tax UI & Accessibility

### Theme Architecture

The application uses a **dual dark theme** system:

| Theme | CSS Selector | Purpose |
|-------|-------------|---------|
| OLED Black (default) | `:root` | Standard dark theme, pure black backgrounds |
| Tax-Time | `[data-theme="tax-time"]` | Warmer dark variant for long tax-season sessions |

**Key design decision:** No light mode. Financial professionals work on dark screens; the "Tax-Time" variant reduces eye strain during the July-October lodgement season through warmer tones and reduced glow intensity.

Theme is controlled via:
- `localStorage` key: `ato-theme` (values: `default` | `tax-time`)
- `data-theme` attribute on `<html>` element
- `ThemeToggle` component in DynamicIsland header
- Keyboard shortcut: `Ctrl+Shift+T`

### Compliance Status Colour System

All compliance indicators use icon + colour + text (never colour alone):

| Status | Colour | Icon | WCAG Contrast |
|--------|--------|------|---------------|
| Compliant | `#34D399` (green) | Checkmark | 4.5:1+ on both themes |
| Warning | `#FBBF24` (amber) | Warning triangle | 4.5:1+ on both themes |
| Non-compliant | `#F87171` (red) | X mark | 4.5:1+ on both themes |

### Component Architecture

#### Tax Visualisation Components (`components/tax/`)

| Component | Chart Type | Data Source |
|-----------|-----------|-------------|
| `TaxBracketWaterfall` | Recharts BarChart | `lib/tax-visualisation/brackets.ts` |
| `CompanyRateComparison` | Recharts BarChart | Static rates with FY attribution |
| `CGTDiscountChart` | Recharts BarChart | `/api/analysis/cgt` |
| `DeductionImpactCalculator` | Recharts AreaChart | Client-side calculation |

#### Projection Components (`components/projections/`)

| Component | Visualisation | Data Source |
|-----------|--------------|-------------|
| `OffsetMeter` | SVG arc gauge | Reusable (no data) |
| `RnDOffsetProjection` | OffsetMeter | `/api/audit/recommendations` |
| `SmallBusinessCGTConcession` | DataStrip list | `/api/analysis/cgt` |
| `LossCarryForwardTimeline` | Recharts LineChart | `/api/analysis/losses` |
| `FBTLiabilityProjection` | OffsetMeter | `/api/analysis/fbt` |
| `SuperCapUsage` | Progress bars | `/api/analysis/super` |

#### Calendar Components (`components/calendar/`)

| Component | Purpose |
|-----------|---------|
| `TaxCalendar` | Monthly grid with deadline dots, entity-type filter |
| `DeadlineCard` | Expandable deadline info with countdown indicator |

### Accessibility Standards (WCAG 2.1 AA)

All new components MUST meet these requirements:

1. **Colour contrast:** 4.5:1 minimum for normal text, 3:1 for large text
2. **Keyboard navigation:** All interactive elements focusable via Tab, charts via arrow keys
3. **Screen reader:** `aria-label` on all financial data, hidden data tables for charts
4. **Focus indicators:** 2px solid accent ring on `:focus-visible`
5. **No colour-only information:** Pattern fills + icons alongside colour
6. **Dynamic updates:** `aria-live="polite"` on calculated values
7. **Skip links:** At top of dashboard layout for keyboard users

### Chart Accessibility Pattern

Every Recharts chart must be wrapped with `AccessibleChart`:

```typescript
<AccessibleChart
  label="Individual tax brackets for FY2024-25"
  data={bracketData}  // Rendered as hidden table
>
  <BarChart data={bracketData}>...</BarChart>
</AccessibleChart>
```

This wrapper provides:
- `role="img"` with descriptive `aria-label` on the chart container
- Hidden `<table>` with `.sr-only` class containing all chart data
- `aria-live` region for tooltip/hover data

### New Dashboard Pages

| Page | Route | Description |
|------|-------|-------------|
| Projections | `/dashboard/projections` | Real-time offset meters, concession impacts, timelines |
| Calendar | `/dashboard/calendar` | Interactive tax compliance calendar with entity filtering |

---

## Design System Summary

The full design specification is in `DESIGN_SYSTEM.md`. Key decisions:

### Visual Language: "Professional Elegant"
- **Dark-only**: OLED Black default + Tax-Time warm variant (no light mode)
- **Minimal radius**: 2px on all rectangular containers; `9999px` only for circles
- **0.5px borders**: Ultra-thin borders at low opacity for structure without weight
- **Spectral cyan accent** (`#00F5FF`): Primary accent outside the traffic-light spectrum

### Typography
- **UI font**: Geist (via `--font-sans`)
- **Data font**: JetBrains Mono (via `--font-mono`) with `font-variant-numeric: tabular-nums`
- **Scale**: 1.25 ratio (Major Third), base 16px

### Spacing & Grid
- **8pt grid**: All spacing multiples of 8px (exception: 4px for tight internal gaps)
- **12-column grid**: With asymmetric layouts preferred (40/60, 60/40, 30/70)
- **Breakpoints**: 375 (mobile), 768 (tablet), 1024 (desktop), 1280 (wide)

### Motion ("Seamless Ledger")
- **Easing**: `cubic-bezier(0.19, 1, 0.22, 1)` for all transitions
- **Loading**: Skeleton screens (not spinners) as primary loading state
- **Numbers**: AnimatedCounter with count-up animation for dollar amounts
- **Reduced motion**: All animations respect `prefers-reduced-motion`

### Component Rules
- Cards: `rgba(255,255,255,0.02)` background, `0.5px` border, `2px` radius
- Buttons: Uppercase, 11px, `0.15em` letter-spacing, glow effect on primary
- Semantic colours: Always paired with icon + text (never colour alone)
- Charts: Recharts wrapped in `<AccessibleChart>`, using `--chart-1` to `--chart-6`
- Disclaimer: Minimum 12px font, 60% opacity (compliance requirement)

---

## Compliance Risk Assessment v2 (2026-02-07)

*Full assessment: `COMPLIANCE_RISK_ASSESSMENT.md`*
*Audited by: The_Compliance_Skeptic*

### Top 3 Compliance Risks

#### RISK 1 (CRITICAL): Cross-Border Data Processing Without Informed Consent

**Regulatory**: Privacy Act 1988 APP 1, APP 6, APP 8 | **Penalty**: Up to $50M or 30% adjusted turnover

Financial transaction data (including supplier names = personal information) is sent to Google Gemini AI for forensic analysis without:
- APP 1 Collection Notice before Xero OAuth connection
- APP 8 cross-border disclosure consent for Gemini processing
- Google Cloud Data Processing Agreement execution
- Confirmed infrastructure regions (Supabase ap-southeast-2, Vercel syd1)

**Files affected**: `lib/ai/gemini-client.ts`, `DATA_SOVEREIGNTY.md` (4 unchecked action items)

**Remediation**: P0 -- add consent interstitial, APP 1 notice, confirm regions, execute DPA, appoint Privacy Officer.

#### RISK 2 (CRITICAL): Unregistered Tax Agent Services Exposure

**Regulatory**: Tax Agent Services Act 2009 s 50-5, s 90-5 | **Penalty**: Up to $262,500 per offence (body corporate)

Platform outputs dollar estimates, legislative references, and filing instructions that may constitute "tax agent services" under s 90-5 TASA. Three compounding issues:
1. TaxDisclaimer renders at 10px font (functionally invisible) -- `components/dashboard/TaxDisclaimer.tsx:28` still uses `text-[10px]` despite audit requiring 12px minimum
2. Shared reports serve dollar estimates to unauthenticated external users with step-by-step filing instructions
3. No professional indemnity insurance

**Remediation**: P0 -- fix disclaimer to 12px, obtain legal opinion on TASA applicability, consider restructuring outputs.

#### RISK 3 (HIGH): FBT Engine Systemic Miscalculation

**Regulatory**: FBTAA 1986 s 67 (shortfall penalties) | **Impact**: Every FBT analysis uses wrong rates

Code bug at `lib/analysis/fbt-engine.ts:152-163` -- live rates are fetched but NEVER assigned to calculation variables. Additional issues:
- Type 1/Type 2 gross-up determination is keyword-based, not per-item GST credit analysis
- Car fringe benefits (most common FBT item) have no valuation method
- Otherwise deductible rule (s 24) classified but not applied as reduction

**Remediation**: P0 -- fix rate assignment bug (30 minutes). P1 -- implement proper Type 1/Type 2 determination and car benefit valuation.

### Secondary Findings Summary

- **14 tax law accuracy findings** (A-1 through A-14) across trust distribution, cashflow forecast, fuel tax credits, CGT, loss, R&D, Div7A, and deduction engines
- **10 security/privacy findings** (B-1 through B-10) -- ALL 10 FIXED: B-1, B-2, B-3, B-4, B-5, B-6, B-7, B-8, B-9, B-10
- **7 professional liability findings** (C-1 through C-7) including missing APP 1 collection notice, no PI insurance, no NDB technical implementation

### Remediation Phases

- **Phase 0** (BEFORE production): 8 items -- consent notices, region confirmation, disclaimer fix, FBT rate bug, legal opinion, Privacy Officer
- **Phase 1** (within 30 days): 4 items remaining -- DPA execution, FBT Type 1/2 determination, ~~CSP headers~~ (DONE), ~~distributed rate limiting~~ (DONE), ~~trust penalty rate fix~~ (DONE), ~~SG rate update~~ (DONE), ~~share password B-1~~ (DONE)
- **Phase 2** (within 90 days): 0 code items remaining -- ~~CGT connected entities~~ (DONE), retention policy, ~~NDB detection~~ (DONE). ~~s 100A family dealing~~ (DONE), ~~R&D clawback~~ (DONE), ~~SBT implementation~~ (DONE), ~~file upload scanning~~ (DONE), ~~trust losses Division 266/267~~ (DONE)

---

## Architecture Decisions

> Added 2026-02-07. Full architecture document: `ARCHITECTURE.md`

### AD-1: Engine Independence

Each of the 16 analysis engines in `lib/analysis/` is a standalone module with no import dependencies on other engines. Cross-engine data flows through Supabase, not direct function calls. This allows engines to be run independently via their API routes and parallelised in Tier 1 of the calculation pipeline.

**Consequence**: When an engine needs data that another engine produces (e.g., cashflow-forecast needs FBT liability), it re-queries the database rather than importing the FBT engine directly. This trades some efficiency for fault isolation.

### AD-2: Decimal.js for All Monetary Arithmetic

All engines use `decimal.js` instead of native JavaScript `number` for monetary calculations. This avoids IEEE 754 floating-point errors that would produce incorrect tax amounts.

**Consequence**: All monetary values must be wrapped in `new Decimal()` before arithmetic. Return types use `number` (via `.toNumber()`) for JSON serialisation, but internal calculations must never use native arithmetic operators on money.

### AD-3: Conservative Default (All Deductions are "Potential")

The deduction engine marks every identified deduction as `status='potential'` rather than `status='confirmed'`. This is a deliberate legal safety decision -- the platform is not a registered tax agent and cannot definitively classify deductions.

**Consequence**: UI must present deductions as opportunities requiring professional review, never as confirmed savings.

### AD-4: Zero TFN Storage

The platform does not store, transmit, or process Tax File Numbers server-side. TFN input (if ever required) must be client-side only, with no TFN data crossing the API boundary. See `ARCHITECTURE.md` Section C for full design.

**Consequence**: Any future ATO SBR2 integration requiring TFN must use a client-side-to-ATO direct channel, not route through our API.

### AD-5: Tax Rate Provenance

Every engine returns `taxRateSource` (URL or 'fallback') and `taxRateVerifiedAt` (timestamp) metadata. This creates an audit trail showing whether the engine used live-scraped ATO rates or hardcoded fallback defaults.

**Consequence**: UI should display provenance indicators (e.g., "Rates verified from ATO.gov.au at [timestamp]" vs "Using default rates -- verify manually").

### AD-6: Audit Risk Benchmarks are Descriptive, Not Normative

The audit-risk-engine compares client expense ratios against ATO industry benchmarks but NEVER recommends changing expenses to match benchmarks. This is a critical compliance decision -- recommending benchmark manipulation could constitute aiding tax evasion.

**Consequence**: Audit risk output must be presented as informational context ("Your expenses are outside typical industry range") not as action items ("Reduce your motor vehicle expenses to match the benchmark").

### AD-7: Shared Financial Year Utility

All date-based tax calculations use `lib/utils/financial-year.ts` rather than inline date logic. This single source of truth handles:
- Australian FY (Jul-Jun) vs FBT year (Apr-Mar) vs calendar year
- Amendment period calculations
- BAS quarter determination
- Prior year lookback

**Consequence**: Never write inline FY date logic in engines. Always import from `financial-year.ts`.

### AD-8: RLS via Security Definer Function

Row-Level Security uses a `check_tenant_access()` function with `SECURITY DEFINER` that joins `user_tenant_access`. This centralises the access check so that adding new tables only requires `USING (check_tenant_access(tenant_id))` in the RLS policy.

**Consequence**: All new tenant-scoped tables must use this pattern. Public data tables (ABN cache, benchmarks) use `auth.uid() IS NOT NULL` for authenticated-only SELECT.

### AD-9: Xero READ-ONLY Access

The Xero OAuth integration requests only `*.read` scopes for accounting data. Write scopes are limited to `accounting.attachments` (attach findings to transactions) and `files` (upload reports). The platform never modifies accounting data.

**Consequence**: Any feature that requires writing back to Xero (e.g., journal entries, invoice corrections) is out of scope. The platform is an analysis tool, not an accounting tool.
