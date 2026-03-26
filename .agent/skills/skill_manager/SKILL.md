---
id: skill-manager
name: skill-manager
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
metadata:
  author: NodeJS-Starter-V1
  version: 1.0.0
  locale: en-AU
description: ">-"
context: fork
---


# Skill Manager - Agent Skill Lifecycle Management

Meta-skill for analysing, generating, cataloguing, and validating the project's skill ecosystem. Operates as a peer to the Orchestrator in the agent hierarchy.

## Description

Manages the full lifecycle of agent skills including gap analysis, generation from templates or descriptions, catalogue browsing, and health validation. Ensures every skill in the project meets quality standards, uses Australian English, and is registered in the skill registry.

## When to Apply

### Positive Triggers

- Analysing which skills the project needs but lacks
- Generating a new skill from a template or description
- Browsing the built-in skill catalogue for ideas
- Validating an existing skill's quality and compliance
- User mentions: "skill gap", "generate skill", "missing skills", "skill health"
- Orchestrator requests gap analysis before a new phase
- A new agent is added without corresponding skill coverage

### Negative Triggers

- The task is about using an existing skill (route to that skill instead)
- The task is pure code implementation (route to Specialist B)
- The task is about agent configuration, not skill content

## Core Directives

### Path Conventions

- Custom skills live in: `.skills/custom/{skill-name}/SKILL.md`
- Vercel skills live in: `.skills/vercel-labs-agent-skills/skills/`
- Skill registry: `.skills/AGENTS.md`
- Agent profiles: `.claude/agents/{agent-name}/agent.md`
- Command interfaces: `.claude/commands/{command-name}.md`
- Reference data: `.skills/custom/skill-manager/references/`

### Token Economy (Shannon Protocol)

- Load only the reference file relevant to the current mode
- Do not dump entire catalogue when user asks for a single gap
- Compress analysis output to actionable recommendations
- Maximum response: 200 lines for MODE 1, 500 lines for MODE 2 output

---

## MODE 1: Full Analysis

**Trigger**: "analyse skills", "skill gap", "missing skills", "what skills do we need?"

### Step 1: Context Scan

Scan the project to build an inventory:

```
1. Read .skills/AGENTS.md → extract installed skill names
2. Read .skills/custom/*/SKILL.md → extract frontmatter (name, description)
3. Read .skills/vercel-labs-agent-skills/skills/*/SKILL.md → same
4. Read .claude/agents/*/agent.md → extract skills_required fields
5. Scan project structure for context signals:
   - .github/workflows/ → CI/CD detected
   - docker-compose.yml → Docker detected
   - apps/backend/src/api/ → API routes detected
   - apps/web/components/ → Frontend components detected
   - apps/backend/src/db/ → Database models detected
   - apps/backend/src/agents/ → AI integration detected
```

**Output**: Installed skills list + detected project context.

### Step 2: Gap Analysis

Apply rules from `references/gap-analysis.md`:

```
1. Check DEPENDENCY RULES:
   For each installed skill, verify required dependencies are installed.
   Missing dependency → Critical priority, confidence 1.0

2. Check COMPLEMENTARY-PAIR RULES:
   For each installed skill, check if known complements are installed.
   Missing complement → High priority, confidence per rule table

3. Check CATEGORY-COVERAGE RULES:
   For each foundational category, check if ≥1 skill is installed.
   Empty foundational category → Medium priority, confidence 0.7

4. Calculate final_score for each gap:
   final_score = base_priority × confidence × context_multiplier
   (See references/gap-analysis.md for multiplier calculation)

5. Sort gaps by final_score descending
```

### Step 3: Recommendations

Format output per the gap-analysis report template. Include:

- Top 5 Critical/Recommended gaps with scores and reasons
- Quick-win suggestions (Low complexity gaps with high scores)
- Suggested generation order (respect dependency graph)

**Response Format**:

```
[AGENT_ACTIVATED]: Skill Manager
[PHASE]: Analysis
[STATUS]: complete

{gap analysis report}

[NEXT_ACTION]: Generate top-priority skill via MODE 2, or browse catalogue via MODE 3
```

---

## MODE 2: Generate Skill

**Trigger**: "generate skill", "create skill", "new skill for {topic}"

### Input

User provides one of:

- A catalogue entry reference (e.g., "generate 2.1 api-contract")
- A free-form description (e.g., "generate a skill for webhook handling")
- A gap analysis recommendation (from MODE 1 output)

### Generation Workflow

#### Step 1: Resolve Template

```
If catalogue reference provided:
  → Load entry from references/catalogue.md
  → Extract: name, description, complexity, complements

If free-form description:
  → Search catalogue for closest match
  → If match found (>70% relevance): use as base template
  → If no match: generate from scratch using description
```

#### Step 2: Generate SKILL.md

Produce a SKILL.md file following this exact structure:

```yaml
---
name: {kebab-case-name}
description: >-
  {50-500 character description in en-AU}
license: MIT
metadata:
  author: NodeJS-Starter-V1
  version: '1.0.0'
  locale: en-AU
---
```

Body sections (in order):

```markdown
# {Title} - {Subtitle}

{One paragraph overview}

## When to Apply

### Positive Triggers
- {3+ positive triggers}

### Negative Triggers
- {1+ negative triggers}

## Core Directives
{Rules, conventions, path references}

## {Main Content Sections}
{Skill-specific content with code examples}

## Response Format
{Using [AGENT_ACTIVATED] / [PHASE] / [STATUS] convention}

## Australian Localisation (en-AU)
- Date Format: DD/MM/YYYY
- Currency: AUD ($)
- Spelling: colour, behaviour, optimisation, analyse, centre
```

#### Step 3: Validate

Run MODE 4 (Health Check) on the generated skill before presenting it.

#### Step 4: Register

If the skill passes health check:

```
1. Write SKILL.md to .skills/custom/{name}/SKILL.md
2. Create references/ directory if skill needs supplementary files
3. Update .skills/AGENTS.md:
   - Add row to Custom Skills table
   - Update Skill Priority list if applicable
4. Report success with file paths
```

**Response Format**:

```
[AGENT_ACTIVATED]: Skill Manager
[PHASE]: Generation
[STATUS]: {generating | validating | complete}

{generated SKILL.md content or summary}

[NEXT_ACTION]: Review generated skill, then run health check
```

---

## MODE 3: Skill Catalogue Browse

**Trigger**: "browse skills", "skill catalogue", "what skills are available?"

Load and present data from `references/catalogue.md`.

Supports filtering by:

- **Category**: "show me API skills" → filter to Category 2
- **Complexity**: "show easy skills" → filter to Low complexity
- **Complement**: "what pairs with council-of-logic?" → filter by Key Complements

Present results as a filtered table. Do not dump the entire catalogue unless explicitly requested.

---

## MODE 4: Skill Health Check

**Trigger**: "skill health", "validate skill", "check skill quality"

Load validation rubric from `references/health-check.md`.

Supports:

- **Single skill**: `/skill-manager health council-of-logic` → validate one skill
- **All skills**: `/skill-manager health --all` → validate every installed skill
- **Generated skill**: Automatically invoked after MODE 2 generation

Output the Health Report format defined in `references/health-check.md`.

---

## Anti-Patterns

| Pattern | Problem | Correct Approach |
|---------|---------|------------------|
| Generating skills without gap analysis | Produces redundant or low-priority skills | Run MODE 1 analysis before MODE 2 generation |
| American English in generated skills | Fails health check locale validation | Always use en-AU: analyse, colour, optimise, behaviour |
| Monolithic SKILL.md over 500 lines | Exceeds Shannon compression threshold | Split into SKILL.md + references/ directory |
| Hardcoded absolute file paths | Breaks portability across environments | Use relative paths from project root |
| Skipping health check after generation | Unvalidated skills enter the registry | Always run MODE 4 before registering a new skill |

## Checklist

- [ ] Gap analysis completed before generating new skills
- [ ] Generated SKILL.md is under 500 lines
- [ ] All en-AU spelling verified (analyse, catalogue, colour, optimise, behaviour)
- [ ] Skill registered in `.skills/AGENTS.md`
- [ ] Health check (MODE 4) passed with no critical findings

## Response Format

All Skill Manager outputs follow the project response convention:

```
[AGENT_ACTIVATED]: Skill Manager
[PHASE]: {Analysis | Generation | Catalogue | Health Check}
[STATUS]: {in_progress | awaiting_verification | complete}

{response_content}

[NEXT_ACTION]: {what happens next}
```

## Integration Points

### Orchestrator

The Orchestrator can invoke Skill Manager before starting a new phase:

```python
# In orchestrator route_task:
if self.is_skill_management_task(task):
    return self.get_agent('skill-manager')
```

### Council of Logic

MODE 2 (Generate Skill) applies **Shannon Check** to generated content:

- Description under 500 characters?
- SKILL.md under 500 lines?
- No redundant sections?
- Maximum signal, minimum noise?

### Spec Builder

When generating complex skills (High complexity), Skill Manager may invoke Spec Builder for a specification document before generation.

## Behavioural Rules

1. **Never hardcode paths** — always use relative paths from project root
2. **Always en-AU** — colour, analyse, catalogue, optimise, centre, behaviour
3. **Under 500 lines** — every generated SKILL.md must be under 500 lines
4. **No self-generation without analysis** — MODE 2 should follow MODE 1 or explicit user request
5. **Registry consistency** — every generated skill must be registered in `.skills/AGENTS.md`
6. **Respect hierarchy** — Skill Manager is a peer to Orchestrator, not subordinate
7. **Token economy** — load only the reference file needed for the current mode

## Australian Localisation (en-AU)

- **Date Format**: DD/MM/YYYY
- **Time Format**: H:MM am/pm (AEST/AEDT)
- **Currency**: AUD ($)
- **Spelling**: colour, behaviour, optimisation, analyse, centre, catalogue
- **Tone**: Direct, professional, actionable
