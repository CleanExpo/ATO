# Multi-Agent Architecture Framework

**Version**: 1.0.0
**Project**: Australian Tax Optimizer (ATO) v8.1 "Scientific Luxury"
**Created**: 2026-01-30
**Status**: Production

---

## 1. Overview & Philosophy

### Purpose

This framework formalises the development hierarchy for the ATO platform and provides a reusable architecture pattern for client applications. It establishes:

- **Clear Authority Levels**: Developer → Senior PM → Orchestrator → Specialists
- **Standardised Communication**: Inter-agent messaging with priority levels
- **Quality Assurance**: Automated gates before phase transitions
- **Context Isolation**: Specialists work in isolated contexts to prevent cross-contamination
- **Linear Integration**: Automated task management and progress tracking

### Framework Benefits

| Benefit | Description | Impact |
|---------|-------------|--------|
| **Reduced Rework** | Quality gates catch issues early | Target: <15% rework rate |
| **Faster Delivery** | Parallel specialist execution | Target: <48h cycle time |
| **Better Quality** | Automated checks and reviews | Target: >80% test coverage |
| **Clear Accountability** | Each agent has defined responsibilities | Better progress tracking |
| **Visibility** | Linear integration provides real-time status | Stakeholder transparency |

### Integration with Existing ATO Agent Fleet

The 18 existing ATO tax agents operate **alongside** this framework:

- **Tax Agents** (18 agents): Handle domain-specific work (R&D analysis, deduction optimisation, etc.)
- **Framework Agents** (5 agents): Handle development processes (architecture, implementation, testing, documentation)
- **Orchestrator**: Coordinates both tax agents and framework specialists
- **Senior PM**: Manages everything via Linear

### How This Enhances Development

**Before Framework**:
- Agents operate independently without coordination
- No standardised communication or escalation paths
- Ad-hoc review process, no quality enforcement
- Manual Linear issue creation and tracking
- All agents share context (potential for contamination)

**With Framework**:
- Hierarchical structure with clear reporting chains
- Standardised message formats with priority levels
- Automated quality gates at each phase transition
- Automated Linear issue creation, updates, and tracking
- Context isolation ensures specialists focus on their domain

---

## 2. Hierarchical Structure

### 2.1 Developer (Authority: Ultimate)

**Role**: Provides ideas and requirements, makes final decisions on escalations, receives progress reports

**Responsibilities**:
- Define project requirements and success criteria
- Make final decisions on escalated issues
- Approve final deliverables before deployment
- Review progress reports from Senior PM

**Input Format**:

```markdown
## Developer Request
**Project:** [Project name]
**Priority:** [Critical/High/Medium/Low]
**Type:** [Feature/Bug/Research/Refactor]
**Description:** [Clear description of what needs to be done]
**Constraints:** [Time, resources, technical limitations]
**Success Criteria:**
- [Measurable outcome 1]
- [Measurable outcome 2]
- [Measurable outcome 3]
```

**Example**:

```markdown
## Developer Request
**Project:** ATO
**Priority:** High
**Type:** Feature
**Description:** Add R&D eligibility checker API endpoint that validates activities against Division 355 ITAA 1997 four-element test
**Constraints:** Must integrate with existing rnd_tax_specialist agent, 2-week timeline
**Success Criteria:**
- API endpoint /api/rnd/eligibility-checker functional
- Validates against all 4 elements (outcome unknown, systematic approach, new knowledge, scientific method)
- Returns confidence score (0-100%)
- Documented with usage examples
- ≥80% test coverage
```

### 2.2 Senior Project Manager (Authority: Executive)

**Role**: Translates developer vision into actionable plans, manages Linear board state, monitors progress, escalates blockers

**Responsibilities**:
- Create Linear parent issues from Developer requests
- Assign Orchestrator to decompose and execute work
- Monitor progress across all specialists
- Escalate blockers to Developer when needed
- Generate daily/weekly progress reports
- Approve final deliverables before presenting to Developer

**Communication Protocol**:

```markdown
## PM Status Update
**Date:** [ISO 8601 timestamp]
**Project:** [Project name]
**Linear Issue:** [Linear issue URL]
**Status:** [On Track/At Risk/Blocked]

### Completed
- [Completed item 1]
- [Completed item 2]

### In Progress
- [Item 1] (75% complete, ETA: 24 hours)
- [Item 2] (30% complete, ETA: 48 hours)

### Blockers
- [Blocker description with proposed solution]

### Developer Decision Needed
- [Yes/No] - [If yes, describe decision required]
```

**Escalation Triggers**:
- Any blocker unresolved for >4 hours
- Scope change request from Orchestrator
- Resource constraints blocking critical path
- Timeline at risk (>20% slippage)
- Budget concerns

### 2.3 Orchestrator Agent (Authority: Operational Command)

**Role**: Task decomposition, work distribution, results synthesis, quality control

**Responsibilities**:
- Analyse Developer requirements and decompose into atomic tasks
- Assign tasks to appropriate specialists (A/B/C/D) or tax agents
- Manage dependencies between tasks
- Coordinate handoffs between specialists
- Synthesise specialist outputs into cohesive result
- Enforce quality gates before phase transitions
- Report progress to Senior PM

**Agent Definition**: See `.agent/orchestrator/ORCHESTRATOR.md`

**Task Assignment Format**:

```markdown
## Task Assignment
**Task ID:** ORCH-{sequential-number}
**Assigned To:** Specialist [A/B/C/D] or [Tax Agent Name]
**Linear Issue:** [Linear issue URL]
**Priority:** [1-5, where 1 = highest]
**Dependencies:** [List of Task IDs that must complete first]
**Estimated Effort:** [Hours]
**Deadline:** [ISO 8601 datetime]

### Objective
[One-sentence description of expected outcome]

### Context
[Background information, constraints, related work]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Deliverables
1. [Specific output 1]
2. [Specific output 2]

### Handoff Instructions
[What to do when complete, who receives output]
```

**Example**:

```markdown
## Task Assignment
**Task ID:** ORCH-001
**Assigned To:** Specialist A (Architect)
**Linear Issue:** https://linear.app/unite-hub/issue/ATO-123/rnd-checker-api
**Priority:** 2
**Dependencies:** None
**Estimated Effort:** 4 hours
**Deadline:** 2026-01-31T17:00:00+11:00

### Objective
Design API schema and endpoint specification for R&D eligibility checker

### Context
Building new API endpoint to validate R&D activities against Division 355 four-element test. Must integrate with existing rnd_tax_specialist agent for compliance validation.

### Acceptance Criteria
- [ ] API request/response schema defined (TypeScript interfaces)
- [ ] OpenAPI 3.0 specification created
- [ ] Endpoint behaviour documented (success/error cases)
- [ ] Integration points with rnd_tax_specialist identified

### Deliverables
1. TypeScript interfaces for request/response types
2. OpenAPI specification file (YAML or JSON)
3. Architecture decision record (ADR) documenting design choices

### Handoff Instructions
Provide all artifacts to Specialist B (Developer) for implementation. Include integration instructions for rnd_tax_specialist agent.
```

### 2.4 Specialist Agents

#### Specialist A: Architecture & Design (Context 1)

**Domain**: System architecture, API design, database schemas, design patterns

**Output Artifacts**:
- Architecture Decision Records (ADRs)
- System diagrams (Mermaid, PlantUML)
- API specifications (OpenAPI)
- Database ERDs (entity-relationship diagrams)
- Technical specifications

**Context Focus**: Architecture documents, design patterns, technical specs
**Context Exclusions**: Implementation details, test code, user documentation

**Agent Definition**: See `.agent/specialists/architect/SPECIALIST_A.md`

#### Specialist B: Implementation & Coding (Context 2)

**Domain**: Code writing, feature implementation, refactoring, configuration

**Output Artifacts**:
- Production code (TypeScript, JavaScript)
- Configuration files
- Database migrations
- Build scripts
- API routes and handlers

**Context Focus**: Code, configs, dependencies, business logic
**Context Exclusions**: Test code, user documentation, design diagrams

**Agent Definition**: See `.agent/specialists/developer/SPECIALIST_B.md`

#### Specialist C: Testing & Validation (Context 3)

**Domain**: QA, unit/integration/E2E testing, performance benchmarking

**Output Artifacts**:
- Test files (Vitest, Playwright)
- Code coverage reports
- Performance benchmarks
- Bug reports
- Test data fixtures

**Context Focus**: Tests, fixtures, coverage data, QA reports
**Context Exclusions**: Production code writing, documentation authoring

**Agent Definition**: See `.agent/specialists/tester/SPECIALIST_C.md`

#### Specialist D: Review & Documentation (Context 4)

**Domain**: Code review, technical documentation, API docs, user guides

**Output Artifacts**:
- Review comments
- Technical documentation (markdown)
- API documentation
- Changelogs
- Migration guides
- User guides

**Context Focus**: Documentation, reviews, changelogs, guides
**Context Exclusions**: Implementation work, test writing

**Agent Definition**: See `.agent/specialists/reviewer/SPECIALIST_D.md`

---

## 3. Communication Protocols

### 3.1 Message Types and Priorities

| Type | Priority | Response SLA | Use Case |
|------|----------|--------------|----------|
| CRITICAL | P1 | Immediate | Production down, security breach, data loss |
| URGENT | P2 | < 1 hour | Blocking issue, deadline at risk, critical bug |
| STANDARD | P3 | < 4 hours | Normal task communication, handoffs |
| INFO | P4 | < 24 hours | Status updates, FYI notifications |

**Priority Guidelines**:

- **P1 (CRITICAL)**: Only for true emergencies that require immediate action
  - Production system down
  - Security vulnerability actively being exploited
  - Data corruption or loss detected
  - Legal/compliance deadline imminent

- **P2 (URGENT)**: For blockers that prevent progress
  - Specialist blocked for >2 hours
  - Critical dependency unavailable
  - Scope change needed urgently
  - Quality gate failing repeatedly

- **P3 (STANDARD)**: For normal workflow communication
  - Task assignments
  - Handoffs between specialists
  - Progress updates
  - Quality gate results (passing)

- **P4 (INFO)**: For informational updates
  - Daily status reports
  - Milestone achievements
  - Non-blocking notifications

### 3.2 Inter-Agent Message Format

```markdown
## Agent Message
**From:** [Agent Role]
**To:** [Agent Role]
**Type:** [CRITICAL/URGENT/STANDARD/INFO]
**Subject:** [Brief description, max 80 characters]
**Linear Issue:** [URL if applicable]
**Thread ID:** [For conversation continuity]

### Message
[Detailed content]

### Action Required
- [ ] [Specific action 1]
- [ ] [Specific action 2]

### Deadline
[ISO 8601 datetime if applicable]
```

**Example**:

```markdown
## Agent Message
**From:** Specialist B (Developer)
**To:** Orchestrator
**Type:** URGENT
**Subject:** Blocker: Xero API rate limit exceeded
**Linear Issue:** https://linear.app/unite-hub/issue/ATO-124
**Thread ID:** thread-001

### Message
Implementation of Xero data sync is blocked due to API rate limit (60 requests/minute). Current implementation makes 120 requests in initial sync.

Proposed mitigation: Implement exponential backoff with 2-second delay between requests. Will extend sync time from 2 minutes to 4 minutes but ensures compliance with rate limits.

### Action Required
- [ ] Approve proposed mitigation approach
- [ ] Approve extended sync time (2min → 4min)

### Deadline
2026-01-31T10:00:00+11:00 (blocks ORCH-003)
```

### 3.3 Escalation Path

```
Specialist → Orchestrator → Senior PM → Developer
     ↑______________|           |
                                ↓
                    (Returns with decision)
```

**Escalation Triggers**:

1. **From Specialist to Orchestrator**:
   - Blocker encountered (>2 hours unresolved)
   - Scope change request
   - Technical decision needed
   - Conflict with another specialist's output
   - Quality standards cannot be met

2. **From Orchestrator to Senior PM**:
   - Blocker unresolved after escalation (>4 hours total)
   - Resource constraint (budget, timeline, personnel)
   - Architectural decision with significant impact
   - Scope creep detected
   - Quality gate failures persist

3. **From Senior PM to Developer**:
   - Timeline at risk (>20% slippage)
   - Budget exceeded or at risk
   - Fundamental requirement change needed
   - Strategic decision required
   - External dependency blocking critical path

**Escalation Response Times**:
- Specialist → Orchestrator: 30 minutes
- Orchestrator → Senior PM: 1 hour
- Senior PM → Developer: 4 hours

### 3.4 Message Type Specifications

**Task Assignment Message**:
- From: Orchestrator
- To: Specialist or Tax Agent
- Priority: STANDARD
- Contains: Objective, context, acceptance criteria, deliverables, handoff instructions
- Action Required: Review task, begin work, update status

**Status Update Message**:
- From: Specialist or Tax Agent
- To: Orchestrator or Senior PM
- Priority: INFO (or URGENT if blocked)
- Contains: Progress percentage, completed items, in-progress items, blockers
- Action Required: None (or unblock if blockers present)

**Handoff Message**:
- From: Specialist
- To: Another Specialist
- Priority: STANDARD
- Contains: Work summary, key decisions, artifacts, assumptions, open questions
- Action Required: Review context, begin next phase

**Escalation Message**:
- From: Any agent
- To: Higher authority
- Priority: URGENT or CRITICAL
- Contains: Issue description, impact, proposed solution
- Action Required: Review and provide decision

**Quality Review Message**:
- From: Orchestrator or Specialist D
- To: Specialist or Orchestrator
- Priority: STANDARD
- Contains: Quality check results, approvals, revision requests
- Action Required: Address any revisions, acknowledge approval

---

## 4. Workflow Processes

### 4.1 Standard Task Flow

```
Developer provides requirement
         ↓
Senior PM creates Linear issue → assigns Orchestrator
         ↓
Orchestrator decomposes requirement → creates sub-tasks
         ↓
Orchestrator assigns tasks to Specialists (A/B/C/D) or Tax Agents
         ↓
Specialists work in parallel (isolated contexts)
         ↓
Specialists pass quality gates → handoff to next phase
         ↓
Orchestrator integrates outputs → runs integration QA
         ↓
Senior PM reviews integrated output → reports to Developer
         ↓
Developer approves → Deploy
```

### 4.2 Parallel Execution Timeline

Example: R&D Feature Implementation

```
Specialist A: ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
              [Design API schema]

Tax Agent:    ░░░░██░░░░░░░░░░░░░░░░░░░░░░░░░░
              [Validate Division 355]

Specialist B: ░░░░░░████████░░░░░░░░░░░░░░░░░░
              [Implement API + integration]

Specialist C: ░░░░░░░░░░░░░░████████░░░░░░░░░░
              [Write tests]

Specialist D: ░░░░░░░░░░░░░░░░░░░░░░████████░░
              [Document API]

Orchestrator: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████
              [Integration QA]
```

**Timeline Explanation**:
- **0-4h**: Specialist A designs API schema
- **4-6h**: Tax agent validates compliance (parallel start possible)
- **6-14h**: Specialist B implements based on A's design + tax rules
- **14-22h**: Specialist C writes tests for B's implementation
- **22-30h**: Specialist D documents the API
- **30-34h**: Orchestrator integrates all outputs and runs final QA

**Total Time**: 34 hours (vs ~50 hours if fully sequential)

### 4.3 Dependency Management

**YAML Dependency Format**:

```yaml
architecture_design:
  specialist: A
  blocks: [implementation, api_docs]
  blocked_by: [requirements_clarification]
  estimated_hours: 4

implementation:
  specialist: B
  blocks: [testing, code_review]
  blocked_by: [architecture_design, compliance_validation]
  estimated_hours: 8

compliance_validation:
  tax_agent: rnd_tax_specialist
  blocks: [implementation]
  blocked_by: [architecture_design]
  estimated_hours: 2

testing:
  specialist: C
  blocks: [deployment]
  blocked_by: [implementation]
  estimated_hours: 8

documentation:
  specialist: D
  blocks: [deployment]
  blocked_by: [implementation, testing]
  estimated_hours: 8

integration_qa:
  orchestrator: true
  blocks: [pm_review]
  blocked_by: [documentation, testing]
  estimated_hours: 4
```

**Dependency Types**:

1. **Hard Dependencies** (blocking): Task B cannot start until Task A completes
   - Example: Implementation cannot start until architecture design completes
   - Enforced by Orchestrator

2. **Soft Dependencies** (informational): Task B benefits from Task A but can proceed
   - Example: Documentation can start based on design, updated when implementation completes
   - Noted in task description but not enforced

3. **Parallel Dependencies** (race condition): Multiple tasks can start simultaneously
   - Example: Specialist A designs while tax agent validates compliance
   - Both inform Specialist B's implementation

### 4.4 Handoff Protocol

**Handoff Checklist**:

When Specialist X completes work and hands off to Specialist Y:

- [ ] All acceptance criteria met
- [ ] Quality gate passed
- [ ] Artifacts created and documented
- [ ] Key decisions documented with rationale
- [ ] Assumptions explicitly stated
- [ ] Open questions identified (with suggested answers)
- [ ] Context provided for next phase
- [ ] Handoff message sent to recipient
- [ ] Linear issue updated with handoff comment

**Handoff Message Template**:

```markdown
## Context Handoff
**From:** Specialist [X]
**To:** Specialist [Y]
**Task ID:** [ORCH-XXX]
**Linear Issue:** [URL]

### Summary of Completed Work
[2-3 sentence overview of what was accomplished]

### Key Decisions Made
1. [Decision with rationale]
2. [Decision with rationale]

### Files/Artifacts Created
- `path/to/file1.ts` - [Brief description]
- `path/to/file2.md` - [Brief description]

### Assumptions
- [Assumption 1]
- [Assumption 2]

### Open Questions
- ❓ [Question 1] (Suggested answer: [suggestion])
- ❓ [Question 2] (Needs decision from Orchestrator)

### Context for Next Phase
[Specific information the next specialist needs to know to start work effectively]
```

---

## 5. Linear Integration

### 5.1 Required Labels

Create these labels in Linear project `ato-3f31f766c467`:

**Agent Labels**:
- `agent:orchestrator` (purple)
- `agent:specialist-a` (blue)
- `agent:specialist-b` (green)
- `agent:specialist-c` (yellow)
- `agent:specialist-d` (orange)
- `agent:tax` (red, for any of the 18 tax agents)

**Status Labels**:
- `status:pending` (grey)
- `status:in-progress` (blue)
- `status:blocked` (red)
- `status:review` (yellow)
- `status:done` (green)

**Priority Labels**:
- `priority:p1` (red, CRITICAL)
- `priority:p2` (orange, URGENT)
- `priority:p3` (yellow, STANDARD)
- `priority:p4` (grey, INFO)

**Type Labels**:
- `type:feature` (blue)
- `type:bug` (red)
- `type:docs` (green)
- `type:research` (purple)
- `type:refactor` (yellow)

### 5.2 Update Frequency

| Event | Linear Action | Who | When |
|-------|---------------|-----|------|
| Task assigned | Create issue, status=pending | Orchestrator | Immediately |
| Work started | Update status=in-progress | Specialist | When starting |
| Progress update | Add comment | Specialist | Daily or when significant |
| Blocker hit | Update status=blocked, add comment | Specialist | Immediately |
| Review needed | Update status=review | Specialist | Upon completion |
| Review complete | Update status=in-progress or done | Reviewer | After review |
| Task complete | Update status=done, add summary | Specialist | Upon completion |
| Scope change | Update description, notify stakeholders | Orchestrator | When approved |

### 5.3 Comment Standards

**Status Update Comment**:

```markdown
## Status Update - [ISO 8601]
**Agent:** [Role]
**Progress:** [X%]

### Completed
- ✅ [Item 1]
- ✅ [Item 2]

### In Progress
- 🚀 [Item 3] (ETA: [hours/days])

### Blockers
- None

OR

- 🚫 [Blocker description]
  - **Impact**: [What is blocked]
  - **Proposed Solution**: [How to unblock]

### Next Steps
- [Action 1]
- [Action 2]
```

**Quality Gate Comment**:

```markdown
## Quality Gate: [Gate Name]
**Status:** ✅ PASSED or ❌ FAILED
**Score:** [X]% ([Y]/[Z] checks passed)

### Checks
- ✅ [Check 1] (required)
- ✅ [Check 2] (required)
- ⚠️  [Check 3] (recommended)

### Blockers
[If failed, list what must be fixed]

### Recommendations
[Optional improvements]

---
*Evaluated: [ISO 8601]*
```

**Handoff Comment**:

```markdown
## Handoff: [From Agent] → [To Agent]

### Work Completed
[Brief summary]

### Key Outputs
- `file1.ts` - [Description]
- `file2.md` - [Description]

### Important Context
[What the next agent needs to know]

### Thread
See full handoff message in [message link or reference]

---
*Handed off: [ISO 8601]*
```

### 5.4 Issue Hierarchy Example

```
Parent Issue (Developer Request):
├─ ORCH-001: Architecture Design (Specialist A)
│   └─ Status: Done (✅ Design Complete gate passed)
├─ ORCH-002: Tax Compliance Validation (rnd_tax_specialist)
│   └─ Status: Done
├─ ORCH-003: Implementation (Specialist B)
│   ├─ Depends on: ORCH-001, ORCH-002
│   └─ Status: In Progress (🚀 60% complete)
├─ ORCH-004: Testing (Specialist C)
│   ├─ Depends on: ORCH-003
│   └─ Status: Pending
└─ ORCH-005: Documentation (Specialist D)
    ├─ Depends on: ORCH-003, ORCH-004
    └─ Status: Pending
```

---

## 6. Quality Gates

### 6.1 Phase Gates Overview

| Gate | Owner | Criteria | Blocks |
|------|-------|----------|--------|
| Design Complete | Specialist A + Orchestrator | ADR approved, diagrams complete, risks documented | Implementation start |
| Implementation Complete | Specialist B + Orchestrator | Code compiles, linting passes, basic functionality works | Testing start |
| Testing Complete | Specialist C + Orchestrator | Coverage ≥80%, tests pass, no critical bugs | Documentation start |
| Documentation Complete | Specialist D + Orchestrator | Docs accurate, reviewed, published | Integration start |
| Integration Complete | Orchestrator | All outputs merged, system functional | PM review |
| Final Approval | Senior PM + Developer | Meets requirements, ready to deploy | Deployment |

### 6.2 Quality Review Checklist

```markdown
## Quality Review
**Task ID:** [ORCH-XXX]
**Reviewer:** [Agent Role]
**Date:** [ISO 8601]

### Functional
- [ ] Meets all acceptance criteria
- [ ] Handles edge cases appropriately
- [ ] Error handling implemented correctly
- [ ] User experience is intuitive

### Technical
- [ ] Follows architecture guidelines
- [ ] No security vulnerabilities
- [ ] Performance is acceptable
- [ ] Code style compliant (linting passes)
- [ ] TypeScript strict mode compliant

### Documentation
- [ ] Code has appropriate comments
- [ ] External documentation updated
- [ ] Changelog updated
- [ ] Examples provided (if applicable)

### Testing
- [ ] Unit tests included
- [ ] Integration tests (if applicable)
- [ ] All tests passing
- [ ] Code coverage ≥80%

### Result
- [ ] ✅ APPROVED
- [ ] ⚠️  APPROVED WITH COMMENTS
- [ ] ❌ REVISIONS REQUIRED

### Comments
[Detailed feedback, suggestions, required changes]
```

### 6.3 Automated Quality Gate Checks

See `lib/agents/quality-gates.ts` for implementation.

**Design Complete Gate**:
- ✅ ADR file exists and is complete
- ✅ System diagrams provided (Mermaid/PlantUML)
- ✅ Risks documented with mitigations
- ⚠️  API specification provided (recommended)
- ⚠️  Database ERD provided (recommended)

**Implementation Complete Gate**:
- ✅ Code files created
- ✅ Code compiles without errors
- ✅ Linting passes (ESLint)
- ✅ Basic functionality verified

**Testing Complete Gate**:
- ✅ Test files created
- ✅ All tests passing
- ✅ Code coverage ≥80%
- ✅ No critical bugs

**Documentation Complete Gate**:
- ✅ Technical documentation written
- ✅ API documentation complete
- ✅ Changelog updated
- ⚠️  Examples provided (recommended)

**Integration Complete Gate**:
- ✅ All specialist outputs merged
- ✅ Integrated system functional
- ✅ No merge conflicts
- ✅ All prior quality gates passed

**Final Approval Gate**:
- ✅ Meets original requirements
- ✅ Ready for deployment
- ✅ Senior PM approval
- ✅ Developer approval

---

## 7. Context Management

### 7.1 Context Window Allocation

Each specialist operates in an isolated context to prevent cross-contamination:

| Specialist | Context Focus | Excluded from Context |
|------------|---------------|----------------------|
| **Specialist A** | Architecture docs, design patterns, ADRs, diagrams, API specs | Implementation code, test code, user docs |
| **Specialist B** | Production code, configs, dependencies, business logic | Test code, user documentation, design diagrams |
| **Specialist C** | Test code, fixtures, coverage reports, QA results | Production code (except as read-only reference) |
| **Specialist D** | Documentation, reviews, changelogs, guides | Implementation code (except for review) |

**Why Context Isolation?**

1. **Focus**: Each specialist focuses on their domain without distractions
2. **Quality**: Prevents implementation details from influencing design (and vice versa)
3. **Efficiency**: Smaller context windows mean faster agent response times
4. **Separation of Concerns**: Enforces architectural boundaries

### 7.2 Context Handoff Protocol

When handing off between specialists, only relevant information is transferred:

**A → B (Design to Implementation)**:
- ✅ Include: ADRs, API schemas, database ERDs, technical specs
- ❌ Exclude: Prior implementation attempts, test code from other features

**B → C (Implementation to Testing)**:
- ✅ Include: Production code, API endpoints, business logic, known edge cases
- ❌ Exclude: Design rationale (unless impacts testing), documentation drafts

**C → D (Testing to Documentation)**:
- ✅ Include: Test results, coverage reports, edge cases tested, known limitations
- ❌ Exclude: Implementation internals, design discussions

**All → Orchestrator (Integration)**:
- ✅ Include: All artifacts, quality gate results, handoff messages
- ❌ Exclude: Nothing (Orchestrator needs full picture for integration)

### 7.3 Context Handoff Template

See Section 4.4 for the complete handoff message template.

Key principle: **Only pass forward what the next specialist needs to succeed.**

---

## 8. Metrics & Reporting

### 8.1 Key Metrics

| Metric | Definition | Target | Measurement Frequency |
|--------|------------|--------|----------------------|
| Task Completion Rate | Tasks done / tasks assigned | > 90% | Per sprint (2 weeks) |
| Cycle Time | Assignment to completion | < 48 hours | Per task |
| Blocker Resolution Time | Time blocked to unblocked | < 4 hours | Per blocker |
| Rework Rate | Tasks requiring revision | < 15% | Per sprint |
| Documentation Coverage | Features with complete docs | 100% | Per release |
| Test Coverage | Code covered by tests | > 80% | Per commit |
| Quality Gate Pass Rate | First-time pass rate | > 85% | Per gate type |

**Metric Collection**:
- Automated via Linear API (see `lib/linear/orchestrator.ts`)
- Daily aggregation in `DailyReport` interface
- Weekly trends analysis
- Monthly executive summary

### 8.2 Daily Report Format

```markdown
## Daily Status Report
**Date:** [ISO 8601]
**Project:** ATO
**Reporting Agent:** Senior PM

### Summary
[1-2 sentence overview of progress today]

### Progress by Specialist
| Specialist | Tasks Active | Completed Today | Blocked | Trend |
|------------|--------------|-----------------|---------|-------|
| A (Architect) | 2 | 1 | 0 | ↗️ |
| B (Developer) | 3 | 2 | 1 | → |
| C (Tester) | 1 | 0 | 0 | ↘️ |
| D (Reviewer) | 2 | 1 | 0 | ↗️ |

### Key Accomplishments
- ✅ [Significant achievement 1]
- ✅ [Significant achievement 2]

### Blockers & Risks
| Issue | Impact | Mitigation | Owner | ETA |
|-------|--------|------------|-------|-----|
| [Description] | [What's blocked] | [Solution] | [Who's fixing] | [When] |

### Tomorrow's Focus
1. [High-priority item 1]
2. [High-priority item 2]
3. [High-priority item 3]

### Developer Attention Needed
- [ ] None

OR

- [ ] [Specific decision or approval required]
```

### 8.3 Weekly Metrics Dashboard

Generated automatically from Linear data:

```markdown
## Weekly Metrics - Week of [Date]

### Overall Health: [🟢 On Track | 🟡 At Risk | 🔴 Blocked]

### Velocity
- Tasks Completed: [X] (Target: [Y])
- Avg Cycle Time: [X]h (Target: <48h)
- Completion Rate: [X]% (Target: >90%)

### Quality
- Rework Rate: [X]% (Target: <15%)
- Quality Gate Pass Rate: [X]% (Target: >85%)
- Test Coverage: [X]% (Target: >80%)

### Blockers
- Total Blockers This Week: [X]
- Avg Resolution Time: [X]h (Target: <4h)
- Currently Blocked Tasks: [X]

### Trends
[Chart or sparkline showing week-over-week trends]

### Highlights
- 🎯 [Key achievement 1]
- 🎯 [Key achievement 2]

### Concerns
- ⚠️  [Risk or issue 1]
- ⚠️  [Risk or issue 2]

### Action Items
- [ ] [Action item 1]
- [ ] [Action item 2]
```

---

## 9. Quick Reference Commands

### Trigger Phrases for AI Agents

```
# Task decomposition
@orchestrator decompose: [Developer requirement description]

# Specialist assignments
@specialist-a design: [Component or feature name]
@specialist-b implement: [Feature or fix description]
@specialist-c test: [Component or feature name]
@specialist-d document: [Component or feature name]

# Tax agent assignments
@rnd-tax-specialist analyze: [R&D activity description]
@deduction-optimizer scan: [Expense category]
@loss-recovery-agent review: [Loss carryforward scenario]

# Status and reporting
@senior-pm status
@senior-pm weekly-report
@orchestrator progress: [Task ID]

# Escalations
@senior-pm escalate: [Issue description]
@developer decision-needed: [Decision description]

# Quality gates
@orchestrator quality-gate: [design|implementation|testing|documentation|integration|final]
```

### Common Workflows

**New Feature Request**:
```
1. Developer submits requirement (formatted per Section 2.1)
2. @senior-pm create-issue: [Requirement]
3. @orchestrator decompose: [Task ID]
4. Orchestrator assigns specialists and creates Linear sub-tasks
5. Specialists execute in parallel with handoffs
6. Quality gates enforce standards at each phase
7. @orchestrator integrate: [Task ID]
8. @senior-pm review: [Task ID]
9. @developer approve: [Task ID]
```

**Bug Fix Workflow**:
```
1. Developer reports bug
2. @orchestrator triage: [Bug description]
3. Orchestrator assigns to appropriate specialist
4. Specialist fixes and writes regression test
5. @specialist-c verify-fix: [Bug ID]
6. @specialist-d document-fix: [Bug ID] (changelog)
7. @developer approve-hotfix: [Bug ID]
```

**Research Task**:
```
1. Developer requests research (e.g., "Evaluate new testing framework")
2. @orchestrator assign-research: [Research topic]
3. Specialist (usually A or D) conducts research
4. @specialist-[x] present-findings: [Research ID]
5. @developer decision: [Approve|Reject|More research needed]
```

---

## 10. Integration with Existing ATO Agent Fleet

### Current Agent Ecosystem

**18 Tax Domain Agents** (unchanged):
- `tax_law_analyst` - Australian tax law research
- `xero_auditor` - Xero data extraction and analysis
- `rnd_tax_specialist` - R&D Tax Incentive (Division 355)
- `deduction_optimizer` - Maximise allowable deductions
- `loss_recovery_agent` - Tax losses and Division 7A
- `trust_distribution_analyzer` - Section 100A and UPE
- `bad_debt_recovery_agent` - Section 25-35 bad debt deductions
- `business_transition_agent` - Business cessation and pivots
- `agent_scout` - Coordinated agent discovery
- `sbito_optimizer` - Small Business Instant Tax Offset
- `cgt_concession_planner` - Capital Gains Tax concessions
- `fbt_optimizer` - Fringe Benefits Tax optimisation
- `content_orchestrator` - Content generation coordination
- `accountant_report_generator` - Generate accountant reports
- `government_grants_finder` - Identify grant opportunities
- `senior_product_manager` - Product strategy
- `senior_project_manager_enhanced` - Project management
- (Plus 1 more)

**16 Reusable Skills** (available to all agents):
- `australian_tax_law_research`
- `xero_api_integration`
- `xero_connection_management`
- `rnd_eligibility_assessment`
- `tax_compliance_verification`
- `tax_fraud_detection`
- `google_workspace_integration`
- `google_slides_storyboard`
- `image_generation`
- `video_generation`
- `notebook_lm_research`
- `simple_report_export`
- `idea-intake-workflow`
- `idea-queue-capture`
- `work-queue-processor`
- (Plus 1 more)

### Two-Tier Architecture

**Tier 1: Development Process Agents** (new framework)
- Orchestrator
- Specialist A (Architecture & Design)
- Specialist B (Implementation & Coding)
- Specialist C (Testing & Validation)
- Specialist D (Review & Documentation)

**Tier 2: Tax Domain Agents** (existing 18 agents)
- Handle domain-specific Australian tax work
- Can be invoked by Orchestrator as part of task decomposition
- Integrate with Specialists as needed

### Integration Example: R&D Feature

```
Developer Request: "Add R&D eligibility checker API"

Orchestrator decomposes:
├─ ORCH-001: Design API schema
│   ├─ Specialist A: Create API spec
│   └─ Tax Agent (tax_law_analyst): Provide Division 355 legislation reference
│
├─ ORCH-002: Validate R&D compliance logic
│   └─ Tax Agent (rnd_tax_specialist): Define four-element test validation rules
│
├─ ORCH-003: Implement API endpoint
│   ├─ Specialist B: Write code
│   └─ Integrates: Specialist A's design + rnd_tax_specialist's rules
│
├─ ORCH-004: Write tests
│   ├─ Specialist C: Unit + integration tests
│   └─ Uses: Tax test cases from rnd_tax_specialist
│
└─ ORCH-005: Document API
    ├─ Specialist D: API docs + user guide
    └─ Includes: Compliance requirements from tax agents

Result: Framework agents handle development process,
        Tax agents provide domain expertise
```

### When to Use Which Agents

**Use Framework Agents for**:
- System architecture and design
- Code implementation
- Testing and QA
- Code review
- Documentation authoring

**Use Tax Agents for**:
- Australian tax law research and interpretation
- R&D eligibility assessment
- Deduction identification and optimisation
- Tax loss and Division 7A analysis
- Xero data forensic auditing
- Compliance validation
- ATO regulation updates

**Both Work Together**:
- Orchestrator coordinates both types
- Tax agents provide business rules → Specialist B implements
- Specialist C tests using tax agent scenarios
- Specialist D documents tax requirements
- Senior PM manages all via Linear

### Skill Binding

Framework specialists can bind to existing skills:

**Specialist B (Developer)**:
- `xero_api_integration`
- `xero_connection_management`
- `google_workspace_integration`

**Specialist C (Tester)**:
- `tax_compliance_verification`
- `tax_fraud_detection`

**Specialist D (Documentation)**:
- `google_slides_storyboard`
- `simple_report_export`

**Orchestrator**:
- `work-queue-processor`
- `idea-queue-capture`

---

## 11. Implementation Checklist

### Infrastructure Setup

- [ ] Create Linear labels (agent:*, status:*, priority:*, type:*)
- [ ] Configure Linear API key in `.env.local`
- [ ] Set Linear team ID and project ID in config
- [ ] Create `.agent/orchestrator/` directory
- [ ] Create `.agent/specialists/` directory structure
- [ ] Create `lib/linear/` directory
- [ ] Create `lib/agents/` directory
- [ ] Create `scripts/agents/` directory
- [ ] Create `scripts/linear/` directory

### Code Implementation

- [ ] Implement `lib/linear/orchestrator.ts`
- [ ] Implement `lib/agents/communication.ts`
- [ ] Implement `lib/agents/quality-gates.ts`
- [ ] Create orchestrator agent definition
- [ ] Create 4 specialist agent definitions
- [ ] Add scripts to `package.json`
- [ ] Create supporting CLI scripts

### Documentation Updates

- [ ] Update `CLAUDE.md` with framework section
- [ ] Update `README.md` with architecture overview
- [ ] Update `.agent/AGENTS.md` with tier structure
- [ ] Create this `MULTI_AGENT_ARCHITECTURE.md` file ✅

### Testing & Validation

- [ ] End-to-end workflow test (R&D feature example)
- [ ] Linear integration validation (all 5 test cases)
- [ ] Quality gate validation (all 6 gates)
- [ ] Context handoff validation
- [ ] Metrics reporting validation

### Deployment

- [ ] Commit all changes to `main` branch
- [ ] Tag release: `v8.2-multi-agent-framework`
- [ ] Update Linear project with initial issues
- [ ] Run daily report to verify metrics collection
- [ ] Monitor for first 2 weeks, adjust as needed

---

## 12. Troubleshooting

### Common Issues

**Issue**: Linear API rate limit exceeded
**Solution**: Implement exponential backoff in `lib/linear/orchestrator.ts`, reduce update frequency

**Issue**: Specialist context contamination (seeing other specialists' work)
**Solution**: Review handoff messages, ensure only relevant artifacts passed forward

**Issue**: Quality gates too strict, blocking progress
**Solution**: Review failed gate criteria, consider making some checks "recommended" instead of "required"

**Issue**: Blockers not escalating properly
**Solution**: Check message priority levels, verify escalation triggers in agent definitions

**Issue**: Daily reports not generating
**Solution**: Verify Linear API credentials, check `generateDailyReport()` implementation

### Support

- **Framework Issues**: Review this document, check `.agent/orchestrator/ORCHESTRATOR.md`
- **Linear Integration**: Check `lib/linear/orchestrator.ts`, verify API credentials
- **Quality Gates**: Check `lib/agents/quality-gates.ts` implementation
- **Agent Communication**: Check `lib/agents/communication.ts`, review message logs

---

## 13. Future Enhancements

### Month 1-2: Metrics & Optimisation

- Predictive blocker detection (ML on historical blocker patterns)
- Intelligent task estimation (based on historical data)
- Auto-assignment based on specialist workload and expertise
- Anomaly detection (tasks taking unusually long)

### Month 3-4: Automation

- Auto-merge non-conflicting specialist outputs
- Intelligent handoff timing (detect when specialist ready for next phase)
- Smart quality gate adjustment (relax/tighten based on project phase)
- Automated daily standup generation

### Month 5-6: Client Application Template

- Export framework as standalone package
- Create client project template with framework pre-configured
- Build framework configuration UI (for non-technical users)
- Multi-project support (one framework, many projects)

---

**Framework Version**: 1.0.0
**Last Updated**: 2026-01-30
**Maintained By**: Senior PM + Orchestrator
**Next Review**: 2026-02-28 (monthly review cycle)
