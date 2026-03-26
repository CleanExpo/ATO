# Architectural Decisions — Append-Only Log

> **Protocol**: Agents append entries. Never delete or modify existing entries.
> **Format**: `[DD/MM/YYYY] DECISION: X | REASON: Y | ALTERNATIVES REJECTED: Z`

---

[26/03/2026] DECISION: Integrate NodeJS-Starter-V1 as additive governance layer | REASON: Provides TDD, verification gates, CI/CD security, Docker local dev without modifying existing ATO code | ALTERNATIVES REJECTED: Restructuring ATO to match starter layout (too risky), cherry-picking individual patterns (too slow)

[26/03/2026] DECISION: Use kebab-case → snake_case naming for integrated agents/skills | REASON: ATO uses snake_case for existing agents (rnd_tax_specialist, cgt_concession_planner) | ALTERNATIVES REJECTED: Keeping kebab-case (inconsistent with ATO convention)

[26/03/2026] DECISION: Migrate default AI model to gemini-3-flash-preview | REASON: User requirement — best multimodal model, strongest agentic capabilities, 1M token input | ALTERNATIVES REJECTED: Keeping gemini-2.0-flash (outdated), using gemini-2.5-pro only (slower, more expensive)

[26/03/2026] DECISION: Multi-jurisdiction via additive engines (lib/analysis/nz/, lib/analysis/uk/) | REASON: Existing AU engines remain untouched, new engines extend base class with jurisdiction awareness | ALTERNATIVES REJECTED: Refactoring AU engines to be jurisdiction-aware (too risky to existing code)

[26/03/2026] DECISION: Weekly compliance CRON via Vercel crons (Monday 3AM UTC) | REASON: Extends existing vercel.json cron pattern, CRON_SECRET auth already in place | ALTERNATIVES REJECTED: External cron service (unnecessary complexity), daily frequency (too aggressive for rate changes)
