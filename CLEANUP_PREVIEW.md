# Documentation Cleanup Preview
## What the Script Will Delete

Based on the WhatIf preview, here's what will be cleaned up:

### 📊 Statistics
- **Total .md files found**: 277 in ato-app/ + 22 in root = **299 total**
- **Estimated deletions**: ~200+ files
- **Estimated remaining**: ~40-50 files (85% reduction)

### 🗑️ Files to be DELETED

#### Session Summaries (30+ files)
- `SESSION_SUMMARY.md`
- `OVERNIGHT_WORK_SUMMARY.md`
- `BACKLOG_SUMMARY_2026-01-28.md`
- `DATA_NORMALIZATION_PLATFORM_SUMMARY.md`
- `IMPLEMENTATION_SUMMARY.md`
- All `TASK_*_COMPLETION_SUMMARY.md` files (Task 4, 5, 6, 7)
- All `PHASE*_COMPLETION_SUMMARY.md` files
- All `.planning/phases/*/*-SUMMARY.md` files
- All `docs/archive/*_COMPLETE*.md` files

#### Integration Summaries (15+ files)
- `MYOB_INTEGRATION_STATUS.md`
- `MYOB_INTEGRATION_SUMMARY.md`
- `MYOB_UI_INTEGRATION_SUMMARY.md`
- `MYOB_SYNC_IMPLEMENTATION_SUMMARY.md`
- `MYOB_AI_ANALYSIS_SUMMARY.md`
- `QUICKBOOKS_INTEGRATION_SUMMARY.md`
- `QUICKBOOKS_UI_INTEGRATION_GAPS.md`
- `QUICKBOOKS_PRODUCTION_CHECKLIST.md`
- `SLACK_INTEGRATION_QUICKSTART.md`
- `TAX_ALERTS_IMPLEMENTATION_SUMMARY.md`
- `ATODE_INTEGRATION_ANALYSIS.md`

#### Status Reports (15+ files)
- `ATO_PROJECT_STATUS.md`
- `AGENT_SYSTEM_STATUS.md`
- `DEPLOYMENT_STATUS.md`
- `IMPLEMENTATION_STATUS.md`
- `MULTI_AGENT_ORCHESTRATION_STATUS.md`
- `ENTERPRISE_MULTI_ORG_STATUS.md`
- All `docs/archive/*_STATUS*.md` files

#### Daily Reports (3 files)
- `daily-report.md`
- `daily-report-sample.md`
- `daily-report-updated.md`

#### Test Reports (Multiple files)
- `TEST_RESULTS.md`
- `TEST_PHASES_*.md`
- Various test-related summaries

#### Audit/Findings Reports
- `AUDIT_FINDINGS_*.md` (Backend, Frontend, Data, QA, Security)
- `SCHEMA_AUDIT_REPORT.md`

#### Temporary/One-time Docs
- `*_NOW.md` files
- `START_*.md` files
- `MISSION_ACCOMPLISHED.md`
- `ORCHESTRATION_PHASE_COMPLETE.md`
- `UNI-230_PHASE1_COMPLETE.md`
- Various fix/summary documents

#### SQL Files (Move to scripts/migrations/)
- `SIMPLE_DATABASE_FIX.sql`
- `RUN_THIS_IN_SUPABASE.sql`
- `DATABASE_SETUP_FIXED.sql`
- `FINAL_DATABASE_SETUP.sql`
- `COMBINED_MIGRATIONS.sql`

### ✅ Files to be PRESERVED

#### Core Documentation
- `README.md` - Main project docs
- `CLAUDE.md` - AI integration guide
- `spec.md` - Technical spec
- `ARCHITECTURE.md` - System architecture
- `API_DOCUMENTATION.md` - API reference
- `DESIGN_SYSTEM.md` - UI/UX guide
- `AGENTS_README.md` - Agent overview
- `DATABASE_MIGRATIONS.md` - Database docs
- `MULTI_AGENT_ARCHITECTURE.md` - Framework spec

#### Permanent Guides
- `FORENSIC_AUDIT_GUIDE.md` - User guide
- `DEPLOYMENT_INSTRUCTIONS.md` - Deployment
- `IMPLEMENTATION_GUIDE.md` - Implementation
- `QUICK_START.md` - Quick start
- `ENVIRONMENT_VARIABLES_SETUP.md` - Env setup
- `CODEBASE_AUDIT_SUMMARY.md` - Comprehensive audit

#### Agent Configuration (ALL in .agent/)
- `.agent/AGENTS.md`
- `.agent/orchestrator/ORCHESTRATOR.md`
- `.agent/specialists/*/AGENT.md`
- `.agent/specialists/*/SPECIALIST_*.md`
- `.agent/skills/*/SKILL.md`
- `.agent/workflows/*.md`

### 🎯 Results After Cleanup

**Before**: 299 .md files
**After**: ~40-50 .md files
**Reduction**: 85% (249+ files deleted)

**What You Keep**:
- ✅ README and essential documentation
- ✅ Agent configuration files
- ✅ Permanent guides and references
- ✅ Technical specifications
- ✅ API and architecture docs

**What Gets Removed**:
- 🗑️ Session summaries (outdated progress reports)
- 🗑️ Status reports (point-in-time snapshots)
- 🗑️ Completion documents (redundant with git history)
- 🗑️ Daily reports (no long-term value)
- 🗑️ Integration summaries (outdated as features evolve)
- 🗑️ Test reports (auto-generated, recreate anytime)

## Next Steps

1. **Review this preview** - Confirm these are the files you want deleted
2. **Run the actual cleanup**:
   ```powershell
   cd c:\ATO
   powershell -ExecutionPolicy Bypass -File cleanup-docs.ps1
   ```
3. **Verify results** - Check that essential files remain
4. **Commit changes** - `git add -A && git commit -m "docs: cleanup 200+ obsolete markdown files"`

## Safety Features

- ✅ **Backup created** before any deletions
- ✅ **WhatIf mode** shows what would be deleted
- ✅ **Whitelist protection** for essential files
- ✅ **Agent config preservation** - nothing in .agent/ deleted
- ✅ **SQL files moved** to proper location, not deleted

Ready to proceed? The script is safe and will only delete the fluff files while preserving all essential documentation.
