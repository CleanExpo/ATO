# Documentation Cleanup Plan
## 277 Markdown Files - Systematic Purge Strategy

### Current State
- **Root level**: 80 .md files (session summaries, status reports, completion docs)
- **ato-app/**: 46 .md files
- **ato-app/docs/archive/**: Archive folder with old docs
- **ato-app/.agent/**: 18 agent configs (keep these)
- **Grand Total**: 277 markdown files

---

## KEEP - Essential Files (Do Not Delete)

### Core Documentation (9 files)
```
ato-app/README.md              - Main project documentation
ato-app/CLAUDE.md              - AI integration guidelines
ato-app/spec.md                - Technical specification
ato-app/ARCHITECTURE.md        - System architecture
ato-app/API_DOCUMENTATION.md   - API reference
ato-app/DESIGN_SYSTEM.md       - UI/UX design system
ato-app/AGENTS_README.md       - Agent system overview
ato-app/DATABASE_MIGRATIONS.md - Database docs
ato-app/MULTI_AGENT_ARCHITECTURE.md - Framework spec
```

### Agent Configuration (Keep ALL in .agent/)
```
ato-app/.agent/AGENTS.md
ato-app/.agent/orchestrator/ORCHESTRATOR.md
ato-app/.agent/specialists/*/AGENT.md
ato-app/.agent/specialists/*/SPECIALIST_*.md
ato-app/.agent/skills/*/SKILL.md
ato-app/.agent/workflows/*.md
```

### Permanent Guides (5 files)
```
ato-app/FORENSIC_AUDIT_GUIDE.md    - User guide
ato-app/DEPLOYMENT_INSTRUCTIONS.md - Deployment guide
ato-app/IMPLEMENTATION_GUIDE.md    - Implementation guide
ato-app/QUICK_START.md             - Quick start
ato-app/ENVIRONMENT_VARIABLES_SETUP.md - Env setup
```

---

## DELETE - Session/Status Fluff (Estimated 200+ files)

### Pattern 1: Session Summaries (Delete ALL)
Files matching: `*SESSION*.md`, `*session*.md`, `*SUMMARY*.md` (except permanent guides)
```
ato-app/SESSION_SUMMARY.md
ato-app/OVERNIGHT_WORK_SUMMARY.md
ato-app/BACKLOG_SUMMARY_*.md
ato-app/PHASE*_COMPLETION_SUMMARY.md
ato-app/TASK_*_COMPLETION_SUMMARY.md
ato-app/UNI-230_PHASE*_COMPLETE.md
ato-app/LINEAR_*_PHASE*_UPDATE.md
```

### Pattern 2: Daily Reports (Delete ALL)
Files matching: `daily*.md`, `*daily*.md`
```
ato-app/daily-report*.md
```

### Pattern 3: Audit/Review Reports (Delete ALL)
Files matching: `*AUDIT*.md`, `*audit*.md`, `*REVIEW*.md` (except CODEBASE_AUDIT_SUMMARY.md)
```
ato-app/AUDIT_FINDINGS_*.md
ato-app/SCHEMA_AUDIT_REPORT.md
ato-app/CODEBASE_AUDIT_SUMMARY.md (KEEP - comprehensive audit)
```

### Pattern 4: Status Reports (Delete ALL)
Files matching: `*STATUS*.md`, `*status*.md`, `SYNC_STATUS*.md`
```
ato-app/ATO_PROJECT_STATUS.md
ato-app/DEPLOYMENT_STATUS.md
ato-app/SYNC_STATUS_REPORT.md
ato-app/IMPLEMENTATION_STATUS.md
ato-app/ORCHESTRATION_PHASE_COMPLETE.md
ato-app/MISSION_ACCOMPLISHED.md
ato-app/FIX_COMPLETE_SUMMARY.md
ato-app/PHASE_1_5_COMPLETE.md
```

### Pattern 5: Testing Reports (Delete ALL)
Files matching: `TEST_*.md`, `*TEST*.md`
```
ato-app/TEST_RESULTS.md
ato-app/TEST_PHASES_*.md
```

### Pattern 6: Integration Summaries (Delete ALL)
Files matching: `*INTEGRATION*_SUMMARY.md`, `*_IMPLEMENTATION_SUMMARY.md`
```
ato-app/*_INTEGRATION_SUMMARY.md
ato-app/*_IMPLEMENTATION_SUMMARY.md
ato-app/MYOB_INTEGRATION_*.md
ato-app/QUICKBOOKS_INTEGRATION_*.md
ato-app/QUICKBOOKS_UI_INTEGRATION_GAPS.md
```

### Pattern 7: Standalone Completion Docs (Delete ALL)
```
ato-app/TASK_4_COMPLETION_SUMMARY.md
ato-app/TASK_5_COMPLETION_SUMMARY.md
ato-app/TASK_6_COMPLETION_SUMMARY.md
ato-app/TASK_7_COMPLETION_SUMMARY.md
ato-app/PHASE2_COMPLETION_SUMMARY.md
ato-app/PHASE2_TESTING_GUIDE.md
ato-app/PHASE2_TEAM_COLLABORATION_PLAN.md
ato-app/TAX_ALERTS_IMPLEMENTATION_SUMMARY.md
ato-app/DATA_NORMALIZATION_PLATFORM_SUMMARY.md
ato-app/MYOB_AI_ANALYSIS_SUMMARY.md
ato-app/MYOB_SYNC_IMPLEMENTATION_SUMMARY.md
ato-app/MYOB_UI_INTEGRATION_SUMMARY.md
```

### Pattern 8: Database/Migration Fix Reports (Delete ALL)
```
ato-app/APPLY_DATABASE_FIX.md
ato-app/FIX_COMPLETE_SUMMARY.md
ato-app/SIMPLE_DATABASE_FIX.sql (move to scripts/)
ato-app/RUN_MIGRATIONS_GUIDE.md
ato-app/RUN_THIS_IN_SUPABASE.sql (move to scripts/)
ato-app/DATABASE_SETUP_FIXED.sql (move to scripts/)
ato-app/FINAL_DATABASE_SETUP.sql (move to scripts/)
ato-app/COMBINED_MIGRATIONS.sql (move to scripts/)
```

### Pattern 9: Temporary/One-time Docs (Delete ALL)
```
ato-app/START_AUDIT_NOW.md
ato-app/RELINK_INSTRUCTIONS.md
ato-app/RESET_INSTRUCTIONS.md
ato-app/RECOVERY_PLAN.md
ato-app/RUNBOOK.md
ato-app/QUICK_ENV_SETUP.md
ato-app/RESEARCH.md
ato-app/PLAN.md
ato-app/STRATEGY.md
ato-app/LIMITS.md
ato-app/GEMINI.md
ato-app/ARCHIVED.md
ato-app/MIGRATION_GUIDE.md
ato-app/KNOWLEDGE.md
```

### Pattern 10: Archive Folder (Delete MOST)
```
ato-app/docs/archive/*
```
Keep only truly historical reference material here.

---

## ACTION ITEMS

### Step 1: Create Backup
```bash
# Before deleting anything, create backup
cd c:\ATO
copy ato-app docs-backup-before-cleanup /E /I
```

### Step 2: Move SQL Files
```bash
cd c:\ATO\ato-app
move *.sql scripts\migrations\ 2>nul
```

### Step 3: Delete Fluff (by pattern)
```bash
# Delete session summaries
del /Q *SESSION*.md *session*.md 2>nul
del /Q *SUMMARY*.md 2>nul

# Delete status reports
del /Q *STATUS*.md *status*.md 2>nul
del /Q SYNC_STATUS*.md 2>nul

# Delete completion docs
del /Q TASK_*_COMPLETION*.md 2>nul
del /Q PHASE*_COMPLETION*.md 2>nul
del /Q *_COMPLETE*.md 2>nul
del /Q *_COMPLETE*.md 2>nul

# Delete daily reports
del /Q daily*.md 2>nul

# Delete test reports
del /Q TEST_*.md *TEST*.md 2>nul

# Delete integration summaries
del /Q *_INTEGRATION_SUMMARY.md 2>nul
del /Q *_IMPLEMENTATION_SUMMARY.md 2>nul

# Delete audit findings
del /Q AUDIT_FINDINGS_*.md 2>nul
del /Q *_AUDIT_*.md 2>nul

# Delete temporary docs
del /Q *_NOW.md 2>nul
del /Q START_*.md 2>nul
```

### Step 4: Clean Root Level
c:\ATO has 80 .md files - most should be deleted:
- Keep: PLANNING.md, DESIGN.md, requirements.md (if they exist)
- Delete: All session summaries, status reports, completion docs

---

## ESTIMATED RESULTS

**Before**: 277 .md files
**After**: ~40-50 .md files (85% reduction)

**What Remains**:
- ✅ README.md and core docs
- ✅ Agent configuration files
- ✅ Permanent guides (deployment, implementation, etc.)
- ✅ Technical specifications
- ✅ Essential API/architecture docs

---

## FILES TO MANUALLY REVIEW

These need human decision:
```
ato-app/PROJECT_ROADMAP_2026.md - Keep or archive?
ato-app/ATO_BACKLOG.md - Keep or delete?
ato-app/BACKLOG_SUMMARY_*.md - Delete (has date)
ato-app/GRANT_STRATEGY_ROI.md - Keep if still relevant
ato-app/FORENSIC_TAX_AUDIT_REPORT.pdf - Keep (PDF)
ato-app/CUSTOMIZATION_GUIDE.md - Keep or delete?
ato-app/COMPLIANCE_RISK_ASSESSMENT.md - Keep or delete?
ato-app/DATA_SOVEREIGNTY.md - Keep or delete?
ato-app/ENTERPRISE_MULTI_ORG_STATUS.md - Keep or delete?
```

---

## POST-CLEANUP TASKS

1. **Update .gitignore** - Add patterns to prevent future clutter:
   ```
   *_SUMMARY.md
   *_COMPLETE*.md
   *SESSION*.md
   daily-*.md
   TEST_RESULTS.md
   ```

2. **Create CONTRIBUTING.md** - Document what docs to create and where

3. **Archive Strategy** - Setup process for archiving old docs properly

4. **Cleanup scripts/** - Remove old PowerShell/bash scripts that are one-time use

---

**Ready to execute?** Run the commands in Step 3 or I can generate a PowerShell script to do it all automatically.
